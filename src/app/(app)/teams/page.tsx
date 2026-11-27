import { Guarded } from "@/components/guarded";
import Client from "./_client";

export const metadata = { title: "Teams" };

export default function Page() {
  return (
    <Guarded href="/teams">
      <Client />
    </Guarded>
  );
}
