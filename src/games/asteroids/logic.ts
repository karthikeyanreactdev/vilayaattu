import { randomInt } from "@/lib/random";
import { bankMark, currentRunner, setupRuns, type RunState } from "../arcade/runs";
import { fail } from "../helpers";
import type { GameRules } from "../types";

/** Each player flies one minute. Highest score wins. */
export const ASTEROID_LIMIT_MS = 80_000;
const MARK_HI = 100_000;

export type AsteroidsState = RunState;
export type AsteroidsAction = { type: "finish"; score: number };

export const asteroids: GameRules<AsteroidsState, AsteroidsAction> = {
  meta: {
    id: "asteroids",
    name: "Asteroids",
    tamilName: "விண்கல்",
    tagline: "Spin, thrust, and break the rocks. Highest score wins.",
    emoji: "☄️",
    category: "Arcade",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "Easy",
    duration: "3–6",
    accent: "from-slate-700 to-indigo-900",
    rules: [
      "Take turns. Each pilot gets one run of up to 60 seconds.",
      "Rotate, thrust, and shoot. Rocks split until the small ones are gone.",
      "You have 3 ships. Wrapping past the edge brings you back on the other side.",
      "Highest score wins. The computer flies its own run.",
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players, _options, ctx) {
    return setupRuns(players, ctx.now, randomInt(1, 1_000_000_000), ASTEROID_LIMIT_MS);
  },

  reduce(state, action, by, ctx) {
    if (action.type !== "finish") return fail("Unknown move.");
    return bankMark(state, by, action.score, ctx, ASTEROID_LIMIT_MS, false, (m) => `${m}`, (m) => `${m} points`, 0, MARK_HI);
  },

  tick(state, ctx) {
    if (state.status !== "playing" || ctx.now < state.deadline) return null;
    const seat = currentRunner(state);
    if (!seat) return null;
    const next = bankMark(state, seat.id, 0, ctx, ASTEROID_LIMIT_MS, false, (m) => `${m}`, (m) => `${m} points`, 0, MARK_HI);
    return "error" in next ? null : next;
  },

  view: (state) => state,
};
