import "server-only";
import { query, queryOne } from "@/server/db";

const COLUMNS = `id, name, email, password_hash AS passwordHash, role, status, timezone,
  week_start_day AS weekStartDay, currency, email_verified_at AS emailVerifiedAt, created_at AS createdAt`;

export function findUserById(id) {
  return queryOne(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id]);
}

export function findUserByEmail(email) {
  return queryOne(`SELECT ${COLUMNS} FROM users WHERE email = ?`, [email.toLowerCase()]);
}

export async function createUser({ name, email, passwordHash, timezone }) {
  const result = await query("INSERT INTO users (name, email, password_hash, timezone) VALUES (?, ?, ?, ?)", [
    name,
    email.toLowerCase(),
    passwordHash,
    timezone ?? "Asia/Kolkata",
  ]);
  return findUserById(result.insertId);
}

// Only these fields can be changed through PATCH /api/v1/me.
const EDITABLE = { name: "name", timezone: "timezone", weekStartDay: "week_start_day", currency: "currency" };

export async function updateUser(id, changes) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (key in changes) {
      sets.push(`${column} = ?`);
      params.push(changes[key]);
    }
  }
  if (sets.length) await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  return findUserById(id);
}

// What the API returns about a user. Never includes the password hash.
export function publicUser(user) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    weekStartDay: user.weekStartDay,
    currency: user.currency,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}
