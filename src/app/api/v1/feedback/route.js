import { ok, readJson, route } from "@/server/http";
import { idempotent } from "@/server/idempotency";
import { requireUser } from "@/server/auth/session";
import { NewFeedback, submitFeedback } from "@/server/feedback";
import { logEvent, requestMeta } from "@/server/logs";
import { rateLimit } from "@/server/rateLimit";

// POST /api/v1/feedback { kind, message, appVersion?, versionCode?, androidVersion?, device? } → 201 { id }
// From Settings → Send feedback. Signed-in users only, at most 5 a day each.
// Idempotent: a retry after a dropped connection doesn't send it twice.
export const POST = idempotent(route(async (request) => {
  const user = await requireUser(request);
  // Checked first, so a message with a mistake doesn't use up the day's 5.
  const feedback = await readJson(request, NewFeedback);
  await rateLimit(`feedback:user:${user.id}`, { limit: 5, windowSeconds: 86_400 });
  const saved = await submitFeedback(user.id, feedback);
  logEvent(requestMeta(request), { category: "usage", event: "feedback_sent", userId: user.id, details: { kind: feedback.kind } });
  return ok(saved, 201);
}));
