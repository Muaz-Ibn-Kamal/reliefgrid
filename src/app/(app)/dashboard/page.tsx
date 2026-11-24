import { guardPage } from "@/lib/guard";
import { DashboardClient } from "./_client";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  await guardPage("/dashboard");
  return <DashboardClient />;
}
