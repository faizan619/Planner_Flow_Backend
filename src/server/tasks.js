import "server-only";
import { query, queryOne } from "@/server/db";

const COLUMNS = "id, title, notes, due_at AS dueAt, is_done AS isDone, created_at AS createdAt, updated_at AS updatedAt";

export function listTasks() {
  return query(`SELECT ${COLUMNS} FROM tasks ORDER BY is_done, due_at IS NULL, due_at, id DESC`);
}

export function getTask(id) {
  return queryOne(`SELECT ${COLUMNS} FROM tasks WHERE id = ?`, [id]);
}

export async function createTask({ title, notes = null, dueAt = null }) {
  const result = await query("INSERT INTO tasks (title, notes, due_at) VALUES (?, ?, ?)", [
    title,
    notes,
    dueAt,
  ]);
  return getTask(result.insertId);
}

// Only the fields present in `changes` are updated.
export async function updateTask(id, changes) {
  const fields = { title: "title", notes: "notes", dueAt: "due_at", isDone: "is_done" };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(fields)) {
    if (key in changes) {
      sets.push(`${column} = ?`);
      params.push(changes[key]);
    }
  }
  if (sets.length) await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  return getTask(id);
}

export async function deleteTask(id) {
  const result = await query("DELETE FROM tasks WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

// Checks a JSON body from the app. Returns { data } or { error }.
// `partial` = PATCH, where every field is optional.
export function validateTask(body, { partial = false } = {}) {
  if (!body || typeof body !== "object") return { error: "Body must be a JSON object" };
  const data = {};

  if ("title" in body || !partial) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) return { error: "title is required (max 200 chars)" };
    data.title = title;
  }
  if ("notes" in body) {
    if (body.notes !== null && typeof body.notes !== "string") return { error: "notes must be a string" };
    data.notes = body.notes;
  }
  if ("dueAt" in body) {
    if (body.dueAt === null) data.dueAt = null;
    else {
      const date = new Date(body.dueAt);
      if (Number.isNaN(date.getTime())) return { error: "dueAt must be an ISO date string" };
      data.dueAt = date;
    }
  }
  if ("isDone" in body) {
    if (typeof body.isDone !== "boolean") return { error: "isDone must be true or false" };
    data.isDone = body.isDone;
  }
  return { data };
}
