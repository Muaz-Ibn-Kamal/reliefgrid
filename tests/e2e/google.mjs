// Google sign-in, end to end against `next dev` and a local fake Google (see GOOGLE_OAUTH_EMULATOR in src/lib/google.ts).
//   GOOGLE_CLIENT_ID=test-client GOOGLE_CLIENT_SECRET=test-secret GOOGLE_OAUTH_EMULATOR=http://127.0.0.1:3399 npx next dev -p 3300
//   BASE=http://localhost:3300 node tests/e2e/google.mjs
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SignJWT, exportJWK, generateKeyPair, importJWK } from "jose";

const BASE = process.env.BASE ?? "http://localhost:3300";
const PORT = 3399, CLIENT = "test-client", SECRET = "test-secret";
// The app caches Google's signing keys, so the fake Google keeps one key pair across runs (otherwise every run after the first would fail).
const KEYFILE = "/tmp/rg-google-test-key.json";
if (!existsSync(KEYFILE)) {
  const kp = await generateKeyPair("RS256", { extractable: true });
  writeFileSync(KEYFILE, JSON.stringify({ priv: await exportJWK(kp.privateKey), pub: await exportJWK(kp.publicKey) }));
}
const saved = JSON.parse(readFileSync(KEYFILE, "utf8"));
const privateKey = await importJWK(saved.priv, "RS256");
const jwk = { ...saved.pub, kid: "k1", alg: "RS256", use: "sig" };
const codes = new Map();
const b64 = (b) => b.toString("base64url");

const fake = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/certs") { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ keys: [jwk] })); }
  if (url.pathname === "/token" && req.method === "POST") {
    let raw = ""; for await (const c of req) raw += c;
    const f = new URLSearchParams(raw); const entry = codes.get(f.get("code"));
    const bad = (m) => { res.statusCode = 400; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: m })); };
    if (!entry) return bad("invalid_grant");
    codes.delete(f.get("code")); // single use, like Google
    if (f.get("client_id") !== CLIENT || f.get("client_secret") !== SECRET || f.get("grant_type") !== "authorization_code") return bad("invalid_client");
    if (f.get("redirect_uri") !== entry.redirect_uri) return bad("redirect_uri_mismatch");
    if (b64(createHash("sha256").update(f.get("code_verifier") ?? "").digest()) !== entry.challenge) return bad("pkce_failed");
    const claims = { email: entry.email, email_verified: entry.email_verified, name: entry.name, nonce: entry.nonce, ...entry.extra };
    const id_token = await new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(entry.iss).setAudience(entry.aud).setSubject("1234567890").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ id_token, access_token: "x", token_type: "Bearer" }));
  }
  res.statusCode = 404; res.end();
});
await new Promise((r) => fake.listen(PORT, "127.0.0.1", r));

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); };
const cookiesOf = (r) => r.headers.getSetCookie().map((c) => c.split(";")[0]);
const jar = (...r) => r.flatMap(cookiesOf).filter((c) => !/=$/.test(c)).join("; ");

/** Runs the whole browser dance with the fake Google. `tweak` changes what Google would say or what the browser sends. */
async function dance({ email, name = "Test Person", verified = true, aud = CLIENT, iss = "https://accounts.google.com", nonce, tamperState, dropCookie, forgeCookie, replay, challengeFor, extraCb = "" } = {}) {
  const start = await fetch(`${BASE}/api/auth/google`, { redirect: "manual" });
  const loc = new URL(start.headers.get("location"));
  const p = loc.searchParams;
  const code = "code-" + randomBytes(8).toString("hex");
  codes.set(code, { email, name, email_verified: verified, aud, iss, nonce: nonce ?? p.get("nonce"), challenge: challengeFor ?? p.get("code_challenge"), redirect_uri: p.get("redirect_uri"), extra: {} });
  const cookie = forgeCookie ?? (dropCookie ? "" : cookiesOf(start).find((c) => c.startsWith("rg_oauth=")));
  const cb = await fetch(`${BASE}/api/auth/google/callback?code=${code}&state=${tamperState ?? p.get("state")}${extraCb}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
  let again; if (replay) again = await fetch(`${BASE}/api/auth/google/callback?code=${code}&state=${p.get("state")}`, { redirect: "manual", headers: { cookie } });
  return { start, loc, cb, again, where: new URL(cb.headers.get("location"), BASE) };
}
const err = (r) => r.where.searchParams.get("error");

// 0. the start of the flow
const s0 = await fetch(`${BASE}/api/auth/google`, { redirect: "manual" });
const l0 = new URL(s0.headers.get("location")); const set0 = s0.headers.getSetCookie().find((c) => c.startsWith("rg_oauth=")) ?? "";
check("start redirects to Google with PKCE S256, state, nonce and openid scope", s0.status === 307 && l0.origin === `http://127.0.0.1:${PORT}` && l0.searchParams.get("code_challenge_method") === "S256" && l0.searchParams.get("state")?.length >= 30 && l0.searchParams.get("nonce")?.length >= 30 && l0.searchParams.get("scope") === "openid email profile" && l0.searchParams.get("client_id") === CLIENT && l0.searchParams.get("response_type") === "code");
check("state cookie is HttpOnly, SameSite=Lax, path-scoped, short-lived", /HttpOnly/i.test(set0) && /SameSite=lax/i.test(set0) && /Path=\/api\/auth\/google/i.test(set0) && /Max-Age=600/i.test(set0), set0);
check("the PKCE verifier never leaves the server (not in the Google URL)", ![...l0.searchParams.values()].some((v) => v.length >= 60));

// 1. new person -> VOLUNTEER account + session
const email = `google-${Date.now()}@example.com`;
const ok = await dance({ email, name: "Gina Test" });
check("callback signs a new person in and lands on the dashboard", ok.cb.status === 307 && ok.where.pathname === "/dashboard", ok.cb.headers.get("location"));
check("the one-time state cookie is cleared", ok.cb.headers.getSetCookie().some((c) => c.startsWith("rg_oauth=;") && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(c)), JSON.stringify(ok.cb.headers.getSetCookie()));
const me = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie: jar(ok.cb) } })).json();
check("new Google user is a VOLUNTEER with the name and email from Google", me.user?.role === "VOLUNTEER" && me.user?.email === email && me.user?.name === "Gina Test", JSON.stringify(me));
const again = await dance({ email, name: "Someone Else" });
const me2 = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie: jar(again.cb) } })).json();
check("signing in again reuses the same account (no duplicate, name unchanged)", me2.user?.id === me.user?.id && me2.user?.name === "Gina Test");

// 2. an existing account is matched by its verified email, and keeps its own role
const coord = await dance({ email: "coordinator@reliefgrid.demo" });
const meC = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie: jar(coord.cb) } })).json();
check("existing account (verified email) signs in as itself, role unchanged", meC.user?.role === "EMERGENCY_COORDINATOR", JSON.stringify(meC));

// 3. everything that must be refused
const refused = async (name, opts, reason) => { const r = await dance(opts); check(name, err(r) === reason && !cookiesOf(r.cb).some((c) => c.startsWith("rg_session=")), `${err(r)} / ${r.cb.headers.get("location")}`); return r; };
const e = () => `bad-${randomBytes(4).toString("hex")}@example.com`;
await refused("unverified Google email is refused", { email: e(), verified: false }, "google_unverified");
await refused("ID token with the wrong nonce is refused", { email: e(), nonce: "not-the-nonce" }, "google_token");
await refused("ID token issued to another client (wrong audience) is refused", { email: e(), aud: "someone-elses-client" }, "google_token");
await refused("ID token from another issuer is refused", { email: e(), iss: "https://evil.example" }, "google_token");
await refused("tampered state is refused", { email: e(), tamperState: "forged" }, "google_state");
await refused("callback without the state cookie is refused", { email: e(), dropCookie: true }, "google_expired");
await refused("cookie signed with a different secret is refused", { email: e(), forgeCookie: "rg_oauth=" + (await new SignJWT({ state: "x", nonce: "y", verifier: "z", ru: "q" }).setProtectedHeader({ alg: "HS256" }).setAudience("rg-oauth").setExpirationTime("10m").sign(new TextEncoder().encode("a-completely-different-secret-value-0123456789"))) }, "google_expired");
const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "volunteer@reliefgrid.demo", password: "ReliefGrid@2026" }) });
const sessionToken = cookiesOf(login).find((c) => c.startsWith("rg_session=")).split("=")[1];
await refused("a session cookie cannot stand in for the state cookie", { email: e(), forgeCookie: "rg_oauth=" + sessionToken }, "google_expired");
await refused("wrong PKCE verifier is refused by Google", { email: e(), challengeFor: b64(randomBytes(32)) }, "google_exchange");
const rp = await dance({ email: e(), replay: true }); check("an authorization code cannot be used twice", err({ where: new URL(rp.again.headers.get("location"), BASE) }) !== null && new URL(rp.again.headers.get("location"), BASE).pathname === "/login");
const den = await fetch(`${BASE}/api/auth/google/callback?error=access_denied&state=x`, { redirect: "manual" });
check("user pressing Cancel at Google returns to sign-in with a friendly reason", new URL(den.headers.get("location"), BASE).searchParams.get("error") === "google_denied");
const noargs = await fetch(`${BASE}/api/auth/google/callback`, { redirect: "manual" });
check("bare callback request does nothing harmful", new URL(noargs.headers.get("location"), BASE).pathname === "/login");

fake.close();
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
