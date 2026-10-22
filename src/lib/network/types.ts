/**
 * Transport abstraction. The room layer only talks to this interface, so the
 * P2P implementation can be swapped for a WebSocket backend without UI changes.
 */

export type PeerId = string;

export type MessageHandler<T = unknown> = (data: T, from: PeerId) => void;

export interface Transport {
  /** This client's connection id (changes on every page load). */
  readonly selfId: PeerId;
  send<T>(channel: string, data: T, target?: PeerId): void;
  on<T>(channel: string, handler: MessageHandler<T>): () => void;
  onPeerJoin(handler: (peer: PeerId) => void): () => void;
  onPeerLeave(handler: (peer: PeerId) => void): () => void;
  leave(): void;
}

export type TransportFactory = (roomCode: string) => Transport;

/** Channels used by the room protocol. Kept short for the wire. */
export const CHANNELS = {
  HELLO: "hello",
  ROSTER: "roster",
  STATE: "state",
  ACTION: "act",
  REACTION: "react",
  KICK: "kick",
  PING: "ping",
  ERROR: "err",
} as const;

/** Tiny event emitter used by transport implementations. */
export class Emitter {
  private map = new Map<string, Set<(...args: never[]) => void>>();

  on<F extends (...args: never[]) => void>(key: string, fn: F): () => void {
    if (!this.map.has(key)) this.map.set(key, new Set());
    this.map.get(key)!.add(fn);
    return () => this.map.get(key)?.delete(fn);
  }

  emit(key: string, ...args: unknown[]) {
    this.map.get(key)?.forEach((fn) => (fn as (...a: unknown[]) => void)(...args));
  }

  clear() {
    this.map.clear();
  }
}
