import { pickRandom, plays } from "../botUtils";
import type { GameBot } from "../types";
import { canPlay, COLORS, type OnnuAction, type OnnuCard, type OnnuColor, type OnnuState } from "./logic";

function favouriteColor(hand: OnnuCard[]): OnnuColor {
  const counts = new Map<OnnuColor, number>();
  for (const c of hand) if (c.color !== "wild") counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? pickRandom(COLORS);
}

/**
 * Beginner: random playable card, often forgets to call Onnu.
 * Intermediate: keeps wilds for later, always calls Onnu.
 * Pro: attacks players close to winning and catches missed calls.
 */
export const onnuBot: GameBot<OnnuState, OnnuAction> = (s, me, level) => {
  if (s.status !== "playing") return null;
  const hand = s.hands[me] as OnnuCard[];
  const meIdx = s.players.findIndex((p) => p.id === me);

  // Catch anyone sitting on one card without calling (not on our own turn logic).
  if (level !== "beginner") {
    const victim = s.players.find((p) => p.id !== me && s.counts[p.id] === 1 && !s.declared[p.id]);
    if (victim && (level === "pro" || Math.random() < 0.4)) return { type: "catch", target: victim.id };
  }

  if (meIdx !== s.turn) return null;
  const actions: OnnuAction[] = [];

  // Call Onnu before playing the second-last card.
  if (hand.length === 2 && !s.declared[me] && (level !== "beginner" || Math.random() < 0.5)) actions.push({ type: "onnu" });

  const top = s.discard[s.discard.length - 1];
  const pending = s.stacking ? s.pendingDraw : 0;
  if (s.pendingDraw > 0 && !s.stacking) return [...actions, { type: "draw" }];

  let playable = hand.filter((c) => canPlay(c, top, s.color, pending));
  if (s.drawnId) playable = playable.filter((c) => c.id === s.drawnId);

  if (!playable.length) return [...actions, { type: s.drawnId ? "pass" : "draw" }];

  let card: OnnuCard;
  if (!plays(level)) {
    card = pickRandom(playable);
  } else {
    const next = s.players[(meIdx + s.direction + s.players.length) % s.players.length];
    const danger = s.counts[next.id] <= 2;
    const score = (c: OnnuCard) => {
      let v = 0;
      if (c.color === "wild") v -= 6; // save wilds
      if (["draw2", "draw4", "skip"].includes(c.value)) v += danger ? 10 : level === "pro" ? -2 : 1;
      if (c.value === "reverse") v += danger ? 6 : 0;
      if (/^\d$/.test(c.value)) v += Number(c.value) / 3; // shed high numbers
      if (c.color !== "wild" && c.color === favouriteColor(hand)) v += 2;
      return v;
    };
    card = playable.reduce((a, b) => (score(b) > score(a) ? b : a));
  }
  const rest = hand.filter((c) => c.id !== card.id);
  actions.push({ type: "play", cardId: card.id, color: card.color === "wild" ? favouriteColor(rest) : undefined });
  return actions;
};
