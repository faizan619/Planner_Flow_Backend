import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { rotateRefreshToken } from "@/server/auth/tokens";
import { findUserById, publicUser } from "@/server/users";
import { RefreshToken } from "@/server/validation";

// POST /api/v1/auth/refresh — { refreshToken } → a new access + refresh token.
// The old refresh token stops working; reusing it signs that device out.
export const POST = route(async (request) => {
  await rateLimit(`refresh:ip:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
  const { refreshToken } = await readJson(request, RefreshToken);

  const result = await rotateRefreshToken(refreshToken, request.headers.get("user-agent"), findUserById);
  if (!result) throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Please sign in again");
  return ok({ user: publicUser(result.user), ...result.tokens });
});
