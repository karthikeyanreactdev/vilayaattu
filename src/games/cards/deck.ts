import { shuffle } from "@/lib/random";

/** Standard playing-card engine shared by Kazhuthai and Rummy. */

export type Suit = "S" | "H" | "D" | "C" | "J";

export type PlayingCard = {
  id: string;
  /** 1 = Ace … 13 = King, 0 = printed joker */
  rank: number;
  suit: Suit;
};

/** A card the viewer may not see. */
export type HiddenCard = { id: string; hidden: true };
export type MaybeCard = PlayingCard | HiddenCard;

export const SUITS: Exclude<Suit, "J">[] = ["S", "H", "D", "C"];

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣", J: "★" };
export const SUIT_NAME: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs", J: "Joker" };

export const isRed = (suit: Suit) => suit === "H" || suit === "D";
export const isHidden = (c: MaybeCard): c is HiddenCard => "hidden" in c;

export function rankLabel(rank: number): string {
  if (rank === 0) return "JK";
  return ({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[rank] ?? String(rank);
}

export function cardLabel(card: PlayingCard): string {
  return card.rank === 0 ? "Joker" : `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

export function createDeck(decks = 1, jokers = 0): PlayingCard[] {
  const cards: PlayingCard[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) cards.push({ id: `${d}${suit}${rank}`, rank, suit });
    }
  }
  for (let j = 0; j < jokers; j++) cards.push({ id: `JK${j}`, rank: 0, suit: "J" });
  return shuffle(cards);
}

/** Deal round-robin. Leftover cards stay in the returned stock. */
export function deal(deck: PlayingCard[], players: number, perPlayer?: number) {
  const hands: PlayingCard[][] = Array.from({ length: players }, () => []);
  const count = perPlayer ?? Math.floor(deck.length / players);
  let i = 0;
  for (let round = 0; round < count; round++) {
    for (let p = 0; p < players; p++) hands[p].push(deck[i++]);
  }
  if (perPlayer === undefined) {
    // Spread the remainder too (used when dealing the whole deck).
    let p = 0;
    while (i < deck.length) hands[p++ % players].push(deck[i++]);
  }
  return { hands, stock: deck.slice(i) };
}

export function hide(cards: PlayingCard[]): HiddenCard[] {
  return cards.map((c) => ({ id: c.id, hidden: true }));
}

const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3, J: 4 };

/** Sort by suit then rank. `aceHigh` puts aces after kings. */
export function sortCards(cards: PlayingCard[], aceHigh = true): PlayingCard[] {
  const r = (c: PlayingCard) => (aceHigh && c.rank === 1 ? 14 : c.rank);
  return [...cards].sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || r(a) - r(b));
}
