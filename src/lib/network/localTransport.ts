import { uid } from "@/lib/random";
import { Emitter, type MessageHandler, type PeerId, type Transport } from "./types";

type Envelope =
  | { kind: "announce"; from: PeerId; reply: boolean }
  | { kind: "bye"; from: PeerId }
  | { kind: "msg"; from: PeerId; to?: PeerId; channel: string; data: unknown };

/**
 * Same-browser transport over BroadcastChannel. Lets you open several tabs and
 * play against yourself while developing, with no network at all.
 */
export class LocalTransport implements Transport {
  readonly selfId: PeerId = uid(12);
  private bc: BroadcastChannel;
  private peers = new Set<PeerId>();
  private events = new Emitter();
  private onUnload = () => this.post({ kind: "bye", from: this.selfId });

  constructor(roomCode: string) {
    this.bc = new BroadcastChannel(`vt-room-${roomCode}`);
    this.bc.onmessage = (e: MessageEvent<Envelope>) => this.receive(e.data);
    window.addEventListener("pagehide", this.onUnload);
    // Defer so callers can subscribe to peer events first.
    setTimeout(() => this.post({ kind: "announce", from: this.selfId, reply: true }), 50);
  }

  private post(env: Envelope) {
    try {
      this.bc.postMessage(env);
    } catch {
      /* channel closed */
    }
  }

  private addPeer(peer: PeerId) {
    if (this.peers.has(peer)) return;
    this.peers.add(peer);
    this.events.emit("peer:join", peer);
  }

  private receive(env: Envelope) {
    if (env.from === this.selfId) return;
    if (env.kind === "announce") {
      this.addPeer(env.from);
      if (env.reply) this.post({ kind: "announce", from: this.selfId, reply: false });
    } else if (env.kind === "bye") {
      if (this.peers.delete(env.from)) this.events.emit("peer:leave", env.from);
    } else if (!env.to || env.to === this.selfId) {
      this.addPeer(env.from);
      this.events.emit(`msg:${env.channel}`, env.data, env.from);
    }
  }

  send<T>(channel: string, data: T, target?: PeerId) {
    this.post({ kind: "msg", from: this.selfId, to: target, channel, data });
  }

  on<T>(channel: string, handler: MessageHandler<T>) {
    return this.events.on(`msg:${channel}`, handler as never);
  }

  onPeerJoin(handler: (peer: PeerId) => void) {
    return this.events.on("peer:join", handler as never);
  }

  onPeerLeave(handler: (peer: PeerId) => void) {
    return this.events.on("peer:leave", handler as never);
  }

  leave() {
    this.onUnload();
    window.removeEventListener("pagehide", this.onUnload);
    this.events.clear();
    this.bc.close();
  }
}
