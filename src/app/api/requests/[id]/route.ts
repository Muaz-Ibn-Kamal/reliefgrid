import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { requestReview } from "@/lib/validators";
import { reviewRequest } from "@/lib/services/request";
import { notFound } from "@/lib/errors";

export const GET = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ params }) => {
  const r = await db.emergencyRequest.findUnique({
    where: { id: params.id },
    include: { incident: true, allocations: { include: { resource: { select: { name: true, unit: true } }, organization: { select: { name: true } }, distributions: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!r) throw notFound();
  const history = await db.activityLog.findMany({ where: { entityType: "EmergencyRequest", entityId: r.id }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } });
  return { ...r, history };
});
export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ user, params, req }) =>
  reviewRequest(user, params.id, await body(req, requestReview)),
);
