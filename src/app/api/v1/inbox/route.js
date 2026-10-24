import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { inbox } from "@/server/announcements";

// GET /api/v1/inbox → { items: [{ id, title, body, createdAt, readAt }], unreadCount }
export const GET = route(async (request) => {
  const user = await requireUser(request);
  return ok(await inbox(user.id));
});
