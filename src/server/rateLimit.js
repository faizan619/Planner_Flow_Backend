import "server-only";
import { query, queryOne } from "@/server/db";
import { ApiError } from "@/server/http";

// Fixed-window rate limiting stored in the `rate_limits` table.
//
//   await rateLimit(`login:ip:${ip}`, { limit: 20, windowSeconds: 900 });
//
// Throws a 429 ApiError (with Retry-After) once `limit` hits land in one window.
export async function rateLimit(bucket, { limit, windowSeconds }) {
  // Column assignments run left to right, so `hits` is computed against the
  // old window_start before window_start itself is reset.
  await query(
    `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, CURRENT_TIMESTAMP, 1)
     ON DUPLICATE KEY UPDATE
       hits = IF(window_start <= CURRENT_TIMESTAMP - INTERVAL ? SECOND, 1, hits + 1),
       window_start = IF(window_start <= CURRENT_TIMESTAMP - INTERVAL ? SECOND, CURRENT_TIMESTAMP, window_start)`,
    [bucket.slice(0, 191), windowSeconds, windowSeconds]
  );
  const row = await queryOne(
    `SELECT hits, GREATEST(0, ? - TIMESTAMPDIFF(SECOND, window_start, CURRENT_TIMESTAMP)) AS retryAfter
     FROM rate_limits WHERE bucket = ?`,
    [windowSeconds, bucket.slice(0, 191)]
  );
  if (row.hits > limit) {
    const retryAfter = Math.max(1, Number(row.retryAfter));
    const error = new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.", {
      retryAfter,
      headers: { "Retry-After": String(retryAfter) },
    });
    error.limit = bucket.split(":").slice(0, 2).join(":"); // e.g. "login:email", for the security log
    throw error;
  }
}
