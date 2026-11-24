import { guardPage } from "@/lib/guard";
import ResourcesClient from "./_client";

export const metadata = { title: "Resources" };

export default async function Page() {
  await guardPage("/resources");
  return <ResourcesClient />;
}
