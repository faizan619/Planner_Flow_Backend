import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { api, sql, startServer, stopServer, uniqueEmail, uniqueIp, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const key = () => randomUUID();

describe("Idempotency-Key", () => {
  test("a retried token refresh gets the same tokens and doesn't sign the device out", async () => {
    const user = await verifiedUser("idem-refresh");
    const headers = { "idempotency-key": key() };
    const body = { refreshToken: user.refreshToken };

    const first = await api("POST", "/api/v1/auth/refresh", { body, ip: user.ip, headers });
    const retry = await api("POST", "/api/v1/auth/refresh", { body, ip: user.ip, headers });
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.refreshToken, first.body.refreshToken, "the retry gets the first answer");
    assert.equal(retry.headers.get("idempotent-replayed"), "true");

    // The new token still works: the retry wasn't treated as reuse of a stolen token.
    const next = await api("POST", "/api/v1/auth/refresh", { body: { refreshToken: first.body.refreshToken }, ip: user.ip });
    assert.equal(next.status, 200);
  });

  test("without a key, reusing a refresh token is still refused", async () => {
    const user = await verifiedUser("idem-nokey");
    const body = { refreshToken: user.refreshToken };
    assert.equal((await api("POST", "/api/v1/auth/refresh", { body, ip: user.ip })).status, 200);
    assert.equal((await api("POST", "/api/v1/auth/refresh", { body, ip: user.ip })).status, 401);
  });

  test("a retried announcement is sent once", async () => {
    const admin = await verifiedUser("idem-admin");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const title = `Once ${Date.now()}`;
    const options = { body: { title, body: "Hello", audience: "all" }, token: admin.accessToken, headers: { "idempotency-key": key() } };

    const first = await api("POST", "/api/v1/admin/announcements", options);
    const retry = await api("POST", "/api/v1/admin/announcements", options);
    assert.equal(first.status, 201);
    assert.equal(retry.status, 201);
    assert.equal(retry.body.announcement.id, first.body.announcement.id);
    const [{ count }] = await sql("SELECT COUNT(*) AS count FROM announcements WHERE title = ?", [title]);
    assert.equal(Number(count), 1);
  });

  test("a retried signup answers like the first time instead of 'email taken'", async () => {
    const email = uniqueEmail("idem-signup");
    const options = { body: { name: "Idem", email, password: "correct horse battery" }, ip: uniqueIp(), headers: { "idempotency-key": key() } };
    const first = await api("POST", "/api/v1/auth/signup", options);
    const retry = await api("POST", "/api/v1/auth/signup", options);
    assert.equal(first.status, 201);
    assert.deepEqual(retry.body, first.body);
    assert.equal(retry.status, 201);
  });

  test("the same key with a different request is refused", async () => {
    const headers = { "idempotency-key": key() };
    const ip = uniqueIp();
    await api("POST", "/api/v1/auth/forgot-password", { body: { email: uniqueEmail("a") }, ip, headers });
    const other = await api("POST", "/api/v1/auth/forgot-password", { body: { email: uniqueEmail("b") }, ip, headers });
    assert.equal(other.status, 422);
    assert.equal(other.body.error.code, "IDEMPOTENCY_KEY_REUSED");
  });

  test("a malformed key is rejected", async () => {
    const res = await api("POST", "/api/v1/auth/forgot-password", {
      body: { email: uniqueEmail("c") },
      ip: uniqueIp(),
      headers: { "idempotency-key": "short!" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_IDEMPOTENCY_KEY");
  });
});
