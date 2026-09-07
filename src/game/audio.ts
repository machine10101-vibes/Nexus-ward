type Bus = { master: GainNode; sfx: GainNode; music: GainNode };

class GameAudio {
  ctx: AudioContext | null = null;
  bus: Bus | null = null;
  unlocked = false;
  musicStarted = false;
  oscA: OscillatorNode | null = null;
  oscB: OscillatorNode | null = null;
  filter: BiquadFilterNode | null = null;
  musicGain: GainNode | null = null;
  volumes = { master: 0.85, sfx: 0.8, music: 0.35 };
  muted = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      const master = this.ctx.createGain();
      const sfx = this.ctx.createGain();
      const music = this.ctx.createGain();
      sfx.connect(master);
      music.connect(master);
      master.connect(this.ctx.destination);
      this.bus = { master, sfx, music };
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
    document.addEventListener("visibilitychange", this.onVis);
    if (!this.musicStarted) this.startDrone();
  }

  onVis = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      if (this.ctx.state === "running") void this.ctx.suspend();
    } else if (this.unlocked) {
      void this.ctx.resume();
    }
  };

  setVolumes(v: { master: number; sfx: number; music: number }) {
    this.volumes = v;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx || !this.bus) return;
    const m = this.muted ? 0 : this.volumes.master * this.volumes.master;
    this.bus.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.03);
    this.bus.sfx.gain.setTargetAtTime(this.volumes.sfx * this.volumes.sfx, this.ctx.currentTime, 0.03);
    this.bus.music.gain.setTargetAtTime(this.volumes.music * this.volumes.music, this.ctx.currentTime, 0.05);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolumes();
  }

  startDrone() {
    if (!this.ctx || !this.bus || this.musicStarted) return;
    this.musicStarted = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    const a = this.ctx.createOscillator();
    const b = this.ctx.createOscillator();
    a.type = "sine";
    b.type = "sine";
    a.frequency.value = 55;
    b.frequency.value = 82.5;
    a.connect(filter);
    b.connect(filter);
    filter.connect(g);
    g.connect(this.bus.music);
    a.start();
    b.start();
    this.oscA = a;
    this.oscB = b;
    this.filter = filter;
    this.musicGain = g;
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 40;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    lfo.start();
  }

  tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, slide?: number) {
    if (!this.ctx || !this.bus || !this.unlocked) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.bus.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur: number, gain = 0.1, hp = 400) {
    if (!this.ctx || !this.bus || !this.unlocked) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.bus.sfx);
    src.start(t);
  }

  place() {
    this.tone(220, 0.12, "triangle", 0.06, 440);
  }
  shoot() {
    this.tone(520 + Math.random() * 40, 0.05, "square", 0.035);
  }
  laser() {
    this.tone(880, 0.07, "sawtooth", 0.03, 420);
  }
  boom() {
    this.noise(0.18, 0.12, 200);
    this.tone(90, 0.2, "sine", 0.08, 40);
  }
  leak() {
    this.tone(180, 0.35, "sawtooth", 0.07, 70);
  }
  wave() {
    this.tone(196, 0.22, "sine", 0.05, 392);
  }
  win() {
    this.tone(262, 0.2, "sine", 0.06, 392);
    this.tone(330, 0.35, "sine", 0.05, 523);
  }
  lose() {
    this.tone(160, 0.5, "triangle", 0.07, 60);
  }
  ui() {
    this.tone(640, 0.06, "sine", 0.03);
  }
  surge() {
    this.tone(140, 0.4, "sawtooth", 0.08, 420);
    this.noise(0.22, 0.1, 180);
  }
  overclock() {
    this.tone(330, 0.18, "triangle", 0.06, 660);
    this.tone(495, 0.28, "sine", 0.05, 880);
  }
}

export const audio = new GameAudio();
