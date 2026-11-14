import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { api, sql, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

// An admin and two users who receive what the admin sends (to them only).
async function people(label) {
  const admin = await verifiedUser(`${label}-admin`);
  await sql("UPDATE users SET role = 'admin' WHERE email = ?", [admin.email]);
  const ann = await verifiedUser(`${label}-ann`);
  const bob = await verifiedUser(`${label}-bob`);
  const userIds = (await sql("SELECT id FROM users WHERE email IN (?, ?)", [ann.email, bob.email])).map((row) => Number(row.id));
  const send = (fields) =>
    api("POST", "/api/v1/admin/announcements", { token: admin.accessToken, body: { title: "Hello", body: "Message", audience: "selected", userIds, ...fields } });
  const item = async (user, id) => (await api("GET", "/api/v1/inbox", { token: user.accessToken })).body.items.find((entry) => entry.id === String(id));
  return { admin, ann, bob, send, item };
}

const post = (user, path, body) => api("POST", path, { token: user.accessToken, body });

describe("answering announcements", () => {
  test("polls: options in the inbox, results once you vote, a vote can change, closed polls refuse votes", async () => {
    const { admin, ann, bob, send, item } = await people("poll");
    const sent = await send({ kind: "poll", body: "What next?", options: ["Themes", "Charts", " ", "Phone-only data"], closesInDays: 7 });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const id = sent.body.announcement.id;

    const before = await item(ann, id);
    assert.equal(before.kind, "poll");
    assert.deepEqual(before.options, ["Themes", "Charts", "Phone-only data"], "blank options are left out");
    assert.equal(before.votes, null, "no results before voting");
    assert.ok(before.closesAt);

    const voted = await post(ann, `/api/v1/inbox/${id}/vote`, { choice: 1 });
    assert.equal(voted.status, 200, JSON.stringify(voted.body));
    assert.deepEqual([voted.body.myChoice, voted.body.votes], [1, [0, 1, 0]]);
    assert.deepEqual((await post(bob, `/api/v1/inbox/${id}/vote`, { choice: 1 })).body.votes, [0, 2, 0]);
    assert.deepEqual((await post(ann, `/api/v1/inbox/${id}/vote`, { choice: 0 })).body.votes, [1, 1, 0], "changed vote");
    assert.equal((await post(ann, `/api/v1/inbox/${id}/vote`, { choice: 3 })).status, 400, "no such option");

    const history = await api("GET", "/api/v1/admin/announcements", { token: admin.accessToken });
    const listed = history.body.announcements.find((entry) => entry.id === String(id));
    assert.deepEqual([listed.kind, listed.votes], ["poll", [1, 1, 0]]);

    await sql("UPDATE announcements SET closes_at = CURRENT_TIMESTAMP - INTERVAL 1 HOUR WHERE id = ?", [id]);
    assert.equal((await post(bob, `/api/v1/inbox/${id}/vote`, { choice: 2 })).status, 409);
    const closed = await item(bob, id);
    assert.deepEqual([closed.closed, closed.votes], [true, [1, 1, 0]]);
  });

  test("a poll needs 2–5 different options", async () => {
    const { send } = await people("poll-invalid");
    assert.equal((await send({ kind: "poll", options: ["Only one"] })).status, 400);
    assert.equal((await send({ kind: "poll", options: ["Same", "same"] })).status, 400);
    assert.equal((await send({ kind: "poll", options: ["a", "b", "c", "d", "e", "f"] })).status, 400);
  });

  test("reactions: one per person, changeable and removable; only from people it was sent to", async () => {
    const { ann, bob, send } = await people("react");
    const { id } = (await send({})).body.announcement;
    assert.deepEqual((await post(ann, `/api/v1/inbox/${id}/react`, { reaction: "👍" })).body.reactions, { "👍": 1 });
    const both = await post(bob, `/api/v1/inbox/${id}/react`, { reaction: "👍" });
    assert.deepEqual([both.body.reactions, both.body.myReaction], [{ "👍": 2 }, "👍"]);
    assert.deepEqual((await post(ann, `/api/v1/inbox/${id}/react`, { reaction: "❤️" })).body.reactions, { "👍": 1, "❤️": 1 });
    assert.deepEqual((await post(ann, `/api/v1/inbox/${id}/react`, { reaction: null })).body.reactions, { "👍": 1 });
    assert.equal((await post(ann, `/api/v1/inbox/${id}/react`, { reaction: "💩" })).status, 400);

    const outsider = await verifiedUser("react-outsider");
    assert.equal((await post(outsider, `/api/v1/inbox/${id}/react`, { reaction: "👍" })).status, 404);
    assert.equal((await post(outsider, `/api/v1/inbox/${id}/vote`, { choice: 0 })).status, 404);
  });

  test("questions: private answers land on the admin Feedback page, linked to the question", async () => {
    const { admin, ann, bob, send, item } = await people("question");
    const { id } = (await send({ kind: "question", title: "What should we improve?" })).body.announcement;
    const answered = await post(ann, `/api/v1/inbox/${id}/reply`, { message: "  Dark mode for the widget  " });
    assert.equal(answered.status, 201, JSON.stringify(answered.body));
    assert.equal(answered.body.myReplies, 1);
    assert.equal((await item(bob, id)).myReplies, 0, "others don't see it");

    const feedback = await api("GET", "/api/v1/admin/feedback", { token: admin.accessToken });
    const entry = feedback.body.items.find((row) => row.announcementId === String(id));
    assert.deepEqual([entry.message, entry.questionTitle, entry.userEmail], ["Dark mode for the widget", "What should we improve?", ann.email]);

    // The admin answers it like any feedback.
    assert.equal((await api("POST", `/api/v1/admin/feedback/${entry.id}/reply`, { token: admin.accessToken, body: { message: "Coming soon!" } })).status, 201);

    assert.equal((await post(ann, `/api/v1/inbox/${id}/reply`, { message: " " })).status, 400);
    await sql("UPDATE announcements SET closes_at = CURRENT_TIMESTAMP - INTERVAL 1 MINUTE WHERE id = ?", [id]);
    assert.equal((await post(bob, `/api/v1/inbox/${id}/reply`, { message: "Too late?" })).status, 409);
  });

  test("a plain message takes reactions only", async () => {
    const { ann, send } = await people("plain");
    const { id } = (await send({})).body.announcement;
    assert.equal((await post(ann, `/api/v1/inbox/${id}/vote`, { choice: 0 })).status, 400);
    assert.equal((await post(ann, `/api/v1/inbox/${id}/reply`, { message: "Hi" })).status, 400);
  });
});

describe("feedback fixes", () => {
  test("changing the status of feedback that doesn't exist is a 404", async () => {
    const { admin } = await people("fb-missing");
    assert.equal((await api("PATCH", "/api/v1/admin/feedback/999999999", { token: admin.accessToken, body: { status: "done" } })).status, 404);
  });

  test("no reply to a deactivated account, and nothing is half-sent", async () => {
    const { admin, ann } = await people("fb-inactive");
    const { body: sent } = await post(ann, "/api/v1/feedback", { kind: "idea", message: "Please add themes" });
    await sql("UPDATE users SET status = 'deactivated' WHERE email = ?", [ann.email]);
    const reply = await api("POST", `/api/v1/admin/feedback/${sent.id}/reply`, { token: admin.accessToken, body: { message: "Thanks!" } });
    assert.equal(reply.status, 409);
    const [row] = await sql("SELECT status, reply FROM feedback WHERE id = ?", [sent.id]);
    assert.deepEqual([row.status, row.reply], ["new", null]);
  });

  test("a message with a mistake doesn't use up the day's 5", async () => {
    const user = await verifiedUser("fb-limit-invalid");
    for (let index = 0; index < 3; index += 1) {
      assert.equal((await post(user, "/api/v1/feedback", { kind: "idea", message: "" })).status, 400);
    }
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await post(user, "/api/v1/feedback", { kind: "idea", message: `Idea ${index}` })).status, 201);
    }
  });
});
