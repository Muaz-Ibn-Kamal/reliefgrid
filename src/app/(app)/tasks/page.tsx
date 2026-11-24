import { guardPage } from "@/lib/guard";
import Client from "./_client";

export const metadata = { title: "My Tasks" };

export default async function Page() {
  await guardPage("/tasks");
  return <Client />;
}
