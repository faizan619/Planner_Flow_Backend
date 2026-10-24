import { query } from "@/server/db";
import { ApiError, noContent, ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { publicUser, updateUser } from "@/server/users";
import { DeleteMe, UpdateMe } from "@/server/validation";

// GET /api/v1/me — the signed-in user's profile.
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return ok({ user: publicUser(user) });
});

// PATCH /api/v1/me — any of { name, timezone, weekStartDay, currency }
export const PATCH = route(async (request) => {
  const user = await requireUser(request);
  const changes = await readJson(request, UpdateMe);
  return ok({ user: publicUser(await updateUser(user.id, changes)) });
});

// DELETE /api/v1/me — { password }. Permanently deletes the account and,
// through ON DELETE CASCADE, everything that belongs to it.
export const DELETE = route(async (request) => {
  const user = await requireUser(request);
  const { password } = await readJson(request, DeleteMe);
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new ApiError(401, "INVALID_PASSWORD", "Wrong password", { fields: { password: ["Wrong password"] } });
  }
  await query("DELETE FROM users WHERE id = ?", [user.id]);
  return noContent();
});
