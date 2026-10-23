import { randomInt } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameResult, GameRules, PlayerRef } from "../types";
import { formatMark, MAX_SPEED, RACE_LIMIT } from "./sim";

/** Shared clock. A little longer than the local race so a slow phone can still bank. */
export const RACE_LIMIT_MS = (RACE_LIMIT + 8) * 1000;
const MARK_HI = 400_000;
const LIGHTS_MS = 3500;
/** How far a reported car may sit along the road. */
const Z_CAP = 200 * 4000;

export type RacerSpot = {
  z: number;
  x: number;
  speed: number;
  done: boolean;
  /** null until that seat banks a time. */
  mark: number | null;
};

export type CoastState = BaseGameState & {
  players: PlayerRef[];
  seed: number;
  /** Host clock when the lights go green. */
  startAt: number;
  deadline: number;
  spots: RacerSpot[];
};

export type CoastAction =
  | { type: "spot"; z: number; x: number; speed: number; done: boolean }
  | { type: "finish"; mark: number };

const label = (m: number) => formatMark(m);
const title = (m: number) => (m >= 200_000 ? "No finish" : formatMark(m));

function blankSpot(): RacerSpot {
  return { z: 0, x: 0, speed: 0, done: false, mark: null };
}

function ranked(state: CoastState, ctxNow: number): CoastState {
  if (state.spots.some((s) => s.mark == null)) return state;
  const marks = state.spots.map((s) => s.mark ?? MARK_HI);
  const order = marks.map((m, i) => ({ m, i })).sort((a, b) => a.m - b.m);
  const best = order[0]?.m ?? MARK_HI;
  const winners = order.filter((r) => r.m === best).map((r) => state.players[r.i].id);
  const result: GameResult = {
    winners,
    title: winners.length > 1 ? "Draw" : title(best),
    scores: state.players.map((p, i) => ({ playerId: p.id, label: label(marks[i]) })),
  };
  return bump(finish({ ...state, deadline: ctxNow }, result));
}

export const coastRun: GameRules<CoastState, CoastAction> = {
  meta: {
    id: "coast-run",
    name: "Coast Run",
    tamilName: "கடலோட்டம்",
    tagline: "Same coast, every car in one view. Best time wins.",
    emoji: "🏎️",
    category: "Arcade",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "Medium",
    duration: "3–8",
    accent: "from-orange-500 to-rose-600",
    rules: [
      "Everyone leaves the line together. Friends and the computer stay on your screen.",
      "Steer through the curves and stay on the asphalt. Grass cuts your speed.",
      "Cross the finish line. The clock stops. Did not finish sorts behind every finisher.",
    ],
  },
  defaultOptions: {},
  optionFields: [],
  /** The computer banks its time at once. The picture of its car is drawn locally. */
  live: true,

  setup(players, _options, ctx) {
    const ordered = [...players].sort((a, b) => a.seat - b.seat);
    const startAt = ctx.now + LIGHTS_MS;
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players: ordered,
      seed: randomInt(1, 1_000_000_000),
      startAt,
      deadline: startAt + RACE_LIMIT_MS,
      spots: ordered.map(() => blankSpot()),
    };
  },

  reduce(state, action, by, ctx) {
    if (state.status !== "playing") return fail("The race is over.");
    const seat = state.players.findIndex((p) => p.id === by);
    if (seat < 0) return fail("You are not in this race.");
    const spots = state.spots.slice();
    const mine = { ...spots[seat] };
    if (mine.mark != null) return fail("That run is already in.");

    if (action.type === "spot") {
      if (!Number.isFinite(action.z) || !Number.isFinite(action.x) || !Number.isFinite(action.speed)) return fail("That position does not count.");
      const z = Math.max(mine.z, Math.min(Z_CAP, action.z));
      mine.z = z;
      mine.x = Math.max(-2, Math.min(2, action.x));
      mine.speed = Math.max(0, Math.min(MAX_SPEED, action.speed));
      mine.done = action.done || mine.done;
      spots[seat] = mine;
      return { ...state, spots };
    }

    if (action.type === "finish") {
      if (!Number.isFinite(action.mark)) return fail("That time does not count.");
      mine.mark = Math.max(1, Math.min(MARK_HI, Math.round(action.mark)));
      mine.done = true;
      spots[seat] = mine;
      return ranked({ ...state, spots }, ctx.now);
    }

    return fail("Unknown move.");
  },

  tick(state, ctx) {
    if (state.status !== "playing" || ctx.now < state.deadline) return null;
    const spots = state.spots.map((s) => (s.mark == null ? { ...s, done: true, mark: MARK_HI } : s));
    return ranked({ ...state, spots }, ctx.now);
  },

  view: (state) => state,
};
