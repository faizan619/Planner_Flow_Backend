import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { UserSearch, listUsers } from "@/server/admin";

// GET /api/v1/admin/users?q=… — admins only.
export const GET = route(async (request) => {
  await requireUser(request, { role: "admin" });
  const { q } = UserSearch.parse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  return ok({ users: await listUsers({ q }) });
});
