import "server-only";
import { query, queryOne } from "@/server/db";

const COLUMNS = `id, name, email, password_hash AS passwordHash, role, status, timezone,
  week_start_day AS weekStartDay, currency, email_verified_at AS emailVerifiedAt, created_at AS createdAt`;
// Sign-ins (access tokens) issued before this time are refused (see requireUser).
const TOKENS_COLUMN = "tokens_valid_after AS tokensValidAfter";

// Until database/schema.sql has added tokens_valid_after (npm run db:setup),
// read users without it rather than failing every request.
async function selectUser(where, params) {
  try {
    return await queryOne(`SELECT ${COLUMNS}, ${TOKENS_COLUMN} FROM users WHERE ${where}`, params);
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
    return queryOne(`SELECT ${COLUMNS} FROM users WHERE ${where}`, params);
  }
}

export function findUserById(id) {
  return selectUser("id = ?", [id]);
}

export function findUserByEmail(email) {
  return selectUser("email = ?", [email.toLowerCase()]);
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
