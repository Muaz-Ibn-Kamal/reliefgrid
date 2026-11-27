import { Guarded } from "@/components/guarded";
import { SheltersClient } from "./_client";

export const metadata = { title: "Shelters" };

export default function Page() {
  return (
    <Guarded href="/shelters">
      <SheltersClient />
    </Guarded>
  );
}
