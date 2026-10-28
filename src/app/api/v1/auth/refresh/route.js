import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { rotateRefreshToken } from "@/server/auth/tokens";
import { findUserById, publicUser } from "@/server/users";
import { logEvent, requestMeta } from "@/server/logs";
import { RefreshToken } from "@/server/validation";
import { idempotent, IDEMPOTENCY_TTL } from "@/server/idempotency";

// POST /api/v1/auth/refresh — { refreshToken } → a new access + refresh token.
// The old refresh token stops working; reusing it signs that device out.
const handlePost = route(async (request) => {
  await rateLimit(`refresh:ip:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
  const { refreshToken } = await readJson(request, RefreshToken);

  const result = await rotateRefreshToken(refreshToken, request.headers.get("user-agent"), findUserById, (userId) =>
    logEvent(requestMeta(request), {
      category: "security",
      event: "refresh_token_reused",
      userId,
      details: { action: "signed out that device" },
    })
  );
  if (!result) throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Please sign in again");
  return ok({ user: publicUser(result.user), ...result.tokens });
});

// A retry with the same Idempotency-Key gets the same answer (the answer holds
// sign-in tokens, so it is kept only briefly).
export const POST = idempotent(handlePost, { ttlSeconds: IDEMPOTENCY_TTL.tokens });
