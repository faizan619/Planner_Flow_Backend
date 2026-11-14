import { ApiError, ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { Vote, vote } from "@/server/announcements";

// POST /api/v1/inbox/:id/vote { choice: option index } → the user's answers,
// with the poll's results. A vote can be changed until the poll closes (409 after).
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  const { choice } = await readJson(request, Vote);
  return ok(await vote(user.id, id, choice));
});
