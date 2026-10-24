import { query } from "@/server/db";
import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { consumeCode } from "@/server/auth/codes";
import { issueTokens } from "@/server/auth/tokens";
import { findUserByEmail, publicUser } from "@/server/users";
import { VerifyEmail } from "@/server/validation";

// POST /api/v1/auth/verify-email — { email, code } → signs the user in.
export const POST = route(async (request) => {
  await rateLimit(`verify:ip:${clientIp(request)}`, { limit: 30, windowSeconds: 900 });
  const { email, code } = await readJson(request, VerifyEmail);
  await rateLimit(`verify:email:${email}`, { limit: 10, windowSeconds: 900 });

  const user = await findUserByEmail(email);
  const invalid = new ApiError(400, "INVALID_CODE", "That code is wrong or has expired", {
    fields: { code: ["That code is wrong or has expired"] },
  });
  if (!user || user.emailVerifiedAt) throw invalid;
  if (user.status !== "active") throw new ApiError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated");
  if (!(await consumeCode(user.id, "verify", code))) throw invalid;

  await query("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [
    user.id,
  ]);
  const tokens = await issueTokens(user, request.headers.get("user-agent"));
  return ok({ user: publicUser({ ...user, emailVerifiedAt: new Date() }), ...tokens });
});
