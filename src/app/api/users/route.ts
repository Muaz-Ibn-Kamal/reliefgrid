import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { userCreate } from "@/lib/validators";
import { hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { logActivity } from "@/lib/services/activity";
import { badRequest, conflict } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN"] }, async ({ sp }) => {
  const pg = page(sp);
  const q = sp.get("q")?.trim();
  const where: Prisma.UserWhereInput = {
    role: enumParam(sp, "role", ROLES),
    ...(sp.get("organizationId") ? { organizationId: sp.get("organizationId")! } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: pg.skip, take: pg.take, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, organization: { select: { id: true, name: true } } } }),
    db.user.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN"] }, async ({ user, req }) => {
  const d = await body(req, userCreate);
  if (await db.user.findUnique({ where: { email: d.email } })) throw conflict("Email already registered");
  if (d.role === "RELIEF_ORGANIZATION" && !d.organizationId) throw badRequest("Relief organization users need an organization");
  const u = await db.user.create({
    data: { name: d.name, email: d.email, role: d.role, organizationId: d.organizationId ?? null, passwordHash: await hashPassword(d.password), ...(d.role === "VOLUNTEER" ? { volunteer: { create: {} } } : {}) },
    select: { id: true, name: true, email: true, role: true },
  });
  await logActivity(db, { userId: user.id, action: "USER_CREATED", entityType: "User", entityId: u.id, details: { role: u.role } });
  return u;
});
