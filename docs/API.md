# API Reference

All endpoints are Next.js Route Handlers under [`src/app/api`](../src/app/api). They accept and return JSON (except uploads, CSV exports, images and the event stream). Business rules behind each endpoint are described in [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md).

## Conventions

| Topic | Behavior |
|---|---|
| **Authentication** | `POST /api/auth/login` sets an `httpOnly` session cookie (`SameSite=Lax`, `Secure` in production, 7 days). Browsers send it automatically; scripts must keep a cookie jar. |
| **Authorization** | Each endpoint has a role allow-list (table below) plus organization, ownership or assignment checks inside the services. |
| **Not signed in** | `401 {"error": "Authentication required"}`. |
| **Wrong role or scope** | `403 {"error": "…"}`. |
| **CSRF** | State-changing requests (`POST`, `PATCH`, `DELETE`) must be same-origin: an `Origin` header from another host gets `403`. |
| **Validation** | Bodies are validated with Zod ([`src/lib/validators.ts`](../src/lib/validators.ts)). Failures return `400 {"error":"Validation failed","details":[{"path":"quantity","message":"…"}]}`. |
| **Business-rule violations** | `409 {"error": "Insufficient stock: only 40 packages available", "details": …}`. |
| **Not found** | `404 {"error": "…"}`. |
| **Unexpected errors** | `500 {"error": "Internal server error"}` (details are only logged on the server). |
| **Pagination** | List endpoints take `page` (from 1) and `pageSize` (default 20, max 100) and return `{"data": [...], "meta": {"page", "pageSize", "total", "totalPages"}}`. |
| **Sorting** | Incidents and requests default to priority (highest first); `sort=newest` (and `sort=affected` for incidents) are available. |
| **Rate limits** | Login: 8 attempts per minute per IP and email. Public help requests: 5 per 10 minutes per IP. Exceeding either returns `429`. |

Role abbreviations: **ADM** System Admin · **CRD** Emergency Coordinator · **ORG** Relief Organization · **VOL** Volunteer · **SHM** Shelter Manager · **any** any signed-in user · **public** no sign-in.

## Endpoints

### Authentication and profile

| Method & path | Roles | Description |
|---|---|---|
| `POST /api/auth/login` | public | Body `{email, password}`. Sets the session cookie; returns `{user: {id, name, role}}`. Rate-limited. |
| `POST /api/auth/register` | public | Self-registration as a **volunteer**: `{name, email, password (≥8), phone?, skills?: string[]}`. Other roles are created by an admin. |
| `POST /api/auth/logout` | any | Clears the session cookie. |
| `GET /api/auth/me` | any | Current user with organization, plus the unread notification count: `{user: {id, name, email, role, organizationId, organization}, unread}`. |
| `GET /api/profile` | any | Profile with organization, volunteer skills, availability and team. |
| `PATCH /api/profile` | any | `{name?, phone?, currentPassword + newPassword?, availability?, skills?}` (availability and skills only for volunteers). Changing the password requires the current one. |

### Incidents

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/incidents` | any | Paginated. Filters: `q` (title, description, location), `category`, `status`, `priority`, `open=1` (excludes resolved and closed), `sort`. Volunteers only see incidents linked to their tasks. |
| `POST /api/incidents` | ADM, CRD, ORG, SHM | `{title, description, category, location, latitude, longitude, severity 1–5, locationRisk? 1–5, affectedPopulation, imageUrl?}`. The server computes priority, logs `INCIDENT_REPORTED` and notifies coordinators. |
| `GET /api/incidents/:id` | any | Incident with coordinator, reporter, linked requests, tasks, deployed teams and `history` (activity timeline). Volunteers: only incidents of their own tasks. |
| `PATCH /api/incidents/:id` | ADM, CRD | `{status?, severity?, locationRisk?, affectedPopulation?, coordinatorId?, priorityOverride?: LOW/MEDIUM/HIGH/CRITICAL or null, note?}`. Rescores, logs every change (including `PRIORITY_CHANGED`) and notifies a newly assigned coordinator. |
| `POST /api/priority/recalculate` | ADM, CRD | Rescores all open incidents and requests (scores rise with age) and logs every level change. |

### Emergency requests

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/requests` | ADM, CRD, ORG | Paginated. Filters: `q` (description, location, requester), `type`, `status`, `priority`, `incidentId`, `sort`. Each row includes `allocatedQty`. |
| `POST /api/requests` | ADM, CRD, ORG | `{type, quantity, unit?, location, latitude, longitude, urgency 1–5, affectedPeople, description, requesterName, requesterContact?, incidentId?, force?}`. **Duplicate check:** an open request of the same type within ~1 km in the last 48 h returns `409` with `details.duplicates[]`; resend with `force: true` if the need is distinct. |
| `POST /api/public/requests` | public | Citizen form: same body without `incidentId` or `force`. Rate-limited; duplicates always return `409`. Returns `201 {id, status, message}`. |
| `GET /api/requests/:id` | ADM, CRD, ORG | Request with incident, allocations and `history`. |
| `PATCH /api/requests/:id` | ADM, CRD | Review: `{action: "VERIFY"}`, `{action: "REJECT", reason}`, `{action: "SET_URGENCY", urgency}` (rescores) or `{action: "COMPLETE"}`. |

### Resources and inventory

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/resources` | ADM, CRD, ORG | Paginated inventory. Filters: `q`, `category`, `organizationId` (ADM/CRD), `available=1` (quantity > 0), `lowStock=1`. Relief organizations only ever see their own stock. |
| `POST /api/resources` | ADM, ORG | `{name, category, unit, quantity, storageLocation, organizationId? (ADM only)}`. Writes a `REGISTER` ledger entry. |
| `GET /api/resources/:id` | ADM, CRD, ORG (own) | Resource with its organization and stock ledger (`movements`: type, delta, balanceAfter, reason, from/to location, user, time). |
| `PATCH /api/resources/:id` | ADM, ORG (own) | `{name?, storageLocation?}`. |
| `POST /api/resources/:id/stock` | ADM, ORG (own) | `{type: "RESTOCK" \| "ADJUST" \| "TRANSFER_OUT", delta (≠0), reason?, toLocation?}`. Results below zero are rejected (`409`); every change is written to the ledger. |

### Allocation and distribution

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/allocations` | ADM, CRD, ORG (own) | Paginated history with request, resource, organization and distribution records. Filters: `status`, `requestId`. |
| `POST /api/allocations` | ADM, CRD | `{requestId, resourceId, quantity, notes?}`. Runs in one transaction; see the rules in BUSINESS_LOGIC.md §3. Errors: `409` unverified request, insufficient stock, or more than the remaining need; `400` incompatible category. |
| `PATCH /api/allocations/:id` | ADM, CRD, ORG (own) | Distribution update `{status: "IN_TRANSIT" \| "DELIVERED" \| "CANCELLED", deliveredQty?, notes?}`. Appends an immutable distribution record; returns stock on cancellation or partial delivery. |
| `GET /api/allocations/verify?token=` | ADM, CRD, ORG (own) | Allocation summary and QR code image for a token. |
| `POST /api/allocations/verify` | ADM, CRD, ORG | `{token}` (the `reliefgrid:` prefix is optional). Marks the allocation delivered ("Verified by QR scan"). |

### Shelters

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/shelters` | ADM, CRD, ORG, SHM | Paginated, with computed `availableCapacity`. Filters: `q`, `status`, `mine=1` (a manager's own shelters). |
| `POST /api/shelters` | ADM, CRD, SHM | `{name, location, latitude, longitude, totalCapacity, occupancy?, facilities?: string[], managerId?, organizationId?}`. Occupancy above capacity is rejected. |
| `GET /api/shelters/:id` | ADM, CRD, ORG, SHM | Shelter with manager and `occupancyLogs` (history). |
| `PATCH /api/shelters/:id` | ADM, SHM (own) | `{name?, location?, totalCapacity? (not below occupancy), facilities?, status?, managerId? (ADM)}`. |
| `POST /api/shelters/:id/occupancy` | ADM, SHM (own) | Exactly one of `{occupancy}` (absolute) or `{delta}` (±), plus `note?`. `409` if the result is above capacity or below 0; every change is logged. |
| `GET /api/shelters/nearest?lat=&lng=&people=` | ADM, CRD, ORG, SHM | Open shelters with at least `people` free places, nearest first, with `distanceKm`. |

### Volunteers, tasks and teams

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/volunteers` | ADM, CRD | Paginated volunteer profiles. Filters: `q`, `availability`, `skill`, `teamId`. |
| `GET /api/volunteers/match?lat=&lng=&skills=` | ADM, CRD | Available volunteers ranked by skill match and distance (comma-separated `skills`). |
| `GET /api/tasks` | ADM, CRD, VOL | Paginated tasks with incident, team (with members) and field reports. Volunteers get only their own. Filters: `status`, `incidentId`. |
| `POST /api/tasks` | ADM, CRD | `{title, description?, location, latitude, longitude, incidentId?, requestId?, volunteerId?, teamId?}` (a volunteer or a team is required). Notifies the volunteer. |
| `PATCH /api/tasks/:id` | VOL (assignee) | `{status: "IN_PROGRESS" \| "COMPLETED", report?, photoUrl?}`. Completing requires a field report. Completed tasks are frozen (`409`). |
| `DELETE /api/tasks/:id` | ADM, CRD | Cancels the task (its reports are kept). |
| `POST /api/tasks/:id/reports` | VOL (assignee) | Field report `{content, photoUrl?}`. |
| `GET /api/teams` | any | Teams with members, organization and deployment. Volunteers see only teams they belong to; shelter managers see none. |
| `POST /api/teams` | ADM, CRD, ORG | `{name, organizationId?, memberIds?}` (relief organizations always create teams in their own organization). |
| `PATCH /api/teams/:id` | ADM, CRD, ORG (own team) | `{name?, addMembers?, removeMembers?, deployToIncidentId? (ADM/CRD; null recalls the team)}`. |

### Uploads

| Method & path | Roles | Description |
|---|---|---|
| `POST /api/upload` | any | `multipart/form-data` with `file` (JPEG, PNG or WebP; at most 5 MB; checked by content signature). Returns `{url: "/api/uploads/<id>"}`, to be passed as `imageUrl` or `photoUrl`. |
| `GET /api/uploads/:id` | any | The image bytes (`Cache-Control: private`, `nosniff`, sandboxed). |

### Dashboard, reports, notifications, live updates

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/analytics/dashboard` | any | KPIs (active incidents, affected people, pending requests, available units, shelter occupancy, volunteer availability, average incident and request response time) and chart series (incident categories, priority mix, 14-day request trend, distribution by category, stock by category, request status), top-priority incidents, plus role-specific extras (`me`). |
| `GET /api/export/:entity` | ADM, CRD, ORG | CSV download. `incidents`, `shelters`: ADM and CRD. `requests`: all three (requester contact removed). `resources`, `allocations`: organizations get only their own rows. `activity`: ADM only. |
| `GET /api/activity` | ADM, CRD | Paginated audit log. Filters: `action` (contains), `entityType`, `entityId`. |
| `GET /api/notifications` | any | `{items: [...], unread}` for the current user. |
| `PATCH /api/notifications` | any | `{ids: [...]}` marks those read; `{}` marks all read. |
| `GET /api/events` | any | **Server-Sent Events.** Sends `ready`, then `change` events `{"entities": ["EmergencyRequest", …]}` within about 3 s of any change, plus keep-alives. No record data is sent; clients refetch through the endpoints above. Streams end after 4 minutes and the browser reconnects automatically. |
| `GET /api/lookups?type=` | any | Small option lists for forms: `incidents`, `organizations`, `coordinators`, `shelterManagers`, `teams`, `volunteers`, `requests` (verified or assigned requests, highest priority first; ADM and CRD only). |

### Administration

| Method & path | Roles | Description |
|---|---|---|
| `GET /api/users` | ADM | Paginated users. Filters: `q`, `role`, `organizationId`. |
| `POST /api/users` | ADM | `{name, email, password, role, organizationId?}` (relief-organization users require an organization; volunteers get a profile). |
| `PATCH /api/users/:id` | ADM | `{name?, role?, organizationId?, active?}`. Admins cannot deactivate or demote themselves. |
| `GET /api/organizations` | ADM, CRD | Organizations with counts of users, resources and shelters. |
| `POST /api/organizations` | ADM | `{name, type, region, contact?}`. |
| `PATCH /api/organizations/:id` | ADM | `{name?, type?, region?, contact?, active?}`. Deactivating an organization blocks allocations from its stock. |

## Examples

These use `curl` with a cookie jar. Replace `BASE` with your URL.

```bash
BASE=http://localhost:3000; J=$(mktemp)

# Sign in as the coordinator
curl -s -c $J -H 'Content-Type: application/json' \
  -d '{"email":"coordinator@reliefgrid.demo","password":"ReliefGrid@2026"}' $BASE/api/auth/login

# Highest-priority pending requests
curl -s -b $J "$BASE/api/requests?status=PENDING&pageSize=5"

# Submit a request; a second identical one returns 409 with details.duplicates
curl -s -b $J -H 'Content-Type: application/json' -d '{"type":"WATER","quantity":500,"unit":"litres",
  "location":"Char Fasson","latitude":22.18,"longitude":90.76,"urgency":4,"affectedPeople":120,
  "description":"Tube wells flooded","requesterName":"Union council"}' $BASE/api/requests

# Verify it, then allocate stock (409 if stock or remaining need is insufficient)
curl -s -b $J -X PATCH -H 'Content-Type: application/json' -d '{"action":"VERIFY"}' $BASE/api/requests/<requestId>
curl -s -b $J -H 'Content-Type: application/json' \
  -d '{"requestId":"<requestId>","resourceId":"<resourceId>","quantity":200}' $BASE/api/allocations

# Watch live changes (Ctrl+C to stop)
curl -N -b $J $BASE/api/events
```

Example `409` (insufficient stock):

```json
{ "error": "Insufficient stock: only 40 litres available" }
```

Example `400` (validation):

```json
{ "error": "Validation failed", "details": [{ "path": "latitude", "message": "Too big: expected number to be <=90" }] }
```
