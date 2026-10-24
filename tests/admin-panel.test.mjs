import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { BASE_URL, PASSWORD, api, sql, startServer, stopServer, uniqueIp, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const decode = (value) => value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// Submits the admin sign-in form the way a browser would without JavaScript:
// the server-rendered form carries its Server Action in hidden fields.
async function submitLogin(email, password) {
  const page = await (await fetch(`${BASE_URL}/admin/login`)).text();
  const hidden = [...page.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/?>/g)];
  assert.ok(hidden.some(([, name]) => name.startsWith("$ACTION")), "login form carries its action");
  const form = new FormData();
  for (const [, name, value = ""] of hidden) form.append(decode(name), decode(value));
  form.append("email", email);
  form.append("password", password);
  const response = await fetch(`${BASE_URL}/admin/login`, {
    method: "POST",
    body: form,
    redirect: "manual",
    headers: { origin: BASE_URL, "x-forwarded-for": uniqueIp() },
  });
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("pf_admin="));
  return { response, cookie: cookie?.split(";")[0], html: await response.text() };
}

const getPanel = (path, cookie) => fetch(`${BASE_URL}${path}`, { headers: cookie ? { cookie } : {} }).then((r) => r.text());

describe("admin web panel", () => {
  test("signed out, panel pages redirect to sign-in before rendering", async () => {
    for (const path of ["/admin", "/admin/users", "/admin/announcements"]) {
      const response = await fetch(`${BASE_URL}${path}`, { redirect: "manual" });
      assert.equal(response.status, 307, path);
      assert.equal(new URL(response.headers.get("location"), BASE_URL).pathname, "/admin/login", path);
      assert.doesNotMatch(await response.text(), /@test\.local/, "no user emails leak");
    }
    const login = await fetch(`${BASE_URL}/admin/login`, { redirect: "manual" });
    assert.equal(login.status, 200, "the sign-in page itself isn't redirected");
  });

  test("a made-up session cookie gets past the proxy but not the server check", async () => {
    const html = await getPanel("/admin/users", "pf_admin=not-a-real-token");
    assert.match(html, /NEXT_REDIRECT;replace;\/admin\/login/);
    assert.doesNotMatch(html, /@test\.local/);
  });

  test("an admin signs in with an httpOnly cookie and sees the panel", async () => {
    const admin = await verifiedUser("panel-admin");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const { response, cookie } = await submitLogin(admin.email, PASSWORD);
    assert.equal(response.status, 303);
    assert.ok(cookie, "session cookie set");
    const raw = response.headers.getSetCookie().find((value) => value.startsWith("pf_admin="));
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=lax/i);
    assert.match(raw, /Path=\/admin/i);

    const users = await getPanel("/admin/users", cookie);
    assert.match(users, new RegExp(admin.email.replace(/[.]/g, "\\.")));
  });

  test("regular users and wrong passwords can't sign in", async () => {
    const user = await verifiedUser("panel-user");
    const asUser = await submitLogin(user.email, PASSWORD);
    assert.equal(asUser.cookie, undefined);
    assert.match(asUser.html, /can(’|&#x27;|')t use the admin panel/);

    const admin = await verifiedUser("panel-wrongpw");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const wrong = await submitLogin(admin.email, "not the password");
    assert.equal(wrong.cookie, undefined);
    assert.match(wrong.html, /Wrong email or password/);
  });

  test("the panel session ends when the admin is demoted or deactivated", async () => {
    const admin = await verifiedUser("panel-demote");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const { cookie } = await submitLogin(admin.email, PASSWORD);
    assert.doesNotMatch(await getPanel("/admin", cookie), /NEXT_REDIRECT/);

    await sql("UPDATE users SET role = 'user' WHERE email = ?", [admin.email]);
    assert.match(await getPanel("/admin", cookie), /NEXT_REDIRECT;replace;\/admin\/login/);
  });

  test("the Logs page shows entries to an admin", async () => {
    const admin = await verifiedUser("panel-logs");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const { cookie } = await submitLogin(admin.email, PASSWORD);
    // The sign-in itself is logged; give it a moment to be written.
    let html = "";
    for (let i = 0; i < 20 && !html.includes(admin.email); i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      html = await getPanel("/admin/logs?category=security", cookie);
    }
    assert.match(html, /Signed in/);
    assert.ok(html.includes(admin.email));
  });

  test("the Settings form saves the log switches and retention", async () => {
    const admin = await verifiedUser("panel-settings");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const { cookie } = await submitLogin(admin.email, PASSWORD);

    const page = await getPanel("/admin/settings", cookie);
    const hidden = [...page.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/?>/g)];
    assert.ok(hidden.some(([, name]) => name.startsWith("$ACTION")), "settings form carries its action");
    const form = new FormData();
    for (const [, name, value = ""] of hidden) form.append(decode(name), decode(value));
    form.append("security", "on");
    form.append("admin", "on"); // usage left unticked
    form.append("retentionDays", "60");
    const saved = await fetch(`${BASE_URL}/admin/settings`, { method: "POST", body: form, headers: { origin: BASE_URL, cookie } });
    assert.equal(saved.status, 200);

    const current = await api("GET", "/api/v1/admin/log-settings", { token: admin.accessToken });
    assert.deepEqual(current.body.settings, { security: true, admin: true, usage: false, retentionDays: 60 });
    await api("PATCH", "/api/v1/admin/log-settings", {
      token: admin.accessToken,
      body: { security: true, admin: true, usage: true, retentionDays: 45 },
    });
  });
});
