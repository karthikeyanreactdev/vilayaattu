import { currentRunner } from "../arcade/runs";
import type { GameBot } from "../types";
import type { CoastAction, CoastState } from "./logic";
import { autoTime } from "./sim";

/** The computer races the shared course and banks its time. */
export const coastRunBot: GameBot<CoastState, CoastAction> = (state, me, level) => {
  if (state.status !== "playing" || currentRunner(state)?.id !== me) return null;
  return { type: "finish", mark: autoTime(level, state.seed) };
};
