import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NAV } from "@/lib/rbac";
import { Shell, type NavItem } from "@/components/shell";
import { Spinner } from "@/components/ui";
import type { RoleName } from "@/lib/constants";

/** Reads the session cookie (runtime data), so it must stream inside a Suspense boundary under Cache Components. */
async function AuthedShell({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const org = user.organizationId ? await db.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null;
  const nav = NAV.filter((n) => n.roles.includes(user.role)).map(({ href, label, icon }) => ({ href, label, icon })) as NavItem[];
  return <Shell nav={nav} user={{ name: user.name, role: user.role as RoleName, org: org?.name }}>{children}</Shell>;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner text="Loading workspace…" /></div>}><AuthedShell>{children}</AuthedShell></Suspense>;
}
