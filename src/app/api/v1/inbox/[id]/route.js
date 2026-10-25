import { ApiError, noContent, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { dismiss } from "@/server/announcements";

// DELETE /api/v1/inbox/:id — removes an announcement from the user's own inbox only.
export const DELETE = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  await dismiss(user.id, id);
  return noContent();
});
