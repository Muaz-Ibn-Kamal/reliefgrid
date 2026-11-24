import { guardPage } from "@/lib/guard";
import Client from "./_client";

export const metadata = { title: "Teams" };

export default async function Page() {
  await guardPage("/teams");
  return <Client />;
}
