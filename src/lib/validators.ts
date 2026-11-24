import { z } from "zod";
import { INCIDENT_CATEGORIES, REQUEST_TYPES, RESOURCE_CATEGORIES } from "./constants";

const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const level5 = z.number().int().min(1).max(5);

export const incidentCreate = z.object({
  title: text(160, 4),
  description: text(4000, 10),
  category: z.enum(INCIDENT_CATEGORIES),
  location: text(200),
  latitude: lat,
  longitude: lng,
  severity: level5,
  locationRisk: level5.default(3),
  affectedPopulation: z.number().int().min(0).max(100_000_000),
  imageUrl: z.string().regex(/^\/api\/uploads\/[a-z0-9]{20,40}$/, "Upload the image first").optional(),
});

export const incidentUpdate = z.object({
  status: z.enum(["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  severity: level5.optional(),
  locationRisk: level5.optional(),
  affectedPopulation: z.number().int().min(0).optional(),
  coordinatorId: z.string().nullable().optional(),
  priorityOverride: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  note: text(500).optional(),
});

export const requestCreate = z.object({
  incidentId: z.string().optional(),
  type: z.enum(REQUEST_TYPES),
  quantity: z.number().int().min(1).max(10_000_000),
  unit: text(30).default("units"),
  location: text(200),
  latitude: lat,
  longitude: lng,
  urgency: level5,
  affectedPeople: z.number().int().min(1).max(100_000_000),
  description: text(2000, 5),
  requesterName: text(120),
  requesterContact: text(120).optional(),
  force: z.boolean().optional(), // acknowledge possible duplicates
});

export const requestReview = z.object({
  action: z.enum(["VERIFY", "REJECT", "COMPLETE", "SET_URGENCY"]),
  reason: text(500).optional(),
  urgency: level5.optional(),
});

export const resourceCreate = z.object({
  organizationId: z.string().optional(),
  name: text(120),
  category: z.enum(RESOURCE_CATEGORIES),
  unit: text(30),
  quantity: z.number().int().min(0).max(100_000_000),
  storageLocation: text(200),
});
export const resourceUpdate = z.object({
  name: text(120).optional(),
  storageLocation: text(200).optional(),
});
export const stockAdjust = z.object({
  type: z.enum(["RESTOCK", "ADJUST", "TRANSFER_OUT"]),
  delta: z.number().int().refine((n) => n !== 0, "delta must not be 0"),
  reason: text(300).optional(),
  toLocation: text(200).optional(),
});

export const allocationCreate = z.object({
  requestId: z.string(),
  resourceId: z.string(),
  quantity: z.number().int().min(1),
  notes: text(500).optional(),
});
export const distributionUpdate = z.object({
  status: z.enum(["IN_TRANSIT", "DELIVERED", "CANCELLED"]),
  deliveredQty: z.number().int().min(0).optional(),
  notes: text(500).optional(),
});

export const shelterCreate = z.object({
  name: text(120),
  location: text(200),
  latitude: lat,
  longitude: lng,
  totalCapacity: z.number().int().min(1).max(1_000_000),
  occupancy: z.number().int().min(0).default(0),
  facilities: z.array(text(60)).max(20).default([]),
  managerId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
});
export const shelterUpdate = z.object({
  name: text(120).optional(),
  location: text(200).optional(),
  totalCapacity: z.number().int().min(1).max(1_000_000).optional(),
  facilities: z.array(text(60)).max(20).optional(),
  status: z.enum(["OPEN", "FULL", "CLOSED"]).optional(),
  managerId: z.string().nullable().optional(),
});
export const occupancyUpdate = z
  .object({ occupancy: z.number().int().min(0).optional(), delta: z.number().int().optional(), note: text(300).optional() })
  .refine((v) => (v.occupancy === undefined) !== (v.delta === undefined), "Provide exactly one of occupancy or delta");

export const taskCreate = z.object({
  title: text(160, 3),
  description: text(2000).optional(),
  location: text(200),
  latitude: lat,
  longitude: lng,
  incidentId: z.string().optional(),
  requestId: z.string().optional(),
  volunteerId: z.string().optional(),
  teamId: z.string().optional(),
});
export const taskUpdate = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  report: text(4000).optional(),
  photoUrl: z.string().regex(/^\/api\/uploads\/[a-z0-9]{20,40}$/, "Upload the image first").optional(),
});
export const fieldReportCreate = z.object({ content: text(4000, 3), photoUrl: z.string().regex(/^\/api\/uploads\/[a-z0-9]{20,40}$/, "Upload the image first").optional() });
export const taskReassign = z.object({ volunteerId: z.string().nullable().optional(), teamId: z.string().nullable().optional() });

export const teamCreate = z.object({ name: text(100), organizationId: z.string().optional(), memberIds: z.array(z.string()).default([]) });
export const teamUpdate = z.object({
  name: text(100).optional(),
  addMembers: z.array(z.string()).optional(),
  removeMembers: z.array(z.string()).optional(),
  deployToIncidentId: z.string().nullable().optional(),
});

export const registerSchema = z.object({
  name: text(100, 2),
  email: z.string().trim().toLowerCase().email().max(160),
  password: z.string().min(8).max(100),
  phone: text(30).optional(),
  skills: z.array(text(40)).max(10).default([]),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) });

export const userCreate = z.object({
  name: text(100, 2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"]),
  organizationId: z.string().nullable().optional(),
});
export const userUpdate = z.object({
  name: text(100, 2).optional(),
  role: z.enum(["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"]).optional(),
  organizationId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export const orgSchema = z.object({ name: text(120, 2), type: text(60), region: text(100), contact: text(160).optional(), active: z.boolean().optional() });
export const profileUpdate = z.object({
  name: text(100, 2).optional(),
  phone: text(30).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
  availability: z.enum(["AVAILABLE", "DEPLOYED", "UNAVAILABLE"]).optional(),
  skills: z.array(text(40)).max(10).optional(),
});
