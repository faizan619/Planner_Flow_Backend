import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { api, sql, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const send = (token, body) => api("POST", "/api/v1/feedback", { token, body });

describe("feedback", () => {
  test("a signed-in user can send an idea, a bug or anything else", async () => {
    const user = await verifiedUser("feedback-basic");
    const res = await send(user.accessToken, {
      kind: "bug",
      message: "  The alarm didn't ring on Sunday  ",
      appVersion: "1.1.0",
      versionCode: 14,
      androidVersion: "15",
      device: "samsung SM-A546E",
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [row] = await sql("SELECT kind, message, status, app_version, version_code, device FROM feedback WHERE id = ?", [res.body.id]);
    assert.equal(row.kind, "bug");
    assert.equal(row.message, "The alarm didn't ring on Sunday");
    assert.equal(row.status, "new");
    assert.equal(row.app_version, "1.1.0");
    assert.equal(row.version_code, 14);
    assert.equal(row.device, "samsung SM-A546E");

    // Without the phone details (the switch turned off).
    const plain = await send(user.accessToken, { kind: "idea", message: "Dark mode for the widget please" });
    assert.equal(plain.status, 201);
    const [bare] = await sql("SELECT app_version, device FROM feedback WHERE id = ?", [plain.body.id]);
    assert.deepEqual([bare.app_version, bare.device], [null, null]);
  });

  test("needs a sign-in and a real message", async () => {
    assert.equal((await send(null, { kind: "idea", message: "Hello there" })).status, 401);
    const user = await verifiedUser("feedback-invalid");
    for (const body of [
      { kind: "idea", message: "  " },
      { kind: "praise", message: "Great app" },
      { kind: "other", message: "x".repeat(2001) },
      { kind: "other" },
    ]) {
      assert.equal((await send(user.accessToken, body)).status, 400, JSON.stringify(body));
    }
  });

  test("at most 5 a day per user", async () => {
    const user = await verifiedUser("feedback-limit");
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await send(user.accessToken, { kind: "other", message: `Message ${index}` })).status, 201);
    }
    assert.equal((await send(user.accessToken, { kind: "other", message: "One more" })).status, 429);
  });

  test("goes when the account is deleted", async () => {
    const user = await verifiedUser("feedback-delete");
    const { body } = await send(user.accessToken, { kind: "idea", message: "Please add themes" });
    await sql("DELETE FROM users WHERE email = ?", [user.email]);
    assert.equal((await sql("SELECT id FROM feedback WHERE id = ?", [body.id])).length, 0);
  });

  test("an admin lists feedback, marks it, and replies to the sender's inbox", async () => {
    const sender = await verifiedUser("feedback-reply-user");
    const { body: sent } = await send(sender.accessToken, { kind: "bug", message: "Widget shows yesterday" });
    const admin = await verifiedUser("feedback-reply-admin");
    await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
    const asAdmin = (method, path, body) => api(method, path, { token: admin.accessToken, body });

    const open = await asAdmin("GET", "/api/v1/admin/feedback");
    assert.equal(open.status, 200);
    const item = open.body.items.find((entry) => entry.id === sent.id);
    assert.equal(item.message, "Widget shows yesterday");
    assert.equal(item.userEmail, sender.email);
    assert.equal(item.status, "new");
    assert.ok(open.body.counts.new >= 1);

    assert.equal((await asAdmin("PATCH", `/api/v1/admin/feedback/${sent.id}`, { status: "read" })).status, 204);
    assert.equal((await asAdmin("PATCH", `/api/v1/admin/feedback/${sent.id}`, { status: "maybe" })).status, 400);

    const reply = await asAdmin("POST", `/api/v1/admin/feedback/${sent.id}/reply`, { message: "Thanks! Fixed in 1.1.0." });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    assert.equal(reply.body.announcement.recipients, 1);

    const inbox = await api("GET", "/api/v1/inbox", { token: sender.accessToken });
    const message = inbox.body.items.find((entry) => entry.title === "Reply to your feedback");
    assert.ok(message, "the reply is in the sender's inbox");
    assert.equal(message.body, "Thanks! Fixed in 1.1.0.\n\nYou wrote: “Widget shows yesterday”");

    const done = await asAdmin("GET", "/api/v1/admin/feedback?view=done");
    const answered = done.body.items.find((entry) => entry.id === sent.id);
    assert.equal(answered.status, "done");
    assert.equal(answered.reply, "Thanks! Fixed in 1.1.0.");
    assert.ok(answered.repliedAt);
  });

  test("only admins can read or answer feedback", async () => {
    const user = await verifiedUser("feedback-not-admin");
    const { body: sent } = await send(user.accessToken, { kind: "idea", message: "Let me peek" });
    assert.equal((await api("GET", "/api/v1/admin/feedback", { token: user.accessToken })).status, 403);
    assert.equal((await api("PATCH", `/api/v1/admin/feedback/${sent.id}`, { token: user.accessToken, body: { status: "done" } })).status, 403);
    assert.equal(
      (await api("POST", `/api/v1/admin/feedback/${sent.id}/reply`, { token: user.accessToken, body: { message: "hi" } })).status,
      403
    );
  });
});
