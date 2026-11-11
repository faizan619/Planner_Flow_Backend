import { z } from "zod";
import { ApiError, noContent, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { FEEDBACK_STATUSES, setFeedbackStatus } from "@/server/feedback";

const StatusBody = z.object({ status: z.enum(FEEDBACK_STATUSES) });

// PATCH /api/v1/admin/feedback/:id { status: new | read | done } → 204. Admins only.
export const PATCH = route(async (request, { params }) => {
  await requireUser(request, { role: "admin" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) throw new ApiError(404, "NOT_FOUND", "Feedback not found");
  const { status } = await readJson(request, StatusBody);
  await setFeedbackStatus(id, status);
  return noContent();
});
