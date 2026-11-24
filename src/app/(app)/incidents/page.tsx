import { guardPage } from "@/lib/guard";
import { IncidentsClient } from "./_client";

export const metadata = { title: "Incidents" };

export default async function Page() {
  await guardPage("/incidents");
  return <IncidentsClient />;
}
