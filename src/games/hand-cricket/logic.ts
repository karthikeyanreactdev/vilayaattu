import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";
import { createCore, CRICKET_OPTIONS, currentInnings, recordBall, type CricketCore } from "../cricket/engine";

/**
 * Hand Cricket (odd or even). Both players secretly show 1–6 fingers.
 * Same number = OUT, otherwise the batter scores their number.
 */

/** -1 means "picked but hidden from you". */
export type Picks = Record<PlayerId, number | null>;

export type HandCricketState = BaseGameState & {
  players: PlayerRef[];
  phase: "toss-call" | "toss-pick" | "choose" | "play";
  toss: {
    caller: PlayerId;
    call: "odd" | "even" | null;
    picks: Picks;
    winner: PlayerId | null;
    sum: number | null;
  };
  picks: Picks;
  lastBall: { bat: number; bowl: number; runs: number; out: boolean; moveNo: number; batter: PlayerId; bowler: PlayerId } | null;
  cricket: CricketCore | null;
  options: { wickets: number; overs: number };
};

export type HandCricketAction =
  | { type: "call"; call: "odd" | "even" }
  | { type: "toss-pick"; n: number }
  | { type: "choose"; choice: "bat" | "bowl" }
  | { type: "pick"; n: number };

const validNumber = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6;
const emptyPicks = (players: PlayerRef[]): Picks => Object.fromEntries(players.map((p) => [p.id, null]));

export const handCricket: GameRules<HandCricketState, HandCricketAction> = {
  meta: {
    id: "hand-cricket",
    name: "Hand Cricket",
    tamilName: "கை கிரிக்கெட்",
    tagline: "Odd or even, show your fingers, don't get out!",
    emoji: "✋",
    category: "Cricket",
    minPlayers: 2,
    maxPlayers: 2,
    difficulty: "Easy",
    duration: "3–5",
    accent: "from-emerald-500 to-teal-600",
    rules: [
      "Toss: one player calls odd or even, then both show 1–6 fingers. The sum decides the toss.",
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
      toss: { caller: players[1].id, call: null, picks: emptyPicks(players), winner: null, sum: null },
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
        return bump({ ...state, phase: "toss-pick" as const, toss: { ...state.toss, call: action.call } });
      }
      case "toss-pick": {
        if (state.phase !== "toss-pick") return fail("Not the time to pick.");
        if (!validNumber(action.n)) return fail("Pick 1 to 6.");
        if (state.toss.picks[by] !== null) return fail("You already picked.");
        const picks = { ...state.toss.picks, [by]: action.n };
        const values = Object.values(picks);
        if (values.some((v) => v === null)) return bump({ ...state, toss: { ...state.toss, picks } });
        const sum = (values as number[]).reduce((a, b) => a + b, 0);
        const isEven = sum % 2 === 0;
        const callerWins = (state.toss.call === "even") === isEven;
        const other = state.players.find((p) => p.id !== state.toss.caller)!.id;
        const winner = callerWins ? state.toss.caller : other;
        return bump({ ...state, phase: "choose" as const, toss: { ...state.toss, picks, sum, winner } });
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
    const tossDone = state.toss.winner !== null;
    return {
      ...state,
      picks: hide(state.picks),
      toss: { ...state.toss, picks: tossDone ? state.toss.picks : hide(state.toss.picks) },
    };
  },
};
