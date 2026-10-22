import { randomInt } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerRef } from "../types";
import { SAFE, START } from "./geometry";

/**
 * Ludo. Roll a 6 to leave the yard, walk the track, and be the first
 * to bring all four tokens into the centre. A 6 or a capture earns another roll.
 * Three 6s in a row forfeits the turn.
 */

export const TOKEN_COUNT = 4;
/** In the yard. */
export const YARD_POS = -1;
/** Standing on the centre. */
export const DONE = 57;

export type LudoState = BaseGameState & {
  players: PlayerRef[];
  /** Board colour index for each seat. Two players sit opposite each other. */
  colours: number[];
  /** steps[seat][token]: -1 yard, 0–50 track, 51–56 home lane, 57 centre. */
  steps: number[][];
  turn: number;
  phase: "roll" | "move";
  dice: number | null;
  sixes: number;
  last: {
    moveNo: number;
    seat: number;
    dice: number;
    token: number | null;
    captured: number;
    note: "roll" | "open" | "move" | "capture" | "home" | "pass" | "sixes";
  } | null;
};

export type LudoAction = { type: "roll" } | { type: "move"; token: number };

export function coloursFor(count: number): number[] {
  if (count === 2) return [0, 2];
  return Array.from({ length: count }, (_, i) => i);
}

export function trackIndex(colour: number, steps: number): number | null {
  if (steps < 0 || steps > 50) return null;
  return (START[colour] + steps) % 52;
}

/** Where this token would land, or null if that roll cannot be played with it. */
export function landOn(from: number, dice: number): number | null {
  if (from === YARD_POS) return dice === 6 ? 0 : null;
  if (from >= DONE) return null;
  const next = from + dice;
  return next > DONE ? null : next;
}

export function legalTokens(state: LudoState, dice: number, seat = state.turn): number[] {
  const mine = state.steps[seat];
  const out: number[] = [];
  for (let t = 0; t < TOKEN_COUNT; t++) if (landOn(mine[t], dice) !== null) out.push(t);
  return out;
}

function capturedTokens(state: LudoState, seat: number, steps: number): { seat: number; token: number }[] {
  const index = trackIndex(state.colours[seat], steps);
  if (index === null || SAFE.has(index)) return [];
  const hits: { seat: number; token: number }[] = [];
  state.steps.forEach((tokens, other) => {
    if (other === seat) return;
    tokens.forEach((pos, token) => {
      if (trackIndex(state.colours[other], pos) === index) hits.push({ seat: other, token });
    });
  });
  return hits;
}

function allHome(tokens: number[]): boolean {
  return tokens.every((s) => s === DONE);
}

function nextSeat(state: LudoState): number {
  return (state.turn + 1) % state.players.length;
}

export const ludo: GameRules<LudoState, LudoAction> = {
  meta: {
    id: "ludo",
    name: "Ludo",
    tamilName: "லூடோ",
    tagline: "Roll a six, chase them round the cross, reach home first.",
    emoji: "🎲",
    category: "Strategy",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "Easy",
    duration: "15–25",
    accent: "from-rose-500 to-amber-400",
    rules: [
      "Each colour has four tokens in its yard. Two players take opposite corners.",
      "Roll a 6 to bring a token onto your start square. A 6 gives you another roll.",
      "Move one token by the exact number. You need the exact roll to finish.",
      "Land on an opponent on an ordinary square and they go back to their yard. You roll again.",
      "Start squares and starred squares are safe.",
      "Three 6s in a row cancels the turn.",
      "First to get all four tokens to the centre wins.",
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players) {
    const colours = coloursFor(players.length);
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      colours,
      steps: players.map(() => Array(TOKEN_COUNT).fill(YARD_POS)),
      turn: 0,
      phase: "roll",
      dice: null,
      sixes: 0,
      last: null,
    };
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The match is over.");
    const seat = state.players.findIndex((p) => p.id === by);
    if (seat !== state.turn) return fail("Not your turn.");

    if (action.type === "roll") {
      if (state.phase !== "roll") return fail("You already rolled.");
      const dice = randomInt(1, 6);
      const sixes = dice === 6 ? state.sixes + 1 : 0;
      const rolled = { ...state, dice, sixes };
      if (sixes >= 3) {
        return bump({
          ...rolled,
          turn: nextSeat(state),
          phase: "roll",
          dice: null,
          sixes: 0,
          last: { moveNo: state.moveNo + 1, seat, dice, token: null, captured: 0, note: "sixes" },
        });
      }
      const choices = legalTokens(rolled, dice);
      if (choices.length === 0) {
        return bump({
          ...rolled,
          turn: nextSeat(state),
          phase: "roll",
          dice: null,
          sixes: 0,
          last: { moveNo: state.moveNo + 1, seat, dice, token: null, captured: 0, note: "pass" },
        });
      }
      return bump({
        ...rolled,
        phase: "move",
        last: { moveNo: state.moveNo + 1, seat, dice, token: null, captured: 0, note: "roll" },
      });
    }

    if (action.type !== "move") return fail("Unknown move.");
    if (state.phase !== "move" || state.dice === null) return fail("Roll the die first.");
    if (!legalTokens(state, state.dice).includes(action.token)) return fail("That token can't move.");

    const from = state.steps[seat][action.token];
    const to = landOn(from, state.dice)!;
    const hits = capturedTokens(state, seat, to);
    const steps = state.steps.map((row) => [...row]);
    steps[seat][action.token] = to;
    for (const hit of hits) steps[hit.seat][hit.token] = YARD_POS;

    const note = to === DONE ? "home" : hits.length ? "capture" : from === YARD_POS ? "open" : "move";
    const next: LudoState = {
      ...state,
      steps,
      last: { moveNo: state.moveNo + 1, seat, dice: state.dice, token: action.token, captured: hits.length, note },
    };
    if (allHome(steps[seat])) {
      const scores = state.players.map((p, i) => ({
        playerId: p.id,
        label: `${steps[i].filter((s) => s === DONE).length}/${TOKEN_COUNT} home`,
      }));
      return finish(bump(next), {
        winners: [by],
        title: `${state.players[seat].name} wins!`,
        detail: "All four tokens reached the centre.",
        scores,
      });
    }

    const again = state.dice === 6 || hits.length > 0;
    return bump({
      ...next,
      turn: again ? seat : nextSeat(state),
      phase: "roll",
      dice: null,
      sixes: again && state.dice === 6 ? state.sixes : 0,
    });
  },

  view: (state) => state,
};
