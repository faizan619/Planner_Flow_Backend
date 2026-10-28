import { connection } from "next/server";
import { queryOne } from "@/server/db";

// GET /api/v1/health — confirms the server can reach the database. Public (for
// uptime checks), so it says only up or down: no times, versions or errors.
export async function GET() {
  await connection(); // always run at request time, never prerendered
  try {
    await queryOne("SELECT 1 AS ok");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Health check failed:", error?.code, error?.message);
    return Response.json({ ok: false }, { status: 503 });
  }
}
