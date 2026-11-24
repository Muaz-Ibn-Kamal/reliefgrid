/**
 * Deterministic, realistic sample data (Bangladesh flood/cyclone geography, fictional organizations).
 * Allocations are created through the real service layer so every business rule is exercised by the seed itself.
 */
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { scoreIncident, scoreRequest } from "../src/lib/priority";
import { allocate, updateDistribution } from "../src/lib/services/allocation";
import { dedupeKey } from "../src/lib/services/request";
import { REQUEST_RESOURCE_MAP } from "../src/lib/constants";
import type { Role } from "../src/generated/prisma/client";

export const DEMO_PASSWORD = "ReliefGrid@2026";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261121);
const int = (a: number, b: number) => Math.floor(R() * (b - a + 1)) + a;
const pick = <T,>(a: readonly T[]) => a[int(0, a.length - 1)];
const chance = (p: number) => R() < p;
const jitter = (v: number, d = 0.05) => v + (R() - 0.5) * 2 * d;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const weighted = <T,>(items: [T, number][]) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = R() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[0][0];
};

type Place = { name: string; lat: number; lng: number; risk: number; cats: string[] };
const PLACES: Place[] = [
  { name: "Sylhet Sadar", lat: 24.8949, lng: 91.8687, risk: 4, cats: ["FLOOD", "LANDSLIDE"] },
  { name: "Sunamganj", lat: 25.0658, lng: 91.4073, risk: 5, cats: ["FLOOD"] },
  { name: "Cox's Bazar", lat: 21.4272, lng: 92.0058, risk: 5, cats: ["CYCLONE", "LANDSLIDE", "FLOOD"] },
  { name: "Chattogram", lat: 22.3569, lng: 91.7832, risk: 4, cats: ["CYCLONE", "FIRE", "LANDSLIDE", "INFRASTRUCTURE_FAILURE"] },
  { name: "Khulna", lat: 22.8456, lng: 89.5403, risk: 4, cats: ["CYCLONE", "FLOOD"] },
  { name: "Barishal", lat: 22.701, lng: 90.3535, risk: 4, cats: ["CYCLONE", "FLOOD"] },
  { name: "Bhola", lat: 22.6859, lng: 90.6482, risk: 5, cats: ["CYCLONE", "FLOOD"] },
  { name: "Patuakhali", lat: 22.3596, lng: 90.3299, risk: 5, cats: ["CYCLONE"] },
  { name: "Rangpur", lat: 25.7439, lng: 89.2752, risk: 3, cats: ["FLOOD", "EARTHQUAKE"] },
  { name: "Kurigram", lat: 25.8054, lng: 89.6361, risk: 5, cats: ["FLOOD"] },
  { name: "Bandarban", lat: 22.1953, lng: 92.2184, risk: 4, cats: ["LANDSLIDE"] },
  { name: "Rangamati", lat: 22.7324, lng: 92.2985, risk: 4, cats: ["LANDSLIDE", "FLOOD"] },
  { name: "Dhaka (Old Town)", lat: 23.7104, lng: 90.4074, risk: 3, cats: ["FIRE", "INFRASTRUCTURE_FAILURE", "EARTHQUAKE"] },
  { name: "Mymensingh", lat: 24.7471, lng: 90.4203, risk: 3, cats: ["FLOOD", "INFRASTRUCTURE_FAILURE"] },
  { name: "Satkhira", lat: 22.7185, lng: 89.0705, risk: 4, cats: ["CYCLONE", "FLOOD"] },
  { name: "Noakhali", lat: 22.8696, lng: 91.0995, risk: 4, cats: ["CYCLONE", "FLOOD"] },
  { name: "Jamalpur", lat: 24.9375, lng: 89.9372, risk: 4, cats: ["FLOOD"] },
  { name: "Sirajganj", lat: 24.4534, lng: 89.7006, risk: 4, cats: ["FLOOD", "INFRASTRUCTURE_FAILURE"] },
];

const TITLES: Record<string, string[]> = {
  FLOOD: ["Flash flood inundates villages", "River embankment overtopped", "Waterlogging in low-lying wards", "Haor flood threatens crops and homes"],
  CYCLONE: ["Cyclone landfall damages coastal homes", "Storm surge breaches coastal dyke", "Cyclone warning signal 8 – evacuation", "Fishing community hit by cyclone winds"],
  EARTHQUAKE: ["Tremor damages brick structures", "Building collapse after earthquake", "Aftershocks leave residents outdoors"],
  FIRE: ["Market fire spreads to residential block", "Slum fire displaces families", "Factory fire with trapped workers"],
  LANDSLIDE: ["Hillside landslide blocks highway", "Landslide buries homes on hill slope", "Heavy rain triggers multiple slope failures"],
  INFRASTRUCTURE_FAILURE: ["Bridge approach collapses", "Water treatment plant failure", "Power grid outage across district", "Embankment sluice gate failure"],
};

const RES_TEMPLATES: Record<string, { names: string[]; unit: string; min: number; max: number }> = {
  FOOD: { names: ["Dry Food Packages", "Rice (25kg bags)", "High-Energy Biscuits", "Ready-to-Eat Meals", "Lentils & Oil Pack"], unit: "packs", min: 200, max: 6000 },
  WATER: { names: ["Drinking Water (1.5L bottles)", "Water Purification Tablets", "20L Water Jerrycans", "Portable Water Filters"], unit: "units", min: 500, max: 20000 },
  MEDICAL: { names: ["First-Aid Kits", "ORS Sachets", "Antibiotic Course Packs", "Wound Dressing Sets", "Emergency Medical Supplies"], unit: "kits", min: 100, max: 4000 },
  EMERGENCY_KIT: { names: ["Family Emergency Kits", "Hygiene Kits", "Dignity Kits", "Emergency Shelter Kits"], unit: "kits", min: 100, max: 3000 },
  BLANKET: { names: ["Wool Blankets", "Thermal Blankets", "Tarpaulin Sheets", "Sleeping Mats"], unit: "pieces", min: 300, max: 8000 },
  RESCUE_EQUIPMENT: { names: ["Life Jackets", "Rescue Boats (inflatable)", "Rescue Ropes (50m)", "Search Lights", "Hydraulic Cutters"], unit: "units", min: 10, max: 400 },
  TRANSPORT: { names: ["Relief Trucks", "Speed Boats", "Ambulances", "Pickup Vans"], unit: "vehicles", min: 3, max: 40 },
};
const WAREHOUSES = ["Central Warehouse", "Port Depot", "District Store", "Forward Staging Base", "Cold-chain Facility", "Community Hub Store"];

const ORGS = [
  { name: "Coastal Relief Alliance", type: "NGO", region: "Chattogram Division" },
  { name: "Riverine Aid Network", type: "NGO", region: "Rangpur & Sylhet Divisions" },
  { name: "Hillside Rescue Corps", type: "Rescue Service", region: "Hill Tracts" },
  { name: "Metro Medical Relief", type: "Medical Charity", region: "Dhaka Division" },
  { name: "Delta Food & Water Trust", type: "Foundation", region: "Khulna & Barishal Divisions" },
];

const FIRST = ["Rahim", "Karim", "Nusrat", "Farhana", "Imran", "Sabina", "Tanvir", "Mahmudul", "Shirin", "Arif", "Jahid", "Lamia", "Rubel", "Mitu", "Sohel", "Tasnim", "Nafis", "Rima", "Habib", "Salma", "Kamrul", "Ayesha", "Faisal", "Moushumi", "Rashed", "Sumaiya", "Zahid", "Popy", "Shakil", "Nargis"];
const LAST = ["Hossain", "Ahmed", "Rahman", "Islam", "Khan", "Chowdhury", "Akter", "Begum", "Uddin", "Mia", "Sarker", "Talukder", "Mondal", "Das", "Biswas", "Haque", "Siddique", "Ali", "Khatun", "Roy"];
const SKILLS = ["First Aid", "Search & Rescue", "Boat Operation", "Logistics", "Cooking & Food Distribution", "Counselling", "Driving (Heavy)", "Communications", "Medical (Paramedic)", "Shelter Management", "Water Sanitation"];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;
const FACILITIES = ["Drinking Water", "Toilets", "Medical Corner", "Kitchen", "Electricity", "Child-friendly Space", "Women's Section", "Disability Access", "Generator", "Mobile Charging"];

async function main() {
  console.log("Resetting tables…");
  await db.$executeRawUnsafe(
    `TRUNCATE "Upload","ActivityLog","Notification","FieldReport","Task","Volunteer","Team","ShelterOccupancyLog","Shelter","DistributionRecord","Allocation","StockMovement","Resource","EmergencyRequest","Incident","User","Organization" RESTART IDENTITY CASCADE`,
  );
  const pw = await hashPassword(DEMO_PASSWORD);

  // ---------------------------------------------------------------- organizations
  const orgs = [];
  for (const o of ORGS) orgs.push(await db.organization.create({ data: { ...o, contact: `ops@${o.name.toLowerCase().replace(/[^a-z]+/g, "")}.example` } }));

  // ---------------------------------------------------------------- users
  const mkUser = (email: string, nm: string, role: Role, organizationId: string | null = null) =>
    db.user.create({ data: { email, name: nm, role, organizationId, passwordHash: pw, phone: `+8801${int(300000000, 999999999)}` } });

  const admin = await mkUser("admin@reliefgrid.demo", "Amina Rahman (Admin)", "SYSTEM_ADMIN");
  await mkUser("admin2@reliefgrid.demo", name(), "SYSTEM_ADMIN");
  const coords = [await mkUser("coordinator@reliefgrid.demo", "Dr. Kabir Hossain (Coordinator)", "EMERGENCY_COORDINATOR")];
  for (let i = 2; i <= 5; i++) coords.push(await mkUser(`coordinator${i}@reliefgrid.demo`, name(), "EMERGENCY_COORDINATOR"));
  const orgUsers = [];
  for (let i = 0; i < orgs.length; i++) {
    orgUsers.push(await mkUser(i === 0 ? "org@reliefgrid.demo" : `org${i + 1}@reliefgrid.demo`, i === 0 ? `Nasrin Akter (${orgs[0].name})` : name(), "RELIEF_ORGANIZATION", orgs[i].id));
    await mkUser(`org${i + 1}.logistics@reliefgrid.demo`, name(), "RELIEF_ORGANIZATION", orgs[i].id);
  }
  const shelterMgrs = [];
  for (let i = 1; i <= 12; i++) shelterMgrs.push(await mkUser(i === 1 ? "shelter@reliefgrid.demo" : `shelter${i}@reliefgrid.demo`, i === 1 ? "Mizanur Rahman (Shelter Manager)" : name(), "SHELTER_MANAGER", orgs[i % 5].id));

  // ---------------------------------------------------------------- incidents (60)
  console.log("Incidents…");
  const incidentIds: { id: string; place: Place; severity: number; risk: number; status: string }[] = [];
  for (let n = 0; n < 60; n++) {
    const place = pick(PLACES);
    const category = pick(place.cats);
    const severity = weighted<number>([[1, 4], [2, 10], [3, 18], [4, 16], [5, 8]]);
    const status = weighted<string>([["REPORTED", 8], ["VERIFIED", 10], ["IN_PROGRESS", 24], ["RESOLVED", 12], ["CLOSED", 6]]);
    const reportedAt = hoursAgo(int(2, 24 * 30));
    const affected = Math.round(Math.exp(R() * Math.log(40000)) * (severity / 2) + 20);
    const risk = Math.min(5, Math.max(1, place.risk + int(-1, 0)));
    const { score, level } = scoreIncident({ severity, affectedPopulation: affected, locationRisk: risk, reportedAt });
    const responded = status !== "REPORTED";
    const inc = await db.incident.create({
      data: {
        title: `${pick(TITLES[category])} — ${place.name}`,
        description: `Field reports indicate ${category.toLowerCase().replace("_", " ")} impact around ${place.name}. Approximately ${affected.toLocaleString()} people are affected; local authorities have requested external assistance. Access routes are partially disrupted.`,
        category: category as never,
        location: `${place.name}, Bangladesh`,
        latitude: jitter(place.lat, 0.06),
        longitude: jitter(place.lng, 0.06),
        severity,
        locationRisk: risk,
        affectedPopulation: affected,
        status: status as never,
        priorityScore: score,
        priorityLevel: level,
        coordinatorId: responded ? pick(coords).id : null,
        reportedById: pick([...coords, ...orgUsers]).id,
        reportedAt,
        firstResponseAt: responded ? new Date(reportedAt.getTime() + int(8, 240) * 60_000) : null,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date(reportedAt.getTime() + int(24, 200) * 3_600_000) : null,
      },
    });
    incidentIds.push({ id: inc.id, place, severity, risk, status });
    await db.activityLog.create({ data: { userId: inc.reportedById, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: inc.id, details: { score, level }, createdAt: reportedAt } });
    if (responded) await db.activityLog.create({ data: { userId: inc.coordinatorId, action: "INCIDENT_STATUS_CHANGED", entityType: "Incident", entityId: inc.id, details: { from: "REPORTED", to: status }, createdAt: inc.firstResponseAt! } });
  }

  // ---------------------------------------------------------------- resources (520+)
  console.log("Resources…");
  const cats = Object.keys(RES_TEMPLATES);
  const resourceRows: { id: string; organizationId: string; category: string; name: string; unit: string }[] = [];
  for (const org of orgs) {
    for (let k = 0; k < 106; k++) {
      const category = cats[k % cats.length];
      const t = RES_TEMPLATES[category];
      const qty = int(t.min, t.max);
      const wh = `${pick(WAREHOUSES)} — ${pick(PLACES).name}`;
      const r = await db.resource.create({
        data: { organizationId: org.id, name: `${pick(t.names)}`, category: category as never, unit: t.unit, quantity: qty, totalReceived: qty, storageLocation: wh },
      });
      await db.stockMovement.create({ data: { resourceId: r.id, type: "REGISTER", delta: qty, balanceAfter: qty, reason: "Initial registration", toLocation: wh, userId: orgUsers[orgs.indexOf(org)].id, createdAt: hoursAgo(int(24 * 20, 24 * 40)) } });
      resourceRows.push({ id: r.id, organizationId: org.id, category, name: r.name, unit: r.unit });
    }
  }
  // a few restocks to enrich stock history
  for (const r of resourceRows.filter(() => chance(0.15))) {
    const add = int(20, 300);
    const upd = await db.resource.update({ where: { id: r.id }, data: { quantity: { increment: add }, totalReceived: { increment: add } } });
    await db.stockMovement.create({ data: { resourceId: r.id, type: "RESTOCK", delta: add, balanceAfter: upd.quantity, reason: "Donation received", userId: orgUsers[0].id, createdAt: hoursAgo(int(24, 24 * 15)) } });
  }

  // ---------------------------------------------------------------- requests (140)
  console.log("Requests…");
  type ReqType = "FOOD" | "WATER" | "MEDICAL" | "SHELTER" | "RESCUE" | "TRANSPORT";
  const toAllocate: { id: string; type: ReqType; quantity: number; deliver: "none" | "transit" | "delivered" }[] = [];
  const usedKeys = new Set<string>();
  for (let n = 0; n < 140; n++) {
    const inc = pick(incidentIds.filter((i) => i.status !== "REPORTED"));
    const type = weighted<ReqType>([["FOOD", 28], ["WATER", 26], ["MEDICAL", 18], ["SHELTER", 14], ["RESCUE", 8], ["TRANSPORT", 6]]);
    const affected = int(5, 1800);
    const quantity = type === "RESCUE" || type === "TRANSPORT" ? int(1, 12) : Math.max(10, Math.round(affected * (type === "WATER" ? 3 : 1.2)));
    const urgency = weighted<number>([[1, 5], [2, 12], [3, 22], [4, 20], [5, 10]]);
    const lat = jitter(inc.place.lat, 0.07), lng = jitter(inc.place.lng, 0.07);
    const key = dedupeKey(type, lat, lng);
    if (usedKeys.has(key)) continue; // keep seed data free of near-duplicates
    usedKeys.add(key);
    const createdAt = hoursAgo(int(1, 24 * 28));
    const { score, level } = scoreRequest({ urgency, affectedPeople: affected, createdAt }, { incidentSeverity: inc.severity, locationRisk: inc.risk });
    const target = weighted<"PENDING" | "VERIFIED" | "REJECTED" | "ASSIGNED" | "COMPLETED">([["PENDING", 22], ["VERIFIED", 18], ["REJECTED", 6], ["ASSIGNED", 22], ["COMPLETED", 32]]);
    const needsAlloc = target === "ASSIGNED" || target === "COMPLETED";
    const responded = target !== "PENDING";
    const r = await db.emergencyRequest.create({
      data: {
        incidentId: inc.id,
        organizationId: chance(0.25) ? pick(orgs).id : null,
        type, quantity, unit: type === "WATER" ? "litres" : type === "RESCUE" ? "teams" : type === "TRANSPORT" ? "vehicles" : "packs",
        location: `${pick(["Ward 3", "Union Parishad Office", "Primary School", "Bazar area", "Char area", "Riverbank settlement", "Hill slope village"])}, ${inc.place.name}`,
        latitude: lat, longitude: lng, urgency, affectedPeople: affected,
        description: `Urgent ${type.toLowerCase()} assistance requested for ${affected} people. Local volunteers report supplies exhausted; road access is limited.`,
        requesterName: name(), requesterContact: `+8801${int(300000000, 999999999)}`,
        status: needsAlloc ? "VERIFIED" : target,
        priorityScore: score, priorityLevel: level, dedupeKey: key,
        verifiedById: target === "PENDING" ? null : pick(coords).id,
        rejectionReason: target === "REJECTED" ? "Duplicate of an existing verified request" : null,
        createdAt,
        firstResponseAt: responded ? new Date(createdAt.getTime() + int(5, 180) * 60_000) : null,
      },
    });
    await db.activityLog.create({ data: { action: "REQUEST_SUBMITTED", entityType: "EmergencyRequest", entityId: r.id, details: { type, quantity, score, level }, createdAt } });
    if (needsAlloc) toAllocate.push({ id: r.id, type, quantity, deliver: target === "COMPLETED" ? "delivered" : chance(0.5) ? "transit" : "none" });
  }

  // ---------------------------------------------------------------- allocations via the real service
  console.log(`Allocations (${toAllocate.length} requests through the service layer)…`);
  const coordUser = { id: coords[0].id, role: "EMERGENCY_COORDINATOR" as const, organizationId: null };
  let allocOk = 0;
  for (const t of toAllocate) {
    const compatible = resourceRows.filter((r) => (REQUEST_RESOURCE_MAP[t.type] as readonly string[]).includes(r.category));
    let remaining = t.quantity;
    for (let tries = 0; tries < 6 && remaining > 0; tries++) {
      const res = pick(compatible);
      const cur = await db.resource.findUniqueOrThrow({ where: { id: res.id } });
      const q = Math.min(remaining, cur.quantity);
      if (q < 1) continue;
      try {
        const a = await allocate(coordUser, { requestId: t.id, resourceId: res.id, quantity: q, notes: "Seeded allocation" });
        remaining -= q; allocOk++;
        const orgUser = { id: orgUsers[orgs.findIndex((o) => o.id === a.organizationId)].id, role: "RELIEF_ORGANIZATION" as const, organizationId: a.organizationId };
        if (t.deliver !== "none") await updateDistribution(orgUser, a.id, { status: "IN_TRANSIT", notes: "Loaded and dispatched" });
        if (t.deliver === "delivered") await updateDistribution(orgUser, a.id, { status: "DELIVERED", deliveredQty: q, notes: "Received by local committee" });
      } catch { /* skip insufficient/limit errors in seed */ }
    }
    if (t.deliver === "delivered" && remaining > 0) await db.emergencyRequest.update({ where: { id: t.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
  console.log(`  ${allocOk} allocations created`);

  // The service stamps everything "now". Spread the history realistically: stock registered ~2 weeks ago, each allocation
  // shortly after its request, then in transit (+1-3 h) and delivered (+6-18 h), never in the future. DistributionRecord is
  // immutable by trigger; the seed (a privileged setup step) disables it only inside this transaction.
  await db.$transaction([
    db.$executeRawUnsafe(`ALTER TABLE "DistributionRecord" DISABLE TRIGGER "DistributionRecord_immutable"`),
    db.$executeRawUnsafe(`UPDATE "StockMovement" SET "createdAt" = now() - interval '14 days' - random() * interval '2 days' WHERE "type" = 'REGISTER'`),
    db.$executeRawUnsafe(`UPDATE "Resource" SET "createdAt" = now() - interval '16 days'`),
    db.$executeRawUnsafe(`UPDATE "Allocation" a SET "createdAt" = LEAST(now() - interval '20 hours', r."createdAt" + (0.5 + random() * 5) * interval '1 hour'), "updatedAt" = now()
      FROM "EmergencyRequest" r WHERE r."id" = a."requestId"`),
    db.$executeRawUnsafe(`UPDATE "DistributionRecord" d SET "createdAt" = a."createdAt" + CASE d."status"
        WHEN 'ALLOCATED' THEN interval '0' WHEN 'IN_TRANSIT' THEN (1 + random() * 2) * interval '1 hour' ELSE (6 + random() * 12) * interval '1 hour' END
      FROM "Allocation" a WHERE a."id" = d."allocationId"`),
    db.$executeRawUnsafe(`UPDATE "StockMovement" m SET "createdAt" = a."createdAt" + CASE m."type" WHEN 'ALLOCATE' THEN interval '0' ELSE interval '19 hours' END
      FROM "Allocation" a WHERE a."id" = m."allocationId"`),
    db.$executeRawUnsafe(`UPDATE "ActivityLog" l SET "createdAt" = a."createdAt" FROM "Allocation" a WHERE l."entityType" = 'Allocation' AND l."entityId" = a."id"`),
    db.$executeRawUnsafe(`UPDATE "EmergencyRequest" r SET "firstResponseAt" = LEAST(r."firstResponseAt", (SELECT min(a."createdAt") FROM "Allocation" a WHERE a."requestId" = r."id"))
      WHERE EXISTS (SELECT 1 FROM "Allocation" a WHERE a."requestId" = r."id")`),
    db.$executeRawUnsafe(`ALTER TABLE "DistributionRecord" ENABLE TRIGGER "DistributionRecord_immutable"`),
  ]);

  // ---------------------------------------------------------------- shelters (24)
  console.log("Shelters…");
  for (let n = 0; n < 24; n++) {
    const place = PLACES[n % PLACES.length];
    const cap = int(150, 1500);
    const state = weighted<string>([["OPEN", 14], ["FULL", 3], ["CLOSED", 2]]);
    const occ = state === "FULL" ? cap : state === "CLOSED" ? 0 : Math.round(cap * (0.15 + R() * 0.75));
    const s = await db.shelter.create({
      data: {
        name: `${place.name} ${pick(["Cyclone Shelter", "Community Centre", "Government Primary School", "Flood Shelter", "Madrasa Relief Camp"])}`,
        location: `${place.name}, Bangladesh`, latitude: jitter(place.lat, 0.05), longitude: jitter(place.lng, 0.05),
        totalCapacity: cap, occupancy: occ, status: state as never,
        facilities: Array.from(new Set(Array.from({ length: int(3, 7) }, () => pick(FACILITIES)))),
        managerId: shelterMgrs[n % shelterMgrs.length].id, organizationId: orgs[n % 5].id,
      },
    });
    // occupancy history: random walk ending at the current value
    let v = Math.max(0, occ - int(100, 400));
    for (let h = 8; h >= 1; h--) {
      const next = h === 1 ? occ : Math.min(cap, Math.max(0, v + int(-30, 120)));
      await db.shelterOccupancyLog.create({ data: { shelterId: s.id, previous: v, current: next, capacity: cap, note: pick(["Morning headcount", "New arrivals from low-lying area", "Families relocated", "Evening headcount"]), userId: s.managerId, createdAt: hoursAgo(h * 24) } });
      v = next;
    }
  }

  // ---------------------------------------------------------------- volunteers (110), teams (12), tasks (90)
  console.log("Volunteers, teams, tasks…");
  const teams = [];
  for (let t = 0; t < 12; t++) {
    const inc = t % 3 === 0 ? pick(incidentIds.filter((i) => i.status === "IN_PROGRESS")) : null;
    teams.push(await db.team.create({ data: { name: `${pick(["Alpha", "Bravo", "Delta", "Echo", "Falcon", "Heron", "Kestrel", "Lotus", "Monsoon", "Nimbus", "Orchid", "Pelican"])} Response Team ${t + 1}`, organizationId: orgs[t % 5].id, incidentId: inc?.id ?? null, status: inc ? "DEPLOYED" : "STANDBY" } }));
  }
  const vols: { id: string; userId: string; teamId: string | null }[] = [];
  for (let v = 1; v <= 110; v++) {
    const u = await mkUser(v === 1 ? "volunteer@reliefgrid.demo" : `volunteer${v}@reliefgrid.demo`, v === 1 ? "Sadia Islam (Volunteer)" : name(), "VOLUNTEER", orgs[v % 5].id);
    const place = pick(PLACES);
    const teamId = chance(0.65) ? pick(teams).id : null;
    const vol = await db.volunteer.create({ data: { userId: u.id, skills: Array.from(new Set(Array.from({ length: int(1, 3) }, () => pick(SKILLS)))), availability: chance(0.1) ? "UNAVAILABLE" : "AVAILABLE", latitude: jitter(place.lat, 0.1), longitude: jitter(place.lng, 0.1), teamId } });
    vols.push({ id: vol.id, userId: u.id, teamId });
  }
  const active = incidentIds.filter((i) => i.status === "IN_PROGRESS" || i.status === "VERIFIED");
  for (let t = 0; t < 90; t++) {
    // The demo volunteer (vols[0]) gets one task in each workflow state so the whole flow can be demonstrated.
    const vol = t < 3 ? vols[0] : t < 14 ? vols[t - 2] : pick(vols);
    const inc = pick(active);
    const status = t < 3 ? ["ASSIGNED", "IN_PROGRESS", "COMPLETED"][t] : weighted<string>([["ASSIGNED", 20], ["IN_PROGRESS", 25], ["COMPLETED", 40], ["CANCELLED", 5]]);
    const createdAt = hoursAgo(int(2, 24 * 14));
    const task = await db.task.create({
      data: {
        title: pick(["Distribute food packages", "Set up water purification point", "Assist evacuation of elderly residents", "Door-to-door needs assessment", "Load and escort relief truck", "Run first-aid post", "Register families at shelter", "Clear access road with local team"]) + ` – ${inc.place.name}`,
        description: "Report to the local relief coordinator on arrival. Wear identification and follow safety briefing.",
        location: `${inc.place.name} relief point`, latitude: jitter(inc.place.lat, 0.04), longitude: jitter(inc.place.lng, 0.04),
        status: status as never, incidentId: inc.id, volunteerId: vol.id, teamId: vol.teamId, createdById: pick(coords).id, createdAt,
        completedAt: status === "COMPLETED" ? new Date(createdAt.getTime() + int(2, 30) * 3_600_000) : null,
      },
    });
    if (status === "COMPLETED" || (status === "IN_PROGRESS" && chance(0.6)))
      await db.fieldReport.create({ data: { taskId: task.id, volunteerId: vol.id, content: pick(["Distributed all assigned packages; 3 families still need blankets.", "Road partially flooded; used boat for the last 2 km. No injuries.", "Assessment complete: 46 households need drinking water within 24h.", "Handed over supplies to union council; verified headcount with ward member."]), createdAt: new Date(createdAt.getTime() + int(1, 20) * 3_600_000) } });
    await db.activityLog.create({ data: { userId: task.createdById, action: "TASK_ASSIGNED", entityType: "Task", entityId: task.id, createdAt } });
  }
  // availability reflects workload
  await db.$executeRawUnsafe(`
    UPDATE "Volunteer" v SET "availability" = CASE
      WHEN EXISTS (SELECT 1 FROM "Task" t WHERE t."volunteerId" = v."id" AND t."status" IN ('ASSIGNED','IN_PROGRESS')) THEN 'DEPLOYED'::"Availability"
      ELSE v."availability" END`);

  // ---------------------------------------------------------------- notifications for demo accounts
  const demoIds = [admin.id, coords[0].id, orgUsers[0].id];
  for (const id of demoIds)
    await db.notification.createMany({ data: [
      { userId: id, title: "Welcome to ReliefGrid", body: "Demo data loaded: 60 incidents, 140 requests, 24 shelters, 110 volunteers.", link: "/dashboard" },
      { userId: id, title: "Critical incident awaiting review", body: "Check the incident queue sorted by priority.", link: "/incidents" },
    ] });

  const counts = {
    organizations: await db.organization.count(), users: await db.user.count(), incidents: await db.incident.count(), requests: await db.emergencyRequest.count(),
    resources: await db.resource.count(), allocations: await db.allocation.count(), shelters: await db.shelter.count(), volunteers: await db.volunteer.count(), tasks: await db.task.count(),
  };
  console.log("Seed complete:", counts);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
