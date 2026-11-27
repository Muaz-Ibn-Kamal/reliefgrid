# ReliefGrid: Disaster Response & Resource Coordination Platform

ReliefGrid helps emergency coordinators, relief organizations, volunteers and shelter managers work together during floods, cyclones, earthquakes, fires, landslides and infrastructure failures. Incidents and emergency requests are prioritized automatically; stock is allocated to verified needs **without ever overselling**; shelters can never be filled beyond capacity; and every action is audited and pushed live to everyone's screens.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

Built with **Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Recharts · Leaflet**.

> **Live demo:** [reliefgrid-dun.vercel.app](https://reliefgrid-dun.vercel.app) · Demo logins for all five roles are listed [below](#demo-accounts).

![Emergency dashboard](docs/screenshots/dashboard.png)

## Demo accounts

All accounts use the password **`ReliefGrid@2026`**. The login page also has one-click buttons that fill these in.

| Role | Email | What to try |
|---|---|---|
| System Admin | `admin@reliefgrid.demo` | User Management (users, organizations, activity log), every page, CSV exports |
| Emergency Coordinator | `coordinator@reliefgrid.demo` | Verify a pending request → **Allocate resources** → follow its distribution; override an incident's priority; assign tasks; deploy teams |
| Relief Organization | `org@reliefgrid.demo` (Coastal Relief Alliance) | Register resources, restock or transfer stock, see your stock history, mark allocations in transit or delivered, verify deliveries by QR code |
| Volunteer | `volunteer@reliefgrid.demo` | **My Tasks**: start the assigned task, file a field report with a photo, complete the in-progress task; view your team |
| Shelter Manager | `shelter@reliefgrid.demo` | Update occupancy (try exceeding capacity), edit facilities, view the occupancy history chart and print the shelter report |

Citizens can request help without an account at **`/help`**.

## Features

| Area | What is implemented |
|---|---|
| **Roles and security** | 5 roles with per-endpoint role allow-lists, organization isolation, server-side page guards, bcrypt + signed `httpOnly` session cookie revoked on password change, Zod validation with size limits, same-origin CSRF check, rate limits shared across instances, upload quotas, CSP and security headers, full audit log ([security audit](docs/SECURITY.md)) |
| **Incidents** | Report with category, GPS ("use my location"), severity, location risk, affected population and photo; priority score and level; coordinator assignment; status workflow; manual priority override; complete change history |
| **Emergency requests** | 6 request types; staff form and public citizen form; **duplicate detection** (same type within ~1 km in 48 h, with explicit override); verify, reject, set urgency, complete |
| **Inventory** | Register resources; restock, adjust and transfer out; **append-only stock ledger** with running balance; low-stock and availability filters |
| **Allocation** | Allocate stock to verified requests within compatible categories in **one locked transaction**: never beyond available stock or remaining need, rolls back fully on failure, and failed attempts are audited. Distribution workflow (allocated → in transit → delivered or cancelled) with **immutable distribution records**, automatic stock return, and **QR-code delivery verification** |
| **Shelters** | Capacity, occupancy (absolute or ±), facilities, status (auto `FULL`), occupancy history chart, printable shelter report, **nearest available shelter** finder |
| **Volunteers and teams** | Self-registration, profiles and skills, availability, **skill and distance matching**, task assignment, team creation and deployment, task workflow with mandatory field report, photo uploads |
| **Prioritization** | Weighted 0–100 score from severity, affected people (log-scaled), urgency, location risk and time since report; CRITICAL/HIGH/MEDIUM/LOW; priority sorting and filters everywhere; every change logged |
| **Dashboard and reports** | KPI cards (active incidents, affected people, pending requests, stock, active shelters, volunteer availability, average response times); interactive charts (categories, priorities, 14-day request trend, distribution, stock, request status); reports page with CSV exports and print / save as PDF |
| **Map** | Leaflet + OpenStreetMap with incidents (colored by priority), shelters and verified requests, layer toggles, a priority filter, and click-to-find the nearest shelter with a route line |
| **Real-time** | Server-Sent Events push changes to every open page within about 3 seconds (Live indicator); in-app notifications; polling fallback |
| **UX** | Responsive (mobile navigation), dark mode, accessible forms (labels, field-level errors), loading, error (with retry), empty and success states everywhere, error boundaries |

| | |
|---|---|
| ![Incident detail](docs/screenshots/incident-detail.png) | ![Allocation with QR verification](docs/screenshots/allocation-qr.png) |
| ![Shelter occupancy history](docs/screenshots/shelter-detail.png) | ![Charts](docs/screenshots/dashboard-charts.png) |

## Architecture

```mermaid
flowchart LR
  B["Browser: React 19 pages, SWR cache"] -->|"HTTPS + session cookie"| P["proxy.ts: anonymous → /login"]
  P --> S["Server Components: guardPage(role)"]
  P --> R["Route Handlers: route() wrapper (auth, roles, same-origin, Zod, error mapping)"]
  R --> V["Service layer: business rules, transactions, audit log, notifications"]
  V --> O["Prisma 6 + pg driver adapter"]
  O --> D[("PostgreSQL: CHECK constraints, triggers, FKs, indexes")]
  B -.->|"EventSource /api/events"| E["SSE stream"]
  E -.->|"polls ActivityLog every 3 s"| D
```

Design decisions:
- **PostgreSQL + Prisma.** The core rules (no overselling, capacity limits, immutable distribution history) need real transactions, row locks and constraints. They are enforced in the database as well as in code (see [docs/DATABASE.md](docs/DATABASE.md)).
- **Service layer.** All business rules live in plain TypeScript services ([`src/lib/services`](src/lib/services)) called by thin route handlers. This keeps the rules testable and impossible to bypass from the UI.
- **Server Components for guarding and layout, client components for interactivity.** Data flows through SWR, so pages revalidate on focus, poll as a fallback, and update instantly from the SSE stream.
- **Images in Postgres.** Uploaded images are size-capped (5 MB) and kept in the database so the app runs on serverless hosts with read-only filesystems. They are only served to signed-in users.

More detail:
- [docs/DATABASE.md](docs/DATABASE.md): ER diagram, tables, constraints, indexes, migrations.
- [docs/API.md](docs/API.md): every endpoint with roles, parameters and errors.
- [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md): every rule, where it is enforced and which test proves it.
- [docs/SECURITY.md](docs/SECURITY.md): security model, audit findings and how each was fixed and re-tested.

## Project structure

```
prisma/              schema.prisma · migrations/ · seed.ts (realistic Bangladesh data)
src/
  app/
    (auth)/          login · register
    (app)/           dashboard · incidents (+ new, [id]) · requests · resources · allocations · shelters (+ [id])
                     volunteers · tasks · teams · map · reports · users · profile · error.tsx
    help/            public citizen request form
    api/             route handlers (see docs/API.md)
  components/        UI kit, paginated ListView, charts, forms, app shell, live updates
  lib/               auth, RBAC + page guard, route wrapper, validators, priority scoring, services/ (business logic)
  proxy.ts           redirects anonymous visitors (authorization happens in handlers)
tests/
  rules.test.ts      13 integration tests for the business rules (real PostgreSQL)
  e2e/               browser checks: 21 workflows, page sweep across all roles, real-time
docs/                DATABASE.md · API.md · BUSINESS_LOGIC.md · SECURITY.md · screenshots/
scripts/smoke.sh     curl smoke test: every page and key API for all 5 roles
```

## Getting started

**Requirements:** Node.js 22+ and PostgreSQL 14+ (local, Docker, or hosted such as Neon or Supabase).

```bash
git clone https://github.com/Muaz-Ibn-Kamal/reliefgrid.git && cd reliefgrid
npm install                      # also generates the Prisma client
cp .env.example .env             # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate               # apply migrations
npm run db:seed                  # load demo data (wipes existing data)
npm run dev                      # http://localhost:3000
```

No Postgres installed? Run one in Docker:

```bash
docker run -d --name reliefgrid-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=reliefgrid -p 5432:5432 postgres:16
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reliefgrid"
```

**Continue with Google (optional).** In Google Cloud Console, create an OAuth client of type *Web application* and add `http://localhost:3000/api/auth/google/callback` (and your deployed address plus `/api/auth/google/callback`) as authorized redirect URIs. Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The Google button appears on the sign-in and register pages only when both are set. People who sign in with Google for the first time get a volunteer account; staff roles are still assigned by a System Admin.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, or serve production |
| `npm run typecheck` | Generate route types + `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm test` | Business-rule integration tests (needs a **separate** test database, below) |
| `npm run test:migrate` | Apply migrations to the test database |
| `npm run db:migrate` / `db:seed` / `db:generate` | Migrate, seed, regenerate the Prisma client |

## Testing

A [GitHub Actions workflow](.github/workflows/ci.yml) runs typecheck, lint, the integration tests against PostgreSQL, a full seed and a production build.

**Integration tests (13).** These cover allocation limits and concurrency, rollback on failure, the immutable ledger, shelter capacity, priority scoring, duplicate detection and the verification workflow, volunteer task ownership, and organization scoping. They create their own fixtures, so they run against a separate database. They refuse to run against the seeded demo database.

```bash
echo 'DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/reliefgrid_test"' > .env.test   # see .env.test.example
npm run test:migrate && npm test
```

**Browser checks.** These use Python Playwright: `pip install playwright && playwright install chromium`, with `psql` on your PATH. Run them against a running server with freshly seeded demo data:

```bash
export BASE_URL=http://localhost:3000 PSQL_URL="postgresql://USER:PASSWORD@HOST:5432/reliefgrid"
python tests/e2e/page_sweep.py   # every page × every role: no JS errors, 5xx or error screens
python tests/e2e/workflows.py    # 21 end-to-end workflows with database assertions (reseed afterwards)
python tests/e2e/realtime.py     # one user's change appears on another user's screen via SSE
python tests/e2e/security.py     # 21 security regression checks from the audit (docs/SECURITY.md)
BASE=$BASE_URL ./scripts/smoke.sh
```

Last verified run:
- typecheck and lint: 0 errors
- production build: OK
- integration tests: 13/13
- page sweep: 0 errors across all five roles and the mobile public pages
- end-to-end workflows: 21/21
- real-time: a change reached another user's open page in 2.5 s
- schema drift (`prisma migrate diff`): none

## Deployment (Vercel + Neon)

The live demo runs on Vercel with its functions in Singapore (`sin1`, set in [`vercel.json`](vercel.json)), next to a Neon Postgres database in the same region, provisioned through the Vercel Marketplace. The GitHub repository is connected: every push to `main` deploys to production, and other branches get preview deployments.

To deploy your own copy with the [Vercel CLI](https://vercel.com/docs/cli):

1. **Link the project and add a database.** The Neon integration injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) into every environment:
   ```bash
   vercel link
   vercel integration add neon --meta region=sin1
   ```
2. **Add the session secret** (32+ characters) for production and preview, and turn on demo mode if the demo logins will be public:
   ```bash
   openssl rand -base64 32 | vercel env add AUTH_SECRET production --sensitive
   openssl rand -base64 32 | vercel env add AUTH_SECRET preview --sensitive
   vercel env add DEMO_MODE production --value true --yes
   ```
   Optional, for Google sign-in: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` the same way (Sensitive), with the production address plus `/api/auth/google/callback` registered in Google Cloud Console.
3. **Migrate and seed** once, using the direct connection string:
   ```bash
   DATABASE_URL="<DATABASE_URL_UNPOOLED>" npm run db:migrate
   DATABASE_URL="<DATABASE_URL_UNPOOLED>" npm run db:seed
   ```
4. **Deploy:** push to `main`, or run `vercel deploy --prod`. The default build (`prisma generate && next build`) needs no extra settings.

Production notes:
- Live updates and polling pause while a tab is hidden or idle for 10 minutes and catch up on return, so a forgotten tab doesn't hold a function open or keep the database awake.
- The SSE stream runs on the Node.js runtime and ends every 4 minutes; browsers reconnect automatically.
- Rate limits live in Postgres, so they hold across serverless instances without a separate Redis.
- `DEMO_MODE=true` stops visitors from changing the shared demo accounts' passwords or deactivating them.
- Images are stored in Postgres; for large volumes, move them to object storage.

## Requirement coverage

| Brief | Where |
|---|---|
| 5 roles and their capabilities | Role matrix in [BUSINESS_LOGIC.md §1](docs/BUSINESS_LOGIC.md#1-roles-and-access-control) |
| Incident, request, resource, allocation, shelter, volunteer/team, priority, dashboard modules | Pages under `src/app/(app)`, services under `src/lib/services` |
| Critical business rules, server-side | [BUSINESS_LOGIC.md §2–§8](docs/BUSINESS_LOGIC.md), each with its test |
| RBAC, multi-org, map, priority filtering, allocation validation, duplicate detection, real-time, search, server pagination, notifications, activity logs, export, responsive UI, all UI states | See Features above |
| Bonus | Real-time notifications, live map, nearest shelter, automatic priority scoring, volunteer matching, response-time analytics, QR delivery verification, PDF reports (print to PDF), dark mode |
| Minimum data | 5 orgs, 60 incidents, 138 requests, 24 shelters, 110 volunteers, 530 resources ([DATABASE.md](docs/DATABASE.md#sample-data)) |
| Database design, API docs, business-logic docs, demo credentials | `docs/` and above |

Not included: SMS/email notifications (in-app and live notifications only) and resource demand forecasting.

## Author

Built by [Muaz Ibn Kamal](https://github.com/Muaz-Ibn-Kamal).
