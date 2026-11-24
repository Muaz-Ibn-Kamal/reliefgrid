import { route, body } from "@/lib/api";
import { fieldReportCreate } from "@/lib/validators";
import { submitFieldReport } from "@/lib/services/volunteer";

export const POST = route<{ id: string }>({ roles: ["VOLUNTEER"] }, async ({ user, params, req }) => submitFieldReport(user, params.id, await body(req, fieldReportCreate)));
