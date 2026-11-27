import { Guarded } from "@/components/guarded";
import { ReportsClient } from "./_client";

export const metadata = { title: "Reports & analytics" };

export default function Page() {
  return (
    <Guarded href="/reports">
      <ReportsClient />
    </Guarded>
  );
}
