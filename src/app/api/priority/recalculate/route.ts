import { route } from "@/lib/api";
import { recalculatePriorities } from "@/lib/services/incident";
export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ user }) => recalculatePriorities(user.id));
