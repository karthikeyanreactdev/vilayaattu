import { Chess, type Square } from "chess.js";
import { randomInt } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, GameResult, PlayerId, PlayerRef } from "../types";

/** Chess on top of chess.js, with optional clocks and stable piece ids for animation. */

export type ChessState = BaseGameState & {
  players: PlayerRef[];
  white: PlayerId;
  black: PlayerId;
  fen: string;
  /** square -> stable piece id */
  ids: Record<string, string>;
  history: string[];
  lastMove: { from: string; to: string; san: string; captured: boolean } | null;
  /** ms left; null when untimed */
  clock: { white: number; black: number; turnStartedAt: number } | null;
  drawOffer: PlayerId | null;
};

export type ChessAction =
  | { type: "move"; from: string; to: string; promotion?: "q" | "r" | "b" | "n" }
  | { type: "resign" }
  | { type: "offer-draw" }
  | { type: "accept-draw" }
  | { type: "decline-draw" };

function initialIds(chess: Chess): Record<string, string> {
  const ids: Record<string, string> = {};
  for (const row of chess.board()) {
    for (const cell of row) if (cell) ids[cell.square] = `${cell.color}${cell.type}-${cell.square}`;
  }
  return ids;
}

/** Replays the game so chess.js can detect threefold repetition. */
function replay(history: string[]): Chess {
  const chess = new Chess();
  for (const san of history) chess.move(san);
  return chess;
}

const name = (players: PlayerRef[], id: PlayerId) => players.find((p) => p.id === id)?.name ?? "Player";

function scores(state: ChessState) {
  return [
    { playerId: state.white, label: "♔ White" },
    { playerId: state.black, label: "♚ Black" },
  ];
}

function outcome(state: ChessState, chess: Chess): GameResult | null {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? state.black : state.white;
    return { winners: [winner], title: `${name(state.players, winner)} wins!`, detail: "Checkmate", scores: scores(state) };
  }
  if (chess.isStalemate()) return { winners: [], title: "Draw", detail: "Stalemate", scores: scores(state) };
  if (chess.isThreefoldRepetition()) return { winners: [], title: "Draw", detail: "Threefold repetition", scores: scores(state) };
  if (chess.isInsufficientMaterial()) return { winners: [], title: "Draw", detail: "Insufficient material", scores: scores(state) };
  if (chess.isDraw()) return { winners: [], title: "Draw", detail: "50-move rule", scores: scores(state) };
  return null;
}

export const chessGame: GameRules<ChessState, ChessAction> = {
  meta: {
    id: "chess",
    name: "Chess",
    tamilName: "சதுரங்கம்",
    tagline: "The royal game, born in India as Chaturanga.",
    emoji: "♞",
    category: "Strategy",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "Easy",
    duration: "10–30",
    accent: "from-stone-600 to-stone-900",
    rules: [
      "Standard chess rules: castling, en passant and promotion are all supported.",
      "Tap a piece to see its legal moves, then tap a highlighted square.",
      "Checkmate your opponent's king to win.",
      "With a clock, running out of time loses the game.",
      "You can offer a draw or resign from the menu.",
    ],
  },
  defaultOptions: { minutes: 10, color: "random" },
  optionFields: [
    {
      key: "minutes",
      label: "Clock",
      type: "select",
      options: [
        { value: 0, label: "No clock" },
        { value: 3, label: "3 min" },
        { value: 5, label: "5 min" },
        { value: 10, label: "10 min" },
        { value: 15, label: "15 min" },
      ],
    },
    {
      key: "color",
      label: "Host plays",
      type: "select",
      options: [
        { value: "random", label: "Random" },
        { value: "white", label: "White" },
        { value: "black", label: "Black" },
      ],
    },
  ],

  setup(players, options, { now }) {
    const chess = new Chess();
    const wi = options.color === "white" ? 0 : options.color === "black" ? 1 : randomInt(0, 1);
    const minutes = Number(options.minutes ?? 0);
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      white: players[wi].id,
      black: players[1 - wi].id,
      fen: chess.fen(),
      ids: initialIds(chess),
      history: [],
      lastMove: null,
      clock: minutes > 0 ? { white: minutes * 60_000, black: minutes * 60_000, turnStartedAt: now } : null,
      drawOffer: null,
    };
  },

  reduce(state, action, by, { now }) {
    if (state.status !== "playing") return fail("The game is over.");
    const color = by === state.white ? "w" : by === state.black ? "b" : null;
    if (!color) return fail("You are watching this game.");
    const opponent = color === "w" ? state.black : state.white;

    switch (action.type) {
      case "resign":
        return bump(
          finish(state, {
            winners: [opponent],
            title: `${name(state.players, opponent)} wins!`,
            detail: `${name(state.players, by)} resigned`,
            scores: scores(state),
          }),
        );
      case "offer-draw":
        return bump({ ...state, drawOffer: by });
      case "decline-draw":
        return state.drawOffer && state.drawOffer !== by ? bump({ ...state, drawOffer: null }) : fail("No draw offer.");
      case "accept-draw":
        if (!state.drawOffer || state.drawOffer === by) return fail("No draw offer to accept.");
        return bump(finish(state, { winners: [], title: "Draw", detail: "Agreed by both players", scores: scores(state) }));
      case "move": {
        const chess = replay(state.history);
        if (chess.turn() !== color) return fail("Wait for your turn.");
        let move;
        try {
          move = chess.move({ from: action.from, to: action.to, promotion: action.promotion ?? "q" });
        } catch {
          return fail("That move isn't legal.");
        }
        const ids = { ...state.ids };
        const id = ids[move.from];
        delete ids[move.from];
        if (move.flags.includes("e")) delete ids[`${move.to[0]}${move.from[1]}`];
        if (move.flags.includes("k") || move.flags.includes("q")) {
          const rank = move.from[1];
          const [rf, rt] = move.flags.includes("k") ? ["h", "f"] : ["a", "d"];
          ids[`${rt}${rank}`] = ids[`${rf}${rank}`];
          delete ids[`${rf}${rank}`];
        }
        ids[move.to] = id;

        let clock = state.clock;
        if (clock) {
          // The clock starts after White's first move.
          const spent = state.history.length === 0 ? 0 : now - clock.turnStartedAt;
          clock = {
            ...clock,
            white: color === "w" ? Math.max(0, clock.white - spent) : clock.white,
            black: color === "b" ? Math.max(0, clock.black - spent) : clock.black,
            turnStartedAt: now,
          };
        }

        const next: ChessState = {
          ...state,
          fen: chess.fen(),
          ids,
          history: [...state.history, move.san],
          lastMove: { from: move.from, to: move.to, san: move.san, captured: Boolean(move.captured) },
          clock,
          drawOffer: null,
        };
        const result = outcome(next, chess);
        return bump(result ? finish(next, result) : next);
      }
    }
  },

  tick(state, { now }) {
    if (!state.clock || state.status !== "playing" || state.history.length === 0) return null;
    const turn = new Chess(state.fen).turn();
    const left = (turn === "w" ? state.clock.white : state.clock.black) - (now - state.clock.turnStartedAt);
    if (left > 0) return null;
    const loser = turn === "w" ? state.white : state.black;
    const winner = turn === "w" ? state.black : state.white;
    const clock = { ...state.clock, [turn === "w" ? "white" : "black"]: 0, turnStartedAt: now };
    return bump(
      finish(
        { ...state, clock },
        { winners: [winner], title: `${name(state.players, winner)} wins!`, detail: `${name(state.players, loser)} ran out of time`, scores: scores(state) },
      ),
    );
  },

  view: (state) => state,
};

export function legalTargets(fen: string, from: string): string[] {
  try {
    return new Chess(fen).moves({ square: from as Square, verbose: true }).map((m) => m.to);
  } catch {
    return [];
  }
}

export function isPromotion(fen: string, from: string, to: string): boolean {
  try {
    return new Chess(fen)
      .moves({ square: from as Square, verbose: true })
      .some((m) => m.to === to && Boolean(m.promotion));
  } catch {
    return false;
  }
}
