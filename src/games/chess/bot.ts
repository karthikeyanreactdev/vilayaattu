import { Chess, type Move } from "chess.js";
import { pickRandom } from "../botUtils";
import type { GameBot } from "../types";
import type { ChessAction, ChessState } from "./logic";

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Small centre bonus so pieces develop instead of shuffling. */
function centre(square: string): number {
  const f = square.charCodeAt(0) - 97;
  const r = Number(square[1]) - 1;
  return 6 - (Math.abs(3.5 - f) + Math.abs(3.5 - r));
}

/** Material + centralisation, from White's point of view. */
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === "w" ? -100_000 : 100_000;
  if (chess.isDraw()) return 0;
  let score = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const v = VALUE[cell.type] + (cell.type === "n" || cell.type === "b" || cell.type === "p" ? centre(cell.square) * 4 : 0);
      score += cell.color === "w" ? v : -v;
    }
  }
  return score;
}

/** Captures and checks first so alpha-beta prunes more. */
function ordered(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => {
    const s = (m: Move) => (m.captured ? 10 + VALUE[m.captured] / 100 - VALUE[m.piece] / 1000 : 0) + (m.san.includes("+") ? 5 : 0) + (m.promotion ? 8 : 0);
    return s(b) - s(a);
  });
}

class Timeout extends Error {}

function negamax(chess: Chess, depth: number, alpha: number, beta: number, color: 1 | -1, deadline: number): number {
  if (Date.now() > deadline) throw new Timeout();
  if (depth === 0 || chess.isGameOver()) return color * evaluate(chess);
  let best = -Infinity;
  for (const m of ordered(chess.moves({ verbose: true }))) {
    chess.move(m);
    let score: number;
    try {
      score = -negamax(chess, depth - 1, -beta, -alpha, (-color) as 1 | -1, deadline);
    } finally {
      chess.undo();
    }
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best moves at a fixed depth, or null if the deadline hit first. */
function searchDepth(chess: Chess, moves: Move[], depth: number, color: 1 | -1, deadline: number): Move[] | null {
  let bestScore = -Infinity;
  let best: Move[] = [];
  try {
    for (const m of moves) {
      chess.move(m);
      let score: number;
      try {
        score = -negamax(chess, depth - 1, -Infinity, -bestScore + 1, (-color) as 1 | -1, deadline);
      } finally {
        chess.undo();
      }
      if (score > bestScore + 1) {
        bestScore = score;
        best = [m];
      } else if (Math.abs(score - bestScore) <= 1) {
        best.push(m);
      }
    }
  } catch (e) {
    if (e instanceof Timeout) return null;
    throw e;
  }
  return best;
}

/**
 * Beginner: random, but grabs a free capture sometimes.
 * Intermediate: two plies (sees simple recaptures).
 * Pro: alpha-beta, deepening up to four plies within ~1.5 s.
 */
export const chessBot: GameBot<ChessState, ChessAction> = (s, me, level) => {
  if (s.status !== "playing") return null;
  if (s.drawOffer && s.drawOffer !== me) return { type: "decline-draw" };
  const chess = new Chess(s.fen);
  const myColor = me === s.white ? "w" : me === s.black ? "b" : null;
  if (!myColor || chess.turn() !== myColor) return null;
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  const toAction = (m: Move): ChessAction => ({ type: "move", from: m.from, to: m.to, promotion: (m.promotion as "q") ?? undefined });

  if (level === "beginner") {
    const captures = moves.filter((m) => m.captured);
    return toAction(captures.length && Math.random() < 0.5 ? pickRandom(captures) : pickRandom(moves));
  }

  // Iterative deepening within a time budget; keep the deepest finished result.
  const maxDepth = level === "pro" ? 4 : 2;
  const deadline = Date.now() + (level === "pro" ? 1500 : 600);
  const color: 1 | -1 = myColor === "w" ? 1 : -1;
  let best: Move[] = moves;
  let order = ordered(moves);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const result = searchDepth(chess, order, depth, color, deadline);
    if (!result || result.length === 0) break;
    best = result;
    // Search the current best moves first next time.
    order = [...result, ...order.filter((m) => !result.includes(m))];
  }
  return toAction(pickRandom(best));
};
