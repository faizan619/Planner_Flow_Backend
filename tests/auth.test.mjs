import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { api, lastCode, sql, startServer, stopServer, uniqueEmail, uniqueIp } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const PASSWORD = "correct horse battery";

// Signs up and verifies a new account; returns its email and tokens.
async function verifiedUser(label) {
  const email = uniqueEmail(label);
  const ip = uniqueIp();
  const signup = await api("POST", "/api/v1/auth/signup", { body: { name: "Test", email, password: PASSWORD }, ip });
  assert.equal(signup.status, 201);
  const verify = await api("POST", "/api/v1/auth/verify-email", { body: { email, code: await lastCode(email) }, ip });
  assert.equal(verify.status, 200);
  return { email, ip, ...verify.body };
}

describe("signup and verification", () => {
  test("rejects invalid input with field errors", async () => {
    const res = await api("POST", "/api/v1/auth/signup", {
      body: { name: "", email: "not-an-email", password: "short" },
      ip: uniqueIp(),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(res.body.error.fields.email);
    assert.ok(res.body.error.fields.password);
    assert.ok(res.body.error.fields.name);
  });

  test("rejects a body that isn't JSON", async () => {
    const res = await fetch(`${(await import("./helpers/server.mjs")).BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": uniqueIp() },
      body: "{not json",
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, "INVALID_JSON");
  });

  test("full flow: signup → login blocked until verified → verify signs in", async () => {
    const email = uniqueEmail("flow");
    const ip = uniqueIp();
    const signup = await api("POST", "/api/v1/auth/signup", {
      body: { name: "Flow", email: email.toUpperCase(), password: PASSWORD, timezone: "Asia/Kolkata" },
      ip,
    });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.email, email, "email is stored lower-case");

    const early = await api("POST", "/api/v1/auth/login", { body: { email, password: PASSWORD }, ip });
    assert.equal(early.status, 403);
    assert.equal(early.body.error.code, "EMAIL_NOT_VERIFIED");

    const wrong = await api("POST", "/api/v1/auth/verify-email", { body: { email, code: "000000" }, ip });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error.code, "INVALID_CODE");

    const verify = await api("POST", "/api/v1/auth/verify-email", { body: { email, code: await lastCode(email) }, ip });
    assert.equal(verify.status, 200);
    assert.ok(verify.body.accessToken);
    assert.ok(verify.body.refreshToken);
    assert.equal(verify.body.user.emailVerified, true);
    assert.equal(verify.body.user.passwordHash, undefined, "never returns the password hash");

    const login = await api("POST", "/api/v1/auth/login", { body: { email, password: PASSWORD }, ip });
    assert.equal(login.status, 200);
  });

  test("a code can only be used once", async () => {
    const email = uniqueEmail("once");
    const ip = uniqueIp();
    await api("POST", "/api/v1/auth/signup", { body: { name: "Once", email, password: PASSWORD }, ip });
    const code = await lastCode(email);
    assert.equal((await api("POST", "/api/v1/auth/verify-email", { body: { email, code }, ip })).status, 200);
    assert.equal((await api("POST", "/api/v1/auth/verify-email", { body: { email, code }, ip })).status, 400);
  });

  test("a code is burned after 5 wrong attempts", async () => {
    const email = uniqueEmail("burn");
    const ip = uniqueIp();
    await api("POST", "/api/v1/auth/signup", { body: { name: "Burn", email, password: PASSWORD }, ip });
    const code = await lastCode(email);
    const wrongCode = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < 5; i++) {
      await api("POST", "/api/v1/auth/verify-email", { body: { email, code: wrongCode }, ip });
    }
    const res = await api("POST", "/api/v1/auth/verify-email", { body: { email, code }, ip });
    assert.equal(res.status, 400, "the right code no longer works");
  });

  test("duplicate email is rejected", async () => {
    const { email } = await verifiedUser("dup");
    const res = await api("POST", "/api/v1/auth/signup", {
      body: { name: "Dup", email, password: PASSWORD },
      ip: uniqueIp(),
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "EMAIL_TAKEN");
  });
});

describe("login", () => {
  test("wrong password and unknown email give the same error", async () => {
    const { email } = await verifiedUser("wrongpw");
    const wrong = await api("POST", "/api/v1/auth/login", { body: { email, password: "nope-nope" }, ip: uniqueIp() });
    const unknown = await api("POST", "/api/v1/auth/login", {
      body: { email: uniqueEmail("ghost"), password: "nope-nope" },
      ip: uniqueIp(),
    });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test("is rate-limited per email", async () => {
    const { email } = await verifiedUser("ratelimit");
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await api("POST", "/api/v1/auth/login", { body: { email, password: "wrong-pass" }, ip: uniqueIp() });
      statuses.push(res.status);
      if (res.status === 429) assert.ok(Number(res.headers.get("retry-after")) > 0);
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
  });

  test("signup is rate-limited per IP", async () => {
    const ip = uniqueIp();
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await api("POST", "/api/v1/auth/signup", {
        body: { name: "Spam", email: uniqueEmail("spam"), password: PASSWORD },
        ip,
      });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
  });
});

describe("access and refresh tokens", () => {
  test("/me needs a valid access token", async () => {
    const { accessToken, email } = await verifiedUser("me");
    assert.equal((await api("GET", "/api/v1/me")).status, 401);
    assert.equal((await api("GET", "/api/v1/me", { token: "garbage" })).status, 401);
    assert.equal((await api("GET", "/api/v1/me", { token: `${accessToken.slice(0, -2)}xx` })).status, 401);

    const res = await api("GET", "/api/v1/me", { token: accessToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, email);
  });

  test("refresh rotates the token, and reusing an old one revokes the family", async () => {
    const { refreshToken: first } = await verifiedUser("rotate");

    const second = await api("POST", "/api/v1/auth/refresh", { body: { refreshToken: first } });
    assert.equal(second.status, 200);
    assert.notEqual(second.body.refreshToken, first);

    const reuse = await api("POST", "/api/v1/auth/refresh", { body: { refreshToken: first } });
    assert.equal(reuse.status, 401);

    const afterTheft = await api("POST", "/api/v1/auth/refresh", { body: { refreshToken: second.body.refreshToken } });
    assert.equal(afterTheft.status, 401, "the newer token was revoked too");
  });

  test("logout revokes the refresh token", async () => {
    const { refreshToken } = await verifiedUser("logout");
    assert.equal((await api("POST", "/api/v1/auth/logout", { body: { refreshToken } })).status, 204);
    assert.equal((await api("POST", "/api/v1/auth/refresh", { body: { refreshToken } })).status, 401);
  });

  test("a deactivated account is locked out immediately", async () => {
    const { email, accessToken, refreshToken } = await verifiedUser("deactivated");
    await sql("UPDATE users SET status = 'deactivated' WHERE email = ?", [email]);

    const me = await api("GET", "/api/v1/me", { token: accessToken });
    assert.equal(me.status, 403);
    assert.equal(me.body.error.code, "ACCOUNT_DEACTIVATED");
    assert.equal((await api("POST", "/api/v1/auth/refresh", { body: { refreshToken } })).status, 401);
    const login = await api("POST", "/api/v1/auth/login", { body: { email, password: PASSWORD }, ip: uniqueIp() });
    assert.equal(login.status, 403);
  });
});

describe("password reset", () => {
  test("reset code sets a new password and signs out other devices", async () => {
    const { email, refreshToken, ip } = await verifiedUser("reset");

    const forgot = await api("POST", "/api/v1/auth/forgot-password", { body: { email }, ip });
    assert.equal(forgot.status, 200);
    const code = await lastCode(email);

    const reset = await api("POST", "/api/v1/auth/reset-password", {
      body: { email, code, password: "a brand new password" },
      ip,
    });
    assert.equal(reset.status, 200);

    assert.equal((await api("POST", "/api/v1/auth/refresh", { body: { refreshToken } })).status, 401);
    const oldLogin = await api("POST", "/api/v1/auth/login", { body: { email, password: PASSWORD }, ip });
    assert.equal(oldLogin.status, 401);
    const newLogin = await api("POST", "/api/v1/auth/login", { body: { email, password: "a brand new password" }, ip });
    assert.equal(newLogin.status, 200);
  });

  test("forgot-password doesn't reveal whether an email exists", async () => {
    const res = await api("POST", "/api/v1/auth/forgot-password", { body: { email: uniqueEmail("nobody") }, ip: uniqueIp() });
    assert.equal(res.status, 200);
  });
});

describe("profile", () => {
  test("PATCH /me validates and only changes allowed fields", async () => {
    const { accessToken } = await verifiedUser("patch");
    const bad = await api("PATCH", "/api/v1/me", { token: accessToken, body: { timezone: "Mars/Olympus", weekStartDay: 9 } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.timezone);
    assert.ok(bad.body.error.fields.weekStartDay);

    const good = await api("PATCH", "/api/v1/me", {
      token: accessToken,
      body: { name: "Renamed", weekStartDay: 7, role: "admin", email: "hacker@test.local" },
    });
    assert.equal(good.status, 200);
    assert.equal(good.body.user.name, "Renamed");
    assert.equal(good.body.user.weekStartDay, 7);
    assert.equal(good.body.user.role, "user", "role can't be changed by the user");
    assert.notEqual(good.body.user.email, "hacker@test.local");
  });

  test("DELETE /me needs the password and removes the account", async () => {
    const { accessToken, email, ip } = await verifiedUser("delete");
    const wrong = await api("DELETE", "/api/v1/me", { token: accessToken, body: { password: "wrong" } });
    assert.equal(wrong.status, 401);

    assert.equal((await api("DELETE", "/api/v1/me", { token: accessToken, body: { password: PASSWORD } })).status, 204);
    assert.equal((await api("GET", "/api/v1/me", { token: accessToken })).status, 401);
    const rows = await sql("SELECT COUNT(*) AS n FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE u.email = ?", [email]);
    assert.equal(Number(rows[0].n), 0);
    assert.equal((await api("POST", "/api/v1/auth/login", { body: { email, password: PASSWORD }, ip })).status, 401);
  });
});
