"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { TurnBanner } from "@/components/game/TurnBanner";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import { playerName } from "../helpers";
import type { GameBoardProps } from "../types";
import { Scoreboard } from "../cricket/Scoreboard";
import { currentInnings } from "../cricket/engine";
import type { CoinFace, HandCricketAction, HandCricketState } from "./logic";

const HANDS: Record<number, string> = { 1: "☝️", 2: "✌️", 3: "🤟", 4: "🖖", 5: "🖐️", 6: "👍" };

/** Gold coin. `face` null keeps it spinning; a face lands on that side. */
function TossCoin({ face }: { face: CoinFace | null }) {
  const spinning = face === null;
  const end = face === "tails" ? 1980 : 1800;
  return (
    <div className="mx-auto size-32 [perspective:800px]" data-coin={face ?? "spinning"}>
      <motion.div
        className="relative size-full [transform-style:preserve-3d]"
        animate={{ rotateY: spinning ? [0, 360] : end }}
        transition={spinning ? { duration: 0.45, repeat: Infinity, ease: "linear" } : { duration: 1.15, ease: [0.15, 0.7, 0.2, 1] }}
      >
        <CoinSide side="heads" />
        <CoinSide side="tails" />
      </motion.div>
    </div>
  );
}

function CoinSide({ side }: { side: CoinFace }) {
  const heads = side === "heads";
  return (
    <div
      className={cn(
        "absolute inset-0 grid place-items-center rounded-full border-[6px] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.35),0_10px_24px_rgba(0,0,0,0.35)] [backface-visibility:hidden]",
        heads
          ? "border-amber-100 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 text-amber-950"
          : "border-slate-200 bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-800 [transform:rotateY(180deg)]",
      )}
      aria-hidden
    >
      <div className="flex size-[78%] flex-col items-center justify-center rounded-full border-2 border-dashed border-current/50">
        <span className="text-4xl leading-none">{heads ? "👑" : "🪶"}</span>
        <span className="mt-1 text-[11px] font-black tracking-[0.22em]">{heads ? "HEADS" : "TAILS"}</span>
      </div>
    </div>
  );
}

function HandPicker({ disabled, picked, onPick }: { disabled: boolean; picked: number | null; onPick: (n: number) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <motion.button
          key={n}
          type="button"
          disabled={disabled}
          whileHover={disabled ? undefined : { y: -6, scale: 1.05 }}
          whileTap={disabled ? undefined : { scale: 0.85 }}
          onClick={() => onPick(n)}
          className={cn(
            "flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border-2 bg-card shadow-sm transition-colors",
            picked === n ? "border-primary bg-primary/15" : "border-border",
            disabled && picked !== n && "opacity-40",
          )}
          aria-label={`Show ${n}`}
        >
          <span className="text-3xl sm:text-4xl">{HANDS[n]}</span>
          <span className="text-sm font-bold">{n}</span>
        </motion.button>
      ))}
    </div>
  );
}

/** Two hands slamming in, then the outcome stamp. */
function Reveal({ bat, bowl, out, runs, batterName, bowlerName }: { bat: number; bowl: number; out: boolean; runs: number; batterName: string; bowlerName: string }) {
  return (
    <div className="relative flex items-center justify-center gap-6 py-4">
      {[
        { n: bat, who: batterName, from: -120, label: "🏏" },
        { n: bowl, who: bowlerName, from: 120, label: "🎯" },
      ].map((h, i) => (
        <motion.div
          key={i}
          initial={{ x: h.from, rotate: h.from > 0 ? 40 : -40, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 16 }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-6xl drop-shadow-lg sm:text-7xl">{HANDS[h.n]}</span>
          <span className="text-2xl font-black">{h.n}</span>
          <span className="text-xs text-muted-foreground">
            {h.label} {h.who}
          </span>
        </motion.div>
      ))}
      <motion.div
        initial={{ scale: 3, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: -8 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 14 }}
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 px-4 py-1 text-3xl font-black tracking-wider uppercase shadow-xl",
          out ? "border-destructive bg-destructive text-white" : runs >= 4 ? "border-violet-500 bg-violet-600 text-white" : "border-primary bg-primary text-primary-foreground",
        )}
      >
        {out ? "OUT!" : runs === 6 ? "SIX!" : runs === 4 ? "FOUR!" : `+${runs}`}
      </motion.div>
    </div>
  );
}

export default function HandCricketBoard({ state, me, players, send }: GameBoardProps<HandCricketState, HandCricketAction>) {
  const play = useSound();
  const [showReveal, setShowReveal] = useState(false);
  const lastSeen = useRef(state.lastBall?.moveNo ?? 0);
  const opponent = state.players.find((p) => p.id !== me) ?? state.players[1];

  // Animate each new ball.
  useEffect(() => {
    const lb = state.lastBall;
    if (!lb || lb.moveNo === lastSeen.current) return;
    lastSeen.current = lb.moveNo;
    setShowReveal(true);
    play(lb.out ? "out" : lb.runs >= 4 ? "coin" : "move", lb.out ? [100, 50, 100] : 20);
    const t = setTimeout(() => setShowReveal(false), 2200);
    return () => clearTimeout(t);
  }, [state.lastBall, play]);

  const { phase, toss } = state;
  const finished = state.status === "finished";

  useEffect(() => {
    if (phase !== "choose" || !toss.face) return;
    play("coin");
  }, [phase, toss.face, play]);

  if (phase === "toss-call" || phase === "choose") {
    const caller = playerName(players, toss.caller);
    const faceLabel = toss.face === "heads" ? "Heads" : "Tails";
    const callLabel = toss.call === "heads" ? "Heads" : "Tails";
    return (
      <div className="mx-auto grid w-full max-w-lg gap-5 p-4 max-sm:pt-44" data-toss={phase}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-700 to-emerald-950 p-6 text-center text-white shadow-xl">
          <TossCoin face={phase === "choose" ? toss.face : null} />
          <h2 className="mt-4 text-2xl font-black">Toss time</h2>
          <p className="mt-1 text-sm text-white/80" aria-live="polite">
            {phase === "toss-call" && (toss.caller === me ? "Call it. Heads or tails?" : `${caller} is calling the toss`)}
            {phase === "choose" && `${caller} called ${callLabel}. It's ${faceLabel}.`}
          </p>
        </div>

        {phase === "toss-call" &&
          (toss.caller === me ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                className="h-20 bg-gradient-to-b from-amber-300 to-amber-600 text-xl font-black text-amber-950 hover:from-amber-200 hover:to-amber-500"
                onClick={() => {
                  play("select");
                  send({ type: "call", call: "heads" });
                }}
              >
                <span className="text-2xl" aria-hidden>👑</span> Heads
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-20 text-xl font-black"
                onClick={() => {
                  play("select");
                  send({ type: "call", call: "tails" });
                }}
              >
                <span className="text-2xl" aria-hidden>🪶</span> Tails
              </Button>
            </div>
          ) : (
            <TurnBanner myTurn={false} waitingText={`Waiting for ${caller} to call heads or tails…`} />
          ))}

        {phase === "choose" && (
          <div className="grid gap-3 text-center">
            <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-lg font-bold">
              {toss.winner === me ? "You won the toss! 🎉" : `${playerName(players, toss.winner)} won the toss`}
            </motion.p>
            {toss.winner === me ? (
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" className="h-16 text-lg" onClick={() => send({ type: "choose", choice: "bat" })}>
                  🏏 Bat first
                </Button>
                <Button size="lg" variant="secondary" className="h-16 text-lg" onClick={() => send({ type: "choose", choice: "bowl" })}>
                  🎯 Bowl first
                </Button>
              </div>
            ) : (
              <TurnBanner myTurn={false} waitingText="Waiting for their choice…" />
            )}
          </div>
        )}
      </div>
    );
  }

  const core = state.cricket!;
  const inn = currentInnings(core);
  const myPick = state.picks[me];
  const oppPick = state.picks[opponent.id];
  const role = inn.batter === me ? "batting" : inn.bowler === me ? "bowling" : null;
  const lb = state.lastBall;

  return (
    <div className="mx-auto grid w-full max-w-lg gap-4 p-4 pb-24">
      <Scoreboard core={core} players={players} />

      <div className="relative min-h-44 rounded-3xl border border-border bg-card p-2 shadow-sm">
        <AnimatePresence mode="wait">
          {showReveal && lb ? (
            <motion.div key={`r${lb.moveNo}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Reveal
                bat={lb.bat}
                bowl={lb.bowl}
                out={lb.out}
                runs={lb.runs}
                batterName={playerName(players, lb.batter)}
                bowlerName={playerName(players, lb.bowler)}
              />
            </motion.div>
          ) : (
            <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-40 items-center justify-around">
              {[me, opponent.id].map((id) => {
                const p = players.find((pl) => pl.id === id);
                const pick = state.picks[id];
                if (!p) return null;
                return (
                  <div key={id} className="flex flex-col items-center gap-2">
                    <PlayerAvatar avatar={p.avatar} seat={p.seat} name={p.name} showName active={pick === null && !finished} />
                    <motion.div
                      animate={pick !== null ? { rotate: [0, -10, 10, 0] } : { y: [0, -6, 0] }}
                      transition={{ duration: pick !== null ? 0.4 : 1.2, repeat: pick !== null ? 0 : Infinity }}
                      className="text-4xl"
                    >
                      {pick === null ? "🤔" : id === me && pick > 0 ? HANDS[pick] : "✊"}
                    </motion.div>
                    <span className="text-xs text-muted-foreground">{pick === null ? "choosing…" : "ready!"}</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {role && !finished && (
        <>
          <TurnBanner
            myTurn={myPick === null}
            finished={finished}
            myTurnText={role === "batting" ? "🏏 You're batting: pick a number" : "🎯 You're bowling: guess their number"}
            waitingText={oppPick === null ? `Waiting for ${opponent.name}…` : "Revealing…"}
          />
          <HandPicker
            disabled={myPick !== null || showReveal}
            picked={myPick && myPick > 0 ? myPick : null}
            onPick={(n) => {
              play("tap", 15);
              send({ type: "pick", n });
            }}
          />
        </>
      )}
    </div>
  );
}
