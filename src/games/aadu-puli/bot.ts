import { bestBy, pickRandom, plays } from "../botUtils";
import { isGameError, type GameBot } from "../types";
import { aaduPuli, goatMoves, tigerMoves, type AaduPuliAction, type AaduPuliState } from "./logic";

const CTX = { now: 0 };

export function legalActions(s: AaduPuliState): AaduPuliAction[] {
  const out: AaduPuliAction[] = [];
  s.board.forEach((cell, i) => {
    if (s.turn === "G") {
      if (s.goatsInHand > 0) {
        if (cell === null) out.push({ type: "place", to: i });
      } else if (cell === "G") {
        goatMoves(s.board, i).forEach((to) => out.push({ type: "move", from: i, to }));
      }
    } else if (cell === "T") {
      tigerMoves(s.board, i).forEach((m) => out.push({ type: "move", from: i, to: m.to }));
    }
  });
  return out;
}

/** Score from the tigers' point of view (higher = better for tigers). */
function evaluate(s: AaduPuliState): number {
  if (s.status === "finished") {
    if (s.result?.winners.includes(s.tiger)) return 10_000;
    if (s.result?.winners.includes(s.goat)) return -10_000;
    return 0;
  }
  let mobility = 0;
  let threats = 0;
  s.board.forEach((c, i) => {
    if (c !== "T") return;
    const moves = tigerMoves(s.board, i);
    mobility += moves.length;
    threats += moves.filter((m) => m.over !== null).length;
  });
  return s.captured * 100 + threats * 25 + mobility * 3;
}

function apply(s: AaduPuliState, a: AaduPuliAction): AaduPuliState | null {
  const who = s.turn === "T" ? s.tiger : s.goat;
  const next = aaduPuli.reduce(s, a, who, CTX);
  return isGameError(next) ? null : next;
}

/** Depth-limited minimax with alpha-beta. */
function search(s: AaduPuliState, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || s.status === "finished") return evaluate(s);
  const actions = legalActions(s);
  if (actions.length === 0) return evaluate(s);
  if (s.turn === "T") {
    let best = -Infinity;
    for (const a of actions) {
      const n = apply(s, a);
      if (!n) continue;
      best = Math.max(best, search(n, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const a of actions) {
    const n = apply(s, a);
    if (!n) continue;
    best = Math.min(best, search(n, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Beginner: mostly random. Intermediate: looks at its move and the reply.
 * Pro: searches three plies with alpha-beta.
 */
export const aaduPuliBot: GameBot<AaduPuliState, AaduPuliAction> = (s, me, level) => {
  if (s.status !== "playing") return null;
  const role = me === s.tiger ? "T" : me === s.goat ? "G" : null;
  if (role !== s.turn) return null;
  const actions = legalActions(s);
  if (actions.length === 0) return null;
  if (!plays(level)) return pickRandom(actions);

  const depth = level === "pro" ? 3 : 2;
  const sign = role === "T" ? 1 : -1;
  return bestBy(actions, (a) => {
    const n = apply(s, a);
    return n ? sign * search(n, depth - 1, -Infinity, Infinity) : -Infinity;
  });
};
