import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { allocate, updateDistribution } from "../src/lib/services/allocation";
import { setOccupancy, updateShelter } from "../src/lib/services/shelter";
import { adjustStock } from "../src/lib/services/resource";
import { createRequest, reviewRequest } from "../src/lib/services/request";
import { updateIncident, createIncident } from "../src/lib/services/incident";
import { createTask, updateTask, submitFieldReport } from "../src/lib/services/volunteer";
import { scoreIncident, scoreRequest } from "../src/lib/priority";
import { ApiError } from "../src/lib/errors";
import { rateLimit } from "../src/lib/ratelimit";
import { createTeam, updateTeam, teamScope } from "../src/lib/services/team";
import { updateUserByAdmin, updateOwnProfile } from "../src/lib/services/user";
import { assertUploadAllowed, UPLOAD_LIMITS } from "../src/lib/services/upload";
import { assertDemoAccountEditable } from "../src/lib/demo";
import { orgIdOf } from "../src/lib/scope";
import { hashPassword } from "../src/lib/password";
import * as V from "../src/lib/validators";

const T = `t${Date.now()}`;
let coord: any, admin: any, orgA: any, orgB: any, orgUserA: any, orgUserB: any, shelterMgr: any, shelterMgr2: any, volU1: any, volU2: any, vol1: any, vol2: any;
const as = (u: any) => ({ id: u.id, role: u.role, organizationId: u.organizationId });
const rejects = async (p: Promise<unknown>, status: number, msg?: RegExp) => {
  await assert.rejects(p, (e: any) => { assert.ok(e instanceof ApiError, `expected ApiError, got ${e}`); assert.equal(e.status, status, e.message); if (msg) assert.match(e.message, msg); return true; });
};
const mkUser = (role: any, organizationId: string | null = null) => db.user.create({ data: { email: `${T}-${Math.random().toString(36).slice(2)}@x.test`, name: "T " + role, role, organizationId, passwordHash: "x" } });
const mkReq = (over: any = {}) => db.emergencyRequest.create({ data: { type: "FOOD", quantity: 100, unit: "packs", location: "L", latitude: 10 + Math.random(), longitude: 80 + Math.random(), urgency: 4, affectedPeople: 50, description: "desc desc", requesterName: "R", status: "VERIFIED", dedupeKey: T + Math.random(), ...over } });
const mkRes = (orgId: string, quantity: number, category: any = "FOOD") => db.resource.create({ data: { organizationId: orgId, name: "T res", category, unit: "packs", quantity, totalReceived: quantity, storageLocation: "W" } });

test.before(async () => {
  // These tests create fixtures (and immutable distribution records), so they must never run against the demo database.
  if (await db.user.findUnique({ where: { email: "admin@reliefgrid.demo" } }))
    throw new Error("Refusing to run: DATABASE_URL points at the seeded demo database. Put a separate database in .env.test (see .env.test.example) and run `npm run test:migrate` once.");
  orgA = await db.organization.create({ data: { name: `${T}-A`, type: "NGO", region: "r" } });
  orgB = await db.organization.create({ data: { name: `${T}-B`, type: "NGO", region: "r" } });
  admin = await mkUser("SYSTEM_ADMIN"); coord = await mkUser("EMERGENCY_COORDINATOR");
  orgUserA = await mkUser("RELIEF_ORGANIZATION", orgA.id); orgUserB = await mkUser("RELIEF_ORGANIZATION", orgB.id);
  shelterMgr = await mkUser("SHELTER_MANAGER"); shelterMgr2 = await mkUser("SHELTER_MANAGER");
  volU1 = await mkUser("VOLUNTEER"); volU2 = await mkUser("VOLUNTEER");
  vol1 = await db.volunteer.create({ data: { userId: volU1.id, skills: [] } }); vol2 = await db.volunteer.create({ data: { userId: volU2.id, skills: [] } });
});

test("allocation: cannot exceed available stock; failure leaves inventory untouched and is logged", async () => {
  const res = await mkRes(orgA.id, 50); const req = await mkReq({ quantity: 500 });
  await rejects(allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 80 }), 409, /Insufficient stock/);
  assert.equal((await db.resource.findUniqueOrThrow({ where: { id: res.id } })).quantity, 50);
  assert.equal(await db.allocation.count({ where: { resourceId: res.id } }), 0);
  assert.equal(await db.stockMovement.count({ where: { resourceId: res.id, type: "ALLOCATE" } }), 0);
  assert.ok(await db.activityLog.findFirst({ where: { action: "ALLOCATION_REJECTED", entityId: req.id } }));
});

test("allocation: success decrements stock, writes movement + distribution history, request becomes ASSIGNED", async () => {
  const res = await mkRes(orgA.id, 200); const req = await mkReq({ quantity: 120 });
  const a = await allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 70 });
  assert.equal((await db.resource.findUniqueOrThrow({ where: { id: res.id } })).quantity, 130);
  const mv = await db.stockMovement.findFirstOrThrow({ where: { allocationId: a.id } });
  assert.equal(mv.delta, -70); assert.equal(mv.balanceAfter, 130);
  assert.equal(await db.distributionRecord.count({ where: { allocationId: a.id } }), 1);
  assert.equal((await db.emergencyRequest.findUniqueOrThrow({ where: { id: req.id } })).status, "ASSIGNED");
  assert.equal(a.organizationId, orgA.id); // responsible org = resource owner
});

test("allocation: cannot exceed the request's remaining need, wrong category rejected, unverified rejected", async () => {
  const res = await mkRes(orgA.id, 1000); const req = await mkReq({ quantity: 100 });
  await allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 90 });
  await rejects(allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 20 }), 409, /remaining request need \(10/);
  const water = await mkRes(orgA.id, 1000, "WATER");
  await rejects(allocate(as(coord), { requestId: req.id, resourceId: water.id, quantity: 5 }), 400, /cannot satisfy/);
  const pending = await mkReq({ status: "PENDING" });
  await rejects(allocate(as(coord), { requestId: pending.id, resourceId: res.id, quantity: 5 }), 409, /VERIFIED/);
});

test("allocation: concurrent allocations can never oversell stock", async () => {
  const res = await mkRes(orgA.id, 100);
  const reqs = await Promise.all([1, 2, 3, 4, 5, 6].map(() => mkReq({ quantity: 40 })));
  const results = await Promise.allSettled(reqs.map((r) => allocate(as(coord), { requestId: r.id, resourceId: res.id, quantity: 40 })));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 2, "only floor(100/40)=2 can succeed");
  assert.equal((await db.resource.findUniqueOrThrow({ where: { id: res.id } })).quantity, 20);
});

test("allocation: only coordinators/admins allocate; orgs only update their own distributions", async () => {
  const res = await mkRes(orgA.id, 100); const req = await mkReq({ quantity: 50 });
  await rejects(allocate(as(orgUserA), { requestId: req.id, resourceId: res.id, quantity: 5 }), 403);
  const a = await allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 50 });
  await rejects(updateDistribution(as(orgUserB), a.id, { status: "IN_TRANSIT" }), 403);
  await updateDistribution(as(orgUserA), a.id, { status: "IN_TRANSIT" });
  await updateDistribution(as(orgUserA), a.id, { status: "DELIVERED", deliveredQty: 50 });
  assert.equal((await db.emergencyRequest.findUniqueOrThrow({ where: { id: req.id } })).status, "COMPLETED");
  await rejects(updateDistribution(as(orgUserA), a.id, { status: "CANCELLED" }), 409); // delivered is final
  assert.equal(await db.distributionRecord.count({ where: { allocationId: a.id } }), 3);
});

test("allocation: cancelling restores stock via ledger", async () => {
  const res = await mkRes(orgA.id, 100); const req = await mkReq({ quantity: 60 });
  const a = await allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 60 });
  await updateDistribution(as(coord), a.id, { status: "CANCELLED" });
  assert.equal((await db.resource.findUniqueOrThrow({ where: { id: res.id } })).quantity, 100);
  assert.equal((await db.emergencyRequest.findUniqueOrThrow({ where: { id: req.id } })).status, "VERIFIED");
});

test("distribution ledger is immutable at the database level", async () => {
  const rec = await db.distributionRecord.findFirstOrThrow();
  await assert.rejects(db.$executeRaw`UPDATE "DistributionRecord" SET "notes"='x' WHERE id=${rec.id}`, /immutable/);
  await assert.rejects(db.$executeRaw`DELETE FROM "DistributionRecord" WHERE id=${rec.id}`, /immutable/);
});

test("stock: org can adjust only own resources; negative stock rejected", async () => {
  const res = await mkRes(orgA.id, 10);
  await rejects(adjustStock(as(orgUserB), res.id, { type: "RESTOCK", delta: 5 }), 403);
  await rejects(adjustStock(as(orgUserA), res.id, { type: "ADJUST", delta: -11 }), 409, /negative/);
  const r = await adjustStock(as(orgUserA), res.id, { type: "RESTOCK", delta: 15 });
  assert.equal(r.quantity, 25);
  assert.equal(await db.stockMovement.count({ where: { resourceId: res.id } }), 1);
});

test("shelter: occupancy never exceeds capacity, availability derived, history kept, concurrent-safe", async () => {
  const s = await db.shelter.create({ data: { name: T, location: "x", latitude: 1, longitude: 1, totalCapacity: 100, occupancy: 60, facilities: [], managerId: shelterMgr.id } });
  await rejects(setOccupancy(as(shelterMgr), s.id, { occupancy: 101 }), 409, /exceeds capacity/);
  await rejects(setOccupancy(as(shelterMgr), s.id, { delta: 41 }), 409);
  await rejects(setOccupancy(as(shelterMgr), s.id, { delta: -61 }), 409, /negative/);
  assert.equal((await db.shelter.findUniqueOrThrow({ where: { id: s.id } })).occupancy, 60);
  const u = await setOccupancy(as(shelterMgr), s.id, { delta: 40 });
  assert.equal(u.occupancy, 100); assert.equal(u.status, "FULL");
  const u2 = await setOccupancy(as(shelterMgr), s.id, { delta: -10 });
  assert.equal(u2.status, "OPEN"); assert.equal(u2.totalCapacity - u2.occupancy, 10);
  assert.equal(await db.shelterOccupancyLog.count({ where: { shelterId: s.id } }), 2);
  const burst = await Promise.allSettled(Array.from({ length: 10 }, () => setOccupancy(as(shelterMgr), s.id, { delta: 3 })));
  assert.equal(burst.filter((b) => b.status === "fulfilled").length, 3); // 90 + 3*3 = 99, the 4th would be 102
  assert.ok((await db.shelter.findUniqueOrThrow({ where: { id: s.id } })).occupancy <= 100);
  await rejects(setOccupancy(as(shelterMgr2), s.id, { delta: -1 }), 403); // someone else's shelter
  await rejects(updateShelter(as(shelterMgr), s.id, { totalCapacity: 50 }), 409, /below current occupancy/);
});

test("priority: higher severity / affected / urgency / age raise score; changes are logged", async () => {
  const now = new Date(); const base = { severity: 3, affectedPopulation: 500, locationRisk: 3, reportedAt: now };
  assert.ok(scoreIncident({ ...base, severity: 5 }, now).score > scoreIncident(base, now).score);
  assert.ok(scoreIncident({ ...base, affectedPopulation: 20000 }, now).score > scoreIncident(base, now).score);
  assert.ok(scoreIncident({ ...base, reportedAt: new Date(now.getTime() - 48 * 3_600_000) }, now).score > scoreIncident(base, now).score);
  assert.ok(scoreRequest({ urgency: 5, affectedPeople: 100, createdAt: now }, {}, now).score > scoreRequest({ urgency: 1, affectedPeople: 100, createdAt: now }, {}, now).score);
  const inc = await createIncident(as(coord), { title: "T incident", description: "long enough description", category: "FLOOD", location: "x", latitude: 1, longitude: 1, severity: 2, locationRisk: 3, affectedPopulation: 100 });
  await updateIncident(as(coord), inc.id, { severity: 5, affectedPopulation: 30000, locationRisk: 5 });
  const log = await db.activityLog.findFirst({ where: { entityId: inc.id, action: "PRIORITY_CHANGED" } });
  assert.ok(log, "priority change must be in history");
  await rejects(updateIncident(as(volU1), inc.id, { severity: 1 }), 403);
});

test("requests: duplicate detection + verification workflow", async () => {
  // Unique coordinates per run: requests from earlier runs stay in the DB and would trip the 48 h duplicate window.
  const lat = 30 + Math.random() * 30, lng = 100 + Math.random() * 60;
  const base = { type: "WATER" as const, quantity: 100, unit: "L", location: "Spot", latitude: lat, longitude: lng, urgency: 3, affectedPeople: 40, description: "need water", requesterName: "Q" };
  const first = await createRequest(null, base);
  await rejects(createRequest(null, { ...base, latitude: lat + 0.005 }), 409, /duplicate/i);
  await createRequest(null, { ...base, latitude: lat + 0.005, force: true });
  await rejects(reviewRequest(as(orgUserA), first.id, { action: "VERIFY" }), 403);
  await reviewRequest(as(coord), first.id, { action: "VERIFY" });
  await rejects(reviewRequest(as(coord), first.id, { action: "VERIFY" }), 409);
  await rejects(reviewRequest(as(coord), first.id, { action: "REJECT" }), 400); // reason required
});

test("volunteers: only the assignee updates a task; completed tasks are frozen and keep reports", async () => {
  const task = await createTask(as(coord), { title: "T task", location: "x", latitude: 1, longitude: 1, volunteerId: vol1.id });
  await rejects(createTask(as(volU1), { title: "T task", location: "x", latitude: 1, longitude: 1, volunteerId: vol1.id }), 403);
  await rejects(updateTask(as(volU2), task.id, { status: "IN_PROGRESS" }), 403);
  await rejects(submitFieldReport(as(volU2), task.id, { content: "hacked" }), 403);
  await rejects(updateTask(as(coord), task.id, { status: "COMPLETED", report: "x" }), 403);
  assert.equal((await db.volunteer.findUniqueOrThrow({ where: { id: vol1.id } })).availability, "DEPLOYED");
  await updateTask(as(volU1), task.id, { status: "IN_PROGRESS" });
  await rejects(updateTask(as(volU1), task.id, { status: "COMPLETED" }), 400, /field report/);
  await updateTask(as(volU1), task.id, { status: "COMPLETED", report: "All done, 40 households served." });
  await rejects(updateTask(as(volU1), task.id, { status: "IN_PROGRESS" }), 409);
  await rejects(submitFieldReport(as(volU1), task.id, { content: "late edit" }), 409);
  assert.equal(await db.fieldReport.count({ where: { taskId: task.id } }), 1);
  assert.equal((await db.volunteer.findUniqueOrThrow({ where: { id: vol1.id } })).availability, "AVAILABLE");
});

test.after(async () => { await db.$disconnect(); });

test("Volunteer profile can be created without skills (DB default, admin-created accounts)", async () => {
  const u = await db.user.create({ data: { email: `${T}-noskill@x.test`, name: "T noskill", role: "VOLUNTEER", passwordHash: "x", volunteer: { create: {} } }, include: { volunteer: true } });
  assert.deepEqual(u.volunteer?.skills, []);
});

// ------------------------------------------------------------------ security regressions (audit 2026-11-25)

test("security: relief orgs only see and staff their own teams", async () => {
  const mkVol = async (orgId: string) => { const u = await mkUser("VOLUNTEER", orgId); return db.volunteer.create({ data: { userId: u.id, skills: [] } }); };
  const volA = await mkVol(orgA.id), volB = await mkVol(orgB.id);
  assert.deepEqual(teamScope(as(orgUserA)), { organizationId: orgA.id });
  assert.equal((await db.team.findMany({ where: teamScope(as(shelterMgr)) })).length, 0);
  await rejects(createTeam(as(orgUserA), { name: "T steal", memberIds: [volB.id] }), 403, /own organization/);
  assert.equal((await db.volunteer.findUniqueOrThrow({ where: { id: volB.id } })).teamId, null, "a refused move must not change the volunteer");
  const teamA = await createTeam(as(orgUserA), { name: "T team A", memberIds: [volA.id] });
  assert.equal((await db.volunteer.findUniqueOrThrow({ where: { id: volA.id } })).teamId, teamA.id);
  await rejects(updateTeam(as(orgUserA), teamA.id, { addMembers: [volB.id] }), 403);
  const teamB = await createTeam(as(orgUserB), { name: "T team B", memberIds: [] });
  await rejects(updateTeam(as(orgUserA), teamB.id, { name: "renamed" }), 403);
  await rejects(createTeam(as(coord), { name: "T ghost", memberIds: ["doesnotexist"] }), 400);
  await createTeam(as(coord), { name: "T coord team", memberIds: [volB.id] }); // coordinators may staff across organizations
  assert.throws(() => orgIdOf({ id: "x", role: "RELIEF_ORGANIZATION", organizationId: null }), (e: any) => e.status === 403);
});

test("security: admin cannot leave a relief-organization user without an organization", async () => {
  await rejects(updateUserByAdmin(as(admin), orgUserA.id, { organizationId: null }), 400);
  await rejects(updateUserByAdmin(as(admin), volU2.id, { role: "RELIEF_ORGANIZATION" }), 400);
  await rejects(updateUserByAdmin(as(admin), orgUserA.id, { organizationId: "doesnotexist" }), 400);
  await rejects(updateUserByAdmin(as(admin), admin.id, { active: false }), 400);
});

test("security: a password change revokes other sessions; shared demo accounts are protected in demo mode", async () => {
  const u = await db.user.create({ data: { email: `${T}-pw@x.test`, name: "T pw", role: "VOLUNTEER", passwordHash: await hashPassword("OldPassw0rd!") } });
  const me = { ...as(u), email: u.email };
  await rejects(updateOwnProfile(me, { currentPassword: "wrong", newPassword: "NewPassw0rd!" }), 400);
  const r = await updateOwnProfile(me, { currentPassword: "OldPassw0rd!", newPassword: "NewPassw0rd!" });
  assert.equal(r.newSessionVersion, 1);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: u.id } })).sessionVersion, 1, "tokens signed with version 0 are now rejected");
  assert.equal((await updateOwnProfile(me, { name: "T renamed" })).newSessionVersion, undefined, "profile edits keep sessions");
  const prev = process.env.DEMO_MODE;
  try {
    process.env.DEMO_MODE = "true";
    assert.throws(() => assertDemoAccountEditable("Admin@ReliefGrid.demo", "Editing"), (e: any) => e.status === 403);
    assert.doesNotThrow(() => assertDemoAccountEditable("volunteer7@reliefgrid.demo", "Editing")); // only the five shared accounts
    await rejects(updateOwnProfile({ ...me, email: "volunteer@reliefgrid.demo" }, { currentPassword: "NewPassw0rd!", newPassword: "Hijacked1!" }), 403);
    process.env.DEMO_MODE = "false";
    assert.doesNotThrow(() => assertDemoAccountEditable("admin@reliefgrid.demo", "Editing"));
  } finally {
    process.env.DEMO_MODE = prev;
  }
});

test("security: the shared rate limiter counts across calls and resets after its window", async () => {
  const key = `${T}-rl`;
  const seen = [];
  for (let i = 0; i < 4; i++) seen.push(await rateLimit(key, 3, 1500));
  assert.deepEqual(seen, [true, true, true, false]);
  await new Promise((r) => setTimeout(r, 1700));
  assert.equal(await rateLimit(key, 3, 1500), true);
});

test("security: image uploads are rate limited and capped per account", async () => {
  const heavy = await mkUser("VOLUNTEER");
  const MB5 = 5 * 1024 * 1024; // the database caps each stored image at 5 MB (Upload_size_range)
  await db.upload.createMany({ data: Array.from({ length: 5 }, () => ({ contentType: "image/png", size: MB5, data: Buffer.alloc(MB5), uploadedById: heavy.id })) });
  await rejects(assertUploadAllowed(heavy.id, 100), 413);
  await db.upload.deleteMany({ where: { uploadedById: heavy.id } });
  const busy = await mkUser("VOLUNTEER");
  for (let i = 0; i < UPLOAD_LIMITS.perHour; i++) await assertUploadAllowed(busy.id, 10);
  await rejects(assertUploadAllowed(busy.id, 10), 429);
});

test("security: validators bound ids, quantities and arrays", () => {
  const bad = (schema: any, v: unknown) => assert.equal(schema.safeParse(v).success, false, JSON.stringify(v).slice(0, 80));
  bad(V.allocationCreate, { requestId: "x".repeat(65), resourceId: "r", quantity: 1 });
  bad(V.allocationCreate, { requestId: "q", resourceId: "r", quantity: 3_000_000_000 });
  bad(V.stockAdjust, { type: "RESTOCK", delta: 1e12 });
  bad(V.occupancyUpdate, { delta: 5_000_000 });
  bad(V.teamCreate, { name: "T", memberIds: Array(101).fill("v") });
  bad(V.incidentUpdate, { affectedPopulation: 3_000_000_000 });
  assert.equal(V.allocationCreate.safeParse({ requestId: "q", resourceId: "r", quantity: 5 }).success, true);
});

test("security: delivery QR tokens are long random values, not sequential ids", async () => {
  const res = await mkRes(orgA.id, 50);
  const req = await mkReq({ quantity: 5 });
  const a = await allocate(as(coord), { requestId: req.id, resourceId: res.id, quantity: 5 });
  const token = (await db.allocation.findUniqueOrThrow({ where: { id: a.id } })).qrToken;
  assert.match(token, /^[A-Za-z0-9_-]{24}$/);
});
