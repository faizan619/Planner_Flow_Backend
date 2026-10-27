import "server-only";
import { z } from "zod";
import { json, transaction } from "@/server/db";
import { BOOK_TYPES, READING_STATUSES, readingProblems } from "@/server/books";
import { decrypt, encrypt } from "@/server/crypto";
import { addDays, isValidDay, todayIn } from "@/server/dates";

// Offline sync for the app's own records (POST /api/v1/sync).
//
// The app sends the records it changed since the last sync and its cursor;
// the server keeps whichever version of each record has the newer updatedAt
// (last write wins), then returns the records that changed after the cursor,
// at most PULL_LIMIT per response (`hasMore` says to ask again).
// Every read and write is filtered by the signed-in user's id, and each
// table's primary key starts with user_id, so a record id sent by one user
// can never reach another user's row.

const day = z.string().refine(isValidDay, "Use a YYYY-MM-DD date");
const timestamp = z.number().int().nonnegative().max(8_000_000_000_000);
const base = { updatedAt: timestamp, deletedAt: timestamp.nullable() };

// Each entity: its table, key column, wire fields → columns, and zod schema.
// Optional `write(record, userId)` / `read(row, userId)` convert between the
// wire format and stored values (e.g. encryption). Optional `owner` names a
// field that must point at one of the user's own records in another table.
// Order matters when applying: parents (habits, books) come before children.
const ENTITIES = {
  habits: {
    table: "habits",
    key: "id",
    columns: { title: "title", sortOrder: "sort_order", startedOn: "started_on", archivedOn: "archived_on" },
    schema: z.object({
      id: z.uuid(),
      title: z.string().trim().min(1).max(120),
      sortOrder: z.number().int(),
      startedOn: day,
      archivedOn: day.nullable(),
      ...base,
    }),
  },
  weeks: {
    table: "weeks",
    key: "start_date",
    columns: { motivation: "motivation" },
    schema: z.object({
      id: day, // the week's first day
      motivation: z.string().max(300),
      ...base,
    }),
  },
  weeklyTasks: {
    table: "weekly_tasks",
    key: "id",
    columns: {
      weekStart: "week_start",
      title: "title",
      done: "done",
      carriedFromId: "carried_from_id",
      carriedToId: "carried_to_id",
      sortOrder: "sort_order",
    },
    schema: z.object({
      id: z.uuid(),
      weekStart: day,
      title: z.string().trim().min(1).max(200),
      done: z.boolean(),
      carriedFromId: z.uuid().nullable(),
      carriedToId: z.uuid().nullable(),
      sortOrder: z.number().int(),
      ...base,
    }),
  },
  habitMarks: {
    table: "habit_marks",
    key: "id",
    columns: { habitId: "habit_id", date: "mark_date", status: "status" },
    schema: z
      .object({
        id: z.string().max(48),
        habitId: z.uuid(),
        date: day,
        status: z.enum(["done", "missed"]),
        ...base,
      })
      .refine((mark) => mark.id === `${mark.habitId}_${mark.date}`, "id must be <habitId>_<date>"),
    owner: { field: "habitId", table: "habits", message: "Unknown habit" },
  },
  reminders: {
    table: "reminders",
    key: "id",
    columns: {
      kind: "kind",
      text: "text",
      remindAt: "remind_at",
      done: "done",
      person: "person",
      amountMinor: "amount_minor",
      currency: "currency",
      direction: "direction",
    },
    schema: z
      .object({
        id: z.uuid(),
        kind: z.enum(["note", "money"]),
        text: z.string().trim().max(500),
        remindAt: timestamp.nullable(),
        done: z.boolean(),
        person: z.string().trim().max(100).nullable(),
        amountMinor: z.number().int().positive().max(100_000_000_000).nullable(), // paise
        currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
        direction: z.enum(["i_owe", "owed_to_me"]).nullable(),
        ...base,
      })
      .superRefine((reminder, ctx) => {
        if (reminder.deletedAt) return;
        if (reminder.kind === "note" && !reminder.text) {
          ctx.addIssue({ code: "custom", message: "A note needs text" });
        }
        if (reminder.kind === "money" && (!reminder.person || !reminder.amountMinor || !reminder.currency || !reminder.direction)) {
          ctx.addIssue({ code: "custom", message: "Money needs a person, amount, currency and direction" });
        }
      }),
  },
  lessons: {
    table: "lessons",
    key: "id",
    columns: { title: "title_enc", body: "body_enc", lessonDate: "lesson_date", tags: "tags" },
    schema: z.object({
      id: z.uuid(),
      title: z.string().trim().min(1).max(200),
      body: z.string().max(50000), // HTML from the app's rich text editor
      lessonDate: day,
      tags: z.array(z.string().trim().min(1).max(30)).max(10),
      ...base,
    }),
    write: (lesson, userId) => ({
      ...lesson,
      title: encrypt(lesson.title, `${userId}:${lesson.id}:title`),
      body: encrypt(lesson.body, `${userId}:${lesson.id}:body`),
      tags: JSON.stringify(lesson.tags),
    }),
    read: (row, userId) => ({
      ...row,
      title: decrypt(row.title, `${userId}:${row.id}:title`),
      body: decrypt(row.body, `${userId}:${row.id}:body`),
      tags: json(row.tags),
    }),
  },
  books: {
    table: "books",
    key: "id",
    columns: { title: "title", author: "author", genre: "genre" },
    schema: z.object({
      id: z.uuid(),
      title: z.string().trim().min(1).max(200),
      author: z.string().trim().max(150),
      genre: z.string().trim().max(60),
      ...base,
    }),
  },
  bookReadings: {
    table: "book_readings",
    key: "id",
    columns: {
      bookId: "book_id",
      readNumber: "read_number",
      type: "type",
      status: "status",
      startDate: "start_date",
      endDate: "end_date",
      rating: "rating",
    },
    schema: z
      .object({
        id: z.uuid(),
        bookId: z.uuid(),
        readNumber: z.number().int().min(1).max(999),
        type: z.enum(BOOK_TYPES),
        status: z.enum(READING_STATUSES),
        startDate: day.nullable(),
        endDate: day.nullable(),
        rating: z.number().int().min(1).max(5).nullable(),
        ...base,
      })
      .superRefine((reading, ctx) => {
        if (reading.deletedAt) return;
        for (const message of readingProblems(reading)) ctx.addIssue({ code: "custom", message });
      }),
    owner: { field: "bookId", table: "books", message: "Unknown book" },
  },
  readingGoals: {
    table: "reading_goals",
    key: "year",
    columns: { target: "target" },
    schema: z.object({
      id: z.string().regex(/^(19|20|21)\d{2}$/, "Use a 4-digit year"), // the year
      target: z.number().int().min(1).max(1000),
      ...base,
    }),
  },
};

export const ENTITY_NAMES = Object.keys(ENTITIES);
const MAX_PER_TYPE = 500;
const PULL_LIMIT = 300;

export const SyncRequest = z.object({
  cursor: z.number().int().nonnegative(),
  changes: z
    .object(Object.fromEntries(ENTITY_NAMES.map((name) => [name, z.array(z.unknown()).max(MAX_PER_TYPE).optional()])))
    .default({}),
});

function selectColumns(entity) {
  const fields = Object.entries(entity.columns).map(([field, column]) => `${column} AS ${field}`);
  return [`${entity.key} AS id`, ...fields, "updated_at AS updatedAt", "deleted_at AS deletedAt", "server_seq AS seq"].join(
    ", "
  );
}

// Applies `changes` for `user` and returns { cursor, hasMore, fullResync, changes, rejected }.
export async function sync(user, { cursor, changes }) {
  const rejected = [];
  const now = Date.now();

  return transaction(async (q) => {
    // Locking the user row serialises syncs for this user, so sequence
    // numbers are handed out in order.
    const [{ seq: startSeq }] = await q("SELECT sync_seq AS seq FROM users WHERE id = ? FOR UPDATE", [user.id]);
    let seq = Number(startSeq);
    const today = todayIn(user.timezone);

    for (const [name, entity] of Object.entries(ENTITIES)) {
      const valid = [];
      for (const raw of changes[name] ?? []) {
        const result = entity.schema.safeParse(raw);
        if (!result.success) {
          rejected.push({ type: name, id: raw?.id ?? null, reason: result.error.issues[0]?.message ?? "invalid" });
          continue;
        }
        valid.push(result.data);
      }
      if (!valid.length) continue;

      if (entity.owner) await rejectUnowned(q, user.id, name, entity.owner, valid, rejected);
      if (name === "habitMarks") rejectFutureMarks(valid, today, rejected);

      const records = valid.filter((record) => !record.rejected);
      if (!records.length) continue;

      const existing = await q(
        `SELECT ${entity.key} AS id, updated_at AS updatedAt FROM ${entity.table} WHERE user_id = ? AND ${entity.key} IN (?)`,
        [user.id, records.map((record) => record.id)]
      );
      const known = new Map(existing.map((row) => [String(row.id), Number(row.updatedAt)]));

      const rows = [];
      for (const record of records) {
        // A clock running ahead mustn't make an edit unbeatable forever.
        const updatedAt = Math.min(record.updatedAt, now + 60_000);
        const current = known.get(record.id);
        if (current !== undefined && current >= updatedAt) continue; // server copy is newer
        known.set(record.id, updatedAt);
        seq += 1;
        const stored = entity.write ? entity.write(record, user.id) : record;
        rows.push([
          user.id,
          record.id,
          ...Object.keys(entity.columns).map((field) => stored[field]),
          updatedAt,
          record.deletedAt,
          seq,
        ]);
      }
      if (!rows.length) continue;

      const columns = [...Object.values(entity.columns), "updated_at", "deleted_at", "server_seq"];
      await q(
        `INSERT INTO ${entity.table} (user_id, ${entity.key}, ${columns.join(", ")}) VALUES ?
         ON DUPLICATE KEY UPDATE ${columns.map((column) => `${column} = VALUES(${column})`).join(", ")}`,
        [rows]
      );
    }

    if (seq !== Number(startSeq)) await q("UPDATE users SET sync_seq = ? WHERE id = ?", [seq, user.id]);

    // A cursor from the future (e.g. the account was recreated) means the
    // app's copy is out of step: send everything.
    const since = cursor > seq ? 0 : cursor;

    // Take the oldest PULL_LIMIT changes across all tables. If there are more,
    // the cursor stops at the last one sent and `hasMore` asks for the rest.
    const candidates = [];
    for (const [name, entity] of Object.entries(ENTITIES)) {
      const rows = await q(
        `SELECT ${selectColumns(entity)} FROM ${entity.table}
         WHERE user_id = ? AND server_seq > ? AND server_seq <= ? ORDER BY server_seq LIMIT ?`,
        [user.id, since, seq, PULL_LIMIT + 1]
      );
      for (const row of rows) candidates.push({ name, entity, row });
    }
    candidates.sort((a, b) => Number(a.row.seq) - Number(b.row.seq));
    const hasMore = candidates.length > PULL_LIMIT;
    const page = candidates.slice(0, PULL_LIMIT);

    const pulled = Object.fromEntries(ENTITY_NAMES.map((name) => [name, []]));
    for (const { name, entity, row } of page) {
      const fields = { ...row };
      delete fields.seq;
      let record = {
        ...fields,
        id: String(row.id),
        updatedAt: Number(row.updatedAt),
        deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
        ...(row.done !== undefined && { done: Boolean(row.done) }),
        ...(row.remindAt !== undefined && { remindAt: row.remindAt === null ? null : Number(row.remindAt) }),
        ...(row.amountMinor !== undefined && { amountMinor: row.amountMinor === null ? null : Number(row.amountMinor) }),
        ...(row.rating !== undefined && { rating: row.rating === null ? null : Number(row.rating) }),
      };
      if (entity.read) {
        try {
          record = entity.read(record, user.id);
        } catch (error) {
          // Unreadable (tampered with, or the key changed): never send garbage.
          console.error(`sync: could not read ${name} ${record.id}:`, error.message);
          continue;
        }
      }
      pulled[name].push(record);
    }

    return {
      cursor: hasMore ? Number(page.at(-1).row.seq) : seq,
      hasMore,
      fullResync: since === 0 && cursor > 0,
      changes: pulled,
      rejected,
    };
  });
}

// A child record (mark, reading) must point at one of the user's own parent
// records (habit, book) — already stored or arriving in this same sync.
async function rejectUnowned(q, userId, type, owner, records, rejected) {
  const parentIds = [...new Set(records.map((record) => record[owner.field]))];
  const owned = await q(`SELECT id FROM ${owner.table} WHERE user_id = ? AND id IN (?)`, [userId, parentIds]);
  const ownedIds = new Set(owned.map((row) => row.id));
  for (const record of records) {
    if (record.rejected || ownedIds.has(record[owner.field])) continue;
    record.rejected = true;
    rejected.push({ type, id: record.id, reason: owner.message });
  }
}

// Marks can't be for a future day (one day of slack for devices whose clock
// or time zone differs).
function rejectFutureMarks(marks, today, rejected) {
  const latest = addDays(today, 1);
  for (const mark of marks) {
    if (mark.rejected || mark.date <= latest) continue;
    mark.rejected = true;
    rejected.push({ type: "habitMarks", id: mark.id, reason: "Can't mark a future day" });
  }
}
