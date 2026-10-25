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

async function announce(admin, title, userIds) {
  const res = await api("POST", "/api/v1/admin/announcements", {
    token: admin.accessToken,
    body: { title, body: "Message", audience: "selected", userIds },
  });
  assert.equal(res.status, 201);
  return res.body.announcement.id;
}

const inboxTitles = async (user) => (await api("GET", "/api/v1/inbox", { token: user.accessToken })).body.items.map((item) => item.title);

describe("deleting announcements", () => {
  test("an admin deletes an announcement for everyone, and it's logged", async () => {
    const admin = await adminUser("del-admin");
    const alice = await verifiedUser("del-alice");
    const bob = await verifiedUser("del-bob");
    const id = await announce(admin, "Delete me", [alice.user.id, bob.user.id]);
    assert.ok((await inboxTitles(alice)).includes("Delete me"));

    assert.equal((await api("DELETE", `/api/v1/admin/announcements/${id}`, { token: admin.accessToken })).status, 204);
    assert.ok(!(await inboxTitles(alice)).includes("Delete me"));
    assert.ok(!(await inboxTitles(bob)).includes("Delete me"));
    assert.equal((await api("GET", "/api/v1/inbox", { token: bob.accessToken })).body.unreadCount, 0, "unread badge updates");
    const history = await api("GET", "/api/v1/admin/announcements", { token: admin.accessToken });
    assert.ok(!history.body.announcements.some((item) => item.id === String(id)));
    assert.equal((await sql("SELECT COUNT(*) AS n FROM announcement_recipients WHERE announcement_id = ?", [id]))[0].n, 0);

    let logged = [];
    for (let i = 0; i < 30 && !logged.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      logged = await sql("SELECT * FROM activity_logs WHERE event = 'announcement_deleted' AND actor_id = ?", [admin.user.id]);
    }
    assert.equal(logged.length, 1);

    assert.equal((await api("DELETE", `/api/v1/admin/announcements/${id}`, { token: admin.accessToken })).status, 404, "already gone");
  });

  test("only admins can delete for everyone", async () => {
    const admin = await adminUser("del-only-admin");
    const user = await verifiedUser("del-only-user");
    const id = await announce(admin, "Stays", [user.user.id]);
    assert.equal((await api("DELETE", `/api/v1/admin/announcements/${id}`, { token: user.accessToken })).status, 403);
    assert.equal((await api("DELETE", `/api/v1/admin/announcements/${id}`)).status, 401);
    assert.ok((await inboxTitles(user)).includes("Stays"));
  });

  test("a user removes an announcement from their own inbox only", async () => {
    const admin = await adminUser("dismiss-admin");
    const alice = await verifiedUser("dismiss-alice");
    const bob = await verifiedUser("dismiss-bob");
    const id = await announce(admin, "Hide for Alice", [alice.user.id, bob.user.id]);
    assert.equal((await api("GET", "/api/v1/inbox", { token: alice.accessToken })).body.unreadCount, 1);

    assert.equal((await api("DELETE", `/api/v1/inbox/${id}`, { token: alice.accessToken })).status, 204);
    const aliceBox = await api("GET", "/api/v1/inbox", { token: alice.accessToken });
    assert.ok(!aliceBox.body.items.some((item) => item.id === String(id)));
    assert.equal(aliceBox.body.unreadCount, 0, "a removed unread announcement no longer counts");
    assert.ok((await inboxTitles(bob)).includes("Hide for Alice"), "Bob still has it");

    const listed = (await api("GET", "/api/v1/admin/announcements", { token: admin.accessToken })).body.announcements.find(
      (item) => item.id === String(id)
    );
    assert.equal(listed.recipients, 2, "the admin's numbers are unchanged");
    assert.equal(listed.readCount, 1, "removing counts as read");

    assert.equal((await api("DELETE", `/api/v1/inbox/${id}`, { token: alice.accessToken })).status, 404, "already removed");
  });

  test("users can't remove an announcement they never received", async () => {
    const admin = await adminUser("dismiss-idor-admin");
    const chosen = await verifiedUser("dismiss-chosen");
    const outsider = await verifiedUser("dismiss-outsider");
    const id = await announce(admin, "Private", [chosen.user.id]);
    assert.equal((await api("DELETE", `/api/v1/inbox/${id}`, { token: outsider.accessToken })).status, 404);
    assert.equal((await api("DELETE", `/api/v1/inbox/${id}`)).status, 401);
    assert.ok((await inboxTitles(chosen)).includes("Private"));
  });
});
