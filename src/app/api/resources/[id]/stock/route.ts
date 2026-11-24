import { route, body } from "@/lib/api";
import { stockAdjust } from "@/lib/validators";
import { adjustStock } from "@/lib/services/resource";

export const POST = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "RELIEF_ORGANIZATION"] }, async ({ user, params, req }) =>
  adjustStock(user, params.id, await body(req, stockAdjust)),
);
