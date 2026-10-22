import { getGameDefinition } from "@/games/registry";
import type { BotLevel } from "@/games/types";
import type { BotRequest, BotResponse } from "./bot.worker";

/**
 * Asks a computer player for its move. Uses a Web Worker when available and
 * falls back to the main thread (e.g. old browsers, tests).
 */
export class BotRunner {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (actions: unknown[]) => void>();

  constructor() {
    if (typeof window === "undefined" || typeof Worker === "undefined") return;
    try {
      this.worker = new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<BotResponse>) => {
        this.pending.get(e.data.id)?.(e.data.actions);
        this.pending.delete(e.data.id);
      };
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  think(gameId: string, view: unknown, me: string, level: BotLevel): Promise<unknown[]> {
    if (!this.worker) {
      const out = getGameDefinition(gameId)?.bot(view, me, level) ?? null;
      return Promise.resolve(out === null ? [] : Array.isArray(out) ? out : [out]);
    }
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage({ id, gameId, view, me, level } satisfies BotRequest);
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
