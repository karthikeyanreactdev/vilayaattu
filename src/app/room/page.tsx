import { Suspense } from "react";
import { ClientOnly } from "@/components/common/ClientOnly";
import { StatusScreen } from "@/components/common/StatusScreen";
import { RoomEntry } from "./RoomEntry";

export default function RoomPage() {
  const fallback = <StatusScreen loading title="Opening room…" />;
  return (
    <Suspense fallback={fallback}>
      <ClientOnly fallback={fallback}>
        <RoomEntry />
      </ClientOnly>
    </Suspense>
  );
}
