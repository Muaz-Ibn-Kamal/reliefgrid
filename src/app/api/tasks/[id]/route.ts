import { route, body } from "@/lib/api";
import { taskUpdate } from "@/lib/validators";
import { updateTask, cancelTask } from "@/lib/services/volunteer";

export const PATCH = route<{ id: string }>({ roles: ["VOLUNTEER"] }, async ({ user, params, req }) => updateTask(user, params.id, await body(req, taskUpdate)));
export const DELETE = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ user, params }) => cancelTask(user, params.id));
