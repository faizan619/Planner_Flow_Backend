import { clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { assertCodeCooldown, sendCode } from "@/server/auth/codes";
import { findUserByEmail } from "@/server/users";
import { EmailOnly } from "@/server/validation";
import { idempotent, IDEMPOTENCY_TTL } from "@/server/idempotency";

// POST /api/v1/auth/resend-code — { email }
// Always answers the same way, so it doesn't reveal which emails exist.
const handlePost = route(async (request) => {
  await rateLimit(`resend:ip:${clientIp(request)}`, { limit: 10, windowSeconds: 900 });
  const { email } = await readJson(request, EmailOnly);
  await rateLimit(`resend:email:${email}`, { limit: 3, windowSeconds: 900 });

  const user = await findUserByEmail(email);
  if (user && !user.emailVerifiedAt && user.status === "active") {
    await assertCodeCooldown(user.id, "verify"); // at most one code a minute
    await sendCode(user, "verify");
  }
  return ok({ message: "If that account needs verifying, a new code is on its way." });
});

// A retry with the same Idempotency-Key gets the same answer instead of running twice.
export const POST = idempotent(handlePost, { ttlSeconds: IDEMPOTENCY_TTL.default });
