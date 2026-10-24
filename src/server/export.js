import "server-only";
import { createHash, randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { json, query, queryOne } from "@/server/db";
import { decrypt } from "@/server/crypto";
import { publicUser } from "@/server/users";

// "Export my data": everything a user has, as JSON (complete backup) or
// Excel (one readable sheet per kind of data; the Books sheet uses the
// tracker's columns so it can be imported again).
//
// The app can't download a file itself without extra native code, so it asks
// for a one-time link (createExportLink) and opens it in the phone's browser.

const LINK_MINUTES = 10;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export async function createExportLink(userId, format, origin) {
  const token = randomBytes(32).toString("base64url");
  await query(
    "INSERT INTO export_tokens (token_hash, user_id, format, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP + INTERVAL ? MINUTE)",
    [sha256(token), userId, format, LINK_MINUTES]
  );
  return { url: `${origin}/api/v1/export/download?token=${token}`, expiresInMinutes: LINK_MINUTES };
}

// Uses up a link. Returns { userId, format } or null (unknown, used or expired).
export async function redeemExportLink(token) {
  const hash = sha256(token);
  const row = await queryOne(
    `SELECT user_id AS userId, format FROM export_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [hash]
  );
  if (!row) return null;
  const claimed = await query("UPDATE export_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND used_at IS NULL", [hash]);
  return claimed.affectedRows === 1 ? row : null;
}

// ---- collecting the data ----------------------------------------------------

const live = "deleted_at IS NULL";
const bool = (value) => (value === null ? null : Boolean(value));

export async function collectUserData(user) {
  const id = user.id;
  const [habits, habitMarks, weeks, weeklyTasks, reminders, lessons, books, bookReadings, readingGoals, inbox] = await Promise.all([
    query(`SELECT id, title, sort_order AS sortOrder, started_on AS startedOn, archived_on AS archivedOn FROM habits WHERE user_id = ? AND ${live} ORDER BY sort_order`, [id]),
    query(`SELECT habit_id AS habitId, mark_date AS date, status FROM habit_marks WHERE user_id = ? AND ${live} ORDER BY mark_date`, [id]),
    query(`SELECT start_date AS weekStart, motivation FROM weeks WHERE user_id = ? AND ${live} ORDER BY start_date`, [id]),
    query(
      `SELECT id, week_start AS weekStart, title, done, carried_from_id AS carriedFromId, carried_to_id AS carriedToId
       FROM weekly_tasks WHERE user_id = ? AND ${live} ORDER BY week_start, sort_order`,
      [id]
    ),
    query(
      `SELECT id, kind, text, remind_at AS remindAt, done, person, amount_minor AS amountMinor, currency, direction
       FROM reminders WHERE user_id = ? AND ${live} ORDER BY updated_at`,
      [id]
    ),
    query(`SELECT id, title_enc AS title, body_enc AS body, lesson_date AS lessonDate, tags FROM lessons WHERE user_id = ? AND ${live} ORDER BY lesson_date`, [id]),
    query(`SELECT id, title, author, genre FROM books WHERE user_id = ? AND ${live} ORDER BY title`, [id]),
    query(
      `SELECT id, book_id AS bookId, read_number AS readNumber, type, status, start_date AS startDate, end_date AS endDate, rating
       FROM book_readings WHERE user_id = ? AND ${live}`,
      [id]
    ),
    query(`SELECT year, target FROM reading_goals WHERE user_id = ? AND ${live} ORDER BY year`, [id]),
    query(
      `SELECT a.title, a.body, a.created_at AS sentAt, r.read_at AS readAt
       FROM announcement_recipients r JOIN announcements a ON a.id = r.announcement_id
       WHERE r.user_id = ? ORDER BY a.created_at`,
      [id]
    ),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: publicUser(user),
    habits,
    habitMarks,
    weeks,
    weeklyTasks: weeklyTasks.map((task) => ({ ...task, done: bool(task.done) })),
    reminders: reminders.map((r) => ({
      ...r,
      done: bool(r.done),
      remindAt: r.remindAt === null ? null : new Date(Number(r.remindAt)).toISOString(),
      amountMinor: r.amountMinor === null ? null : Number(r.amountMinor),
    })),
    lessons: lessons.map((lesson) => ({
      ...lesson,
      title: decrypt(lesson.title, `${id}:${lesson.id}:title`),
      body: decrypt(lesson.body, `${id}:${lesson.id}:body`),
      tags: json(lesson.tags),
    })),
    books,
    bookReadings: bookReadings.map((r) => ({ ...r, rating: r.rating === null ? null : Number(r.rating) })),
    readingGoals,
    inbox,
  };
}

// ---- Excel ------------------------------------------------------------------

const TYPE_LABELS = { hardcopy: "Hardcopy", softcopy: "Softcopy", audiobook: "Audiobook" };
const STATUS_LABELS = { planned: "Planned", reading: "Reading", completed: "Completed" };
// "YYYY-MM-DD" → a real Excel date (shown day-first, like the tracker).
const excelDate = (day) => (day ? new Date(`${day}T00:00:00Z`) : null);

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map(([header, key, width = 18, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) sheet.addRow(row);
}

export async function buildWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Planner Flow";
  workbook.created = new Date();
  const DATE = "dd/mm/yyyy";
  const habitTitles = new Map(data.habits.map((habit) => [habit.id, habit.title]));
  const books = new Map(data.books.map((book) => [book.id, book]));

  // Same columns as the book tracker, so this sheet can be imported again.
  addSheet(
    workbook,
    "Books",
    [["Sr No", "srNo", 8], ["Book Title", "title", 36], ["Author", "author", 24], ["Genre", "genre"], ["Type", "type", 12], ["Start Date", "start", 12, DATE], ["End Date", "end", 12, DATE], ["Status", "status", 12], ["Rating", "rating", 8]],
    data.bookReadings
      .filter((r) => books.has(r.bookId))
      .sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"))
      .map((r) => {
        const book = books.get(r.bookId);
        return {
          srNo: r.readNumber,
          title: book.title,
          author: book.author,
          genre: book.genre,
          type: TYPE_LABELS[r.type],
          start: excelDate(r.startDate),
          end: excelDate(r.endDate),
          status: STATUS_LABELS[r.status],
          rating: r.rating,
        };
      })
  );
  addSheet(workbook, "Reading goals", [["Year", "year", 8], ["Books", "target", 8]], data.readingGoals);
  addSheet(
    workbook,
    "Habits",
    [["Habit", "title", 36], ["Started", "started", 12, DATE], ["Stopped", "stopped", 12, DATE]],
    data.habits.map((habit) => ({ title: habit.title, started: excelDate(habit.startedOn), stopped: excelDate(habit.archivedOn) }))
  );
  addSheet(
    workbook,
    "Habit marks",
    [["Date", "date", 12, DATE], ["Habit", "habit", 36], ["Mark", "mark", 10]],
    data.habitMarks
      .filter((mark) => habitTitles.has(mark.habitId))
      .map((mark) => ({ date: excelDate(mark.date), habit: habitTitles.get(mark.habitId), mark: mark.status === "done" ? "Done" : "Missed" }))
  );
  addSheet(
    workbook,
    "Weekly tasks",
    [["Week of", "week", 12, DATE], ["Task", "title", 40], ["Done", "done", 8], ["Carried over", "carried", 14]],
    data.weeklyTasks.map((task) => ({
      week: excelDate(task.weekStart),
      title: task.title,
      done: task.done ? "Yes" : "No",
      carried: task.carriedToId ? "To a later week" : task.carriedFromId ? "From earlier" : "",
    }))
  );
  addSheet(workbook, "Motivation", [["Week of", "week", 12, DATE], ["Motivation", "motivation", 60]], data.weeks.map((week) => ({ week: excelDate(week.weekStart), motivation: week.motivation })));
  addSheet(
    workbook,
    "Notes",
    [["Note", "text", 50], ["Remind at", "remindAt", 20, "dd/mm/yyyy hh:mm"], ["Done", "done", 8]],
    data.reminders
      .filter((r) => r.kind === "note")
      .map((r) => ({ text: r.text, remindAt: r.remindAt ? new Date(r.remindAt) : null, done: r.done ? "Yes" : "No" }))
  );
  addSheet(
    workbook,
    "Money",
    [["Person", "person", 24], ["Direction", "direction", 14], ["Amount", "amount", 12, "#,##0.00"], ["Currency", "currency", 9], ["For", "text", 36], ["Settled", "settled", 9]],
    data.reminders
      .filter((r) => r.kind === "money")
      .map((r) => ({
        person: r.person,
        direction: r.direction === "i_owe" ? "I owe" : "Owed to me",
        amount: r.amountMinor / 100,
        currency: r.currency,
        text: r.text,
        settled: r.done ? "Yes" : "No",
      }))
  );
  addSheet(
    workbook,
    "Life lessons",
    [["Date", "date", 12, DATE], ["Lesson", "title", 36], ["What happened", "body", 80], ["Tags", "tags", 24]],
    data.lessons.map((lesson) => ({ date: excelDate(lesson.lessonDate), title: lesson.title, body: lesson.body, tags: lesson.tags.join(", ") }))
  );
  addSheet(
    workbook,
    "Inbox",
    [["Sent", "sentAt", 20, "dd/mm/yyyy hh:mm"], ["Title", "title", 36], ["Message", "body", 80], ["Read", "read", 8]],
    data.inbox.map((item) => ({ sentAt: new Date(item.sentAt), title: item.title, body: item.body, read: item.readAt ? "Yes" : "No" }))
  );

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const exportFileName = (format) => `planner-flow-${new Date().toISOString().slice(0, 10)}.${format}`;
