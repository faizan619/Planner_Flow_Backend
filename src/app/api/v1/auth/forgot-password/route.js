import { clientIp, ok, readJson, route } from "@/server/http";
import { rateLimit } from "@/server/rateLimit";
import { sendCode } from "@/server/auth/codes";
import { findUserByEmail } from "@/server/users";
import { EmailOnly } from "@/server/validation";

// POST /api/v1/auth/forgot-password — { email }
// Emails a reset code. Always answers the same way, so it doesn't reveal
// which emails exist.
export const POST = route(async (request) => {
  await rateLimit(`forgot:ip:${clientIp(request)}`, { limit: 10, windowSeconds: 3600 });
  const { email } = await readJson(request, EmailOnly);
  await rateLimit(`forgot:email:${email}`, { limit: 3, windowSeconds: 3600 });

  const user = await findUserByEmail(email);
  if (user && user.status === "active") await sendCode(user, "reset");
  return ok({ message: "If an account exists for that email, a reset code is on its way." });
});
