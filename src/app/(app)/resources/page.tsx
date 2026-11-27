import { Guarded } from "@/components/guarded";
import ResourcesClient from "./_client";

export const metadata = { title: "Resources" };

export default function Page() {
  return (
    <Guarded href="/resources">
      <ResourcesClient />
    </Guarded>
  );
}
