import "server-only";
import { query } from "@/server/db";
import { getSetting } from "@/server/settings";

// Housekeeping, run daily by the Vercel cron (GET /api/cron/cleanup) and
// whenever an admin opens the Logs page. Each delete is capped so one run
// never takes long; anything left over goes next time.

const BATCH = 10_000;

export async function purgeOldLogs() {
  const { retentionDays } = await getSetting("logs");
  const result = await query(`DELETE FROM activity_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL ? DAY LIMIT ${BATCH}`, [
    retentionDays,
  ]);
  return result.affectedRows;
}

export async function cleanup() {
  const removed = { logs: await purgeOldLogs() };
  const run = async (name, sql) => {
    removed[name] = (await query(`${sql} LIMIT ${BATCH}`)).affectedRows;
  };
  // Sign-in tokens: expired, or revoked over a month ago (kept that long so
  // reuse of a stolen token is still recognised).
  await run(
    "refreshTokens",
    `DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP
       OR (revoked_at IS NOT NULL AND revoked_at < CURRENT_TIMESTAMP - INTERVAL 30 DAY)`
  );
  await run("emailCodes", "DELETE FROM email_codes WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL 1 DAY");
  await run("exportTokens", "DELETE FROM export_tokens WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL 1 DAY");
  await run("rateLimits", "DELETE FROM rate_limits WHERE window_start < CURRENT_TIMESTAMP - INTERVAL 1 DAY");
  return removed;
}
