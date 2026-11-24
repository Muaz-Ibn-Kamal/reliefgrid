# Business Logic

This document lists every business rule, **where it is enforced** and **which test proves it**. All rules are enforced on the server: in services under [`src/lib/services`](../src/lib/services), in route handlers under [`src/app/api`](../src/app/api), and, where possible, by database constraints (see [DATABASE.md](DATABASE.md)). The UI repeats the main checks for fast feedback, but **never** relies on them.

Tests:
- `npm test` runs 13 integration tests ([`tests/rules.test.ts`](../tests/rules.test.ts)) against a real PostgreSQL database.
- [`tests/e2e/workflows.py`](../tests/e2e/workflows.py) drives 21 workflows through the real UI in Chromium and checks the database after each step.

---

## 1. Roles and access control

Every API route declares the roles allowed to call it (`route({ roles: [...] })` in [`src/lib/api.ts`](../src/lib/api.ts)). On each request the session is re-checked against the database, so deactivating a user or changing their role takes effect immediately. Pages also check access on the server (`guardPage`) and redirect before rendering anything.

| Capability | Admin | Coordinator | Relief org | Volunteer | Shelter mgr |
|---|:-:|:-:|:-:|:-:|:-:|
| Manage users and organizations | ✔ | | | | |
| View activity log | ✔ | ✔ | | | |
| Report incidents | ✔ | ✔ | ✔ | | ✔ |
| Verify, prioritize and assign incidents | ✔ | ✔ | | | |
| View incidents | all | all | all | only incidents of their tasks | all |
| Submit emergency requests | ✔ | ✔ | ✔ | | |
| Review requests (verify / reject / urgency / complete) | ✔ | ✔ | | | |
| Register resources, adjust stock | ✔ | | own org | | |
| View inventory | all | all | own org | | |
| Allocate resources to requests | ✔ | ✔ | | | |
| Update distribution status | ✔ | ✔ | own org | | |
| Register shelters | ✔ | ✔ | | | ✔ |
| Update shelter info and occupancy | ✔ | | | | own shelters |
| Assign tasks, view volunteers, availability matching | ✔ | ✔ | | | |
| Update task status, file field reports | | | | own tasks | |
| Create teams | ✔ | ✔ | own org | | |
| Deploy teams to incidents | ✔ | ✔ | | | |
| CSV export | all | all except activity | requests, own resources, own allocations | | |

Citizens can also submit help requests **without an account** at `/help`. That endpoint is rate-limited, cannot link incidents and cannot bypass duplicate detection.

## 2. Multi-organization isolation

| Rule | Enforcement | Proof |
|---|---|---|
| Organizations manage only their own resources | `GET /api/resources` forces `organizationId = user.organizationId` for relief-organization users. Stock changes call `adjustStock`, which rejects other organizations' resources. | `stock: org can adjust only own resources…`; E2E "Relief org cannot change another org's stock" |
| New resources belong to the creator's organization | `POST /api/resources` ignores any `organizationId` a relief-organization user sends. | E2E "Relief org registers resource (bound to own org)" |
| Organizations see and update only their own allocations | Allocation list filtered by organization; `updateDistribution` checks ownership. | `allocation: only coordinators/admins allocate; orgs only update their own distributions` |
| Organizations edit only their own teams and cannot deploy teams | Checked in `PATCH /api/teams/:id`. | |
| Shelter managers manage only their assigned shelters | `assertShelterAccess` in the shelter service. | `shelter: …` test |
| Admins see everything; coordinators run cross-organization operations | Role checks above. | |
| Inactive organizations' stock cannot be allocated | Checked inside the allocation transaction. | |

## 3. Resource allocation

Implemented in `allocate()` in [`src/lib/services/allocation.ts`](../src/lib/services/allocation.ts) as **one database transaction**:

1. Lock the request row (`SELECT … FOR UPDATE`). This serializes concurrent allocations to the same request.
2. The request must be `VERIFIED` or `ASSIGNED`.
3. The resource must exist, belong to an active organization, and its category must be able to satisfy the request type (e.g. a `WATER` request can draw on `WATER` stock).
4. The quantity must not exceed the request's **remaining need** (requested minus non-cancelled allocations).
5. Decrement stock with a guarded update: `UPDATE "Resource" SET quantity = quantity - n WHERE id = … AND quantity >= n RETURNING quantity`. If no row comes back, stock was insufficient and the transaction aborts. The `CHECK (quantity >= 0)` constraint is a second line of defense.
6. In the same transaction: create the allocation; write a stock-ledger entry (`ALLOCATE`, with `balanceAfter`); write the first distribution record; set the request to `ASSIGNED` and stamp `firstResponseAt`; log the activity; notify the responsible organization.

| Mandatory rule | How it holds | Proof |
|---|---|---|
| A resource cannot be allocated beyond its available quantity | Guarded `UPDATE … WHERE quantity >= n` + `CHECK` constraint; concurrent requests are serialized | `allocation: cannot exceed available stock…`, `allocation: concurrent allocations can never oversell stock`; E2E "Over-allocation rejected by server" |
| Stock updates automatically after a successful allocation | Same transaction as the allocation | `allocation: success decrements stock…`; E2E checks the exact decrement |
| Failed allocations do not modify inventory | Any error rolls the whole transaction back. The failed attempt is then logged (`ALLOCATION_REJECTED`) outside the transaction for auditing | `allocation: cannot exceed available stock; failure leaves inventory untouched and is logged` |
| Every allocation has a recorded history | Stock-ledger entry + distribution record + activity log written in the same transaction | `allocation: success … writes movement + distribution history` |
| Completed distribution records are preserved | Database trigger blocks `UPDATE`/`DELETE` on `DistributionRecord`; status changes **append** new records | `distribution ledger is immutable at the database level` |

### Distribution state machine

```
ALLOCATED ──► IN_TRANSIT ──► DELIVERED
    │              │
    ├──────────────┴──► CANCELLED      (DELIVERED and CANCELLED are final)
    └──────────────────► DELIVERED
```

- **Cancelled**: the full quantity goes back to stock, recorded in the ledger as `RELEASE`.
- **Delivered with less than allocated**: the undelivered remainder goes back to stock, recorded as `RELEASE`.
- **Request completion**: as soon as delivered quantities cover the requested quantity, the request becomes `COMPLETED`. If every allocation is cancelled before anything is delivered, the request returns to `VERIFIED` so it can be allocated again.
- **QR verification**: each allocation has a random `qrToken`, shown as a QR code (and as copyable text). Scanning or pasting it at delivery calls `POST /api/allocations/verify`, which marks the allocation `DELIVERED` with the note "Verified by QR scan".

Proof: `allocation: cancelling restores stock via ledger`; E2E "Distribution update + QR delivery verification".

## 4. Shelter capacity

`setOccupancy()` in [`src/lib/services/shelter.ts`](../src/lib/services/shelter.ts) locks the shelter row, then:

| Mandatory rule | How it holds | Proof |
|---|---|---|
| New occupancy never exceeds available capacity | Rejected with HTTP 409 if `next > totalCapacity`; database `CHECK (occupancy BETWEEN 0 AND totalCapacity)` as backstop. Capacity cannot be lowered below current occupancy. Closed shelters cannot admit more people. | `shelter: occupancy never exceeds capacity…`; E2E UI block + server block |
| Available capacity updates automatically | Never stored: always `totalCapacity - occupancy` | E2E "occupancy update recalculates availability" |
| Occupancy history is maintained | A `ShelterOccupancyLog` row (previous, current, capacity, note, user) is written in the same transaction | `shelter: … history kept, concurrent-safe` |

Updates accept either an absolute count or a `+/-` change. Status follows occupancy automatically: `FULL` when occupancy reaches capacity, `OPEN` otherwise, unless a manager has `CLOSED` the shelter. **Nearest available shelter** (`GET /api/shelters/nearest`) ranks `OPEN` shelters with at least the requested number of free places by great-circle (haversine) distance.

## 5. Emergency prioritization

Scores are pure functions in [`src/lib/priority.ts`](../src/lib/priority.ts) on a 0–100 scale:

```
Incident = 35·severity + 30·affected + 20·locationRisk + 15·age
Request  = 30·urgency + 15·incidentSeverity + 25·affected + 15·locationRisk + 15·age
```

Each factor is first normalized to the range 0–1:
- **severity, urgency, location risk** (1–5): `(v − 1) / 4`.
- **affected people**: log-scaled, `log10(n + 1) / log10(10 001)`, reaching 1 at 10,000 people. This way 50 vs 500 people matters as much as 5,000 vs 50,000.
- **age**: hours since reported ÷ 72, capped at 1. Unattended items rise in the queue over three days.

For requests, `incidentSeverity` and `locationRisk` come from the linked incident. Without one, the request's urgency stands in for incident severity, and location risk defaults to 3.

| Score | Level |
|---|---|
| ≥ 75 | CRITICAL |
| ≥ 55 | HIGH |
| ≥ 35 | MEDIUM |
| < 35 | LOW |

| Mandatory rule | How it holds | Proof |
|---|---|---|
| Incidents and requests are sorted by priority | Lists default to `priorityScore DESC` (index `(status, priorityScore)`); filters by priority level; dashboard and map show critical items first | `priority: higher severity / affected / urgency / age raise score…` |
| Critical incidents get more attention | Red badges and highlighted rows, a top-priority list on the dashboard, larger map markers, and notifications to coordinators for new incidents and requests | UI |
| Priority changes are recorded in activity history | Every score or level change, and every manual override, writes an `ActivityLog` entry (old → new), shown on the incident timeline | `priority: … changes are logged`; E2E "Priority override recorded in activity history" |

Coordinators can **override** an incident's level (with a note), and can clear the override to return to the calculated level. Because scores depend on age, `POST /api/priority/recalculate` rescores all open incidents and requests and logs every level change.

## 6. Emergency requests and duplicate detection

**Request workflow:** `PENDING → VERIFIED → ASSIGNED → COMPLETED`. Requests can also be rejected (with a required reason). Coordinators can change urgency at any open stage; the request is then rescored.

**Duplicate detection:** before saving, `findDuplicates()` looks for an **open** request (pending, verified or assigned) of the **same type**, created in the **last 48 hours**, within **about 1 km** (±0.01° latitude and longitude), and from the same incident when one is given.
- If any match, the API returns `409` with the possible duplicates.
- Staff can review them and resubmit with `force: true` if it really is a different need.
- The public endpoint never allows `force`, so citizens are told help may already be on the way.

Proof: `requests: duplicate detection + verification workflow`; E2E for both the staff and public flows.

## 7. Incidents

**Status flow:** `REPORTED → VERIFIED → IN_PROGRESS → RESOLVED → CLOSED`. Coordinators and admins change status, severity, location risk, affected population, coordinator assignment and priority override. Each change is logged, and the priority is recalculated.

**Response-time analytics:**
- `firstResponseAt` is stamped the first time an incident leaves `REPORTED` or gets a coordinator.
- `resolvedAt` is stamped on resolve or close.
- The dashboard's average response times come from these timestamps.

Volunteers see only incidents connected to their own tasks.

## 8. Volunteers, tasks and teams

| Mandatory rule | How it holds | Proof |
|---|---|---|
| Volunteers can only update their assigned tasks | `updateTask` and `submitFieldReport` require the caller to be the assigned volunteer (403 otherwise). The task routes only allow the volunteer role. | `volunteers: only the assignee updates a task…`; E2E "Volunteer cannot touch others' tasks" |
| Unauthorized users cannot modify volunteer assignments | Only admins and coordinators create, reassign or cancel tasks and change team membership; organizations manage only their own teams | Route role gates |
| Completed tasks keep their field reports and history | Completed and cancelled tasks reject all changes (409); reports are never deleted | `volunteers: … completed tasks are frozen and keep reports` |

Further rules:
- **Task flow:** `ASSIGNED → IN_PROGRESS → COMPLETED`. Completion **requires a field report** (an earlier one, or one submitted with the completion). Coordinators can cancel a task.
- **Assignment:** unavailable or inactive volunteers cannot be assigned. A volunteer with open tasks is shown as `DEPLOYED`.
- **Availability matching** (`GET /api/volunteers/match`): ranks available volunteers by `3 × (matching skills) − distanceKm / 25`, so one matching skill is worth about 75 km of travel.
- **Field reports** can include a photo (JPEG, PNG or WebP, up to 5 MB). The server checks the file's actual content signature, not just the declared type.

## 9. Notifications, activity log and real-time updates

**Notifications** are written in the same transaction as the event that triggers them:

| Event | Who is notified |
|---|---|
| New incident | Coordinators and admins |
| New request | Coordinators |
| Incident assigned | The assigned coordinator |
| New allocation | The responsible organization |
| Task assigned | The volunteer |

The header bell shows an unread count; notifications can be marked read one at a time or all at once.

**Activity log:** every state change writes an `ActivityLog` row (user, action, entity, JSON details). Admins and coordinators can browse it with filters and pagination; admins can also export it.

**Real-time updates:**
- `GET /api/events` is a Server-Sent Events stream. Every 3 seconds it checks the activity log for new entries and pushes a `change` event listing the affected entity types; it never sends record data.
- Each open page revalidates just the affected queries. For example, a verified request updates other users' request lists and dashboards within about 3 seconds (verified with two browsers in `tests/e2e/realtime.py`).
- Polling (15–30 s) and refetch-on-focus remain as fallbacks.
- The header shows a **Live** indicator.

## 10. Security controls

| Concern | Control |
|---|---|
| Authentication | bcrypt password hashes (cost 10); HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), 7-day expiry; the user is reloaded from the database on every request |
| Authorization | Per-route role allow-lists + organization, ownership and assignment checks in services; server-side page guards; the proxy (middleware) only redirects anonymous visitors, it is not the security boundary |
| Input validation | Zod schemas for every request body ([`src/lib/validators.ts`](../src/lib/validators.ts)); field errors are returned as `details[]` |
| Injection | Prisma parameterized queries; the few raw SQL statements use tagged templates (parameterized) |
| CSRF | `SameSite=Lax` cookie + same-origin `Origin` check on all state-changing requests |
| Abuse | Login limited to 8 attempts per minute per IP and email; public requests to 5 per 10 minutes per IP (in-memory; use Redis or Upstash when running multiple instances) |
| Uploads | MIME allow-list + magic-byte check + 5 MB cap; stored in the database and served only to signed-in users with `nosniff` and a sandboxing CSP |
| Headers | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed |
| Data exposure | Explicit `select` lists (no password hashes in responses); requester contact details excluded from exports; unknown errors return a generic 500 and are logged server-side |
| Audit | Activity log for all changes, including rejected allocation attempts |
