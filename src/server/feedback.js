import "server-only";
import { z } from "zod";
import { createAnnouncement } from "@/server/announcements";
import { query, queryOne } from "@/server/db";
import { ApiError } from "@/server/http";
import { text } from "@/server/sanitize";

// Feedback sent from the app (Settings → Send feedback): an idea, a bug or
// anything else, from a signed-in user, read on the admin Feedback page.
// Each message moves new → read → done; an admin can reopen it. A reply goes
// to the sender's inbox (an announcement to just them, pushed to their phone)
// and is kept on the message. It goes when its account is deleted (ON DELETE CASCADE).

export const FEEDBACK_KINDS = ["idea", "bug", "other"];
export const FEEDBACK_STATUSES = ["new", "read", "done"];

const optional = (max) => z.string().trim().max(max).nullable().default(null);

export const NewFeedback = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: text(z.string().trim().min(3, "Write a few words").max(2000, "Keep it under 2,000 characters")),
  // Only when the user leaves "Include app version and phone model" on.
  appVersion: optional(20),
  versionCode: z.number().int().min(0).max(4_000_000).nullable().default(null),
  androidVersion: optional(20),
  device: optional(120),
});

export async function submitFeedback(userId, feedback) {
  const result = await query(
    `INSERT INTO feedback (user_id, kind, message, app_version, version_code, android_version, device)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, feedback.kind, feedback.message, feedback.appVersion, feedback.versionCode, feedback.androidVersion, feedback.device]
  );
  return { id: String(result.insertId) };
}

// The filters on the admin page: what still needs a look ('open' = new or
// read), only new ones, done ones, or everything.
export const FEEDBACK_VIEWS = ["open", "new", "done", "all"];
const VIEW_WHERE = {
  open: "f.status IN ('new', 'read')",
  new: "f.status = 'new'",
  done: "f.status = 'done'",
  all: "TRUE",
};

// Newest first, with who sent it.
export async function listFeedback({ view = "open" } = {}) {
  const rows = await query(
    `SELECT f.id, f.kind, f.message, f.status, f.app_version AS appVersion, f.version_code AS versionCode,
            f.android_version AS androidVersion, f.device, f.created_at AS createdAt,
            f.reply, f.replied_at AS repliedAt,
            u.id AS userId, u.name AS userName, u.email AS userEmail
     FROM feedback f JOIN users u ON u.id = f.user_id
     WHERE ${VIEW_WHERE[view] ?? VIEW_WHERE.open}
     ORDER BY f.created_at DESC LIMIT 200`
  );
  return rows.map((row) => ({ ...row, id: String(row.id), userId: String(row.userId) }));
}

export async function feedbackCounts() {
  const row = await queryOne(
    `SELECT SUM(status = 'new') AS fresh, SUM(status IN ('new', 'read')) AS open, COUNT(*) AS total FROM feedback`
  );
  return { new: Number(row?.fresh ?? 0), open: Number(row?.open ?? 0), total: Number(row?.total ?? 0) };
}

export const FeedbackStatusChange = z.object({
  feedbackId: z.string().regex(/^\d+$/),
  status: z.enum(FEEDBACK_STATUSES),
});

export async function setFeedbackStatus(id, status) {
  await query("UPDATE feedback SET status = ? WHERE id = ?", [status, id]);
}

export const FeedbackReply = z.object({
  message: text(z.string().trim().min(1, "Write a reply").max(1500, "Keep it under 1,500 characters")),
});

const QUOTE_LENGTH = 200;

// Sends `message` to the sender's inbox as "Reply to your feedback", quoting
// what they wrote, then keeps it on the feedback and marks it done.
// Returns the announcement (for pushAnnouncement). `meta` is for the admin log.
export async function replyToFeedback(admin, id, message, meta) {
  const feedback = await queryOne("SELECT id, user_id AS userId, message FROM feedback WHERE id = ?", [id]);
  if (!feedback) throw new ApiError(404, "NOT_FOUND", "Feedback not found");
  const quote = feedback.message.length > QUOTE_LENGTH ? `${feedback.message.slice(0, QUOTE_LENGTH).trimEnd()}…` : feedback.message;
  const announcement = await createAnnouncement(
    admin,
    { title: "Reply to your feedback", body: `${message}\n\nYou wrote: “${quote}”`, audience: "selected", userIds: [Number(feedback.userId)] },
    meta
  );
  await query("UPDATE feedback SET reply = ?, replied_at = CURRENT_TIMESTAMP(3), replied_by = ?, status = 'done' WHERE id = ?", [
    message,
    admin.id,
    id,
  ]);
  return announcement;
}
