import { Guarded } from "@/components/guarded";
import Client from "./_client";

export const metadata = { title: "Profile" };

export default function Page() {
  return (
    <Guarded href="/profile">
      <Client />
    </Guarded>
  );
}
