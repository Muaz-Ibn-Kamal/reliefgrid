import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { incidentUpdate } from "@/lib/validators";
import { updateIncident } from "@/lib/services/incident";
import { forbidden, notFound } from "@/lib/errors";

export const GET = route<{ id: string }>({}, async ({ user, params }) => {
  const inc = await db.incident.findUnique({
    where: { id: params.id },
    include: {
      coordinator: { select: { id: true, name: true, email: true } },
      reportedBy: { select: { id: true, name: true } },
      requests: { orderBy: { priorityScore: "desc" }, take: 50, select: { id: true, type: true, quantity: true, unit: true, status: true, priorityLevel: true, location: true, affectedPeople: true } },
      tasks: { take: 50, orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, volunteer: { select: { user: { select: { name: true } } } } } },
      teams: { select: { id: true, name: true, status: true } },
    },
  });
  if (!inc) throw notFound("Incident not found");
  if (user.role === "VOLUNTEER") {
    const mine = await db.task.count({ where: { incidentId: inc.id, volunteer: { userId: user.id } } });
    if (!mine) throw forbidden();
  }
  const history = await db.activityLog.findMany({ where: { entityType: "Incident", entityId: inc.id }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } });
  return { ...inc, history };
});

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ user, params, req }) =>
  updateIncident(user, params.id, await body(req, incidentUpdate)),
);
