/* 音效與背景音樂：全部用 WebAudio 即時合成，不需要音檔 */
(function () {
  'use strict';
  const H = (window.HoleIt = window.HoleIt || {});
  let ctx = null, master = null, muted = false, noiseBuf = null;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        const len = ctx.sampleRate;
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) {
        ctx = null;
      }
    }
    // iOS 切背景、來電後會是 interrupted，不只 suspended
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) ctx.resume().catch(() => {});
    if (ctx && mus.id !== 'off' && !mus.timer) musicStart();
    return ctx;
  }

  // 切到背景就整個暫停（手機鎖屏、切 App 時音樂不會繼續響）
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  // 單一個音：out 不給就接到音效總線，at 是絕對時間（給背景音樂排程用）
  function osc(freq, dur, type, vol, slideTo, t, out, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    osc(freq, dur, type, vol, slideTo, c.currentTime + (delay || 0), master);
  }

  // 雜訊：ftype 濾波器種類（lowpass 悶、highpass 刺、bandpass 中間）
  function hiss(dur, vol, cutoff, ftype, t, out) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype || 'lowpass';
    f.frequency.value = cutoff || 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
  function noise(dur, vol, cutoff, ftype, delay) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    hiss(dur, vol, cutoff, ftype, c.currentTime + (delay || 0), master);
  }

  // ---------- 背景音樂：程式產生的循環小曲（每首 8 小節，旋律用固定種子產生，每次聽到都一樣） ----------
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
  // chords：每小節一個和弦（根音 MIDI 編號＋和弦內音），key/scale 給旋律用
  const TRACKS = {
    happy: {
      name: '輕快', bpm: 118, key: 60, scale: MAJOR, seed: 7, swing: 0, density: 0.62, cutoff: 9000,
      chords: [[48, [0, 4, 7]], [43, [0, 4, 7]], [45, [0, 3, 7]], [41, [0, 4, 7]]],
      lead: 'triangle', leadVol: 0.16, bass: 'triangle', bassVol: 0.22, pad: 'sine', padVol: 0.05,
      kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], arp: false,
    },
    chill: {
      name: '放鬆', bpm: 78, key: 65, scale: MAJOR, seed: 21, swing: 0.18, density: 0.38, cutoff: 2200,
      chords: [[41, [0, 4, 7, 11]], [40, [0, 3, 7, 10]], [38, [0, 3, 7, 10]], [48, [0, 4, 7, 11]]],
      lead: 'sine', leadVol: 0.15, bass: 'sine', bassVol: 0.3, pad: 'triangle', padVol: 0.05,
      kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], arp: false,
    },
    chip: {
      name: '電玩', bpm: 140, key: 69, scale: MINOR, seed: 3, swing: 0, density: 0.75, cutoff: 12000,
      chords: [[45, [0, 3, 7]], [41, [0, 4, 7]], [48, [0, 4, 7]], [43, [0, 4, 7]]],
      lead: 'square', leadVol: 0.07, bass: 'triangle', bassVol: 0.26, pad: null, padVol: 0,
      kick: [0, 6, 8], snare: [4, 12], hat: [2, 6, 10, 14], arp: true,
    },
  };
  const BARS = 8, STEPS = 16;
  // 背景音樂音量：玩家滑桿 0～1，預設 0.5（＝0.14，比音效小，不會蓋過吞東西的聲音）
  const MUSIC_MAX = 0.28;
  let musicLevel = 0.5;
  const musicVol = () => MUSIC_MAX * musicLevel;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 旋律：前 4 小節寫一段，後 4 小節重複但最後落在主音，聽起來像一首完整的短曲
  function compose(tr) {
    const R = rng(tr.seed), notes = [];
    const scale = [];
    for (let o = -1; o <= 2; o++) tr.scale.forEach((s) => scale.push(tr.key + o * 12 + s));
    const lo = tr.key - 3, hi = tr.key + 14;
    let cur = scale.indexOf(tr.key + tr.scale[2]);
    for (let bar = 0; bar < 4; bar++) {
      const [root, iv] = tr.chords[bar];
      const tones = scale.map((n, i) => [n, i]).filter(([n]) => n >= lo && n <= hi && iv.some((x) => (n - root - x) % 12 === 0));
      for (let s = 0; s < STEPS; s += 2) {
        const strong = s % 8 === 0;
        if (!strong && R() > tr.density) continue;
        if (strong && tones.length) {
          // 重拍放和弦內音，挑離上一個音近的
          tones.sort((a, b) => Math.abs(a[1] - cur) - Math.abs(b[1] - cur));
          cur = tones[Math.floor(R() * Math.min(2, tones.length))][1];
        } else {
          cur += [-2, -1, -1, 1, 1, 2][Math.floor(R() * 6)];
        }
        cur = Math.max(0, Math.min(scale.length - 1, cur));
        while (scale[cur] > hi) cur -= 2;
        while (scale[cur] < lo) cur += 2;
        const len = R() < 0.3 && s % 4 === 0 ? 4 : 2;
        notes.push({ bar, s, n: scale[cur], len });
      }
    }
    const out = notes.slice();
    notes.forEach((x) => out.push({ ...x, bar: x.bar + 4 }));
    // 第 8 小節收尾：最後一個音換成主音並拉長
    const last = out.filter((x) => x.bar === 7);
    last.forEach((x, i) => { if (i === last.length - 1) { x.n = tr.key; x.len = 6; } });
    const map = {};
    out.forEach((x) => { (map[x.bar * STEPS + x.s] = map[x.bar * STEPS + x.s] || []).push(x); });
    return map;
  }

  const mus = { id: 'off', timer: null, step: 0, next: 0, mood: '', song: null, bus: null, filt: null, duck: null };

  function musicStart() {
    const tr = TRACKS[mus.id];
    if (!ctx || !tr) return;
    if (!mus.song || mus.song.id !== mus.id) mus.song = { id: mus.id, map: compose(tr) };
    mus.bus = ctx.createGain();
    mus.bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    mus.bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
    mus.filt = ctx.createBiquadFilter();
    mus.filt.type = 'lowpass';
    mus.filt.frequency.value = tr.cutoff;
    mus.duck = ctx.createGain();
    mus.duck.gain.value = musicVol();
    mus.bus.connect(mus.filt);
    mus.filt.connect(mus.duck);
    mus.duck.connect(ctx.destination);
    mus.step = 0;
    mus.next = ctx.currentTime + 0.08;
    mus.timer = setInterval(musicTick, 30);
  }
  function musicStop() {
    if (mus.timer) clearInterval(mus.timer);
    mus.timer = null;
    if (mus.bus && ctx) {
      const b = mus.bus, d = mus.duck, t = ctx.currentTime;
      b.gain.cancelScheduledValues(t);
      b.gain.setValueAtTime(Math.max(0.0001, b.gain.value), t);
      b.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      setTimeout(() => d.disconnect(), 600);
    }
    mus.bus = null;
  }
  function musicTick() {
    if (!ctx || ctx.state !== 'running') return;
    const tr = TRACKS[mus.id];
    const hurry = mus.mood === 'hurry';
    const dur = 60 / (tr.bpm * (hurry ? 1.12 : 1)) / 4;
    // 分頁被節流後回來：跳到現在，不要一口氣補放一堆音
    if (mus.next < ctx.currentTime - 0.2) mus.next = ctx.currentTime + 0.05;
    while (mus.next < ctx.currentTime + 0.15) {
      const swing = mus.step % 2 ? tr.swing * dur : 0;
      playStep(tr, mus.step, mus.next + swing, dur, hurry);
      mus.next += dur;
      mus.step = (mus.step + 1) % (BARS * STEPS);
    }
  }
  function playStep(tr, step, t, dur, hurry) {
    const out = mus.bus, bar = Math.floor(step / STEPS), s = step % STEPS;
    const [root, iv] = tr.chords[bar % tr.chords.length];
    // 鼓
    if (tr.kick.includes(s) || (hurry && s % 4 === 0)) osc(150, 0.16, 'sine', 0.5, 42, t, out);
    if (tr.snare.includes(s)) {
      hiss(0.13, 0.22, 1800, 'bandpass', t, out);
      osc(220, 0.08, 'triangle', 0.08, 160, t, out);
    }
    if (tr.hat.includes(s) || (hurry && s % 2 === 1)) hiss(0.04, s % 4 === 2 ? 0.1 : 0.06, 7000, 'highpass', t, out);
    // 貝斯：每拍根音，第 3 拍換五度
    if (s % 4 === 0 || (tr.arp && s % 2 === 0)) {
      const n = root + (s === 8 ? 7 : 0) + (tr.arp && s % 4 === 2 ? 12 : 0);
      osc(midi(n), dur * (tr.arp ? 1.6 : 3.4), tr.bass, tr.bassVol, null, t, out);
    }
    // 和弦墊底：小節開頭鋪一整小節
    if (tr.pad && s === 0) iv.forEach((x) => osc(midi(root + 12 + x), dur * 15, tr.pad, tr.padVol, null, t, out, 0.08));
    // 電玩風：和弦琶音
    if (tr.arp && s % 2 === 1) osc(midi(root + 24 + iv[(s >> 1) % iv.length]), dur * 0.9, 'square', 0.025, null, t, out);
    // 旋律
    const notes = mus.song.map[step];
    if (notes) notes.forEach((x) => osc(midi(x.n), dur * x.len * 0.95, tr.lead, tr.leadVol, null, t, out, 0.015));
  }

  H.Audio = {
    unlock: ensure,
    setMuted(v) { muted = !!v; },
    isMuted: () => muted,
    // ---------- 背景音樂 ----------
    tracks: Object.keys(TRACKS).map((id) => ({ id, name: TRACKS[id].name })),
    setMusic(id) {
      id = TRACKS[id] ? id : 'off';
      if (id === mus.id && (mus.timer || !ctx)) return;
      musicStop();
      mus.id = id;
      if (id !== 'off' && ctx) musicStart();
    },
    setMusicVol(v) {
      musicLevel = Math.max(0, Math.min(1, +v || 0));
      if (!ctx || !mus.duck) return;
      const g = mus.duck.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(musicVol(), t + 0.08);
    },
    // 最後 10 秒：鼓點加密、速度加快
    musicMood(m) { mus.mood = m || ''; },
    // 過關／失敗：音樂先壓低，讓結算音效聽得清楚，幾秒後回來
    musicDuck(sec) {
      if (!ctx || !mus.duck) return;
      const g = mus.duck.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(musicVol() * 0.2, t + 0.25);
      g.setValueAtTime(musicVol() * 0.2, t + (sec || 3.5));
      g.linearRampToValueAtTime(musicVol(), t + (sec || 3.5) + 1.5);
    },
    // ---------- 音效 ----------
    // big：吞下的東西跟黑洞比有多大（0～1），越大越低沉、多一聲悶響
    pop(combo, big) {
      const f = 440 * Math.pow(1.06, Math.min(combo || 0, 18)) * (1 - 0.35 * (big || 0));
      tone(f, 0.13, 'triangle', 0.28, f * 1.9);
      if (big > 0.5) tone(110, 0.22, 'sine', 0.35 * big, 45);
    },
    gulp(combo, big) {
      const f = (200 + Math.min(combo || 0, 10) * 12) * (1 - 0.4 * (big || 0));
      tone(f, 0.12 + 0.12 * (big || 0), 'sine', 0.16 + 0.12 * (big || 0), f * 0.6);
      if (big > 0.5) tone(80, 0.25, 'sine', 0.3 * big, 38);
    },
    // 連吃里程碑：每 5 個一聲亮晶晶，每 25 個（+1 秒）更長一串
    streak(bonus) {
      const fs = bonus ? [1047, 1319, 1568, 2093, 2637] : [1319, 1568, 2093];
      fs.forEach((f, i) => tone(f, 0.16, 'sine', 0.16, null, i * 0.045));
    },
    bossDown() {
      noise(0.5, 0.6, 600);
      tone(100, 0.45, 'sine', 0.4, 35);
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'square', 0.07, null, 0.18 + i * 0.09));
      tone(1047, 0.6, 'triangle', 0.2, null, 0.55);
    },
    // 防護罩擋下「別吃」的東西：金屬「鏘」
    shield() {
      tone(1760, 0.3, 'square', 0.06, 1600);
      tone(2637, 0.4, 'sine', 0.12);
      tone(3520, 0.25, 'sine', 0.06, null, 0.02);
      noise(0.08, 0.25, 5000, 'highpass');
    },
    // 每種道具一個專屬音效
    booster(k) {
      switch (k) {
        case 'grow':
          tone(140, 0.4, 'sawtooth', 0.1, 520);
          tone(280, 0.4, 'triangle', 0.18, 1040);
          break;
        case 'magnet': // 閃電吸取：電流滋滋聲
          [0, 0.06, 0.12, 0.2].forEach((d, i) => tone(2200 - i * 300, 0.07, 'sawtooth', 0.08, 300, d));
          noise(0.3, 0.2, 3000, 'highpass');
          break;
        case 'zoom':
          tone(260, 0.45, 'sine', 0.2, 1000);
          tone(520, 0.45, 'triangle', 0.08, 2000, 0.05);
          break;
        case 'freeze': // 結冰：清脆風鈴
          [2093, 2637, 3136, 2349, 2794].forEach((f, i) => tone(f, 0.25, 'sine', 0.1, null, i * 0.05));
          noise(0.4, 0.12, 6000, 'highpass');
          break;
        case 'shoes': // 加速：咻
          noise(0.3, 0.3, 1200, 'bandpass');
          tone(400, 0.25, 'triangle', 0.16, 1800);
          break;
        case 'shield': // 防護罩展開：嗡～
          tone(220, 0.45, 'square', 0.05, 440);
          tone(880, 0.45, 'sine', 0.15, 1320);
          tone(1320, 0.3, 'sine', 0.06, null, 0.15);
          break;
        default:
          tone(500, 0.25, 'triangle', 0.2, 1400);
      }
    },
    // 道具／限時效果結束：輕輕往下滑
    fxEnd() {
      tone(760, 0.22, 'sine', 0.13, 380);
      tone(570, 0.22, 'sine', 0.08, 285, 0.08);
    },
    bad() {
      tone(200, 0.32, 'sawtooth', 0.14, 70);
      tone(150, 0.32, 'square', 0.06, 60, 0.04);
    },
    boom() {
      noise(0.6, 0.8, 700);
      tone(120, 0.4, 'sine', 0.35, 40);
    },
    // 最後 10 秒倒數：越接近 0 音越高，最後 3 秒加重
    tick(sec) {
      const left = sec || 10;
      tone(900 + (10 - left) * 70, 0.06, 'square', left <= 3 ? 0.11 : 0.06);
      if (left <= 3) tone(220, 0.12, 'sine', 0.2, 160);
    },
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
    // 過關號角：上行琶音 → C、F、G、C 和弦 → 結算視窗（1.1 秒）每顆星叮一聲 → 拍手歡呼、亮晶晶
    clear(stars) {
      // 聲部多，整體壓到一半，跟其他音效差不多大聲
      const T = (f, d, ty, v, sl, de) => tone(f, d, ty, v * 0.5, sl, de);
      const N = (d, v, c, ty, de) => noise(d, v * 0.5, c, ty, de);
      const chord = (fs, d, len, v) => fs.forEach((f, i) => {
        T(f, len, 'triangle', v, null, d);
        if (i === fs.length - 1) T(f, len * 0.8, 'square', v * 0.3, null, d);
      });
      const kick = (d) => T(150, 0.18, 'sine', 0.45, 45, d);
      const snare = (d) => N(0.12, 0.3, 1800, 'bandpass', d);
      [392, 523, 659, 784].forEach((f, i) => {
        T(f, 0.12, 'square', 0.07, null, i * 0.08);
        T(f, 0.12, 'triangle', 0.16, null, i * 0.08);
      });
      chord([523, 659, 784], 0.36, 0.24, 0.13);
      kick(0.36);
      T(131, 0.25, 'sine', 0.3, null, 0.36);
      chord([698, 880, 1047], 0.6, 0.12, 0.12);
      snare(0.6);
      chord([784, 988, 1175], 0.72, 0.12, 0.12);
      snare(0.72);
      // 最後的大和弦：拉長，配低音、大鼓、鈸
      chord([523, 659, 784, 1047], 0.86, 1.1, 0.13);
      T(131, 0.9, 'sine', 0.32, null, 0.86);
      kick(0.86);
      N(1.2, 0.22, 6000, 'highpass', 0.86);
      // 派對哨子
      T(1100, 0.3, 'sine', 0.07, 2300, 0.95);
      // 星星：跟著結算視窗的星星彈出
      [1319, 1568, 2093].slice(0, stars || 1).forEach((f, i) => {
        const d = 1.32 + i * 0.18;
        T(f, 0.4, 'sine', 0.18, null, d);
        T(f * 2, 0.25, 'sine', 0.06, null, d);
      });
      // 拍手歡呼：一串隨機的短促拍手聲，越後面越稀疏
      for (let i = 0; i < 34; i++) {
        const d = 0.9 + Math.pow(Math.random(), 1.6) * 1.8;
        N(0.035, 0.22 * (1 - (d - 0.9) / 2.2), 1100 + Math.random() * 900, 'bandpass', d);
      }
      // 亮晶晶
      for (let i = 0; i < (stars >= 3 ? 12 : 7); i++) T(2400 + Math.random() * 1800, 0.18, 'sine', 0.05, null, 0.95 + Math.random() * 1.3);
    },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, 'sine', 0.24, null, i * 0.17)); },
  };
})();
