import { route, body } from "@/lib/api";
import { teamUpdate } from "@/lib/validators";
import { updateTeam } from "@/lib/services/team";

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, params, req }) =>
  updateTeam(user, params.id, await body(req, teamUpdate)),
);
