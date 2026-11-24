import "server-only";
import { redirect } from "next/navigation";
import { getUser, type SessionUser } from "./auth";
import { NAV } from "./rbac";

/** Server-side page guard: anonymous -> /login, role not allowed for this nav entry -> /dashboard. Returns the session user. */
export async function guardPage(href: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  const entry = NAV.find((n) => n.href === href);
  if (entry && !entry.roles.includes(user.role)) redirect("/dashboard");
  return user;
}
