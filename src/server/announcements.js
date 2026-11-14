import "server-only";
import { z } from "zod";
import { json, query, queryOne, transaction } from "@/server/db";
import { ApiError } from "@/server/http";
import { logEvent } from "@/server/logs";
import { text } from "@/server/sanitize";

// Admin announcements and each user's inbox of them. An announcement is a
// plain message, a poll (2–5 options, one vote per user, changeable until it
// closes) or a question (users reply privately; replies go to the admin
// Feedback page). Anyone it was sent to can react with one emoji. Results
// of a poll show to a user once they've voted, or when it has closed.

export const ANNOUNCEMENT_KINDS = ["message", "poll", "question"];
export const REACTIONS = ["👍", "❤️", "🎉", "😂", "😮"];

export const NewAnnouncement = z
  .object({
    title: text(z.string().trim().min(1, "Enter a title").max(120)),
    body: text(z.string().trim().min(1, "Enter the message").max(2000)),
    audience: z.enum(["all", "selected"]),
    userIds: z.array(z.coerce.number().int().positive()).max(5000).default([]),
    kind: z.enum(ANNOUNCEMENT_KINDS).default("message"),
    // Poll options; blank ones (empty form fields) are left out.
    options: z
      .array(text(z.string().trim().max(60, "Keep each option under 60 characters")))
      .max(5, "At most 5 options")
      .default([])
      .transform((list) => list.filter(Boolean)),
    // Voting / replying stops after this many days (none: stays open).
    closesInDays: z.preprocess((value) => (value === "" || value === undefined ? null : value), z.coerce.number().int().min(1).max(60).nullable()).default(null),
  })
  .refine((value) => value.audience === "all" || value.userIds.length > 0, {
    message: "Choose at least one user",
    path: ["userIds"],
  })
  .refine((value) => value.kind !== "poll" || value.options.length >= 2, { message: "A poll needs at least 2 options", path: ["options"] })
  .refine((value) => new Set(value.options.map((option) => option.toLowerCase())).size === value.options.length, {
    message: "Each option must be different",
    path: ["options"],
  });

// Creates the announcement and its inbox rows (active users only).
// Returns { id, title, body, kind, recipients }. `meta` is for the admin log.
export async function createAnnouncement(admin, fields, meta) {
  const announcement = await transaction((q) => insertAnnouncement(q, admin, fields));
  logAnnouncement(admin, fields, announcement, meta);
  return announcement;
}

// The inserts, inside a transaction the caller runs (feedback replies save
// the reply in the same one).
export async function insertAnnouncement(q, admin, { title, body, audience, userIds = [], kind = "message", options = [], closesInDays = null }) {
  // closes_at: closesInDays from now, or NULL (adding NULL days gives NULL: no end).
  const result = await q(
    `INSERT INTO announcements (admin_id, title, body, audience, kind, options, closes_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL ? DAY)`,
    [admin.id, title, body, audience, kind, kind === "poll" ? JSON.stringify(options) : null, closesInDays]
  );
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
  return { id, title, body, kind, recipients: inserted.affectedRows };
}

export function logAnnouncement(admin, { audience, kind = "message" }, announcement, meta) {
  logEvent(meta, {
    category: "admin",
    event: "announcement_sent",
    actorId: admin.id,
    details: { announcementId: String(announcement.id), audience, kind, recipients: announcement.recipients },
  });
}

export async function listAnnouncements(limit = 50) {
  const rows = await query(
    `SELECT a.id, a.title, a.body, a.audience, a.kind, a.options, a.closes_at AS closesAt,
            (a.closes_at IS NOT NULL AND a.closes_at <= CURRENT_TIMESTAMP) AS closed,
            a.created_at AS createdAt, u.name AS adminName,
            COUNT(r.user_id) AS recipients,
            SUM(r.read_at IS NOT NULL) AS readCount,
            SUM(r.push_status = 'sent') AS pushed,
            SUM(r.push_status = 'skipped') AS skipped
     FROM announcements a
     LEFT JOIN users u ON u.id = a.admin_id
     LEFT JOIN announcement_recipients r ON r.announcement_id = a.id
     GROUP BY a.id, a.title, a.body, a.audience, a.kind, a.options, a.closes_at, a.created_at, u.name
     ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    [limit]
  );
  const ids = rows.map((row) => row.id);
  const [responses, replies] = await Promise.all([
    responseTotals(ids),
    ids.length
      ? query("SELECT announcement_id AS id, COUNT(*) AS n FROM feedback WHERE announcement_id IN (?) GROUP BY announcement_id", [ids])
      : [],
  ]);
  const replyCount = new Map(replies.map((row) => [String(row.id), Number(row.n)]));
  return rows.map((row) => {
    const id = String(row.id);
    const options = row.options ? json(row.options) : [];
    const totals = responses.get(id);
    return {
      ...row,
      id,
      options,
      closed: Boolean(row.closed),
      recipients: Number(row.recipients),
      readCount: Number(row.readCount ?? 0),
      pushed: Number(row.pushed ?? 0),
      skipped: Number(row.skipped ?? 0),
      reactions: totals?.reactions ?? {},
      votes: row.kind === "poll" ? options.map((_, index) => totals?.votes[index] ?? 0) : null,
      replies: replyCount.get(id) ?? 0,
    };
  });
}

// ---- reactions, votes and replies ---------------------------------------------

// For each announcement id: { reactions: { emoji: count }, votes: { optionIndex: count } }.
async function responseTotals(ids) {
  const totals = new Map(ids.map((id) => [String(id), { reactions: {}, votes: {} }]));
  if (!ids.length) return totals;
  const [reactions, votes] = await Promise.all([
    query(
      `SELECT announcement_id AS id, reaction, COUNT(*) AS n FROM announcement_responses
       WHERE announcement_id IN (?) AND reaction IS NOT NULL GROUP BY announcement_id, reaction`,
      [ids]
    ),
    query(
      `SELECT announcement_id AS id, choice, COUNT(*) AS n FROM announcement_responses
       WHERE announcement_id IN (?) AND choice IS NOT NULL GROUP BY announcement_id, choice`,
      [ids]
    ),
  ]);
  for (const row of reactions) totals.get(String(row.id)).reactions[row.reaction] = Number(row.n);
  for (const row of votes) totals.get(String(row.id)).votes[row.choice] = Number(row.n);
  return totals;
}

// What one user sees of an announcement's answers: everyone's reactions, their
// own reaction and vote, and the poll results once they've voted or it closed.
function answersFor(item, totals, mine, myReplies) {
  const voted = mine?.choice ?? null;
  const showResults = item.kind === "poll" && (voted !== null || item.closed);
  return {
    reactions: totals?.reactions ?? {},
    myReaction: mine?.reaction ?? null,
    myChoice: voted,
    votes: showResults ? item.options.map((_, index) => totals?.votes[index] ?? 0) : null,
    myReplies: item.kind === "question" ? myReplies : 0,
  };
}

// The announcement as the user received it, or 404 (not sent to them).
async function receivedBy(userId, announcementId) {
  const row = await queryOne(
    `SELECT a.id, a.kind, a.options, (a.closes_at IS NOT NULL AND a.closes_at <= CURRENT_TIMESTAMP) AS closed
     FROM announcement_recipients r JOIN announcements a ON a.id = r.announcement_id
     WHERE r.user_id = ? AND a.id = ?`,
    [userId, announcementId]
  );
  if (!row) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  return { ...row, id: String(row.id), options: row.options ? json(row.options) : [], closed: Boolean(row.closed) };
}

// One user's answers on one announcement, after a change.
async function answersAfter(userId, item) {
  const [totals, mine, replies] = await Promise.all([
    responseTotals([item.id]),
    queryOne("SELECT reaction, choice FROM announcement_responses WHERE announcement_id = ? AND user_id = ?", [item.id, userId]),
    queryOne("SELECT COUNT(*) AS n FROM feedback WHERE announcement_id = ? AND user_id = ?", [item.id, userId]),
  ]);
  return answersFor(item, totals.get(item.id), mine, Number(replies?.n ?? 0));
}

export const Reaction = z.object({ reaction: z.enum(REACTIONS).nullable() });

// Sets (or, with null, removes) the user's reaction. Returns their answers.
export async function react(userId, announcementId, reaction) {
  const item = await receivedBy(userId, announcementId);
  await query(
    `INSERT INTO announcement_responses (announcement_id, user_id, reaction) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE reaction = VALUES(reaction), updated_at = CURRENT_TIMESTAMP(3)`,
    [item.id, userId, reaction]
  );
  return answersAfter(userId, item);
}

export const Vote = z.object({ choice: z.number().int().min(0).max(4) });

// Records (or changes) the user's vote on a poll that's still open.
export async function vote(userId, announcementId, choice) {
  const item = await receivedBy(userId, announcementId);
  if (item.kind !== "poll") throw new ApiError(400, "NOT_A_POLL", "This isn't a poll");
  if (item.closed) throw new ApiError(409, "CLOSED", "This poll has closed");
  if (choice >= item.options.length) throw new ApiError(400, "VALIDATION_ERROR", "Choose one of the options");
  await query(
    `INSERT INTO announcement_responses (announcement_id, user_id, choice) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = CURRENT_TIMESTAMP(3)`,
    [item.id, userId, choice]
  );
  return answersAfter(userId, item);
}

export const QuestionReply = z.object({
  message: text(z.string().trim().min(1, "Write your answer").max(2000, "Keep it under 2,000 characters")),
});

// A private answer to a question: saved as feedback linked to it, for the
// admin Feedback page (where it can be answered like any feedback).
export async function replyToQuestion(userId, announcementId, message) {
  const item = await receivedBy(userId, announcementId);
  if (item.kind !== "question") throw new ApiError(400, "NOT_A_QUESTION", "This announcement doesn't take answers");
  if (item.closed) throw new ApiError(409, "CLOSED", "Answers to this question have closed");
  await query("INSERT INTO feedback (user_id, kind, message, announcement_id) VALUES (?, 'other', ?, ?)", [userId, message, item.id]);
  return answersAfter(userId, item);
}

// ---- the user's inbox ------------------------------------------------------

// Each item: { id, title, body, kind, options, closesAt, closed, createdAt, readAt,
//   reactions, myReaction, myChoice, votes (null until voted or closed), myReplies }.
export async function inbox(userId, limit = 100) {
  const rows = await query(
    `SELECT a.id, a.title, a.body, a.kind, a.options, a.closes_at AS closesAt,
            (a.closes_at IS NOT NULL AND a.closes_at <= CURRENT_TIMESTAMP) AS closed,
            a.created_at AS createdAt, r.read_at AS readAt
     FROM announcement_recipients r JOIN announcements a ON a.id = r.announcement_id
     WHERE r.user_id = ? AND r.dismissed_at IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    [userId, limit]
  );
  const items = rows.map((row) => ({ ...row, id: String(row.id), options: row.options ? json(row.options) : [], closed: Boolean(row.closed) }));
  const ids = items.map((item) => item.id);
  const [totals, mine, replies] = await Promise.all([
    responseTotals(ids),
    ids.length ? query("SELECT announcement_id AS id, reaction, choice FROM announcement_responses WHERE user_id = ? AND announcement_id IN (?)", [userId, ids]) : [],
    ids.length
      ? query("SELECT announcement_id AS id, COUNT(*) AS n FROM feedback WHERE user_id = ? AND announcement_id IN (?) GROUP BY announcement_id", [userId, ids])
      : [],
  ]);
  const myAnswers = new Map(mine.map((row) => [String(row.id), row]));
  const myReplies = new Map(replies.map((row) => [String(row.id), Number(row.n)]));
  return {
    items: items.map((item) => ({ ...item, ...answersFor(item, totals.get(item.id), myAnswers.get(item.id), myReplies.get(item.id) ?? 0) })),
    unreadCount: await unreadCount(userId),
  };
}

export async function unreadCount(userId) {
  const row = await queryOne(
    "SELECT COUNT(*) AS n FROM announcement_recipients WHERE user_id = ? AND read_at IS NULL AND dismissed_at IS NULL",
    [userId]
  );
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

// The user removes an announcement from their own inbox. Only their row is
// touched; it counts as read, and the admin's history keeps its numbers.
export async function dismiss(userId, announcementId) {
  const result = await query(
    `UPDATE announcement_recipients
     SET dismissed_at = CURRENT_TIMESTAMP, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
     WHERE user_id = ? AND announcement_id = ? AND dismissed_at IS NULL`,
    [userId, announcementId]
  );
  if (result.affectedRows === 0) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
}

// An admin deletes an announcement for everyone: it leaves every inbox
// (recipient rows go with it) and the history. Phones that already showed
// the push keep that notification until it's dismissed; tapping it opens the
// inbox, where it's gone.
export async function deleteAnnouncement(admin, announcementId, meta) {
  const existing = await queryOne(
    `SELECT a.audience, COUNT(r.user_id) AS recipients FROM announcements a
     LEFT JOIN announcement_recipients r ON r.announcement_id = a.id
     WHERE a.id = ? GROUP BY a.id, a.audience`,
    [announcementId]
  );
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  await query("DELETE FROM announcements WHERE id = ?", [announcementId]);
  logEvent(meta, {
    category: "admin",
    event: "announcement_deleted",
    actorId: admin.id,
    details: { announcementId: String(announcementId), audience: existing.audience, recipients: Number(existing.recipients) },
  });
}
