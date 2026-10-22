"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { TurnBanner } from "@/components/game/TurnBanner";
import { ANIMATION } from "@/config/constants";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import type { GameBoardProps, PlayerId } from "../types";
import { ownerOfPit, SIDE, type PallanguzhiAction, type PallanguzhiState } from "./logic";

type Display = {
  pits: number[];
  stores: Record<PlayerId, number>;
  active: number | null;
  hand: number;
  flash: { pit: number; kind: "pasu" | "capture" } | null;
};

/** Deterministic scatter so seeds don't jump around between renders. */
function seedSpots(count: number, pit: number) {
  const spots: { x: number; y: number; r: number }[] = [];
  const shown = Math.min(count, 14);
  for (let i = 0; i < shown; i++) {
    const a = (i * 2.399 + pit) % (Math.PI * 2);
    const d = 8 + ((i * 37 + pit * 11) % 26);
    spots.push({ x: 50 + Math.cos(a) * d, y: 50 + Math.sin(a) * d, r: (i * 47 + pit * 13) % 180 });
  }
  return spots;
}

function Pit({
  count,
  index,
  mine,
  playable,
  active,
  flash,
  hand,
  onClick,
}: {
  count: number;
  index: number;
  mine: boolean;
  playable: boolean;
  active: boolean;
  flash: "pasu" | "capture" | null;
  hand: number;
  onClick: () => void;
}) {
  const spots = useMemo(() => seedSpots(count, index), [count, index]);
  return (
    <motion.button
      type="button"
      disabled={!playable}
      onClick={onClick}
      whileHover={playable ? { scale: 1.06 } : undefined}
      whileTap={playable ? { scale: 0.92 } : undefined}
      animate={flash ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      className={cn(
        "relative aspect-square w-full rounded-full shadow-[inset_0_6px_14px_rgba(0,0,0,0.55),inset_0_-2px_4px_rgba(255,255,255,0.15)] transition-[box-shadow]",
        "bg-[radial-gradient(circle_at_50%_40%,oklch(0.42_0.08_50),oklch(0.28_0.06_45))]",
        playable && "cursor-pointer ring-2 ring-glow/70 ring-offset-2 ring-offset-transparent",
        active && "ring-4 ring-glow",
        flash === "capture" && "ring-4 ring-emerald-400",
        flash === "pasu" && "ring-4 ring-sky-400",
      )}
      aria-label={`${mine ? "Your" : "Opponent"} pit ${index + 1}: ${count} seeds`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <AnimatePresence>
          {spots.map((s, i) => (
            <motion.ellipse
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18 }}
              cx={s.x}
              cy={s.y}
              rx={7}
              ry={5}
              transform={`rotate(${s.r} ${s.x} ${s.y})`}
              fill="url(#seed)"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={0.8}
            />
          ))}
        </AnimatePresence>
      </svg>
      <span className="absolute -bottom-1 left-1/2 min-w-6 -translate-x-1/2 rounded-full bg-black/60 px-1.5 text-xs font-bold text-white tabular-nums">
        {count}
      </span>
      <AnimatePresence>
        {active && hand > 0 && (
          <motion.span
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: -4, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-glow px-2 text-xs font-black text-black shadow"
          >
            ✋{hand}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function Store({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,oklch(0.42_0.08_50),oklch(0.28_0.06_45))] px-2 py-3 shadow-[inset_0_6px_14px_rgba(0,0,0,0.55)]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={{ scale: 1.8, color: "#fde68a" }}
          animate={{ scale: 1, color: "#ffffff" }}
          className="text-xl font-black tabular-nums sm:text-2xl"
        >
          {count}
        </motion.span>
      </AnimatePresence>
      <span className="text-[10px] text-white/70">{label}</span>
    </div>
  );
}

/** Stores as they were before the last move (final stores minus this move's captures). */
function storesBefore(state: PallanguzhiState): Record<PlayerId, number> {
  const stores = { ...state.stores };
  if (state.status === "finished") return stores;
  for (const ev of state.lastMove?.events ?? []) {
    if (ev.t === "pasu") stores[ev.owner] -= ev.count;
    if (ev.t === "capture") stores[ev.by] -= ev.count;
  }
  return stores;
}

export default function PallanguzhiBoard({ state, me, send }: GameBoardProps<PallanguzhiState, PallanguzhiAction>) {
  const play = useSound();
  const mySide = Math.max(0, state.players.findIndex((p) => p.id === me));
  const isPlayer = state.players.some((p) => p.id === me);
  // Frame of the running sowing animation, tagged with the move it belongs to.
  const [frame, setFrame] = useState<(Display & { moveNo: number }) | null>(null);
  const [doneMove, setDoneMove] = useState(state.moveNo);
  const loadedAt = useRef(state.moveNo);
  const lm = state.lastMove;
  const animating = state.moveNo !== doneMove && lm !== null;

  const disp: Display = !animating
    ? { pits: state.pits, stores: state.stores, active: null, hand: 0, flash: null }
    : frame?.moveNo === state.moveNo
      ? frame
      : { pits: lm!.before, stores: storesBefore(state), active: null, hand: 0, flash: null };

  // Replay the sowing step by step whenever a new move arrives.
  useEffect(() => {
    const move = state.lastMove;
    const moveNo = state.moveNo;
    if (!move || moveNo === loadedAt.current) return;
    const pits = [...move.before];
    const stores = storesBefore(state);
    let hand = 0;
    const step = move.events.length > 70 ? 70 : ANIMATION.SOW_STEP_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];

    move.events.forEach((ev, i) => {
      timers.push(
        setTimeout(() => {
          let flash: Display["flash"] = null;
          if (ev.t === "pick") {
            hand = ev.count;
            pits[ev.pit] = 0;
            play("select");
          } else if (ev.t === "drop") {
            hand -= 1;
            pits[ev.pit] += 1;
            play("tap");
          } else if (ev.t === "pasu") {
            pits[ev.pit] = 0;
            stores[ev.owner] = (stores[ev.owner] ?? 0) + ev.count;
            flash = { pit: ev.pit, kind: "pasu" };
            play("coin", 20);
          } else {
            pits[ev.pit] = 0;
            stores[ev.by] = (stores[ev.by] ?? 0) + ev.count;
            flash = { pit: ev.pit, kind: "capture" };
            play("capture", 40);
          }
          setFrame({ moveNo, pits: [...pits], stores: { ...stores }, active: ev.pit, hand, flash });
        }, i * step),
      );
    });
    timers.push(setTimeout(() => setDoneMove(moveNo), move.events.length * step + 350));
    return () => timers.forEach(clearTimeout);
    // Only a new move should restart the animation, not a re-sent copy of the same state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.moveNo]);

  const turnPlayer = state.players[state.turn];
  const myTurn = isPlayer && state.turn === mySide && state.status === "playing";
  const bottom = Array.from({ length: SIDE }, (_, i) => mySide * SIDE + i);
  const top = Array.from({ length: SIDE }, (_, i) => (1 - mySide) * SIDE + (SIDE - 1 - i));
  const opp = state.players[1 - mySide];
  const self = state.players[mySide];

  const renderRow = (row: number[]) =>
    row.map((pit) => {
      const mine = ownerOfPit(pit) === mySide;
      const playable = myTurn && !animating && mine && state.pits[pit] > 0;
      return (
        <Pit
          key={pit}
          index={pit}
          count={disp.pits[pit]}
          mine={mine}
          playable={playable}
          active={disp.active === pit}
          hand={disp.hand}
          flash={disp.flash?.pit === pit ? disp.flash.kind : null}
          onClick={() => {
            play("select", 15);
            send({ type: "sow", pit });
          }}
        />
      );
    });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 pb-24">
      <svg width="0" height="0" className="absolute">
        <defs>
          <radialGradient id="seed" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="55%" stopColor="#f5d0a9" />
            <stop offset="100%" stopColor="#b7791f" />
          </radialGradient>
        </defs>
      </svg>

      <div className="flex items-center justify-between">
        <PlayerAvatar avatar={opp.avatar} seat={opp.seat} name={opp.name} showName active={state.turn !== mySide && state.status === "playing"} />
        <TurnBanner
          myTurn={myTurn}
          finished={state.status === "finished"}
          myTurnText="Your turn: pick a pit"
          waitingText={animating ? "Sowing…" : `${turnPlayer.name}'s turn`}
        />
        <PlayerAvatar avatar={self.avatar} seat={self.seat} name={isPlayer ? "You" : self.name} showName active={myTurn} />
      </div>

      <motion.div
        initial={{ rotateX: 25, opacity: 0, y: 20 }}
        animate={{ rotateX: 0, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="wood-grain relative grid grid-cols-[auto_1fr_auto] items-stretch gap-2 rounded-[2.5rem] p-3 shadow-2xl ring-1 ring-black/30 sm:gap-4 sm:p-5"
        style={{ transformPerspective: 900 }}
      >
        <Store count={disp.stores[opp.id] ?? 0} label={opp.name.slice(0, 8)} />
        <div className="grid gap-4 sm:gap-6">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">{renderRow(top)}</div>
          <div className="mx-4 h-px bg-black/25" />
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">{renderRow(bottom)}</div>
        </div>
        <Store count={disp.stores[self.id] ?? 0} label={isPlayer ? "You" : self.name.slice(0, 8)} />
      </motion.div>

      <p className="text-center text-xs text-muted-foreground">
        Seeds travel anticlockwise ↻ · Your pits are on the bottom row
        {state.pasu && " · Pasu: 4 in a pit goes to its owner"}
      </p>
    </div>
  );
}
