import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { stats } from "@/server/admin";

// GET /api/v1/admin/stats — admins only.
export const GET = route(async (request) => {
  await requireUser(request, { role: "admin" });
  return ok({ stats: await stats() });
});
