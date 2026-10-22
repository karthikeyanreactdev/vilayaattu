"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/common/AppHeader";
import { ProfileDialog } from "@/components/common/ProfileDialog";
import { StatusScreen } from "@/components/common/StatusScreen";
import { GameStage } from "@/components/game/GameStage";
import { AppTour } from "@/components/tour/AppTour";
import { ROUTES } from "@/config/constants";
import { formatRoomCode } from "@/lib/random";
import { forgetRoom, useRoomSession } from "@/hooks/useRoomSession";
import { useAppSelector } from "@/store";
import { Lobby } from "./Lobby";
import { VoiceControls } from "./VoiceControls";

export function RoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const user = useAppSelector((s) => s.user);
  const room = useAppSelector((s) => s.room);
  const session = useRoomSession(code);
  const askName = user.hydrated && !user.name;

  const leave = () => {
    forgetRoom(code);
    router.push(ROUTES.HOME);
  };

  const home = (
    <Button onClick={leave} size="lg">
      Back to home
    </Button>
  );

  let content: React.ReactNode;
  if (!user.hydrated || !user.name) {
    content = <StatusScreen loading title="Just a moment…" description="Set your name to join the room." />;
  } else if (room.status === "not-found") {
    content = (
      <StatusScreen
        emoji="🔍"
        title="Room not found"
        description={`No host is answering for ${formatRoomCode(code)}. Check the code, or ask your friend to keep their room open.`}
        actions={
          <>
            <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
              Try again
            </Button>
            {home}
          </>
        }
      />
    );
  } else if (room.status === "host-lost") {
    content = (
      <StatusScreen
        loading
        emoji="📡"
        title="Lost the host"
        description="Trying to reconnect. If the host closed their tab, the room has ended."
        actions={home}
      />
    );
  } else if (room.status === "kicked" || room.status === "closed") {
    content = <StatusScreen emoji="🚪" title="You left the room" description={room.message ?? undefined} actions={home} />;
  } else if (!session || room.status === "connecting" || room.status === "idle") {
    content = (
      <StatusScreen
        loading
        title={room.isHost ? "Opening your room…" : `Joining ${formatRoomCode(code)}…`}
        description={room.isHost ? "Setting up a direct connection." : "Looking for the host. This can take a few seconds."}
        actions={
          <Button variant="ghost" onClick={leave}>
            Cancel
          </Button>
        }
      />
    );
  } else if (room.phase === "playing") {
    content = <GameStage session={session} onLeave={leave} />;
  } else {
    content = <Lobby session={session} />;
  }

  const inGame = room.phase === "playing" && session && (room.status === "playing" || room.status === "lobby");

  return (
    <div className="flex min-h-dvh flex-col">
      {!inGame && <AppHeader />}
      <AnimatePresence mode="wait">
        <motion.div
          key={inGame ? "game" : room.status}
          className="flex flex-1 flex-col"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
      {session && (room.status === "lobby" || room.status === "playing") && <VoiceControls session={session} />}
      <ProfileDialog open={askName} onOpenChange={() => undefined} required />
      {room.status === "lobby" && <AppTour page="lobby" />}
    </div>
  );
}
