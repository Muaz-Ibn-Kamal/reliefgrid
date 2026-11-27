import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, beginGoogleLogin, googleConfigured, type OAuthReason } from "@/lib/google";

const back = (req: NextRequest, reason: OAuthReason) => NextResponse.redirect(new URL(`/login?error=google_${reason}`, req.url));

/** Starts "Continue with Google": remembers state, nonce and PKCE verifier in a signed cookie, then sends the visitor to Google. */
export async function GET(req: NextRequest) {
  try {
    if (!googleConfigured()) return back(req, "unavailable");
    if (!(await rateLimit(`google-start:${clientIp(req)}`, 30, 10 * 60_000))) return back(req, "rate");
    const { url, cookie } = await beginGoogleLogin(req);
    const res = NextResponse.redirect(url);
    // Lax so the cookie comes back on Google's top-level redirect; scoped to this path so no other request carries it.
    res.cookies.set(OAUTH_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: OAUTH_COOKIE_PATH, maxAge: 600 });
    return res;
  } catch (e) {
    console.error("google sign-in start failed:", e instanceof Error ? e.message : "unknown error");
    return back(req, "failed");
  }
}
