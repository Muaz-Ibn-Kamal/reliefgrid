import { Guarded } from "@/components/guarded";
import Client from "./_client";

export const metadata = { title: "User Management" };

export default function Page() {
  return (
    <Guarded href="/users">
      <Client />
    </Guarded>
  );
}
