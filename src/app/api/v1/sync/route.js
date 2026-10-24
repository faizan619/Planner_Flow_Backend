import { after } from "next/server";
import { ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { touchLastActive } from "@/server/admin";
import { SyncRequest, sync } from "@/server/sync";
import { logEvent, requestMeta } from "@/server/logs";

// POST /api/v1/sync — { cursor, changes: { <type>: [records] } }
// → { cursor, hasMore, fullResync, changes, rejected }. See src/server/sync.js.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const body = await readJson(request, SyncRequest);
  const result = await sync(user, body);
  const meta = requestMeta(request);
  after(async () => {
    // At most one "used the app" entry per user every 10 minutes.
    const touched = await touchLastActive(user.id).catch(() => null);
    if (touched?.affectedRows !== 1) return;
    const sent = Object.fromEntries(
      Object.entries(body.changes)
        .map(([type, list]) => [type, list?.length ?? 0])
        .filter(([, count]) => count)
    );
    logEvent(meta, { category: "usage", event: "app_active", userId: user.id, email: user.email, details: { changesSent: sent } });
  });
  return ok(result);
});
