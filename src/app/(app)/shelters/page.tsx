import { guardPage } from "@/lib/guard";
import { SheltersClient } from "./_client";

export const metadata = { title: "Shelters" };

export default async function Page() {
  await guardPage("/shelters");
  return <SheltersClient />;
}
