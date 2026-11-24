import { route, body } from "@/lib/api";
import { userUpdate } from "@/lib/validators";
import { updateUserByAdmin } from "@/lib/services/user";

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN"] }, async ({ user, params, req }) =>
  updateUserByAdmin(user, params.id, await body(req, userUpdate)),
);
