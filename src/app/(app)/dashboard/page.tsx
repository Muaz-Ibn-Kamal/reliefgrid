import { Guarded } from "@/components/guarded";
import { DashboardClient } from "./_client";

export const metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Guarded href="/dashboard">
      <DashboardClient />
    </Guarded>
  );
}
