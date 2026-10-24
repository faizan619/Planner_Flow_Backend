import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { api, sql, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

async function adminUser(label) {
  const admin = await verifiedUser(label);
  await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
  return admin;
}
const userId = (account) => account.user.id;
const waitFor = async (check, timeout = 10_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};

describe("admin access control", () => {
  test("non-admins and signed-out users can't use admin routes", async () => {
    const user = await verifiedUser("not-admin");
    const routes = [
      ["GET", "/api/v1/admin/stats"],
      ["GET", "/api/v1/admin/users"],
      ["PATCH", `/api/v1/admin/users/${userId(user)}`, { status: "deactivated" }],
      ["GET", "/api/v1/admin/announcements"],
      ["POST", "/api/v1/admin/announcements", { title: "Hi", body: "Hello", audience: "all" }],
    ];
    for (const [method, path, body] of routes) {
      assert.equal((await api(method, path, { token: user.accessToken, body })).status, 403, `${method} ${path}`);
      assert.equal((await api(method, path, { body })).status, 401, `${method} ${path} signed out`);
    }
  });

  test("an admin demoted to user loses access immediately", async () => {
    const admin = await adminUser("demoted");
    assert.equal((await api("GET", "/api/v1/admin/stats", { token: admin.accessToken })).status, 200);
    await sql("UPDATE users SET role = 'user' WHERE email = ?", [admin.email]);
    assert.equal((await api("GET", "/api/v1/admin/stats", { token: admin.accessToken })).status, 403);
  });
});

describe("admin users and stats", () => {
  test("lists and searches users without leaking password hashes", async () => {
    const admin = await adminUser("lister");
    const target = await verifiedUser("findme-zebra");
    const res = await api("GET", "/api/v1/admin/users?q=findme-zebra", { token: admin.accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 1);
    assert.equal(res.body.users[0].email, target.email);
    assert.equal(res.body.users[0].passwordHash, undefined);
    assert.equal(res.body.users[0].password_hash, undefined);
  });

  test("deactivating signs the user out; reactivating lets them back in", async () => {
    const admin = await adminUser("deactivator");
    const target = await verifiedUser("deactivate-me");
    const off = await api("PATCH", `/api/v1/admin/users/${userId(target)}`, { token: admin.accessToken, body: { status: "deactivated" } });
    assert.equal(off.status, 204);
    assert.equal((await api("GET", "/api/v1/me", { token: target.accessToken })).status, 403);
    assert.equal((await api("POST", "/api/v1/auth/refresh", { body: { refreshToken: target.refreshToken } })).status, 401);

    await api("PATCH", `/api/v1/admin/users/${userId(target)}`, { token: admin.accessToken, body: { status: "active" } });
    assert.equal((await api("GET", "/api/v1/me", { token: target.accessToken })).status, 200);
  });

  test("an admin can't deactivate themselves; bad input is rejected", async () => {
    const admin = await adminUser("self");
    const self = await api("PATCH", `/api/v1/admin/users/${userId(admin)}`, { token: admin.accessToken, body: { status: "deactivated" } });
    assert.equal(self.body.error.code, "CANNOT_CHANGE_SELF");
    const bad = await api("PATCH", `/api/v1/admin/users/${userId(admin)}`, { token: admin.accessToken, body: { status: "banned" } });
    assert.equal(bad.status, 400);
    assert.equal((await api("PATCH", "/api/v1/admin/users/999999999", { token: admin.accessToken, body: { status: "active" } })).status, 404);
  });

  test("stats count users, and syncing marks a user active this week", async () => {
    const admin = await adminUser("stats");
    const before = (await api("GET", "/api/v1/admin/stats", { token: admin.accessToken })).body.stats;
    const user = await verifiedUser("active-user");
    await api("POST", "/api/v1/sync", { token: user.accessToken, body: { cursor: 0, changes: {} } });
    const updated = await waitFor(async () => {
      const now = (await api("GET", "/api/v1/admin/stats", { token: admin.accessToken })).body.stats;
      return now.total === before.total + 1 && now.activeThisWeek > before.activeThisWeek;
    });
    assert.ok(updated, "total and active-this-week went up");
  });
});

describe("announcements and inbox", () => {
  test("an announcement to all users reaches every inbox, unread, with push skipped when Firebase isn't set up", async () => {
    const admin = await adminUser("announcer");
    const reader = await verifiedUser("reader");
    const sent = await api("POST", "/api/v1/admin/announcements", {
      token: admin.accessToken,
      body: { title: "New feature", body: "Books are here!", audience: "all" },
    });
    assert.equal(sent.status, 201);
    assert.ok(sent.body.announcement.recipients >= 2);

    const box = await api("GET", "/api/v1/inbox", { token: reader.accessToken });
    assert.equal(box.body.items[0].title, "New feature");
    assert.equal(box.body.items[0].readAt, null);
    assert.ok(box.body.unreadCount >= 1);

    const skipped = await waitFor(async () => {
      const rows = await sql("SELECT push_status FROM announcement_recipients WHERE announcement_id = ?", [sent.body.announcement.id]);
      return rows.every((row) => row.push_status === "skipped");
    });
    assert.ok(skipped, "push is marked skipped without FIREBASE_SERVICE_ACCOUNT");
  });

  test("selected audience only reaches the chosen users", async () => {
    const admin = await adminUser("picker");
    const chosen = await verifiedUser("chosen");
    const other = await verifiedUser("left-out");
    const sent = await api("POST", "/api/v1/admin/announcements", {
      token: admin.accessToken,
      body: { title: "Just for you", body: "Hi", audience: "selected", userIds: [userId(chosen)] },
    });
    assert.equal(sent.body.announcement.recipients, 1);
    assert.equal((await api("GET", "/api/v1/inbox", { token: chosen.accessToken })).body.items[0].title, "Just for you");
    const otherBox = await api("GET", "/api/v1/inbox", { token: other.accessToken });
    assert.ok(!otherBox.body.items.some((item) => item.title === "Just for you"));

    const empty = await api("POST", "/api/v1/admin/announcements", {
      token: admin.accessToken,
      body: { title: "x", body: "y", audience: "selected", userIds: [] },
    });
    assert.equal(empty.status, 400);
  });

  test("users can only mark their own announcements read (IDOR)", async () => {
    const admin = await adminUser("idor-admin");
    const chosen = await verifiedUser("idor-chosen");
    const outsider = await verifiedUser("idor-outsider");
    const sent = await api("POST", "/api/v1/admin/announcements", {
      token: admin.accessToken,
      body: { title: "Private", body: "Only chosen", audience: "selected", userIds: [userId(chosen)] },
    });
    const id = sent.body.announcement.id;

    assert.equal((await api("POST", `/api/v1/inbox/${id}/read`, { token: outsider.accessToken })).status, 404);
    const stillUnread = await api("GET", "/api/v1/inbox", { token: chosen.accessToken });
    assert.equal(stillUnread.body.items.find((item) => item.id === String(id)).readAt, null);

    assert.equal((await api("POST", `/api/v1/inbox/${id}/read`, { token: chosen.accessToken })).status, 204);
    const read = await api("GET", "/api/v1/inbox", { token: chosen.accessToken });
    assert.ok(read.body.items.find((item) => item.id === String(id)).readAt);
    assert.equal(read.body.unreadCount, 0);
  });

  test("devices register for push and move to whoever signs in last", async () => {
    const first = await verifiedUser("device-1");
    const second = await verifiedUser("device-2");
    const token = `fcm-token-${Date.now()}-abcdef`;
    assert.equal((await api("POST", "/api/v1/devices", { token: first.accessToken, body: { token, platform: "android" } })).status, 204);
    await api("POST", "/api/v1/devices", { token: second.accessToken, body: { token, platform: "android" } });
    const rows = await sql("SELECT user_id FROM device_tokens WHERE token = ?", [token]);
    assert.equal(String(rows[0].user_id), userId(second));

    // The first user can't remove a token that now belongs to someone else.
    await api("DELETE", "/api/v1/devices", { token: first.accessToken, body: { token } });
    assert.equal((await sql("SELECT COUNT(*) AS n FROM device_tokens WHERE token = ?", [token]))[0].n, 1);
    await api("DELETE", "/api/v1/devices", { token: second.accessToken, body: { token } });
    assert.equal((await sql("SELECT COUNT(*) AS n FROM device_tokens WHERE token = ?", [token]))[0].n, 0);
  });
});
