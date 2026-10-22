import { NETWORK } from "@/config/constants";
import { createTransport, type Transport } from "@/lib/network";

/**
 * Quick play without a backend. Every game has a public "matchmaking" channel.
 * Hosts of public rooms announce themselves there; a player who taps a game
 * listens briefly and joins the best open room, or creates a new one.
 * A backend can replace this with a single "find room" API call.
 */

export type RoomAdvert = {
  code: string;
  gameId: string;
  players: number;
  max: number;
  hostName: string;
  createdAt: number;
};

const CH_OPEN = "open";
const CH_SEEK = "seek";

const channelFor = (gameId: string) => `mm-${gameId}`;

/** Look for an open room for `gameId`. Resolves with its code, or null if none answered. */
export async function seekRoom(gameId: string, capacity: number, signal?: AbortSignal): Promise<string | null> {
  const t = await createTransport(channelFor(gameId));
  return new Promise((resolve) => {
    const offers = new Map<string, RoomAdvert>();
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(maxTimer);
      if (settleTimer) clearTimeout(settleTimer);
      t.leave();
      // Prefer the fullest room (games start sooner), then the oldest.
      const best = [...offers.values()].sort((a, b) => b.players - a.players || a.createdAt - b.createdAt)[0];
      resolve(best?.code ?? null);
    };

    t.on<RoomAdvert>(CH_OPEN, (ad) => {
      // Only tables of the size the player asked for, with a free seat.
      if (ad?.gameId !== gameId || ad.max !== capacity || ad.players >= ad.max) return;
      offers.set(ad.code, ad);
      // Give other hosts a moment to answer too, then pick.
      settleTimer ??= setTimeout(finish, NETWORK.MATCH_SETTLE_MS);
    });
    t.onPeerJoin((peer) => t.send(CH_SEEK, { gameId }, peer));
    t.send(CH_SEEK, { gameId });

    const maxTimer = setTimeout(finish, NETWORK.MATCH_WAIT_MS);
    signal?.addEventListener("abort", () => {
      offers.clear();
      finish();
    });
  });
}

/** Announces a public room on its game's matchmaking channel while it has free seats. */
export class RoomAdvertiser {
  private transport: Transport | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private advert: RoomAdvert | null = null;
  private gameId: string | null = null;
  private disposed = false;

  /** Pass null to stop advertising (room full, game running, or room private). */
  async update(advert: RoomAdvert | null) {
    this.advert = advert;
    if (!advert) return this.stop();
    if (this.gameId !== advert.gameId) {
      this.stop();
      this.gameId = advert.gameId;
      const t = await createTransport(channelFor(advert.gameId));
      if (this.disposed || this.gameId !== advert.gameId) {
        t.leave();
        return;
      }
      this.transport = t;
      t.on(CH_SEEK, (_data, peer) => this.advert && t.send(CH_OPEN, this.advert, peer));
      t.onPeerJoin((peer) => this.advert && t.send(CH_OPEN, this.advert, peer));
      this.timer = setInterval(() => this.advert && t.send(CH_OPEN, this.advert), NETWORK.ADVERT_MS);
    }
    this.transport?.send(CH_OPEN, advert);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.transport?.leave();
    this.transport = null;
    this.gameId = null;
  }

  dispose() {
    this.disposed = true;
    this.advert = null;
    this.stop();
  }
}
