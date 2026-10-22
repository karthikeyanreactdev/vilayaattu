import type { ComponentType } from "react";

/**
 * The game contract. Every game is a pure, serialisable state machine:
 *   setup()  -> initial state
 *   reduce() -> next state (or an error) for one player's action
 *   view()   -> the state as a given player is allowed to see it
 * The host runs these today; a backend can run the very same functions later.
 */

export type PlayerId = string;

export type PlayerRef = {
  id: PlayerId;
  name: string;
  avatar: string;
  seat: number;
};

export type GameStatus = "playing" | "finished";

export type GameResult = {
  winners: PlayerId[];
  /** Short headline, e.g. "Checkmate" or "Won by 12 runs". */
  title: string;
  detail?: string;
  /** Optional per-player score lines for the result screen. */
  scores?: { playerId: PlayerId; label: string }[];
  /** Player named as the loser, for games like Kazhuthai. */
  loser?: PlayerId;
};

/** Minimum fields every game state carries so shared UI can read them. */
export type BaseGameState = {
  status: GameStatus;
  result: GameResult | null;
  /** Monotonic counter the UI uses to trigger move animations. */
  moveNo: number;
};

export type GameError = { error: string };

export function isGameError(value: unknown): value is GameError {
  return typeof value === "object" && value !== null && "error" in value;
}

export type ReduceContext = { now: number };

export type OptionField =
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string | number; label: string }[];
    }
  | { key: string; label: string; type: "toggle"; description?: string };

export type GameOptions = Record<string, string | number | boolean>;

export type GameCategory = "Tamil classics" | "Cricket" | "Strategy" | "Cards";

export type GameMeta = {
  id: string;
  name: string;
  tamilName?: string;
  tagline: string;
  emoji: string;
  category: GameCategory;
  minPlayers: number;
  maxPlayers: number;
  difficulty: "Easy" | "Medium";
  /** Minutes, roughly. */
  duration: string;
  /** Tailwind gradient classes for the tile. */
  accent: string;
  rules: string[];
};

export type GameBoardProps<S, A> = {
  state: S;
  me: PlayerId;
  players: PlayerRef[];
  send: (action: A) => void;
  /** Host clock minus local clock, for countdowns. */
  clockOffset: number;
};

export type BotLevel = "beginner" | "intermediate" | "pro";

export const BOT_LEVELS: { value: BotLevel; label: string; emoji: string }[] = [
  { value: "beginner", label: "Beginner", emoji: "🐣" },
  { value: "intermediate", label: "Intermediate", emoji: "🧠" },
  { value: "pro", label: "Pro", emoji: "🔥" },
];

/**
 * A computer player. It receives the same filtered view a human in that seat
 * would see, and returns the action(s) to take, or null when it's not its move.
 */
export type GameBot<S, A> = (view: S, me: PlayerId, level: BotLevel) => A | A[] | null;

export type GameDefinition<S extends BaseGameState = BaseGameState, A = unknown> = {
  meta: GameMeta;
  defaultOptions: GameOptions;
  optionFields: OptionField[];
  setup: (players: PlayerRef[], options: GameOptions, ctx: ReduceContext) => S;
  reduce: (state: S, action: A, by: PlayerId, ctx: ReduceContext) => S | GameError;
  view: (state: S, viewer: PlayerId) => S;
  /** Optional host-side timer (chess clocks, auto-advance). Return null for "no change". */
  tick?: (state: S, ctx: ReduceContext) => S | null;
  bot: GameBot<S, A>;
};

/** Game rules without the computer player (bots are attached in the registry to avoid import cycles). */
export type GameRules<S extends BaseGameState = BaseGameState, A = unknown> = Omit<GameDefinition<S, A>, "bot">;

export type GameModule<S extends BaseGameState = BaseGameState, A = unknown> = {
  definition: GameDefinition<S, A>;
  Board: ComponentType<GameBoardProps<S, A>>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any>;
