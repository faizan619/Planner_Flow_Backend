import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { ipFromHeaders } from "@/server/clientIp";
import { query } from "@/server/db";
import { getSetting, setSetting } from "@/server/settings";

// Activity logs: who did what, when. Three categories, each switched on or
// off in the admin panel (Log settings):
//   security  sign-ins, failed sign-ins, password resets, rate limits…
//   admin     what admins did to users and settings
//   usage     using the app, imports, exports
//
//   logEvent(requestMeta(request), { category: "security", event: "login", userId, email });
//
// Writing happens after the response is sent, and a failure to log never
// breaks the request. Details never include passwords, codes, tokens or
// anything a user wrote: keys that look secret are dropped here as well.

export const CATEGORIES = ["security", "admin", "usage"];
const SECRET_KEY = /pass|token|code|secret|otp|body|text|title|note/i;

// IP and browser/app for a Route Handler request.
export function requestMeta(request) {
  return { ip: ipFromHeaders(request.headers), userAgent: request.headers.get("user-agent") };
}

// The same for Server Actions (admin panel), which have no request object.
export async function actionMeta() {
  const list = await headers();
  return { ip: ipFromHeaders(list), userAgent: list.get("user-agent") };
}

function cleanDetails(details) {
  if (!details) return null;
  const safe = {};
  for (const [key, value] of Object.entries(details)) {
    if (SECRET_KEY.test(key)) continue;
    safe[key] = typeof value === "string" ? value.slice(0, 200) : value;
  }
  return Object.keys(safe).length ? JSON.stringify(safe) : null;
}

// `force` writes even when the category is switched off; used only for
// changes to the log settings themselves, so switching logging off leaves a trace.
export function logEvent(meta, { category, event, userId = null, actorId = null, email = null, details = null }, { force = false } = {}) {
  const write = async () => {
    try {
      if (!force && !(await getSetting("logs"))[category]) return;
      await query(
        `INSERT INTO activity_logs (category, event, user_id, actor_id, email, ip, user_agent, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category,
          event,
          userId,
          actorId,
          email?.slice(0, 254) ?? null,
          meta?.ip?.slice(0, 64) ?? null,
          meta?.userAgent?.slice(0, 255) ?? null,
          cleanDetails(details),
        ]
      );
    } catch (error) {
      console.error(`log: could not record ${category}/${event}:`, error.message);
    }
  };
  after(write);
}

// Saves the log settings and records the change. The record is always
// written — even when it switches the admin log off — so turning logging off
// can't happen without a trace.
export async function updateLogSettings(admin, next, meta) {
  const before = await getSetting("logs");
  await setSetting("logs", next, admin.id);
  const changed = Object.fromEntries(
    Object.keys(next)
      .filter((key) => before[key] !== next[key])
      .map((key) => [key, `${before[key]} → ${next[key]}`])
  );
  logEvent(meta, { category: "admin", event: "log_settings_changed", actorId: admin.id, details: changed }, { force: true });
  return next;
}

// ---- reading ---------------------------------------------------------------

const PAGE_SIZE = 50;

// Newest first. Filters: category, event, userId, q (email contains), from/to (YYYY-MM-DD, IST days).
export async function listLogs({ category, event, userId, q, from, to, page = 1 } = {}) {
  const where = [];
  const params = [];
  if (CATEGORIES.includes(category)) {
    where.push("l.category = ?");
    params.push(category);
  }
  if (event) {
    where.push("l.event = ?");
    params.push(event);
  }
  if (userId) {
    where.push("l.user_id = ?");
    params.push(userId);
  }
  if (q) {
    where.push("(l.email LIKE ? OR u.email LIKE ?)");
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    params.push(like, like);
  }
  if (from) {
    where.push("l.created_at >= CONVERT_TZ(?, '+05:30', '+00:00')");
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push("l.created_at < CONVERT_TZ(?, '+05:30', '+00:00') + INTERVAL 1 DAY");
    params.push(`${to} 00:00:00`);
  }

  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
  const rows = await query(
    `SELECT l.id, l.created_at AS createdAt, l.category, l.event, l.user_id AS userId,
            COALESCE(u.email, l.email) AS email, l.actor_id AS actorId, a.email AS actorEmail,
            l.ip, l.user_agent AS userAgent, l.details
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.user_id
     LEFT JOIN users a ON a.id = l.actor_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE + 1, offset]
  );
  return {
    logs: rows.slice(0, PAGE_SIZE).map((row) => ({
      ...row,
      id: String(row.id),
      userId: row.userId === null ? null : String(row.userId),
      actorId: row.actorId === null ? null : String(row.actorId),
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
    })),
    hasMore: rows.length > PAGE_SIZE,
    page: Math.max(1, page),
  };
}

export async function listEventNames() {
  const rows = await query("SELECT DISTINCT event FROM activity_logs ORDER BY event");
  return rows.map((row) => row.event);
}
