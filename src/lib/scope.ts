import { forbidden } from "./errors";
import type { SessionUserLike } from "./services/types";

/**
 * The caller's organization. An organization-bound user without one is refused, rather than an empty filter
 * silently showing every organization's records.
 */
export function orgIdOf(user: SessionUserLike): string {
  if (!user.organizationId) throw forbidden("Your account is not linked to an organization");
  return user.organizationId;
}
