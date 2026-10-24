"use client";

import { motion } from "motion/react";
import { ArrowLeft, Ellipsis, Eye, Home, Maximize2, Minimize2, RotateCcw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useI18n } from "@/hooks/useI18n";
import { useAppSelector } from "@/store";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { GameIcon } from "./GameIcon";
import { HowToPlay } from "./HowToPlay";
import { FloatingReactions } from "./Reactions";
import { ResultOverlay } from "./ResultOverlay";
import { cn } from "@/lib/utils";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement() {
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

type Props = { session: RoomSession; onLeave: () => void };

/** Frame around any game: header, board, reactions, result. */
export function GameStage({ session, onLeave }: Props) {
  const room = useAppSelector((s) => s.room);
  const game = useAppSelector((s) => s.game);
  const { game: gameText } = useI18n();
  const me = useAppSelector((s) => s.user.id);
  const [confirm, setConfirm] = useState<null | "leave" | "end">(null);
  /** Covers the screen when the browser refuses the Fullscreen API (common on iPhone). */
  const [forced, setForced] = useState(false);
  const [native, setNative] = useState(false);
  const full = native || forced;

  useEffect(() => {
    const sync = () => setNative(Boolean(fullscreenElement()));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      const doc = document as FullscreenDocument;
      if (fullscreenElement()) {
        if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
        else doc.webkitExitFullscreen?.();
      }
    };
  }, []);

  const toggleFull = async () => {
    if (forced) {
      setForced(false);
      return;
    }
    const doc = document as FullscreenDocument;
    const el = document.documentElement as FullscreenElement;
    try {
      if (fullscreenElement()) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
        return;
      }
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else setForced(true);
    } catch {
      setForced(true);
    }
  };

  const def = room.gameId ? getGameDefinition(room.gameId) : undefined;
  const text = def ? gameText(def.meta) : null;
  const Board = room.gameId ? BOARDS[room.gameId] : undefined;
  const state = game.view as BaseGameState | null;
  const seated = room.gamePlayers.some((p) => p.id === me);
  const offline = room.gamePlayers.filter((p) => !room.players.find((rp) => rp.id === p.id)?.connected);

  const rematch = () => {
    session.backToLobby();
    setTimeout(() => session.startGame(), 0);
  };

  return (
    <div
      data-fullscreen={full ? "on" : "off"}
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        forced && "fixed inset-0 z-30 h-dvh w-dvw overflow-auto bg-background",
      )}
    >
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
          <Button variant="ghost" size="icon" aria-label="Leave game" onClick={() => setConfirm("leave")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate font-bold">
              {def && <GameIcon id={def.meta.id} className="size-7" />} {text?.title ?? def?.meta.name}
            </h1>
            {text?.subtitle && <p className="indic -mt-0.5 truncate text-xs text-muted-foreground">{text.subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label={full ? "Exit full screen" : "Full screen"} aria-pressed={full} onClick={() => void toggleFull()}>
            {full ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </Button>
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
        {room.phase === "playing" && room.gamePlayers.length > 0 && Board && state ? (
          <Board
            state={state}
            me={me}
            players={room.gamePlayers.map((g) => room.players.find((p) => p.id === g.id) ?? g)}
            send={(a: unknown) => session.sendAction(a)}
            clockOffset={game.clockOffset}
          />
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading game…</div>
        )}
      </main>

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
