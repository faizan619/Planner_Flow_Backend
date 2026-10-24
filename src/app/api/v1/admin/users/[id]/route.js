import { ApiError, noContent, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { UserStatus, setUserStatus } from "@/server/admin";

// PATCH /api/v1/admin/users/:id — { status: "active" | "deactivated" }. Admins only.
export const PATCH = route(async (request, { params }) => {
  const admin = await requireUser(request, { role: "admin" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "User not found");
  const { status } = await readJson(request, UserStatus);
  await setUserStatus(admin, id, status);
  return noContent();
});
