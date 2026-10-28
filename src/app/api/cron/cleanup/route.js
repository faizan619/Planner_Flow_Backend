import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { cleanup } from "@/server/maintenance";

// Compares in constant time (hashing first makes the lengths equal), so the
// response time doesn't reveal how much of a guessed secret was right.
const sha256 = (text) => createHash("sha256").update(text).digest();
const sameSecret = (given, expected) => timingSafeEqual(sha256(given), sha256(expected));

// GET /api/cron/cleanup — daily housekeeping (old logs, expired sign-in
// tokens, codes, export links, rate-limit counters). Vercel Cron calls it
// with "Authorization: Bearer <CRON_SECRET>" (vercel.json schedules it).
export async function GET(request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not allowed" } }, { status: 401 });
  }
  return Response.json({ ok: true, removed: await cleanup() });
}
