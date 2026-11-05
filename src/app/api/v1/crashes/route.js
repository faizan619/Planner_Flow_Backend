import { clientIp, noContent, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { CrashReport, recordCrash } from "@/server/crashes";

// POST /api/v1/crashes — a crash report from the app. No sign-in: an app can
// crash before anyone has signed in, and reports aren't tied to an account.
export const POST = route(async (request) => {
  await rateLimit(`crash:ip:${clientIp(request)}`, { limit: 30, windowSeconds: 3600 });
  await recordCrash(await readJson(request, CrashReport));
  return noContent();
});
