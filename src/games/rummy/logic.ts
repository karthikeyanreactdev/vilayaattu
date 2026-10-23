import { shuffle } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import { isGameError, type BaseGameState, type GameRules, type GameResult, type PlayerId, type PlayerRef } from "../types";
import { createDeck, hide, SUITS, type MaybeCard, type PlayingCard } from "../cards/deck";
import { cardPoints, checkHand } from "./melds";

/** How long a player has to draw, and then to discard. */
export const RUMMY_TURN_MS = 45_000;

/** 13-card Indian Rummy (points). Draw, discard, arrange melds and declare. */

export type RummyPlayerStatus = "playing" | "dropped" | "wrong-show";

export type RummyState = BaseGameState & {
  players: PlayerRef[];
  hands: Record<PlayerId, MaybeCard[]>;
  /** Each player's private arrangement: groups of card ids. */
  groups: Record<PlayerId, string[][]>;
  counts: Record<PlayerId, number>;
  stock: MaybeCard[];
  stockCount: number;
  discard: PlayingCard[];
  jokerCard: PlayingCard;
  jokerRank: number;
  turn: number;
  phase: "draw" | "discard";
  drewFromDiscard: string | null;
  turnsTaken: Record<PlayerId, number>;
  status_: Record<PlayerId, RummyPlayerStatus>;
  penalties: Record<PlayerId, number>;
  lastEvent: { by: PlayerId; text: string; n: number } | null;
  /** Host time when the current draw or discard expires. */
  deadline: number;
  /** Player whose last action was taken by the clock. */
  timedOut: PlayerId | null;
};

export type RummyAction =
  | { type: "draw"; from: "stock" | "discard" }
  | { type: "discard"; cardId: string }
  | { type: "arrange"; groups: string[][] }
  | { type: "declare"; cardId: string }
  | { type: "drop" };

const cardsOf = (s: RummyState, id: PlayerId) => s.hands[id] as PlayingCard[];

function defaultGroups(cards: PlayingCard[], jokerRank: number): string[][] {
  const groups: string[][] = [];
  const jokers = cards.filter((c) => c.rank === 0 || c.rank === jokerRank);
  for (const suit of SUITS) {
    const g = cards
      .filter((c) => c.suit === suit && c.rank !== jokerRank)
      .sort((a, b) => a.rank - b.rank)
      .map((c) => c.id);
    if (g.length) groups.push(g);
  }
  if (jokers.length) groups.push(jokers.map((c) => c.id));
  return groups;
}

function removeFromGroups(groups: string[][], cardId: string) {
  return groups.map((g) => g.filter((id) => id !== cardId)).filter((g) => g.length > 0);
}

function nextPlaying(s: RummyState, from: number): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (s.status_[s.players[i].id] === "playing") return i;
  }
  return from;
}

function remainingPlayers(s: RummyState) {
  return s.players.filter((p) => s.status_[p.id] === "playing");
}

function resolveCards(s: RummyState, id: PlayerId, groups: string[][]): PlayingCard[][] {
  const map = new Map(cardsOf(s, id).map((c) => [c.id, c]));
  return groups.map((g) => g.map((cid) => map.get(cid)!).filter(Boolean));
}

function endGame(s: RummyState, winner: PlayerId, detail: string): RummyState {
  const scores = s.players.map((p) => {
    let pts = 0;
    let label: string;
    if (p.id === winner) label = "🏆 0 pts";
    else if (s.status_[p.id] !== "playing") {
      pts = s.penalties[p.id];
      label = `${pts} pts (${s.status_[p.id] === "dropped" ? "dropped" : "wrong show"})`;
    } else {
      pts = checkHand(resolveCards(s, p.id, s.groups[p.id]), s.jokerRank).points;
      label = `${pts} pts`;
    }
    return { playerId: p.id, label };
  });
  const name = s.players.find((p) => p.id === winner)?.name ?? "Player";
  const result: GameResult = { winners: [winner], title: `${name} wins!`, detail, scores };
  return finish(s, result);
}

function arm(now: number) {
  return { deadline: now + RUMMY_TURN_MS, timedOut: null as PlayerId | null };
}

/** Closed deck when it has cards (or can be rebuilt). Otherwise the open card. */
function autoDraw(state: RummyState): RummyAction | null {
  const stock = state.stock as PlayingCard[];
  if (stock.length > 0 || state.discard.length > 1) return { type: "draw", from: "stock" };
  if (state.discard.length > 0) return { type: "draw", from: "discard" };
  return null;
}

/** Highest-point card that is not the one just taken from the open pile. */
function autoDiscard(state: RummyState, by: PlayerId): RummyAction | null {
  const pool = cardsOf(state, by).filter((c) => c.id !== state.drewFromDiscard);
  if (!pool.length) return null;
  const card = pool.reduce((best, c) => (cardPoints(c, state.jokerRank) > cardPoints(best, state.jokerRank) ? c : best));
  return { type: "discard", cardId: card.id };
}

function reduceRummy(state: RummyState, action: RummyAction, by: PlayerId, now: number): RummyState | { error: string } {
  if (state.status !== "playing") return fail("The game is over.");
  const me = state.players.findIndex((p) => p.id === by);
  if (me < 0 || state.status_[by] !== "playing") return fail("You are out of this game.");
  const ev = (text: string) => ({ by, text, n: state.moveNo + 1 });
  const myCards = cardsOf(state, by);

  if (action.type === "arrange") {
    const ids = action.groups.flat();
    const owned = new Set(myCards.map((c) => c.id));
    if (ids.length !== owned.size || new Set(ids).size !== ids.length || ids.some((id) => !owned.has(id))) {
      return fail("Arrangement doesn't match your hand.");
    }
    return bump({ ...state, groups: { ...state.groups, [by]: action.groups.filter((g) => g.length > 0) } });
  }

  if (me !== state.turn) return fail("Wait for your turn.");

  switch (action.type) {
    case "drop": {
      if (state.phase !== "draw") return fail("You can only drop at the start of your turn.");
      const penalty = state.turnsTaken[by] === 0 ? 20 : 40;
      let s: RummyState = {
        ...state,
        status_: { ...state.status_, [by]: "dropped" },
        penalties: { ...state.penalties, [by]: penalty },
        lastEvent: ev(`dropped (${penalty} pts)`),
      };
      const left = remainingPlayers(s);
      if (left.length === 1) return bump(endGame(s, left[0].id, "Everyone else dropped"));
      s = { ...s, turn: nextPlaying(s, me), phase: "draw" as const, ...arm(now) };
      return bump(s);
    }
    case "draw": {
      if (state.phase !== "draw") return fail("You already drew. Discard a card.");
      let stock = state.stock as PlayingCard[];
      let discard = state.discard;
      let card: PlayingCard;
      if (action.from === "discard") {
        if (discard.length === 0) return fail("The open pile is empty.");
        card = discard[discard.length - 1];
        discard = discard.slice(0, -1);
      } else {
        if (stock.length === 0) {
          if (discard.length <= 1) return fail("No cards left to draw.");
          stock = shuffle(discard.slice(0, -1));
          discard = discard.slice(-1);
        }
        card = stock[stock.length - 1];
        stock = stock.slice(0, -1);
      }
      const groups = [...state.groups[by], [card.id]];
      return bump({
        ...state,
        ...arm(now),
        stock,
        stockCount: stock.length,
        discard,
        hands: { ...state.hands, [by]: [...myCards, card] },
        groups: { ...state.groups, [by]: groups },
        counts: { ...state.counts, [by]: myCards.length + 1 },
        phase: "discard" as const,
        drewFromDiscard: action.from === "discard" ? card.id : null,
        lastEvent: ev(action.from === "discard" ? "picked from the open pile" : "drew from the deck"),
      });
    }
    case "discard":
    case "declare": {
      if (state.phase !== "discard") return fail("Draw a card first.");
      const card = myCards.find((c) => c.id === action.cardId);
      if (!card) return fail("You don't have that card.");
      if (action.type === "discard" && card.id === state.drewFromDiscard) {
        return fail("You can't throw back the card you just picked from the open pile.");
      }
      const hand = myCards.filter((c) => c.id !== card.id);
      const groups = removeFromGroups(state.groups[by], card.id);
      let s: RummyState = {
        ...state,
        hands: { ...state.hands, [by]: hand },
        groups: { ...state.groups, [by]: groups },
        counts: { ...state.counts, [by]: hand.length },
        discard: [...state.discard, card],
        turnsTaken: { ...state.turnsTaken, [by]: state.turnsTaken[by] + 1 },
        drewFromDiscard: null,
      };

      if (action.type === "declare") {
        const check = checkHand(resolveCards(s, by, groups), s.jokerRank);
        if (check.valid) return bump(endGame({ ...s, lastEvent: ev("declared!") }, by, "Valid declaration"));
        s = {
          ...s,
          status_: { ...s.status_, [by]: "wrong-show" },
          penalties: { ...s.penalties, [by]: 80 },
          lastEvent: ev(`wrong show: ${check.reason}`),
        };
        const left = remainingPlayers(s);
        if (left.length === 1) return bump(endGame(s, left[0].id, "Opponent made a wrong declaration"));
      } else {
        s.lastEvent = ev("discarded");
      }
      return bump({ ...s, turn: nextPlaying(s, me), phase: "draw" as const, ...arm(now) });
    }
  }
  return fail("Unknown move.");
}

export const rummy: GameRules<RummyState, RummyAction> = {
  meta: {
    id: "rummy",
    name: "Rummy",
    tamilName: "ரம்மி",
    tagline: "13-card Indian Rummy. Make your sequences and declare.",
    emoji: "♥️",
    category: "Cards",
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: "Medium",
    duration: "10–20",
    accent: "from-violet-600 to-fuchsia-600",
    rules: [
      "Each player gets 13 cards. A random card sets the wild joker rank; printed jokers are wild too.",
      "On your turn, draw from the closed deck or the open pile, then discard one card.",
      "Arrange cards into sequences (same suit, consecutive) and sets (same rank, different suits).",
      "To declare you need at least 2 sequences, one of them pure (no jokers). All 13 cards must be in valid groups.",
      "A wrong declaration costs 80 points. You can drop: 20 points before your first draw, 40 after.",
      "The first valid declaration wins. Others score points for their ungrouped cards (max 80).",
      "You have 45 seconds to draw, then 45 seconds to discard. If time runs out, a card is drawn from the deck or discarded for you.",
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players, _options, ctx) {
    const big = players.length > 2;
    const deck = createDeck(big ? 2 : 1, big ? 2 : 1);
    const hands: Record<PlayerId, PlayingCard[]> = {};
    for (const p of players) hands[p.id] = deck.splice(0, 13);
    let jokerIdx = deck.findIndex((c) => c.rank !== 0);
    if (jokerIdx < 0) jokerIdx = 0;
    const [jokerCard] = deck.splice(jokerIdx, 1);
    const jokerRank = jokerCard.rank === 0 ? 1 : jokerCard.rank;
    const open = deck.pop()!;
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      hands,
      groups: Object.fromEntries(players.map((p) => [p.id, defaultGroups(hands[p.id], jokerRank)])),
      counts: Object.fromEntries(players.map((p) => [p.id, 13])),
      stock: deck,
      stockCount: deck.length,
      discard: [open],
      jokerCard,
      jokerRank,
      turn: 0,
      phase: "draw",
      drewFromDiscard: null,
      turnsTaken: Object.fromEntries(players.map((p) => [p.id, 0])),
      status_: Object.fromEntries(players.map((p) => [p.id, "playing" as const])),
      penalties: Object.fromEntries(players.map((p) => [p.id, 0])),
      lastEvent: null,
      // The first draw waits out the shuffle animation as well.
      deadline: ctx.now + RUMMY_TURN_MS + 2500,
      timedOut: null,
    };
  },

  reduce(state, action, by, ctx) {
    return reduceRummy(state, action, by, ctx.now);
  },

  tick(state, { now }) {
    if (state.status !== "playing" || typeof state.deadline !== "number" || now < state.deadline) return null;
    const by = state.players[state.turn]?.id;
    if (!by || state.status_[by] !== "playing") return null;
    const action = state.phase === "draw" ? autoDraw(state) : autoDiscard(state, by);
    if (!action) return { ...state, deadline: now + RUMMY_TURN_MS };
    const next = reduceRummy(state, action, by, now);
    if (isGameError(next)) return { ...state, deadline: now + RUMMY_TURN_MS };
    const text =
      action.type === "draw"
        ? action.from === "discard"
          ? "ran out of time and picked the open card"
          : "ran out of time and drew from the deck"
        : "ran out of time and discarded";
    return {
      ...next,
      timedOut: by,
      lastEvent: next.status === "finished" ? next.lastEvent : { by, text, n: next.moveNo },
    };
  },

  view(state, viewer) {
    const reveal = state.status === "finished";
    const hands: Record<PlayerId, MaybeCard[]> = {};
    const groups: Record<PlayerId, string[][]> = {};
    for (const p of state.players) {
      const mine = p.id === viewer || reveal;
      hands[p.id] = mine ? cardsOf(state, p.id) : hide(cardsOf(state, p.id));
      groups[p.id] = mine ? state.groups[p.id] : [];
    }
    return { ...state, hands, groups, stock: [] };
  },
};
