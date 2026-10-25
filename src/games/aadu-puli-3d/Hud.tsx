"use client";

import { AnimatePresence, motion } from "motion/react";
import { Crosshair, Eye, Keyboard, MousePointer2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { PlayerAvatar } from "@/components/common/PlayerAvatar";
import { TurnBanner } from "@/components/game/TurnBanner";
import { cn } from "@/lib/utils";
import type { PlayerId, PlayerRef } from "../types";
import type { AaduPuliState } from "../aadu-puli/logic";
import { Minimap } from "./Minimap";
import { moodOf } from "./moods";
import { spawnFor, useRecent, type WalkStore } from "./walk";
import type { WalkApi } from "./WalkRig";

const HEAT = ["bg-emerald-500/90 text-white", "bg-sky-500/90 text-white", "bg-amber-400/95 text-black", "bg-red-500/95 text-white"];

/** Is this a touch device? Decides between the joystick and the keyboard hint. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return coarse;
}

/** Thumb stick for phones: drag inside the ring to walk. */
function Joystick({ walk }: { walk: WalkStore }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const R = 44;
  const move = (e: React.PointerEvent) => {
    const o = origin.current;
    if (!o || o.id !== e.pointerId) return;
    let dx = e.clientX - o.x;
    let dy = e.clientY - o.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx *= R / d;
      dy *= R / d;
    }
    setKnob({ x: dx, y: dy });
    walk.setStick(dx / R, -dy / R);
    walk.setSprint(d > R * 0.92);
  };
  const end = (e: React.PointerEvent) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    walk.setStick(0, 0);
    walk.setSprint(false);
  };
  return (
    <div
      className="pointer-events-auto relative size-32 touch-none select-none rounded-full bg-black/30 ring-2 ring-white/30 backdrop-blur-sm"
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Walk"
      role="application"
    >
      <div className="absolute left-1/2 top-1/2 size-12 rounded-full bg-white/80 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

export function Hud({
  state,
  me,
  players,
  role,
  myTurn,
  placing,
  selected,
  targets,
  movable,
  aimed,
  walk,
  walkApi,
  flashAt,
  canvas,
}: {
  state: AaduPuliState;
  me: PlayerId;
  players: PlayerRef[];
  role: "T" | "G" | null;
  myTurn: boolean;
  placing: boolean;
  selected: number | null;
  targets: Map<number, boolean>;
  movable: Set<number>;
  aimed: number | null;
  walk: WalkStore;
  walkApi: RefObject<WalkApi | null>;
  flashAt: number;
  /** The WebGL canvas, for pointer lock. */
  canvas: RefObject<HTMLDivElement | null>;
}) {
  const coarse = useCoarsePointer();
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState(true);
  const [crouch, setCrouch] = useState(false);
  const tiger = players.find((p) => p.id === state.tiger)!;
  const goat = players.find((p) => p.id === state.goat)!;
  const lm = state.lastMove;

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const sync = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", sync);
    return () => document.removeEventListener("pointerlockchange", sync);
  }, []);
  useEffect(() => walk.setCrouch(crouch), [crouch, walk]);

  const lockMouse = () => {
    const el = canvas.current?.querySelector("canvas");
    if (!el) return;
    if (document.pointerLockElement) document.exitPointerLock();
    else void el.requestPointerLock?.();
  };

  // What the crosshair is on, in words.
  const focus = aimed !== null ? moodOf(state.board, aimed) : null;
  const aimedEmpty = aimed !== null && state.board[aimed] === null;
  const actLabel = coarse ? "Tap" : "Press E";
  const focusCard = focus
    ? { tone: HEAT[focus.heat], title: `${state.board[aimed!] === "T" ? "🐯 Tiger" : "🐐 Goat"} · ${focus.title}`, detail: focus.detail }
    : aimedEmpty && targets.has(aimed!)
      ? { tone: "bg-yellow-300/95 text-black", title: placing ? "Empty point" : "Move here", detail: `${actLabel} to ${placing ? "place a goat here" : targets.get(aimed!) ? "pounce and take the goat" : "move here"}.` }
      : aimedEmpty
        ? { tone: "bg-black/45 text-white/80", title: "Empty point", detail: myTurn && !placing && selected === null ? "Pick one of your animals first." : "Nothing here." }
        : null;
  const aimAction = aimed !== null && (targets.has(aimed) || movable.has(aimed));

  // Describe the other side's latest move.
  const mover = lm ? state.board[lm.to] : null;
  const theirMove = lm && mover && (role === null || mover !== role);
  const moveText = !lm
    ? null
    : mover === "T"
      ? lm.captured !== null
        ? "A tiger pounced and took a goat!"
        : "A tiger prowled to a new point."
      : lm.from === null
        ? "A new goat was placed."
        : "A goat stepped to a new point.";
  const [seenMove, setSeenMove] = useState(-1);
  const recent = useRecent(flashAt, 12000);
  const showMove = theirMove && seenMove !== state.moveNo && recent;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-2 sm:p-3">
      {/* Top: players and whose turn */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {[
            { p: tiger, label: "🐯", stat: `${state.captured}/${state.captureGoal}`, active: state.turn === "T" },
            { p: goat, label: "🐐", stat: state.goatsInHand > 0 ? `${state.goatsInHand} to place` : `${15 - state.captured} left`, active: state.turn === "G" },
          ].map(({ p, label, stat, active }) => (
            <div key={p.id} className={cn("flex items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 text-xs text-white backdrop-blur-sm", active && state.status === "playing" && "ring-2 ring-primary")}>
              <PlayerAvatar avatar={p.avatar} seat={p.seat} size="sm" active={active && state.status === "playing"} />
              <span className="font-semibold">
                {label} {p.name}
                {p.id === me && " (you)"}
              </span>
              <span className="text-white/70">{stat}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2">
          <TurnBanner
            myTurn={myTurn}
            finished={state.status === "finished"}
            myTurnText={placing ? "Your turn: place a goat" : selected === null ? `Your turn: pick a ${role === "T" ? "tiger" : "goat"}` : "Now aim at a glowing point"}
            waitingText={state.turn === "T" ? `${tiger.name}'s tigers are thinking…` : `${goat.name}'s goats are thinking…`}
          />
          <AnimatePresence>
            {showMove && (
              <motion.div
                key={state.moveNo}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-yellow-300/95 py-1 pl-3 pr-1 text-xs font-semibold text-black shadow"
              >
                {moveText}
                <button type="button" className="flex items-center gap-1 rounded-full bg-black/85 px-2.5 py-1 text-white" onClick={() => (walkApi.current?.lookAt(lm!.to), setSeenMove(state.moveNo))}>
                  <Eye className="size-3.5" /> Show me
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {!coarse && (
            <button type="button" onClick={lockMouse} className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/60" title="Mouse look (Esc to release)">
              <MousePointer2 className="size-3.5" /> {locked ? "Release mouse" : "Mouse look"}
            </button>
          )}
          <button
            type="button"
            onClick={() => walkApi.current?.teleport(spawnFor(role))}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/60"
          >
            <RotateCcw className="size-3.5" /> Back to my side
          </button>
        </div>
      </div>

      {/* Centre: crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Crosshair className={cn("size-6 drop-shadow transition-colors", aimAction ? "text-yellow-300" : focus ? "text-white" : "text-white/60")} strokeWidth={aimAction ? 2.5 : 1.5} />
      </div>

      {/* Bottom: the focus card over a row of stick or hint, tally and radar */}
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          {focusCard && (
            <motion.div
              key={focusCard.title + focusCard.detail}
              initial={{ y: 8, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className={cn("max-w-xs rounded-2xl px-4 py-2 text-center shadow-lg backdrop-blur-sm", focusCard.tone)}
            >
              <p className="text-sm font-bold">{focusCard.title}</p>
              <p className="text-xs opacity-90">{focusCard.detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex w-full items-end justify-between gap-2">
          <div className="flex flex-col gap-2">
            {coarse ? (
              <>
                <button type="button" onClick={() => setCrouch((c) => !c)} aria-pressed={crouch} className={cn("pointer-events-auto w-fit rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm", crouch ? "bg-white text-black" : "bg-black/45 text-white")}>
                  {crouch ? "Stand up" : "Crouch"}
                </button>
                <Joystick walk={walk} />
              </>
            ) : (
              <AnimatePresence>
                {hint && (
                  <motion.div exit={{ opacity: 0 }} className="rounded-2xl bg-black/45 p-3 text-[11px] leading-5 text-white/90 backdrop-blur-sm">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Keyboard className="size-3.5" /> Walk the clearing
                    </p>
                    <p>
                      <kbd>W A S D</kbd> / arrows move · drag to look · <kbd>Shift</kbd> run · <kbd>C</kbd> crouch
                    </p>
                    <p>
                      Aim and press <kbd>E</kbd> to pick or move · <kbd>M</kbd> big map
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
          <div className="flex items-center gap-0.5 self-end rounded-full bg-black/40 px-2 py-0.5 text-sm backdrop-blur-sm" aria-label={`${state.captured} goats captured`}>
            {Array.from({ length: state.captureGoal }).map((_, i) => (
              <span key={i} className={cn(i >= state.captured && "opacity-30")}>
                {i < state.captured ? "❌" : "🐐"}
              </span>
            ))}
          </div>
          <Minimap walk={walk} state={state} targets={targets} movable={movable} selected={selected} flashAt={flashAt} />
        </div>
      </div>
    </div>
  );
}
