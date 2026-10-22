/**
 * Procedural audio with the Web Audio API: no audio files, no licensing.
 * - Music: a tanpura-style drone (Sa–Pa) under a gentle melody in raga
 *   Mohanam (the Carnatic pentatonic S R2 G3 P D2), played on a bell/veena-like voice.
 * - SFX: short synthesized cues for taps, moves, cards, captures and results.
 */

export type SfxName =
  | "tap"
  | "select"
  | "move"
  | "capture"
  | "card"
  | "deal"
  | "flip"
  | "error"
  | "turn"
  | "win"
  | "lose"
  | "out"
  | "coin"
  | "join"
  | "pop";

const SA = 146.83; // D3 – a comfortable tonic
const MOHANAM = [0, 2, 4, 7, 9]; // semitones above Sa
const semis = (n: number) => SA * Math.pow(2, n / 12);

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private echo: DelayNode | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private droneNodes: AudioScheduledSourceNode[] = [];
  private musicOn = false;
  private sfxOn = true;
  private phrase = 0;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ctx.destination);

      // Soft echo for space.
      this.echo = ctx.createDelay(1);
      this.echo.delayTime.value = 0.32;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      this.echo.connect(feedback).connect(this.echo);
      this.echo.connect(wet).connect(this.master);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.echo);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture so browsers allow audio. */
  unlock() {
    this.ensure();
    if (this.musicOn) this.startMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return; // will start on unlock
    if (on) this.startMusic();
    else this.stopMusic();
  }

  // ------------------------------------------------------------------ voices

  private tone(
    freq: number,
    start: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; bus?: AudioNode; attack?: number; glideTo?: number } = {},
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, start + dur);
    const peak = opts.gain ?? 0.3;
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(opts.bus ?? this.sfxBus!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    return osc;
  }

  /** Bell / veena-ish pluck: fundamental + inharmonic partials. */
  private pluck(freq: number, start: number, dur: number, gain: number, bus: AudioNode) {
    this.tone(freq, start, dur, { type: "triangle", gain, bus });
    this.tone(freq * 2, start, dur * 0.6, { type: "sine", gain: gain * 0.35, bus });
    this.tone(freq * 3.01, start, dur * 0.3, { type: "sine", gain: gain * 0.12, bus });
  }

  private noise(start: number, dur: number, gain: number, freq = 2000) {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.sfxBus!);
    src.start(start);
  }

  // -------------------------------------------------------------------- SFX

  play(name: SfxName) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case "tap":
        this.tone(880, t, 0.06, { type: "sine", gain: 0.15 });
        break;
      case "select":
        this.tone(660, t, 0.08, { type: "triangle", gain: 0.2 });
        this.tone(990, t + 0.04, 0.08, { type: "triangle", gain: 0.12 });
        break;
      case "move":
        this.noise(t, 0.07, 0.35, 900);
        this.tone(220, t, 0.09, { type: "sine", gain: 0.25, glideTo: 160 });
        break;
      case "capture":
        this.noise(t, 0.12, 0.5, 600);
        this.tone(330, t, 0.18, { type: "square", gain: 0.08, glideTo: 110 });
        break;
      case "card":
        this.noise(t, 0.06, 0.4, 3500);
        break;
      case "deal":
        for (let i = 0; i < 5; i++) this.noise(t + i * 0.05, 0.04, 0.3, 3200);
        break;
      case "flip":
        this.noise(t, 0.18, 0.35, 1800);
        this.tone(500, t + 0.05, 0.12, { type: "sine", gain: 0.1, glideTo: 800 });
        break;
      case "error":
        this.tone(200, t, 0.12, { type: "sawtooth", gain: 0.08 });
        this.tone(150, t + 0.1, 0.16, { type: "sawtooth", gain: 0.08 });
        break;
      case "turn":
        this.pluck(semis(12), t, 0.4, 0.2, this.sfxBus!);
        this.pluck(semis(16), t + 0.1, 0.5, 0.18, this.sfxBus!);
        break;
      case "coin":
        this.tone(988, t, 0.08, { type: "square", gain: 0.08 });
        this.tone(1319, t + 0.07, 0.25, { type: "square", gain: 0.08 });
        break;
      case "join":
        this.pluck(semis(7), t, 0.3, 0.15, this.sfxBus!);
        this.pluck(semis(12), t + 0.08, 0.4, 0.15, this.sfxBus!);
        break;
      case "pop":
        this.tone(400, t, 0.1, { type: "sine", gain: 0.2, glideTo: 900 });
        break;
      case "out":
        this.noise(t, 0.25, 0.6, 400);
        this.tone(300, t, 0.5, { type: "sawtooth", gain: 0.1, glideTo: 80 });
        break;
      case "win":
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
          this.pluck(semis(12 + s), t + i * 0.09, 0.9, 0.2, this.sfxBus!),
        );
        break;
      case "lose":
        [7, 4, 2, 0].forEach((s, i) => this.pluck(semis(s), t + i * 0.18, 0.8, 0.18, this.sfxBus!));
        break;
    }
  }

  // ------------------------------------------------------------------ music

  private startMusic() {
    const ctx = this.ensure();
    if (!ctx || !this.musicBus || this.musicTimer) return;
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.32, ctx.currentTime, 1.2);
    this.startDrone();
    const loop = () => {
      this.playPhrase();
      this.musicTimer = setTimeout(loop, 7600);
    };
    loop();
  }

  private stopMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
    const nodes = this.droneNodes;
    this.droneNodes = [];
    setTimeout(() => nodes.forEach((n) => n.stop()), 1500);
  }

  /** Tanpura-like drone: Pa, Sa', Sa', Sa with a slow shimmer. */
  private startDrone() {
    const ctx = this.ctx!;
    const bus = this.musicBus!;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    droneGain.connect(filter).connect(bus);
    for (const [f, detune] of [
      [semis(-5), 0],
      [semis(0), -4],
      [semis(0), 5],
      [semis(-12), 0],
    ] as [number, number][]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.detune.value = detune;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15 + Math.random() * 0.2;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain).connect(droneGain.gain);
      osc.connect(droneGain);
      osc.start();
      lfo.start();
      this.droneNodes.push(osc, lfo);
    }
  }

  /** A short wandering phrase in Mohanam, resolving to Sa or Pa. */
  private playPhrase() {
    const ctx = this.ctx!;
    const bus = this.musicBus!;
    const t0 = ctx.currentTime + 0.1;
    const scale = [...MOHANAM.map((s) => s), ...MOHANAM.map((s) => s + 12)];
    let idx = 4 + Math.floor(Math.random() * 3);
    let t = t0;
    const notes = 6 + (this.phrase % 3);
    for (let i = 0; i < notes; i++) {
      const dur = [0.45, 0.6, 0.9][Math.floor(Math.random() * 3)];
      this.pluck(semis(scale[idx] + 12), t, dur * 2.2, 0.09, bus);
      t += dur;
      idx = Math.max(0, Math.min(scale.length - 1, idx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    }
    const resolve = this.phrase % 2 === 0 ? 12 : 7;
    this.pluck(semis(resolve + 12), t, 2.4, 0.1, bus);
    // Soft mridangam-like pulse under the phrase.
    for (let b = 0; b < 8; b++) {
      const bt = t0 + b * 0.9;
      this.tone(b % 4 === 0 ? 90 : 120, bt, 0.25, { type: "sine", gain: b % 4 === 0 ? 0.12 : 0.05, bus, glideTo: 60 });
    }
    this.phrase += 1;
  }
}

export const soundEngine = new SoundEngine();
