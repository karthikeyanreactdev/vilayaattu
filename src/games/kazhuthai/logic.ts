import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";
import { cardLabel, createDeck, deal, hide, sortCards, type MaybeCard, type PlayingCard, type Suit } from "../cards/deck";

/** How long a player has to play one card. */
export const KAZHUTHAI_TURN_MS = 15_000;

/**
 * Kazhuthai (Donkey). The whole deck is dealt. Ace of spades leads.
 * Follow suit if you can. If everyone follows, the trick is thrown away and
 * the highest card leads next. If someone can't follow, they "cut" with any
 * card: the trick stops and the highest card of the led suit picks it all up.
 * Empty your hand to escape. The last one holding cards is the Kazhuthai.
 */

export type TrickCard = { playerId: PlayerId; card: PlayingCard };

export type KazhuthaiState = BaseGameState & {
  players: PlayerRef[];
  hands: Record<PlayerId, MaybeCard[]>;
  counts: Record<PlayerId, number>;
  trick: TrickCard[];
  ledSuit: Suit | null;
  turn: PlayerId;
  /** Order in which players escaped. */
  finished: PlayerId[];
  firstTrick: boolean;
  lastTrick: { cards: TrickCard[]; outcome: "discard" | "cut"; taker: PlayerId; cutBy: PlayerId | null } | null;
  discarded: number;
  /** Host time when the current turn expires. */
  deadline: number;
  /** Players who ran out of time and could not play a card this trick. */
  passed: PlayerId[];
  /** Set when the clock played or passed for this player. Cleared on a voluntary play. */
  timedOut: PlayerId | null;
};

export type KazhuthaiAction = { type: "play"; cardId: string } | { type: "next" };

const value = (c: PlayingCard) => (c.rank === 1 ? 14 : c.rank);
const realHand = (s: KazhuthaiState, id: PlayerId) => s.hands[id] as PlayingCard[];

function activePlayers(state: KazhuthaiState, hands = state.hands) {
  return state.players.filter((p) => hands[p.id].length > 0).map((p) => p.id);
}

/** Next seat after `from` that still holds cards. */
function nextActive(state: KazhuthaiState, from: PlayerId, hands: Record<PlayerId, MaybeCard[]>): PlayerId {
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === from);
  for (let k = 1; k <= n; k++) {
    const p = state.players[(start + k) % n];
    if (hands[p.id].length > 0) return p.id;
  }
  return from;
}

export const kazhuthai: GameRules<KazhuthaiState, KazhuthaiAction> = {
  meta: {
    id: "kazhuthai",
    name: "Kazhuthai",
    tamilName: "கழுதை",
    tagline: "Don't be the donkey! Follow suit or cut the trick.",
    emoji: "🫏",
    category: "Cards",
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: "Easy",
    duration: "10–15",
    accent: "from-rose-500 to-pink-700",
    rules: [
      "All 52 cards are dealt. The player with the Ace of spades leads it.",
      "Everyone must follow the suit that was led, if they can.",
      "If everyone follows, the trick is thrown away. The highest card leads next.",
      "If you can't follow, play any card. That's a cut: the trick stops, and whoever played the highest card of the led suit picks up all the cards.",
      "Empty your hand to escape. The last player holding cards is the Kazhuthai (donkey)!",
      "You have 15 seconds each turn. If you don't play, your lowest legal card is played for you. If you have no legal card, the turn passes on.",
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players, _options, ctx) {
    const { hands } = deal(createDeck(), players.length);
    const handMap: Record<PlayerId, PlayingCard[]> = {};
    players.forEach((p, i) => (handMap[p.id] = sortCards(hands[i])));
    const starter = players.find((p) => handMap[p.id].some((c) => c.suit === "S" && c.rank === 1))!;
    return {
      status: "playing",
      result: null,
      moveNo: 0,
      players,
      hands: handMap,
      counts: Object.fromEntries(players.map((p) => [p.id, handMap[p.id].length])),
      trick: [],
      ledSuit: null,
      turn: starter.id,
      finished: [],
      firstTrick: true,
      lastTrick: null,
      discarded: 0,
      // The opening lead waits out the shuffle animation as well.
      deadline: ctx.now + KAZHUTHAI_TURN_MS + 2500,
      passed: [],
      timedOut: null,
    };
  },

  reduce(state, action, by, ctx) {
    if (state.status !== "playing") return fail("The game is over.");
    if (action.type === "next") return fail("Nothing to do.");
    if (by !== state.turn) return fail("Wait for your turn.");
    return applyPlay(state, action.cardId, by, ctx.now, false);
  },

  tick(state, { now }) {
    if (state.status !== "playing" || typeof state.deadline !== "number" || now < state.deadline) return null;
    const legal = legalCards(state, state.turn);
    if (legal.length > 0) {
      const card = legal.reduce((a, b) => (value(b) < value(a) ? b : a));
      const next = applyPlay(state, card.id, state.turn, now, true);
      return "error" in next ? null : next;
    }
    return passTurn(state, now);
  },

  view(state, viewer) {
    const hands: Record<PlayerId, MaybeCard[]> = {};
    for (const p of state.players) {
      const cards = realHand(state, p.id);
      hands[p.id] = p.id === viewer || state.status === "finished" ? cards : hide(cards);
    }
    return { ...state, hands };
  },
};

/** Cards this player is allowed to play right now. */
function legalCards(state: KazhuthaiState, id: PlayerId, hands = state.hands): PlayingCard[] {
  const hand = (hands[id] ?? []) as PlayingCard[];
  if (!hand.length) return [];
  if (state.firstTrick && state.trick.length === 0) return hand.filter((c) => c.suit === "S" && c.rank === 1);
  if (state.ledSuit && hand.some((c) => c.suit === state.ledSuit)) return hand.filter((c) => c.suit === state.ledSuit);
  return hand;
}

/** Next player who still has cards and has neither played nor passed in this trick. */
function nextToAct(state: KazhuthaiState, from: PlayerId, hands: Record<PlayerId, MaybeCard[]>, trick: TrickCard[], passed: PlayerId[]): PlayerId | null {
  const played = new Set(trick.map((t) => t.playerId));
  const skip = new Set(passed);
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === from);
  for (let k = 1; k <= n; k++) {
    const p = state.players[(start + k) % n];
    if (hands[p.id].length > 0 && !played.has(p.id) && !skip.has(p.id)) return p.id;
  }
  return null;
}

function suitName(suit: Suit) {
  return suit === "S" ? "spades" : suit === "H" ? "hearts" : suit === "D" ? "diamonds" : "clubs";
}

function applyPlay(state: KazhuthaiState, cardId: string, by: PlayerId, now: number, timedOut: boolean): KazhuthaiState | { error: string } {
  const hand = realHand(state, by);
  const card = hand.find((c) => c.id === cardId);
  if (!card) return fail("You don't have that card.");

  if (state.firstTrick && state.trick.length === 0 && !(card.suit === "S" && card.rank === 1)) {
    return fail("Lead with the Ace of spades.");
  }
  const led = state.ledSuit;
  if (led && card.suit !== led && hand.some((c) => c.suit === led)) {
    return fail(`You have ${suitName(led)}, so you must follow suit.`);
  }

  const hands = { ...state.hands, [by]: hand.filter((c) => c.id !== card.id) };
  const trick = [...state.trick, { playerId: by, card }];
  const ledSuit = led ?? card.suit;
  const isCut = led !== null && card.suit !== led;
  const trickDone = isCut || nextToAct(state, by, hands, trick, state.passed) === null;

  let next: KazhuthaiState = {
    ...state,
    hands,
    trick,
    ledSuit,
    timedOut: timedOut ? by : null,
    deadline: now + KAZHUTHAI_TURN_MS,
  };

  if (!trickDone) {
    next.turn = nextToAct(state, by, hands, trick, state.passed)!;
  } else {
    const highest = trick.filter((t) => t.card.suit === ledSuit).reduce((a, b) => (value(b.card) > value(a.card) ? b : a));
    if (isCut) {
      hands[highest.playerId] = sortCards([...(hands[highest.playerId] as PlayingCard[]), ...trick.map((t) => t.card)]);
    }
    next = {
      ...next,
      hands,
      trick: [],
      ledSuit: null,
      passed: [],
      firstTrick: false,
      discarded: state.discarded + (isCut ? 0 : trick.length),
      lastTrick: { cards: trick, outcome: isCut ? "cut" : "discard", taker: highest.playerId, cutBy: isCut ? by : null },
      turn: hands[highest.playerId].length > 0 ? highest.playerId : nextActive(state, highest.playerId, hands),
    };
  }

  return closeIfDone(next, hands, trickDone);
}

/** No legal card (the clock can't play one). Hand the turn to someone who can. */
function passTurn(state: KazhuthaiState, now: number): KazhuthaiState {
  const passed = [...state.passed, state.turn];
  const nextId = nextToAct(state, state.turn, state.hands, state.trick, passed);
  if (state.trick.length > 0 && nextId === null) {
    const ledSuit = state.ledSuit ?? state.trick[0].card.suit;
    const highest = state.trick.filter((t) => t.card.suit === ledSuit).reduce((a, b) => (value(b.card) > value(a.card) ? b : a));
    const hands = state.hands;
    const next: KazhuthaiState = {
      ...state,
      hands,
      trick: [],
      ledSuit: null,
      passed: [],
      firstTrick: false,
      timedOut: state.turn,
      discarded: state.discarded + state.trick.length,
      lastTrick: { cards: state.trick, outcome: "discard", taker: highest.playerId, cutBy: null },
      turn: hands[highest.playerId].length > 0 ? highest.playerId : nextActive(state, highest.playerId, hands),
      deadline: now + KAZHUTHAI_TURN_MS,
    };
    return closeIfDone(next, hands, true);
  }

  const holders = activePlayers(state).filter((id) => !passed.includes(id));
  const turn = nextId ?? (holders.length === 0 ? nextActive(state, state.turn, state.hands) : holders[0]);
  return bump({
    ...state,
    passed: nextId ? passed : [],
    turn,
    timedOut: state.turn,
    deadline: now + KAZHUTHAI_TURN_MS,
  });
}

function closeIfDone(next: KazhuthaiState, hands: Record<PlayerId, MaybeCard[]>, trickDone: boolean): KazhuthaiState {
  const finished = [...next.finished];
  for (const p of next.players) {
    if (hands[p.id].length === 0 && !finished.includes(p.id)) finished.push(p.id);
  }
  next.finished = finished;
  next.counts = Object.fromEntries(next.players.map((p) => [p.id, hands[p.id].length]));

  const stillIn = activePlayers(next, hands);
  if (trickDone && stillIn.length <= 1) {
    const donkey = stillIn[0] ?? null;
    const donkeyName = next.players.find((p) => p.id === donkey)?.name;
    const scores = next.players.map((p) => {
      const pos = finished.indexOf(p.id);
      return { playerId: p.id, label: p.id === donkey ? "🫏 Kazhuthai" : pos >= 0 ? `Escaped #${pos + 1}` : "—" };
    });
    next = finish(next, {
      winners: finished.slice(0, 1),
      loser: donkey ?? undefined,
      title: donkey ? `${donkeyName} is the Kazhuthai! 🫏` : "Everyone escaped!",
      detail: donkey ? `Stuck with ${hands[donkey].length} card${hands[donkey].length === 1 ? "" : "s"}` : "No donkey this time",
      scores,
    });
  }
  return bump(next);
}

export { cardLabel };
