import type { AnyGameDefinition, BaseGameState, GameBot, GameCategory, GameDefinition, GameRules } from "./types";
import { handCricket } from "./hand-cricket/logic";
import { bookCricket } from "./book-cricket/logic";
import { ludo } from "./ludo/logic";
import { pallanguzhi } from "./pallanguzhi/logic";
import { aaduPuli } from "./aadu-puli/logic";
import { aaduPuli3d } from "./aadu-puli-3d/logic";
import { chessGame } from "./chess/logic";
import { chess3d } from "./chess-3d/logic";
import { kazhuthai } from "./kazhuthai/logic";
import { onnu } from "./onnu/logic";
import { rummy } from "./rummy/logic";
import { asteroids } from "./asteroids/logic";
import { coastRun } from "./coast-run/logic";
import { handCricketBot } from "./hand-cricket/bot";
import { bookCricketBot } from "./book-cricket/bot";
import { ludoBot } from "./ludo/bot";
import { pallanguzhiBot } from "./pallanguzhi/bot";
import { aaduPuliBot } from "./aadu-puli/bot";
import { chessBot } from "./chess/bot";
import { kazhuthaiBot } from "./kazhuthai/bot";
import { onnuBot } from "./onnu/bot";
import { rummyBot } from "./rummy/bot";
import { asteroidsBot } from "./asteroids/bot";
import { coastRunBot } from "./coast-run/bot";

const withBot = <S extends BaseGameState, A>(rules: GameRules<S, A>, bot: GameBot<S, A>): GameDefinition<S, A> => ({ ...rules, bot });

/**
 * Game registry: pure logic only (no React), so it can also run on a server.
 * To add a game: write its logic + Board, then list it here and in boards.tsx.
 */
export const GAMES: AnyGameDefinition[] = [
  withBot(handCricket, handCricketBot),
  withBot(bookCricket, bookCricketBot),
  withBot(ludo, ludoBot),
  withBot(pallanguzhi, pallanguzhiBot),
  withBot(aaduPuli, aaduPuliBot),
  withBot(aaduPuli3d, aaduPuliBot),
  withBot(chessGame, chessBot),
  withBot(chess3d, chessBot),
  withBot(kazhuthai, kazhuthaiBot),
  withBot(onnu, onnuBot),
  withBot(rummy, rummyBot),
  withBot(asteroids, asteroidsBot),
  withBot(coastRun, coastRunBot),
];

const byId = new Map(GAMES.map((g) => [g.meta.id, g]));

export function getGameDefinition(id: string): AnyGameDefinition | undefined {
  return byId.get(id);
}

export const CATEGORIES: GameCategory[] = ["Tamil classics", "Cricket", "Strategy", "Cards", "Arcade"];

export function gamesForPlayers(count: number): AnyGameDefinition[] {
  return GAMES.filter((g) => count >= g.meta.minPlayers && count <= g.meta.maxPlayers);
}

export function playerRange(meta: { minPlayers: number; maxPlayers: number }): string {
  return meta.minPlayers === meta.maxPlayers ? `${meta.minPlayers} players` : `${meta.minPlayers}–${meta.maxPlayers} players`;
}
