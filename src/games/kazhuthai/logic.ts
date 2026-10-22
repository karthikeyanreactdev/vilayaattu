import { bump, fail, finish } from "../helpers";
import type { BaseGameState, GameRules, PlayerId, PlayerRef } from "../types";
import { cardLabel, createDeck, deal, hide, sortCards, type MaybeCard, type PlayingCard, type Suit } from "../cards/deck";

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
    ],
  },
  defaultOptions: {},
  optionFields: [],

  setup(players) {
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
    };
  },

  reduce(state, action, by) {
    if (state.status !== "playing") return fail("The game is over.");
    if (action.type === "next") return fail("Nothing to do.");
    if (by !== state.turn) return fail("Wait for your turn.");

    const hand = realHand(state, by);
    const card = hand.find((c) => c.id === action.cardId);
    if (!card) return fail("You don't have that card.");

    if (state.firstTrick && state.trick.length === 0 && !(card.suit === "S" && card.rank === 1)) {
      return fail("Lead with the Ace of spades.");
    }
    const led = state.ledSuit;
    if (led && card.suit !== led && hand.some((c) => c.suit === led)) {
      return fail(`You have ${led === "S" ? "spades" : led === "H" ? "hearts" : led === "D" ? "diamonds" : "clubs"}, so you must follow suit.`);
    }

    const hands = { ...state.hands, [by]: hand.filter((c) => c.id !== card.id) };
    const trick = [...state.trick, { playerId: by, card }];
    const ledSuit = led ?? card.suit;
    const isCut = led !== null && card.suit !== led;

    let next: KazhuthaiState = { ...state, hands, trick, ledSuit };

    // Who should play next in this trick: active players who haven't played yet.
    const played = new Set(trick.map((t) => t.playerId));
    const candidate = nextActive(state, by, hands);
    const waiting = activePlayers(state, hands).filter((id) => !played.has(id));
    const trickDone = isCut || waiting.length === 0 || played.has(candidate);

    if (!trickDone) {
      next.turn = candidate;
    } else {
      const highest = trick
        .filter((t) => t.card.suit === ledSuit)
        .reduce((a, b) => (value(b.card) > value(a.card) ? b : a));
      if (isCut) {
        hands[highest.playerId] = sortCards([...(hands[highest.playerId] as PlayingCard[]), ...trick.map((t) => t.card)]);
      }
      next = {
        ...next,
        hands,
        trick: [],
        ledSuit: null,
        firstTrick: false,
        discarded: state.discarded + (isCut ? 0 : trick.length),
        lastTrick: { cards: trick, outcome: isCut ? "cut" : "discard", taker: highest.playerId, cutBy: isCut ? by : null },
        turn: hands[highest.playerId].length > 0 ? highest.playerId : nextActive(state, highest.playerId, hands),
      };
    }

    // Track escapes.
    const finished = [...state.finished];
    for (const p of state.players) {
      if (hands[p.id].length === 0 && !finished.includes(p.id)) finished.push(p.id);
    }
    next.finished = finished;
    next.counts = Object.fromEntries(state.players.map((p) => [p.id, hands[p.id].length]));

    const stillIn = activePlayers(next, hands);
    if (trickDone && stillIn.length <= 1) {
      const donkey = stillIn[0] ?? null;
      const donkeyName = state.players.find((p) => p.id === donkey)?.name;
      const scores = state.players.map((p) => {
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

export { cardLabel };
