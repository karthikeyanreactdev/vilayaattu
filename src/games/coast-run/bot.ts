import type { GameBot } from "../types";
import type { CoastAction, CoastState } from "./logic";
import { autoTime } from "./sim";

/** Bank the computer's time. Every phone draws that car from the same seed. */
export const coastRunBot: GameBot<CoastState, CoastAction> = (state, me, level) => {
  if (state.status !== "playing") return null;
  const seat = state.players.findIndex((p) => p.id === me);
  if (seat < 0 || state.spots[seat]?.mark != null) return null;
  return { type: "finish", mark: autoTime(level, state.seed) };
};
