import { pickRandom, plays } from "../botUtils";
import type { GameBot } from "../types";
import type { PlayingCard, Suit } from "../cards/deck";
import type { KazhuthaiAction, KazhuthaiState } from "./logic";

const value = (c: PlayingCard) => (c.rank === 1 ? 14 : c.rank);
const high = (cards: PlayingCard[]) => cards.reduce((a, b) => (value(b) > value(a) ? b : a));
const low = (cards: PlayingCard[]) => cards.reduce((a, b) => (value(b) < value(a) ? b : a));

function bySuit(hand: PlayingCard[]) {
  const m = new Map<Suit, PlayingCard[]>();
  for (const c of hand) m.set(c.suit, [...(m.get(c.suit) ?? []), c]);
  return m;
}

/**
 * Beginner: any legal card.
 * Intermediate: sheds high cards while it's safe, ducks under the current winner.
 * Pro: also leads from long suits and cuts from short suits to create voids.
 */
export const kazhuthaiBot: GameBot<KazhuthaiState, KazhuthaiAction> = (s, me, level) => {
  if (s.status !== "playing" || s.turn !== me) return null;
  const hand = s.hands[me] as PlayingCard[];
  if (!hand.length) return null;

  // First lead must be the Ace of spades.
  if (s.firstTrick && s.trick.length === 0) {
    const ace = hand.find((c) => c.suit === "S" && c.rank === 1);
    return ace ? { type: "play", cardId: ace.id } : null;
  }

  const led = s.ledSuit;
  const following = led ? hand.filter((c) => c.suit === led) : [];
  const legal = led && following.length ? following : hand;
  if (!plays(level)) return { type: "play", cardId: pickRandom(legal).id };

  const suits = bySuit(hand);

  // Leading.
  if (!led) {
    const longest = [...suits.values()].sort((a, b) => b.length - a.length)[0];
    const pickFrom = level === "pro" ? longest : hand;
    return { type: "play", cardId: high(pickFrom).id };
  }

  // Following suit.
  if (following.length) {
    const ledCards = s.trick.filter((t) => t.card.suit === led).map((t) => t.card);
    const top = ledCards.length ? value(high(ledCards)) : 0;
    const activeLeft = s.players.filter((p) => s.counts[p.id] > 0 && p.id !== me && !s.trick.some((t) => t.playerId === p.id)).length;
    // Last to play and nobody cut: the trick will be thrown away, so dump the highest.
    if (activeLeft === 0) return { type: "play", cardId: high(following).id };
    const under = following.filter((c) => value(c) < top);
    if (under.length) return { type: "play", cardId: high(under).id };
    return { type: "play", cardId: low(following).id };
  }

  // Cutting: throw a big card. Pro prefers short suits to make more voids.
  if (level === "pro") {
    const shortest = [...suits.values()].sort((a, b) => a.length - b.length || value(high(b)) - value(high(a)))[0];
    return { type: "play", cardId: high(shortest).id };
  }
  return { type: "play", cardId: high(hand).id };
};
