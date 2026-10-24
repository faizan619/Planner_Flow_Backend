import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { BASE_URL, PASSWORD, api, sql, startServer, stopServer, uniqueIp, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const DEFAULTS = { security: true, admin: true, usage: true, retentionDays: 45 };

async function adminUser(label) {
  const admin = await verifiedUser(label);
  await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
  return admin;
}

// Logs are written just after the response, so wait for them.
async function logsFor(where, params, { atLeast = 1, timeout = 8_000 } = {}) {
  const deadline = Date.now() + timeout;
  let rows = [];
  while (Date.now() < deadline) {
    rows = await sql(`SELECT * FROM activity_logs WHERE ${where} ORDER BY id`, params);
    if (rows.length >= atLeast) return rows;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return rows;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));

let settingsAdmin;
const setLogSettings = (settings) =>
  api("PATCH", "/api/v1/admin/log-settings", { token: settingsAdmin.accessToken, body: settings });

describe("activity logs", () => {
  before(async () => {
    settingsAdmin = await adminUser("logs-settings-admin");
  });
  afterEach(() => setLogSettings(DEFAULTS));

  test("security events: sign-up, verification, failed and successful sign-in", async () => {
    const user = await verifiedUser("log-security");
    await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "not the password" }, ip: uniqueIp() });
    await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: PASSWORD }, ip: "203.0.113.7" });

    const rows = await logsFor("email = ? AND category = 'security'", [user.email], { atLeast: 4 });
    const events = rows.map((row) => row.event);
    assert.deepEqual(events.slice(0, 2), ["signup", "email_verified"]);
    const failed = rows.find((row) => row.event === "login_failed");
    assert.equal(JSON.parse(JSON.stringify(failed.details)).reason ?? JSON.parse(failed.details).reason, "wrong password");
    const success = rows.find((row) => row.event === "login");
    assert.equal(success.ip, "203.0.113.7");
    assert.equal(String(success.user_id), user.user.id);
  });

  test("never stores passwords, codes or tokens", async () => {
    const user = await verifiedUser("log-secrets");
    await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "Sup3r-secret-attempt" }, ip: uniqueIp() });
    await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email }, ip: uniqueIp() });
    await settle();
    const dump = JSON.stringify(await sql("SELECT * FROM activity_logs WHERE email = ?", [user.email]));
    for (const secret of [PASSWORD, "Sup3r-secret-attempt", user.accessToken, user.refreshToken]) {
      assert.ok(!dump.includes(secret), "a secret leaked into the logs");
    }
  });

  test("rate-limit blocks are logged", async () => {
    const user = await verifiedUser("log-ratelimit");
    for (let i = 0; i < 6; i++) {
      await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "wrong-pass" }, ip: uniqueIp() });
    }
    const rows = await logsFor("event = 'rate_limited' AND details LIKE ?", ["%login:email%"]);
    assert.ok(rows.length >= 1);
  });

  test("admin events record which admin did it", async () => {
    const admin = await adminUser("log-admin");
    const target = await verifiedUser("log-target");
    await api("PATCH", `/api/v1/admin/users/${target.user.id}`, { token: admin.accessToken, body: { status: "deactivated" } });
    await api("POST", "/api/v1/admin/announcements", { token: admin.accessToken, body: { title: "Hi", body: "Hello", audience: "all" } });

    const [deactivated] = await logsFor("event = 'user_deactivated' AND user_id = ?", [target.user.id]);
    assert.equal(String(deactivated.actor_id), admin.user.id);
    assert.equal(deactivated.email, target.email);
    const [sent] = await logsFor("event = 'announcement_sent' AND actor_id = ?", [admin.user.id]);
    assert.ok(sent);
  });

  test("usage events: data export and app use", async () => {
    const user = await verifiedUser("log-usage");
    await api("POST", "/api/v1/export/link", { token: user.accessToken, body: { format: "json" } });
    await api("POST", "/api/v1/sync", { token: user.accessToken, body: { cursor: 0, changes: {} } });
    const rows = await logsFor("user_id = ? AND category = 'usage'", [user.user.id], { atLeast: 2 });
    assert.deepEqual(rows.map((row) => row.event).sort(), ["app_active", "data_exported"]);
  });

  test("each log type can be switched off", async () => {
    assert.equal((await setLogSettings({ ...DEFAULTS, security: false, usage: false, admin: false })).status, 200);
    const user = await verifiedUser("log-switched-off");
    await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "nope-nope" }, ip: uniqueIp() });
    await api("POST", "/api/v1/export/link", { token: user.accessToken, body: { format: "json" } });
    const other = await verifiedUser("log-switched-target");
    await api("PATCH", `/api/v1/admin/users/${other.user.id}`, { token: settingsAdmin.accessToken, body: { status: "deactivated" } });
    await settle();
    assert.equal((await sql("SELECT COUNT(*) AS n FROM activity_logs WHERE email IN (?, ?)", [user.email, other.email]))[0].n, 0);
  });

  test("changing the log settings is always recorded, even when switching the admin log off", async () => {
    await setLogSettings({ ...DEFAULTS, admin: false, retentionDays: 60 });
    const [change] = await logsFor("event = 'log_settings_changed' AND actor_id = ? AND details LIKE ?", [settingsAdmin.user.id, "%60%"]);
    assert.equal(String(change.actor_id), settingsAdmin.user.id);
    assert.equal(change.category, "admin");
    const details = typeof change.details === "string" ? JSON.parse(change.details) : change.details;
    assert.equal(details.admin, "true → false");
    assert.equal(details.retentionDays, "45 → 60");
  });

  test("retention: 7–365 days, default 45; older logs are removed", async () => {
    const current = await api("GET", "/api/v1/admin/log-settings", { token: settingsAdmin.accessToken });
    assert.deepEqual(current.body.settings, DEFAULTS);
    assert.equal((await setLogSettings({ ...DEFAULTS, retentionDays: 3 })).status, 400);
    assert.equal((await setLogSettings({ ...DEFAULTS, retentionDays: 400 })).status, 400);

    await sql(
      `INSERT INTO activity_logs (category, event, email, created_at) VALUES
       ('usage', 'old_test_event', 'old@test.local', CURRENT_TIMESTAMP - INTERVAL 50 DAY),
       ('usage', 'recent_test_event', 'recent@test.local', CURRENT_TIMESTAMP - INTERVAL 30 DAY)`
    );
    await api("GET", "/api/v1/admin/logs", { token: settingsAdmin.accessToken }); // opening the logs purges
    assert.equal((await sql("SELECT COUNT(*) AS n FROM activity_logs WHERE event = 'old_test_event'"))[0].n, 0);
    assert.equal((await sql("SELECT COUNT(*) AS n FROM activity_logs WHERE event = 'recent_test_event'"))[0].n, 1);
  });

  test("the logs list filters by type and user, newest first", async () => {
    const user = await verifiedUser("log-filter");
    await api("POST", "/api/v1/export/link", { token: user.accessToken, body: { format: "xlsx" } });
    await logsFor("user_id = ? AND event = 'data_exported'", [user.user.id]);

    const mine = await api("GET", `/api/v1/admin/logs?userId=${user.user.id}`, { token: settingsAdmin.accessToken });
    assert.equal(mine.status, 200);
    assert.ok(mine.body.logs.every((log) => log.userId === user.user.id));
    assert.equal(mine.body.logs[0].event, "data_exported", "newest first");
    assert.deepEqual(mine.body.logs[0].details, { format: "xlsx" });

    const usage = await api("GET", "/api/v1/admin/logs?category=usage", { token: settingsAdmin.accessToken });
    assert.ok(usage.body.logs.every((log) => log.category === "usage"));
    assert.equal((await api("GET", "/api/v1/admin/logs?category=bogus", { token: settingsAdmin.accessToken })).status, 400);
  });

  test("only admins can see logs or change log settings", async () => {
    const user = await verifiedUser("log-not-admin");
    assert.equal((await api("GET", "/api/v1/admin/logs", { token: user.accessToken })).status, 403);
    assert.equal((await api("GET", "/api/v1/admin/log-settings", { token: user.accessToken })).status, 403);
    assert.equal((await api("PATCH", "/api/v1/admin/log-settings", { token: user.accessToken, body: DEFAULTS })).status, 403);
    assert.equal((await api("GET", "/api/v1/admin/logs")).status, 401);
  });

  test("the daily cleanup job needs its secret", async () => {
    assert.equal((await fetch(`${BASE_URL}/api/cron/cleanup`)).status, 401);
    assert.equal((await fetch(`${BASE_URL}/api/cron/cleanup`, { headers: { authorization: "Bearer wrong" } })).status, 401);
    const res = await fetch(`${BASE_URL}/api/cron/cleanup`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(Object.keys(body.removed).sort(), ["emailCodes", "exportTokens", "logs", "rateLimits", "refreshTokens"]);
  });
});
