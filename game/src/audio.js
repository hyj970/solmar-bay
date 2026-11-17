// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, police sirens, gunfire, impacts, pickups and a small
// bass-driven street loop. Created lazily on the first user gesture.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.step = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    // Engine: two detuned saws through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    engineOsc2.start();
    this.engineOsc2 = engineOsc2;
    // Siren: a triangle that wails between two notes.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** Engine pitch follows speed 0..1; silent when not driving. */
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(25 + speed01 * 65, t, 0.08);
  }

  /** Siren loudness follows the nearest police distance. */
  setSiren(intensity) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(intensity * 0.05, t, 0.2);
    if (intensity > 0.01) {
      const phase = (t % 1.6) < 0.8 ? 660 : 880;
      this.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.7;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(80, t + len);
    const g = this.ctx.createGain();
    g.gain.value = 0.8;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    this.blip(70, 0.5, 'sine', 0.5);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = 0.18;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.value = 0.45;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  pickup() {
    this.blip(880, 0.12, 'sine', 0.25);
    setTimeout(() => this.blip(1318, 0.18, 'sine', 0.25), 90);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.3), i * 110));
  }

  missionFail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.2), i * 140));
  }

  punch() {
    this.blip(140, 0.1, 'square', 0.3);
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A minor-key street groove: bass line + hats, scheduled in 8th notes.
    const bassNotes = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
    const stepDur = 0.21;
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      const t = this.ctx.currentTime;
      const note = bassNotes[this.step % bassNotes.length];
      if (note > 0) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = note;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
        o.connect(g);
        g.connect(this.musicGain);
        o.start(t);
        o.stop(t + stepDur);
      }
      if (this.step % 2 === 0) {
        const len = 0.03;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 6000;
        const g = this.ctx.createGain();
        g.gain.value = 0.12;
        src.connect(f);
        f.connect(g);
        g.connect(this.musicGain);
        src.start(t);
      }
      this.step++;
    };
    this.musicTimer = setInterval(tick, stepDur * 1000);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
