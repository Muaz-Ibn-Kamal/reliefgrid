import { guardPage } from "@/lib/guard";
import { AllocationsClient } from "./_client";

export const metadata = { title: "Resource allocation" };

export default async function Page() {
  await guardPage("/allocations");
  return <AllocationsClient />;
}
