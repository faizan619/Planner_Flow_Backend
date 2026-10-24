import { NextResponse } from "next/server";

// Sends signed-out visitors of the admin panel to the sign-in page before
// any page renders. This only looks for the session cookie; whether it is
// valid and belongs to an admin is checked on the server by every admin page
// and Server Action (src/server/auth/webSession.js).
export function proxy(request) {
  if (request.cookies.has("pf_admin")) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  // Everything under /admin except the sign-in page itself.
  matcher: ["/admin", "/admin/((?!login).*)"],
};
