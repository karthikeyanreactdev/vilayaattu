"use client";

import { AnimatePresence, motion } from "motion/react";
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TurnBanner } from "@/components/game/TurnBanner";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import { playerName } from "../helpers";
import type { GameBoardProps } from "../types";
import { Scoreboard } from "../cricket/Scoreboard";
import { currentInnings } from "../cricket/engine";
import type { BookCricketAction, BookCricketState } from "./logic";

const FLIP_MS = 900;

/** An open notebook. While flipping, pages riffle over in 3D. */
function Book({ page, flipping, outcome }: { page: number | null; flipping: boolean; outcome: string | null }) {
  const left = page ?? 0;
  const digit = left % 10;
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-sm [perspective:1200px]">
      {/* spine shadow + covers */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-rose-800 via-rose-900 to-rose-800 shadow-2xl" />
      <div className="absolute inset-2 flex overflow-hidden rounded-lg">
        {/* left page */}
        <div className="relative flex flex-1 flex-col justify-between bg-[repeating-linear-gradient(#fdfaf2_0_22px,#cbd5e1_22px_23px)] p-3 text-slate-800 shadow-[inset_-12px_0_18px_-12px_rgba(0,0,0,0.35)]">
          <span className="text-[10px] text-slate-400">Std. VIII · Science</span>
          <AnimatePresence mode="wait">
            {page !== null && !flipping && (
              <motion.div
                key={page}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="self-start font-mono text-4xl font-black tabular-nums sm:text-5xl"
              >
                {String(left).slice(0, -1)}
                <motion.span
                  className={cn("inline-block rounded px-0.5", digit === 0 ? "bg-red-500 text-white" : digit === 8 ? "bg-amber-400" : "bg-emerald-500 text-white")}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                >
                  {digit}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* right page */}
        <div className="relative flex flex-1 flex-col items-end justify-between bg-[repeating-linear-gradient(#fdfaf2_0_22px,#cbd5e1_22px_23px)] p-3 text-slate-500 shadow-[inset_12px_0_18px_-12px_rgba(0,0,0,0.35)]">
          <span className="text-[10px]">Chapter {page ? Math.ceil(page / 40) : 1}</span>
          {page !== null && !flipping && <span className="font-mono text-xl tabular-nums">{left + 1}</span>}
        </div>
        {/* riffling pages */}
        {flipping &&
          Array.from({ length: 7 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute top-0 right-0 h-full w-1/2 origin-left rounded-r-md bg-[#fdfaf2] shadow-md"
              style={{ transformStyle: "preserve-3d" }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: -180 }}
              transition={{ delay: i * 0.09, duration: 0.45, ease: "easeInOut" }}
            />
          ))}
      </div>
      <AnimatePresence>
        {outcome && !flipping && (
          <motion.div
            key={`${page}-${outcome}`}
            initial={{ scale: 3, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: -10 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 14 }}
            className={cn(
              "absolute -top-4 -right-3 rounded-xl border-4 px-3 py-1 text-2xl font-black uppercase shadow-xl",
              outcome === "OUT!" ? "border-red-700 bg-red-600 text-white" : outcome === "NO BALL" ? "border-amber-600 bg-amber-400 text-black" : "border-emerald-700 bg-emerald-600 text-white",
            )}
          >
            {outcome}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BookCricketBoard({ state, me, players, send }: GameBoardProps<BookCricketState, BookCricketAction>) {
  const play = useSound();
  const [flipping, setFlipping] = useState(false);
  const seen = useRef(state.lastFlip?.moveNo ?? 0);
  const inn = currentInnings(state.cricket);
  const finished = state.status === "finished";
  const myBat = inn.batter === me && !finished;
  const lf = state.lastFlip;

  useEffect(() => {
    if (!lf || lf.moveNo === seen.current) return;
    seen.current = lf.moveNo;
    setFlipping(true);
    play("flip");
    const t = setTimeout(() => {
      setFlipping(false);
      play(lf.out ? "out" : lf.runs >= 4 ? "coin" : "card", lf.out ? [100, 50, 100] : 20);
    }, FLIP_MS);
    return () => clearTimeout(t);
  }, [lf, play]);

  const outcome = lf ? (lf.out ? "OUT!" : lf.noBall ? "NO BALL" : lf.runs === 6 ? "SIX!" : lf.runs === 4 ? "FOUR!" : `${lf.runs} RUNS`) : null;

  return (
    <div className="mx-auto grid w-full max-w-lg gap-5 p-4 pb-24">
      {state.moveNo === 0 && (
        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center text-sm text-muted-foreground">
          🪙 {playerName(players, state.tossWinner)} won the toss and bats first
        </motion.p>
      )}
      <Scoreboard core={state.cricket} players={players} />
      <Book page={lf?.page ?? null} flipping={flipping} outcome={outcome} />
      <TurnBanner
        myTurn={myBat}
        finished={finished}
        myTurnText="🏏 Your bat. Flip the book!"
        waitingText={`${playerName(players, inn.batter)} is flipping…`}
      />
      {myBat && (
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            size="lg"
            className="h-14 w-full text-lg shadow-lg shadow-primary/30"
            disabled={flipping}
            onClick={() => {
              play("tap", 15);
              send({ type: "flip" });
            }}
          >
            <BookOpen /> Flip the book
          </Button>
        </motion.div>
      )}
      <p className="text-center text-xs text-muted-foreground">0 = OUT · 2 / 4 / 6 = runs · 8 = No-ball (+1)</p>
    </div>
  );
}
