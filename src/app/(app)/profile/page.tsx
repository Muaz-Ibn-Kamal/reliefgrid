import { guardPage } from "@/lib/guard";
import Client from "./_client";

export const metadata = { title: "Profile" };

export default async function Page() {
  await guardPage("/profile");
  return <Client />;
}
