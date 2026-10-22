import { bestBy, pickRandom } from "../botUtils";
import type { GameBot } from "../types";
import { DONE, landOn, legalTokens, trackIndex, YARD_POS, type LudoAction, type LudoState } from "./logic";
import { SAFE } from "./geometry";

function captureCount(state: LudoState, seat: number, to: number): number {
  const index = trackIndex(state.colours[seat], to);
  if (index === null || SAFE.has(index)) return 0;
  let n = 0;
  state.steps.forEach((tokens, other) => {
    if (other === seat) return;
    for (const pos of tokens) if (trackIndex(state.colours[other], pos) === index) n++;
  });
  return n;
}

/**
 * Beginner grabs any legal token.
 * Stronger players take a capture or a finish, then push the leader, and open when it helps.
 */
export const ludoBot: GameBot<LudoState, LudoAction> = (s, me, level) => {
  if (s.status !== "playing") return null;
  const seat = s.players.findIndex((p) => p.id === me);
  if (seat !== s.turn) return null;
  if (s.phase === "roll") return { type: "roll" };
  if (s.dice === null) return null;
  const tokens = legalTokens(s, s.dice);
  if (tokens.length === 0) return null;
  if (level === "beginner") return { type: "move", token: pickRandom(tokens) };

  const token = bestBy(tokens, (t) => {
    const from = s.steps[seat][t];
    const to = landOn(from, s.dice!)!;
    let score = to;
    if (to === DONE) score += 80;
    else if (to > 50) score += 25;
    score += captureCount(s, seat, to) * (level === "pro" ? 70 : 45);
    if (from === YARD_POS) score += level === "pro" ? 18 : 35;
    const out = s.steps[seat].filter((p) => p !== YARD_POS && p !== DONE).length;
    if (from === YARD_POS && out === 0) score += 30;
    return score;
  });
  return { type: "move", token };
};
