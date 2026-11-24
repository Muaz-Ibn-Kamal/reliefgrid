import { route, body } from "@/lib/api";
import { occupancyUpdate } from "@/lib/validators";
import { setOccupancy } from "@/lib/services/shelter";

export const POST = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "SHELTER_MANAGER"] }, async ({ user, params, req }) => setOccupancy(user, params.id, await body(req, occupancyUpdate)));
