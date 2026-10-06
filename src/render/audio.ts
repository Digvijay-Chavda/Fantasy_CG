/** Synthesised sound effects + ambient pad (Web Audio, no asset files). */

export type Sfx = 'select' | 'deal' | 'place' | 'flip' | 'turn' | 'win' | 'lose' | 'error' | 'hover';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let music: { gain: GainNode; stop: () => void } | null = null;

const state = { sound: true, music: true };

function ac(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, cutoff: number, when = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const audio = {
  /** Browsers only allow audio after a user gesture; call from the first click/tap. */
  unlock() {
    const c = ac();
    if (c?.state === 'suspended') void c.resume();
    if (state.music && !music) audio.startMusic();
  },

  setSound(on: boolean) {
    state.sound = on;
  },

  setMusic(on: boolean) {
    state.music = on;
    if (on) audio.startMusic();
    else audio.stopMusic();
  },

  play(name: Sfx, pitch = 1) {
    if (!state.sound) return;
    switch (name) {
      case 'hover': tone(900 * pitch, 0.04, 'sine', 0.05); break;
      case 'select': tone(520 * pitch, 0.07, 'triangle', 0.18); tone(780 * pitch, 0.09, 'triangle', 0.14, 0.05); break;
      case 'deal': noise(0.07, 0.25, 3000); tone(340 * pitch, 0.06, 'triangle', 0.1); break;
      case 'place': noise(0.16, 0.5, 900); tone(130, 0.2, 'sine', 0.5, 0, 55); break;
      case 'flip': tone(420 * pitch, 0.16, 'triangle', 0.22, 0, 900 * pitch); noise(0.05, 0.12, 6000); break;
      case 'turn': tone(392, 0.12, 'sine', 0.2); tone(587, 0.18, 'sine', 0.2, 0.09); break;
      case 'error': tone(170, 0.18, 'sawtooth', 0.18, 0, 110); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.45, 'triangle', 0.25, i * 0.14)); tone(1318, 0.9, 'sine', 0.2, 0.6); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.12, i * 0.2)); break;
    }
  },

  startMusic() {
    const c = ac();
    if (!c || !master || !state.music || music) return;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 3);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.connect(gain).connect(master);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const oscs = [110, 164.81, 220, 277.18].map((f, i) => {
      const o = c.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      o.connect(filter);
      o.start();
      return o;
    });
    music = {
      gain,
      stop: () => {
        const t = c.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.linearRampToValueAtTime(0, t + 0.8);
        setTimeout(() => {
          oscs.forEach((o) => o.stop());
          lfo.stop();
        }, 900);
      },
    };
  },

  stopMusic() {
    music?.stop();
    music = null;
  },
};
