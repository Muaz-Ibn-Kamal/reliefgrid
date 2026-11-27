import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";

/**
 * "Continue with Google": OpenID Connect authorization-code flow with PKCE, a state value and a nonce.
 * Nothing here trusts the browser: the state, nonce and PKCE verifier live in a short-lived, signed, httpOnly cookie,
 * the code is exchanged server-to-server with the client secret, and the returned ID token is verified against Google's keys.
 */
export const OAUTH_COOKIE = "rg_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";

// GOOGLE_OAUTH_EMULATOR points the flow at a local fake Google for automated tests (tests/e2e/google.mjs). It is ignored in production builds.
const emulator = process.env.NODE_ENV !== "production" ? process.env.GOOGLE_OAUTH_EMULATOR : undefined;
const AUTH_URL = emulator ? `${emulator}/auth` : "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = emulator ? `${emulator}/token` : "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL(emulator ? `${emulator}/certs` : "https://www.googleapis.com/oauth2/v3/certs"));
const AUDIENCE = "rg-oauth"; // keeps these cookies and session cookies from ever being mistaken for each other

export type OAuthReason = "unavailable" | "denied" | "expired" | "state" | "exchange" | "token" | "unverified" | "inactive" | "rate" | "failed";
export class OAuthFailure extends Error {
  constructor(public reason: OAuthReason, detail?: string) {
    super(detail ?? reason);
  }
}

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const signingKey = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
};
const b64 = (b: Buffer) => b.toString("base64url");

/** The address Google sends the visitor back to. It must match one registered in the Google console exactly. */
export function redirectUri(req: NextRequest) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}${OAUTH_COOKIE_PATH}/callback`;
}

export async function beginGoogleLogin(req: NextRequest) {
  const state = b64(randomBytes(24));
  const nonce = b64(randomBytes(24));
  const verifier = b64(randomBytes(48));
  const ru = redirectUri(req);
  const cookie = await new SignJWT({ state, nonce, verifier, ru })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(signingKey());
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: ru,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: b64(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie };
}

export type GoogleProfile = { email: string; name: string | undefined };

export async function finishGoogleLogin(req: NextRequest): Promise<GoogleProfile> {
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) throw new OAuthFailure(sp.get("error") === "access_denied" ? "denied" : "failed");
  const code = sp.get("code");
  const state = sp.get("state");
  const token = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !token) throw new OAuthFailure("expired");

  let claims: { state?: string; nonce?: string; verifier?: string; ru?: string };
  try {
    claims = (await jwtVerify(token, signingKey(), { algorithms: ["HS256"], audience: AUDIENCE })).payload as typeof claims;
  } catch {
    throw new OAuthFailure("expired");
  }
  if (!claims.state || !claims.nonce || !claims.verifier || !claims.ru || claims.state !== state) throw new OAuthFailure("state");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: claims.ru,
      grant_type: "authorization_code",
      code_verifier: claims.verifier,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res || !res.ok) throw new OAuthFailure("exchange", `token endpoint answered ${res?.status ?? "no response"}`);
  const idToken = ((await res.json().catch(() => null)) as { id_token?: unknown } | null)?.id_token;
  if (typeof idToken !== "string") throw new OAuthFailure("exchange", "no id_token");

  let p: { email?: unknown; email_verified?: unknown; name?: unknown; nonce?: unknown };
  try {
    p = (
      await jwtVerify(idToken, JWKS, {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: process.env.GOOGLE_CLIENT_ID!,
      })
    ).payload as typeof p;
  } catch {
    throw new OAuthFailure("token");
  }
  if (p.nonce !== claims.nonce) throw new OAuthFailure("token", "nonce mismatch");
  if (typeof p.email !== "string" || !p.email) throw new OAuthFailure("token", "no email");
  if (p.email_verified !== true) throw new OAuthFailure("unverified");
  return { email: p.email.trim().toLowerCase(), name: typeof p.name === "string" ? p.name : undefined };
}
