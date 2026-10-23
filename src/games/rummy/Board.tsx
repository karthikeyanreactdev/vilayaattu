"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { LogOut, Trash2, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SeatRow } from "@/components/game/SeatRow";
import { TurnBanner } from "@/components/game/TurnBanner";
import { useNow } from "@/hooks/useNow";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import { playerName } from "../helpers";
import type { GameBoardProps } from "../types";
import { ShuffleDeal } from "../cards/ShuffleDeal";
import { rankLabel, SUITS, type PlayingCard } from "../cards/deck";
import { CardBack, PlayingCardView } from "../cards/PlayingCardView";
import { CARD_SIZE } from "../cards/cardSizes";
import { checkHand, isJoker } from "./melds";
import { arrangeHand } from "./arrange";
import { HandGroups } from "./HandGroups";
import { RUMMY_TURN_MS, type RummyAction, type RummyState } from "./logic";

function sortedGroups(cards: PlayingCard[], jokerRank: number): string[][] {
  const groups: string[][] = [];
  for (const suit of SUITS) {
    const g = cards.filter((c) => c.suit === suit && !isJoker(c, jokerRank)).sort((a, b) => a.rank - b.rank);
    if (g.length) groups.push(g.map((c) => c.id));
  }
  const jokers = cards.filter((c) => isJoker(c, jokerRank));
  if (jokers.length) groups.push(jokers.map((c) => c.id));
  return groups;
}

export default function RummyBoard({ state, me, players, send, clockOffset }: GameBoardProps<RummyState, RummyAction>) {
  const play = useSound();
  const now = useNow(state.status === "playing" && typeof state.deadline === "number", 200);
  // A fresh game starts with a shuffle and deal.
  const [shuffling, setShuffling] = useState(state.moveNo === 0);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | "declare" | "drop">(null);
  const lastMove = useRef(state.moveNo);

  const seatIdx = Math.max(0, state.players.findIndex((p) => p.id === me));
  const isPlayer = state.players.some((p) => p.id === me) && state.status_[me] === "playing";
  const opponents = useMemo(
    () => [...state.players.slice(seatIdx + 1), ...state.players.slice(0, seatIdx)].filter((p) => p.id !== me),
    [state.players, seatIdx, me],
  );
  const myCards = useMemo(() => (state.hands[me] ?? []) as PlayingCard[], [state.hands, me]);
  const byId = useMemo(() => new Map(myCards.map((c) => [c.id, c])), [myCards]);
  const groups = useMemo(
    () => (state.groups[me] ?? []).map((g) => g.map((id) => byId.get(id)).filter((c): c is PlayingCard => Boolean(c))),
    [state.groups, me, byId],
  );
  const turnId = state.players[state.turn]?.id;
  const myTurn = isPlayer && turnId === me && state.status === "playing";
  const openTop = state.discard[state.discard.length - 1];

  useEffect(() => {
    if (state.moveNo === lastMove.current) return;
    lastMove.current = state.moveNo;
    setSelected((s) => s.filter((id) => byId.has(id)));
    const ev = state.lastEvent;
    if (ev && ev.n === state.moveNo) play(ev.text.includes("drew") || ev.text.includes("picked") ? "deal" : ev.text.includes("wrong") ? "error" : "card", 10);
  }, [state.moveNo, state.lastEvent, byId, play]);

  const check = useMemo(() => checkHand(groups, state.jokerRank), [groups, state.jokerRank]);
  // When holding 14 cards, preview a declaration without the selected card.
  const declarePreview = useMemo(() => {
    if (selected.length !== 1 || myCards.length !== 14) return null;
    const without = groups.map((g) => g.filter((c) => c.id !== selected[0])).filter((g) => g.length);
    return checkHand(without, state.jokerRank);
  }, [selected, myCards.length, groups, state.jokerRank]);

  const toggle = (id: string) => {
    play("tap");
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const arrange = (next: string[][]) => send({ type: "arrange", groups: next.filter((g) => g.length) });

  const makeGroup = () => {
    const rest = (state.groups[me] ?? []).map((g) => g.filter((id) => !selected.includes(id)));
    arrange([...rest, selected]);
    setSelected([]);
    play("select");
  };

  const moveInto = (gi: number) => {
    const target = state.groups[me][gi];
    const rest = state.groups[me].map((g, i) => (i === gi ? [...g.filter((id) => !selected.includes(id)), ...selected.filter((id) => !g.includes(id))] : g.filter((id) => !selected.includes(id))));
    if (!target) return;
    arrange(rest);
    setSelected([]);
    play("select");
  };

  const one = selected.length === 1 ? selected[0] : null;
  const phaseText = state.phase === "draw" ? "Draw from the deck or open pile" : one ? "Discard or declare with the selected card" : "Select one card to discard";
  const leftMs = typeof state.deadline === "number" ? Math.max(0, state.deadline - (now + clockOffset)) : null;
  const secs = leftMs === null ? null : Math.ceil(leftMs / 1000);

  return (
    <LayoutGroup>
      <div className="felt relative flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col gap-2 pb-6 text-white">
        {shuffling && <ShuffleDeal seats={players.length} back={<CardBack />} onDone={() => setShuffling(false)} />}
        <SeatRow
          className="pt-3"
          players={opponents}
          activeId={state.status === "playing" ? turnId : null}
          dim={(p) => state.status_[p.id] !== "playing"}
          caption={(p) =>
            state.status_[p.id] === "dropped" ? "Dropped" : state.status_[p.id] === "wrong-show" ? "Wrong show" : `${state.counts[p.id]} cards`
          }
          extra={(p) => (
            <div className="relative h-9" style={{ width: Math.min(state.counts[p.id], 14) * 2.5 + 24 }}>
              {(state.hands[p.id] ?? []).slice(0, 14).map((c, i) => (
                <PlayingCardView key={c.id} card={c} size="xs" layoutId={`r-${c.id}`} className="absolute top-0" style={{ left: i * 2.5 }} />
              ))}
            </div>
          )}
        />

        {secs !== null && state.status === "playing" && (
          <div className="flex flex-col items-center gap-1" data-turn-timer={secs}>
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
                style={{ width: `${Math.min(100, ((leftMs ?? 0) / RUMMY_TURN_MS) * 100)}%` }}
              />
            </div>
            {state.timedOut === turnId && <p className="text-xs font-semibold text-amber-200">Time's up</p>}
          </div>
        )}

        {/* Piles */}
        <div className="flex items-center justify-center gap-6 py-3 sm:gap-10">
          <div className="flex flex-col items-center gap-1">
            <motion.button
              type="button"
              disabled={!myTurn || state.phase !== "draw"}
              whileHover={myTurn && state.phase === "draw" ? { y: -4 } : undefined}
              whileTap={myTurn && state.phase === "draw" ? { scale: 0.94 } : undefined}
              onClick={() => send({ type: "draw", from: "stock" })}
              className={cn("relative", CARD_SIZE.md, myTurn && state.phase === "draw" && "ring-4 ring-amber-300/80")}
              aria-label="Draw from the closed deck"
            >
              {[3, 2, 1, 0].map((i) => (
                <div key={i} className="absolute inset-0 rounded-lg" style={{ transform: `translate(${-i * 1.5}px, ${-i * 1.5}px)` }}>
                  <CardBack />
                </div>
              ))}
            </motion.button>
            <span className="text-[11px] text-white/70">Deck · {state.stockCount}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className={cn("relative border-2 border-dashed border-white/30", CARD_SIZE.md)}>
              <AnimatePresence>
                {openTop && (
                  <motion.div key={openTop.id} className="absolute inset-0" exit={{ opacity: 0, transition: { delay: 0.3 } }}>
                    <PlayingCardView
                      card={openTop}
                      size="md"
                      layoutId={`r-${openTop.id}`}
                      wild={isJoker(openTop, state.jokerRank)}
                      playable={myTurn && state.phase === "draw"}
                      onClick={myTurn && state.phase === "draw" ? () => send({ type: "draw", from: "discard" }) : undefined}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="text-[11px] text-white/70">Open pile</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <PlayingCardView card={state.jokerCard} size="sm" className="rotate-12" />
              <span className="absolute -top-2 -right-2 rounded-full bg-fuchsia-600 px-1.5 text-[10px] font-black">★</span>
            </div>
            <span className="text-[11px] text-white/70">Wild: {rankLabel(state.jokerRank)}s</span>
          </div>
        </div>

        {state.lastEvent && (
          <p className="text-center text-xs text-white/70">
            {state.lastEvent.by === me ? "You" : playerName(players, state.lastEvent.by)} {state.lastEvent.text}
          </p>
        )}

        {/* My hand */}
        {shuffling ? null : isPlayer ? (
          <div className="mt-auto grid gap-3 px-2">
            <TurnBanner myTurn={myTurn} finished={state.status === "finished"} myTurnText={phaseText} waitingText={`${playerName(players, turnId)}'s turn`} />

            <HandGroups
              groups={groups}
              keys={(state.groups[me] ?? []).map((g) => g.join())}
              jokerRank={state.jokerRank}
              selected={selected}
              onToggle={toggle}
              onMoveInto={moveInto}
              onNewGroup={makeGroup}
              onClear={() => setSelected([])}
              onAutoArrange={() => {
                play("deal");
                arrange(arrangeHand(myCards, state.jokerRank).groups.map((g) => g.map((c) => c.id)));
                setSelected([]);
              }}
              onSort={() => {
                play("card");
                arrange(sortedGroups(myCards, state.jokerRank));
              }}
              actions={
                myTurn && state.phase === "discard" ? (
                  <>
                    <Button
                      size="xs"
                      disabled={!one || one === state.drewFromDiscard}
                      onClick={() => {
                        send({ type: "discard", cardId: one! });
                        setSelected([]);
                      }}
                    >
                      <Trash2 /> Discard
                    </Button>
                    <Button size="xs" className="bg-amber-500 text-black hover:bg-amber-400" disabled={!one} onClick={() => setConfirm("declare")}>
                      <Trophy /> Declare
                    </Button>
                  </>
                ) : myTurn && state.phase === "draw" ? (
                  <Button size="xs" variant="destructive" className="bg-red-600/80 text-white" onClick={() => setConfirm("drop")}>
                    <LogOut /> Drop
                  </Button>
                ) : null
              }
            />
            <p className="text-center text-xs text-white/75">
              {declarePreview
                ? declarePreview.valid
                  ? "✅ Ready to declare with this card!"
                  : `Declare check: ${declarePreview.reason}`
                : check.valid
                  ? "✅ All groups valid"
                  : `Points in hand: ${check.points} · ${check.reason}`}
            </p>
          </div>
        ) : (
          <p className="mt-auto pb-4 text-center text-sm text-white/80">
            {state.status_[me] === "dropped" ? "You dropped this round. Watch the others finish." : state.status_[me] === "wrong-show" ? "Wrong declaration. You're out this round." : ""}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "declare" ? "Declare now?" : "Drop this round?"}
        description={
          confirm === "declare"
            ? declarePreview?.valid
              ? "Your groups look valid. The selected card will be discarded face down."
              : `Careful: ${declarePreview?.reason ?? "check your groups"} A wrong declaration costs 80 points.`
            : `You'll lose ${state.turnsTaken[me] === 0 ? 20 : 40} points and sit out the rest of this round.`
        }
        confirmLabel={confirm === "declare" ? "Declare" : "Drop"}
        destructive={confirm === "drop" || !declarePreview?.valid}
        onConfirm={() => {
          if (confirm === "declare" && one) send({ type: "declare", cardId: one });
          if (confirm === "drop") send({ type: "drop" });
          setConfirm(null);
          setSelected([]);
        }}
      />
    </LayoutGroup>
  );
}
