import { Guarded } from "@/components/guarded";
import { IncidentsClient } from "./_client";

export const metadata = { title: "Incidents" };

export default function Page() {
  return (
    <Guarded href="/incidents">
      <IncidentsClient />
    </Guarded>
  );
}
