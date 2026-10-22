import { Suspense } from "react";
import { ClientOnly } from "@/components/common/ClientOnly";
import { StatusScreen } from "@/components/common/StatusScreen";
import { RoomScreen } from "@/components/room/RoomScreen";
import { normalizeRoomCode } from "@/lib/random";

async function Room({ params }: { params: PageProps<"/room/[code]">["params"] }) {
  const { code } = await params;
  const fallback = <StatusScreen loading title="Opening room…" />;
  return (
    <ClientOnly fallback={fallback}>
      <RoomScreen code={normalizeRoomCode(code)} />
    </ClientOnly>
  );
}

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<StatusScreen loading title="Opening room…" />}>
      <Room params={params} />
    </Suspense>
  );
}
