import { randomInt } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";
import { ADJ, JUMPS, POINTS } from "./board";

/**
 * Aadu Puli Attam (Goats & Tigers). 3 tigers vs 15 goats.
 * Goats are placed one per turn, then move. Tigers move one step or jump a goat.
 */

export type Cell = "T" | "G" | null;

export type AaduPuliState = BaseGameState & {
  players: PlayerRef[];
  tiger: PlayerId;
  goat: PlayerId;
  board: Cell[];
  /** Stable ids so pieces glide when they move. */
  pieceIds: (string | null)[];
  turn: "G" | "T";
  goatsInHand: number;
  captured: number;
  captureGoal: number;
  quietMoves: number;
  lastMove: { from: number | null; to: number; captured: number | null } | null;
};

export type AaduPuliAction =
  | { type: "place"; to: number }
  | { type: "move"; from: number; to: number };

const TOTAL_GOATS = 15;
const QUIET_LIMIT = 60;
export const TIGER_START = [0, 2, 3];

export function tigerMoves(board: Cell[], from: number): { to: number; over: number | null }[] {
  const moves: { to: number; over: number | null }[] = [];
  for (const n of ADJ[from]) if (board[n] === null) moves.push({ to: n, over: null });
  for (const j of JUMPS) {
    if (j.from === from && board[j.over] === "G" && board[j.to] === null) moves.push({ to: j.to, over: j.over });
  }
  return moves;
}

export function goatMoves(board: Cell[], from: number): number[] {
  return ADJ[from].filter((n) => board[n] === null);
}

function tigersCanMove(board: Cell[]) {
  return board.some((c, i) => c === "T" && tigerMoves(board, i).length > 0);
}

function goatsCanMove(state: AaduPuliState, board: Cell[]) {
  if (state.goatsInHand > 0) return board.some((c) => c === null);
  return board.some((c, i) => c === "G" && goatMoves(board, i).length > 0);
}

export const aaduPuli: GameRules<AaduPuliState, AaduPuliAction> = {
  meta: {
    id: "aadu-puli",
    name: "Aadu Puli Attam",
    tamilName: "ஆடு புலி ஆட்டம்",
    tagline: "3 tigers hunt, 15 goats trap. Pick a side.",
    emoji: "🐯",
    category: "Tamil classics",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "Easy",
    duration: "8–15",
    accent: "from-orange-500 to-red-600",
    rules: [
      "One player is the Tigers (3), the other the Goats (15). Goats move first.",
      "Goats are placed one at a time on any empty point. Once all are placed, goats move one step along a line.",
      "Tigers move one step along a line, or jump over a goat to the empty point right behind it to capture it.",
      "Tigers win by capturing enough goats (5 by default).",
      "Goats win by blocking every tiger so none can move.",
    ],
  },
  defaultOptions: { captureGoal: 5, tigerSeat: "random" },
  optionFields: [
    {
      key: "captureGoal",
      label: "Goats to capture",
      type: "select",
      options: [3, 5, 7].map((n) => ({ value: n, label: `${n} goats` })),
    },
    {
      key: "tigerSeat",
      label: "Tigers played by",
      type: "select",
      options: [
        { value: "random", label: "Random" },
        { value: "first", label: "Host" },
        { value: "second", label: "Guest" },
      ],
    },
  ],

  setup(players, options) {
    const pref = options.tigerSeat;
    const ti = pref === "first" ? 0 : pref === "second" ? 1 : randomInt(0, 1);
    const board: Cell[] = Array(POINTS).fill(null);
    const pieceIds: (string | null)[] = Array(POINTS).fill(null);
    TIGER_START.forEach((p, i) => {
      board[p] = "T";
      pieceIds[p] = `t${i}`;
    });
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      tiger: players[ti].id,
      goat: players[1 - ti].id,
      board,
      pieceIds,
      turn: "G",
      goatsInHand: TOTAL_GOATS,
      captured: 0,
      captureGoal: Number(options.captureGoal ?? 5),
      quietMoves: 0,
      lastMove: null,
    };
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The game is over.");
    const role = by === state.tiger ? "T" : by === state.goat ? "G" : null;
    if (role !== state.turn) return fail("Wait for your turn.");

    const board = [...state.board];
    const pieceIds = [...state.pieceIds];
    let next: AaduPuliState;

    if (role === "G") {
      if (action.type === "place") {
        if (state.goatsInHand <= 0) return fail("All goats are on the board. Move one.");
        if (board[action.to] !== null) return fail("That point is taken.");
        board[action.to] = "G";
        pieceIds[action.to] = `g${TOTAL_GOATS - state.goatsInHand}`;
        next = { ...state, board, pieceIds, goatsInHand: state.goatsInHand - 1, turn: "T" };
        next.lastMove = { from: null, to: action.to, captured: null };
      } else {
        if (state.goatsInHand > 0) return fail("Place all your goats first.");
        if (board[action.from] !== "G") return fail("Pick one of your goats.");
        if (!goatMoves(board, action.from).includes(action.to)) return fail("Goats move one step to an empty point.");
        board[action.to] = "G";
        board[action.from] = null;
        pieceIds[action.to] = pieceIds[action.from];
        pieceIds[action.from] = null;
        next = { ...state, board, pieceIds, turn: "T", quietMoves: state.quietMoves + 1 };
        next.lastMove = { from: action.from, to: action.to, captured: null };
      }
    } else {
      if (action.type !== "move") return fail("Tigers move, they don't place.");
      if (board[action.from] !== "T") return fail("Pick one of your tigers.");
      const move = tigerMoves(board, action.from).find((m) => m.to === action.to);
      if (!move) return fail("Tigers move one step, or jump over a goat.");
      board[action.to] = "T";
      board[action.from] = null;
      pieceIds[action.to] = pieceIds[action.from];
      pieceIds[action.from] = null;
      let captured = state.captured;
      if (move.over !== null) {
        board[move.over] = null;
        pieceIds[move.over] = null;
        captured += 1;
      }
      next = {
        ...state,
        board,
        pieceIds,
        turn: "G",
        captured,
        quietMoves: move.over !== null ? 0 : state.quietMoves + 1,
        lastMove: { from: action.from, to: action.to, captured: move.over },
      };
    }

    const tigerName = state.players.find((p) => p.id === state.tiger)!.name;
    const goatName = state.players.find((p) => p.id === state.goat)!.name;
    const scores = [
      { playerId: state.tiger, label: `🐯 ${next.captured} captured` },
      { playerId: state.goat, label: `🐐 ${TOTAL_GOATS - next.captured} goats left` },
    ];

    if (next.captured >= next.captureGoal) {
      next = finish(next, { winners: [state.tiger], title: `${tigerName}'s tigers win!`, detail: `${next.captured} goats captured`, scores });
    } else if (next.turn === "T" && !tigersCanMove(next.board)) {
      next = finish(next, { winners: [state.goat], title: `${goatName}'s goats win!`, detail: "Every tiger is trapped", scores });
    } else if (next.turn === "G" && !goatsCanMove(next, next.board)) {
      next = finish(next, { winners: [state.tiger], title: `${tigerName}'s tigers win!`, detail: "The goats have no moves left", scores });
    } else if (next.goatsInHand === 0 && next.quietMoves >= QUIET_LIMIT) {
      next = finish(next, { winners: [], title: "Draw", detail: `${QUIET_LIMIT} moves without a capture`, scores });
    }
    return bump(next);
  },

  view: (state) => state,
};
