/// <reference lib="webworker" />
import { getGameDefinition } from "@/games/registry";
import type { BotLevel } from "@/games/types";

/** Runs computer players off the main thread so animations never stutter. */

export type BotRequest = { id: number; gameId: string; view: unknown; me: string; level: BotLevel };
export type BotResponse = { id: number; actions: unknown[]; error?: string };

self.onmessage = (e: MessageEvent<BotRequest>) => {
  const { id, gameId, view, me, level } = e.data;
  try {
    const out = getGameDefinition(gameId)?.bot(view, me, level) ?? null;
    const actions = out === null ? [] : Array.isArray(out) ? out : [out];
    (self as unknown as Worker).postMessage({ id, actions } satisfies BotResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, actions: [], error: String(err) } satisfies BotResponse);
  }
};
