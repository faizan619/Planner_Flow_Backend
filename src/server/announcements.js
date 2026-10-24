import "server-only";
import { z } from "zod";
import { query, queryOne, transaction } from "@/server/db";
import { ApiError } from "@/server/http";
import { logEvent } from "@/server/logs";

// Admin announcements and each user's inbox of them.

export const NewAnnouncement = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(120),
    body: z.string().trim().min(1, "Enter the message").max(2000),
    audience: z.enum(["all", "selected"]),
    userIds: z.array(z.coerce.number().int().positive()).max(5000).default([]),
  })
  .refine((value) => value.audience === "all" || value.userIds.length > 0, {
    message: "Choose at least one user",
    path: ["userIds"],
  });

// Creates the announcement and its inbox rows (active users only).
// Returns { id, title, body, recipients }. `meta` is for the admin log.
export async function createAnnouncement(admin, { title, body, audience, userIds }, meta) {
  const announcement = await transaction(async (q) => {
    const result = await q("INSERT INTO announcements (admin_id, title, body, audience) VALUES (?, ?, ?, ?)", [
      admin.id,
      title,
      body,
      audience,
    ]);
    const id = result.insertId;
    const inserted =
      audience === "all"
        ? await q(
            "INSERT INTO announcement_recipients (announcement_id, user_id) SELECT ?, id FROM users WHERE status = 'active'",
            [id]
          )
        : await q(
            `INSERT INTO announcement_recipients (announcement_id, user_id)
             SELECT ?, id FROM users WHERE status = 'active' AND id IN (?)`,
            [id, userIds]
          );
    if (inserted.affectedRows === 0) throw new ApiError(400, "NO_RECIPIENTS", "None of the chosen users are active");
    return { id, title, body, recipients: inserted.affectedRows };
  });
  logEvent(meta, {
    category: "admin",
    event: "announcement_sent",
    actorId: admin.id,
    details: { announcementId: String(announcement.id), audience, recipients: announcement.recipients },
  });
  return announcement;
}

export function listAnnouncements(limit = 50) {
  return query(
    `SELECT a.id, a.title, a.body, a.audience, a.created_at AS createdAt, u.name AS adminName,
            COUNT(r.user_id) AS recipients,
            SUM(r.read_at IS NOT NULL) AS readCount,
            SUM(r.push_status = 'sent') AS pushed,
            SUM(r.push_status = 'skipped') AS skipped
     FROM announcements a
     LEFT JOIN users u ON u.id = a.admin_id
     LEFT JOIN announcement_recipients r ON r.announcement_id = a.id
     GROUP BY a.id, a.title, a.body, a.audience, a.created_at, u.name
     ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    [limit]
  ).then((rows) =>
    rows.map((row) => ({
      ...row,
      id: String(row.id),
      recipients: Number(row.recipients),
      readCount: Number(row.readCount ?? 0),
      pushed: Number(row.pushed ?? 0),
      skipped: Number(row.skipped ?? 0),
    }))
  );
}

// ---- the user's inbox ------------------------------------------------------

export async function inbox(userId, limit = 100) {
  const items = await query(
    `SELECT a.id, a.title, a.body, a.created_at AS createdAt, r.read_at AS readAt
     FROM announcement_recipients r JOIN announcements a ON a.id = r.announcement_id
     WHERE r.user_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    [userId, limit]
  );
  return { items: items.map((item) => ({ ...item, id: String(item.id) })), unreadCount: await unreadCount(userId) };
}

export async function unreadCount(userId) {
  const row = await queryOne("SELECT COUNT(*) AS n FROM announcement_recipients WHERE user_id = ? AND read_at IS NULL", [userId]);
  return Number(row.n);
}

// Only touches the user's own row, so another user's id simply matches nothing.
export async function markRead(userId, announcementId) {
  const result = await query(
    "UPDATE announcement_recipients SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id = ? AND announcement_id = ?",
    [userId, announcementId]
  );
  if (result.affectedRows === 0) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
}

export async function markAllRead(userId) {
  await query("UPDATE announcement_recipients SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL", [userId]);
}
