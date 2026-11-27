import { Guarded } from "@/components/guarded";
import { IncidentDetailClient } from "./_client";

export const metadata = { title: "Incident details" };

export default function Page(props: PageProps<"/incidents/[id]">) {
  return (
    <Guarded href="/incidents">
      <IncidentDetail params={props.params} />
    </Guarded>
  );
}

/** Reads the route param inside the boundary as well, so the page shell stays static. */
async function IncidentDetail({ params }: { params: PageProps<"/incidents/[id]">["params"] }) {
  const { id } = await params;
  return <IncidentDetailClient id={id} />;
}
