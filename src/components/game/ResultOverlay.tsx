"use client";

import { AnimatePresence, motion } from "motion/react";
import { Home, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import type { GameResult, PlayerRef } from "@/games/types";
import { useSound } from "@/hooks/useSound";
import { Confetti } from "./Confetti";

type Props = {
  result: GameResult | null;
  me: string;
  players: PlayerRef[];
  isHost: boolean;
  onRematch: () => void;
  onLobby: () => void;
};

/** End-of-game card: winner reveal, scores and host controls. */
export function ResultOverlay({ result, me, players, isHost, onRematch, onLobby }: Props) {
  const play = useSound();
  const [hidden, setHidden] = useState(false);
  const shownFor = useRef<GameResult | null>(null);
  const iWon = Boolean(result?.winners.includes(me));
  const iLost = Boolean(result && (result.loser === me || (result.winners.length > 0 && !iWon)));

  useEffect(() => {
    if (!result || shownFor.current === result) return;
    shownFor.current = result;
    const t = setTimeout(() => {
      setHidden(false);
      play(iWon ? "win" : iLost ? "lose" : "turn", iWon ? [60, 40, 120] : 80);
    }, 700);
    return () => clearTimeout(t);
  }, [result, iWon, iLost, play]);

  const open = Boolean(result) && !hidden;

  return (
    <AnimatePresence>
      {open && result && (
        <motion.div
          key="result"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.7 }}
        >
          {iWon && <Confetti />}
          <motion.div
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.8 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-popover p-6 text-center shadow-2xl"
            role="dialog"
            aria-label="Game result"
          >
            <button
              type="button"
              onClick={() => setHidden(true)}
              className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Hide result to see the board"
            >
              <X className="size-4" />
            </button>
            <motion.div
              className="mx-auto text-6xl"
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 12, delay: 1 }}
            >
              {iWon ? "🏆" : result.winners.length === 0 && !result.loser ? "🤝" : iLost ? "😅" : "🎉"}
            </motion.div>
            <h2 className="mt-3 text-2xl font-extrabold">{iWon ? "You win!" : result.title}</h2>
            {result.detail && <p className="mt-1 text-sm text-muted-foreground">{result.detail}</p>}

            {result.scores && (
              <ul className="mt-5 grid gap-2 text-left">
                {result.scores.map((s, i) => {
                  const p = players.find((pl) => pl.id === s.playerId);
                  if (!p) return null;
                  const won = result.winners.includes(p.id);
                  return (
                    <motion.li
                      key={s.playerId + i}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 1.1 + i * 0.08 }}
                      className={`flex items-center gap-3 rounded-xl border p-2 ${won ? "border-primary/40 bg-primary/10" : "border-border"}`}
                    >
                      <PlayerAvatar avatar={p.avatar} seat={p.seat} size="sm" />
                      <span className="flex-1 truncate text-sm font-medium">
                        {p.name}
                        {p.id === me && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{s.label}</span>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            <div className="mt-6 grid gap-2">
              {isHost ? (
                <>
                  <Button size="lg" onClick={onRematch} className="h-11">
                    <RotateCcw /> Play again
                  </Button>
                  <Button size="lg" variant="outline" onClick={onLobby} className="h-11">
                    <Home /> Choose another game
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for the host to start the next game…</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      {result && hidden && (
        <motion.button
          key="show"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          onClick={() => setHidden(false)}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xl"
        >
          Show result
        </motion.button>
      )}
    </AnimatePresence>
  );
}
