import type { PlayingCard } from "../cards/deck";

/**
 * 13-card Indian Rummy meld rules.
 * - Pure sequence: 3+ consecutive cards of one suit, no wild jokers.
 * - Impure sequence: as above, jokers fill gaps.
 * - Set: 3–4 cards of one rank, different suits, jokers allowed.
 * Ace can be low (A-2-3) or high (Q-K-A).
 */

export type MeldKind = "pure" | "sequence" | "set" | "invalid";

export const isJoker = (card: PlayingCard, jokerRank: number) => card.rank === 0 || card.rank === jokerRank;

export function cardPoints(card: PlayingCard, jokerRank: number): number {
  if (isJoker(card, jokerRank)) return 0;
  if (card.rank === 1 || card.rank >= 11) return 10;
  return card.rank;
}

function fitsRun(values: number[], jokers: number): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) return false;
  if (sorted.length === 0) return true;
  const span = sorted[sorted.length - 1] - sorted[0] + 1;
  return span - sorted.length <= jokers && span + Math.max(0, jokers - (span - sorted.length)) <= 14;
}

function isRun(cards: PlayingCard[], jokers: number): boolean {
  if (cards.length === 0) return true;
  const suit = cards[0].suit;
  if (suit === "J" || cards.some((c) => c.suit !== suit)) return false;
  const low = cards.map((c) => c.rank);
  const high = cards.map((c) => (c.rank === 1 ? 14 : c.rank));
  return fitsRun(low, jokers) || fitsRun(high, jokers);
}

export function classifyMeld(cards: PlayingCard[], jokerRank: number): MeldKind {
  if (cards.length < 3) return "invalid";

  // Pure: every card in its natural place (a wild-rank card may sit naturally).
  if (!cards.some((c) => c.rank === 0) && isRun(cards, 0)) return "pure";

  const naturals = cards.filter((c) => !isJoker(c, jokerRank));
  const jokers = cards.length - naturals.length;

  if (naturals.length === 0) return "sequence";
  if (isRun(naturals, jokers)) return "sequence";

  if (cards.length <= 4) {
    const rank = naturals[0].rank;
    const suits = new Set(naturals.map((c) => c.suit));
    if (naturals.every((c) => c.rank === rank) && suits.size === naturals.length) return "set";
  }
  return "invalid";
}

export const MELD_LABEL: Record<MeldKind, string> = {
  pure: "Pure sequence",
  sequence: "Sequence",
  set: "Set",
  invalid: "Not a meld",
};

export type HandCheck = {
  valid: boolean;
  reason: string;
  kinds: MeldKind[];
  points: number;
};

/** Validate a full arrangement and compute its points (0 when valid). */
export function checkHand(groups: PlayingCard[][], jokerRank: number): HandCheck {
  const kinds = groups.map((g) => classifyMeld(g, jokerRank));
  const pure = kinds.filter((k) => k === "pure").length;
  const sequences = kinds.filter((k) => k === "pure" || k === "sequence").length;
  const allCards = groups.flat();
  const total = Math.min(80, allCards.reduce((sum, c) => sum + cardPoints(c, jokerRank), 0));

  if (pure === 0) return { valid: false, reason: "You need at least one pure sequence.", kinds, points: total };
  if (sequences < 2) return { valid: false, reason: "You need at least two sequences.", kinds, points: total };

  const loose = groups
    .filter((_, i) => kinds[i] === "invalid")
    .flat()
    .reduce((sum, c) => sum + cardPoints(c, jokerRank), 0);
  if (loose > 0 || kinds.includes("invalid")) {
    return { valid: false, reason: "Some groups are not valid melds.", kinds, points: Math.min(80, loose) };
  }
  return { valid: true, reason: "Valid declaration!", kinds, points: 0 };
}
