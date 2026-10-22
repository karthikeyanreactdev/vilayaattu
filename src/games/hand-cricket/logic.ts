import { randomInt } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";
import { createCore, CRICKET_OPTIONS, currentInnings, recordBall, type CricketCore } from "../cricket/engine";

/**
 * Hand Cricket. The toss is a coin (heads or tails). During play both players
 * secretly show 1–6 fingers. Same number = OUT, otherwise the batter scores theirs.
 */

export type CoinFace = "heads" | "tails";

/** -1 means "picked but hidden from you". */
export type Picks = Record<PlayerId, number | null>;

export type HandCricketState = BaseGameState & {
  players: PlayerRef[];
  phase: "toss-call" | "choose" | "play";
  toss: {
    caller: PlayerId;
    call: CoinFace | null;
    face: CoinFace | null;
    winner: PlayerId | null;
  };
  picks: Picks;
  lastBall: { bat: number; bowl: number; runs: number; out: boolean; moveNo: number; batter: PlayerId; bowler: PlayerId } | null;
  cricket: CricketCore | null;
  options: { wickets: number; overs: number };
};

export type HandCricketAction =
  | { type: "call"; call: CoinFace }
  | { type: "choose"; choice: "bat" | "bowl" }
  | { type: "pick"; n: number };

const isFace = (call: unknown): call is CoinFace => call === "heads" || call === "tails";

const validNumber = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6;
const emptyPicks = (players: PlayerRef[]): Picks => Object.fromEntries(players.map((p) => [p.id, null]));

export const handCricket: GameRules<HandCricketState, HandCricketAction> = {
  meta: {
    id: "hand-cricket",
    name: "Hand Cricket",
    tamilName: "கை கிரிக்கெட்",
    tagline: "Call the coin, show your fingers, don't get out!",
    emoji: "✋",
    category: "Cricket",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "Easy",
    duration: "3–5",
    accent: "from-emerald-500 to-teal-600",
    rules: [
      "Toss: one player calls heads or tails. A coin flip decides who wins the toss.",
      "The toss winner chooses to bat or bowl.",
      "Each ball, both pick a number secretly. Same number = OUT.",
      "Different numbers: the batter scores the number they showed.",
      "Second innings chases the target. Highest score wins.",
    ],
  },
  defaultOptions: { wickets: 1, overs: 0 },
  optionFields: CRICKET_OPTIONS,

  setup(players, options) {
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      phase: "toss-call",
      toss: { caller: players[1].id, call: null, face: null, winner: null },
      picks: emptyPicks(players),
      lastBall: null,
      cricket: null,
      options: { wickets: Number(options.wickets ?? 1), overs: Number(options.overs ?? 0) },
    };
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The match is over.");

    switch (action.type) {
      case "call": {
        if (state.phase !== "toss-call") return fail("Not the time to call.");
        if (by !== state.toss.caller) return fail("Your opponent calls the toss.");
        if (!isFace(action.call)) return fail("Call heads or tails.");
        const face: CoinFace = randomInt(0, 1) === 0 ? "heads" : "tails";
        const other = state.players.find((p) => p.id !== state.toss.caller)!.id;
        const winner = face === action.call ? state.toss.caller : other;
        return bump({ ...state, phase: "choose" as const, toss: { ...state.toss, call: action.call, face, winner } });
      }
      case "choose": {
        if (state.phase !== "choose") return fail("Not the time to choose.");
        if (by !== state.toss.winner) return fail("The toss winner chooses.");
        const other = state.players.find((p) => p.id !== by)!.id;
        const [batter, bowler] = action.choice === "bat" ? [by, other] : [other, by];
        return bump({
          ...state,
          phase: "play" as const,
          cricket: createCore(batter, bowler, state.options.wickets, state.options.overs),
        });
      }
      case "pick": {
        if (state.phase !== "play" || !state.cricket) return fail("The match hasn't started.");
        if (!validNumber(action.n)) return fail("Pick 1 to 6.");
        if (state.picks[by] !== null) return fail("Waiting for your opponent.");
        const picks = { ...state.picks, [by]: action.n };
        if (Object.values(picks).some((v) => v === null)) return bump({ ...state, picks });

        const inn = currentInnings(state.cricket);
        const bat = picks[inn.batter]!;
        const bowl = picks[inn.bowler]!;
        const out = bat === bowl;
        const runs = out ? 0 : bat;
        const { core, result } = recordBall(
          state.cricket,
          { runs, out, legal: true, label: out ? "W" : String(runs) },
          state.players,
        );
        const next: HandCricketState = {
          ...state,
          cricket: core,
          picks: emptyPicks(state.players),
          lastBall: { bat, bowl, runs, out, moveNo: state.moveNo + 1, batter: inn.batter, bowler: inn.bowler },
        };
        return bump(result ? finish(next, result) : next);
      }
    }
  },

  view(state, viewer) {
    const hide = (picks: Picks): Picks =>
      Object.fromEntries(
        Object.entries(picks).map(([id, v]) => [id, id === viewer || v === null ? v : -1]),
      );
    return { ...state, picks: hide(state.picks) };
  },
};
