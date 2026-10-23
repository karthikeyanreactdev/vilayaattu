import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameResult, PlayerRef, ReduceContext } from "../types";

/** One live run each, then a ranking. The board plays locally and sends the mark. */
export type RunState = BaseGameState & {
  players: PlayerRef[];
  turn: number;
  /** null until that seat banks a result. */
  marks: (number | null)[];
  /** Host clock. After this, a missing run counts as the fallback mark. */
  deadline: number;
  seed: number;
};

export function setupRuns(players: PlayerRef[], now: number, seed: number, limitMs: number): RunState {
  const ordered = [...players].sort((a, b) => a.seat - b.seat);
  return {
    status: "playing",
    result: null,
    moveNo: 0,
    players: ordered,
    turn: 0,
    marks: ordered.map(() => null),
    deadline: now + limitMs,
    seed,
  };
}

export function currentRunner(state: RunState): PlayerRef | undefined {
  return state.players[state.turn];
}

/** Record the active player's mark and move on. `lowerWins` picks the ranking. */
export function bankMark<S extends RunState>(
  state: S,
  by: string,
  raw: number,
  ctx: ReduceContext,
  limitMs: number,
  lowerWins: boolean,
  label: (mark: number) => string,
  titleFor: (mark: number) => string,
  lo: number,
  hi: number,
): S | { error: string } {
  if (state.status !== "playing") return fail("The match is over.");
  const seat = state.players[state.turn];
  if (!seat || by !== seat.id) return fail("Wait for your run.");
  if (state.marks[state.turn] != null) return fail("That run is already in.");
  if (!Number.isFinite(raw)) return fail("That score does not count.");
  const mark = Math.max(lo, Math.min(hi, Math.round(raw)));
  const marks = state.marks.slice();
  marks[state.turn] = mark;
  const done = state.turn + 1 >= state.players.length;
  const next: S = {
    ...state,
    marks,
    turn: done ? state.turn : state.turn + 1,
    deadline: ctx.now + limitMs,
  };
  if (!done) return bump(next);
  const ranked = marks.map((m, i) => ({ m: m ?? hi, i }));
  ranked.sort((a, b) => (lowerWins ? a.m - b.m : b.m - a.m));
  const best = ranked[0]?.m;
  const winners = ranked.filter((r) => r.m === best).map((r) => state.players[r.i].id);
  const result: GameResult = {
    winners,
    title: winners.length > 1 ? "Draw" : titleFor(best ?? 0),
    scores: state.players.map((p, i) => ({ playerId: p.id, label: label(marks[i] ?? hi) })),
  };
  return bump(finish(next, result));
}
