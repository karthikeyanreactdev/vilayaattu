import { SUITS, type PlayingCard } from "../cards/deck";
import { cardPoints, checkHand, isJoker } from "./melds";

/**
 * Finds a low-points arrangement of a rummy hand: which cards form pure
 * sequences, jokered sequences and sets. Used by the computer player.
 */

type Candidate = { ids: string[]; jokers: number; kind: "pure" | "sequence" | "set" };

export type Arrangement = { groups: PlayingCard[][]; points: number; valid: boolean };

const MAX_NODES = 6000;

function runs(cards: PlayingCard[], jokers: number): Candidate[] {
  const out: Candidate[] = [];
  for (const suit of SUITS) {
    const suited = cards.filter((c) => c.suit === suit);
    // Rank → card (duplicates from a second deck are ignored here).
    const byRank = new Map<number, PlayingCard>();
    for (const c of suited) {
      byRank.set(c.rank, c);
      if (c.rank === 1) byRank.set(14, c);
    }
    for (let start = 1; start <= 12; start++) {
      const ids: string[] = [];
      let gaps = 0;
      for (let end = start; end <= 14 && end - start < 10; end++) {
        const c = byRank.get(end);
        if (c && !ids.includes(c.id)) ids.push(c.id);
        else gaps++;
        const len = end - start + 1;
        if (len < 3 || !byRank.get(start) || !c) continue;
        if (gaps === 0) out.push({ ids: [...ids], jokers: 0, kind: "pure" });
        else if (gaps <= jokers && ids.length >= 2) out.push({ ids: [...ids], jokers: gaps, kind: "sequence" });
      }
    }
  }
  return out;
}

function sets(cards: PlayingCard[], jokers: number): Candidate[] {
  const out: Candidate[] = [];
  for (let rank = 1; rank <= 13; rank++) {
    const bySuit = new Map<string, PlayingCard>();
    for (const c of cards) if (c.rank === rank && !bySuit.has(c.suit)) bySuit.set(c.suit, c);
    const group = [...bySuit.values()];
    const subsets = (k: number) => {
      const res: PlayingCard[][] = [];
      const rec = (i: number, acc: PlayingCard[]) => {
        if (acc.length === k) return void res.push(acc);
        for (let j = i; j < group.length; j++) rec(j + 1, [...acc, group[j]]);
      };
      rec(0, []);
      return res;
    };
    for (let k = Math.min(4, group.length); k >= 2; k--) {
      for (const sub of subsets(k)) {
        for (let j = Math.max(0, 3 - k); j <= Math.min(jokers, 4 - k); j++) {
          if (k + j >= 3) out.push({ ids: sub.map((c) => c.id), jokers: j, kind: "set" });
        }
      }
    }
  }
  return out;
}

export function arrangeHand(hand: PlayingCard[], jokerRank: number): Arrangement {
  const jokerCards = hand.filter((c) => isJoker(c, jokerRank));
  // Wild-rank cards can also sit naturally in a pure sequence, so candidates use all real cards.
  const naturals = hand.filter((c) => c.rank !== 0);
  const pool = jokerCards.length;
  const freeJokerCount = (used: Set<string>) => jokerCards.filter((j) => !used.has(j.id)).length;
  const candidates = [...runs(naturals, pool), ...sets(naturals.filter((c) => !isJoker(c, jokerRank)), pool)];
  const byId = new Map(hand.map((c) => [c.id, c]));
  const pts = (id: string) => cardPoints(byId.get(id)!, jokerRank);

  let best: { chosen: Candidate[]; points: number; valid: boolean } = { chosen: [], points: Infinity, valid: false };
  let nodes = 0;

  const score = (chosen: Candidate[]) => {
    const used = new Set(chosen.flatMap((c) => c.ids));
    const pure = chosen.filter((c) => c.kind === "pure").length;
    const seqs = chosen.filter((c) => c.kind !== "set").length;
    // Unused jokers score 0 and get attached to a group when the hand is built.
    const loose = hand.filter((c) => !used.has(c.id));
    const ok = pure >= 1 && seqs >= 2;
    const points = ok ? loose.reduce((a, c) => a + pts(c.id), 0) : hand.reduce((a, c) => a + pts(c.id), 0);
    return { points: Math.min(80, points), valid: ok && points === 0 };
  };

  const dfs = (start: number, chosen: Candidate[], used: Set<string>, allocated: number) => {
    if (++nodes > MAX_NODES) return;
    const s = score(chosen);
    // Prefer valid, then fewer points, then more cards melded.
    if (
      (s.valid && !best.valid) ||
      (s.valid === best.valid && s.points < best.points)
    ) {
      best = { chosen: [...chosen], ...s };
    }
    for (let i = start; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.ids.some((id) => used.has(id))) continue;
      c.ids.forEach((id) => used.add(id));
      // Jokers still free after this meld takes its natural cards must cover its gaps.
      if (freeJokerCount(used) - allocated - c.jokers < 0) {
        c.ids.forEach((id) => used.delete(id));
        continue;
      }
      chosen.push(c);
      dfs(i + 1, chosen, used, allocated + c.jokers);
      chosen.pop();
      c.ids.forEach((id) => used.delete(id));
    }
  };
  dfs(0, [], new Set(), 0);

  // Build concrete groups, handing out joker cards.
  const used = new Set(best.chosen.flatMap((c) => c.ids));
  const freeJokers = jokerCards.filter((c) => !used.has(c.id));
  const groups: PlayingCard[][] = best.chosen.map((c) => [
    ...c.ids.map((id) => byId.get(id)!),
    ...freeJokers.splice(0, c.jokers),
  ]);
  // Spare jokers join any non-pure group (or the first group) so nothing is left loose.
  for (const j of freeJokers.splice(0)) {
    const target = groups.find((g, i) => best.chosen[i] && best.chosen[i].kind !== "pure") ?? groups[0];
    if (target) target.push(j);
    else groups.push([j]);
  }
  const placed = new Set(groups.flat().map((c) => c.id));
  const loose = hand.filter((c) => !placed.has(c.id));
  if (loose.length) groups.push(loose);

  const check = checkHand(groups, jokerRank);
  return { groups, points: check.valid ? 0 : best.points, valid: check.valid };
}
