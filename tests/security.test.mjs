import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { BASE_URL, api, lastCode, sql, startServer, stopServer, uniqueIp, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1100)); // JWT times are whole seconds
const sync = (token, changes) => api("POST", "/api/v1/sync", { token, body: { cursor: 0, changes } });

describe("security headers", () => {
  test("API answers: no framework banner, no sniffing or framing, nothing cached", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    assert.match(res.headers.get("strict-transport-security") ?? "", /max-age=\d+/);
    assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  test("the public health check says only up or down", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test("web pages can't be framed and don't name the framework", async () => {
    const res = await fetch(`${BASE_URL}/admin/login`);
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  });
});

describe("signing out everywhere takes effect at once", () => {
  test("after a password reset, an access token issued before it stops working", async () => {
    const user = await verifiedUser("sec-reset");
    assert.equal((await api("GET", "/api/v1/me", { token: user.accessToken })).status, 200);
    await nextSecond();

    await api("POST", "/api/v1/auth/forgot-password", { body: { email: user.email }, ip: user.ip });
    const code = await lastCode(user.email);
    const reset = await api("POST", "/api/v1/auth/reset-password", {
      body: { email: user.email, code, password: "another long password" },
      ip: user.ip,
    });
    assert.equal(reset.status, 200);

    assert.equal((await api("GET", "/api/v1/me", { token: user.accessToken })).status, 401);
    // Signing in again works straight away.
    const login = await api("POST", "/api/v1/auth/login", { body: { email: user.email, password: "another long password" }, ip: user.ip });
    assert.equal((await api("GET", "/api/v1/me", { token: login.body.accessToken })).status, 200);
  });

  test("after deactivation, the user's access token stops working", async () => {
    const admin = await verifiedUser("sec-admin");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const victim = await verifiedUser("sec-deact");
    const [{ id }] = await sql("SELECT id FROM users WHERE email = ?", [victim.email]);
    await nextSecond();

    const off = await api("PATCH", `/api/v1/admin/users/${id}`, { token: admin.accessToken, body: { status: "deactivated" } });
    assert.equal(off.status, 204);
    const res = await api("GET", "/api/v1/me", { token: victim.accessToken });
    assert.ok([401, 403].includes(res.status));
  });
});

describe("input sanitising", () => {
  test("lesson notes keep the editor's formatting and lose scripts, handlers and unknown tags", async () => {
    const user = await verifiedUser("sec-html");
    const body =
      '<h2 onclick="steal()">Stoicism</h2><p>Keep <strong style="x">this</strong></p>' +
      '<script>alert(1)</script><img src=x onerror=alert(2)><iframe src="https://evil.test"></iframe>' +
      '<a href="javascript:alert(3)">link text</a><!-- hidden --><ul><li><p>one</p></li></ul> 5 < 6';
    const lesson = { id: randomUUID(), title: "Notes", body, lessonDate: "2026-10-20", tags: [], updatedAt: Date.now(), deletedAt: null };
    const res = await sync(user.accessToken, { lessons: [lesson] });
    assert.deepEqual(res.body.rejected, []);
    const stored = res.body.changes.lessons.find((item) => item.id === lesson.id).body;
    assert.equal(stored, "<h2>Stoicism</h2><p>Keep <strong>this</strong></p>link text<ul><li><p>one</p></li></ul> 5 &lt; 6");
  });

  test("control and text-direction characters are removed from names and text", async () => {
    const user = await verifiedUser("sec-chars");
    const task = {
      id: randomUUID(),
      weekStart: "2026-10-19",
      title: "Pay\u0000 rent‮ gnirts\u0007",
      done: false,
      carriedFromId: null,
      carriedToId: null,
      sortOrder: 0,
      updatedAt: Date.now(),
      deletedAt: null,
    };
    const res = await sync(user.accessToken, { weeklyTasks: [task] });
    assert.equal(res.body.changes.weeklyTasks.find((item) => item.id === task.id).title, "Pay rent gnirts");

    const named = await api("PATCH", "/api/v1/me", { token: user.accessToken, body: { name: "Ann‮ie\u0000" } });
    assert.equal(named.body.user.name, "Annie");
  });
});

describe("routes that need a signed-in user", () => {
  test("every app route refuses requests without a valid token", async () => {
    const routes = [
      ["GET", "/api/v1/me"],
      ["PATCH", "/api/v1/me", { name: "x" }],
      ["DELETE", "/api/v1/me", { password: "x" }],
      ["POST", "/api/v1/sync", { cursor: 0, changes: {} }],
      ["GET", "/api/v1/inbox"],
      ["POST", "/api/v1/inbox/1/read"],
      ["DELETE", "/api/v1/inbox/1"],
      ["POST", "/api/v1/inbox/read-all"],
      ["POST", "/api/v1/devices", { token: "abcdefghijkl", platform: "android" }],
      ["DELETE", "/api/v1/devices", { token: "abcdefghijkl" }],
      ["POST", "/api/v1/export/link", { format: "json" }],
      ["GET", "/api/v1/admin/users"],
      ["GET", "/api/v1/admin/stats"],
    ];
    for (const [method, path, body] of routes) {
      for (const token of [undefined, "not-a-jwt", "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0."]) {
        const res = await api(method, path, { body, token, ip: uniqueIp() });
        assert.equal(res.status, 401, `${method} ${path} with ${token ?? "no token"}`);
      }
    }
  });

  test("the cleanup job refuses a wrong secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/cleanup`, { headers: { authorization: "Bearer guess" } });
    assert.equal(res.status, 401);
  });
});
