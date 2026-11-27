import { Guarded } from "@/components/guarded";
import Client from "./_client";

export const metadata = { title: "Volunteers" };

export default function Page() {
  return (
    <Guarded href="/volunteers">
      <Client />
    </Guarded>
  );
}
