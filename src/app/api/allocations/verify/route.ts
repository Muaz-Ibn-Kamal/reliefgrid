import { z } from "zod";
import QRCode from "qrcode";
import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { updateDistribution } from "@/lib/services/allocation";
import { notFound, forbidden } from "@/lib/errors";

/** GET ?token= → allocation summary + QR PNG data-URL (for the dispatching org). POST {token} → confirm delivery by QR scan. */
export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, sp }) => {
  const token = sp.get("token") ?? "";
  const a = await db.allocation.findUnique({ where: { qrToken: token }, include: { resource: { select: { name: true, unit: true } }, request: { select: { location: true, type: true } }, organization: { select: { name: true } } } });
  if (!a) throw notFound("Invalid token");
  if (user.role === "RELIEF_ORGANIZATION" && user.organizationId !== a.organizationId) throw forbidden();
  const qr = await QRCode.toDataURL(`reliefgrid:${a.qrToken}`, { margin: 1, width: 200 });
  return { allocation: a, qr };
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, req }) => {
  const { token } = await body(req, z.object({ token: z.string().min(8).max(200).transform((t) => t.replace(/^reliefgrid:/, "")) }));
  const a = await db.allocation.findUnique({ where: { qrToken: token } });
  if (!a) throw notFound("Invalid token");
  return updateDistribution(user, a.id, { status: "DELIVERED", notes: "Verified by QR scan" });
});
