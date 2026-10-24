import { noContent, readJson, route } from "@/server/http";
import { revokeFamilyOf } from "@/server/auth/tokens";
import { RefreshToken } from "@/server/validation";

// POST /api/v1/auth/logout — { refreshToken }. Signs this device out.
export const POST = route(async (request) => {
  const { refreshToken } = await readJson(request, RefreshToken);
  await revokeFamilyOf(refreshToken);
  return noContent();
});
