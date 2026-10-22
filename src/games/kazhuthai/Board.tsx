"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SeatRow } from "@/components/game/SeatRow";
import { TurnBanner } from "@/components/game/TurnBanner";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { useNow } from "@/hooks/useNow";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import { playerName } from "../helpers";
import type { GameBoardProps } from "../types";
import { ShuffleDeal } from "../cards/ShuffleDeal";
import { isHidden, SUIT_NAME, SUIT_SYMBOL, type MaybeCard, type PlayingCard } from "../cards/deck";
import { CardBack, PlayingCardView } from "../cards/PlayingCardView";
import { KAZHUTHAI_TURN_MS, type KazhuthaiAction, type KazhuthaiState } from "./logic";

type Resolving = NonNullable<KazhuthaiState["lastTrick"]> & { key: string };

/** Overlapping face-down stack for an opponent; cards fly out of it when played. */
function MiniStack({ cards }: { cards: MaybeCard[] }) {
  return (
    <div className="relative h-9" style={{ width: Math.min(cards.length, 14) * 3 + 24 }}>
      {cards.map((c, i) => (
        <PlayingCardView
          key={c.id}
          card={c}
          size="xs"
          layoutId={`card-${c.id}`}
          className="absolute top-0"
          style={{ left: Math.min(i, 13) * 3 }}
        />
      ))}
    </div>
  );
}

export default function KazhuthaiBoard({ state, me, players, send, clockOffset }: GameBoardProps<KazhuthaiState, KazhuthaiAction>) {
  const play = useSound();
  const now = useNow(state.status === "playing" && typeof state.deadline === "number", 200);
  // A fresh game starts with a shuffle and deal.
  const [shuffling, setShuffling] = useState(state.moveNo === 0);
  const [resolving, setResolving] = useState<Resolving | null>(null);
  const lastMove = useRef(state.moveNo);
  const lastTrickKey = useRef(state.lastTrick ? state.lastTrick.cards.map((c) => c.card.id).join() : "");

  const seatIdx = Math.max(0, players.findIndex((p) => p.id === me));
  const isPlayer = players.some((p) => p.id === me);
  const opponents = useMemo(
    () => [...players.slice(seatIdx + 1), ...players.slice(0, seatIdx)].filter((p) => p.id !== me),
    [players, seatIdx, me],
  );
  const myHand = useMemo(() => (state.hands[me] ?? []) as PlayingCard[], [state.hands, me]);
  const myTurn = isPlayer && state.turn === me && state.status === "playing";

  useEffect(() => {
    const lt = state.lastTrick;
    const key = lt ? lt.cards.map((c) => c.card.id).join() : "";
    const showTrick = Boolean(lt && key && state.trick.length === 0 && key !== lastTrickKey.current);
    if (!showTrick) {
      if (state.moveNo !== lastMove.current && state.trick.length > 0) play("card", 10);
      lastMove.current = state.moveNo;
      setResolving(null);
      return;
    }
    lastTrickKey.current = key;
    lastMove.current = state.moveNo;
    setResolving({ ...lt!, key });
    play(lt!.outcome === "cut" ? "capture" : "card", lt!.outcome === "cut" ? [80, 40, 80] : 10);
    const t = setTimeout(() => setResolving(null), 1700);
    return () => {
      clearTimeout(t);
      // Strict mode re-runs the effect; let that second run arm the timer again.
      lastTrickKey.current = "";
    };
  }, [state.moveNo, state.lastTrick, state.trick.length, play]);

  const leftMs = typeof state.deadline === "number" ? Math.max(0, state.deadline - (now + clockOffset)) : null;
  const secs = leftMs === null ? null : Math.ceil(leftMs / 1000);
  // Only freeze the hand while the trick that just finished is still on the table.
  const animatingTrick = Boolean(resolving) && state.trick.length === 0;

  const playable = useMemo(() => {
    if (!myTurn || animatingTrick) return new Set<string>();
    if (state.firstTrick && state.trick.length === 0) {
      return new Set(myHand.filter((c) => c.suit === "S" && c.rank === 1).map((c) => c.id));
    }
    const led = state.ledSuit;
    if (led && myHand.some((c) => c.suit === led)) return new Set(myHand.filter((c) => c.suit === led).map((c) => c.id));
    return new Set(myHand.map((c) => c.id));
  }, [myTurn, animatingTrick, state.firstTrick, state.trick.length, state.ledSuit, myHand]);

  const tableCards = resolving ? resolving.cards : state.trick;
  const overlap = myHand.length > 18 ? -34 : myHand.length > 12 ? -28 : -20;

  const hint = !myTurn
    ? ""
    : state.firstTrick && state.trick.length === 0
      ? "Lead with the A♠"
      : state.ledSuit && myHand.some((c) => c.suit === state.ledSuit)
        ? `Follow ${SUIT_NAME[state.ledSuit]} ${SUIT_SYMBOL[state.ledSuit]}`
        : state.ledSuit
          ? `No ${SUIT_NAME[state.ledSuit]}? Cut with any card!`
          : "Lead any card";

  return (
    <LayoutGroup>
      <div className="felt relative flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col gap-2 pb-6 text-white">
        {shuffling && <ShuffleDeal seats={players.length} back={<CardBack />} onDone={() => setShuffling(false)} />}
        <SeatRow
          className="pt-3"
          players={opponents}
          activeId={state.status === "playing" ? state.turn : null}
          caption={(p) => (state.finished.includes(p.id) ? `🎉 Escaped #${state.finished.indexOf(p.id) + 1}` : `${state.counts[p.id]} cards`)}
          extra={(p) => <MiniStack cards={state.hands[p.id] ?? []} />}
          dim={(p) => state.finished.includes(p.id)}
        />

        {/* Table */}
        <div className="relative mx-auto flex min-h-52 w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4">
          <div className="absolute inset-x-6 inset-y-2 rounded-[3rem] border-4 border-[oklch(0.35_0.07_50)] bg-black/10 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
          {secs !== null && state.status === "playing" && (
            <div className="relative z-10 flex flex-col items-center gap-1" data-turn-timer={secs}>
              <div
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-black tabular-nums",
                  secs <= 5 ? "bg-red-600 text-white" : "bg-black/45 text-white",
                )}
              >
                {secs}s
              </div>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/30">
                <div
                  className={cn("h-full rounded-full", secs <= 5 ? "bg-red-400" : "bg-amber-300")}
                  style={{ width: `${Math.min(100, ((leftMs ?? 0) / KAZHUTHAI_TURN_MS) * 100)}%` }}
                />
              </div>
              {state.timedOut && <p className="text-xs font-semibold text-amber-200">Time's up</p>}
            </div>
          )}
          {state.ledSuit && !resolving && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative rounded-full bg-black/30 px-3 py-1 text-xs font-semibold"
            >
              Led suit: <span className={cn("text-base", state.ledSuit === "H" || state.ledSuit === "D" ? "text-red-300" : "text-white")}>{SUIT_SYMBOL[state.ledSuit]}</span>
            </motion.span>
          )}
          <div className="relative flex min-h-28 flex-wrap items-center justify-center gap-2">
            <AnimatePresence>
              {tableCards.map((t, i) => (
                <motion.div
                  key={t.card.id}
                  className="flex flex-col items-center gap-1"
                  exit={{
                    opacity: 0,
                    scale: 0.4,
                    y: resolving?.outcome === "cut" ? (resolving.taker === me ? 220 : -220) : 0,
                    x: resolving?.outcome === "discard" ? 260 : 0,
                    rotate: resolving?.outcome === "discard" ? 40 : 0,
                    transition: { duration: 0.45, delay: i * 0.05 },
                  }}
                >
                  <PlayingCardView
                    card={t.card}
                    size="md"
                    // After a cut the cards are already back in someone's hand; avoid duplicate layout ids.
                    layoutId={resolving?.outcome === "cut" ? undefined : `card-${t.card.id}`}
                    className={cn(resolving?.cutBy === t.playerId && "ring-4 ring-red-500 rounded-lg")}
                  />
                  <span className="max-w-16 truncate text-[10px] text-white/80">{t.playerId === me ? "You" : playerName(players, t.playerId)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {resolving && (
              <motion.div
                key={resolving.key}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "relative rounded-full px-4 py-1.5 text-sm font-bold shadow-lg",
                  resolving.outcome === "cut" ? "bg-red-600" : "bg-black/40",
                )}
              >
                {resolving.outcome === "cut"
                  ? `✂️ Vettu by ${resolving.cutBy === me ? "you" : playerName(players, resolving.cutBy)}! ${resolving.taker === me ? "You pick" : `${playerName(players, resolving.taker)} picks`} up ${resolving.cards.length}`
                  : `Everyone followed. Cards thrown away`}
              </motion.div>
            )}
          </AnimatePresence>
          {tableCards.length === 0 && !resolving && state.status === "playing" && (
            <p className="relative text-sm text-white/70">{state.turn === me ? "Your lead" : `${playerName(players, state.turn)} leads`}</p>
          )}
          <span className="absolute right-8 bottom-3 text-[11px] text-white/60">🗑️ {state.discarded} thrown away</span>
        </div>

        {/* My area (appears once the deal finishes) */}
        {isPlayer && !shuffling && (
          <div className="grid gap-2 px-3">
            <div className="flex items-center justify-center gap-3">
              <PlayerAvatar avatar={players[seatIdx].avatar} seat={players[seatIdx].seat} size="sm" active={myTurn} />
              <TurnBanner
                myTurn={myTurn}
                finished={state.status === "finished"}
                myTurnText={`Your turn${secs !== null ? ` · ${secs}s` : ""} · ${hint}`}
                waitingText={state.finished.includes(me) ? "🎉 You escaped!" : `${playerName(players, state.turn)} is playing…`}
              />
              <span className="text-xs text-white/70">{myHand.length} cards</span>
            </div>
            <div className="flex flex-wrap justify-center px-6 pt-5" style={{ paddingLeft: -overlap }}>
              {myHand.map((c) =>
                isHidden(c) ? null : (
                  <div key={c.id} style={{ marginLeft: overlap }} data-playable={playable.has(c.id) ? "true" : undefined}>
                    <PlayingCardView
                      card={c}
                      size="md"
                      layoutId={`card-${c.id}`}
                      playable={playable.has(c.id)}
                      dimmed={myTurn && !playable.has(c.id)}
                      onClick={
                        playable.has(c.id)
                          ? () => {
                              play("card", 10);
                              send({ type: "play", cardId: c.id });
                            }
                          : undefined
                      }
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </LayoutGroup>
  );
}
