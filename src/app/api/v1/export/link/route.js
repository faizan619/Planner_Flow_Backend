import { z } from "zod";
import { ok, publicOrigin, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { rateLimit } from "@/server/rateLimit";
import { createExportLink } from "@/server/export";

const ExportRequest = z.object({ format: z.enum(["json", "xlsx"]) });

// POST /api/v1/export/link — { format: "json" | "xlsx" } → { url, expiresInMinutes }
// A one-time download link for the signed-in user's data. The app opens it
// in the phone's browser.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  await rateLimit(`export:user:${user.id}`, { limit: 10, windowSeconds: 3600 });
  const { format } = await readJson(request, ExportRequest);
  return ok(await createExportLink(user.id, format, publicOrigin(request)), 201);
});
