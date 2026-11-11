import { after } from "next/server";
import { ApiError, ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { FeedbackReply, replyToFeedback } from "@/server/feedback";
import { idempotent, IDEMPOTENCY_TTL } from "@/server/idempotency";
import { requestMeta } from "@/server/logs";
import { pushAnnouncement } from "@/server/push";

// POST /api/v1/admin/feedback/:id/reply { message } → 201 { announcement }. Admins only.
// The reply goes to the sender's inbox (and phone), and the feedback is marked done.
const handlePost = route(async (request, { params }) => {
  const admin = await requireUser(request, { role: "admin" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Feedback not found");
  const { message } = await readJson(request, FeedbackReply);
  const announcement = await replyToFeedback(admin, id, message, requestMeta(request));
  after(() => pushAnnouncement(announcement).catch((error) => console.error("push failed:", error.message)));
  return ok({ announcement }, 201);
});

// A retry with the same Idempotency-Key doesn't send the reply twice.
export const POST = idempotent(handlePost, { ttlSeconds: IDEMPOTENCY_TTL.default });
