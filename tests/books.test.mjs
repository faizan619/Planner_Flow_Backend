import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import ExcelJS from "exceljs";
import { BASE_URL, api, startServer, stopServer, verifiedUser } from "./helpers/server.mjs";

before(startServer, { timeout: 240_000 });
after(stopServer);

const sync = (token, cursor, changes = {}) => api("POST", "/api/v1/sync", { token, body: { cursor, changes } });

const book = (overrides = {}) => ({
  id: randomUUID(),
  title: "Atomic Habits",
  author: "James Clear",
  genre: "Self-help",
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

const reading = (bookId, overrides = {}) => ({
  id: randomUUID(),
  bookId,
  readNumber: 1,
  type: "hardcopy",
  status: "completed",
  startDate: "2026-01-05",
  endDate: "2026-01-20",
  rating: 5,
  updatedAt: Date.now(),
  deletedAt: null,
  ...overrides,
});

async function upload(token, fileName, content, type = "application/octet-stream") {
  const form = new FormData();
  if (content !== null) form.append("file", new Blob([content], { type }), fileName);
  const response = await fetch(`${BASE_URL}/api/v1/books/import/preview`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return { status: response.status, body: await response.json() };
}

describe("books sync", () => {
  test("books, readings (with a re-read) and a yearly goal round-trip", async () => {
    const { accessToken } = await verifiedUser("books-roundtrip");
    const b = book();
    const first = reading(b.id);
    const reread = reading(b.id, { readNumber: 2, status: "reading", startDate: "2026-09-01", endDate: null, rating: null, type: "audiobook" });
    const res = await sync(accessToken, 0, {
      books: [b],
      bookReadings: [first, reread],
      readingGoals: [{ id: "2026", target: 24, updatedAt: Date.now(), deletedAt: null }],
    });
    assert.deepEqual(res.body.rejected, []);
    assert.equal(res.body.changes.books[0].title, "Atomic Habits");
    const readings = Object.fromEntries(res.body.changes.bookReadings.map((r) => [r.readNumber, r]));
    assert.equal(readings[1].rating, 5);
    assert.equal(readings[1].endDate, "2026-01-20");
    assert.equal(readings[2].type, "audiobook");
    assert.equal(readings[2].rating, null);
    assert.equal(res.body.changes.readingGoals[0].id, "2026");
    assert.equal(res.body.changes.readingGoals[0].target, 24);
  });

  test("end date before start date is rejected", async () => {
    const { accessToken } = await verifiedUser("books-dates");
    const b = book();
    const res = await sync(accessToken, 0, {
      books: [b],
      bookReadings: [reading(b.id, { startDate: "2026-02-10", endDate: "2026-02-01" })],
    });
    assert.equal(res.body.rejected[0].reason, "End date can't be before the start date");
  });

  test("a rating is only allowed when the status is Completed", async () => {
    const { accessToken } = await verifiedUser("books-rating");
    const b = book();
    const res = await sync(accessToken, 0, {
      books: [b],
      bookReadings: [
        reading(b.id, { status: "reading", endDate: null, rating: 4 }),
        reading(b.id, { status: "planned", startDate: null, endDate: null, rating: 3 }),
        reading(b.id, { rating: 6 }),
        reading(b.id, { rating: 4.5 }),
        reading(b.id, { status: "reading", endDate: null, rating: null }),
      ],
    });
    assert.equal(res.body.rejected.length, 4);
    assert.match(res.body.rejected[0].reason, /only allowed when the status is Completed/);
    assert.equal(res.body.changes.bookReadings.length, 1);
  });

  test("readings must belong to the user's own book (IDOR)", async () => {
    const alice = await verifiedUser("books-alice");
    const bob = await verifiedUser("books-bob");
    const aliceBook = book({ title: "Alice's book" });
    await sync(alice.accessToken, 0, { books: [aliceBook] });

    const attack = await sync(bob.accessToken, 0, { bookReadings: [reading(aliceBook.id)] });
    assert.equal(attack.body.rejected[0].reason, "Unknown book");

    const aliceView = await sync(alice.accessToken, 0);
    assert.equal(aliceView.body.changes.bookReadings.length, 0, "nothing landed on Alice's book");
    const bobView = await sync(bob.accessToken, 0);
    assert.equal(bobView.body.changes.books.length, 0, "Bob can't see Alice's books");
  });

  test("validates goals", async () => {
    const { accessToken } = await verifiedUser("books-goal");
    const res = await sync(accessToken, 0, {
      readingGoals: [
        { id: "26", target: 10, updatedAt: 1, deletedAt: null },
        { id: "2026", target: 0, updatedAt: 1, deletedAt: null },
      ],
    });
    assert.equal(res.body.rejected.length, 2);
  });
});

describe("import preview", () => {
  async function trackerWorkbook(rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Books");
    sheet.addRow(["Sr No", "Book Title", "Author", "Genre", "Type", "Start Date", "End Date", "Status", "Rating"]);
    for (const row of rows) sheet.addRow(row);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  test("reads an Excel tracker with real date cells and flags bad rows", async () => {
    const { accessToken } = await verifiedUser("import-xlsx");
    const file = await trackerWorkbook([
      [1, "Atomic Habits", "James Clear", "Self-help", "Hardcopy", new Date(Date.UTC(2026, 0, 5)), new Date(Date.UTC(2026, 0, 20)), "Completed", 5],
      [2, "Atomic Habits", "James Clear", "Self-help", "Audiobook", "01/09/2026", "", "Reading", ""],
      [1, "Deep Work", "Cal Newport", "Productivity", "Kindle", "10/02/2026", "01/02/2026", "Completed", 4],
      [1, "Ikigai", "", "", "", "", "", "", 3],
      [1, "", "Nobody", "", "Hardcopy", "", "", "Planned", ""],
      [1, "Sapiens", "Harari", "History", "Scroll", "31/02/2026", "", "Maybe", "9"],
    ]);
    const res = await upload(accessToken, "My books.xlsx", file);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.summary, { total: 6, valid: 2, invalid: 4 });
    const [habits, reread, deep, ikigai, untitled, sapiens] = res.body.rows;

    assert.equal(habits.row, 2, "row numbers match the spreadsheet");
    assert.deepEqual(habits.data, {
      readNumber: 1,
      title: "Atomic Habits",
      author: "James Clear",
      genre: "Self-help",
      type: "hardcopy",
      status: "completed",
      startDate: "2026-01-05",
      endDate: "2026-01-20",
      rating: 5,
    });
    assert.equal(reread.ok, true);
    assert.equal(reread.data.startDate, "2026-09-01", "DD/MM/YYYY text is read day-first");
    assert.equal(reread.data.readNumber, 2);

    assert.equal(deep.ok, false);
    assert.equal(deep.data.type, "softcopy", "Kindle counts as Softcopy");
    assert.ok(deep.errors.includes("End date can't be before the start date"));

    assert.equal(ikigai.ok, false, "rating on a book with no status → inferred Planned → not allowed");
    assert.ok(ikigai.errors.some((e) => /rating is only allowed/i.test(e)));
    assert.ok(ikigai.warnings.some((w) => /saved as Hardcopy/.test(w)));

    assert.ok(untitled.errors.includes("Book Title is empty"));
    assert.equal(sapiens.errors.length, 4, "bad type, bad date, bad status and bad rating are all reported");
  });

  test("reads CSV with quotes, a BOM, semicolons and other column names", async () => {
    const { accessToken } = await verifiedUser("import-csv");
    const csv =
      "﻿sr. no.;Title;Author;Format;Started;Finished;Status;Stars\r\n" +
      '1;"The Alchemist; illustrated";"Coelho, Paulo";paperback;12 Oct 2026;Oct 20, 2026;done;★★★★\r\n' +
      ';"He said ""hi""";;audio;;;tbr;\r\n' +
      ";;;;;;;\r\n";
    const res = await upload(accessToken, "books.csv", csv, "text/csv");
    assert.equal(res.status, 200);
    assert.equal(res.body.summary.total, 2, "blank lines are skipped");
    const [alchemist, quoted] = res.body.rows;
    assert.equal(alchemist.ok, true, JSON.stringify(alchemist.errors));
    assert.equal(alchemist.data.title, "The Alchemist; illustrated");
    assert.equal(alchemist.data.author, "Coelho, Paulo");
    assert.equal(alchemist.data.startDate, "2026-10-12");
    assert.equal(alchemist.data.endDate, "2026-10-20");
    assert.equal(alchemist.data.rating, 4);
    assert.equal(alchemist.data.status, "completed");
    assert.equal(quoted.data.title, 'He said "hi"');
    assert.equal(quoted.data.status, "planned");
    assert.equal(quoted.data.readNumber, null, "blank Sr No is left for the app to number");
  });

  test("explains a missing Book Title column", async () => {
    const { accessToken } = await verifiedUser("import-columns");
    const res = await upload(accessToken, "x.csv", "Name,Author\nA,B\n");
    assert.equal(res.status, 200, "'Name' is accepted as the title column");
    const bad = await upload(accessToken, "x.csv", "Something,Author\nA,B\n");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, "INVALID_SHEET");
    assert.ok(bad.body.error.missing.includes("title"));
  });

  test("rejects no file, huge files, broken Excel files and signed-out users", async () => {
    const { accessToken } = await verifiedUser("import-errors");
    assert.equal((await upload(accessToken, "x.csv", null)).body.error.code, "NO_FILE");
    assert.equal((await upload(accessToken, "big.csv", "a".repeat(2 * 1024 * 1024 + 1))).status, 413);
    assert.equal((await upload(accessToken, "broken.xlsx", "not really excel")).body.error.code, "UNREADABLE_FILE");
    assert.equal((await upload(null, "x.csv", "Book Title\nA\n")).status, 401);
  });
});
