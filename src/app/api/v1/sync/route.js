import { after } from "next/server";
import { ok, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { touchLastActive } from "@/server/admin";
import { SyncRequest, sync } from "@/server/sync";

// POST /api/v1/sync — { cursor, changes: { <type>: [records] } }
// → { cursor, hasMore, fullResync, changes, rejected }. See src/server/sync.js.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const body = await readJson(request, SyncRequest);
  const result = await sync(user, body);
  after(() => touchLastActive(user.id).catch(() => {}));
  return ok(result);
});
