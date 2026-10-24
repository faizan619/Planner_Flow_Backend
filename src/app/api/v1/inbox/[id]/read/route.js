import { ApiError, noContent, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { markRead } from "@/server/announcements";

// POST /api/v1/inbox/:id/read — marks one of the user's own announcements read.
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  await markRead(user.id, id);
  return noContent();
});
