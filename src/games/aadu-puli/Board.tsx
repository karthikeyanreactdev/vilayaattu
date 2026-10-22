"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { GameBoardProps } from "../types";
import { COORDS, SEGMENTS } from "./board";
import { AaduPuliHeader, CaptureTally, useAaduPuliControls } from "./controls";
import type { AaduPuliAction, AaduPuliState } from "./logic";

const SPRING = { type: "spring", stiffness: 260, damping: 24 } as const;

function Piece({ kind, x, y, selected, jump }: { kind: "T" | "G"; x: number; y: number; selected: boolean; jump: boolean }) {
  return (
    <motion.g
      initial={{ x, y, scale: 0 }}
      animate={{ x, y, scale: selected ? 1.25 : 1 }}
      exit={{ scale: 0, opacity: 0, rotate: 90 }}
      transition={jump ? { ...SPRING, stiffness: 180 } : SPRING}
      style={{ pointerEvents: "none" }}
    >
      <circle r={5.4} fill={kind === "T" ? "url(#tigerGrad)" : "url(#goatGrad)"} stroke={selected ? "#facc15" : "rgba(0,0,0,0.35)"} strokeWidth={selected ? 1.2 : 0.6} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={6} y={0.3}>
        {kind === "T" ? "🐯" : "🐐"}
      </text>
    </motion.g>
  );
}

export default function AaduPuliBoard({ state, me, players, send }: GameBoardProps<AaduPuliState, AaduPuliAction>) {
  const { role, myTurn, placing, selected, targets, movable, tap } = useAaduPuliControls(state, me, send);
  const lm = state.lastMove;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3 p-4 pb-24">
      <AaduPuliHeader state={state} me={me} players={players} myTurn={myTurn} placing={placing} selected={selected} role={role} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-amber-100 to-amber-200 p-2 shadow-xl ring-1 ring-amber-900/20 dark:from-stone-800 dark:to-stone-900"
      >
        <svg viewBox="-6 -2 112 108" className="w-full touch-manipulation select-none">
          <defs>
            <radialGradient id="tigerGrad" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#ea580c" />
            </radialGradient>
            <radialGradient id="goatGrad" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#d6d3d1" />
            </radialGradient>
          </defs>
          {SEGMENTS.map(([a, b], i) => (
            <motion.line
              key={i}
              x1={COORDS[a].x}
              y1={COORDS[a].y}
              x2={COORDS[b].x}
              y2={COORDS[b].y}
              className="stroke-amber-900/70 dark:stroke-amber-200/50"
              strokeWidth={0.9}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: i * 0.02 }}
            />
          ))}
          {lm && lm.from !== null && (
            <line
              x1={COORDS[lm.from].x}
              y1={COORDS[lm.from].y}
              x2={COORDS[lm.to].x}
              y2={COORDS[lm.to].y}
              stroke="#facc15"
              strokeWidth={2.2}
              strokeLinecap="round"
              opacity={0.6}
            />
          )}
          {COORDS.map((c, i) => {
            const isTarget = targets.has(i);
            const isCapture = targets.get(i) === true;
            const canPick = movable.has(i);
            return (
              <g key={i} onClick={() => tap(i)} className={cn((isTarget || canPick) && "cursor-pointer")}>
                <circle cx={c.x} cy={c.y} r={7} fill="transparent" />
                <circle cx={c.x} cy={c.y} r={1.6} className="fill-amber-900/80 dark:fill-amber-200/70" />
                {isTarget && (
                  <motion.circle
                    cx={c.x}
                    cy={c.y}
                    r={4}
                    fill={isCapture ? "rgba(239,68,68,0.35)" : "rgba(250,204,21,0.45)"}
                    stroke={isCapture ? "#ef4444" : "#ca8a04"}
                    strokeWidth={0.6}
                    initial={{ scale: 0 }}
                    animate={{ scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ transformOrigin: `${c.x}px ${c.y}px` }}
                  />
                )}
                {canPick && selected !== i && (
                  <motion.circle
                    cx={c.x}
                    cy={c.y}
                    r={6.6}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={0.6}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
              </g>
            );
          })}
          <AnimatePresence>
            {state.pieceIds.map((id, i) =>
              id && state.board[i] ? (
                <Piece
                  key={id}
                  kind={state.board[i] as "T" | "G"}
                  x={COORDS[i].x}
                  y={COORDS[i].y}
                  selected={selected === i}
                  jump={lm?.to === i && lm.captured !== null}
                />
              ) : null,
            )}
          </AnimatePresence>
        </svg>
      </motion.div>

      <CaptureTally captured={state.captured} captureGoal={state.captureGoal} />
    </div>
  );
}
