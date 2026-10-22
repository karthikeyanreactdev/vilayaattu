"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { StatusScreen } from "@/components/common/StatusScreen";
import { RoomScreen } from "@/components/room/RoomScreen";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/constants";
import { normalizeRoomCode } from "@/lib/random";

/** Room code lives in the query so a static host can open any room. */
export function RoomEntry() {
  const params = useSearchParams();
  const router = useRouter();
  const code = normalizeRoomCode(params.get("code") ?? "");

  if (!code) {
    return (
      <StatusScreen
        emoji="🔗"
        title="Room link is incomplete"
        description="Open a room from the home screen, or use a link that includes the room code."
        actions={
          <Button size="lg" onClick={() => router.push(ROUTES.HOME)}>
            Back to home
          </Button>
        }
      />
    );
  }

  return <RoomScreen code={code} />;
}
