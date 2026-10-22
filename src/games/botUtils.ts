import type { BotLevel } from "./types";

/** Small helpers shared by the computer players. */

export const pickRandom = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Beginner sometimes plays the strong move, Intermediate usually, Pro always. */
export function plays(level: BotLevel): boolean {
  const chance = level === "pro" ? 1 : level === "intermediate" ? 0.8 : 0.35;
  return Math.random() < chance;
}

/** Highest-scoring item, ties broken randomly. */
export function bestBy<T>(items: readonly T[], score: (item: T) => number): T {
  let best: T[] = [];
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore + 1e-9) {
      best = [item];
      bestScore = s;
    } else if (Math.abs(s - bestScore) <= 1e-9) {
      best.push(item);
    }
  }
  return pickRandom(best);
}

/** Roughly how long a bot "thinks" before moving, so play feels natural. */
export function thinkTime(level: BotLevel): number {
  const base = level === "pro" ? 900 : level === "intermediate" ? 1100 : 1300;
  return base + Math.random() * 700;
}
