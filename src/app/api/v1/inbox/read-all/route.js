import { noContent, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { markAllRead } from "@/server/announcements";

// POST /api/v1/inbox/read-all
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await markAllRead(user.id);
  return noContent();
});
