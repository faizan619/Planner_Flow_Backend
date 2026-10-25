import { ApiError, noContent, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { deleteAnnouncement } from "@/server/announcements";
import { requestMeta } from "@/server/logs";

// DELETE /api/v1/admin/announcements/:id — removes it from every inbox and the history. Admins only.
export const DELETE = route(async (request, { params }) => {
  const admin = await requireUser(request, { role: "admin" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  await deleteAnnouncement(admin, id, requestMeta(request));
  return noContent();
});
