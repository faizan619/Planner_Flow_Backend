import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { api, sql, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const sync = (token, cursor, changes = {}) => api("POST", "/api/v1/sync", { token, body: { cursor, changes } });

const lesson = (overrides = {}) => ({
  id: randomUUID(),
  title: "Patience pays",
  body: "Waited a day before replying to that email. Glad I did.",
  lessonDate: "2026-10-20",
  tags: ["work", "patience"],
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const note = (overrides = {}) => ({
  id: randomUUID(),
  kind: "note",
  text: "Bring the charger",
  remindAt: null,
  done: false,
  person: null,
  amountMinor: null,
  currency: null,
  direction: null,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const money = (overrides = {}) =>
  note({ kind: "money", text: "Lunch", person: "Ali", amountMinor: 25_050, currency: "INR", direction: "i_owe", ...overrides });

describe("life lessons", () => {
  test("round-trips through sync with tags and date", async () => {
    const { accessToken } = await verifiedUser("lesson-roundtrip");
    const l = lesson();
    const res = await sync(accessToken, 0, { lessons: [l] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.rejected, []);
    const back = res.body.changes.lessons[0];
    assert.equal(back.title, l.title);
    assert.equal(back.body, l.body);
    assert.deepEqual(back.tags, ["work", "patience"]);
    assert.equal(back.lessonDate, "2026-10-20");
  });

  test("title and text are encrypted at rest", async () => {
    const { accessToken } = await verifiedUser("lesson-encrypted");
    const l = lesson({ title: "Secret title", body: "Very personal text" });
    await sync(accessToken, 0, { lessons: [l] });

    const [row] = await sql("SELECT title_enc, body_enc, tags FROM lessons WHERE id = ?", [l.id]);
    assert.match(row.title_enc, /^v1:/);
    assert.match(row.body_enc, /^v1:/);
    assert.ok(!row.title_enc.includes("Secret"), "title isn't stored readable");
    assert.ok(!row.body_enc.includes("personal"), "text isn't stored readable");
    const again = await sync(accessToken, 0, { lessons: [{ ...l, updatedAt: l.updatedAt + 1 }] });
    assert.notEqual(
      (await sql("SELECT title_enc FROM lessons WHERE id = ?", [l.id]))[0].title_enc,
      row.title_enc,
      "each save uses a fresh IV"
    );
    assert.equal(again.body.changes.lessons[0].title, "Secret title");
  });

  test("encrypted text moved to another row is never shown there", async () => {
    const { accessToken } = await verifiedUser("lesson-tamper");
    const a = lesson({ title: "A", body: "Lesson A" });
    const b = lesson({ title: "B", body: "Lesson B" });
    await sync(accessToken, 0, { lessons: [a, b] });

    // Someone with database access copies A's ciphertext onto B.
    await sql("UPDATE lessons l JOIN lessons src ON src.id = ? SET l.body_enc = src.body_enc WHERE l.id = ?", [a.id, b.id]);
    const res = await sync(accessToken, 0);
    const ids = res.body.changes.lessons.map((item) => item.id);
    assert.ok(ids.includes(a.id));
    assert.ok(!ids.includes(b.id), "the tampered row is withheld rather than showing A's text");
  });

  test("other users can't see or overwrite lessons (IDOR)", async () => {
    const alice = await verifiedUser("lesson-alice");
    const bob = await verifiedUser("lesson-bob");
    const l = lesson({ title: "Alice only", updatedAt: 1_000 });
    await sync(alice.accessToken, 0, { lessons: [l] });

    const bobView = await sync(bob.accessToken, 0, { lessons: [{ ...l, title: "Bob was here", updatedAt: 9_000 }] });
    assert.equal(bobView.body.changes.lessons.length, 1);
    assert.equal(bobView.body.changes.lessons[0].title, "Bob was here", "Bob only gets his own copy");

    const aliceView = await sync(alice.accessToken, 0);
    assert.equal(aliceView.body.changes.lessons[0].title, "Alice only");
  });

  test("validates title, length and tags", async () => {
    const { accessToken } = await verifiedUser("lesson-invalid");
    const res = await sync(accessToken, 0, {
      lessons: [
        lesson({ title: "" }),
        lesson({ body: "x".repeat(50001) }), // over the 50,000 limit (formatted notes are HTML)
        lesson({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }),
        lesson({ tags: ["x".repeat(31)] }),
        lesson({ lessonDate: "20-10-2026" }),
        lesson(),
      ],
    });
    assert.equal(res.body.rejected.length, 5);
    assert.equal(res.body.changes.lessons.length, 1);
  });
});

describe("reminders and money", () => {
  test("notes and money entries round-trip", async () => {
    const { accessToken } = await verifiedUser("reminders");
    const n = note({ remindAt: Date.UTC(2026, 9, 25, 15, 30) });
    const m = money();
    const res = await sync(accessToken, 0, { reminders: [n, m] });
    assert.deepEqual(res.body.rejected, []);
    const byId = Object.fromEntries(res.body.changes.reminders.map((item) => [item.id, item]));
    assert.equal(byId[n.id].remindAt, n.remindAt);
    assert.equal(byId[n.id].done, false);
    assert.equal(byId[m.id].amountMinor, 25_050, "amounts are exact paise, no float rounding");
    assert.equal(byId[m.id].direction, "i_owe");
  });

  test("a note needs text; money needs person, amount, currency and direction", async () => {
    const { accessToken } = await verifiedUser("reminders-invalid");
    const res = await sync(accessToken, 0, {
      reminders: [
        note({ text: "" }),
        money({ person: null }),
        money({ amountMinor: 0 }),
        money({ amountMinor: 12.5 }),
        money({ direction: "sideways" }),
        money({ currency: "rupees" }),
        note(),
      ],
    });
    assert.equal(res.body.rejected.length, 6);
    assert.equal(res.body.changes.reminders.length, 1);
  });

  test("a deleted reminder doesn't need its fields", async () => {
    const { accessToken } = await verifiedUser("reminders-delete");
    const m = money({ updatedAt: 1_000 });
    await sync(accessToken, 0, { reminders: [m] });
    const res = await sync(accessToken, 0, { reminders: [{ ...m, person: null, deletedAt: 2_000, updatedAt: 2_000 }] });
    assert.deepEqual(res.body.rejected, []);
  });
});

describe("sync paging", () => {
  test("large pulls arrive in pages with hasMore", async () => {
    const { accessToken } = await verifiedUser("paging");
    const habits = Array.from({ length: 320 }, (_, i) => ({
      id: randomUUID(),
      title: `Habit ${i}`,
      sortOrder: i,
      startedOn: "2026-10-12",
      archivedOn: null,
      updatedAt: 1_000 + i,
      deletedAt: null,
    }));
    const first = await sync(accessToken, 0, { habits });
    assert.equal(first.body.hasMore, true);
    assert.equal(first.body.changes.habits.length, 300);

    const second = await sync(accessToken, first.body.cursor);
    assert.equal(second.body.hasMore, false);
    assert.equal(second.body.changes.habits.length, 20);
    const all = new Set([...first.body.changes.habits, ...second.body.changes.habits].map((h) => h.id));
    assert.equal(all.size, 320, "every record arrives exactly once");
  });
});
