import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { api, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const sync = (token, cursor, changes = {}) => api("POST", "/api/v1/sync", { token, body: { cursor, changes } });

const habit = (overrides = {}) => ({
  id: randomUUID(),
  title: "Read 5 pages",
  sortOrder: 0,
  startedOn: "2026-10-12",
  archivedOn: null,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const mark = (habitId, date, status = "done", overrides = {}) => ({
  id: `${habitId}_${date}`,
  habitId,
  date,
  status,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

describe("sync", () => {
  test("needs a signed-in user", async () => {
    assert.equal((await api("POST", "/api/v1/sync", { body: { cursor: 0, changes: {} } })).status, 401);
  });

  test("pushes records and pulls them back with a cursor", async () => {
    const { accessToken } = await verifiedUser("sync-basic");
    const h = habit();
    const week = { id: "2026-10-12", motivation: "Small steps every day", updatedAt: Date.now(), deletedAt: null };
    const task = {
      id: randomUUID(),
      weekStart: "2026-10-12",
      title: "Finish the portfolio hosting",
      done: false,
      carriedFromId: null,
      carriedToId: null,
      sortOrder: 0,
      updatedAt: Date.now(),
      deletedAt: null,
    };

    const first = await sync(accessToken, 0, {
      habits: [h],
      weeks: [week],
      weeklyTasks: [task],
      habitMarks: [mark(h.id, "2026-10-12"), mark(h.id, "2026-10-13", "missed")],
    });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.rejected, []);
    assert.equal(first.body.cursor, 5);
    assert.equal(first.body.changes.habits[0].title, "Read 5 pages");
    assert.equal(first.body.changes.weeks[0].motivation, "Small steps every day");
    assert.equal(first.body.changes.weeklyTasks[0].done, false);
    assert.equal(first.body.changes.habitMarks.length, 2);
    assert.equal(first.body.changes.habitMarks[0].date, "2026-10-12", "dates stay calendar days");

    const nothingNew = await sync(accessToken, first.body.cursor);
    assert.equal(nothingNew.body.cursor, 5);
    assert.equal(nothingNew.body.changes.habits.length, 0);

    const done = await sync(accessToken, 5, { weeklyTasks: [{ ...task, done: true, updatedAt: task.updatedAt + 1 }] });
    assert.equal(done.body.cursor, 6);
    assert.equal(done.body.changes.weeklyTasks.length, 1, "only the changed record comes back");
    assert.equal(done.body.changes.weeklyTasks[0].done, true);
  });

  test("last write wins: an older edit doesn't overwrite a newer one", async () => {
    const { accessToken } = await verifiedUser("sync-lww");
    const h = habit({ title: "Workout", updatedAt: 2_000 });
    await sync(accessToken, 0, { habits: [h] });

    const stale = await sync(accessToken, 0, { habits: [{ ...h, title: "Old title", updatedAt: 1_000 }] });
    assert.equal(stale.body.changes.habits[0].title, "Workout");

    const newer = await sync(accessToken, 0, { habits: [{ ...h, title: "Gym", updatedAt: 3_000 }] });
    assert.equal(newer.body.changes.habits[0].title, "Gym");
  });

  test("a clock far in the future can't make an edit unbeatable", async () => {
    const { accessToken } = await verifiedUser("sync-clock");
    const h = habit({ title: "Future", updatedAt: Date.now() + 365 * 86_400_000 });
    const res = await sync(accessToken, 0, { habits: [h] });
    assert.ok(res.body.changes.habits[0].updatedAt <= Date.now() + 61_000);
  });

  test("deletions sync as tombstones", async () => {
    const { accessToken } = await verifiedUser("sync-delete");
    const h = habit({ updatedAt: 1_000 });
    const created = await sync(accessToken, 0, { habits: [h] });
    const deleted = await sync(accessToken, created.body.cursor, {
      habits: [{ ...h, deletedAt: 2_000, updatedAt: 2_000 }],
    });
    assert.equal(deleted.body.changes.habits[0].deletedAt, 2_000);
  });

  test("users never see or change each other's records (IDOR)", async () => {
    const alice = await verifiedUser("sync-alice");
    const bob = await verifiedUser("sync-bob");
    const h = habit({ title: "Alice's habit", updatedAt: 1_000 });
    await sync(alice.accessToken, 0, { habits: [h], habitMarks: [mark(h.id, "2026-10-12")] });

    // Bob reuses Alice's habit id with a newer timestamp and marks her habit.
    const attack = await sync(bob.accessToken, 0, {
      habits: [{ ...h, title: "Hacked", updatedAt: 9_000 }],
      habitMarks: [mark(h.id, "2026-10-13", "missed", { updatedAt: 9_000 })],
    });
    assert.equal(attack.status, 200);
    assert.equal(attack.body.changes.habits.length, 1, "Bob only sees his own copy");
    assert.equal(attack.body.changes.habits[0].title, "Hacked");

    const aliceView = await sync(alice.accessToken, 0);
    assert.equal(aliceView.body.changes.habits[0].title, "Alice's habit", "Alice's row is untouched");
    assert.equal(aliceView.body.changes.habitMarks.length, 1, "Bob's mark didn't land on Alice's habit");
  });

  test("marks for a habit the user doesn't own are rejected", async () => {
    const { accessToken } = await verifiedUser("sync-orphan");
    const res = await sync(accessToken, 0, { habitMarks: [mark(randomUUID(), "2026-10-12")] });
    assert.equal(res.status, 200);
    assert.equal(res.body.rejected[0].reason, "Unknown habit");
    assert.equal(res.body.changes.habitMarks.length, 0);
  });

  test("future days can't be marked", async () => {
    const { accessToken } = await verifiedUser("sync-future");
    const h = habit();
    const res = await sync(accessToken, 0, { habits: [h], habitMarks: [mark(h.id, "2099-01-01")] });
    assert.equal(res.body.rejected[0].reason, "Can't mark a future day");
  });

  test("invalid records are rejected one by one, valid ones still apply", async () => {
    const { accessToken } = await verifiedUser("sync-invalid");
    const res = await sync(accessToken, 0, {
      habits: [habit({ title: "" }), habit({ startedOn: "2026-02-30" }), habit({ id: "not-a-uuid" }), habit()],
      habitMarks: [{ ...mark(randomUUID(), "2026-10-12"), id: "wrong-id" }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.rejected.length, 4);
    assert.equal(res.body.changes.habits.length, 1);
  });

  test("rejects a malformed request body", async () => {
    const { accessToken } = await verifiedUser("sync-bad");
    const res = await api("POST", "/api/v1/sync", { token: accessToken, body: { cursor: -1 } });
    assert.equal(res.status, 400);
    const tooMany = await sync(accessToken, 0, { habits: Array.from({ length: 501 }, () => habit()) });
    assert.equal(tooMany.status, 400);
  });

  test("week rollover data: carrying an unfinished task links both weeks", async () => {
    const { accessToken } = await verifiedUser("sync-carry");
    const original = {
      id: randomUUID(),
      weekStart: "2026-10-12",
      title: "Complete the resume",
      done: false,
      carriedFromId: null,
      carriedToId: null,
      sortOrder: 0,
      updatedAt: 1_000,
      deletedAt: null,
    };
    await sync(accessToken, 0, { weeklyTasks: [original] });

    const copy = { ...original, id: randomUUID(), weekStart: "2026-10-19", carriedFromId: original.id, updatedAt: 2_000 };
    const res = await sync(accessToken, 0, {
      weeklyTasks: [{ ...original, carriedToId: copy.id, updatedAt: 2_000 }, copy],
    });
    const byId = Object.fromEntries(res.body.changes.weeklyTasks.map((task) => [task.id, task]));
    assert.equal(byId[original.id].carriedToId, copy.id);
    assert.equal(byId[original.id].done, false, "the original stays not-done (✗)");
    assert.equal(byId[copy.id].carriedFromId, original.id);
    assert.equal(byId[copy.id].weekStart, "2026-10-19");
  });

  test("a cursor from the future triggers a full resync", async () => {
    const { accessToken } = await verifiedUser("sync-reset");
    await sync(accessToken, 0, { habits: [habit()] });
    const res = await sync(accessToken, 999);
    assert.equal(res.body.fullResync, true);
    assert.equal(res.body.changes.habits.length, 1);
  });
});
