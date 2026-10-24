import { connection } from "next/server";
import { cleanup } from "@/server/maintenance";

// GET /api/cron/cleanup — daily housekeeping (old logs, expired sign-in
// tokens, codes, export links, rate-limit counters). Vercel Cron calls it
// with "Authorization: Bearer <CRON_SECRET>" (vercel.json schedules it).
export async function GET(request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not allowed" } }, { status: 401 });
  }
  return Response.json({ ok: true, removed: await cleanup() });
}
