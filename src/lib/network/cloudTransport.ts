import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getDatabase, onChildAdded, onChildRemoved, onDisconnect, push, ref, remove, set, type Unsubscribe } from "firebase/database";
import { FIREBASE_CONFIG } from "@/config/firebase";
import { Emitter, type MessageHandler, type PeerId, type Transport } from "./types";
import { decodeWire, encodeWire } from "./wire";

type Envelope = { from: PeerId; channel: string; data: unknown };

function roomPath(roomCode: string) {
  return roomCode.replace(/[.#$[\]/]/g, "_");
}

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

const occupancy = new Map<string, number>();
let signingIn: Promise<string> | null = null;

/** One anonymous user per tab, even if React mounts the room twice. */
function ensureUser(): Promise<string> {
  if (!signingIn) {
    signingIn = (async () => {
      try {
        const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
        const auth = getAuth(app);
        if (!auth.currentUser) await signInAnonymously(auth);
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Could not sign in to the room service.");
        return uid;
      } catch (err) {
        signingIn = null;
        throw err;
      }
    })();
  }
  return signingIn;
}

/**
 * Room messages go through Firebase Realtime Database. A phone on a mobile
 * network can reach the host without a direct WebRTC connection.
 */
export class CloudTransport implements Transport {
  readonly selfId: PeerId;
  private events = new Emitter();
  private peers = new Set<PeerId>();
  private queued: Envelope[] = [];
  private stops: Unsubscribe[] = [];
  private left = false;

  private constructor(private roomCode: string, selfId: PeerId) {
    this.selfId = selfId;
  }

  static async open(roomCode: string): Promise<CloudTransport> {
    const selfId = await ensureUser();
    const transport = new CloudTransport(roomPath(roomCode), selfId);
    await transport.join();
    return transport;
  }

  private slot() {
    return `${this.roomCode}:${this.selfId}`;
  }

  private root(path: string) {
    return ref(getDatabase(getApps()[0]), `rooms/${this.roomCode}/${path}`);
  }

  private async join() {
    occupancy.set(this.slot(), (occupancy.get(this.slot()) ?? 0) + 1);
    const peers = this.root("peers");
    const mine = this.root(`peers/${this.selfId}`);
    this.stops.push(
      onChildAdded(peers, (snap) => {
        const id = snap.key;
        if (!id || id === this.selfId || this.peers.has(id)) return;
        this.peers.add(id);
        this.events.emit("peer:join", id);
      }),
      onChildRemoved(peers, (snap) => {
        const id = snap.key;
        if (!id || !this.peers.delete(id)) return;
        this.events.emit("peer:leave", id);
      }),
      onChildAdded(this.root(`inbox/${this.selfId}`), (snap) => {
        const msg = snap.val() as Envelope | null;
        void remove(snap.ref);
        if (!msg?.channel || msg.from === this.selfId) return;
        const delivered = { ...msg, data: decodeWire(msg.data) };
        const key = `msg:${delivered.channel}`;
        if (this.events.has(key)) this.events.emit(key, delivered.data, delivered.from);
        else this.queued.push(delivered);
      }),
    );
    await onDisconnect(mine).remove();
    await set(mine, { at: Date.now() });
  }

  send<T>(channel: string, data: T, target?: PeerId) {
    if (this.left) return;
    const payload = { from: this.selfId, channel, data: encodeWire(plain(data)) };
    const targets = target ? [target] : [...this.peers];
    for (const peer of targets) {
      if (peer === this.selfId) continue;
      void push(this.root(`inbox/${peer}`), payload).catch(() => undefined);
    }
  }

  on<T>(channel: string, handler: MessageHandler<T>) {
    const off = this.events.on(`msg:${channel}`, handler as never);
    const pending = this.queued.filter((msg) => msg.channel === channel);
    this.queued = this.queued.filter((msg) => msg.channel !== channel);
    for (const msg of pending) handler(msg.data as T, msg.from);
    return off;
  }

  onPeerJoin(handler: (peer: PeerId) => void) {
    const off = this.events.on("peer:join", handler as never);
    for (const peer of this.peers) handler(peer);
    return off;
  }

  onPeerLeave(handler: (peer: PeerId) => void) {
    return this.events.on("peer:leave", handler as never);
  }

  leave() {
    if (this.left) return;
    this.left = true;
    this.events.clear();
    this.stops.forEach((stop) => stop());
    this.stops = [];
    const next = (occupancy.get(this.slot()) ?? 1) - 1;
    if (next > 0) {
      occupancy.set(this.slot(), next);
      return;
    }
    occupancy.delete(this.slot());
    const mine = this.root(`peers/${this.selfId}`);
    void onDisconnect(mine).cancel();
    void remove(mine);
  }
}
