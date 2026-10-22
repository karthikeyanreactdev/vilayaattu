import { randomInt } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerRef } from "../types";
import { createCore, CRICKET_OPTIONS, currentInnings, recordBall, type CricketCore } from "../cricket/engine";

/**
 * Book Cricket. Open the book at a random page; the last digit of the
 * left (even) page decides the ball: 0 = OUT, 2/4/6 = runs, 8 = no-ball (+1).
 */

export type BookCricketState = BaseGameState & {
  players: PlayerRef[];
  tossWinner: string;
  cricket: CricketCore;
  lastFlip: { page: number; runs: number; out: boolean; noBall: boolean; moveNo: number } | null;
};

export type BookCricketAction = { type: "flip" };

export const BOOK_PAGES = 320;

export function scoreForPage(page: number) {
  const digit = page % 10;
  if (digit === 0) return { runs: 0, out: true, noBall: false, label: "W" };
  if (digit === 8) return { runs: 1, out: false, noBall: true, label: "NB" };
  return { runs: digit, out: false, noBall: false, label: String(digit) };
}

export const bookCricket: GameRules<BookCricketState, BookCricketAction> = {
  meta: {
    id: "book-cricket",
    name: "Book Cricket",
    tamilName: "புத்தக கிரிக்கெட்",
    tagline: "Flip the textbook, pray for a 6. The last-bench classic.",
    emoji: "📖",
    category: "Cricket",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "Easy",
    duration: "3–5",
    accent: "from-sky-500 to-indigo-600",
    rules: [
      "The batter flips the book open to a random page.",
      "Look at the last digit of the left (even) page number.",
      "0 = OUT · 2, 4, 6 = runs · 8 = No-ball (1 run, ball doesn't count).",
      "After the first innings, the other player chases the target.",
    ],
  },
  defaultOptions: { wickets: 2, overs: 2 },
  optionFields: CRICKET_OPTIONS,

  setup(players, options) {
    const tossWinner = players[randomInt(0, 1)];
    const other = players.find((p) => p.id !== tossWinner.id)!;
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      tossWinner: tossWinner.id,
      cricket: createCore(tossWinner.id, other.id, Number(options.wickets ?? 2), Number(options.overs ?? 2)),
      lastFlip: null,
    };
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The match is over.");
    if (action.type !== "flip") return fail("Unknown move.");
    const inn = currentInnings(state.cricket);
    if (by !== inn.batter) return fail("Only the batter flips the book.");

    const page = randomInt(1, BOOK_PAGES / 2) * 2;
    const s = scoreForPage(page);
    const { core, result } = recordBall(
      state.cricket,
      { runs: s.runs, out: s.out, legal: !s.noBall, label: s.label },
      state.players,
    );
    const next: BookCricketState = {
      ...state,
      cricket: core,
      lastFlip: { page, runs: s.runs, out: s.out, noBall: s.noBall, moveNo: state.moveNo + 1 },
    };
    return bump(result ? finish(next, result) : next);
  },

  view: (state) => state,
};
