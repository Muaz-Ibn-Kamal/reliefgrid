import { Guarded } from "@/components/guarded";
import { RequestsClient } from "./_client";

export const metadata = { title: "Emergency requests" };

export default function Page() {
  return (
    <Guarded href="/requests">
      <RequestsClient />
    </Guarded>
  );
}
