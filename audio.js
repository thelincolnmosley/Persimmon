/* Persimmon: everything you hear is synthesised here. There are no audio files. */
const Snd = (() => {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  const STEP = 0.43;
  const LEVEL = 0.85;

  // One key per time of day. `scale` is a pentatonic set used for every melodic
  // sound, `chords` is the slow progression underneath.
  const HARMONY = [
    { scale: [62, 64, 66, 69, 71], chords: [[50, 57, 64, 66], [55, 59, 62, 66], [47, 57, 62, 66], [45, 57, 61, 64]] },
    { scale: [62, 64, 67, 69, 71], chords: [[55, 59, 62, 69], [48, 55, 59, 64], [52, 59, 62, 67], [50, 57, 62, 66]] },
    { scale: [64, 67, 69, 71, 74], chords: [[52, 59, 62, 66], [48, 55, 59, 64], [45, 55, 60, 64], [47, 57, 62, 66]] },
    { scale: [60, 62, 64, 67, 69], chords: [[45, 52, 59, 60], [41, 53, 57, 64], [50, 57, 60, 64], [52, 59, 62, 67]] },
  ];
  const MOTIF = [0, 2, 1, 3, 2, 4, 3, 5];

  let ac = null, out, dry, wet, noiseBuf, curPad = null;
  let muted = false, held = false;
  let phase = 0, stepN = 0, nextT = 0, walk = 3;
  try { muted = localStorage.getItem('persimmon.muted') === '1'; } catch (e) {}

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);
  const deg = (i) => HARMONY[phase].scale[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
  const now = () => ac.currentTime + 0.012;

  function build() {
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    out = ac.createGain();
    out.gain.value = muted ? 0 : LEVEL;
    out.connect(comp);
    comp.connect(ac.destination);
    dry = ac.createGain();
    dry.connect(out);
    const conv = ac.createConvolver();
    conv.buffer = impulse(3.4);
    wet = ac.createGain();
    wet.gain.value = 0.7;
    wet.connect(conv);
    conv.connect(out);

    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    nextT = ac.currentTime + 0.4;
    setInterval(schedule, 70);
  }

  // A soft, darkening tail: noise through a one-pole filter that closes over time.
  function impulse(sec) {
    const n = (ac.sampleRate * sec) | 0;
    const buf = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp += (Math.random() * 2 - 1 - lp) * (0.6 - 0.45 * t);
        d[i] = lp * Math.pow(1 - t, 3.2);
      }
    }
    return buf;
  }

  function route(node, send, pan) {
    let n = node;
    if (pan && ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      n = p;
    }
    n.connect(dry);
    if (send > 0) {
      const s = ac.createGain();
      s.gain.value = send;
      n.connect(s);
      s.connect(wet);
    }
  }

  function env(t, peak, attack, decay) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  function osc(type, f, t, stop) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(stop);
    return o;
  }

  // Thumb-piano voice: a sine with a quick pitch settle, a short glassy
  // partial two octaves up, and a little body an octave up.
  function pluck(m, t, vel, o = {}) {
    const f = mtof(m), d = o.decay || 1.1;
    const mix = ac.createGain();
    const a = osc('sine', f * 1.012, t, t + d + 0.1);
    a.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    a.connect(env(t, vel, 0.003, d)).connect(mix);
    const b = osc('sine', f * 4, t, t + d * 0.3 + 0.05);
    b.connect(env(t, vel * (o.bright === undefined ? 0.3 : o.bright), 0.002, d * 0.16)).connect(mix);
    const c = osc('triangle', f * 2, t, t + d * 0.5 + 0.05);
    c.connect(env(t, vel * 0.12, 0.003, d * 0.4)).connect(mix);
    route(mix, o.send === undefined ? 0.35 : o.send, o.pan || 0);
  }

  function noise(t, dur, type, freq, q, vel, send) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = env(t, vel, 0.004, dur);
    s.connect(f).connect(g);
    route(g, send || 0, 0);
    s.start(t, Math.random() * 0.9);
    s.stop(t + dur + 0.08);
  }

  function tok(t, f, vel, send) {
    const o = osc('sine', f * 1.7, t, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.028);
    const g = env(t, vel, 0.002, 0.09);
    o.connect(g);
    route(g, send === undefined ? 0.2 : send, 0);
  }

  function pad(notes, t, dur) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.4;
    lp.frequency.setValueAtTime(320, t);
    lp.frequency.linearRampToValueAtTime(980, t + dur * 0.55);
    lp.frequency.linearRampToValueAtTime(380, t + dur + 3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(1, t, 0.9);
    g.gain.setTargetAtTime(0, t + dur, 1.3);
    for (const m of notes) {
      for (const det of [-6, 7]) {
        const o = osc('sawtooth', mtof(m), t, t + dur + 8);
        o.detune.value = det;
        const v = ac.createGain();
        v.gain.value = 0.021;
        o.connect(v).connect(lp);
      }
    }
    lp.connect(g);
    route(g, 0.5, 0);
    curPad = g;
  }

  function bass(m, t) {
    const o = osc('sine', mtof(m), t, t + 4.2);
    const g = env(t, 0.11, 0.05, 3.8);
    o.connect(g);
    route(g, 0.15, 0);
  }

  function bird(t) {
    const base = rand(2300, 3500), n = 2 + ((Math.random() * 3) | 0), pan = rand(-0.8, 0.8);
    for (let i = 0; i < n; i++) {
      const s = t + i * rand(0.1, 0.16), len = rand(0.06, 0.11);
      const o = osc('sine', base * rand(0.85, 1), s, s + len + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.5), s + len * 0.55);
      o.frequency.exponentialRampToValueAtTime(base * rand(0.95, 1.15), s + len);
      const g = env(s, 0.016, 0.012, len);
      o.connect(g);
      route(g, 0.8, pan);
    }
  }

  function cricket(t) {
    const f = rand(4100, 4700), n = 3 + ((Math.random() * 2) | 0), pan = rand(-0.9, 0.9);
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.052;
      const o = osc('sine', f, s, s + 0.06);
      const g = env(s, 0.0075, 0.006, 0.03);
      o.connect(g);
      route(g, 0.5, pan);
    }
  }

  // The ambient bed: a chord every sixteen steps, a wandering thumb-piano line
  // on top, and whatever lives in the garden at this hour.
  function schedule() {
    if (!ac || ac.state !== 'running') return;
    if (nextT < ac.currentTime - 0.3) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.25) {
      step(stepN++, nextT);
      nextT += STEP;
    }
  }

  function step(n, t) {
    const h = HARMONY[phase];
    if (n % 16 === 0) {
      const ch = h.chords[(n / 16) % 4 | 0];
      pad(ch, t, STEP * 16);
      bass(ch[0], t);
    }
    const p = n % 4 === 0 ? 0.36 : n % 2 === 0 ? 0.22 : 0.09;
    if (Math.random() < p) {
      walk = Math.max(0, Math.min(9, walk + [-2, -1, -1, 1, 1, 2][(Math.random() * 6) | 0]));
      pluck(deg(walk) + 12, t + rand(0, 0.014), rand(0.028, 0.055), { decay: 1.9, send: 0.75, pan: rand(-0.6, 0.6), bright: 0.18 });
    }
    const r = Math.random();
    if (phase === 0 && r < 0.05) bird(t + rand(0, 0.3));
    else if (phase === 1 && r < 0.028) bird(t + rand(0, 0.3));
    else if (phase === 2 && r < 0.07) (r < 0.012 ? bird : cricket)(t + rand(0, 0.3));
    else if (phase === 3 && r < 0.24) cricket(t + rand(0, 0.3));
  }

  const ready = () => ac && ac.state === 'running';

  return {
    unlock() {
      if (!AC) return;
      if (!ac) build();
      if (ac.state === 'suspended' && !held) ac.resume();
    },
    hold(on) {
      held = on;
      if (!ac) return;
      if (on) ac.suspend(); else ac.resume();
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('persimmon.muted', muted ? '1' : '0'); } catch (e) {}
      if (ac) out.gain.setTargetAtTime(muted ? 0 : LEVEL, ac.currentTime, 0.04);
      return muted;
    },

    start() {
      if (!ready()) return;
      const t = now();
      [0, 2, 4, 5, 7].forEach((d, i) => pluck(deg(d) + 12, t + i * 0.065, 0.15, { decay: 1.4, send: 0.5, bright: 0.35 }));
    },
    turn(i) {
      if (!ready()) return;
      tok(now(), mtof(deg([0, 2, 3, 1][i & 3]) + 12), 0.06);
    },
    plip() {
      if (!ready()) return;
      tok(now(), mtof(deg(4) + 24), 0.035, 0.6);
    },
    eat(n) {
      if (!ready()) return;
      const t = now(), idx = MOTIF[n % 8] + (Math.floor(n / 8) % 3), m = deg(idx) + 12;
      pluck(m, t, 0.3, { decay: 1.3, send: 0.4, bright: 0.4 });
      pluck(m + 12, t + 0.07, 0.085, { decay: 0.9, send: 0.55 });
      if (n % 4 === 3) pluck(deg(idx + 2) + 12, t + 0.14, 0.12, { decay: 1.2, send: 0.5 });
      noise(t, 0.07, 'bandpass', 2300, 0.8, 0.13, 0.1);
      noise(t + 0.045, 0.06, 'bandpass', 1500, 0.8, 0.085, 0.1);
    },
    plum() {
      if (!ready()) return;
      const t = now();
      [0, 2, 4, 5, 7, 9].forEach((d, i) => pluck(deg(d) + 24, t + i * 0.052, 0.12, { decay: 1.2, send: 0.65, bright: 0.5, pan: (i - 2.5) * 0.18 }));
      noise(t, 0.08, 'bandpass', 1800, 0.8, 0.12, 0.1);
    },
    plumGone() {
      if (!ready()) return;
      const t = now();
      tok(t, mtof(deg(3) + 12), 0.04, 0.5);
      tok(t + 0.11, mtof(deg(1) + 12), 0.035, 0.5);
    },
    phase(p, announce) {
      phase = p & 3;
      if (!ac) return;
      stepN = 0;
      if (curPad) {
        const t = ac.currentTime;
        curPad.gain.cancelScheduledValues(t);
        curPad.gain.setTargetAtTime(0, t, 0.45);
        curPad = null;
      }
      if (!announce || !ready()) return;
      const t = now();
      HARMONY[phase].chords[0].forEach((m, i) => pluck(m + 12, t + i * 0.1, 0.11, { decay: 3, send: 0.75, bright: 0.45, pan: (i - 1.5) * 0.25 }));
    },
    bonk() {
      if (!ready()) return;
      const t = now();
      const o = osc('sine', 150, t, t + 0.6);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
      const g = env(t, 0.5, 0.004, 0.42);
      o.connect(g);
      route(g, 0.2, 0);
      noise(t, 0.12, 'lowpass', 500, 0.5, 0.25, 0.15);
      pluck(deg(0) - 12, t, 0.2, { decay: 0.6, bright: 0.1 });
      pluck(deg(0) - 11, t + 0.02, 0.16, { decay: 0.6, bright: 0.1 });
    },
    pop(i) {
      if (!ready()) return;
      const t = now();
      pluck(deg(Math.max(0, 12 - i)) + 12, t, 0.11, { decay: 0.32, bright: 0.2, send: 0.3 });
      noise(t, 0.035, 'highpass', 3000, 0.5, 0.045, 0.05);
    },
    fall() {
      if (!ready()) return;
      const t = now();
      const o = osc('sine', 920, t, t + 1.5);
      o.frequency.exponentialRampToValueAtTime(130, t + 1.3);
      const lfo = osc('sine', 7, t, t + 1.5);
      const depth = ac.createGain();
      depth.gain.value = 14;
      lfo.connect(depth).connect(o.frequency);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.08);
      g.gain.setTargetAtTime(0, t + 0.7, 0.22);
      o.connect(g);
      route(g, 0.6, 0);
    },
    over(best) {
      if (!ready()) return;
      const t = now() + 0.1;
      if (best) {
        [0, 2, 4, 7, 9].forEach((d, i) => pluck(deg(d) + 12, t + i * 0.11, 0.16, { decay: 2, send: 0.7, bright: 0.45 }));
        pluck(deg(10) + 12, t + 0.62, 0.14, { decay: 3, send: 0.8, bright: 0.5 });
      } else {
        [4, 2, 0].forEach((d, i) => pluck(deg(d), t + i * 0.24, 0.17, { decay: 2, send: 0.7, bright: 0.2 }));
      }
    },
  };
})();
