import { guardPage } from "@/lib/guard";
import { ShelterDetailClient } from "./_client";

export const metadata = { title: "Shelter" };

export default async function Page(props: PageProps<"/shelters/[id]">) {
  await guardPage("/shelters");
  const { id } = await props.params;
  return <ShelterDetailClient id={id} />;
}
