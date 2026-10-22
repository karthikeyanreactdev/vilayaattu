"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { TurnBanner } from "@/components/game/TurnBanner";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import type { PlayerId, PlayerRef } from "../types";
import { goatMoves, tigerMoves, type AaduPuliAction, type AaduPuliState } from "./logic";

/** Selection, highlights and taps shared by the 2D and 3D Aadu Puli boards. */
export function useAaduPuliControls(state: AaduPuliState, me: PlayerId, send: (action: AaduPuliAction) => void) {
  const play = useSound();
  const [selected, setSelected] = useState<number | null>(null);
  const role: "T" | "G" | null = me === state.tiger ? "T" : me === state.goat ? "G" : null;
  const myTurn = role !== null && role === state.turn && state.status === "playing";
  const placing = role === "G" && state.goatsInHand > 0;
  const lastMoveNo = useRef(state.moveNo);

  // Sounds for each move.
  useEffect(() => {
    if (state.moveNo === lastMoveNo.current) return;
    lastMoveNo.current = state.moveNo;
    const lm = state.lastMove;
    if (lm?.captured !== null && lm?.captured !== undefined) play("capture", [60, 30, 60]);
    else play("move");
    setSelected(null);
  }, [state.moveNo, state.lastMove, play]);

  const targets = useMemo(() => {
    if (!myTurn) return new Map<number, boolean>();
    const m = new Map<number, boolean>();
    if (placing) {
      state.board.forEach((c, i) => c === null && m.set(i, false));
    } else if (selected !== null) {
      if (role === "T") tigerMoves(state.board, selected).forEach((mv) => m.set(mv.to, mv.over !== null));
      else goatMoves(state.board, selected).forEach((to) => m.set(to, false));
    }
    return m;
  }, [myTurn, placing, selected, role, state.board]);

  const movable = useMemo(() => {
    const s = new Set<number>();
    if (!myTurn || placing) return s;
    state.board.forEach((c, i) => {
      if (c !== role) return;
      const has = role === "T" ? tigerMoves(state.board, i).length > 0 : goatMoves(state.board, i).length > 0;
      if (has) s.add(i);
    });
    return s;
  }, [myTurn, placing, role, state.board]);

  const tap = (p: number) => {
    if (!myTurn) return;
    if (placing) {
      if (state.board[p] === null) send({ type: "place", to: p });
      return;
    }
    if (state.board[p] === role && movable.has(p)) {
      play("select");
      setSelected(p === selected ? null : p);
      return;
    }
    if (selected !== null && targets.has(p)) send({ type: "move", from: selected, to: p });
  };

  return { role, myTurn, placing, selected, targets, movable, tap };
}

/** Player cards and the turn banner above the board. */
export function AaduPuliHeader({
  state,
  me,
  players,
  myTurn,
  placing,
  selected,
  role,
}: {
  state: AaduPuliState;
  me: PlayerId;
  players: PlayerRef[];
  myTurn: boolean;
  placing: boolean;
  selected: number | null;
  role: "T" | "G" | null;
}) {
  const tiger = players.find((p) => p.id === state.tiger)!;
  const goat = players.find((p) => p.id === state.goat)!;
  const waiting = state.turn === "T" ? `${tiger.name}'s tigers are thinking…` : `${goat.name}'s goats are thinking…`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[
          { p: tiger, label: "🐯 Tigers", stat: `${state.captured}/${state.captureGoal} captured`, active: state.turn === "T" },
          { p: goat, label: "🐐 Goats", stat: state.goatsInHand > 0 ? `${state.goatsInHand} to place` : `${15 - state.captured} on board`, active: state.turn === "G" },
        ].map(({ p, label, stat, active }) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-card p-3 transition-colors",
              active && state.status === "playing" ? "border-primary shadow-md shadow-primary/10" : "border-border",
            )}
          >
            <PlayerAvatar avatar={p.avatar} seat={p.seat} size="sm" active={active && state.status === "playing"} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {label}
                {p.id === me && " (you)"}
              </p>
              <p className="text-xs text-muted-foreground">{stat}</p>
            </div>
          </div>
        ))}
      </div>

      <TurnBanner
        myTurn={myTurn}
        finished={state.status === "finished"}
        myTurnText={placing ? "Place a goat on any empty point" : selected === null ? `Tap one of your ${role === "T" ? "tigers" : "goats"}` : "Tap a glowing point to move"}
        waitingText={waiting}
      />
    </>
  );
}

/** Row of goats under the board, crossed out as they are captured. */
export function CaptureTally({ captured, captureGoal }: { captured: number; captureGoal: number }) {
  return (
    <div className="flex items-center justify-center gap-1" aria-label={`${captured} goats captured`}>
      {Array.from({ length: captureGoal }).map((_, i) => (
        <motion.span key={i} animate={i < captured ? { scale: [1.6, 1], opacity: 1 } : { opacity: 0.25 }} className="text-xl">
          {i < captured ? "❌" : "🐐"}
        </motion.span>
      ))}
    </div>
  );
}
