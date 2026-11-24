import { guardPage } from "@/lib/guard";
import Client from "./_client";

export const metadata = { title: "Volunteers" };

export default async function Page() {
  await guardPage("/volunteers");
  return <Client />;
}
