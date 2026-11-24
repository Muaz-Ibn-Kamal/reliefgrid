import { guardPage } from "@/lib/guard";
import { IncidentDetailClient } from "./_client";

export const metadata = { title: "Incident details" };

export default async function Page(props: PageProps<"/incidents/[id]">) {
  await guardPage("/incidents");
  const { id } = await props.params;
  return <IncidentDetailClient id={id} />;
}
