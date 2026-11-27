import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";
import { clientIp } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, OAuthFailure, finishGoogleLogin, googleConfigured, type OAuthReason } from "@/lib/google";
import { userFromGoogleProfile } from "@/lib/services/google-auth";

/** Where every outcome ends: the dashboard on success, the sign-in page with a reason otherwise. The one-time cookie is always cleared. */
const done = (req: NextRequest, path: string) => {
  const res = NextResponse.redirect(new URL(path, req.url));
  res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: OAUTH_COOKIE_PATH, maxAge: 0, expires: new Date(0) });
  return res;
};
const fail = (req: NextRequest, reason: OAuthReason) => done(req, `/login?error=google_${reason}`);

export async function GET(req: NextRequest) {
  try {
    if (!googleConfigured()) return fail(req, "unavailable");
    if (!(await rateLimit(`google-cb:${clientIp(req)}`, 20, 10 * 60_000))) return fail(req, "rate");
    const profile = await finishGoogleLogin(req);
    const { user } = await userFromGoogleProfile(profile);
    await createSession(user.id, user.sessionVersion);
    return done(req, "/dashboard");
  } catch (e) {
    if (e instanceof OAuthFailure) return fail(req, e.reason);
    if (e instanceof ApiError) return fail(req, e.status === 403 ? "inactive" : "failed");
    console.error("google sign-in failed:", e instanceof Error ? e.message : "unknown error");
    return fail(req, "failed");
  }
}
