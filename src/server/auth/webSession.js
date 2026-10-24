import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { issueTokens, revokeFamilyOf, userIdForRefreshToken } from "@/server/auth/tokens";
import { findUserById } from "@/server/users";

// Cookie sign-in for the admin web panel. The cookie holds a refresh token
// (stored hashed in refresh_tokens like the app's), so deactivating a user
// or resetting their password signs the panel out too.

const COOKIE = "pf_admin";
const MAX_AGE = 30 * 24 * 60 * 60;

export async function startAdminSession(user, userAgent) {
  const { refreshToken } = await issueTokens(user, userAgent);
  (await cookies()).set(COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: MAX_AGE,
  });
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await revokeFamilyOf(token);
  store.delete({ name: COOKIE, path: "/admin" });
}

// The signed-in admin for this request, or null. Re-checked on every call,
// so losing the admin role takes effect immediately. Deliberately not wrapped
// in React cache(): sharing one lookup between the layout and a page makes
// Next.js treat the page's check as layout data that blocks navigation.
export async function getAdmin() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const userId = await userIdForRefreshToken(token);
  const user = userId ? await findUserById(userId) : null;
  return user && user.role === "admin" && user.status === "active" ? user : null;
}

// For admin pages and Server Actions: the admin, or a redirect to sign-in.
export async function requireAdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
