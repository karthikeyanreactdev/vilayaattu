import { NETWORK, ROOM, STORAGE_KEYS, type TransportKind } from "@/config/constants";
import { BOT_NAMES } from "@/config/bots";
import { thinkTime } from "@/games/botUtils";
import { getGameDefinition } from "@/games/registry";
import { BOT_LEVELS, isGameError, type BaseGameState, type BotLevel, type GameOptions, type PlayerRef } from "@/games/types";
import { createTransport, CHANNELS, type PeerId, type Transport } from "@/lib/network";
import { sessionStore } from "@/lib/storage";
import { uid } from "@/lib/random";
import type { AppDispatch } from "@/store";
import {
  reactionAdded,
  reactionExpired,
  rosterReceived,
  statusChanged,
  type RoomPlayer,
  type Roster,
} from "@/store/slices/roomSlice";
import { viewReceived } from "@/store/slices/gameSlice";
import { VoiceMesh } from "@/lib/voice/voiceMesh";
import { BotRunner } from "./botRunner";
import { RoomAdvertiser } from "./matchmaker";

export type Profile = { id: string; name: string; avatar: string };

/** How the host wants the room set up (saved when the room is created). */
export type HostConfig = {
  /** public = listed in quick play, solo = vs computer (offline transport). */
  mode?: "private" | "public" | "solo";
  gameId?: string;
  /** Table size chosen for quick play. */
  capacity?: number;
  bots?: BotLevel[];
  autostart?: boolean;
  /** Set once the config has been applied, so reloads don't re-apply it. */
  applied?: boolean;
};

type Hello = Profile;
type StatePacket = { gameId: string | null; view: unknown; seq: number; hostNow: number };
type ActionPacket = { playerId: string; action: unknown };
type ReactionPacket = { playerId: string; emoji: string };

type HostSnapshot = {
  config?: HostConfig;
  roster: Roster;
  game: BaseGameState | null;
  seq: number;
};

const SPECTATOR = "__spectator__";

/**
 * One live room. The host owns the authoritative game state and sends each
 * player a filtered view; guests only send intentions (actions).
 * The class has no React in it, so a backend can replace the host role later.
 */
export class RoomSession {
  private transport: Transport | null = null;
  private unsubs: (() => void)[] = [];
  private peerToPlayer = new Map<PeerId, string>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private lastHostSeen = Date.now();
  private disposed = false;

  // Host-only state
  private roster: Roster;
  private game: BaseGameState | null = null;
  private seq = 0;
  private config: HostConfig = {};
  private bots: BotRunner | null = null;
  private botBusy = new Set<string>();
  private botWait = new Map<string, { moveNo: number; at: number }>();
  private advertiser: RoomAdvertiser | null = null;
  private voiceMesh: VoiceMesh | null = null;
  private readonly createdAt = Date.now();

  constructor(
    readonly code: string,
    readonly isHost: boolean,
    private profile: Profile,
    private dispatch: AppDispatch,
    private onError: (msg: string) => void,
  ) {
    this.roster = {
      hostId: profile.id,
      players: [],
      gameId: null,
      options: {},
      phase: "lobby",
      gamePlayers: [],
      isPublic: false,
      capacity: ROOM.MAX_PLAYERS,
      videoAllowed: false,
    };
    if (isHost) this.config = sessionStore.get<HostSnapshot>(STORAGE_KEYS.HOST_SESSION(code))?.config ?? {};
  }

  async connect() {
    const kind: TransportKind | undefined = this.config.mode === "solo" ? "local" : undefined;
    const transport = await createTransport(this.code, kind);
    if (this.disposed) {
      transport.leave();
      return;
    }
    this.transport = transport;
    if (this.config.mode !== "solo") {
      this.voiceMesh = new VoiceMesh();
      this.voiceMesh.attach(transport);
      this.voiceMesh.setIdentity(this.profile.name, this.profile.avatar);
    }
    const t = transport;

    this.unsubs.push(
      t.onPeerJoin((peer) => {
        if (!this.isHost) t.send<Hello>(CHANNELS.HELLO, this.profile, peer);
        else this.sendRoster(peer);
      }),
      t.onPeerLeave((peer) => {
        if (this.isHost) this.markDisconnected(peer);
      }),
      t.on<ReactionPacket>(CHANNELS.REACTION, (r) => this.showReaction(r)),
    );

    if (this.isHost) this.startHost();
    else this.startGuest();
  }

  // ---------------------------------------------------------------- host side

  private startHost() {
    const t = this.transport!;
    const saved = sessionStore.get<HostSnapshot>(STORAGE_KEYS.HOST_SESSION(this.code));
    if (saved?.roster?.players?.length) {
      const players = saved.roster.players.map((p) => ({ ...p, connected: p.id === this.profile.id }));
      this.roster = {
        ...saved.roster,
        hostId: this.profile.id,
        // In the lobby nobody's seat needs keeping; mid-game, seats wait for reconnects.
        players: saved.roster.phase === "lobby" ? players.filter((p) => p.connected) : players,
        videoAllowed: saved.roster.videoAllowed ?? false,
      };
      this.game = saved.game;
      this.seq = saved.seq;
    }
    this.upsertPlayer(this.profile, t.selfId);
    this.bots = new BotRunner();
    this.roster.isPublic = this.config.mode === "public";
    if (this.config.capacity) this.roster.capacity = this.config.capacity;
    if (this.roster.isPublic) this.advertiser = new RoomAdvertiser();

    this.unsubs.push(
      t.on<Hello>(CHANNELS.HELLO, (hello, peer) => this.handleHello(hello, peer)),
      t.on<ActionPacket>(CHANNELS.ACTION, (packet, peer) => {
        const playerId = this.peerToPlayer.get(peer);
        if (playerId && playerId === packet.playerId) this.applyAction(playerId, packet.action, peer);
      }),
    );

    this.timers.push(
      setInterval(() => t.send(CHANNELS.PING, Date.now()), NETWORK.HEARTBEAT_MS),
      setInterval(() => this.runTick(), NETWORK.TICK_MS),
    );

    // First start: apply the setup chosen on the home screen.
    if (!this.config.applied) {
      this.config.applied = true;
      if (this.config.gameId) this.selectGame(this.config.gameId);
      for (const level of this.config.bots ?? []) this.addBot(level);
      if (this.config.autostart) {
        const err = this.startGame();
        if (err) this.onError(err);
      }
    }
    this.publish();
  }

  // ------------------------------------------------------------------- bots

  addBot(level: BotLevel): string | null {
    if (!this.isHost) return null;
    if (this.roster.players.length >= this.roster.capacity) return "All seats are taken.";
    const used = new Set(this.roster.players.map((p) => p.name));
    const base = BOT_NAMES.find((n) => !used.has(`${n} ${BOT_LEVELS.find((l) => l.value === level)!.emoji}`)) ?? "Chitti";
    const meta = BOT_LEVELS.find((l) => l.value === level)!;
    const taken = new Set(this.roster.players.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    const bot: RoomPlayer = { id: `bot-${uid(8)}`, name: `${base} ${meta.emoji}`, avatar: "🤖", seat, connected: true, bot: level };
    this.roster.players = [...this.roster.players, bot].sort((a, b) => a.seat - b.seat);
    this.publish();
    this.maybeAutoStart();
    return null;
  }

  /** Let computer players take their turns after a natural "thinking" pause. */
  private runBots(now: number) {
    const game = this.game;
    const gameId = this.roster.gameId;
    if (!game || !gameId || game.status !== "playing" || !this.bots) return;
    const def = getGameDefinition(gameId);
    if (!def) return;
    for (const seat of this.roster.gamePlayers) {
      const level = this.roster.players.find((p) => p.id === seat.id)?.bot;
      if (!level || this.botBusy.has(seat.id)) continue;
      const wait = this.botWait.get(seat.id);
      if (!wait || wait.moveNo !== game.moveNo) {
        // On the first move, let the shuffle/deal animation finish first.
        // Live games (a ball in the air) time the move themselves, so ask at once.
        const intro = !def.live && game.moveNo === 0 ? 2600 : 0;
        const think = def.live ? 40 : thinkTime(level);
        this.botWait.set(seat.id, { moveNo: game.moveNo, at: now + intro + think });
        continue;
      }
      if (now < wait.at) continue;
      const moveNo = game.moveNo;
      this.botBusy.add(seat.id);
      void this.bots.think(gameId, def.view(game, seat.id), seat.id, level).then((actions) => {
        this.botBusy.delete(seat.id);
        if (this.disposed || !this.game || this.game.moveNo !== moveNo || this.roster.gameId !== gameId) return;
        if (actions.length === 0) {
          // Nothing to do yet (e.g. waiting for a human); check again shortly.
          this.botWait.set(seat.id, { moveNo, at: Date.now() + 700 });
          return;
        }
        for (const a of actions) this.applyAction(seat.id, a);
      });
    }
  }

  private handleHello(hello: Hello, peer: PeerId) {
    if (!hello?.id || !hello.name) return;
    const known = this.roster.players.some((p) => p.id === hello.id);
    if (!known && this.roster.players.length >= this.roster.capacity) {
      this.transport!.send(CHANNELS.KICK, `This table is full (${this.roster.capacity} players).`, peer);
      return;
    }
    this.upsertPlayer(hello, peer);
    this.publish();
    this.maybeAutoStart();
  }

  private upsertPlayer(profile: Profile, peer: PeerId) {
    for (const [p, id] of this.peerToPlayer) if (id === profile.id) this.peerToPlayer.delete(p);
    this.peerToPlayer.set(peer, profile.id);
    const existing = this.roster.players.find((p) => p.id === profile.id);
    if (existing) {
      existing.connected = true;
      existing.name = profile.name;
      existing.avatar = profile.avatar;
      this.roster.players = [...this.roster.players];
      return;
    }
    const taken = new Set(this.roster.players.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    const player: RoomPlayer = { ...profile, seat, connected: true };
    this.roster.players = [...this.roster.players, player].sort((a, b) => a.seat - b.seat);
  }

  private markDisconnected(peer: PeerId) {
    const id = this.peerToPlayer.get(peer);
    if (!id) return;
    this.peerToPlayer.delete(peer);
    const inGame = this.roster.gamePlayers.some((p) => p.id === id);
    if (this.roster.phase === "lobby" || !inGame) {
      this.roster.players = this.roster.players.filter((p) => p.id !== id);
    } else {
      this.roster.players = this.roster.players.map((p) => (p.id === id ? { ...p, connected: false } : p));
    }
    this.publish();
  }

  private applyAction(playerId: string, action: unknown, peer?: PeerId) {
    if (!this.game || !this.roster.gameId) return;
    if (!this.roster.gamePlayers.some((p) => p.id === playerId)) return;
    const def = getGameDefinition(this.roster.gameId);
    if (!def) return;
    const next = def.reduce(this.game, action, playerId, { now: Date.now() });
    if (isGameError(next)) {
      if (playerId === this.profile.id) this.onError(next.error);
      else if (peer) this.transport?.send(CHANNELS.ERROR, next.error, peer);
      return;
    }
    this.game = next;
    this.publish();
  }

  private runTick() {
    this.runBots(Date.now());
    if (!this.game || !this.roster.gameId || this.game.status !== "playing") return;
    const def = getGameDefinition(this.roster.gameId);
    const next = def?.tick?.(this.game, { now: Date.now() });
    if (next) {
      this.game = next;
      this.publish();
    }
  }

  /** Push roster + per-player views to everyone and persist for host reloads. */
  private publish() {
    this.seq += 1;
    const t = this.transport;
    this.dispatch(rosterReceived(structuredClone(this.roster)));
    this.dispatch(viewReceived(this.packetFor(this.profile.id)));
    if (t) {
      t.send(CHANNELS.ROSTER, this.roster);
      for (const [peer, playerId] of this.peerToPlayer) {
        if (peer !== t.selfId) t.send(CHANNELS.STATE, this.packetFor(playerId), peer);
      }
    }
    this.advertise();
    sessionStore.set(STORAGE_KEYS.HOST_SESSION(this.code), {
      config: this.config,
      roster: this.roster,
      game: this.game,
      seq: this.seq,
    } satisfies HostSnapshot);
  }

  /** Public rooms announce free seats in quick play while in the lobby. */
  private advertise() {
    if (!this.advertiser) return;
    const def = this.roster.gameId ? getGameDefinition(this.roster.gameId) : undefined;
    const seated = this.roster.players.filter((p) => p.connected).length;
    const open = def && this.roster.phase === "lobby" && seated < this.roster.capacity;
    void this.advertiser.update(
      open
        ? { code: this.code, gameId: def.meta.id, players: seated, max: this.roster.capacity, hostName: this.profile.name, createdAt: this.createdAt }
        : null,
    );
  }

  private sendRoster(peer: PeerId) {
    this.transport?.send(CHANNELS.ROSTER, this.roster, peer);
  }

  private packetFor(playerId: string): StatePacket {
    const def = this.roster.gameId ? getGameDefinition(this.roster.gameId) : null;
    const seated = this.roster.gamePlayers.some((p) => p.id === playerId);
    const view = this.game && def ? def.view(this.game, seated ? playerId : SPECTATOR) : null;
    return { gameId: this.roster.gameId, view, seq: this.seq, hostNow: Date.now() };
  }

  // Host commands (called from the lobby / result UI)

  selectGame(gameId: string) {
    const def = getGameDefinition(gameId);
    if (!this.isHost || !def || this.roster.phase !== "lobby") return;
    // Private rooms size themselves to the game; quick-play tables keep the size players chose.
    const capacity = this.config.capacity ?? Math.max(def.meta.maxPlayers, this.roster.players.length);
    this.roster = { ...this.roster, gameId, capacity, options: { ...def.defaultOptions } };
    this.publish();
  }

  /** Host changes how many seats the table has. */
  setCapacity(capacity: number) {
    const def = this.roster.gameId ? getGameDefinition(this.roster.gameId) : undefined;
    if (!this.isHost || this.roster.phase !== "lobby") return;
    const min = Math.max(def?.meta.minPlayers ?? 2, this.roster.players.length);
    const max = def?.meta.maxPlayers ?? ROOM.MAX_PLAYERS;
    this.roster = { ...this.roster, capacity: Math.min(max, Math.max(min, capacity)) };
    this.config.capacity = this.roster.capacity;
    this.publish();
  }

  /** Quick-play tables start by themselves once every seat is filled. */
  private maybeAutoStart() {
    if (!this.roster.isPublic || this.roster.phase !== "lobby" || !this.roster.gameId) return;
    const full = () => this.roster.players.filter((p) => p.connected).length >= this.roster.capacity;
    if (!full()) return;
    setTimeout(() => {
      if (!this.disposed && this.roster.phase === "lobby" && full()) this.startGame();
    }, 2500);
  }

  setVideoAllowed(on: boolean) {
    if (!this.isHost) return;
    this.roster = { ...this.roster, videoAllowed: on };
    this.publish();
  }

  setOption(key: string, value: string | number | boolean) {
    if (!this.isHost || this.roster.phase !== "lobby") return;
    this.roster = { ...this.roster, options: { ...this.roster.options, [key]: value } };
    this.publish();
  }

  startGame(): string | null {
    if (!this.isHost || !this.roster.gameId) return "Pick a game first.";
    const def = getGameDefinition(this.roster.gameId)!;
    const seated: PlayerRef[] = this.roster.players
      .filter((p) => p.connected)
      .slice(0, Math.min(def.meta.maxPlayers, this.roster.capacity))
      .map(({ id, name, avatar }, seat) => ({ id, name, avatar, seat }));
    if (seated.length < def.meta.minPlayers) {
      return `${def.meta.name} needs at least ${def.meta.minPlayers} players.`;
    }
    this.game = def.setup(seated, this.roster.options as GameOptions, { now: Date.now() });
    this.roster = { ...this.roster, phase: "playing", gamePlayers: seated };
    this.publish();
    return null;
  }

  backToLobby() {
    if (!this.isHost) return;
    this.game = null;
    this.roster = {
      ...this.roster,
      phase: "lobby",
      gamePlayers: [],
      players: this.roster.players.filter((p) => p.connected),
    };
    this.publish();
  }

  kick(playerId: string) {
    if (!this.isHost || playerId === this.profile.id) return;
    for (const [peer, id] of this.peerToPlayer) {
      if (id === playerId) {
        this.transport?.send(CHANNELS.KICK, "The host removed you from the room.", peer);
        this.peerToPlayer.delete(peer);
      }
    }
    this.roster.players = this.roster.players.filter((p) => p.id !== playerId);
    this.publish();
  }

  // --------------------------------------------------------------- guest side

  private startGuest() {
    const t = this.transport!;
    const hello = () => t.send<Hello>(CHANNELS.HELLO, this.profile);
    hello();
    this.lastHostSeen = Date.now();
    let gotRoster = false;

    this.unsubs.push(
      t.on<Roster>(CHANNELS.ROSTER, (roster) => {
        gotRoster = true;
        this.lastHostSeen = Date.now();
        if (!roster.players.some((p) => p.id === this.profile.id)) hello();
        this.dispatch(rosterReceived(roster));
      }),
      t.on<StatePacket>(CHANNELS.STATE, (packet) => {
        this.lastHostSeen = Date.now();
        this.dispatch(viewReceived(packet));
      }),
      t.on<number>(CHANNELS.PING, () => {
        this.lastHostSeen = Date.now();
      }),
      t.on<string>(CHANNELS.ERROR, (msg) => this.onError(msg)),
      t.on<string>(CHANNELS.KICK, (reason) => {
        this.dispatch(statusChanged({ status: "kicked", message: reason }));
        this.dispose();
      }),
    );

    let waitingSince = Date.now();
    let everConnected = false;
    this.timers.push(
      setInterval(() => {
        const now = Date.now();
        if (!gotRoster) {
          hello();
          if (!everConnected && now - waitingSince > NETWORK.HOST_WAIT_MS) {
            this.dispatch(statusChanged({ status: "not-found" }));
          }
          return;
        }
        everConnected = true;
        if (now - this.lastHostSeen > NETWORK.HOST_TIMEOUT_MS) {
          this.dispatch(statusChanged({ status: "host-lost" }));
          gotRoster = false;
          waitingSince = now;
        }
      }, 2000),
    );
  }

  // ------------------------------------------------------------------- shared

  sendAction(action: unknown) {
    if (this.isHost) this.applyAction(this.profile.id, action);
    else this.transport?.send<ActionPacket>(CHANNELS.ACTION, { playerId: this.profile.id, action });
  }

  sendReaction(emoji: string) {
    const packet = { playerId: this.profile.id, emoji };
    this.transport?.send(CHANNELS.REACTION, packet);
    this.showReaction(packet);
  }

  private showReaction(r: ReactionPacket) {
    const id = uid(6);
    this.dispatch(reactionAdded({ id, ...r }));
    setTimeout(() => this.dispatch(reactionExpired(id)), 2600);
  }

  updateProfile(profile: Profile) {
    this.profile = profile;
    if (this.isHost) {
      this.upsertPlayer(profile, this.transport?.selfId ?? "self");
      this.publish();
    } else {
      this.transport?.send<Hello>(CHANNELS.HELLO, profile);
    }
    this.voiceMesh?.setIdentity(profile.name, profile.avatar);
  }

  /** Microphone call with the other phones. Absent when playing the computer. */
  get voice() {
    return this.voiceMesh;
  }

  get active() {
    return !this.disposed;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.timers.forEach(clearInterval);
    this.unsubs.forEach((u) => u());
    this.bots?.dispose();
    this.advertiser?.dispose();
    this.voiceMesh?.stop();
    this.voiceMesh = null;
    this.transport?.leave();
    this.transport = null;
  }
}
