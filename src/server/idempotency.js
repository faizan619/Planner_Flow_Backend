import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "@/server/db";
import { decrypt, encrypt } from "@/server/crypto";
import { errorResponse } from "@/server/http";

// Idempotency-Key support for requests that must not run twice: a retry of
// the same request (same key, same body) gets the first answer back instead
// of creating a second announcement, burning a one-time code again, or
// rotating a refresh token twice (which signs the device out).
//
//   export const POST = idempotent(route(async (request) => …), { ttlSeconds: 120 });
//
// The app sends one random key per action and reuses it only when retrying
// that action (Planner_Flow src/api/client.js). Without the header a request
// runs as usual. Answers are kept encrypted (some carry sign-in tokens) for
// `ttlSeconds`; the daily cleanup deletes old ones (src/server/maintenance.js).
//
// Only finished answers are replayed: 2xx and most 4xx. Server errors, rate
// limits, 401 and "in progress" are not stored, so a retry runs it again.
// If the idempotency_keys table is missing or the database call fails, the
// request runs without this protection rather than failing.

// How long answers are kept: answers holding sign-in tokens only long enough
// for the app's quick retries.
export const IDEMPOTENCY_TTL = { default: 24 * 60 * 60, tokens: 2 * 60 };

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
// Answers a retry should not replay: not signed in (the app refreshes its
// token and asks again), timeouts, "in progress" and rate limits.
const NOT_STORED = new Set([401, 408, 409, 425, 429]);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function idempotent(handler, { ttlSeconds = 24 * 60 * 60 } = {}) {
  return async (request, context) => {
    const key = request.headers.get("idempotency-key");
    if (!key) return handler(request, context);
    if (!KEY_PATTERN.test(key)) {
      return errorResponse(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 16–128 letters, digits, - or _");
    }

    const { pathname } = new URL(request.url);
    const id = sha256(`${request.method} ${pathname} ${key}`);
    // Who is asking and what: the same key with another body or user is refused.
    const requestHash = sha256(`${request.headers.get("authorization") ?? ""}\n${await request.clone().text()}`);

    let claimed;
    try {
      claimed = await claim(id, requestHash, ttlSeconds);
    } catch (error) {
      console.error("Idempotency unavailable, running without it:", error?.code ?? "", error?.message);
      return handler(request, context);
    }
    if (claimed.response) return claimed.response;

    const response = await handler(request, context);
    try {
      if (response.status < 500 && !NOT_STORED.has(response.status)) {
        const body = await response.clone().text();
        await query(
          "UPDATE idempotency_keys SET status = 'done', response_status = ?, response_body = ? WHERE id = ?",
          [response.status, encrypt(body, `idempotency:${id}`), id]
        );
      } else {
        await query("DELETE FROM idempotency_keys WHERE id = ?", [id]);
      }
    } catch (error) {
      console.error("Idempotency result not stored:", error?.code ?? "", error?.message);
    }
    return response;
  };
}

// Takes the key for this request, or answers from what is stored under it:
// { response } to send back, or {} when the caller should run the request.
async function claim(id, requestHash, ttlSeconds) {
  // An expired key is free again.
  await query("DELETE FROM idempotency_keys WHERE id = ? AND expires_at < CURRENT_TIMESTAMP", [id]);
  const inserted = await query(
    `INSERT IGNORE INTO idempotency_keys (id, request_hash, status, expires_at)
     VALUES (?, ?, 'pending', CURRENT_TIMESTAMP + INTERVAL ? SECOND)`,
    [id, requestHash, ttlSeconds]
  );
  if (inserted.affectedRows === 1) return {};

  const row = await queryOne("SELECT request_hash, status, response_status, response_body FROM idempotency_keys WHERE id = ?", [id]);
  if (!row) return {}; // just expired and deleted: run it
  if (row.request_hash !== requestHash) {
    return {
      response: errorResponse(422, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different request"),
    };
  }
  if (row.status !== "done") {
    return {
      response: errorResponse(409, "REQUEST_IN_PROGRESS", "The same request is still being handled. Try again in a moment.", {
        headers: { "Retry-After": "1" },
      }),
    };
  }
  return {
    response: new Response(decrypt(row.response_body, `idempotency:${id}`), {
      status: row.response_status,
      headers: { "Content-Type": "application/json", "Idempotent-Replayed": "true" },
    }),
  };
}
