import { z } from "zod";
import { query } from "@/server/db";
import { noContent, readJson, route } from "@/server/http";
import { requireUser } from "@/server/auth/session";

const Device = z.object({ token: z.string().trim().min(10).max(255), platform: z.enum(["android", "ios"]) });
const DeviceToken = z.object({ token: z.string().trim().min(10).max(255) });

// POST /api/v1/devices — { token, platform }. Registers this phone for push.
// A token moves to whoever signed in on the phone most recently.
export const POST = route(async (request) => {
  const user = await requireUser(request);
  const { token, platform } = await readJson(request, Device);
  await query(
    `INSERT INTO device_tokens (token, user_id, platform) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform), last_seen_at = CURRENT_TIMESTAMP`,
    [token, user.id, platform]
  );
  return noContent();
});

// DELETE /api/v1/devices — { token }. Called on sign-out; only removes the
// token if it belongs to the signed-in user.
export const DELETE = route(async (request) => {
  const user = await requireUser(request);
  const { token } = await readJson(request, DeviceToken);
  await query("DELETE FROM device_tokens WHERE token = ? AND user_id = ?", [token, user.id]);
  return noContent();
});
