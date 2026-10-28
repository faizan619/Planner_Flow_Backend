import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { assertCodeCooldown, sendCode } from "@/server/auth/codes";
import { findUserByEmail } from "@/server/users";
import { EmailOnly } from "@/server/validation";
import { logEvent, requestMeta } from "@/server/logs";
import { idempotent, IDEMPOTENCY_TTL } from "@/server/idempotency";

// POST /api/v1/auth/forgot-password — { email }
// Emails a reset code. An email with no account gets 404 ACCOUNT_NOT_FOUND,
// so the app can send the person to sign up. That tells callers which emails
// are registered, so lookups are rate limited tightly per IP (hour and day)
// before the account is checked, and codes go out at most once a minute.
const handlePost = route(async (request) => {
  const ip = clientIp(request);
  await rateLimit(`forgot:ip:${ip}`, { limit: 5, windowSeconds: 3600 });
  await rateLimit(`forgot:ip-day:${ip}`, { limit: 20, windowSeconds: 24 * 3600 });
  const { email } = await readJson(request, EmailOnly);
  await rateLimit(`forgot:email:${email}`, { limit: 3, windowSeconds: 3600 });

  const user = await findUserByEmail(email);
  logEvent(requestMeta(request), {
    category: "security",
    event: "password_reset_requested",
    userId: user?.id ?? null,
    email,
    details: { accountFound: Boolean(user) },
  });
  if (!user) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "No account is registered with this email.");
  if (user.status !== "active") throw new ApiError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated");

  await assertCodeCooldown(user.id, "reset");
  await sendCode(user, "reset");
  return ok({ message: "A reset code is on its way to your email." });
});

// A retry with the same Idempotency-Key gets the same answer instead of running twice.
export const POST = idempotent(handlePost, { ttlSeconds: IDEMPOTENCY_TTL.default });
