import { bestBy, pickRandom, plays } from "../botUtils";
import { isGameError, type GameBot, type PlayerId } from "../types";
import { ownerOfPit, pallanguzhi, PITS, type PallanguzhiAction, type PallanguzhiState } from "./logic";

const CTX = { now: 0 };

function legalPits(s: PallanguzhiState, side: number) {
  return Array.from({ length: PITS }, (_, i) => i).filter((p) => ownerOfPit(p) === side && s.pits[p] > 0);
}

function play(s: PallanguzhiState, pit: number, by: PlayerId): PallanguzhiState | null {
  const next = pallanguzhi.reduce(s, { type: "sow", pit }, by, CTX);
  return isGameError(next) ? null : next;
}

/** Store difference from `me`'s point of view, plus seeds still on my side. */
function evaluate(s: PallanguzhiState, me: PlayerId, opp: PlayerId, mySide: number) {
  const onMySide = s.pits.filter((_, i) => ownerOfPit(i) === mySide).reduce((a, b) => a + b, 0);
  return s.stores[me] - s.stores[opp] + onMySide * 0.15;
}

/**
 * Beginner: random pit. Intermediate: greediest single move.
 * Pro: looks one reply ahead (assumes the opponent answers with their best move).
 */
export const pallanguzhiBot: GameBot<PallanguzhiState, PallanguzhiAction> = (s, me, level) => {
  const mySide = s.players.findIndex((p) => p.id === me);
  if (s.status !== "playing" || s.turn !== mySide) return null;
  const opp = s.players[1 - mySide].id;
  const moves = legalPits(s, mySide);
  if (moves.length === 0) return null;
  if (!plays(level)) return { type: "sow", pit: pickRandom(moves) };

  const pit = bestBy(moves, (pit) => {
    const after = play(s, pit, me);
    if (!after) return -Infinity;
    if (level !== "pro" || after.status === "finished") return evaluate(after, me, opp, mySide);
    const replies = legalPits(after, 1 - mySide);
    if (replies.length === 0) return evaluate(after, me, opp, mySide);
    // Opponent picks the reply that's worst for us.
    return Math.min(
      ...replies.map((r) => {
        const back = play(after, r, opp);
        return back ? evaluate(back, me, opp, mySide) : Infinity;
      }),
    );
  });
  return { type: "sow", pit };
};
