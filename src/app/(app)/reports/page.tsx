import { guardPage } from "@/lib/guard";
import { ReportsClient } from "./_client";

export const metadata = { title: "Reports & analytics" };

export default async function Page() {
  await guardPage("/reports");
  return <ReportsClient />;
}
