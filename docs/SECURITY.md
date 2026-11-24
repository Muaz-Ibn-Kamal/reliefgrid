# Security

## Reporting a vulnerability

Please don't open a public issue. Contact the maintainer (GitHub user Muaz-Ibn-Kamal) privately with the steps to reproduce, and allow time for a fix before disclosure.

## Security model

| Area | How ReliefGrid protects itself | Where |
|---|---|---|
| Authentication | bcrypt password hashes; a 7-day HS256 session token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. `AUTH_SECRET` must be at least 32 characters, with no fallback. Every request reloads the user, so deactivation and role changes apply at once. A password change bumps `sessionVersion`, which signs out every other session. | `src/lib/auth.ts` |
| Authorization | Each route has a role allow-list. The services check organization, ownership and assignment again, so a direct API call cannot skip a UI rule. An organization-bound account without an organization is refused rather than shown unfiltered data. | `src/lib/api.ts`, `src/lib/services/*`, `src/lib/scope.ts` |
| Input | Every body passes a Zod schema with length, range and array limits. Ids are capped at 64 characters. JSON bodies over 256 KB are refused before parsing. All SQL is parameterized (Prisma, or tagged `$queryRaw` templates). | `src/lib/validators.ts` |
| Browser | React escapes all output, and nothing renders user data as raw HTML. Headers: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`, images only from self and OpenStreetMap), HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP and CORP. | `next.config.ts` |
| CSRF | Every state-changing request must come from the same origin (checked for every route, including sign-in, sign-up, sign-out and the public form). The cookie is `SameSite=Lax`. | `assertSameOrigin` |
| Abuse limits | Rate limits are stored in Postgres, so every serverless instance shares them. Sign-in is limited per network and per network+email, with no per-account-only limit (that would let anyone lock an account). Registration, the public form (also capped platform-wide), uploads and live-update streams have their own limits. | `src/lib/ratelimit.ts` |
| Uploads | Only JPEG, PNG or WebP, verified by file signature (no SVG). 5 MB per file, 25 MB per account, 200 MB in total, 20 per hour. Served only to signed-in users with `nosniff` and a sandbox CSP. | `src/app/api/upload`, `src/lib/services/upload.ts` |
| Data integrity | Row-locked transactions and `CHECK` constraints mean stock can't go negative and a shelter can't exceed capacity. Distribution history is immutable (database trigger). Every state change is written to the activity log. | `prisma/migrations` |
| Secrets | Secrets live only in environment variables (Sensitive on Vercel). `.env*` is git-ignored, and a scan of the full git history found none. | `.gitignore` |
| Public demo | `DEMO_MODE=true` stops anyone from changing the passwords of the five shared demo accounts, or deactivating, re-roling or editing them. | `src/lib/demo.ts` |

## Audit, 25 November 2026

**Result:** 1 High, 5 Medium, 7 Low and 3 informational findings. Every High and Medium finding is fixed, proven on a local copy before and after the fix, and covered by a regression test. All Low findings are fixed except two, which are accepted or deferred with reasons below. `npm audit` now reports 0 vulnerabilities.

### Scope and method

- **Code:** all 36 API route handlers, the services, sessions, the proxy and the security headers. Also the dependencies and the full git history (6 commits) for secrets.
- **Production** (https://reliefgrid-dun.vercel.app), passive checks only:
  - response headers and cookie flags;
  - unauthenticated access;
  - read-only access probes with the demo accounts;
  - one rate-limit probe using an email that doesn't exist.
- **Proofs of concept:** run only against a local copy with the same code and data.
- **Tools:**
  - `npm audit`;
  - pattern-based secret scanning across git history (database URLs with passwords, cloud and GitHub tokens, private keys, JWTs);
  - a search for dangerous sinks (raw HTML, `eval`, unsafe SQL, server-side fetches, redirects);
  - manual review of every route;
  - curl and Playwright scripts.

### Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-01 | **High** (CVSS 7.1) | Anyone could lock reviewers out of the shared demo accounts | Fixed |
| F-02 | Medium (5.4) | A relief organization could move other organizations' volunteers into its own team | Fixed |
| F-03 | Medium (4.3) | A relief organization could read every team's members, including 66 volunteer phone numbers | Fixed |
| F-04 | Medium (6.5) | A session stayed valid for up to 7 days after a password change | Fixed |
| F-05 | Medium (6.5) | No upload quota: any self-registered account could fill the 0.5 GB database | Fixed |
| F-06 | Medium (5.3) | Rate limits lived in each server instance's memory, and sign-in was limited only per network+email | Fixed |
| F-07 | Low | Unbounded numbers, id strings, arrays and JSON bodies (500 errors, memory use) | Fixed |
| F-08 | Low | An organization user without an organization would get unfiltered results in three endpoints | Fixed |
| F-09 | Low | Admins could assign a non-manager to a shelter; users could be linked to a missing organization (500) | Fixed |
| F-10 | Low | Delivery QR tokens were cuid v1 ids, which are not cryptographically random | Fixed |
| F-11 | Low | Missing `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` | Fixed |
| F-12 | Low | No per-account limit on opening live-update streams | Fixed |
| F-13 | Low | `effect` ReDoS ([GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw)) and `deepmerge-ts` ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)) in the Prisma CLI | Fixed |
| F-14 | Low | The CSP allows inline scripts (`'unsafe-inline'`) | Accepted |
| F-15 | Info | Preview deployments use the production database | Recommendation |
| F-16 | Info | Registration says when an email is already registered | Accepted |
| F-17 | Info | Session verification did not pin the JWT algorithm | Hardened |

Fixed earlier the same day: sign-in, sign-up and sign-out did not check the request origin (commit `45be878`).

### F-01: Anyone could lock reviewers out of the shared demo accounts (High)

- **Where:** `src/app/api/profile/route.ts`, `src/app/api/users/[id]/route.ts`.
- **Issue:** The live demo lists five shared logins on its sign-in page. Any visitor could:
  - change a shared account's password; or
  - sign in as the admin and deactivate or re-role the other demo accounts.

  Either way, every reviewer loses access until the database is reseeded.
- **Proof:** On the local copy, the admin demo login deactivated `shelter@reliefgrid.demo`, whose sign-in then returned `401`.
- **Fix:** `DEMO_MODE=true` (set on the Vercel deployment) makes those changes return `403` for the five shared accounts. Admins can still manage every other user (`src/lib/demo.ts`, `src/lib/services/user.ts`).
- **Tests:** `security: a password change revokes other sessions; shared demo accounts are protected in demo mode`; `tests/e2e/security.py`.

### F-02: A relief organization could take other organizations' volunteers (Medium)

- **Where:** `POST /api/teams` (`memberIds`) and `PATCH /api/teams/:id` (`addMembers`).
- **Issue:** Neither checked whose volunteers were being moved. A relief-organization user could move any volunteer into its own team, which silently removed them from their existing team. That breaks the rule that organizations manage only their own records.
- **Proof:** On the local copy, the Coastal Relief Alliance user moved a Hillside Rescue Corps volunteer into its own team.
- **Fix:** Team logic moved into `src/lib/services/team.ts`. Every member id must exist (`400` otherwise). Relief organizations may only add volunteers from their own organization (`403`). Coordinators and admins can still staff across organizations.
- **Tests:** `security: relief orgs only see and staff their own teams`; `tests/e2e/security.py`.

### F-03: Volunteer phone numbers were visible to every relief organization (Medium)

- **Where:** `GET /api/teams`.
- **Issue:** For relief organizations the list was unfiltered, so they saw every team in every organization, with member ids and phone numbers.
- **Proof:** Read-only on production, the Coastal Relief Alliance account saw 12 teams across 5 organizations and 66 phone numbers.
- **Fix:** `teamScope` limits the list:
  - relief organizations see their own teams;
  - volunteers see their own team;
  - shelter managers see none;
  - coordinators and admins see all.
- **Tests:** as for F-02.

### F-04: Sessions survived a password change (Medium)

- **Where:** `src/lib/auth.ts`.
- **Issue:** Sessions are stateless 7-day tokens. A stolen session kept working after the owner changed their password.
- **Proof:** On the local copy, an older session still returned `200` after a password change.
- **Fix:**
  - Tokens now carry the user's `sessionVersion`.
  - A password change increments it, so older tokens get `401`, while the device that made the change is signed in again.
  - Verification is pinned to HS256.
- **Tests:** `security: a password change revokes other sessions…`; `tests/e2e/security.py`.

### F-05: No upload quota (Medium)

- **Where:** `POST /api/upload`.
- **Issue:** Images are stored in Postgres, and anyone can register a volunteer account. Nothing limited how much an account could store, so about 100 uploads of 5 MB would fill the free 0.5 GB database and take the site down.
- **Proof:** On the local copy, a freshly registered account uploaded 5 × 4 MB in seconds.
- **Fix:**
  - 20 uploads per hour, 25 MB per account, 200 MB in total (`src/lib/services/upload.ts`).
  - Bodies larger than the 5 MB limit are refused before they are buffered.
- **Tests:** `security: image uploads are rate limited and capped per account`.

### F-06: Rate limits did not survive scale-out (Medium)

- **Where:** `src/lib/ratelimit.ts`.
- **Issue:** The limiter was an in-memory map, so each serverless instance counted separately, and the limits stopped holding as traffic spread across instances. Sign-in was also limited only per network+email, so one network could try a password against many accounts.
- **Fix:** One atomic Postgres upsert per check, shared by all instances (`RateLimit` table). Limits:
  - sign-in: 30 per minute per network, plus 8 per minute per network+email;
  - registration: 10 per hour per network;
  - public form: 5 per 10 minutes per network, and 300 per hour platform-wide;
  - uploads and live streams: per account.

  There is deliberately no per-account-only lockout, because anyone could use it to lock a shared demo account.
- **Tests:** `security: the shared rate limiter counts across calls and resets after its window`; the sign-in probe in `tests/e2e/security.py`.

### Low and informational findings

- **F-07: unbounded input.**
  - Quantities, deltas, occupancy and affected population now have upper bounds below the database integer range.
  - Ids are capped at 64 characters and member arrays at 100.
  - JSON bodies are limited to 256 KB (`413`).
- **F-08: missing organization.**
  - `orgIdOf` refuses organization-bound users without an organization.
  - Admins can no longer make a relief-organization user without one.
- **F-09: integrity.**
  - Shelter manager reassignment requires an active shelter manager.
  - User creation and edits check that the organization exists.
- **F-10: QR tokens.** New delivery tokens are 18 random bytes (`crypto.randomBytes`, base64url).
- **F-11: headers.** COOP `same-origin` and CORP `same-origin` are added.
- **F-12: live streams.** Each account may open 60 live-update streams per 10 minutes. Tabs also close their stream while hidden or idle.
- **F-13: dependencies.** The advisories are in the Prisma CLI's config loader, which runs only at build time on trusted input. npm `overrides` pin the patched versions (`effect` 3.22.5, `deepmerge-ts` 8.0.2). Prisma validate, generate and migrate work as before.
- **F-14: inline scripts in the CSP (accepted).**
  - Next.js needs inline scripts for its page data. Removing `'unsafe-inline'` would need a per-request nonce, which turns off static prerendering for every page.
  - The risk is small: React escapes all output, no code renders user data as HTML, and the CSP still blocks plugins, framing, foreign forms and `<base>` hijacking.
  - Revisit if raw HTML rendering is ever added.
- **F-15: preview deployments use production data (recommendation).**
  - The Neon integration gives preview deployments the same database as production. Only the owner can push branches, so the exposure is limited.
  - For a team setting, enable Neon preview branches or give previews their own database.
- **F-16: registration reveals existing emails (accepted).** It says when an email is already registered. This is the usual trade-off for clear sign-up errors, and registration is rate-limited.
- **F-17: JWT algorithm (hardened).** `jose` already rejected unsigned tokens; verification now also names the algorithm.

### Controls verified as working

- Every API returns `401` without a session and `403` across roles; volunteers can't reach admin APIs.
- Organization isolation holds for resources, stock, allocations, deliveries and exports.
- Shelter managers can change only their own shelters; volunteers can change only their own tasks; completed tasks and distribution records are frozen.
- The cookie is `Secure; HttpOnly; SameSite=Lax`. Vercel overwrites `X-Forwarded-For`, so the client IP can't be spoofed there.
- CSV exports neutralize spreadsheet formulas. The activity export is admin-only. Exports leave out requester phone numbers and image links.
- There is no open redirect (sign-in always lands on `/dashboard`) and no server-side request forgery (the server never fetches user-supplied URLs).
- Upload type confusion is refused: SVG, and non-images claiming to be PNG.
- There are no secrets anywhere in git history.

### Recommendations

1. Re-enable the GitHub Actions workflow once the account's billing lock is cleared, and add `npm audit --omit=dev` and `tests/e2e/security.py` to it.
2. Give preview deployments their own database (F-15).
3. Before real use, add two-factor sign-in for admins and coordinators, and consider a shorter idle timeout.
4. The demo data can still be edited by visitors (that's the point of a demo). Reseed when needed, using the steps in the README deployment section.

### Re-testing

```bash
npm test                         # 20 integration tests, 7 of them for this audit
BASE_URL=http://localhost:3100 PSQL_URL=postgresql://postgres@localhost:5433/reliefgrid \
  python tests/e2e/security.py   # 21 checks against a local copy (start it with DEMO_MODE=true)
npm audit --omit=dev             # 0 vulnerabilities
```
