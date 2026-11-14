import { ApiError, ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { Reaction, react } from "@/server/announcements";

// POST /api/v1/inbox/:id/react { reaction: "👍" | … | null } → the user's answers
// ({ reactions, myReaction, myChoice, votes, myReplies }). null removes it.
export const POST = route(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
  const { reaction } = await readJson(request, Reaction);
  return ok(await react(user.id, id, reaction));
});
