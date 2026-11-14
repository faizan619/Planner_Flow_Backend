import { ApiError, ok, readJson, route } from "@/server/http";
import { idempotent } from "@/server/idempotency";
import { requireUser } from "@/server/auth/session";
import { QuestionReply, replyToQuestion } from "@/server/announcements";
import { logEvent, requestMeta } from "@/server/logs";
import { rateLimit } from "@/server/rateLimit";

// POST /api/v1/inbox/:id/reply { message } → 201, the user's answers. A private
// answer to a question announcement: it goes to the admin Feedback page only.
// At most 10 a day per user. Idempotent: a retry doesn't send it twice.
export const POST = idempotent(
  route(async (request, { params }) => {
    const user = await requireUser(request);
    const { id } = await params;
    if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Announcement not found");
    const { message } = await readJson(request, QuestionReply);
    await rateLimit(`question-reply:user:${user.id}`, { limit: 10, windowSeconds: 86_400 });
    const answers = await replyToQuestion(user.id, id, message);
    logEvent(requestMeta(request), { category: "usage", event: "question_answered", userId: user.id, details: { announcementId: id } });
    return ok(answers, 201);
  })
);
