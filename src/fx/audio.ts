// Procedural WebAudio sound effects. No audio assets: every sound is synthesised.
// Each sound is layered (transient + body + tail) with randomised pitch so
// repeated shots never sound identical. A generated reverb gives the sewer tail.

type Bus = AudioNode;

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  gain: number;
  attack?: number;
  wet?: number; // 0..1 send to reverb
  detune?: number;
}

interface NoiseOpts {
  filter: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  dur: number;
  gain: number;
  attack?: number;
  wet?: number;
}

export type Material = 'flesh' | 'metal';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private lastPlayed = new Map<string, number>();
  muted = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.value = m ? 0 : 0.7;
  }

  private init(): void {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.connect(this.master);

    // Generated impulse response: decaying stereo noise, a damp stone tube.
    const seconds = 1.9;
    const len = Math.floor(ctx.sampleRate * seconds);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2);
      }
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.32;
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(verb);
    verb.connect(verbOut);
    verbOut.connect(this.master);

    // One second of white noise, reused by every noise burst.
    const nlen = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
  }

  /** Rate-limit a sound id so a held trigger doesn't stack hundreds of nodes. */
  private gate(id: string, minGapMs: number): boolean {
    if (!this.ctx || this.muted) return false;
    const now = performance.now();
    const last = this.lastPlayed.get(id) ?? -1e9;
    if (now - last < minGapMs) return false;
    this.lastPlayed.set(id, now);
    return true;
  }

  private route(node: AudioNode, wet: number): void {
    if (!this.ctx) return;
    const dryG = this.ctx.createGain();
    dryG.gain.value = 1 - wet * 0.5;
    node.connect(dryG);
    dryG.connect(this.dry as Bus);
    if (wet > 0) {
      const wetG = this.ctx.createGain();
      wetG.gain.value = wet;
      node.connect(wetG);
      wetG.connect(this.reverbSend);
    }
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    this.route(g, o.wet ?? 0.15);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  private burst(o: NoiseOpts): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter;
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    const a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f);
    f.connect(g);
    this.route(g, o.wet ?? 0.15);
    src.start(t, Math.random() * 0.8);
    src.stop(t + o.dur + 0.02);
  }

  private rp(spread = 0.12): number {
    return 1 + (Math.random() * 2 - 1) * spread;
  }

  // ---- Player weapons -------------------------------------------------

  shoot(): void {
    if (!this.gate('shoot', 30)) return;
    const p = this.rp();
    this.burst({ filter: 'highpass', f0: 3200 * p, f1: 900, dur: 0.05, gain: 0.5, wet: 0.1 });
    this.tone({ type: 'sawtooth', f0: 190 * p, f1: 52, dur: 0.1, gain: 0.5, wet: 0.2 });
    this.burst({ filter: 'lowpass', f0: 1100 * p, f1: 180, dur: 0.26, gain: 0.2, wet: 0.7 });
  }

  empty(): void {
    if (!this.gate('empty', 140)) return;
    this.tone({ type: 'square', f0: 1300, dur: 0.025, gain: 0.08, wet: 0 });
  }

  windup(): void {
    if (!this.gate('windup', 40)) return;
    this.tone({ type: 'sawtooth', f0: 90, f1: 210, dur: 0.1, gain: 0.16, wet: 0.2 });
  }

  swing(): void {
    if (!this.gate('swing', 40)) return;
    const p = this.rp(0.08);
    this.burst({ filter: 'bandpass', f0: 380 * p, f1: 2600 * p, q: 2.6, dur: 0.16, gain: 0.38, attack: 0.02, wet: 0.35 });
    this.tone({ type: 'sawtooth', f0: 230 * p, f1: 470 * p, dur: 0.2, gain: 0.07, wet: 0.4 });
    this.tone({ type: 'sine', f0: 118, f1: 96, dur: 0.22, gain: 0.12, wet: 0.2 });
  }

  // ---- Impacts --------------------------------------------------------

  hit(material: Material, heavy = false): void {
    if (!this.gate('hit-' + material + (heavy ? 'h' : ''), heavy ? 25 : 40)) return;
    const p = this.rp(0.15);
    if (material === 'flesh') {
      this.burst({ filter: 'lowpass', f0: 800 * p, f1: 170, dur: heavy ? 0.16 : 0.09, gain: heavy ? 0.7 : 0.45, wet: 0.2 });
      this.tone({ type: 'sine', f0: 130 * p, f1: 48, dur: heavy ? 0.16 : 0.08, gain: heavy ? 0.55 : 0.35, wet: 0.2 });
    } else {
      this.tone({ type: 'square', f0: 1750 * p, dur: 0.14, gain: heavy ? 0.16 : 0.1, wet: 0.35 });
      this.tone({ type: 'square', f0: 2630 * p, dur: 0.1, gain: heavy ? 0.12 : 0.07, wet: 0.35 });
      this.burst({ filter: 'highpass', f0: 4000, dur: 0.035, gain: 0.28, wet: 0.1 });
      if (heavy) this.tone({ type: 'sine', f0: 105 * p, f1: 55, dur: 0.2, gain: 0.5, wet: 0.3 });
    }
  }

  kill(pitch = 1): void {
    if (!this.gate('kill', 20)) return;
    this.tone({ type: 'sine', f0: 700 * pitch, f1: 1250 * pitch, dur: 0.09, gain: 0.13, wet: 0.4 });
    this.tone({ type: 'triangle', f0: 1400 * pitch, f1: 2100 * pitch, dur: 0.07, gain: 0.05, wet: 0.5 });
  }

  explosion(): void {
    if (!this.gate('boom', 60)) return;
    this.burst({ filter: 'lowpass', f0: 3200, f1: 60, dur: 0.8, gain: 0.85, attack: 0.004, wet: 0.7 });
    this.tone({ type: 'sine', f0: 95, f1: 26, dur: 0.7, gain: 0.8, wet: 0.5 });
    this.burst({ filter: 'highpass', f0: 5000, f1: 1500, dur: 0.18, gain: 0.3, wet: 0.2 });
  }

  hurt(): void {
    if (!this.gate('hurt', 90)) return;
    this.tone({ type: 'sawtooth', f0: 150, f1: 55, dur: 0.18, gain: 0.45, wet: 0.2 });
    this.burst({ filter: 'lowpass', f0: 1200, f1: 200, dur: 0.15, gain: 0.35, wet: 0.2 });
  }

  // ---- Movement -------------------------------------------------------

  step(): void {
    if (!this.gate('step', 90)) return;
    const p = this.rp(0.18);
    this.tone({ type: 'sine', f0: 78 * p, f1: 40, dur: 0.09, gain: 0.26, wet: 0.35 });
    this.burst({ filter: 'lowpass', f0: 420 * p, dur: 0.06, gain: 0.12, wet: 0.4 });
    this.burst({ filter: 'highpass', f0: 3000, dur: 0.02, gain: 0.05, wet: 0.2 });
  }

  dash(): void {
    if (!this.gate('dash', 100)) return;
    this.burst({ filter: 'bandpass', f0: 1200, f1: 280, q: 1.4, dur: 0.18, gain: 0.34, wet: 0.3 });
    this.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.14, gain: 0.3, wet: 0.2 });
  }

  // ---- Machines -------------------------------------------------------

  charge(): void {
    if (!this.gate('charge', 120)) return;
    this.tone({ type: 'sine', f0: 280, f1: 880, dur: 0.55, gain: 0.07, attack: 0.1, wet: 0.3 });
    this.tone({ type: 'square', f0: 140, f1: 440, dur: 0.55, gain: 0.025, attack: 0.1, wet: 0.2 });
  }

  robotShot(): void {
    if (!this.gate('rshot', 45)) return;
    const p = this.rp(0.1);
    this.tone({ type: 'square', f0: 760 * p, f1: 190, dur: 0.13, gain: 0.2, wet: 0.35 });
    this.burst({ filter: 'bandpass', f0: 2400, f1: 600, q: 1.5, dur: 0.08, gain: 0.2, wet: 0.2 });
  }

  // ---- Loot -----------------------------------------------------------

  pickup(rarity: number): void {
    if (!this.gate('pickup', 35)) return;
    const base = 520 * Math.pow(1.13, rarity);
    this.tone({ type: 'sine', f0: base, dur: 0.11, gain: 0.14, wet: 0.35 });
    this.tone({ type: 'sine', f0: base * 1.5, dur: 0.16, gain: 0.11, attack: 0.04, wet: 0.4 });
    if (rarity >= 4) this.tone({ type: 'triangle', f0: base * 3, f1: base * 3.4, dur: 0.4, gain: 0.07, attack: 0.05, wet: 0.7 });
    if (rarity >= 6) this.tone({ type: 'sine', f0: base * 4.5, dur: 0.7, gain: 0.07, attack: 0.08, wet: 0.9 });
  }

  drop(rarity: number): void {
    if (rarity < 3 || !this.gate('drop', 120)) return;
    this.tone({ type: 'triangle', f0: 300 * Math.pow(1.1, rarity), f1: 600 * Math.pow(1.1, rarity), dur: 0.3, gain: 0.08, attack: 0.05, wet: 0.6 });
  }
}
