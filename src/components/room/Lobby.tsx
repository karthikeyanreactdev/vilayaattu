"use client";

import { AnimatePresence, motion } from "motion/react";
import { Play, Settings2 } from "lucide-react";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { GameTile } from "@/components/game/GameTile";
import { HowToPlay } from "@/components/game/HowToPlay";
import { CATEGORIES, GAMES, getGameDefinition } from "@/games/registry";
import type { RoomSession } from "@/lib/room/roomSession";
import { useAppSelector } from "@/store";
import { useSound } from "@/hooks/useSound";
import { GameOptionsPanel } from "./GameOptionsPanel";
import { PlayerList } from "./PlayerList";
import { RoomCodeCard } from "./RoomCodeCard";
import { VoiceControls } from "./VoiceControls";

/** Waiting room: invite, pick a game, tweak options, start. */
export function Lobby({ session }: { session: RoomSession }) {
  const room = useAppSelector((s) => s.room);
  const me = useAppSelector((s) => s.user.id);
  const play = useSound();
  const def = room.gameId ? getGameDefinition(room.gameId) : undefined;
  const online = room.players.filter((p) => p.connected).length;
  const prevCount = useRef(room.players.length);

  useEffect(() => {
    if (room.players.length > prevCount.current) play("join", 30);
    prevCount.current = room.players.length;
  }, [room.players.length, play]);

  const startHint = !def
    ? room.isHost
      ? "Pick a game to start"
      : "The host is picking a game…"
    : online < def.meta.minPlayers
      ? `Need ${def.meta.minPlayers - online} more player${def.meta.minPlayers - online === 1 ? "" : "s"}`
      : room.isPublic && online < room.capacity
        ? `${room.capacity - online} seat${room.capacity - online === 1 ? "" : "s"} open · starts by itself when full`
        : online > room.capacity
          ? `Only the first ${room.capacity} players will play; others watch`
          : null;

  // Host can resize a private table within the game's limits.
  const seatChoices =
    def && room.isHost && !room.isPublic
      ? Array.from({ length: def.meta.maxPlayers - def.meta.minPlayers + 1 }, (_, i) => def.meta.minPlayers + i)
      : [];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 pb-32 lg:grid-cols-[340px_1fr]">
      <div className="grid content-start gap-4">
        <RoomCodeCard code={room.code} />
        <VoiceControls session={session} />
        <PlayerList
          players={room.players}
          hostId={room.hostId}
          me={me}
          capacity={room.capacity}
          canKick={room.isHost}
          onKick={(id) => session.kick(id)}
          onAddBot={
            room.isHost
              ? (level) => {
                  play("join");
                  const err = session.addBot(level);
                  if (err) toast.error(err);
                }
              : undefined
          }
        />
        {seatChoices.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm shadow-sm">
            <span className="font-medium">Seats</span>
            {seatChoices.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={room.capacity === n ? "default" : "outline"}
                disabled={n < room.players.length}
                onClick={() => {
                  play("tap");
                  session.setCapacity(n);
                }}
              >
                {n}
              </Button>
            ))}
          </div>
        )}
        {room.isPublic && (
          <p className="rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">
            🌐 Public {room.capacity}-player table: anyone who taps this game and picks {room.capacity} players can join.
          </p>
        )}
      </div>

      <div className="grid content-start gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm" data-tour="game-picker">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{room.isHost ? "Pick a game" : "Games"}</h2>
            {!room.isHost && <span className="text-xs text-muted-foreground">The host chooses</span>}
          </div>
          <div className="grid gap-5">
            {CATEGORIES.map((cat) => {
              const games = GAMES.filter((g) => g.meta.category === cat);
              return (
                <section key={cat}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{cat}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {games.map((g, i) => {
                      const tooFew = online < g.meta.minPlayers;
                      return (
                        <GameTile
                          key={g.meta.id}
                          meta={g.meta}
                          compact
                          index={i}
                          selected={room.gameId === g.meta.id}
                          disabled={tooFew && room.gameId !== g.meta.id}
                          disabledReason={tooFew ? `Needs ${g.meta.minPlayers}+ players` : undefined}
                          onClick={
                            room.isHost
                              ? () => {
                                  play("select");
                                  session.selectGame(g.meta.id);
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {def && (
            <motion.div
              key={def.meta.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              data-tour="options"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Settings2 className="size-4" /> {def.meta.emoji} {def.meta.name} settings
                </h2>
                <HowToPlay meta={def.meta} />
              </div>
              <GameOptionsPanel
                fields={def.optionFields}
                values={room.options}
                editable={room.isHost}
                onChange={(k, v) => {
                  play("tap");
                  session.setOption(k, v);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky start bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="flex-1 text-sm text-muted-foreground">
            {startHint ?? (
              <>
                Ready to play <strong className="text-foreground">{def?.meta.name}</strong> with {online} players
              </>
            )}
          </p>
          {room.isHost && (
            <Button
              size="lg"
              className="h-11 px-6 text-base"
              data-tour="start"
              disabled={!def || online < (def?.meta.minPlayers ?? 99)}
              onClick={() => {
                const err = session.startGame();
                if (err) toast.error(err);
                else play("deal");
              }}
            >
              <Play /> Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
