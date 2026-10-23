import { pickRandom } from "../botUtils";
import type { GameBot } from "../types";
import { currentInnings } from "../cricket/engine";
import type { HandCricketAction, HandCricketState } from "./logic";

const NUMBERS = [1, 2, 3, 4, 5, 6];

/** Weighted pick: higher weight = more likely. */
function weighted(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return NUMBERS[i];
  }
  return 6;
}

/**
 * Beginner: random fingers.
 * Intermediate: bats with bigger numbers, bowls at the batter's favourites.
 * Pro: learns the opponent's habits from every ball seen this match.
 */
export const handCricketBot: GameBot<HandCricketState, HandCricketAction> = (s, me, level) => {
  if (s.status !== "playing") return null;
  if (s.phase === "toss-call") return s.toss.caller === me ? { type: "call", call: pickRandom(["heads", "tails"] as const) } : null;
  if (s.phase === "choose") return s.toss.winner === me ? { type: "choose", choice: level === "beginner" ? pickRandom(["bat", "bowl"] as const) : "bowl" } : null;
  if (!s.cricket || s.picks[me] !== null) return null;

  const inn = currentInnings(s.cricket);
  const batting = inn.batter === me;
  if (level === "beginner") return { type: "pick", n: pickRandom(NUMBERS) };

  // No balls yet, so there is no pattern to copy. A weighted pick here always
  // leans on 6, which made the computer open with the same hand most games.
  if (!s.lastBall) return { type: "pick", n: pickRandom(NUMBERS) };

  const ownLast = s.lastBall.batter === me ? s.lastBall.bat : s.lastBall.bowl;

  // Numbers the opponent has shown so far (their batting runs reveal their picks).
  const seen = Array(6).fill(1);
  for (const innings of s.cricket.innings) {
    if (innings.batter === me) continue;
    for (const ball of innings.log) if (!ball.out && ball.runs >= 1) seen[ball.runs - 1] += level === "pro" ? 2 : 1;
  }
  if (s.lastBall) {
    const theirs = s.lastBall.batter === me ? s.lastBall.bowl : s.lastBall.bat;
    seen[theirs - 1] += level === "pro" ? 3 : 1;
  }

  if (batting) {
    // Prefer big numbers, but avoid what the bowler is likely to throw.
    const chasing = s.cricket.target !== null ? s.cricket.target - inn.runs : null;
    const weights = NUMBERS.map((n, i) => {
      let w = 1 + n * (level === "pro" ? 0.25 : 0.15);
      w /= seen[i];
      if (n === ownLast) w *= 0.25;
      if (chasing !== null && n >= chasing) w *= 2.5; // a single hit wins the match
      return w;
    });
    return { type: "pick", n: weighted(weights) };
  }
  // Bowling: aim at the batter's favourites.
  const weights = seen.map((c, i) => {
    const w = Math.pow(c, level === "pro" ? 1.6 : 1.1);
    return NUMBERS[i] === ownLast ? w * 0.25 : w;
  });
  return { type: "pick", n: weighted(weights) };
};
