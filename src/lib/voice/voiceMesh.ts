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

export type VoiceSnapshot = {
  mic: VoiceMic;
  speaker: boolean;
  peers: Record<string, VoiceLink>;
  /** idle: nobody else yet. connecting / live / failed describe the calls. */
  phase: "idle" | "connecting" | "live" | "failed";
};

type Signal =
  | { kind: "sdp"; type: "offer" | "answer"; sdp: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

type Link = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  restarted: boolean;
  audio: HTMLAudioElement;
  incoming: MediaStream;
  ice: RTCIceCandidateInit[];
};

const INITIAL: VoiceSnapshot = { mic: "off", speaker: true, peers: {}, phase: "idle" };

/**
 * One audio call per other phone. Game moves stay on Firebase; this only
 * carries microphone audio. The peer with the greater id is the polite side
 * and yields if both browsers offer at once.
 */
export class VoiceMesh {
  private transport: Transport | null = null;
  private offs: (() => void)[] = [];
  private links = new Map<PeerId, Link>();
  private peerState: Record<string, VoiceLink> = {};
  private localStream: MediaStream | null = null;
  private localTrack: MediaStreamTrack | null = null;
  private mic: VoiceMic = "off";
  private speaker = true;
  private stopped = false;
  private micLock: Promise<void> | null = null;
  private snap: VoiceSnapshot = INITIAL;
  private listeners = new Set<() => void>();

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

  stop() {
    this.stopped = true;
    this.offs.forEach((off) => off());
    this.offs = [];
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.localTrack = null;
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

  toggleSpeaker() {
    this.speaker = !this.speaker;
    for (const link of this.links.values()) {
      link.audio.muted = !this.speaker;
      if (this.speaker) void link.audio.play().catch(() => undefined);
    }
    this.publish();
  }

  /** Close every call and open them again. */
  retry() {
    const peers = [...this.links.keys()];
    for (const peer of peers) this.drop(peer);
    for (const peer of peers) this.ensure(peer);
  }

  private async flipMic() {
    if (this.mic === "on" && this.localTrack) {
      this.localTrack.enabled = false;
      this.mic = "off";
      this.publish();
      return;
    }
    if (this.localTrack) {
      this.localTrack.enabled = true;
      this.mic = "on";
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
      for (const link of this.links.values()) await this.attachTrack(link);
      this.mic = "on";
      this.unlock();
    } catch (err) {
      const blocked = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      this.mic = blocked ? "denied" : "off";
    }
    this.publish();
  }

  private async attachTrack(link: Link) {
    if (!this.localTrack) return;
    let transceiver = link.pc.getTransceivers().find((item) => item.receiver.track?.kind === "audio");
    if (!transceiver) transceiver = link.pc.addTransceiver(this.localTrack, { direction: "sendrecv" });
    await transceiver.sender.replaceTrack(this.localTrack);
    if (transceiver.direction !== "sendrecv") transceiver.direction = "sendrecv";
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
    const link: Link = {
      pc,
      polite: this.transport.selfId > peer,
      makingOffer: false,
      ignoreOffer: false,
      restarted: false,
      audio,
      incoming: new MediaStream(),
      ice: [],
    };
    this.links.set(peer, link);
    this.peerState[peer] = "connecting";

    pc.onicecandidate = (event) => {
      if (event.candidate) this.send(peer, { kind: "ice", candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? link.incoming;
      if (!event.streams[0]) link.incoming.addTrack(event.track);
      link.audio.srcObject = stream;
      link.audio.muted = !this.speaker;
      void link.audio.play().catch(() => undefined);
      this.mark(peer, "live");
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
    pc.onnegotiationneeded = async () => {
      try {
        link.makingOffer = true;
        await pc.setLocalDescription();
        const local = pc.localDescription;
        if (local && (local.type === "offer" || local.type === "answer")) {
          this.send(peer, { kind: "sdp", type: local.type, sdp: local.sdp });
        }
      } catch {
        if (!this.stopped) this.mark(peer, "failed");
      } finally {
        link.makingOffer = false;
      }
    };

    if (this.localTrack && this.localStream) pc.addTrack(this.localTrack, this.localStream);
    else if (this.localTrack) pc.addTrack(this.localTrack);
    else pc.addTransceiver("audio", { direction: "recvonly" });
    this.publish();
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
    this.publish();
  }

  private async onSignal(from: PeerId, msg: Signal) {
    if (this.stopped) return;
    this.ensure(from);
    const link = this.links.get(from);
    if (!link) return;
    const pc = link.pc;
    try {
      if (msg.kind === "sdp") {
        const collision = msg.type === "offer" && (link.makingOffer || pc.signalingState !== "stable");
        link.ignoreOffer = !link.polite && collision;
        if (link.ignoreOffer) return;
        if (collision) await pc.setLocalDescription({ type: "rollback" });
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
      if (!this.stopped && !link.ignoreOffer) this.mark(from, "failed");
    }
  }

  private send(peer: PeerId, msg: Signal) {
    this.transport?.send(CHANNELS.VOICE, msg, peer);
  }

  private mark(peer: PeerId, state: VoiceLink) {
    if (this.peerState[peer] === state) return;
    this.peerState[peer] = state;
    this.publish();
  }

  private publish() {
    const states = Object.values(this.peerState);
    const phase = states.some((state) => state === "live")
      ? "live"
      : states.some((state) => state === "connecting")
        ? "connecting"
        : states.some((state) => state === "failed")
          ? "failed"
          : "idle";
    this.snap = { mic: this.mic, speaker: this.speaker, peers: { ...this.peerState }, phase };
    this.listeners.forEach((listener) => listener());
  }
}
