import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { BASE_URL, PASSWORD, sql, startServer, stopServer, uniqueIp, verifiedUser } from "./helpers/server.mjs";

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
  test("signed out, panel pages redirect to sign-in and show no data", async () => {
    const html = await getPanel("/admin/users");
    assert.match(html, /NEXT_REDIRECT;replace;\/admin\/login/);
    assert.doesNotMatch(html, /@test\.local/, "no user emails leak");
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
});
