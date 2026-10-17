/* 音效：全部用 WebAudio 即時合成，不需要音檔 */
(function () {
  'use strict';
  const H = (window.HoleIt = window.HoleIt || {});
  let ctx = null, master = null, muted = false;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, cutoff) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff || 900;
    const g = c.createGain();
    g.gain.value = vol || 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  H.Audio = {
    unlock: ensure,
    setMuted(v) { muted = !!v; },
    isMuted: () => muted,
    pop(combo) {
      const f = 440 * Math.pow(1.06, Math.min(combo || 0, 18));
      tone(f, 0.13, 'triangle', 0.28, f * 1.9);
    },
    gulp(combo) {
      const f = 200 + Math.min(combo || 0, 10) * 12;
      tone(f, 0.12, 'sine', 0.16, f * 0.6);
    },
    bad() {
      tone(200, 0.32, 'sawtooth', 0.14, 70);
      tone(150, 0.32, 'square', 0.06, 60, 0.04);
    },
    boom() {
      noise(0.6, 0.8, 700);
      tone(120, 0.4, 'sine', 0.35, 40);
    },
    tick() { tone(1050, 0.05, 'square', 0.06); },
    click() { tone(620, 0.06, 'triangle', 0.14, 900); },
    coin() {
      tone(988, 0.08, 'square', 0.08);
      tone(1319, 0.18, 'square', 0.08, null, 0.08);
    },
    boost() { tone(500, 0.25, 'triangle', 0.2, 1400); },
    levelUp() { [660, 880, 1175].forEach((f, i) => tone(f, 0.16, 'triangle', 0.2, null, i * 0.07)); },
    fever() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.14, f * 1.25, i * 0.05)); },
    go() {
      tone(660, 0.12, 'triangle', 0.22);
      tone(990, 0.22, 'triangle', 0.22, null, 0.12);
    },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'triangle', 0.24, null, i * 0.11)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, 'sine', 0.24, null, i * 0.17)); },
  };
})();
