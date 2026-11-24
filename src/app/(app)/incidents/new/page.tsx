import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guard";
import { NewIncidentClient } from "./_client";

export const metadata = { title: "Report incident" };

export default async function Page() {
  const user = await guardPage("/incidents");
  if (user.role === "VOLUNTEER") redirect("/incidents");
  return <NewIncidentClient />;
}
