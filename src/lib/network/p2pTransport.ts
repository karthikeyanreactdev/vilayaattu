import { joinRoom, selfId, type Room } from "trystero";
import { APP, NETWORK } from "@/config/constants";
import { Emitter, type MessageHandler, type PeerId, type Transport } from "./types";

/**
 * WebRTC peer-to-peer transport. Peers find each other through public Nostr
 * relays (signalling only); game traffic then flows directly between browsers.
 */
export class P2PTransport implements Transport {
  readonly selfId: PeerId = selfId;
  private room: Room;
  private events = new Emitter();
  private senders = new Map<string, (data: unknown, target?: PeerId) => void>();

  constructor(roomCode: string) {
    this.room = joinRoom(
      {
        appId: APP.P2P_APP_ID,
        password: roomCode,
        relayConfig: { redundancy: NETWORK.RELAY_REDUNDANCY, warnOnRelayFailure: false },
      },
      roomCode,
    );
    this.room.onPeerJoin = (peer) => this.events.emit("peer:join", peer);
    this.room.onPeerLeave = (peer) => this.events.emit("peer:leave", peer);
  }

  private channel(name: string) {
    let sender = this.senders.get(name);
    if (!sender) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const action = this.room.makeAction<any>(name);
      action.onMessage = (data, { peerId }) => this.events.emit(`msg:${name}`, data, peerId);
      sender = (data, target) => {
        void action.send(data, target ? { target } : undefined).catch(() => undefined);
      };
      this.senders.set(name, sender);
    }
    return sender;
  }

  send<T>(channel: string, data: T, target?: PeerId) {
    this.channel(channel)(data, target);
  }

  on<T>(channel: string, handler: MessageHandler<T>) {
    this.channel(channel);
    return this.events.on(`msg:${channel}`, handler as never);
  }

  onPeerJoin(handler: (peer: PeerId) => void) {
    return this.events.on("peer:join", handler as never);
  }

  onPeerLeave(handler: (peer: PeerId) => void) {
    return this.events.on("peer:leave", handler as never);
  }

  leave() {
    this.events.clear();
    void this.room.leave();
  }
}
