import { ADJ, JUMPS } from "../aadu-puli/board";
import { tigerMoves, type Cell } from "../aadu-puli/logic";

/**
 * What each animal is feeling, read straight off the board. The first-person
 * view shows this as a speech bubble and body language, so a player walking
 * round the clearing can judge the position without a bird's-eye view.
 */
export type GoatMood = "doomed" | "nervous" | "calm" | "proud";
export type TigerMood = "pounce" | "prowl" | "cornered" | "trapped";
export type Mood = GoatMood | TigerMood;

export type MoodInfo = {
  mood: Mood;
  /** Short comic bubble over the head. */
  bubble: string;
  /** Headline for the HUD card. */
  title: string;
  /** One line of why, for the HUD card. */
  detail: string;
  /** How urgent it is, for colours: 0 calm … 3 critical. */
  heat: 0 | 1 | 2 | 3;
};

/** Tigers that could jump the goat on `i` right now. */
export function threatsTo(board: Cell[], i: number): number[] {
  return JUMPS.filter((j) => j.over === i && board[j.from] === "T" && board[j.to] === null).map((j) => j.from);
}

export function moodOf(board: Cell[], i: number): MoodInfo | null {
  const c = board[i];
  if (c === "T") {
    const moves = tigerMoves(board, i);
    const prey = moves.filter((m) => m.over !== null);
    if (prey.length > 0) {
      return {
        mood: "pounce",
        bubble: "GRRR… 😼",
        title: "Ready to pounce",
        detail: prey.length === 1 ? "It can jump a goat on its next move." : `It can jump ${prey.length} different goats next move.`,
        heat: 3,
      };
    }
    if (moves.length === 0) return { mood: "trapped", bubble: "ARGH! 😤", title: "Trapped", detail: "The goats have boxed this tiger in. It cannot move.", heat: 3 };
    if (moves.length === 1) return { mood: "cornered", bubble: "Hmph 😠", title: "Cornered", detail: "Only one free step left. One more goat and it is stuck.", heat: 2 };
    return { mood: "prowl", bubble: "Prowling 🐾", title: "Prowling", detail: `${moves.length} free steps and no goat in reach.`, heat: 1 };
  }
  if (c === "G") {
    const threats = threatsTo(board, i);
    const tigersNear = ADJ[i].filter((n) => board[n] === "T");
    if (threats.length > 0) {
      return {
        mood: "doomed",
        bubble: "HELP! 😱",
        title: "In trouble",
        detail: threats.length === 1 ? "A tiger next to it can jump over it right now." : `${threats.length} tigers can jump over it right now.`,
        heat: 3,
      };
    }
    if (tigersNear.some((t) => tigerMoves(board, t).length === 0)) {
      return { mood: "proud", bubble: "Gotcha! 😎", title: "Holding a tiger", detail: "It is part of the wall keeping a tiger stuck.", heat: 0 };
    }
    if (tigersNear.length > 0) {
      return { mood: "nervous", bubble: "Uh‑oh 😬", title: "Nervous", detail: "A tiger is right next to it, but the point behind it is covered.", heat: 2 };
    }
    return { mood: "calm", bubble: "All good 😌", title: "Nothing to worry about", detail: "No tiger can reach it this turn.", heat: 0 };
  }
  return null;
}

/** Mood of every point, null where it is empty. */
export function allMoods(board: Cell[]): (MoodInfo | null)[] {
  return board.map((_, i) => moodOf(board, i));
}
