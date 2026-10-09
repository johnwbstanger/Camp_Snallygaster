export type Vec = { x: number; y?: number; z: number };

const MATERIAL_TONE: Record<string, { freq: number; q: number; decay: number }> = {
  metal: { freq: 900, q: 6, decay: 0.45 },
  plastic: { freq: 420, q: 2, decay: 0.22 },
  rubber: { freq: 180, q: 1, decay: 0.16 },
  cardboard: { freq: 260, q: 0.8, decay: 0.12 },
  wood: { freq: 330, q: 2.5, decay: 0.3 },
  ceramic: { freq: 1500, q: 9, decay: 0.35 },
  gun: { freq: 140, q: 0.5, decay: 0.9 },
  generic: { freq: 300, q: 1.5, decay: 0.2 },
};

/** Tiny procedural sound bank: no downloads, everything is synthesised with Web Audio. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambience: { stop: () => void } | null = null;
  volume = 0.8;

  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return this.ctx; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const length = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
  }

  /** Spatialised thump/clang for any noise event: volume falls off with distance. */
  impact(material: string, loudness: number, from: Vec, listener: Vec) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const distance = Math.hypot(from.x - listener.x, from.z - listener.z);
    const gain = Math.max(0, 1 - distance / (loudness * 1.2 + 10)) * Math.min(1, 0.25 + loudness / 70);
    if (gain < 0.02) return;
    const tone = MATERIAL_TONE[material] ?? MATERIAL_TONE.generic;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = tone.freq; filter.Q.value = tone.q;
    const amp = ctx.createGain();
    const now = ctx.currentTime;
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + tone.decay);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (from.x - listener.x) / Math.max(8, distance) * 0.8));
    source.connect(filter).connect(amp).connect(pan).connect(this.master);
    source.start(now, Math.random());
    source.stop(now + tone.decay + 0.05);
  }

  /** Short rising growl used when a monster spots the team. */
  stinger(intensity = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.7);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 600;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.35 * intensity, now + 0.15);
    amp.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc.connect(filter).connect(amp).connect(this.master);
    osc.start(now); osc.stop(now + 1.2);
  }

  /** Quiet looping night ambience (wind + distant crickets). Fades as danger rises. */
  startAmbience() {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuffer || this.ambience) return;
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer; wind.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    const windGain = ctx.createGain(); windGain.gain.value = 0.05;
    wind.connect(lp).connect(windGain).connect(this.master);
    const cricket = ctx.createOscillator(); cricket.type = "square"; cricket.frequency.value = 4300;
    const cricketGain = ctx.createGain(); cricketGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain).connect(cricketGain.gain);
    cricket.connect(cricketGain).connect(this.master);
    wind.start(); cricket.start(); lfo.start();
    this.ambience = { stop: () => { for (const node of [wind, cricket, lfo]) { try { node.stop(); } catch { /* already stopped */ } } } };
  }

  stop() {
    this.ambience?.stop();
    this.ambience = null;
    void this.ctx?.close();
    this.ctx = null; this.master = null; this.noiseBuffer = null;
  }
}
