"use client";

import { AnimatePresence, motion } from "motion/react";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { cn } from "@/lib/utils";
import type { PlayerRef } from "../types";
import { currentInnings, formatOvers, type Ball, type CricketCore } from "./engine";

function BallChip({ ball }: { ball: Ball }) {
  const style = ball.out
    ? "bg-destructive text-white"
    : ball.label === "NB"
      ? "bg-warning text-black"
      : ball.runs >= 6
        ? "bg-violet-600 text-white"
        : ball.runs >= 4
          ? "bg-sky-600 text-white"
          : ball.runs === 0
            ? "bg-white/15 text-white/70"
            : "bg-white/90 text-black";
  return (
    <motion.span
      layout
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", style)}
    >
      {ball.label}
    </motion.span>
  );
}

/** TV-style scoreboard shared by the cricket games. */
export function Scoreboard({ core, players }: { core: CricketCore; players: PlayerRef[] }) {
  const inn = currentInnings(core);
  const batter = players.find((p) => p.id === inn.batter)!;
  const bowler = players.find((p) => p.id === inn.bowler)!;
  const need = core.target !== null ? core.target - inn.runs : null;
  const ballsLeft = core.maxBalls > 0 ? core.maxBalls - inn.balls : null;
  const recent = inn.log.slice(-8);

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl ring-1 ring-white/10">
      <div className="flex items-center gap-3 p-4">
        <PlayerAvatar avatar={batter.avatar} seat={batter.seat} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/60">🏏 {batter.name} batting</p>
          <div className="flex items-baseline gap-2">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${inn.runs}-${inn.wickets}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="text-4xl font-black tabular-nums"
              >
                {inn.runs}/{inn.wickets}
              </motion.span>
            </AnimatePresence>
            <span className="text-sm text-white/60 tabular-nums">
              ({formatOvers(inn.balls)}
              {core.maxBalls ? ` / ${core.maxBalls / 6}` : ""} ov)
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">Innings</p>
          <p className="text-lg font-bold">{core.current + 1}/2</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-4 py-2 text-xs">
        <span className="text-white/60">🎯 {bowler.name} bowling</span>
        <span className="ml-auto font-semibold">
          {need !== null ? (
            <>
              Need <span className="text-amber-300">{Math.max(0, need)}</span>
              {ballsLeft !== null && <> from {ballsLeft}</>}
            </>
          ) : (
            <>Wickets: {core.maxWickets}</>
          )}
        </span>
      </div>
      <div className="flex min-h-11 items-center gap-1.5 overflow-x-auto px-4 py-2">
        {recent.length === 0 ? (
          <span className="text-xs text-white/50">First ball coming up…</span>
        ) : (
          recent.map((b, i) => <BallChip key={inn.log.length - recent.length + i} ball={b} />)
        )}
      </div>
      {core.current === 1 && (
        <div className="border-t border-white/10 px-4 py-1.5 text-[11px] text-white/60">
          1st innings: {players.find((p) => p.id === core.innings[0].batter)?.name} {core.innings[0].runs}/
          {core.innings[0].wickets} · Target {core.target}
        </div>
      )}
    </div>
  );
}
