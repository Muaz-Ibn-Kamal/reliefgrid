import { Suspense } from "react";
import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guard";
import { PageLoading } from "@/components/guarded";
import { NewIncidentClient } from "./_client";

export const metadata = { title: "Report incident" };

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewIncident />
    </Suspense>
  );
}

async function NewIncident() {
  const user = await guardPage("/incidents");
  if (user.role === "VOLUNTEER") redirect("/incidents");
  return <NewIncidentClient />;
}
