import { Guarded } from "@/components/guarded";
import Client from "./_client";

export const metadata = { title: "My Tasks" };

export default function Page() {
  return (
    <Guarded href="/tasks">
      <Client />
    </Guarded>
  );
}
