import "server-only";
import { ApiError } from "@/server/http";
import { readAccessToken } from "@/server/auth/tokens";
import { findUserById } from "@/server/users";

// Returns the signed-in user for an API request, or throws 401/403.
// The user row is re-read on every request, so deactivating an account or
// resetting the password takes effect immediately instead of when the access
// token expires.
//
//   const user = await requireUser(request);
//   const admin = await requireUser(request, { role: "admin" });
export async function requireUser(request, { role } = {}) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const claims = token ? await readAccessToken(token) : null;
  if (!claims) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again");

  const user = await findUserById(claims.userId);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again");
  // Signed out everywhere (password reset, deactivation) after this token was issued.
  // JWT times are whole seconds, so compare in seconds: a sign-in in that same
  // second (e.g. right after a reset) stays valid.
  if (user.tokensValidAfter && claims.issuedAt < Math.floor(new Date(user.tokensValidAfter).getTime() / 1000)) {
    throw new ApiError(401, "UNAUTHORIZED", "Please sign in again");
  }
  if (user.status !== "active") throw new ApiError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated");
  if (role && user.role !== role) throw new ApiError(403, "FORBIDDEN", "You don't have access to this");
  return user;
}
