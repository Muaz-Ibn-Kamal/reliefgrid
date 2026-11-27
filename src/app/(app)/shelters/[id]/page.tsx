import { Guarded } from "@/components/guarded";
import { ShelterDetailClient } from "./_client";

export const metadata = { title: "Shelter" };

export default function Page(props: PageProps<"/shelters/[id]">) {
  return (
    <Guarded href="/shelters">
      <ShelterDetail params={props.params} />
    </Guarded>
  );
}

/** Reads the route param inside the boundary as well, so the page shell stays static. */
async function ShelterDetail({ params }: { params: PageProps<"/shelters/[id]">["params"] }) {
  const { id } = await params;
  return <ShelterDetailClient id={id} />;
}
