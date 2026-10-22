import type { GameBot } from "../types";
import { currentInnings } from "../cricket/engine";
import type { BookCricketAction, BookCricketState } from "./logic";

/** Book cricket is pure luck, so every level just flips when batting. */
export const bookCricketBot: GameBot<BookCricketState, BookCricketAction> = (s, me) =>
  s.status === "playing" && currentInnings(s.cricket).batter === me ? { type: "flip" } : null;
