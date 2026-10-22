"use client";

import { motion } from "motion/react";
import { ArrowLeft, Ellipsis, Eye, Home, RotateCcw, WifiOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BOARDS } from "@/games/boards";
import { getGameDefinition } from "@/games/registry";
import type { BaseGameState } from "@/games/types";
import type { RoomSession } from "@/lib/room/roomSession";
import { useAppSelector } from "@/store";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HowToPlay } from "./HowToPlay";
import { FloatingReactions, ReactionPicker } from "./Reactions";
import { ResultOverlay } from "./ResultOverlay";

type Props = { session: RoomSession; onLeave: () => void };

/** Frame around any game: header, board, reactions, result. */
export function GameStage({ session, onLeave }: Props) {
  const room = useAppSelector((s) => s.room);
  const game = useAppSelector((s) => s.game);
  const me = useAppSelector((s) => s.user.id);
  const [confirm, setConfirm] = useState<null | "leave" | "end">(null);

  const def = room.gameId ? getGameDefinition(room.gameId) : undefined;
  const Board = room.gameId ? BOARDS[room.gameId] : undefined;
  const state = game.view as BaseGameState | null;
  const seated = room.gamePlayers.some((p) => p.id === me);
  const offline = room.gamePlayers.filter((p) => !room.players.find((rp) => rp.id === p.id)?.connected);

  const rematch = () => {
    session.backToLobby();
    setTimeout(() => session.startGame(), 0);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
          <Button variant="ghost" size="icon" aria-label="Leave game" onClick={() => setConfirm("leave")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate font-bold">
              <span aria-hidden>{def?.meta.emoji}</span> {def?.meta.name}
            </h1>
            {def?.meta.tamilName && <p className="tamil -mt-0.5 truncate text-xs text-muted-foreground">{def.meta.tamilName}</p>}
          </div>
          {def && <HowToPlay meta={def.meta} label="Guide" />}
          {room.isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Game menu" />}>
                <Ellipsis className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={rematch}>
                  <RotateCcw /> Restart game
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirm("end")}>
                  <Home /> End game, back to lobby
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {offline.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            className="flex items-center justify-center gap-2 bg-warning/20 px-3 py-1 text-xs font-medium"
          >
            <WifiOff className="size-3.5" />
            Waiting for {offline.map((p) => p.name).join(", ")} to reconnect…
          </motion.div>
        )}
        {!seated && (
          <div className="flex items-center justify-center gap-2 bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Eye className="size-3.5" /> You&apos;re watching. You&apos;ll join the next game.
          </div>
        )}
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col">
        {Board && state ? (
          <Board
            state={state}
            me={me}
            players={room.gamePlayers}
            send={(a: unknown) => session.sendAction(a)}
            clockOffset={game.clockOffset}
          />
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading game…</div>
        )}
      </main>

      <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40">
        <ReactionPicker onReact={(e) => session.sendReaction(e)} />
      </div>
      <FloatingReactions />

      <ResultOverlay
        result={state?.status === "finished" ? state.result : null}
        me={me}
        players={room.gamePlayers}
        isHost={room.isHost}
        onRematch={rematch}
        onLobby={() => session.backToLobby()}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "end" ? "End this game?" : room.isHost ? "Leave and close the room?" : "Leave the game?"}
        description={
          confirm === "end"
            ? "Everyone goes back to the lobby. Progress in this game is lost."
            : room.isHost
              ? "You're the host. Leaving closes the room for everyone."
              : "You can rejoin with the same code while the game is running."
        }
        confirmLabel={confirm === "end" ? "End game" : "Leave"}
        onConfirm={() => {
          if (confirm === "end") session.backToLobby();
          else onLeave();
          setConfirm(null);
        }}
      />
    </div>
  );
}
