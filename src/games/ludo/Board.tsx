"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TurnBanner } from "@/components/game/TurnBanner";
import { useSound } from "@/hooks/useSound";
import { cn } from "@/lib/utils";
import type { GameBoardProps } from "../types";
import { CENTRE, COLOURS, HOME, SAFE, START, TRACK, YARD } from "./geometry";
import { DONE, legalTokens, TOKEN_COUNT, YARD_POS, type LudoAction, type LudoState } from "./logic";

const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const TRACK_AT = new Map(TRACK.map(([r, c], i) => [`${r},${c}`, i]));
const HOME_AT = new Map<string, number>();
HOME.forEach((lane, colour) => lane.forEach(([r, c]) => HOME_AT.set(`${r},${c}`, colour)));
const YARD_AT = new Map<string, number>();
YARD.forEach((spots, colour) => spots.forEach(([r, c]) => YARD_AT.set(`${r},${c}`, colour)));

function yardColour(r: number, c: number): number | null {
  if (r <= 5 && c <= 5) return 0;
  if (r <= 5 && c >= 9) return 1;
  if (r >= 9 && c >= 9) return 2;
  if (r >= 9 && c <= 5) return 3;
  return null;
}

function place(colour: number, steps: number, token: number): readonly [number, number] {
  if (steps === YARD_POS) return YARD[colour][token];
  if (steps >= DONE) return CENTRE;
  if (steps > 50) return HOME[colour][steps - 51];
  return TRACK[(START[colour] + steps) % TRACK.length];
}

function noteText(state: LudoState): string {
  const last = state.last;
  if (!last) return "Roll a 6 to leave the yard.";
  const who = state.players[last.seat]?.name ?? "Player";
  const face = last.dice;
  if (last.note === "sixes") return `${who} rolled three 6s. Turn cancelled.`;
  if (last.note === "pass") return `${who} rolled ${face}. No token can move.`;
  if (last.note === "roll") return `${who} rolled ${face}. Pick a token.`;
  if (last.note === "open") return `${who} brought a token out.`;
  if (last.note === "capture") return `${who} sent ${last.captured} token${last.captured === 1 ? "" : "s"} back to the yard.`;
  if (last.note === "home") return `${who} reached the centre.`;
  return `${who} moved ${face}.`;
}

function Die({ value }: { value: number | null }) {
  const pips = value ? PIPS[value] : [];
  return (
    <div
      className="grid size-14 shrink-0 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl border-2 border-stone-800 bg-white p-1.5 shadow-md"
      aria-label={value ? `Die showing ${value}` : "Die"}
      data-die={value ?? ""}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const on = pips.some(([r, c]) => r * 3 + c === i);
        return <span key={i} className={cn("rounded-full", on ? "bg-stone-900" : "bg-transparent")} />;
      })}
    </div>
  );
}

export default function LudoBoard({ state, me, send }: GameBoardProps<LudoState, LudoAction>) {
  const play = useSound();
  const seen = useRef(state.last?.moveNo ?? 0);
  const seat = state.players.findIndex((p) => p.id === me);
  const finished = state.status === "finished";
  const myTurn = !finished && seat === state.turn;
  const canRoll = myTurn && state.phase === "roll";
  const dice = state.dice ?? state.last?.dice ?? null;
  const choices = myTurn && state.phase === "move" && state.dice !== null ? legalTokens(state, state.dice) : [];

  useEffect(() => {
    const last = state.last;
    if (!last || last.moveNo === seen.current) return;
    seen.current = last.moveNo;
    if (last.note === "capture") play("capture");
    else if (last.note === "home") play("coin");
    else if (last.note === "pass" || last.note === "sixes") play("turn");
    else if (last.note === "roll") play("flip");
    else play("move");
  }, [state.last, play]);

  const tokens = useMemo(() => {
    const byCell = new Map<string, { seat: number; token: number }[]>();
    state.steps.forEach((row, s) => {
      row.forEach((steps, token) => {
        const [r, c] = place(state.colours[s], steps, token);
        const key = `${r},${c}`;
        const list = byCell.get(key) ?? [];
        list.push({ seat: s, token });
        byCell.set(key, list);
      });
    });
    return byCell;
  }, [state.colours, state.steps]);

  const turnName = state.players[state.turn]?.name ?? "Player";
  const myTurnText = canRoll ? "Your roll" : "Tap a glowing token";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-2 p-2 pb-4">
      <div className="grid shrink-0 grid-cols-2 gap-1 sm:grid-cols-4">
        {state.players.map((p, i) => {
          const colour = COLOURS[state.colours[i]];
          const home = state.steps[i].filter((s) => s === DONE).length;
          const active = !finished && i === state.turn;
          return (
            <div
              key={p.id}
              className={cn("flex items-center gap-1.5 rounded-full px-2 py-1 text-xs", active && "ring-2 ring-foreground")}
              style={{ background: colour.soft }}
            >
              <span className="size-3 shrink-0 rounded-full border border-white" style={{ background: colour.fill }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <span className="tabular-nums">{home}/{TOKEN_COUNT}</span>
            </div>
          );
        })}
      </div>

      <TurnBanner
        myTurn={myTurn}
        finished={finished}
        myTurnText={myTurnText}
        waitingText={`${turnName} is playing`}
      />

      <div className="flex shrink-0 items-center gap-3">
        <Die value={dice} />
        <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">{noteText(state)}</p>
        <Button
          size="lg"
          className="h-14 px-5 text-base"
          disabled={!canRoll}
          onClick={() => {
            play("tap", 15);
            send({ type: "roll" });
          }}
        >
          Roll
        </Button>
      </div>

      <div
        data-ludo-board=""
        className="relative mx-auto aspect-square w-[min(100%,calc(100dvh-14rem))] rounded-xl border-2 border-stone-800 bg-stone-100 p-1 shadow-inner"
      >
        <div className="absolute inset-1 grid gap-px" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))", gridTemplateRows: "repeat(15, minmax(0, 1fr))" }}>
          {Array.from({ length: 15 }, (_, r) =>
            Array.from({ length: 15 }, (_, c) => {
              const key = `${r},${c}`;
              const track = TRACK_AT.get(key);
              const home = HOME_AT.get(key);
              const yard = yardColour(r, c);
              const start = track !== undefined && (START as readonly number[]).includes(track);
              const safe = track !== undefined && SAFE.has(track) && !start;
              const spot = YARD_AT.get(key);
              let background = "#fff";
              if (r === 7 && c === 7) {
                background = "conic-gradient(from 45deg, #ca8a04 0 25%, #2563eb 0 50%, #dc2626 0 75%, #16a34a 0 100%)";
              } else if (r === 6 && c === 6) background = "linear-gradient(135deg, #16a34a 50%, #dc2626 50%)";
              else if (r === 6 && c === 8) background = "linear-gradient(225deg, #16a34a 50%, #ca8a04 50%)";
              else if (r === 8 && c === 8) background = "linear-gradient(315deg, #ca8a04 50%, #2563eb 50%)";
              else if (r === 8 && c === 6) background = "linear-gradient(45deg, #dc2626 50%, #2563eb 50%)";
              else if (home !== undefined) background = COLOURS[home].fill;
              else if (start && track !== undefined) background = COLOURS[TRACK_START_COLOUR[track]].fill;
              else if (track !== undefined) background = "#fffbeb";
              else if (yard !== null) background = COLOURS[yard].soft;
              else background = "#e7e5e4";
              const here = tokens.get(key) ?? [];
              return (
                <div key={key} className="relative" style={{ background }}>
                  {safe && (
                    <span className="pointer-events-none absolute inset-0 grid place-items-center text-amber-500">
                      <svg viewBox="0 0 20 20" className="size-[55%]" aria-hidden>
                        <path fill="currentColor" d="M10 1.5 12.2 7l5.8.4-4.5 3.8 1.4 5.6L10 13.8 5.1 16.8 6.5 11.2 2 7.4 7.8 7z" />
                      </svg>
                    </span>
                  )}
                  {spot !== undefined && here.length === 0 && (
                    <span className="pointer-events-none absolute inset-[20%] rounded-full border-2 border-white/80 bg-white/35" />
                  )}
                  {here.map((t, i) => {
                    const colour = COLOURS[state.colours[t.seat]];
                    const canMove = t.seat === seat && choices.includes(t.token);
                    const n = here.length;
                    const shift = n === 1 ? "0,0" : `${((i % 2) * 2 - 1) * 18}%,${(i < 2 ? -1 : 1) * 18}%`;
                    return (
                      <button
                        key={`${t.seat}-${t.token}`}
                        type="button"
                        aria-label={`${colour.name} token ${t.token + 1}${canMove ? ", can move" : ""}`}
                        disabled={!canMove}
                        onClick={() => {
                          play("tap", 12);
                          send({ type: "move", token: t.token });
                        }}
                        className={cn(
                          "absolute grid place-items-center rounded-full border-2 border-stone-900 shadow-sm",
                          canMove ? "z-10 cursor-pointer ring-2 ring-white ring-offset-1 ring-offset-stone-900" : "pointer-events-none",
                        )}
                        style={{
                          background: colour.fill,
                          width: n === 1 ? "72%" : "52%",
                          height: n === 1 ? "72%" : "52%",
                          left: "50%",
                          top: "50%",
                          transform: `translate(-50%, -50%) translate(${shift})`,
                        }}
                      >
                        <span className="size-[42%] rounded-full bg-white/90" />
                      </button>
                    );
                  })}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

/** Colour that owns each start index on the shared track. */
const TRACK_START_COLOUR: Record<number, number> = { 0: 0, 13: 1, 26: 2, 39: 3 };
