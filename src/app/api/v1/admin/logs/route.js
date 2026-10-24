import { z } from "zod";
import { ApiError, ok, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { isValidDay } from "@/server/dates";
import { CATEGORIES, listLogs } from "@/server/logs";
import { purgeOldLogs } from "@/server/maintenance";

const day = z.string().refine(isValidDay).optional();
const LogQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  event: z.string().regex(/^[a-z_]{1,64}$/).optional(),
  userId: z.string().regex(/^\d+$/).optional(),
  q: z.string().trim().max(100).optional(),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

// GET /api/v1/admin/logs?category=&event=&userId=&q=&from=&to=&page= — admins only.
export const GET = route(async (request) => {
  await requireUser(request, { role: "admin" });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = LogQuery.safeParse(Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "")));
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Check the filters", { fields: z.flattenError(parsed.error).fieldErrors });
  }
  const filters = parsed.data;
  await purgeOldLogs();
  return ok(await listLogs(filters));
});
