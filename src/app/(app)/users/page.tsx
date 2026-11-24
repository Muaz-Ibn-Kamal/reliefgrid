import { guardPage } from "@/lib/guard";
import Client from "./_client";

export const metadata = { title: "User Management" };

export default async function Page() {
  await guardPage("/users");
  return <Client />;
}
