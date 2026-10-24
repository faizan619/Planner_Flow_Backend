import { ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { requestMeta, updateLogSettings } from "@/server/logs";
import { LogSettings, getSetting } from "@/server/settings";

// GET /api/v1/admin/log-settings → { settings: { security, admin, usage, retentionDays } }
export const GET = route(async (request) => {
  await requireUser(request, { role: "admin" });
  return ok({ settings: await getSetting("logs") });
});

// PATCH /api/v1/admin/log-settings — { security, admin, usage, retentionDays }
export const PATCH = route(async (request) => {
  const admin = await requireUser(request, { role: "admin" });
  const next = await readJson(request, LogSettings);
  return ok({ settings: await updateLogSettings(admin, next, requestMeta(request)) });
});
