import { query } from "@/server/db";
import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { consumeCode } from "@/server/auth/codes";
import { hashPassword } from "@/server/auth/password";
import { revokeAllForUser } from "@/server/auth/tokens";
import { findUserByEmail } from "@/server/users";
import { ResetPassword } from "@/server/validation";
import { logEvent, requestMeta } from "@/server/logs";

// POST /api/v1/auth/reset-password — { email, code, password }
// Sets the new password and signs the account out on every device.
export const POST = route(async (request) => {
  await rateLimit(`reset:ip:${clientIp(request)}`, { limit: 20, windowSeconds: 3600 });
  const { email, code, password } = await readJson(request, ResetPassword);
  await rateLimit(`reset:email:${email}`, { limit: 10, windowSeconds: 3600 });

  const user = await findUserByEmail(email);
  if (!user || user.status !== "active" || !(await consumeCode(user.id, "reset", code))) {
    logEvent(requestMeta(request), { category: "security", event: "password_reset_failed", userId: user?.id ?? null, email });
    throw new ApiError(400, "INVALID_CODE", "That code is wrong or has expired", {
      fields: { code: ["That code is wrong or has expired"] },
    });
  }

  // Receiving the code proves they own the email, so it counts as verified too.
  await query(
    "UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ?",
    [await hashPassword(password), user.id]
  );
  await revokeAllForUser(user.id);
  logEvent(requestMeta(request), {
    category: "security",
    event: "password_reset",
    userId: user.id,
    email: user.email,
    details: { signedOutEverywhere: true },
  });
  return ok({ message: "Password updated. Please sign in with your new password." });
});
