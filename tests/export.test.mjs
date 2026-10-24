import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import ExcelJS from "exceljs";
import { BASE_URL, api, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const sync = (token, changes) => api("POST", "/api/v1/sync", { token, body: { cursor: 0, changes } });
const now = () => Date.now();

// Gives a user one of everything.
async function seed(token, label) {
  const habitId = randomUUID();
  const bookId = randomUUID();
  const lessonId = randomUUID();
  const res = await sync(token, {
    habits: [{ id: habitId, title: `${label} workout`, sortOrder: 0, startedOn: "2026-10-12", archivedOn: null, updatedAt: now(), deletedAt: null }],
    habitMarks: [{ id: `${habitId}_2026-10-12`, habitId, date: "2026-10-12", status: "done", updatedAt: now(), deletedAt: null }],
    weeks: [{ id: "2026-10-12", motivation: `${label} keeps going`, updatedAt: now(), deletedAt: null }],
    weeklyTasks: [
      { id: randomUUID(), weekStart: "2026-10-12", title: `${label} resume`, done: true, carriedFromId: null, carriedToId: null, sortOrder: 0, updatedAt: now(), deletedAt: null },
    ],
    reminders: [
      { id: randomUUID(), kind: "money", text: "Lunch", remindAt: null, done: false, person: "Ali", amountMinor: 25_050, currency: "INR", direction: "i_owe", updatedAt: now(), deletedAt: null },
      { id: randomUUID(), kind: "note", text: `${label} charger`, remindAt: Date.UTC(2026, 9, 25, 9), done: false, person: null, amountMinor: null, currency: null, direction: null, updatedAt: now(), deletedAt: null },
    ],
    lessons: [{ id: lessonId, title: `${label} secret lesson`, body: "Encrypted at rest, readable in my export", lessonDate: "2026-10-20", tags: ["work"], updatedAt: now(), deletedAt: null }],
    books: [{ id: bookId, title: `${label} Atomic Habits`, author: "James Clear", genre: "Self-help", updatedAt: now(), deletedAt: null }],
    bookReadings: [
      { id: randomUUID(), bookId, readNumber: 1, type: "hardcopy", status: "completed", startDate: "2026-01-05", endDate: "2026-01-20", rating: 5, updatedAt: now(), deletedAt: null },
    ],
    readingGoals: [{ id: "2026", target: 24, updatedAt: now(), deletedAt: null }],
  });
  assert.deepEqual(res.body.rejected, []);
}

async function download(user, format) {
  const link = await api("POST", "/api/v1/export/link", { token: user.accessToken, body: { format } });
  assert.equal(link.status, 201);
  const response = await fetch(link.body.url);
  return { link: link.body, response };
}

describe("export", () => {
  test("needs a signed-in user and a valid format", async () => {
    assert.equal((await api("POST", "/api/v1/export/link", { body: { format: "json" } })).status, 401);
    const user = await verifiedUser("export-format");
    assert.equal((await api("POST", "/api/v1/export/link", { token: user.accessToken, body: { format: "pdf" } })).status, 400);
  });

  test("JSON contains all of the user's data, lessons decrypted, and nobody else's", async () => {
    const me = await verifiedUser("export-json");
    const other = await verifiedUser("export-other");
    await seed(me.accessToken, "Mine");
    await seed(other.accessToken, "Theirs");

    const { link, response } = await download(me, "json");
    assert.match(link.url, /\/api\/v1\/export\/download\?token=/);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /attachment; filename="planner-flow-\d{4}-\d{2}-\d{2}\.json"/);
    const data = await response.json();

    assert.equal(data.user.email, me.email);
    assert.equal(data.user.passwordHash, undefined);
    assert.equal(data.lessons[0].title, "Mine secret lesson", "lessons are decrypted for their owner");
    assert.equal(data.habits.length, 1);
    assert.equal(data.habitMarks[0].date, "2026-10-12");
    assert.equal(data.weeks[0].motivation, "Mine keeps going");
    assert.equal(data.reminders.find((r) => r.kind === "money").amountMinor, 25_050);
    assert.equal(data.bookReadings[0].rating, 5);
    assert.ok(!JSON.stringify(data).includes("Theirs"), "no other user's data");
  });

  test("Excel has a sheet per kind of data, and the Books sheet imports back", async () => {
    const me = await verifiedUser("export-xlsx");
    await seed(me.accessToken, "Mine");
    const { response } = await download(me, "xlsx");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /spreadsheetml/);
    const file = Buffer.from(await response.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
      "Books",
      "Reading goals",
      "Habits",
      "Habit marks",
      "Weekly tasks",
      "Motivation",
      "Notes",
      "Money",
      "Life lessons",
      "Inbox",
    ]);
    const books = workbook.getWorksheet("Books");
    assert.deepEqual(books.getRow(1).values.slice(1), ["Sr No", "Book Title", "Author", "Genre", "Type", "Start Date", "End Date", "Status", "Rating"]);
    assert.equal(books.getRow(2).getCell(2).value, "Mine Atomic Habits");
    assert.equal(workbook.getWorksheet("Money").getRow(2).getCell(3).value, 250.5);
    assert.equal(workbook.getWorksheet("Life lessons").getRow(2).getCell(2).value, "Mine secret lesson");

    // Round trip: the exported file goes straight back into the importer.
    const form = new FormData();
    form.append("file", new Blob([file]), "export.xlsx");
    const preview = await fetch(`${BASE_URL}/api/v1/books/import/preview`, {
      method: "POST",
      headers: { authorization: `Bearer ${me.accessToken}` },
      body: form,
    }).then((r) => r.json());
    assert.deepEqual(preview.summary, { total: 1, valid: 1, invalid: 0 });
    assert.deepEqual(preview.rows[0].data, {
      readNumber: 1,
      title: "Mine Atomic Habits",
      author: "James Clear",
      genre: "Self-help",
      type: "hardcopy",
      status: "completed",
      startDate: "2026-01-05",
      endDate: "2026-01-20",
      rating: 5,
    });
  });

  test("a link works once, and made-up links don't work", async () => {
    const me = await verifiedUser("export-once");
    const { link, response } = await download(me, "json");
    assert.equal(response.status, 200);
    assert.equal((await fetch(link.url)).status, 410, "second use is refused");
    assert.equal((await fetch(`${BASE_URL}/api/v1/export/download?token=${"x".repeat(43)}`)).status, 410);
    assert.equal((await fetch(`${BASE_URL}/api/v1/export/download`)).status, 410);
  });

  test("links point at the address the app used", async () => {
    const me = await verifiedUser("export-origin");
    const res = await api("POST", "/api/v1/export/link", { token: me.accessToken, body: { format: "json" } });
    assert.ok(res.body.url.startsWith(BASE_URL), res.body.url);
  });
});
