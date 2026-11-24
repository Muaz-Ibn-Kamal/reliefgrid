import { guardPage } from "@/lib/guard";
import { RequestsClient } from "./_client";

export const metadata = { title: "Emergency requests" };

export default async function Page() {
  await guardPage("/requests");
  return <RequestsClient />;
}
