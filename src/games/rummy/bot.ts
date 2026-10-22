import { pickRandom, plays } from "../botUtils";
import type { GameBot } from "../types";
import type { PlayingCard } from "../cards/deck";
import { arrangeHand } from "./arrange";
import { cardPoints, isJoker } from "./melds";
import type { RummyAction, RummyState } from "./logic";

/**
 * Beginner: always draws from the deck, throws a random high card.
 * Intermediate: picks the open card when it clearly helps, discards its worst card.
 * Pro: same with a tighter threshold for taking the open card.
 */
export const rummyBot: GameBot<RummyState, RummyAction> = (s, me, level) => {
  const meIdx = s.players.findIndex((p) => p.id === me);
  if (s.status !== "playing" || s.turn !== meIdx || s.status_[me] !== "playing") return null;
  const hand = s.hands[me] as PlayingCard[];

  if (s.phase === "draw") {
    const now = arrangeHand(hand, s.jokerRank);
    const open = s.discard[s.discard.length - 1];
    if (open && level !== "beginner") {
      if (isJoker(open, s.jokerRank)) return { type: "draw", from: "discard" };
      const withOpen = arrangeHand([...hand, open], s.jokerRank);
      const gain = now.points - (withOpen.points - cardPoints(open, s.jokerRank));
      if (gain >= (level === "pro" ? 4 : 8)) return { type: "draw", from: "discard" };
    }
    return { type: "draw", from: "stock" };
  }

  // Discard phase: try every card and keep the best remaining arrangement.
  const options = hand.filter((c) => c.id !== s.drewFromDiscard && !isJoker(c, s.jokerRank));
  const pool = options.length ? options : hand.filter((c) => c.id !== s.drewFromDiscard);

  if (!plays(level)) {
    const high = [...pool].sort((a, b) => cardPoints(b, s.jokerRank) - cardPoints(a, s.jokerRank)).slice(0, 4);
    return { type: "discard", cardId: pickRandom(high).id };
  }

  let bestCard = pool[0];
  let best = arrangeHand(hand.filter((c) => c.id !== bestCard.id), s.jokerRank);
  for (const c of pool.slice(1)) {
    const a = arrangeHand(hand.filter((x) => x.id !== c.id), s.jokerRank);
    // Fewer points wins; on a tie throw the higher card.
    if (a.valid && !best.valid) {
      best = a;
      bestCard = c;
    } else if (a.valid === best.valid && (a.points < best.points || (a.points === best.points && cardPoints(c, s.jokerRank) > cardPoints(bestCard, s.jokerRank)))) {
      best = a;
      bestCard = c;
    }
  }

  const groups = [...best.groups.map((g) => g.map((c) => c.id)), [bestCard.id]];
  const arrange: RummyAction = { type: "arrange", groups };
  return best.valid ? [arrange, { type: "declare", cardId: bestCard.id }] : [arrange, { type: "discard", cardId: bestCard.id }];
};
