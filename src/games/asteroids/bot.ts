import { currentRunner } from "../arcade/runs";
import type { GameBot } from "../types";
import type { AsteroidsAction, AsteroidsState } from "./logic";
import { autoScore } from "./sim";

/** The computer flies the field itself and banks whatever it scores. */
export const asteroidsBot: GameBot<AsteroidsState, AsteroidsAction> = (state, me, level) => {
  if (state.status !== "playing" || currentRunner(state)?.id !== me) return null;
  return { type: "finish", score: autoScore(level, state.seed + state.turn * 997) };
};
