import { route, body } from "@/lib/api";
import { distributionUpdate } from "@/lib/validators";
import { updateDistribution } from "@/lib/services/allocation";

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, params, req }) =>
  updateDistribution(user, params.id, await body(req, distributionUpdate)),
);
