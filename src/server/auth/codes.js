import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { query, queryOne } from "@/server/db";
import { ApiError } from "@/server/http";
import { sendMail } from "@/server/mail";

// 6-digit email codes for `verify` (email verification) and `reset`
// (forgot password). A new code replaces any unused one for the same purpose.

const TTL_MINUTES = 15;
export const CODE_COOLDOWN_SECONDS = 60;

// One code per minute per account and purpose, on top of the hourly rate
// limits, so nobody can fire a burst of emails at someone. Throws a 429
// CODE_COOLDOWN with the seconds left (the app counts them down).
export async function assertCodeCooldown(userId, purpose) {
  const row = await queryOne(
    `SELECT GREATEST(0, ? - TIMESTAMPDIFF(SECOND, MAX(created_at), CURRENT_TIMESTAMP)) AS wait
     FROM email_codes WHERE user_id = ? AND purpose = ?`,
    [CODE_COOLDOWN_SECONDS, userId, purpose]
  );
  const wait = Number(row?.wait ?? 0); // no earlier code: MAX() is NULL, so wait is NULL
  if (wait > 0) {
    throw new ApiError(429, "CODE_COOLDOWN", `Please wait ${wait} seconds before asking for another code.`, {
      retryAfter: wait,
      headers: { "Retry-After": String(wait) },
    });
  }
}
const MAX_ATTEMPTS = 5;

function hmac(userId, purpose, code) {
  return createHmac("sha256", process.env.JWT_SECRET).update(`${userId}:${purpose}:${code}`).digest("hex");
}

export async function sendCode(user, purpose) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await query("UPDATE email_codes SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = ? AND used_at IS NULL", [
    user.id,
    purpose,
  ]);
  await query(
    `INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP + INTERVAL ? MINUTE)`,
    [user.id, purpose, hmac(user.id, purpose, code), TTL_MINUTES]
  );

  const subject = purpose === "verify" ? "Verify your Planner Flow email" : "Reset your Planner Flow password";
  const action = purpose === "verify" ? "verify your email" : "reset your password";
  await sendMail({
    to: user.email,
    subject,
    text: `Hi ${user.name},\n\nYour code to ${action} is: ${code}\n\nIt expires in ${TTL_MINUTES} minutes. If you didn't ask for this, you can ignore this email.\n\n— Planner Flow`,
  });
}

// Checks a code. Returns true and marks it used, or false (wrong, expired,
// or out of attempts).
export async function consumeCode(userId, purpose, code) {
  const row = await queryOne(
    `SELECT id, code_hash AS codeHash, attempts FROM email_codes
     WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`,
    [userId, purpose]
  );
  if (!row || row.attempts >= MAX_ATTEMPTS) return false;

  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hmac(userId, purpose, code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    return false;
  }

  const claimed = await query("UPDATE email_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL", [
    row.id,
  ]);
  return claimed.affectedRows === 1;
}
