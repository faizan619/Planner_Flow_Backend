import { z } from "zod";
import { ok, publicOrigin, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { rateLimit } from "@/server/rateLimit";
import { createExportLink } from "@/server/export";
import { logEvent, requestMeta } from "@/server/logs";

const ExportRequest = z.object({ format: z.enum(["json", "xlsx"]) });

// POST /api/v1/export/link — { format: "json" | "xlsx" } → { url, expiresInMinutes }
// A one-time download link for the signed-in user's data. The app opens it
// in the phone's browser.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await rateLimit(`export:user:${user.id}`, { limit: 10, windowSeconds: 3600 });
  const { format } = await readJson(request, ExportRequest);
  const link = await createExportLink(user.id, format, publicOrigin(request));
  logEvent(requestMeta(request), { category: "usage", event: "data_exported", userId: user.id, email: user.email, details: { format } });
  return ok(link, 201);
});
