import type { GameRules } from "../types";
import { chessGame, type ChessAction, type ChessState } from "../chess/logic";

/** Same rules as Chess, fought by brick Rajas, Ranis, elephants and horses in 3D. */
export const chess3d: GameRules<ChessState, ChessAction> = {
  ...chessGame,
  meta: {
    ...chessGame.meta,
    id: "chess-3d",
    name: "Royal Chess 3D",
    tamilName: "ராஜ சதுரங்கம்",
    tagline: "Brick Rajas, elephants and horses march, fight and fall. Real chess in 3D.",
    emoji: "🐘",
    accent: "from-amber-600 to-red-700",
    rules: [
      ...chessGame.meta.rules,
      "Raja is the king, Rani the queen, the bow man (Mantri) the bishop, Kudirai the knight, Yanai the rook and Padai Veeran the pawn.",
      "Drag to turn the board, pinch or scroll to zoom.",
    ],
  },
};
