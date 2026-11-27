import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: redirects anonymous visitors to /login. Real authorization happens in every route handler and server layout.
 * A cookie can exist and still be invalid (revoked, expired account, data reseeded), so the proxy never sends a cookie holder away
 * from /login or /register: the server has the last word there (see the (auth) layout), which rules out a /login <-> /dashboard loop.
 */
export function proxy(req: NextRequest) {
  const has = req.cookies.has("rg_session");
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/login" || pathname === "/register" || pathname === "/help" || pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.startsWith("/uploads");
  if (!has && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (has && pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  return res;
}
// Static assets and the app icon skip the proxy, so the sign-in page can load its favicon before login.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
