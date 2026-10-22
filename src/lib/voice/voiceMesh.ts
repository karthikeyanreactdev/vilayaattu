import { CHANNELS, type PeerId, type Transport } from "@/lib/network/types";

/** Public STUN plus Metered's published open relay, so phones on mobile data can still connect. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "turn:standard.relay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:standard.relay.metered.ca:80?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:standard.relay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turns:standard.relay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

export type VoiceMic = "off" | "on" | "busy" | "denied";
export type VoiceLink = "connecting" | "live" | "failed";

export type RemoteCall = {
  name: string;
  avatar: string;
  camera: boolean;
  hearing: boolean;
  stream: MediaStream;
};

export type VoiceSnapshot = {
  mic: VoiceMic;
  speaker: boolean;
  camera: VoiceMic;
  peers: Record<string, VoiceLink>;
  /** idle: nobody else yet. connecting / live / failed describe the calls. */
  phase: "idle" | "connecting" | "live" | "failed";
  remotes: Record<string, RemoteCall>;
  /** How many other people we are actually receiving audio from. */
  hearing: number;
  /** How many other people have their camera on. */
  seeing: number;
  localPreview: MediaStream | null;
};

type Signal =
  | { kind: "sdp"; type: "offer" | "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit }
  | { kind: "hi"; name: string; avatar: string }
  | { kind: "cam"; on: boolean }
  | { kind: "need" };

type Link = {
  pc: RTCPeerConnection;
  /** Lower id is the only side that creates offers, so the two browsers cannot talk over each other. */
  caller: boolean;
  restarted: boolean;
  audio: HTMLAudioElement;
  incoming: MediaStream;
  ice: RTCIceCandidateInit[];
  audioSender: RTCRtpSender;
  videoSender: RTCRtpSender;
  chain: Promise<void>;
};

const INITIAL: VoiceSnapshot = {
  mic: "off",
  speaker: true,
  camera: "off",
  peers: {},
  phase: "idle",
  remotes: {},
  hearing: 0,
  seeing: 0,
  localPreview: null,
};

/**
 * One call per other phone. Both sides negotiate a mic and a camera slot up
 * front, then swap in the real devices with replaceTrack. That way a guest
 * who turns the mic on later is heard, without a second offer the host can drop.
 */
export class VoiceMesh {
  private transport: Transport | null = null;
  private offs: (() => void)[] = [];
  private links = new Map<PeerId, Link>();
  private peerState: Record<string, VoiceLink> = {};
  private remotes: Record<string, RemoteCall> = {};
  private localStream: MediaStream | null = null;
  private localTrack: MediaStreamTrack | null = null;
  private videoStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private localPreview: MediaStream | null = null;
  private mic: VoiceMic = "off";
  private camera: VoiceMic = "off";
  private speaker = true;
  private stopped = false;
  private micLock: Promise<void> | null = null;
  private camLock: Promise<void> | null = null;
  private snap: VoiceSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private name = "Friend";
  private avatar = "👤";
  private audioCtx: AudioContext | null = null;
  private silence: MediaStreamTrack | null = null;
  private black: MediaStreamTrack | null = null;

  snapshot() {
    return this.snap;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  attach(transport: Transport) {
    this.transport = transport;
    this.offs.push(
      transport.onPeerJoin((peer) => this.ensure(peer)),
      transport.onPeerLeave((peer) => this.drop(peer)),
      transport.on<Signal>(CHANNELS.VOICE, (msg, from) => {
        void this.onSignal(from, msg);
      }),
    );
  }

  setIdentity(name: string, avatar: string) {
    this.name = name;
    this.avatar = avatar;
    for (const peer of this.links.keys()) this.send(peer, { kind: "hi", name, avatar });
  }

  stop() {
    this.stopped = true;
    this.offs.forEach((off) => off());
    this.offs = [];
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.videoStream?.getTracks().forEach((track) => track.stop());
    this.silence?.stop();
    this.black?.stop();
    void this.audioCtx?.close().catch(() => undefined);
    this.localStream = null;
    this.localTrack = null;
    this.videoStream = null;
    this.videoTrack = null;
    this.localPreview = null;
    this.silence = null;
    this.black = null;
    for (const peer of [...this.links.keys()]) this.drop(peer);
    this.transport = null;
  }

  toggleMic() {
    if (this.micLock) return this.micLock;
    this.micLock = this.flipMic().finally(() => {
      this.micLock = null;
    });
    return this.micLock;
  }

  toggleCamera() {
    if (this.camLock) return this.camLock;
    this.camLock = this.flipCamera().finally(() => {
      this.camLock = null;
    });
    return this.camLock;
  }

  /** Host turned video off. Drop the camera, keep the empty video slot. */
  stopCamera() {
    if (this.camera === "off" && !this.videoTrack) return Promise.resolve();
    return this.releaseCamera();
  }

  toggleSpeaker() {
    this.speaker = !this.speaker;
    for (const link of this.links.values()) {
      link.audio.muted = !this.speaker;
      if (this.speaker) void link.audio.play().catch(() => undefined);
    }
    this.publish();
  }

  retry() {
    const peers = [...this.links.keys()];
    for (const peer of peers) this.drop(peer);
    for (const peer of peers) this.ensure(peer);
  }

  private async flipMic() {
    void this.audioCtx?.resume().catch(() => undefined);
    if (this.mic === "on" && this.localTrack) {
      this.localTrack.enabled = false;
      this.mic = "off";
      this.publish();
      return;
    }
    if (this.localTrack) {
      this.localTrack.enabled = true;
      this.mic = "on";
      await this.applyAudio();
      this.unlock();
      this.publish();
      return;
    }
    this.mic = "busy";
    this.publish();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (this.stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.localStream = stream;
      this.localTrack = stream.getAudioTracks()[0] ?? null;
      if (!this.localTrack) throw new Error("no microphone");
      await this.applyAudio();
      this.mic = "on";
      this.unlock();
    } catch (err) {
      const blocked = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      this.mic = blocked ? "denied" : "off";
    }
    this.publish();
  }

  private async flipCamera() {
    if (this.camera === "on") {
      await this.releaseCamera();
      return;
    }
    this.camera = "busy";
    this.publish();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (this.stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.videoStream = stream;
      this.videoTrack = stream.getVideoTracks()[0] ?? null;
      if (!this.videoTrack) throw new Error("no camera");
      this.localPreview = stream;
      await this.applyVideo(this.videoTrack, false);
      this.camera = "on";
      for (const peer of this.links.keys()) this.send(peer, { kind: "cam", on: true });
    } catch (err) {
      const blocked = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      this.camera = blocked ? "denied" : "off";
      this.localPreview = null;
    }
    this.publish();
  }

  private async releaseCamera() {
    this.videoStream?.getTracks().forEach((track) => track.stop());
    this.videoStream = null;
    this.videoTrack = null;
    this.localPreview = null;
    this.camera = "off";
    await this.applyVideo(this.blackTrack(), true);
    for (const peer of this.links.keys()) this.send(peer, { kind: "cam", on: false });
    this.publish();
  }

  private async applyAudio() {
    if (!this.localTrack) return;
    await Promise.all([...this.links.values()].map((link) => link.audioSender.replaceTrack(this.localTrack)));
  }

  private async applyVideo(track: MediaStreamTrack, quiet: boolean) {
    await Promise.all(
      [...this.links.values()].map(async (link) => {
        await link.videoSender.replaceTrack(track);
        const params = link.videoSender.getParameters();
        if (!params.encodings.length) params.encodings = [{}];
        params.encodings[0].maxBitrate = quiet ? 8_000 : 350_000;
        await link.videoSender.setParameters(params).catch(() => undefined);
      }),
    );
  }

  private silenceTrack() {
    if (this.silence) return this.silence;
    const Ctx = window.AudioContext;
    this.audioCtx = new Ctx();
    const dest = this.audioCtx.createMediaStreamDestination();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    this.silence = dest.stream.getAudioTracks()[0];
    return this.silence;
  }

  private blackTrack() {
    if (this.black) return this.black;
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, 16, 16);
    }
    this.black = canvas.captureStream(1).getVideoTracks()[0];
    return this.black;
  }

  private unlock() {
    for (const link of this.links.values()) void link.audio.play().catch(() => undefined);
  }

  private ensure(peer: PeerId) {
    if (this.stopped || this.links.has(peer) || !this.transport || peer === this.transport.selfId) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = !this.speaker;
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);
    const incoming = new MediaStream();
    const audioSender = pc.addTrack(this.localTrack ?? this.silenceTrack());
    const videoSender = pc.addTrack(this.videoTrack ?? this.blackTrack());
    const link: Link = {
      pc,
      caller: this.transport.selfId < peer,
      restarted: false,
      audio,
      incoming,
      ice: [],
      audioSender,
      videoSender,
      chain: Promise.resolve(),
    };
    this.links.set(peer, link);
    this.peerState[peer] = "connecting";
    this.remotes[peer] = { name: "Friend", avatar: "👤", camera: false, hearing: false, stream: incoming };

    pc.onicecandidate = (event) => {
      if (event.candidate) this.send(peer, { kind: "ice", candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      if (!incoming.getTracks().includes(event.track)) incoming.addTrack(event.track);
      if (event.track.kind === "audio") {
        audio.srcObject = incoming;
        audio.muted = !this.speaker;
        void audio.play().catch(() => undefined);
        const mark = () => this.setHearing(peer, !event.track.muted && event.track.readyState === "live");
        event.track.onunmute = mark;
        event.track.onmute = () => this.setHearing(peer, false);
        mark();
      }
      this.publish();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") this.mark(peer, "live");
      else if (pc.connectionState === "failed") this.mark(peer, "failed");
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" && !link.restarted) {
        link.restarted = true;
        pc.restartIce();
      }
    };
    pc.onnegotiationneeded = () => {
      if (!link.caller) {
        this.send(peer, { kind: "need" });
        return;
      }
      void this.offer(link, peer);
    };

    this.send(peer, { kind: "hi", name: this.name, avatar: this.avatar });
    if (this.camera === "on") this.send(peer, { kind: "cam", on: true });
    this.publish();
  }

  private enqueue(link: Link, task: () => Promise<void>) {
    link.chain = link.chain.then(task, task).catch(() => undefined);
    return link.chain;
  }

  private drop(peer: PeerId) {
    const link = this.links.get(peer);
    if (!link) return;
    link.pc.onicecandidate = null;
    link.pc.ontrack = null;
    link.pc.onnegotiationneeded = null;
    link.pc.close();
    link.audio.srcObject = null;
    link.audio.remove();
    this.links.delete(peer);
    delete this.peerState[peer];
    delete this.remotes[peer];
    this.publish();
  }

  private offer(link: Link, peer: PeerId) {
    return this.enqueue(link, async () => {
      if (this.stopped || !link.caller || link.pc.signalingState !== "stable") return;
      try {
        await link.pc.setLocalDescription();
        const local = link.pc.localDescription;
        if (local?.type === "offer") this.send(peer, { kind: "sdp", type: "offer", sdp: local.sdp });
      } catch {
        if (!this.stopped) this.mark(peer, "failed");
      }
    });
  }

  private onSignal(from: PeerId, msg: Signal) {
    if (this.stopped) return;
    if (msg.kind === "hi" || msg.kind === "cam") {
      this.ensure(from);
      const remote = this.remotes[from];
      if (!remote) return;
      if (msg.kind === "hi") {
        remote.name = msg.name;
        remote.avatar = msg.avatar;
      } else {
        remote.camera = msg.on;
      }
      this.publish();
      return;
    }
    if (msg.kind === "need") {
      this.ensure(from);
      const link = this.links.get(from);
      if (link) void this.offer(link, from);
      return;
    }
    this.ensure(from);
    const link = this.links.get(from);
    if (!link) return;
    void this.enqueue(link, () => this.applySignal(link, from, msg));
  }

  private async applySignal(link: Link, from: PeerId, msg: Signal) {
    if (this.stopped || msg.kind !== "sdp" && msg.kind !== "ice") return;
    const pc = link.pc;
    try {
      if (msg.kind === "sdp") {
        if (msg.type === "offer" && link.caller) return;
        await pc.setRemoteDescription({ type: msg.type, sdp: msg.sdp });
        if (msg.type === "offer") {
          await pc.setLocalDescription();
          const local = pc.localDescription;
          if (local) this.send(from, { kind: "sdp", type: "answer", sdp: local.sdp });
        }
        const queued = link.ice;
        link.ice = [];
        for (const candidate of queued) await pc.addIceCandidate(candidate);
      } else if (pc.remoteDescription) {
        await pc.addIceCandidate(msg.candidate);
      } else {
        link.ice.push(msg.candidate);
      }
    } catch {
      if (!this.stopped) this.mark(from, "failed");
    }
  }

  private send(peer: PeerId, msg: Signal) {
    this.transport?.send(CHANNELS.VOICE, msg, peer);
  }

  private setHearing(peer: PeerId, hearing: boolean) {
    const remote = this.remotes[peer];
    if (!remote || remote.hearing === hearing) return;
    remote.hearing = hearing;
    this.publish();
  }

  private mark(peer: PeerId, state: VoiceLink) {
    if (this.peerState[peer] === state) return;
    this.peerState[peer] = state;
    this.publish();
  }

  private publish() {
    const states = Object.values(this.peerState);
    const remotes = { ...this.remotes };
    const phase = states.some((state) => state === "live")
      ? "live"
      : states.some((state) => state === "connecting")
        ? "connecting"
        : states.some((state) => state === "failed")
          ? "failed"
          : "idle";
    this.snap = {
      mic: this.mic,
      speaker: this.speaker,
      camera: this.camera,
      peers: { ...this.peerState },
      phase,
      remotes,
      hearing: Object.values(remotes).filter((remote) => remote.hearing).length,
      seeing: Object.values(remotes).filter((remote) => remote.camera).length,
      localPreview: this.localPreview,
    };
    this.listeners.forEach((listener) => listener());
  }
}
