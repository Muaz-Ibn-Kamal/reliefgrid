import { route } from "@/lib/api";
import { destroySession } from "@/lib/auth";

/** Public so an expired session can still sign out; the wrapper's same-origin check blocks cross-site logout. */
export const POST = route({ public: true }, async () => {
  await destroySession();
  return { ok: true };
});
