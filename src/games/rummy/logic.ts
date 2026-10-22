import { shuffle } from "@/lib/random";
import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, GameResult, PlayerId, PlayerRef } from "../types";
import { createDeck, hide, SUITS, type MaybeCard, type PlayingCard } from "../cards/deck";
import { checkHand } from "./melds";

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

export const rummy: GameRules<RummyState, RummyAction> = {
  meta: {
    id: "rummy",
    name: "Rummy",
    tamilName: "ரம்மி",
    tagline: "13-card Indian Rummy. Make your sequences and declare.",
    emoji: "🂡",
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
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players) {
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
    };
  },

  reduce(state, action, by) {
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
        s = { ...s, turn: nextPlaying(s, me), phase: "draw" as const };
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
        return bump({ ...s, turn: nextPlaying(s, me), phase: "draw" as const });
      }
    }
    return fail("Unknown move.");
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
