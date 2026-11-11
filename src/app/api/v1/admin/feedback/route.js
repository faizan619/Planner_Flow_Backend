import { ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { FEEDBACK_VIEWS, feedbackCounts, listFeedback } from "@/server/feedback";

// GET /api/v1/admin/feedback?view=open|new|done|all → { items, counts: { new, open, total } }. Admins only.
// For the app's Admin → Feedback tab (the web panel reads it directly).
export const GET = route(async (request) => {
  await requireUser(request, { role: "admin" });
  const view = new URL(request.url).searchParams.get("view");
  const [items, counts] = await Promise.all([listFeedback({ view: FEEDBACK_VIEWS.includes(view) ? view : "open" }), feedbackCounts()]);
  return ok({ items, counts });
});
