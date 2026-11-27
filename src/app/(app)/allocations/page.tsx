import { Guarded } from "@/components/guarded";
import { AllocationsClient } from "./_client";

export const metadata = { title: "Resource allocation" };

export default function Page() {
  return (
    <Guarded href="/allocations">
      <AllocationsClient />
    </Guarded>
  );
}
