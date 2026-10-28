import { isDuplicateKeyError } from "@/server/db";
import { ApiError, clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { hashPassword } from "@/server/auth/password";
import { sendCode } from "@/server/auth/codes";
import { createUser } from "@/server/users";
import { Signup } from "@/server/validation";
import { logEvent, requestMeta } from "@/server/logs";
import { idempotent, IDEMPOTENCY_TTL } from "@/server/idempotency";

// POST /api/v1/auth/signup — { name, email, password, timezone? }
// Creates an unverified account and emails a 6-digit code for /verify-email.
const handlePost = route(async (request) => {
  await rateLimit(`signup:ip:${clientIp(request)}`, { limit: 5, windowSeconds: 3600 });
  const body = await readJson(request, Signup);

  let user;
  try {
    user = await createUser({ ...body, passwordHash: await hashPassword(body.password) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists", {
        fields: { email: ["An account with this email already exists"] },
      });
    }
    throw error;
  }

  await sendCode(user, "verify");
  logEvent(requestMeta(request), { category: "security", event: "signup", userId: user.id, email: user.email });
  return ok({ email: user.email, verificationRequired: true }, 201);
});

// A retry with the same Idempotency-Key gets the same answer instead of running twice.
export const POST = idempotent(handlePost, { ttlSeconds: IDEMPOTENCY_TTL.default });
