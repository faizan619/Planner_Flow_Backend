import "server-only";
import { z } from "zod";
import { query, queryOne } from "@/server/db";
import { ApiError } from "@/server/http";
import { revokeAllForUser } from "@/server/auth/tokens";
import { logEvent } from "@/server/logs";

// Admin panel data: user list, (de)activation and basic stats. Callers must
// have checked the admin role (requireUser(request, { role: "admin" }) or
// requireAdminPage()).

export async function stats() {
  const row = await queryOne(
    `SELECT COUNT(*) AS total,
            SUM(status = 'active') AS active,
            SUM(status = 'deactivated') AS deactivated,
            SUM(last_active_at >= CURRENT_TIMESTAMP - INTERVAL 7 DAY) AS activeThisWeek,
            SUM(created_at >= CURRENT_TIMESTAMP - INTERVAL 7 DAY) AS newThisWeek
     FROM users`
  );
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)]));
}

export const UserSearch = z.object({ q: z.string().trim().max(100).default("") });

export async function listUsers({ q = "" } = {}) {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await query(
    `SELECT id, name, email, role, status, email_verified_at AS emailVerifiedAt,
            last_active_at AS lastActiveAt, created_at AS createdAt
     FROM users WHERE (? = '' OR name LIKE ? OR email LIKE ?)
     ORDER BY created_at DESC LIMIT 500`,
    [q, like, like]
  );
  return rows.map((row) => ({ ...row, id: String(row.id), emailVerified: Boolean(row.emailVerifiedAt) }));
}

export const UserStatus = z.object({ status: z.enum(["active", "deactivated"]) });

// Deactivating signs the user out everywhere; their data stays.
// `meta` = { ip, userAgent } of the admin's request, for the admin log.
export async function setUserStatus(admin, userId, status, meta) {
  if (String(admin.id) === String(userId)) {
    throw new ApiError(400, "CANNOT_CHANGE_SELF", "You can't deactivate your own account");
  }
  const result = await query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
  if (result.affectedRows === 0) throw new ApiError(404, "NOT_FOUND", "User not found");
  if (status === "deactivated") await revokeAllForUser(userId);
  const target = await queryOne("SELECT email FROM users WHERE id = ?", [userId]);
  logEvent(meta, {
    category: "admin",
    event: status === "deactivated" ? "user_deactivated" : "user_reactivated",
    userId,
    actorId: admin.id,
    email: target?.email,
  });
}

// Called on sync; writes at most every 10 minutes per user.
export function touchLastActive(userId) {
  return query(
    `UPDATE users SET last_active_at = CURRENT_TIMESTAMP
     WHERE id = ? AND (last_active_at IS NULL OR last_active_at < CURRENT_TIMESTAMP - INTERVAL 10 MINUTE)`,
    [userId]
  );
}
