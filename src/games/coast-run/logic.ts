import { randomInt } from "@/lib/random";
import { bankMark, currentRunner, setupRuns, type RunState } from "../arcade/runs";
import { fail } from "../helpers";
import type { GameRules } from "../types";
import { formatMark } from "./sim";

/** Each player races the same coast. Lowest time wins. */
export const RACE_LIMIT_MS = 100_000;
const MARK_HI = 400_000;

export type CoastState = RunState;
export type CoastAction = { type: "finish"; mark: number };

const label = (m: number) => formatMark(m);
const title = (m: number) => (m >= 200_000 ? "No finish" : formatMark(m));

export const coastRun: GameRules<CoastState, CoastAction> = {
  meta: {
    id: "coast-run",
    name: "Coast Run",
    tamilName: "கடலோட்டம்",
    tagline: "Pseudo-3D coast road. Same track, best time wins.",
    emoji: "🏎️",
    category: "Arcade",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "Medium",
    duration: "3–8",
    accent: "from-orange-500 to-rose-600",
    rules: [
      "Take turns on the same road. Steer through the curves and stay on the asphalt.",
      "Grass cuts your speed. Hills hide the next bend.",
      "Cross the finish line. The clock stops. Did not finish sorts behind every finisher.",
      "The computer drives the same course.",
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players, _options, ctx) {
    return setupRuns(players, ctx.now, randomInt(1, 1_000_000_000), RACE_LIMIT_MS);
  },

  reduce(state, action, by, ctx) {
    if (action.type !== "finish") return fail("Unknown move.");
    return bankMark(state, by, action.mark, ctx, RACE_LIMIT_MS, true, label, title, 1, MARK_HI);
  },

  tick(state, ctx) {
    if (state.status !== "playing" || ctx.now < state.deadline) return null;
    const seat = currentRunner(state);
    if (!seat) return null;
    const next = bankMark(state, seat.id, MARK_HI, ctx, RACE_LIMIT_MS, true, label, title, 1, MARK_HI);
    return "error" in next ? null : next;
  },

  view: (state) => state,
};
