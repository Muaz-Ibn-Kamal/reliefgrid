import { guardPage } from "@/lib/guard";
import { MapClient } from "./_client";

export const metadata = { title: "Map view" };

export default async function Page() {
  await guardPage("/map");
  return <MapClient />;
}
