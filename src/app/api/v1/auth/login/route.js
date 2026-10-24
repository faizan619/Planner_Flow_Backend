import { query } from "@/server/db";
import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/password";
import { issueTokens } from "@/server/auth/tokens";
import { findUserByEmail, publicUser } from "@/server/users";
import { Login } from "@/server/validation";

// POST /api/v1/auth/login — { email, password } → { user, accessToken, refreshToken, … }
export const POST = route(async (request) => {
  await rateLimit(`login:ip:${clientIp(request)}`, { limit: 20, windowSeconds: 900 });
  const { email, password } = await readJson(request, Login);
  await rateLimit(`login:email:${email}`, { limit: 5, windowSeconds: 900 });

  const user = await findUserByEmail(email);
  if (!user) {
    await burnPasswordCheck(password);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Wrong email or password");
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Wrong email or password");
  }
  if (user.status !== "active") {
    throw new ApiError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated");
  }
  if (!user.emailVerifiedAt) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Please verify your email first", { email: user.email });
  }

  await query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
  const tokens = await issueTokens(user, request.headers.get("user-agent"));
  return ok({ user: publicUser(user), ...tokens });
});
