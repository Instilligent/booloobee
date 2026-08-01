/**
 * Procedural SFX for Booloobee — Web Audio, no external files.
 * Unlock on first user gesture (required on iOS).
 */

type SfxName =
  | "ui"
  | "scoop"
  | "spa"
  | "grind"
  | "box"
  | "sell"
  | "coin"
  | "thanks"
  | "shoot"
  | "hit"
  | "kill"
  | "hurt"
  | "upgrade"
  | "hire"
  | "levelup"
  | "fail"
  | "pop";

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private unlocked = false;
  private muted = false;
  private musicNodes: { stop: () => void } | null = null;
  private sfxVolume = 0.55;
  private musicVolume = 0.12;

  get isMuted() {
    return this.muted;
  }

  get isUnlocked() {
    return this.unlocked;
  }

  /** Call from the first click/touch/key (synchronously). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = this.sfxVolume;
      this.music.gain.value = this.musicVolume;
      this.master.gain.value = this.muted ? 0 : 1;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.unlocked = true;
    this.startMusic();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    }
    try {
      localStorage.setItem("booloobee_mute", m ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  loadMutePref() {
    try {
      if (localStorage.getItem("booloobee_mute") === "1") this.setMuted(true);
    } catch {
      /* ignore */
    }
  }

  play(name: SfxName) {
    if (!this.ctx || !this.sfx || this.muted) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const t = this.ctx.currentTime;
    const jitter = () => 0.92 + Math.random() * 0.16;

    switch (name) {
      case "ui":
        this.beep(880, 0.05, 0.08, "sine", t, 0.15);
        break;
      case "scoop":
        this.noiseBurst(0.06, 0.18, 400, 1800, t);
        this.beep(180 * jitter(), 0.08, 0.12, "triangle", t, 0.2);
        this.beep(320 * jitter(), 0.05, 0.06, "sine", t + 0.04, 0.12);
        break;
      case "spa":
        this.beep(520 * jitter(), 0.12, 0.1, "sine", t, 0.12);
        this.beep(780 * jitter(), 0.14, 0.08, "sine", t + 0.06, 0.1);
        this.beep(1040, 0.16, 0.06, "sine", t + 0.12, 0.08);
        this.noiseBurst(0.1, 0.08, 800, 4000, t, 0.05);
        break;
      case "grind":
        this.noiseBurst(0.18, 0.22, 200, 1200, t, 0.12);
        this.beep(90 * jitter(), 0.2, 0.14, "sawtooth", t, 0.12);
        this.beep(140, 0.15, 0.1, "square", t + 0.05, 0.06);
        break;
      case "box":
        this.beep(150 * jitter(), 0.06, 0.2, "triangle", t, 0.22);
        this.beep(300, 0.04, 0.08, "square", t + 0.05, 0.1);
        this.noiseBurst(0.04, 0.15, 100, 600, t, 0.1);
        break;
      case "sell":
      case "coin":
        this.beep(988 * jitter(), 0.08, 0.12, "sine", t, 0.18);
        this.beep(1318, 0.14, 0.14, "sine", t + 0.07, 0.16);
        this.beep(1568, 0.18, 0.1, "sine", t + 0.14, 0.12);
        break;
      case "thanks":
        this.beep(660 * jitter(), 0.07, 0.1, "triangle", t, 0.14);
        this.beep(880, 0.12, 0.1, "triangle", t + 0.08, 0.12);
        break;
      case "shoot":
        this.beep(420 * jitter(), 0.05, 0.08, "sine", t, 0.12);
        this.beep(640 * jitter(), 0.06, 0.07, "sine", t + 0.03, 0.1);
        this.beep(880 * jitter(), 0.08, 0.05, "sine", t + 0.06, 0.08);
        this.noiseBurst(0.04, 0.1, 1000, 5000, t, 0.04);
        break;
      case "hit":
        this.noiseBurst(0.05, 0.2, 300, 2000, t, 0.12);
        this.beep(220 * jitter(), 0.06, 0.1, "square", t, 0.1);
        break;
      case "kill":
        this.beep(523 * jitter(), 0.08, 0.1, "sine", t, 0.14);
        this.beep(659, 0.1, 0.1, "sine", t + 0.06, 0.12);
        this.beep(784, 0.14, 0.12, "sine", t + 0.12, 0.12);
        this.beep(1046, 0.2, 0.1, "sine", t + 0.2, 0.1);
        break;
      case "hurt":
        this.beep(160 * jitter(), 0.15, 0.18, "sawtooth", t, 0.16);
        this.noiseBurst(0.12, 0.2, 100, 800, t, 0.12);
        break;
      case "upgrade":
        this.beep(440, 0.08, 0.1, "sine", t, 0.12);
        this.beep(554, 0.08, 0.1, "sine", t + 0.07, 0.12);
        this.beep(659, 0.1, 0.12, "sine", t + 0.14, 0.14);
        this.beep(880, 0.18, 0.12, "sine", t + 0.22, 0.14);
        break;
      case "hire":
        this.beep(392, 0.1, 0.12, "triangle", t, 0.14);
        this.beep(523, 0.12, 0.12, "triangle", t + 0.1, 0.14);
        this.beep(659, 0.16, 0.14, "triangle", t + 0.2, 0.14);
        break;
      case "levelup":
        [523, 659, 784, 1046, 1318].forEach((f, i) => {
          this.beep(f, 0.12 + i * 0.02, 0.12, "sine", t + i * 0.09, 0.14);
        });
        break;
      case "fail":
        this.beep(300, 0.2, 0.18, "sawtooth", t, 0.16);
        this.beep(200, 0.28, 0.2, "sawtooth", t + 0.12, 0.14);
        break;
      case "pop":
        this.beep(700 * jitter(), 0.04, 0.06, "sine", t, 0.1);
        break;
    }
  }

  private beep(
    freq: number,
    duration: number,
    peak: number,
    type: OscillatorType,
    when: number,
    attack = 0.01,
  ) {
    if (!this.ctx || !this.sfx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(when);
    osc.stop(when + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noiseBurst(
    duration: number,
    peak: number,
    hpFreq: number,
    lpFreq: number,
    when: number,
    attack = 0.005,
  ) {
    if (!this.ctx || !this.sfx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = hpFreq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lpFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    src.start(when);
    src.stop(when + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      hp.disconnect();
      lp.disconnect();
      g.disconnect();
    };
  }

  /** Soft looping farm pad — quiet background */
  private startMusic() {
    if (!this.ctx || !this.music || this.musicNodes) return;
    const ctx = this.ctx;
    const bus = this.music;
    const notes = [196, 247, 294, 330, 392]; // G minor-ish soft
    let stopped = false;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 ? "sine" : "triangle";
      osc.frequency.value = f;
      g.gain.value = 0.0001;
      osc.connect(g);
      g.connect(bus);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    });

    let step = 0;
    const tick = () => {
      if (stopped || !this.ctx) return;
      const t = this.ctx.currentTime;
      const idx = step % notes.length;
      gains.forEach((g, i) => {
        const target = i === idx || i === (idx + 2) % notes.length ? 0.035 : 0.008;
        g.gain.setTargetAtTime(this.muted ? 0 : target, t, 0.2);
      });
      // gentle detune on one voice
      if (oscs[1]) {
        oscs[1].frequency.setTargetAtTime(notes[1] * (1 + Math.sin(step * 0.3) * 0.01), t, 0.5);
      }
      step++;
      timer = window.setTimeout(tick, 900);
    };
    let timer = window.setTimeout(tick, 100);

    this.musicNodes = {
      stop: () => {
        stopped = true;
        clearTimeout(timer);
        const t = ctx.currentTime;
        gains.forEach((g) => g.gain.setTargetAtTime(0.0001, t, 0.05));
        setTimeout(() => {
          oscs.forEach((o) => {
            try {
              o.stop();
              o.disconnect();
            } catch {
              /* */
            }
          });
          gains.forEach((g) => g.disconnect());
        }, 200);
        this.musicNodes = null;
      },
    };
  }

  stopMusic() {
    this.musicNodes?.stop();
  }
}

export const gameAudio = new GameAudio();
export type { SfxName };
