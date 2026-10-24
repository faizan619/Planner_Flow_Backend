import { connection } from "next/server";
import { queryOne } from "@/server/db";

// GET /api/health — confirms the server can reach the database.
export async function GET() {
  await connection(); // always run at request time, never prerendered
  try {
    const row = await queryOne("SELECT NOW() AS now");
    return Response.json({ ok: true, db: "connected", now: row.now });
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
