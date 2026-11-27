import { Guarded } from "@/components/guarded";
import { MapClient } from "./_client";

export const metadata = { title: "Map view" };

export default function Page() {
  return (
    <Guarded href="/map">
      <MapClient />
    </Guarded>
  );
}
