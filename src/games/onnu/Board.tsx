"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SeatRow } from "@/components/game/SeatRow";
import { TurnBanner } from "@/components/game/TurnBanner";
import { COLORS as THEME_COLORS } from "@/config/constants";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import { playerName } from "../helpers";
import type { GameBoardProps } from "../types";
import { ShuffleDeal } from "../cards/ShuffleDeal";
import { canPlay, COLORS, type OnnuAction, type OnnuCard, type OnnuColor, type OnnuState } from "./logic";
import { OnnuCardView } from "./OnnuCard";

export default function OnnuBoard({ state, me, players, send }: GameBoardProps<OnnuState, OnnuAction>) {
  const play = useSound();
  // A fresh game starts with a shuffle and deal.
  const [shuffling, setShuffling] = useState(state.moveNo === 0);
  const [wildCard, setWildCard] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => state.lastEvent?.n ?? -1);
  const lastMove = useRef(state.moveNo);

  const seatIdx = Math.max(0, state.players.findIndex((p) => p.id === me));
  const isPlayer = state.players.some((p) => p.id === me);
  const opponents = useMemo(
    () => [...state.players.slice(seatIdx + 1), ...state.players.slice(0, seatIdx)].filter((p) => p.id !== me),
    [state.players, seatIdx, me],
  );
  const myHand = useMemo(() => (state.hands[me] ?? []) as OnnuCard[], [state.hands, me]);
  const top = state.discard[state.discard.length - 1];
  const turnId = state.players[state.turn]?.id;
  const myTurn = isPlayer && turnId === me && state.status === "playing";

  useEffect(() => {
    if (state.moveNo === lastMove.current) return;
    lastMove.current = state.moveNo;
    const ev = state.lastEvent;
    if (!ev) return;
    setTimeout(() => setDismissed(ev.n), 1600);
    if (ev.kind === "draw") play("deal", 15);
    else if (ev.kind === "onnu") play("coin", [50, 30, 50]);
    else if (ev.kind === "catch") play("capture", 60);
    else if (ev.kind === "draw2" || ev.kind === "draw4") play("capture", 40);
    else play("card", 10);
  }, [state.moveNo, state.lastEvent, play]);

  const ev = state.lastEvent;
  const banner =
    ev && ev.n !== dismissed && ["skip", "reverse", "draw2", "draw4", "wild", "onnu", "catch"].includes(ev.kind)
      ? {
          key: ev.n,
          text: ev.kind === "catch" ? `${ev.by === me ? "You" : playerName(players, ev.by)} ${ev.text}` : `${ev.by === me ? "You" : playerName(players, ev.by)}: ${ev.text}`,
        }
      : null;

  const playableIds = useMemo(() => {
    if (!myTurn) return new Set<string>();
    return new Set(
      myHand
        .filter((c) => (state.drawnId ? c.id === state.drawnId : true))
        .filter((c) => canPlay(c, top, state.color, state.stacking ? state.pendingDraw : 0))
        .filter(() => !(state.pendingDraw > 0 && !state.stacking))
        .map((c) => c.id),
    );
  }, [myTurn, myHand, top, state.color, state.drawnId, state.pendingDraw, state.stacking]);

  const playCard = (c: OnnuCard) => {
    if (c.color === "wild") {
      setWildCard(c.id);
      return;
    }
    send({ type: "play", cardId: c.id });
  };

  const canCallOnnu = isPlayer && !state.declared[me] && state.status === "playing" && (myHand.length === 1 || (myTurn && myHand.length === 2));
  const catchable = opponents.filter((p) => state.counts[p.id] === 1 && !state.declared[p.id]);
  const overlap = myHand.length > 14 ? -36 : myHand.length > 9 ? -28 : -18;

  return (
    <LayoutGroup>
      <div className="felt relative flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col gap-2 pb-6 text-white">
        {shuffling && <ShuffleDeal seats={players.length} back={<OnnuCardView card={{ id: "shuffle-back", hidden: true }} />} onDone={() => setShuffling(false)} />}
        <SeatRow
          className="pt-3"
          players={opponents}
          activeId={state.status === "playing" ? turnId : null}
          caption={(p) => (
            <span className={cn(state.counts[p.id] === 1 && "font-bold text-amber-300")}>
              {state.counts[p.id]} card{state.counts[p.id] === 1 ? "" : "s"}
              {state.declared[p.id] && state.counts[p.id] === 1 && " · ONNU!"}
            </span>
          )}
          extra={(p) => (
            <div className="relative h-9" style={{ width: Math.min(state.counts[p.id], 12) * 3 + 24 }}>
              {(state.hands[p.id] ?? []).slice(0, 12).map((c, i) => (
                <OnnuCardView key={c.id} card={c} size="xs" layoutId={`o-${c.id}`} className="absolute top-0" style={{ left: i * 3 }} />
              ))}
            </div>
          )}
        />

        {/* Centre: direction ring, deck, discard */}
        <div className="relative flex flex-1 items-center justify-center py-4">
          <motion.div
            className="absolute size-64 rounded-full border-4 border-dashed opacity-40 sm:size-80"
            style={{ borderColor: THEME_COLORS.ONNU[state.color] }}
            animate={{ rotate: state.direction === 1 ? 360 : -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative flex items-center gap-6 sm:gap-10">
            <motion.button
              type="button"
              whileHover={myTurn && !state.drawnId ? { scale: 1.05 } : undefined}
              whileTap={myTurn && !state.drawnId ? { scale: 0.95 } : undefined}
              disabled={!myTurn || Boolean(state.drawnId)}
              onClick={() => send({ type: "draw" })}
              className={cn("relative", myTurn && !state.drawnId && "cursor-pointer")}
              aria-label={state.pendingDraw > 0 ? `Draw ${state.pendingDraw} cards` : "Draw a card"}
            >
              {[2, 1, 0].map((i) => (
                <div key={i} className="absolute" style={{ top: -i * 2, left: -i * 2 }}>
                  <OnnuCardView card={{ id: `deck${i}`, hidden: true }} size="lg" />
                </div>
              ))}
              <div className="invisible">
                <OnnuCardView card={{ id: "deckx", hidden: true }} size="lg" />
              </div>
              {myTurn && !state.drawnId && (
                <motion.span
                  className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  {state.pendingDraw > 0 ? `Draw ${state.pendingDraw}` : "Draw"}
                </motion.span>
              )}
            </motion.button>

            <div className="relative">
              <AnimatePresence initial={false}>
                <motion.div
                  key={top.id}
                  initial={{ rotate: 0 }}
                  animate={{ rotate: (Number(top.id.slice(1)) % 14) - 7 }}
                  exit={{ opacity: 0, transition: { delay: 0.4 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="absolute inset-0"
                >
                  <OnnuCardView card={top} size="lg" layoutId={`o-${top.id}`} />
                </motion.div>
              </AnimatePresence>
              <div className="invisible">
                <OnnuCardView card={top} size="lg" />
              </div>
              <motion.span
                key={state.color}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-3 -bottom-3 size-7 rounded-full border-2 border-white shadow-lg"
                style={{ background: THEME_COLORS.ONNU[state.color] }}
                aria-label={`Current colour ${state.color}`}
              />
            </div>
          </div>
          <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 text-[11px] text-white/70">
            <RefreshCw className={cn("size-3", state.direction === -1 && "-scale-x-100")} />
            {state.direction === 1 ? "Clockwise" : "Anticlockwise"} · {state.deckCount} in deck
          </span>

          <AnimatePresence>
            {banner && (
              <motion.div
                key={banner.key}
                initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: -4 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 16 }}
                className="pointer-events-none absolute top-6 z-20 rounded-2xl border-4 border-white bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 px-5 py-2 text-xl font-black italic shadow-2xl"
              >
                {banner.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls (appear once the deal finishes) */}
        {isPlayer && !shuffling && (
          <div className="grid gap-2 px-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <TurnBanner
                myTurn={myTurn}
                finished={state.status === "finished"}
                myTurnText={state.drawnId ? "Play the drawn card or pass" : state.pendingDraw > 0 ? `Stack a draw card or take ${state.pendingDraw}` : "Your turn"}
                waitingText={`${playerName(players, turnId)}'s turn`}
              />
              {myTurn && state.drawnId && (
                <Button size="sm" variant="secondary" onClick={() => send({ type: "pass" })}>
                  Pass
                </Button>
              )}
              <AnimatePresence>
                {canCallOnnu && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Button
                      size="sm"
                      className="animate-pulse bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500 font-black text-white shadow-lg"
                      onClick={() => send({ type: "onnu" })}
                    >
                      ONNU!
                    </Button>
                  </motion.div>
                )}
                {catchable.map((p) => (
                  <motion.div key={p.id} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Button size="sm" variant="destructive" className="bg-red-600 text-white" onClick={() => send({ type: "catch", target: p.id })}>
                      Catch {p.name}!
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap justify-center px-6 pt-5" style={{ paddingLeft: -overlap }}>
              {myHand.map((c) => (
                <div key={c.id} style={{ marginLeft: overlap }}>
                  <OnnuCardView
                    card={c}
                    layoutId={`o-${c.id}`}
                    playable={playableIds.has(c.id)}
                    dimmed={myTurn && !playableIds.has(c.id)}
                    onClick={playableIds.has(c.id) ? () => playCard(c) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wild colour picker */}
        <AnimatePresence>
          {wildCard && (
            <motion.div
              className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setWildCard(null)}
            >
              <motion.div
                initial={{ scale: 0.6, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0.6 }}
                className="rounded-3xl bg-popover p-5 text-popover-foreground shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-4 text-center font-bold">Choose a colour</p>
                <div className="grid grid-cols-2 gap-3">
                  {COLORS.map((c: OnnuColor, i) => (
                    <motion.button
                      key={c}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.9 }}
                      className="size-24 rounded-2xl border-4 border-white text-sm font-bold text-white capitalize shadow-lg"
                      style={{ background: THEME_COLORS.ONNU[c] }}
                      onClick={() => {
                        send({ type: "play", cardId: wildCard, color: c });
                        setWildCard(null);
                      }}
                    >
                      {c}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
