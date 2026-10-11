/* 遊戲主程式：渲染、黑洞、物件掉落與堆疊崩塌、關卡流程、HUD */
(function () {
  'use strict';
  const T = THREE, H = window.HoleIt, A = H.Audio;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI;
  const UP = new T.Vector3(0, 1, 0);
  const GROW_K = 0.35;      // 吃掉物件後黑洞面積成長倍率
  const PIT_D = 16;         // 洞深
  const GRAVITY = 30;
  // 道具（照官方：變大藥水、閃電、放大鏡、冰凍時鐘；到指定關卡解鎖並送 1 個，用完可用金幣買）
  const BOOST = {
    grow: { name: '變大藥水', icon: '🧪', unlock: 3, cost: 60, dur: 10 },
    magnet: { name: '閃電吸取', icon: '⚡', unlock: 6, cost: 80, dur: 8 },
    zoom: { name: '放大鏡', icon: '🔍', unlock: 9, cost: 50, dur: 12 },
    freeze: { name: '冰凍時間', icon: '❄️', unlock: 12, cost: 70, dur: 10 },
  };
  const SIZE_STEP = 0.3; // 每升一級，黑洞半徑增加起始半徑的 30%
  const CONTINUE_COST = 50;
  // 黑洞造型（外框顏色）：anim 為會變色的款式
  const SKINS = [
    { id: 'classic', name: '經典銀', price: 0, color: 0xd3d8e2 },
    { id: 'pink', name: '粉紅泡泡', price: 200, color: 0xf48fb1 },
    { id: 'mint', name: '薄荷綠', price: 200, color: 0x7fd8c4 },
    { id: 'ocean', name: '深海藍', price: 300, color: 0x3d8bfd },
    { id: 'gold', name: '黃金', price: 400, color: 0xffc928 },
    { id: 'galaxy', name: '星空紫', price: 500, color: 0x7e57c2 },
    { id: 'fire', name: '火焰', price: 700, anim: 'fire' },
    { id: 'rainbow', name: '彩虹', price: 900, anim: 'rainbow' },
  ];
  const KEY_COLOR = { red: 0xe53935, blue: 0x1e88e5, yellow: 0xfdd835 };
  let spinTex = null;
  function spinnerTexture() {
    if (spinTex) return spinTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 12; i++) {
      x.fillStyle = i % 2 ? '#7c3aed' : '#a78bfa';
      x.beginPath();
      x.moveTo(128, 128);
      x.arc(128, 128, 128, (i / 12) * PI * 2, ((i + 1) / 12) * PI * 2);
      x.fill();
    }
    x.fillStyle = '#ede9fe';
    x.beginPath();
    x.arc(128, 128, 22, 0, PI * 2);
    x.fill();
    spinTex = new T.CanvasTexture(c);
    return spinTex;
  }
  const skinOf = (id) => SKINS.find((k) => k.id === id) || SKINS[0];
  const todayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const todayKey = () => new Date(todayNum() * 86400000).toISOString().slice(0, 10);
  // 操控靈敏度：手指在地面上滑 1 格，黑洞移動幾格
  const speedMul = () => Math.max(0.5, Math.min(2, +save.speed || 1)); // 移動速度倍率（暫停選單可微調）
  // 越吃越快：黑洞每升一級速度 +2%，最多 +18%（官方沒有，刻意做得不明顯）
  const growSpeed = () => 1 + Math.min(0.18, Math.max(0, (hole.size || 1) - 1) * 0.02);
  const CTRL_ZH = { joy: '搖桿', drag: '拖曳' };
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // ---------- 存檔 ----------
  const SAVE_KEY = 'holeit-web-save-v1';
  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  }
  const save = Object.assign({ level: 1, unlocked: 1, stars: {}, coins: 200, muted: false, speed: 1, ctrl: 'joy', bag: {}, granted: {}, skins: ['classic'], skin: 'classic', daily: {}, dex: {} }, loadSave());
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 無痕模式等情況忽略 */ }
  }
  A.setMuted(save.muted);

  // ---------- 渲染器 ----------
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 500);
  const hemi = new T.HemisphereLight(0xffffff, 0x8a8070, 0.5);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 0.62);
  // 夜晚關：只靠黑洞上方這盞聚光燈照亮周圍
  const spot = new T.SpotLight(0xfff1d0, 0, 0, 0.5, 0.6, 0);
  scene.add(spot, spot.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  scene.add(sun, sun.target);
  let shadowExt = 0;

  // ---------- 黑洞（模板緩衝挖洞：洞口區域不畫地面，露出底下的井） ----------
  const holeGroup = new T.Group();
  scene.add(holeGroup);
  const holeMask = new T.Mesh(
    new T.CircleGeometry(1, 64).rotateX(-PI / 2),
    new T.MeshBasicMaterial({
      colorWrite: false, depthWrite: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp,
    })
  );
  holeMask.position.y = 0.003;
  holeMask.renderOrder = -10;
  const pitGeo = new T.CylinderGeometry(1, 1, PIT_D, 48, 8, true).translate(0, -PIT_D / 2, 0);
  {
    const p = pitGeo.attributes.position, cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = Math.max(0, 1 + p.getY(i) / 2.6); // 洞口附近帶點棕色，往下漸黑
      cols[i * 3] = 0.07 * k; cols[i * 3 + 1] = 0.07 * k; cols[i * 3 + 2] = 0.09 * k;
    }
    pitGeo.setAttribute('color', new T.BufferAttribute(cols, 3));
  }
  const pit = new T.Mesh(pitGeo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide }));
  const pitBottom = new T.Mesh(new T.CircleGeometry(1, 48).rotateX(-PI / 2), new T.MeshBasicMaterial({ color: 0x000000 }));
  pitBottom.position.y = -PIT_D;
  holeGroup.add(holeMask, pit, pitBottom);
  // 洞口那圈銀色厚邊
  const rimGroup = new T.Group();
  scene.add(rimGroup);
  const rim = new T.Mesh(
    new T.TorusGeometry(1.1, 0.1, 14, 80).rotateX(PI / 2),
    new T.MeshPhongMaterial({ color: 0xd3d8e2, shininess: 90, specular: 0x777777 })
  );
  rim.receiveShadow = true;
  // 黃色成長進度環（外圈深色軌道＋黃色弧線）
  const ringTrack = new T.Mesh(
    new T.RingGeometry(1.26, 1.38, 72).rotateX(-PI / 2),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })
  );
  ringTrack.position.y = 0.02;
  ringTrack.material.depthTest = false;
  ringTrack.renderOrder = 5;
  const ringArc = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xffc928, depthWrite: false }));
  ringArc.position.y = 0.025;
  ringArc.material.depthTest = false;
  ringArc.renderOrder = 6;
  // 升級時往外擴散的金色光圈
  const levelFx = new T.Mesh(
    new T.RingGeometry(1.0, 1.25, 72).rotateX(-PI / 2),
    new T.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0, depthWrite: false })
  );
  levelFx.position.y = 0.03;
  levelFx.material.depthTest = false;
  levelFx.renderOrder = 7;
  // 洞口外圈的倒數時間環（白色，剩不到三成變紅）
  const timeTrack = new T.Mesh(
    new T.RingGeometry(1.46, 1.53, 72).rotateX(-PI / 2),
    new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })
  );
  timeTrack.position.y = 0.02;
  timeTrack.material.depthTest = false;
  timeTrack.renderOrder = 5;
  const timeArc = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  timeArc.position.y = 0.025;
  timeArc.material.depthTest = false;
  timeArc.renderOrder = 6;
  rimGroup.add(rim, ringTrack, ringArc, levelFx, timeTrack, timeArc);
  let timeShown = -1;
  function setTimeRing(f) {
    const q = Math.round(Math.max(0, Math.min(1, f)) * 200) / 200;
    if (q === timeShown) return;
    timeShown = q;
    timeArc.geometry.dispose();
    timeArc.geometry = q > 0.003
      ? new T.RingGeometry(1.46, 1.53, 72, 1, PI / 2, q * PI * 2).rotateX(-PI / 2) // 從正上方逆時針縮短
      : new T.BufferGeometry();
    timeArc.material.color.set(q > 0.3 ? 0xffffff : 0xff4d4f);
  }
  let ringShown = -1, fxT = 0;
  function setRing(prog) {
    const q = Math.round(prog * 100) / 100;
    if (q === ringShown) return;
    ringShown = q;
    ringArc.geometry.dispose();
    ringArc.geometry = q > 0.005
      ? new T.RingGeometry(1.26, 1.38, 72, 1, PI / 2 - q * PI * 2, q * PI * 2).rotateX(-PI / 2) // 從正上方順時針長出
      : new T.BufferGeometry();
  }

  let grassTex = null;
  function grassTexture() {
    if (grassTex) return grassTex;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#4f9e33';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(40,110,25,.6)' : 'rgba(120,190,70,.55)';
      x.lineWidth = 1.5;
      const px = Math.random() * 256, py = Math.random() * 256;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (Math.random() - 0.5) * 4, py - 5 - Math.random() * 5);
      x.stroke();
    }
    grassTex = new T.CanvasTexture(c);
    grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping;
    grassTex.repeat.set(160, 160);
    grassTex.anisotropy = maxAniso;
    return grassTex;
  }

  function groundMat(opts) {
    return new T.MeshLambertMaterial(Object.assign({
      stencilWrite: true, stencilRef: 1, stencilFunc: T.NotEqualStencilFunc,
      stencilFail: T.KeepStencilOp, stencilZFail: T.KeepStencilOp, stencilZPass: T.KeepStencilOp,
    }, opts));
  }

  // ---------- 遊戲狀態 ----------
  const G = {
    state: 'boot', n: 1, L: null, ents: [], ims: [], goals: [], avoid: [],
    time: 0, total: 0, shownSec: -1, combo: 0, lastEat: -9, shake: 0, t: 0, orbit: 0, half: 15,
    boosts: { magnet: 0, grow: 0, zoom: 0, freeze: 0 }, moved: false,
  };
  const hole = { pos: new T.Vector3(), area: 0.49, r: 0.7, vis: 0.7, size: 1, prog: 0, acc: new T.Vector2() };
  let world = null;
  const camPos = new T.Vector3(0, 20, 14), camLook = new T.Vector3(), _v = new T.Vector3(), _w = new T.Vector3();

  // ---------- 關卡建置 ----------
  function disposeWorld() {
    if (!world) return;
    scene.remove(world);
    world.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      else if (o.isMesh && o.userData.own) {
        o.geometry.dispose();
        if (o.material.map && o.material.map !== grassTex) o.material.map.dispose();
        o.material.dispose();
      }
    });
    world = null;
  }

  // 任務比對；kind 為 'star' 的「星星點數」任務：吃任何東西都算，越大的東西點數越多
  const match = (e, spec) => spec.kind === 'star' || (e.kind === spec.kind && (!spec.color || e.color === spec.color));
  const starPts = (e) => Math.max(1, Math.round(e.r * 10));

  const qA = new T.Quaternion(), qB = new T.Quaternion(), _m = new T.Matrix4(), _pv = new T.Vector3(), _sv = new T.Vector3();
  function writeMatrix(e) {
    qB.setFromAxisAngle(UP, e.yaw);
    if (e.tilt) {
      qA.setFromAxisAngle(e.axis, e.tilt);
      qB.premultiply(qA);
    }
    _pv.set(e.pos.x, e.pos.y + e.bob, e.pos.z);
    _sv.setScalar(e.scale * e.base);
    _m.compose(_pv, qB, _sv);
    e.im.setMatrixAt(e.idx, _m);
    e.im.userData.dirty = true;
  }

  function makeEntity(p, im, idx) {
    const def = H.KINDS[p.kind];
    const s = p.s || 1; // 巨無霸關的放大版
    return {
      kind: p.kind, color: p.color, def, im, idx,
      pos: new T.Vector3(p.x, p.y || 0, p.z),
      r: def.r * s, h: im.geometry.boundingBox.max.y * s, value: def.r * def.r * s * s,
      yaw: p.yaw, tilt: 0, axis: new T.Vector3(1, 0, 0), scale: 1, base: s, bob: 0,
      state: 0, vy: 0, spin: 0, supports: [], above: [], goal: false,
      walk: def.walk ? { speed: def.walk * (0.8 + Math.random() * 0.4), dir: p.yaw, t: Math.random() * 3, ph: Math.random() * 9, pause: false } : null,
    };
  }

  function buildLevel(n) {
    disposeWorld();
    const daily = n === 'daily';
    const L = daily ? H.getDaily(todayNum()) : H.getLevel(n);
    G.daily = daily ? todayKey() : null;
    G.n = daily ? 999 : n; // 每日挑戰：道具全開，不影響一般關卡進度
    G.L = L;
    const floor = H.FLOORS[L.floor];
    world = new T.Group();
    scene.add(world);
    scene.background = new T.Color(L.night ? 0x0b1026 : floor.sky);
    scene.fog = L.night ? new T.Fog(0x0b1026, 22, 70) : new T.Fog(floor.sky, 40, 120);
    hemi.intensity = L.night ? 0.06 : 0.5;
    sun.intensity = L.night ? 0.05 : 0.62;
    spot.intensity = L.night ? 1.6 : 0;

    const S = L.size;
    const ground = new T.Mesh(new T.PlaneGeometry(S, S).rotateX(-PI / 2), groundMat({ map: H.groundTexture(L, maxAniso) }));
    ground.receiveShadow = true;
    ground.userData.own = true;
    world.add(ground);
    const outer = new T.Mesh(new T.PlaneGeometry(800, 800).rotateX(-PI / 2),
      groundMat(floor.outerTex === 'grass' ? { map: grassTexture() } : { color: floor.outer }));
    outer.position.y = -0.03;
    outer.receiveShadow = true;
    outer.userData.own = true;
    world.add(outer);
    const bm = new T.MeshPhongMaterial({ color: floor.border, flatShading: true });
    const th = 0.6, bh = floor.borderH || 0.4;
    [[0, S / 2 + th / 2, S + th * 2, th], [0, -S / 2 - th / 2, S + th * 2, th], [S / 2 + th / 2, 0, th, S], [-S / 2 - th / 2, 0, th, S]]
      .forEach(([x, z, w, d]) => {
        const m = new T.Mesh(new T.BoxGeometry(w, bh, d), bm);
        m.position.set(x, bh / 2, z);
        m.castShadow = m.receiveShadow = true;
        m.userData.own = true;
        world.add(m);
      });

    // 同種物件合併成一個 InstancedMesh（layout 也會把迷宮牆寫進 L.walls）
    const items = H.layout(L);
    G.wallMeshes = (L.walls || []).map(([x, z, w, d, color]) => {
      // 門：用鑰匙的顏色，比牆高一點
      const m = new T.Mesh(new T.BoxGeometry(w, color ? 1.4 : 1.1, d),
        color ? new T.MeshPhongMaterial({ color: KEY_COLOR[color], emissive: KEY_COLOR[color], emissiveIntensity: 0.25, flatShading: true }) : bm);
      m.position.set(x, color ? 0.7 : 0.55, z);
      m.castShadow = m.receiveShadow = true;
      m.userData.own = true;
      world.add(m);
      return m;
    });
    G.sinking = [];
    G.spins = (L.spinners || []).map(([x, z, r, speed]) => {
      const m = new T.Mesh(new T.CircleGeometry(r, 48).rotateX(-PI / 2), groundMat({ map: spinnerTexture() }));
      m.position.set(x, 0.015, z);
      m.receiveShadow = true;
      m.userData.own = true;
      world.add(m);
      return { x, z, r, speed, mesh: m, a: 0, c: 1, s: 0 };
    });
    G.edge = 1e9;
    G.barriers = [];
    if (L.shrink) {
      const mat = new T.MeshPhongMaterial({ color: 0xef4444, emissive: 0x7f1d1d, flatShading: true });
      for (let i = 0; i < 4; i++) {
        const m = new T.Mesh(new T.BoxGeometry(1, 0.8, 1), mat);
        m.castShadow = true;
        m.userData.own = true;
        world.add(m);
        G.barriers.push(m);
      }
    }
    const groups = new Map();
    items.forEach((p) => {
      const key = p.kind + '|' + (p.color || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    G.ents = [];
    G.ims = [];
    groups.forEach((list) => {
      const im = new T.InstancedMesh(H.getGeo(list[0].kind, list[0].color), H.objMat, list.length);
      im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      im.castShadow = true;
      im.frustumCulled = false;
      world.add(im);
      G.ims.push(im);
      list.forEach((p, i) => {
        const e = makeEntity(p, im, i);
        G.ents.push(e);
        writeMatrix(e);
      });
    });
    // 堆疊關係
    G.ents.forEach((e) => {
      if (e.pos.y > 0.01) {
        const sup = findSupport(e);
        e.supports = sup.list;
        sup.list.forEach((c) => c.above.push(e));
        if (!sup.list.length) e.state = 1; // 底下被擠掉的話就自己掉下來
      }
    });
    G.ents.forEach((e) => {
      const off = e.state === 0 && e.supports.length ? imbalance(e, e.supports) : null;
      if (off) startDrop(e, off);
    });

    G.goals = L.goals.map(([kind, need, color]) => ({
      kind, color: color || null, need, got: 0, label: kind === 'star' ? '星星點數' : H.labelOf(kind, color), img: H.thumb(kind, color),
    }));
    G.avoid = (L.avoid || []).map(([kind, color]) => ({
      kind, color: color || null, label: H.labelOf(kind, color), img: H.thumb(kind, color),
    }));
    G.ents.forEach((e) => {
      e.goal = G.goals.some((g) => match(e, g));
      e.spinner = G.spins.findIndex((s) => (e.pos.x - s.x) ** 2 + (e.pos.z - s.z) ** 2 < s.r * s.r);
    });
    G.goals.forEach((g) => {
      const big = G.ents.find((e) => e.base > 1 && match(e, g));
      if (big) g.label = (L.boss === g.kind ? '頭目：' : '') + (big.base >= 3 ? '超巨大' : big.base >= 1.8 ? '巨大' : '大') + g.label;
    });
    // 成長速度依每關物品總量自動校正：吃掉約八成物品時，黑洞大約升到第 9 級
    // 成長點數：吃掉約八成物品時大約升到第 9 級；第 n 級升下一級需要 xpUnit × n 點
    const totalPts = G.ents.reduce((sum, e) => sum + starPts(e), 0);
    G.xpUnit = Math.max(2, Math.round((totalPts * 0.8) / 36));
    // 自動生成的關卡：成長速度已在 levels.js 逐層校正好（每層要先吃掉比它小的東西約六成）
    if (L.xpUnit) G.xpUnit = L.xpUnit;

    hole.pos.set(L.start[0], 0, L.start[1]);
    hole.acc.set(0, 0);
    hole.area = L.holeR * L.holeR;
    hole.xp = 0;
    hole.size = 1;
    hole.prog = 0;
    hole.r = hole.vis = L.holeR;
    ringShown = -1;
    setRing(0);
    G.time = G.total = L.time;
    G.shownSec = -1;
    G.score = 0;
    G.popPts = 0;
    G.popGood = false;
    G.combo = 0;
    G.lastEat = -9;
    G.slow = 0;
    G.falling = 0;
    G.shake = 0;
    for (const k in G.boosts) G.boosts[k] = 0;
    G.half = S / 2;
    G.moved = false;
    updateHoleMesh(0, true);
  }

  // ---------- 主迴圈 ----------
  const clock = new T.Clock();
  function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(clock.getDelta(), 0.05);
    if (G.slow > 0) {
      G.slow -= dt;
      dt *= 0.3;
    }
    G.t += dt;
    if (G.state === 'playing') updatePlay(dt);
    if (G.state !== 'paused') updateEnts(dt, G.state === 'playing');
    for (const im of G.ims) {
      if (im.userData.dirty) {
        im.instanceMatrix.needsUpdate = true;
        im.userData.dirty = false;
      }
    }
    updateHoleMesh(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  // ---------- 操作 ----------
  let drag = null;
  const keys = {};
  canvas.addEventListener('pointerdown', (e) => {
    A.unlock();
    if (G.state !== 'playing') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (save.ctrl !== 'drag') joyStart(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const px = drag.x, py = drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (G.state !== 'playing') return;
    if (save.ctrl !== 'drag') {
      joyMove(e.clientX, e.clientY);
      return;
    }
    // 以「黑洞在螢幕上的位置」換算：把手指位移套在黑洞的螢幕座標上，再投影回地面。
    // 這樣黑洞在螢幕上走的方向＝手指方向，不會因為手指在螢幕上下不同位置（透視比例不同）而偏斜。
    const sens = speedMul() * 0.8 * growSpeed();
    const s = screenOf(hole.pos.x, 0, hole.pos.z);
    const fx = (e.clientX - px) * sens, fy = (e.clientY - py) * sens;
    if (!groundAt(s.x, s.y, _ga) || !groundAt(s.x + fx, s.y + fy, _gb)) return;
    let dx = _gb.x - _ga.x, dz = _gb.z - _ga.z;
    const d = Math.hypot(dx, dz);
    if (d > 3) { dx *= 3 / d; dz *= 3 / d; } // 防止單次事件跳太遠
    // 直接套用，不經過緩衝佇列，轉彎時不會新舊方向混在一起
    moveHole(dx, dz);
    if (!G.moved && Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 2) hideHint();
  });
  // 放開手指的事件掛在整個視窗：手指在按鈕或介面上放開時也收得到，搖桿不會卡住
  ['pointerup', 'pointercancel'].forEach((t) =>
    window.addEventListener(t, (e) => {
      if (drag && e.pointerId === drag.id) {
        drag = null;
        joyEnd();
      }
    }));
  ['lostpointercapture'].forEach((t) =>
    canvas.addEventListener(t, (e) => {
      if (drag && e.pointerId === drag.id) {
        drag = null;
        joyEnd();
      }
    }));

  // ---------- 虛擬搖桿：按住螢幕任一處，往哪推就往哪跑，推越遠跑越快 ----------
  const JOY_R = 56, JOY_DEAD = 0.12;
  const joy = { active: false, cx: 0, cy: 0, vx: 0, vy: 0 };
  function joyStart(x, y) {
    joy.active = true;
    joy.cx = x;
    joy.cy = y;
    joy.vx = joy.vy = 0;
    const el = $('joy');
    el.classList.add('active');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('joyKnob').style.transform = 'translate(-50%, -50%)';
  }
  function joyMove(x, y) {
    if (!joy.active) return;
    let dx = x - joy.cx, dy = y - joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) {
      // 手指推超過搖桿範圍時，搖桿底座跟著手指移動，方向立刻跟上
      joy.cx += (dx / d) * (d - JOY_R);
      joy.cy += (dy / d) * (d - JOY_R);
      dx = x - joy.cx;
      dy = y - joy.cy;
      $('joy').style.left = joy.cx + 'px';
      $('joy').style.top = joy.cy + 'px';
    }
    joy.vx = dx / JOY_R;
    joy.vy = dy / JOY_R;
    $('joyKnob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function joyEnd() {
    joy.active = false;
    joy.vx = joy.vy = 0;
    const el = $('joy');
    el.classList.remove('active');
    el.style.left = el.style.top = '';
    $('joyKnob').style.transform = 'translate(-50%, -50%)';
  }
  function joyStep(dt) {
    if (joy.active && !drag) joyEnd(); // 保險：手指已放開但搖桿還亮著
    const mag = Math.hypot(joy.vx, joy.vy);
    if (!joy.active || mag < JOY_DEAD) return;
    const m = Math.min(1, (mag - JOY_DEAD) / (1 - JOY_DEAD));
    // 方向一樣以黑洞在螢幕上的位置換算回地面，畫面上看到的方向＝搖桿方向
    const s = screenOf(hole.pos.x, 0, hole.pos.z);
    if (!groundAt(s.x, s.y, _ga) || !groundAt(s.x + (joy.vx / mag) * 60, s.y + (joy.vy / mag) * 60, _gb)) return;
    let dx = _gb.x - _ga.x, dz = _gb.z - _ga.z;
    const l = Math.hypot(dx, dz) || 1;
    // 速度跟鏡頭高度成正比：黑洞變大、鏡頭拉遠後，在畫面上的速度感維持一致
    const speed = camPos.y * H.SPEED_K * speedMul() * growSpeed() * m;
    moveHole((dx / l) * speed * dt, (dz / l) * speed * dt);
    if (!G.moved) hideHint();
  }

  // 移動黑洞：每段最多 0.25，逐段把黑洞推出迷宮牆，快速拖曳也不會穿牆
  function moveHole(dx, dz) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25));
    for (let i = 0; i < n; i++) {
      hole.pos.x += dx / n;
      hole.pos.z += dz / n;
      clampHole();
    }
  }
  function clampHole() {
    // 黑洞可以有一半超出場地邊緣／壓到牆下，貼邊、角落、牆角的東西才不會因為洞太大而吃不到
    const lim = Math.max(0, Math.min(G.half, G.edge) - hole.vis * 0.5 - 0.1);
    hole.pos.x = Math.max(-lim, Math.min(lim, hole.pos.x));
    hole.pos.z = Math.max(-lim, Math.min(lim, hole.pos.z));
    const W = G.L.walls;
    if (!W || !W.length) return;
    const r = hole.vis * 0.5;
    for (const [wx, wz, ww, wd] of W) {
      const cx = Math.max(wx - ww / 2, Math.min(wx + ww / 2, hole.pos.x));
      const cz = Math.max(wz - wd / 2, Math.min(wz + wd / 2, hole.pos.z));
      const ex = hole.pos.x - cx, ez = hole.pos.z - cz, d = Math.hypot(ex, ez);
      if (d >= r) continue;
      if (d > 1e-4) {
        hole.pos.x += (ex / d) * (r - d);
        hole.pos.z += (ez / d) * (r - d);
      } else if (ww < wd) hole.pos.x = wx + Math.sign(hole.pos.x - wx || 1) * (ww / 2 + r);
      else hole.pos.z = wz + Math.sign(hole.pos.z - wz || 1) * (wd / 2 + r);
    }
  }
  // 洞中心到物品之間有沒有隔著牆（迷宮：不能隔牆吃東西）
  function wallBetween(ax, az, bx, bz) {
    for (const [wx, wz, ww, wd] of G.L.walls || []) {
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dz = bz - az;
      for (const [p, d, lo, hi] of [[ax, dx, wx - ww / 2, wx + ww / 2], [az, dz, wz - wd / 2, wz + wd / 2]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
        let a = (lo - p) / d, b = (hi - p) / d;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) break;
      }
      if (t0 <= t1) return true;
    }
    return false;
  }
  const inWall = (x, z, r) => (G.L.walls || []).some(([wx, wz, ww, wd]) => Math.abs(x - wx) < ww / 2 + r && Math.abs(z - wz) < wd / 2 + r);
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'playing') pause();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; drag = null; joyEnd(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') pause(); });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  const raycaster = new T.Raycaster(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const _ndc = new T.Vector2(), _ga = new T.Vector3(), _gb = new T.Vector3();
  function groundAt(x, y, out) {
    _ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(_ndc, camera);
    return raycaster.ray.intersectPlane(groundPlane, out);
  }

  function hideHint() {
    G.moved = true;
    $('dragHint').classList.add('off');
  }

  // ---------- 每幀：遊戲中 ----------
  function updatePlay(dt) {
    if (!(G.boosts.freeze > 0)) G.time -= dt; // 冰凍時間道具：倒數暫停
    const sec = Math.max(0, Math.ceil(G.time));
    if (sec !== G.shownSec) {
      G.shownSec = sec;
      showTimer();
      if (sec <= 10 && sec > 0) A.tick();
    }
    if (G.time <= 0) {
      G.time = 0;
      lose();
      return;
    }
    if (G.L.shrink) {
      const S = G.L.shrink, f = 1 - G.time / G.total;
      const k = Math.max(0, Math.min(1, (f - S.t0) / (S.t1 - S.t0)));
      G.edge = G.half * (1 - (1 - S.to) * k);
      const e = G.edge, len = e * 2 + 0.6;
      [[0, -e - 0.25, len, 0.5], [0, e + 0.25, len, 0.5], [-e - 0.25, 0, 0.5, len], [e + 0.25, 0, 0.5, len]].forEach(([x, z, w, d], i) => {
        G.barriers[i].position.set(x, 0.4, z);
        G.barriers[i].scale.set(w, 1, d);
      });
    }
    for (let i = G.sinking.length - 1; i >= 0; i--) {
      const m = G.sinking[i];
      m.position.y -= dt * 2.2;
      if (m.position.y < -1.6) { world.remove(m); G.sinking.splice(i, 1); }
    }

    for (const k in G.boosts) {
      if (G.boosts[k] > 0) {
        G.boosts[k] = Math.max(0, G.boosts[k] - dt);
        if (!G.boosts[k]) refreshBoosters();
      }
    }
    updateBoostRings();

    joyStep(dt);
    // 鍵盤
    const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const kz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (kx || kz) {
      const l = Math.hypot(kx, kz), sp = (2.8 + hole.r * 1.2) * speedMul() * growSpeed() * dt;
      moveHole((kx / l) * sp, (kz / l) * sp);
      if (!G.moved) hideHint();
    }
    // 拖曳累積量 → 平滑移動（限制最高速度）
    const len = hole.acc.length();
    if (len > 0.0001) {
      const step = Math.min(len, (16 + hole.r * 5) * dt);
      moveHole((hole.acc.x / len) * step, (hole.acc.y / len) * step);
      hole.acc.multiplyScalar((len - step) / len);
      if (hole.acc.length() > 1.2) hole.acc.setLength(1.2); // 手指停下後不再滑太遠
    }
    clampHole(); // 黑洞變大時也要推離牆邊
  }

  function updateHoleMesh(dt, snap) {
    const target = hole.r * (G.boosts.grow > 0 ? 1.45 : 1);
    hole.vis = snap ? target : hole.vis + (target - hole.vis) * Math.min(1, dt * 5);
    holeGroup.position.set(hole.pos.x, 0, hole.pos.z);
    holeGroup.scale.set(hole.vis, 1, hole.vis);
    rimGroup.position.set(hole.pos.x, 0, hole.pos.z);
    rimGroup.scale.setScalar(hole.vis);
    if (G.boosts.grow > 0) rim.material.color.set(0xc9b2ff);
    else if (G.boosts.magnet > 0) rim.material.color.set(0xffe082);
    else {
      const sk = skinOf(save.skin);
      if (sk.anim === 'rainbow') rim.material.color.setHSL((G.t * 0.15) % 1, 0.85, 0.6);
      else if (sk.anim === 'fire') rim.material.color.setHSL(0.06 + Math.sin(G.t * 5) * 0.03, 1, 0.55);
      else rim.material.color.set(sk.color);
    }
    if (spot.intensity > 0) {
      spot.position.set(hole.pos.x, 10, hole.pos.z + 0.01);
      spot.target.position.set(hole.pos.x, 0, hole.pos.z);
      spot.angle = Math.atan((hole.vis * 1.8 + 3.2) / 10); // 照亮範圍跟著黑洞變大
    }
    setRing(hole.prog);
    const showTime = G.state === 'playing' || G.state === 'paused' || G.state === 'intro';
    timeTrack.visible = timeArc.visible = showTime;
    if (showTime) setTimeRing(G.total ? G.time / G.total : 1);
    if (fxT > 0) {
      fxT = Math.max(0, fxT - dt);
      const k = 1 - fxT / 0.7;
      levelFx.scale.setScalar(1 + k * 1.4);
      levelFx.material.opacity = (1 - k) * 0.9;
    }
    // 黑洞下方的「Size N」標籤
    const lab = $('sizeLabel');
    if (G.state === 'playing' || G.state === 'intro' || G.state === 'won') {
      const sp = screenOf(hole.pos.x, 0, hole.pos.z + hole.vis * 1.42);
      lab.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -50%)`;
      lab.textContent = hole.prog >= 1 && radiusOf(hole.size + 1) > (G.L.maxR || G.half * 0.3)
        ? `等級 ${hole.size}｜最大`
        : `等級 ${hole.size}｜還差 ${Math.max(0, xpNeed(hole.size) - hole.xp)} 分`;
      lab.classList.remove('hidden');
    } else lab.classList.add('hidden');
    // 黑洞上方的倒數時間
    const tl = $('timeLabel');
    if (G.state === 'playing' || G.state === 'intro') {
      const sp = screenOf(hole.pos.x, 0, hole.pos.z - hole.vis * 1.75);
      const sec = Math.max(0, Math.ceil(G.time));
      tl.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%, -50%)`;
      tl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      tl.classList.toggle('warn', sec <= 10);
      tl.classList.remove('hidden');
    } else tl.classList.add('hidden');
  }

  // ---------- 黑洞等級（Size）：吃東西累積面積，滿了就升一級，半徑跳大一階 ----------
  function radiusOf(n) {
    return G.L.holeR * (1 + SIZE_STEP * (n - 1));
  }
  const xpNeed = (n) => G.xpUnit * n;
  function updateSize() {
    const maxR = G.L.maxR || G.half * 0.3;
    let up = false;
    while (radiusOf(hole.size + 1) <= maxR && hole.xp >= xpNeed(hole.size)) {
      hole.xp -= xpNeed(hole.size);
      hole.size++;
      up = true;
    }
    if (up) {
      fxT = 0.7;
      A.levelUp();
      vibrate(25);
    }
    hole.r = radiusOf(hole.size);
    hole.prog = radiusOf(hole.size + 1) > maxR ? 1 : Math.max(0, Math.min(1, hole.xp / xpNeed(hole.size)));
  }

  // ---------- 物件：堆疊 ----------
  function findSupport(e) {
    let best = 0, list = [];
    const ey = e.pos.y + 0.06;
    for (const c of G.ents) {
      if (c === e || c.state !== 0) continue;
      const top = c.pos.y + c.h;
      if (top > ey) continue;
      const dx = c.pos.x - e.pos.x, dz = c.pos.z - e.pos.z, lim = (c.r + e.r) * 0.8;
      if (dx * dx + dz * dz > lim * lim) continue;
      if (top > best + 0.05) { best = top; list = [c]; }
      else if (top > best - 0.05) list.push(c);
    }
    return { y: best, list };
  }

  // 物件離開原位（掉進洞）時：通知壓在它上面的物件
  function release(e) {
    for (const s of e.supports) {
      const i = s.above.indexOf(e);
      if (i >= 0) s.above.splice(i, 1);
    }
    e.supports.length = 0;
    unstack(e);
  }

  // 支撐點的重心偏離物件中心太多 → 不穩，回傳要滑落的方向
  function imbalance(e, list) {
    if (!list.length) return null;
    let cx = 0, cz = 0;
    for (const s of list) { cx += s.pos.x; cz += s.pos.z; }
    cx /= list.length;
    cz /= list.length;
    const dx = e.pos.x - cx, dz = e.pos.z - cz, d = Math.hypot(dx, dz);
    return d > e.r * 0.6 ? { x: dx / d, z: dz / d } : null;
  }

  function startDrop(d, slide) {
    for (const s of d.supports) {
      const i = s.above.indexOf(d);
      if (i >= 0) s.above.splice(i, 1);
    }
    d.supports = [];
    d.state = 1;
    d.vy = 0;
    d.slide = slide;
    unstack(d);
  }

  // e 不再能撐住上面的東西：失去支撐或重心不穩的物件開始往下掉（連鎖）
  function unstack(e) {
    const list = e.above.slice();
    e.above.length = 0;
    for (const d of list) {
      const i = d.supports.indexOf(e);
      if (i >= 0) d.supports.splice(i, 1);
      if (d.state !== 0) continue;
      if (!d.supports.length) startDrop(d, null);
      else {
        const off = imbalance(d, d.supports);
        if (off) startDrop(d, off);
      }
    }
  }

  function dropStep(e, dt) {
    const sup = findSupport(e);
    e.vy -= GRAVITY * dt;
    e.pos.y += e.vy * dt;
    if (e.slide) {
      e.pos.x += e.slide.x * 2.2 * dt;
      e.pos.z += e.slide.z * 2.2 * dt;
      e.tilt = Math.min(0.6, e.tilt + dt * 3);
      e.axis.set(e.slide.z, 0, -e.slide.x);
    }
    if (e.pos.y <= sup.y) {
      const off = sup.list.length ? imbalance(e, sup.list) : null;
      if (off && sup.y > 0) {
        e.slide = off; // 落點不穩，繼續滑下去
      } else {
        e.pos.y = sup.y;
        e.vy = 0;
        e.state = 0;
        e.slide = null;
        e.tilt = 0;
        e.supports = sup.list;
        sup.list.forEach((c) => c.above.push(e));
      }
    }
    writeMatrix(e);
  }

  // ---------- 物件：走動 ----------
  function walk(e, dt) {
    const w = e.walk, p = e.pos;
    const dxh = p.x - hole.pos.x, dzh = p.z - hole.pos.z, dh = Math.hypot(dxh, dzh);
    const flee = G.state === 'playing' && dh < hole.vis + (G.L.flee ? 3.6 : 2.2); // 追逐關：更早發現黑洞
    w.t -= dt;
    if (flee) {
      w.dir = Math.atan2(dxh, dzh) + (Math.random() - 0.5) * 0.6;
      w.pause = false;
    } else if (w.t <= 0) {
      w.t = 1.5 + Math.random() * 3;
      w.dir = Math.random() * PI * 2;
      w.pause = Math.random() < 0.25;
    }
    if (w.pause) return;
    const sp = w.speed * (flee ? 2 * (G.L.flee || 1) : 1);
    const nx = p.x + Math.sin(w.dir) * sp * dt, nz = p.z + Math.cos(w.dir) * sp * dt;
    const lim = G.half - e.r - 0.3;
    if (Math.abs(nx) > lim || Math.abs(nz) > lim || inWall(nx, nz, e.r * 0.8)) {
      w.dir += PI * (0.5 + Math.random());
      return;
    }
    p.x = nx;
    p.z = nz;
    e.yaw = w.dir;
    e.bob = Math.abs(Math.sin(G.t * (flee ? 15 : 9) + w.ph)) * 0.06;
    e.dirty = true;
  }

  // ---------- 物件：掉進洞 ----------
  // 掉進洞的任務物如果剛好是最後一個，就開慢動作
  function lastGoalCheck(e) {
    e.counting = true;
    G.falling = (G.falling || 0) + 1;
    const left = G.goals.reduce((t, g) => t + (g.kind === 'star' ? 0 : Math.max(0, g.need - g.got)), 0);
    if (left > 0 && left <= G.falling && !G.goals.some((g) => g.kind === 'star')) G.slow = 1.3;
  }

  function startFall(e, dx, dz, d) {
    release(e);
    e.state = 2;
    e.vy = 0;
    // 掉進洞時帶一點往洞中心滑的速度
    e.vx = d > 0.001 ? (dx / d) * 1.2 : 0;
    e.vz = d > 0.001 ? (dz / d) * 1.2 : 0;
    e.bob = 0;
    e.spin = 2.5 + Math.random() * 3;
    if (d > 0.001) e.axis.set(dz / d, 0, -dx / d);
    else e.axis.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  }

  // 掉進洞的物理：東西在洞裡有自己的速度，被洞壁擋住、推著走。
  // 長條形的東西（有 w）要轉到立起來才變窄；洞移動很快時刮著洞壁掉得慢，看起來像卡在邊緣；比洞口還寬就卡在洞口
  function fallStep(e, dt) {
    const p = e.pos, R = hole.vis;
    e.vy -= GRAVITY * dt;
    let rx = p.x - hole.pos.x, rz = p.z - hole.pos.z, d = Math.hypot(rx, rz) || 1e-4;
    e.vx += (-rx / d) * 4 * dt;
    e.vz += (-rz / d) * 4 * dt;
    const damp = Math.max(0, 1 - dt * 2);
    e.vx *= damp;
    e.vz *= damp;
    p.x += e.vx * dt;
    p.z += e.vz * dt;
    const long = !!e.def.w;
    e.tilt = Math.min(e.tilt + dt * e.spin * (long ? 0.6 : 1), 1.9);
    const tk = Math.min(1, e.tilt / 1.5);
    const ext = long ? e.r * (1 - 0.75 * tk) + e.def.w * e.base * tk : e.r * 0.85;
    rx = p.x - hole.pos.x; rz = p.z - hole.pos.z; d = Math.hypot(rx, rz) || 1e-4;
    const room = R - ext;
    const hvx = G.hvx || 0, hvz = G.hvz || 0, hs = Math.hypot(hvx, hvz);
    if (room <= 0.02) {
      // 比洞口還寬：卡在洞口，跟著洞被拖著走，等轉到立起來才掉下去
      p.x += hvx * dt;
      p.z += hvz * dt;
      e.vy = Math.max(e.vy, 0);
      p.y = Math.max(p.y, -0.12);
    } else if (d > room) {
      // 碰到洞壁：被推回洞裡（跟著洞走），朝外的速度抵銷
      p.x = hole.pos.x + (rx / d) * room;
      p.z = hole.pos.z + (rz / d) * room;
      const vn = (e.vx * rx + e.vz * rz) / d;
      if (vn > 0) { e.vx -= (vn * rx) / d; e.vz -= (vn * rz) / d; }
      // 刮著洞壁：洞跑越快、東西越長，掉得越慢
      const lim = long ? Math.max(0.25, 3.5 - hs * 0.7) : Math.max(1.5, 8 - hs);
      e.vy = Math.max(e.vy, -lim);
    }
    p.y += e.vy * dt;
    e.scale = Math.max(0.35, 1 + p.y * 0.1);
    const gone = p.y < -(e.h * 0.8 + 1);
    if (gone) {
      e.scale = 0;
      e.state = 3;
    }
    writeMatrix(e);
    return gone;
  }

  function goalOpen(e) {
    const cur = curGoal();
    for (let i = 0; i < G.goals.length; i++) {
      const g = G.goals[i];
      if (g.got < g.need && match(e, g) && (cur < 0 || i === cur)) return true;
    }
    return false;
  }
  // 順序關：目前要吃的是第幾項（一般關回傳 -1）
  const curGoal = () => (G.L.ordered ? G.goals.findIndex((g) => g.got < g.need) : -1);
  // 順序關裡還沒輪到的任務物：吞不下，會卡在洞口晃
  const lockedGoal = (e, cur) => cur >= 0 && e.goal && !match(e, G.goals[cur]) &&
    G.goals.some((g, i) => i > cur && g.got < g.need && match(e, g));

  function updateEnts(dt, canEat) {
    const R = hole.vis, hx = hole.pos.x, hz = hole.pos.z;
    const magnet = canEat && G.boosts.magnet > 0;
    const cur = curGoal();
    if (dt > 0) {
      G.hvx = (hole.pos.x - (G.hpx ?? hole.pos.x)) / dt;
      G.hvz = (hole.pos.z - (G.hpz ?? hole.pos.z)) / dt;
    }
    G.hpx = hole.pos.x;
    G.hpz = hole.pos.z;
    for (const s of G.spins || []) {
      s.a = s.speed * dt;
      s.c = Math.cos(s.a);
      s.s = Math.sin(s.a);
      s.mesh.rotation.y += s.a;
    }
    const edge = G.edge;
    let removed = false;
    for (let i = 0; i < G.ents.length; i++) {
      const e = G.ents[i];
      if (e.state === 3) continue;
      if (e.state === 2) {
        if (fallStep(e, dt)) {
          removed = true;
          eaten(e);
        }
        continue;
      }
      if (e.state === 4) {
        // 縮圈：被擠出場外，往外掉下去
        e.vy -= GRAVITY * dt;
        e.pos.y += e.vy * dt;
        e.pos.x += e.off.x * dt * 2.5;
        e.pos.z += e.off.z * dt * 2.5;
        e.tilt = Math.min(e.tilt + dt * 3, 1.6);
        if (e.pos.y < -4) { e.scale = 0; e.state = 3; }
        writeMatrix(e);
        continue;
      }
      if (e.state === 1) {
        dropStep(e, dt);
        continue;
      }
      const p = e.pos;
      // 旋轉盤上的東西跟著轉
      if (e.spinner >= 0) {
        const s = G.spins[e.spinner], ox = p.x - s.x, oz = p.z - s.z;
        if (ox * ox + oz * oz < s.r * s.r) {
          p.x = s.x + ox * s.c + oz * s.s;
          p.z = s.z - ox * s.s + oz * s.c;
          e.yaw += s.a;
          writeMatrix(e);
        }
      }
      // 縮圈：任務物被推往中間，其他東西被擠出場外
      if (edge < G.half) {
        const lim = edge - e.r * 0.6;
        if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) {
          if (e.goal) {
            p.x = Math.max(-lim, Math.min(lim, p.x));
            p.z = Math.max(-lim, Math.min(lim, p.z));
            writeMatrix(e);
          } else {
            release(e);
            e.state = 4;
            e.vy = 1.2;
            e.off = { x: Math.abs(p.x) > lim ? Math.sign(p.x) : 0, z: Math.abs(p.z) > lim ? Math.sign(p.z) : 0 };
            e.axis.set(e.off.z || 0.01, 0, -e.off.x);
            continue;
          }
        }
      }
      const grounded = p.y < 0.05 && e.supports.length === 0;
      if (!grounded) continue;
      if (e.walk) walk(e, dt);
      let dx = hx - p.x, dz = hz - p.z, d = Math.hypot(dx, dz);
      if (magnet && e.goal && !e.above.length && d < R * 3 + 7 && d > 0.05 && e.r <= R * 0.95 && goalOpen(e)) {
        const s = Math.min(d, (5 + R * 2) * dt);
        const nx = p.x + (dx / d) * s, nz = p.z + (dz / d) * s;
        if (!inWall(nx, nz, e.r * 0.6)) { p.x = nx; p.z = nz; }
        dx = hx - p.x; dz = hz - p.z; d = Math.hypot(dx, dz);
        e.dirty = true;
      }
      const locked = lockedGoal(e, cur) || (G.L.walls.length > 0 && d < R + e.r && wallBetween(hx, hz, p.x, p.z));
      if (canEat && !locked && e.r <= R * 0.95 && d <= Math.max(R - e.r * 0.4, R * 0.35)) {
        startFall(e, dx, dz, d);
        if (e.goal && goalOpen(e)) lastGoalCheck(e);
        continue;
      }
      // 壓在洞口邊緣：往洞口傾斜；太大的東西會卡著晃動
      let tt = 0;
      const reach = R + e.r * 0.7;
      if (canEat && d < reach && d > 0.001 && !e.above.length) {
        const f = Math.min(1, (reach - d) / (e.r * 1.4));
        const fits = !locked && e.r <= R * 0.95;
        tt = f * (fits ? 0.45 : 0.18) + (fits ? 0 : Math.sin(G.t * 26 + i) * 0.045 * f);
        e.axis.set(dz / d, 0, -dx / d);
      }
      if (tt || e.tilt) {
        e.tilt += (tt - e.tilt) * Math.min(1, dt * 12);
        if (!tt && Math.abs(e.tilt) < 0.002) e.tilt = 0;
        e.dirty = true;
      }
      if (e.dirty) {
        writeMatrix(e);
        e.dirty = false;
      }
    }
    if (removed && G.ents.length > 50) {
      // 偶爾清掉已消失的物件，讓迴圈變短（InstancedMesh 的 index 不受影響）
      if (G.ents.filter((x) => x.state === 3).length > 40) G.ents = G.ents.filter((x) => x.state !== 3);
    }
  }

  // 吃到東西：加成長點數（越大的東西越多分），同時也是本局分數
  function grow(e) {
    hole.xp += starPts(e);
    updateSize();
  }

  let popTimer = 0;
  function addScore(pts, good) {
    G.score += pts;
    const el = $('hudScore');
    el.textContent = G.score;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
    // 一口氣吃很多時合併成一個 +分 跳字，避免畫面塞滿
    G.popPts += pts;
    G.popGood = G.popGood || good;
    if (!popTimer) {
      popTimer = setTimeout(() => {
        popTimer = 0;
        if (G.popPts > 0) popup('+' + G.popPts, G.popGood ? 'good' : 'score');
        G.popPts = 0;
        G.popGood = false;
      }, 110);
    }
  }

  function eaten(e) {
    if (e.counting) { e.counting = false; G.falling = Math.max(0, G.falling - 1); }
    if (G.state !== 'playing') return;
    G.combo = G.t - G.lastEat < 1.0 ? G.combo + 1 : 0;
    G.lastEat = G.t;
    dexAdd(e.kind);
    if (e.kind === 'key') openDoor(e.color);
    const gi = G.goals.findIndex((g) => g.got < g.need && match(e, g));
    if (gi >= 0) {
      const g = G.goals[gi];
      g.got = Math.min(g.need, g.got + (g.kind === 'star' ? starPts(e) : 1));
      grow(e);
      A.pop(G.combo);
      addScore(starPts(e), true);
      // 連吃獎勵：每連吃 25 個（每個間隔不到 1 秒）加 1 秒
      if ((G.combo + 1) % 25 === 0) {
        G.time += 1;
        popup('連吃 ×' + (G.combo + 1) + '　+1 秒', 'combo', 46);
        bumpTimer('bump-good');
      } else if (G.combo >= 4 && G.combo % 5 === 4) popup('連吃 ×' + (G.combo + 1), 'combo', 46);
      updateGoal(gi);
      if (G.L.boss === e.kind && e.base > 1) {
        popup('打倒頭目！', 'combo', 60);
        G.shake = 0.9;
        vibrate([40, 30, 80]);
      }
      if (G.L.ordered) G.goals.forEach((x, i) => updateLock(i));
      vibrate(10);
      if (G.goals.every((x) => x.got >= x.need)) win();
      return;
    }
    if (G.avoid.some((a) => match(e, a))) {
      penalty(e);
      return;
    }
    grow(e);
    A.gulp(G.combo);
    addScore(starPts(e), false);
  }

  // 鑰匙迷宮：開同色的門（門會往下沉）
  function openDoor(color) {
    let opened = false;
    for (let i = G.L.walls.length - 1; i >= 0; i--) {
      if (G.L.walls[i][4] !== color) continue;
      G.L.walls.splice(i, 1);
      G.sinking.push(G.wallMeshes.splice(i, 1)[0]);
      opened = true;
    }
    if (opened) {
      popup('門打開了！', 'combo', 60);
      A.levelUp();
      vibrate([20, 30, 20]);
    }
  }

  // 物品圖鑑：第一次吃到某種東西就收進圖鑑，每收集 10 種送 50 金幣
  function dexAdd(kind) {
    save.dex = save.dex || {};
    const fresh = !save.dex[kind];
    save.dex[kind] = (save.dex[kind] || 0) + 1;
    if (!fresh) return;
    const n = Object.keys(save.dex).length;
    popup('新收藏：' + H.KINDS[kind].name, 'info', -40);
    if (n % 10 === 0) {
      setCoins(save.coins + 50, true);
      setTimeout(() => popup(`圖鑑 ${n} 種！+50 金幣`, 'combo', 80), 600);
    }
    persist();
  }

  function penalty(e) {
    const bomb = e.kind === 'bomb';
    const sec = bomb ? 8 : 5;
    G.time = Math.max(0.01, G.time - sec);
    G.combo = 0;
    if (bomb) {
      hole.xp = Math.max(0, hole.xp - Math.ceil(xpNeed(hole.size) * 0.5)); // 炸彈：扣掉一半升級進度
      updateSize();
      A.boom();
    } else {
      A.bad();
    }
    popup('-' + sec + ' 秒', 'bad');
    G.shake = bomb ? 0.7 : 0.4;
    flash();
    bumpTimer('bump-bad');
    vibrate([60, 40, 60]);
  }

  // ---------- 相機 ----------
  function camHeight() {
    const a = camera.aspect;
    const base = (7 + hole.vis * 5.5) * (G.boosts.zoom > 0 ? 1.5 : 1) * (G.slow > 0 ? 0.75 : 1); // 放大鏡道具：視野拉遠；最後一個慢動作：拉近
    return base * (a < 0.7 ? 1.5 : a < 1 ? 1.3 : a < 1.3 ? 1.12 : 1);
  }

  function camTarget(out, look) {
    if (G.state === 'menu') {
      const d = Math.min(G.L.size * 0.5, 20) * (camera.aspect < 1 ? 1.3 : 1);
      out.set(Math.sin(G.orbit) * d, d * 0.95, Math.cos(G.orbit) * d);
      look.set(0, 0, 0);
      return d * 1.3;
    }
    const h = camHeight();
    out.set(hole.pos.x, h, hole.pos.z + h * 0.45);
    look.set(hole.pos.x, 0, hole.pos.z - h * 0.05);
    return h;
  }

  function updateCamera(dt, snap) {
    if (G.state === 'menu') G.orbit += dt * 0.1;
    const h = camTarget(_v, _w);
    const k = snap ? 1 : 1 - Math.exp(-dt * 6);
    camPos.lerp(_v, k);
    camLook.lerp(_w, k);
    if (G.state !== 'menu') {
      // 遊戲中鏡頭水平方向緊貼黑洞（只有高度平滑變化），黑洞固定在畫面同一處，手感才準
      camPos.x = camLook.x = hole.pos.x;
      camPos.z = hole.pos.z + camPos.y * 0.45;
      camLook.z = hole.pos.z - camPos.y * 0.05;
    }
    camera.position.copy(camPos);
    if (G.shake > 0) {
      G.shake = Math.max(0, G.shake - dt);
      const s = G.shake * 0.6;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    camera.lookAt(camLook);
    // 陰影相機跟著鏡頭
    sun.position.set(camLook.x + 9, 26, camLook.z + 7);
    sun.target.position.copy(camLook);
    const ext = Math.ceil(h * 1.05 + 5);
    if (ext !== shadowExt) {
      shadowExt = ext;
      const c = sun.shadow.camera;
      c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext;
      c.updateProjectionMatrix();
    }
    if (scene.fog) {
      const dist = camera.position.distanceTo(camLook);
      scene.fog.near = dist * 1.4;
      scene.fog.far = dist * 3.4;
    }
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? 46 : 40;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---------- 特效 ----------
  function screenOf(x, y, z) {
    _v.set(x, y, z).project(camera);
    return { x: ((_v.x + 1) / 2) * window.innerWidth, y: ((1 - _v.y) / 2) * window.innerHeight };
  }

  function popup(text, cls, dy) {
    const s = screenOf(hole.pos.x, 0, hole.pos.z - hole.vis);
    const el = document.createElement('div');
    el.className = 'popup ' + (cls || '');
    el.textContent = text;
    el.style.left = s.x + (Math.random() - 0.5) * 30 + 'px';
    el.style.top = s.y - 20 - (dy || 0) + 'px';
    $('fx').appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function banner(text) {
    const el = document.createElement('div');
    el.className = 'banner';
    el.textContent = text;
    $('fx').appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function flash() {
    const f = $('flash');
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  function bumpTimer(cls) {
    const t = $('hudTimerWrap');
    t.classList.remove('bump-bad', 'bump-good');
    void t.offsetWidth;
    t.classList.add(cls);
    setTimeout(() => t.classList.remove(cls), 450);
  }

  function vibrate(p) {
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ }
  }

  // ---------- HUD ----------
  function renderGoals() {
    const html = G.goals.map((g, i) =>
      `<div class="goal" id="goal${i}"><img src="${g.img}" alt="${g.label}"><b>${g.need - g.got}</b><i class="check">✓</i><i class="lock">🔒</i></div>`
    ).concat(G.avoid.map((a) =>
      `<div class="goal avoid"><img src="${a.img}" alt="${a.label}"><span class="no-sign"></span><b>別吃</b></div>`
    ));
    $('hudGoals').innerHTML = html.join('');
    G.goals.forEach((g, i) => updateLock(i));
  }
  function updateLock(i) {
    const el = $('goal' + i), cur = curGoal();
    if (el) el.classList.toggle('locked', cur >= 0 && i > cur);
  }

  function updateGoal(i) {
    const g = G.goals[i], el = $('goal' + i);
    if (!el) return;
    el.querySelector('b').textContent = Math.max(0, g.need - g.got);
    el.classList.toggle('done', g.got >= g.need);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function setCoins(v, bump) {
    save.coins = v;
    persist();
    $('menuCoins').textContent = v;
    if (bump) {
      document.querySelectorAll('.coin-pill').forEach((p) => {
        p.classList.remove('bump');
        void p.offsetWidth;
        p.classList.add('bump');
      });
    }
    refreshBoosters();
  }

  // 計時器：分:秒＋下方時間條（綠 → 黃 → 紅）
  function showTimer() {
    const sec = Math.max(0, Math.ceil(G.time));
    $('hudTimer').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    const ratio = Math.max(0, Math.min(1, G.time / G.total));
    const bar = $('timeBar');
    bar.style.width = (ratio * 100).toFixed(1) + '%';
    bar.className = ratio > 0.5 ? '' : ratio > 0.2 ? 'mid' : 'low';
    $('hudTimerWrap').classList.toggle('low', sec <= 10);
    $('hudTimerWrap').classList.toggle('frozen', G.boosts.freeze > 0);
  }

  // ---------- 道具：到指定關卡解鎖並送 1 個；數量用完後點擊會用金幣購買 ----------
  function grantBoosters() {
    for (const k in BOOST) {
      if (G.n >= BOOST[k].unlock && !save.granted[k]) {
        save.granted[k] = 1;
        save.bag[k] = (save.bag[k] || 0) + 1;
      }
    }
    persist();
  }

  function refreshBoosters() {
    document.querySelectorAll('.booster').forEach((b) => {
      const k = b.dataset.boost, cfg = BOOST[k];
      const locked = G.n < cfg.unlock;
      const n = save.bag[k] || 0;
      const active = (G.boosts[k] || 0) > 0;
      b.classList.toggle('locked', locked);
      b.classList.toggle('active', active);
      b.querySelector('.b-ic').textContent = locked ? '🔒' : cfg.icon;
      const badge = b.querySelector('.b-badge');
      if (locked) {
        badge.textContent = `第${cfg.unlock}關`;
        badge.className = 'b-badge lock';
      } else if (n > 0) {
        badge.textContent = n;
        badge.className = 'b-badge';
      } else {
        badge.innerHTML = `<i class="coin"></i>${cfg.cost}`;
        badge.className = 'b-badge buy' + (save.coins < cfg.cost ? ' poor' : '');
      }
    });
  }

  function updateBoostRings() {
    document.querySelectorAll('.booster.active').forEach((b) => {
      const k = b.dataset.boost;
      b.style.setProperty('--p', ((G.boosts[k] || 0) / BOOST[k].dur).toFixed(3));
    });
  }

  $('boosters').addEventListener('click', (ev) => {
    const b = ev.target.closest('.booster');
    if (!b || G.state !== 'playing') return;
    const k = b.dataset.boost, cfg = BOOST[k];
    const nope = (msg) => {
      b.classList.remove('nope');
      void b.offsetWidth;
      b.classList.add('nope');
      A.bad();
      popup(msg, 'info');
    };
    if (G.n < cfg.unlock) return nope(`第 ${cfg.unlock} 關解鎖`);
    if ((G.boosts[k] || 0) > 0) return;
    if ((save.bag[k] || 0) > 0) save.bag[k]--;
    else if (save.coins >= cfg.cost) setCoins(save.coins - cfg.cost, true);
    else return nope('金幣不足');
    persist();
    A.boost();
    G.boosts[k] = cfg.dur;
    popup({ grow: '黑洞變大！', magnet: '閃電吸取！', zoom: '視野放大！', freeze: '時間暫停！' }[k], 'info');
    refreshBoosters();
    showTimer();
  });

  // ---------- 對話框 ----------
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" stroke-linejoin="round"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0110 0v2h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h6V8a3 3 0 00-6 0v2z"/></svg>';

  function showModal(html) {
    const card = $('modalCard');
    card.innerHTML = html;
    $('modal').classList.remove('hidden');
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
  }
  function closeModal() { $('modal').classList.add('hidden'); }

  function itemCards(list, bad) {
    return list.map((g) =>
      `<div class="m-item${bad ? ' bad' : ''}"><img src="${g.img}" alt="">${bad ? '<span class="no-sign"></span><b>別吃</b>' : `<b>×${g.need}</b>`}<span>${g.label}</span></div>`
    ).join('');
  }

  function introModal() {
    showModal(`
      <div class="m-kicker">${lvLabel()}</div>
      <h2>${G.L.name}</h2>
      ${G.L.tip ? `<div class="m-tip">${G.L.tip}</div>` : ''}
      <div class="m-sec">任務：${G.L.ordered ? '依序吃掉' : '吃掉'}</div>
      <div class="m-items">${itemCards(G.goals)}</div>
      ${G.avoid.length ? `<div class="m-sec bad">吃到會扣時間</div><div class="m-items">${itemCards(G.avoid, true)}</div>` : ''}
      <div class="m-time">⏱ 限時 ${Math.floor(G.L.time / 60)}:${String(G.L.time % 60).padStart(2, '0')}</div>
      <button class="big-btn" data-act="begin">開始！</button>`);
  }

  function pauseModal() {
    showModal(`
      <h2>暫停</h2>
      <div class="m-items">${G.goals.map((g) => `<div class="m-item"><img src="${g.img}" alt=""><b>${g.got}/${g.need}</b><span>${g.label}</span></div>`).join('')}</div>
      <div class="m-btns">
        <button class="big-btn" data-act="resume">繼續遊戲</button>
        <div class="m-row">
          <button class="big-btn ghost" data-act="retry">重新開始</button>
          <button class="big-btn ghost" data-act="menu">主選單</button>
        </div>
        <button class="big-btn ghost" data-act="sound">${save.muted ? '🔇 音效：關' : '🔊 音效：開'}</button>
        <div class="m-sec">操控方式</div>
        <div class="seg">${Object.keys(CTRL_ZH).map((k) => `<button class="${save.ctrl === k ? 'on' : ''}" data-act="ctrl" data-ctrl="${k}">${CTRL_ZH[k]}</button>`).join('')}</div>
        <div class="m-sec">移動速度 <b id="speedVal">×${speedMul().toFixed(2)}</b></div>
        <div class="speed-row">
          <button class="speed-btn" data-act="speedStep" data-d="-0.05">－</button>
          <input type="range" id="speedRange" min="0.5" max="2" step="0.05" value="${speedMul()}">
          <button class="speed-btn" data-act="speedStep" data-d="0.05">＋</button>
        </div>
        <div class="m-note">跟原版比較後，把感覺一樣的數字告訴我</div>
        <div class="m-note">版本 ${VERSION}・${BUILD}</div>
      </div>`);
  }

  function pause() {
    if (G.state !== 'playing') return;
    G.state = 'paused';
    drag = null;
    joyEnd();
    pauseModal();
  }

  function win() {
    G.state = 'won';
    const ratio = G.time / G.total;
    const stars = ratio >= 0.4 ? 3 : ratio >= 0.18 ? 2 : 1;
    const reward = 20 + stars * 15;
    const timeBonus = Math.ceil(G.time);
    const final = G.score + timeBonus;
    if (G.daily) return winDaily(stars, final, timeBonus);
    save.best = save.best || {};
    const record = final > (save.best[G.n] || 0);
    if (record) save.best[G.n] = final;
    save.stars[G.n] = Math.max(save.stars[G.n] || 0, stars);
    save.unlocked = Math.max(save.unlocked, G.n + 1);
    save.level = G.n + 1;
    persist();
    A.win();
    banner('完成！');
    vibrate([30, 50, 30]);
    setTimeout(() => {
      if (G.state !== 'won') return;
      showModal(`
        <div class="m-kicker">第 ${G.n} 關</div>
        <h2>太棒了！</h2>
        <div class="stars">${[1, 2, 3].map((i) => STAR.replace('<svg', `<svg class="${i <= stars ? 'on' : ''}"`)).join('')}</div>
        <div class="final-score">${final}<small>分</small></div>
        <div class="m-note">吃到 ${G.score} 分 ＋ 剩餘 ${Math.ceil(G.time)} 秒加分 ${timeBonus}</div>
        <div class="m-note">${record ? '<b class="record">新紀錄！</b>' : `最佳紀錄 ${save.best[G.n]} 分`}</div>
        <div class="reward">+${reward} <i class="coin"></i></div>
        <div class="m-btns">
          <button class="big-btn" data-act="next">下一關</button>
          <div class="m-row">
            <button class="big-btn ghost" data-act="retry">再玩一次</button>
            <button class="big-btn ghost" data-act="menu">主選單</button>
          </div>
        </div>`);
      setTimeout(() => { setCoins(save.coins + reward, true); A.coin(); }, 700);
    }, 1100);
  }

  const lvLabel = () => (G.daily ? `每日挑戰・${G.daily.slice(5).replace('-', '/')}` : `第 ${G.n} 關`);

  // 每日挑戰過關：每天第一次過關多送 100 金幣，不動一般關卡進度
  function winDaily(stars, final, timeBonus) {
    save.daily = save.daily || {};
    const first = !save.daily[G.daily];
    save.daily[G.daily] = Math.max(save.daily[G.daily] || 0, stars);
    persist();
    const reward = 20 + stars * 15 + (first ? 100 : 0);
    A.win();
    banner('完成！');
    vibrate([30, 50, 30]);
    setTimeout(() => {
      if (G.state !== 'won') return;
      showModal(`
        <div class="m-kicker">${lvLabel()}</div>
        <h2>今日挑戰完成！</h2>
        <div class="stars">${[1, 2, 3].map((i) => STAR.replace('<svg', `<svg class="${i <= stars ? 'on' : ''}"`)).join('')}</div>
        <div class="final-score">${final}<small>分</small></div>
        <div class="m-note">吃到 ${G.score} 分 ＋ 剩餘 ${Math.ceil(G.time)} 秒加分 ${timeBonus}</div>
        ${first ? '<div class="m-note"><b class="record">今日首次過關 +100 金幣！</b></div>' : '<div class="m-note">明天會有新的挑戰</div>'}
        <div class="reward">+${reward} <i class="coin"></i></div>
        <div class="m-btns">
          <div class="m-row">
            <button class="big-btn ghost" data-act="retry">再玩一次</button>
            <button class="big-btn ghost" data-act="menu">主選單</button>
          </div>
        </div>`);
      setTimeout(() => { setCoins(save.coins + reward, true); A.coin(); }, 700);
    }, 1100);
  }

  // 物品圖鑑：縮圖分批產生，避免一次卡住
  function dexModal() {
    const kinds = Object.keys(H.KINDS).filter((k) => k !== 'building');
    const got = kinds.filter((k) => save.dex && save.dex[k]).length;
    showModal(`
      <h2>物品圖鑑</h2>
      <div class="m-note">已收集 ${got} / ${kinds.length} 種・每收集 10 種送 50 金幣</div>
      <div class="dex-grid">${kinds.map((k) => {
        const n = save.dex && save.dex[k];
        return `<div class="dex${n ? '' : ' unknown'}" data-k="${k}"><i></i><span>${n ? H.KINDS[k].name : '？？？'}</span>${n ? `<small>×${n}</small>` : ''}</div>`;
      }).join('')}</div>
      <div class="m-btns"><button class="big-btn" data-act="close">關閉</button></div>`);
    const cells = [...document.querySelectorAll('.dex[data-k]')];
    let i = 0;
    (function batch() {
      if (!cells.length || !document.body.contains(cells[0])) return;
      for (const end = Math.min(cells.length, i + 10); i < end; i++) {
        const img = new Image();
        img.src = H.thumb(cells[i].dataset.k, null);
        cells[i].querySelector('i').appendChild(img);
      }
      if (i < cells.length) requestAnimationFrame(batch);
    })();
  }

  // 黑洞造型商店
  function skinModal() {
    showModal(`
      <h2>黑洞造型</h2>
      <div class="m-note">用金幣買外框顏色，買過就能隨時換</div>
      <div class="skin-grid">${SKINS.map((k) => {
        const own = (save.skins || []).includes(k.id), on = save.skin === k.id;
        const sw = k.anim === 'rainbow' ? 'conic-gradient(#f44,#fc3,#4c4,#3cf,#a4f,#f44)'
          : k.anim === 'fire' ? 'radial-gradient(#ffd54f,#ff7043 60%,#d32f2f)' : '#' + k.color.toString(16).padStart(6, '0');
        return `<button class="skin${on ? ' on' : ''}" data-act="skin" data-skin="${k.id}">
          <i class="sw" style="background:${sw}"></i><span>${k.name}</span>
          <small>${on ? '使用中' : own ? '使用' : `<i class="coin"></i>${k.price}`}</small></button>`;
      }).join('')}</div>
      <div class="m-btns"><button class="big-btn" data-act="close">完成</button></div>`);
  }

  function lose() {
    G.state = 'lost';
    persist();
    drag = null;
    joyEnd();
    A.lose();
    vibrate(200);
    const can = save.coins >= CONTINUE_COST;
    showModal(`
      <div class="m-kicker">${lvLabel()}</div>
      <h2>挑戰失敗！</h2>
      <div class="m-note">時間到了</div>
      <div class="m-note">本局 ${G.score} 分</div>
      <div class="progress-list">${G.goals.map((g) => `<div><img src="${g.img}" alt="">${g.got}/${g.need}</div>`).join('')}</div>
      <div class="m-btns">
        <button class="big-btn" data-act="retry">再試一次</button>
        <div class="m-row">
          <button class="big-btn ghost" data-act="continue" ${can ? '' : 'disabled'}>+30 秒繼續 <small><i class="coin"></i>${CONTINUE_COST}</small></button>
          <button class="big-btn ghost" data-act="menu">主選單</button>
        </div>
      </div>`);
  }

  const actions = {
    begin() {
      closeModal();
      G.state = 'playing';
      banner('開始！');
      A.go();
    },
    resume() {
      closeModal();
      G.state = 'playing';
      clock.getDelta();
    },
    retry() { startLevel(G.daily ? 'daily' : G.n, true); },
    next() { startLevel(G.n + 1, false); },
    close() { closeModal(); },
    skin(btn) {
      const k = skinOf(btn.dataset.skin);
      save.skins = save.skins || ['classic'];
      if (!save.skins.includes(k.id)) {
        if (save.coins < k.price) { popup('金幣不夠', 'bad'); return; }
        setCoins(save.coins - k.price, true);
        save.skins.push(k.id);
        A.coin();
      }
      save.skin = k.id;
      persist();
      skinModal();
    },
    menu() { showMenu(); },
    continue() {
      if (save.coins < CONTINUE_COST) return;
      setCoins(save.coins - CONTINUE_COST, true);
      G.time = 30;
      G.shownSec = -1;
      closeModal();
      G.state = 'playing';
      bumpTimer('bump-good');
    },
    ctrl(btn) {
      save.ctrl = btn.dataset.ctrl;
      persist();
      btn.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      $('joy').classList.toggle('hidden', save.ctrl === 'drag');
      $('dragHint').querySelector('span').textContent = save.ctrl === 'drag' ? '按住拖曳，移動黑洞' : '按住往想去的方向推';
    },
    speedStep(btn) {
      setSpeed(speedMul() + parseFloat(btn.dataset.d));
    },
    sound(btn) {
      save.muted = !save.muted;
      A.setMuted(save.muted);
      persist();
      updateSoundBtn();
      btn.textContent = save.muted ? '🔇 音效：關' : '🔊 音效：開';
    },
  };

  function setSpeed(v) {
    save.speed = Math.round(Math.max(0.5, Math.min(2, v)) * 100) / 100;
    persist();
    const r = $('speedRange'), t = $('speedVal');
    if (r) r.value = save.speed;
    if (t) t.textContent = '×' + save.speed.toFixed(2);
  }
  $('modal').addEventListener('input', (ev) => {
    if (ev.target.id === 'speedRange') setSpeed(parseFloat(ev.target.value));
  });

  $('modal').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    A.unlock();
    A.click();
    actions[b.dataset.act](b);
  });

  // ---------- 流程 ----------
  function startLevel(n, quick) {
    A.unlock();
    closeModal();
    $('menu').classList.add('hidden');
    $('fx').innerHTML = '';
    buildLevel(n);
    $('hud').classList.remove('hidden');
    $('hudLevelTag').innerHTML = n === 'daily' ? '每日挑戰' : `第 <span id="hudLevel">${n}</span> 關`;
    $('hudScore').textContent = 0;
    showTimer();
    $('dragHint').classList.remove('off');
    $('joy').classList.toggle('hidden', save.ctrl === 'drag');
    $('dragHint').querySelector('span').textContent = save.ctrl === 'drag' ? '按住拖曳，移動黑洞' : '按住往想去的方向推';
    joyEnd();
    renderGoals();
    grantBoosters();
    setCoins(save.coins);
    G.state = 'intro';
    updateCamera(0, true);
    if (quick) actions.begin();
    else introModal();
  }

  function renderLevelGrid() {
    const count = Math.max(H.LEVEL_COUNT, save.unlocked + 2);
    let html = '';
    for (let i = 1; i <= count; i++) {
      const locked = i > save.unlocked;
      const st = save.stars[i] || 0;
      html += locked
        ? `<button class="lv locked" disabled>${LOCK}</button>`
        : `<button class="lv${i === save.level ? ' cur' : ''}" data-level="${i}">${i}<span class="st">${[1, 2, 3].map((k) => `<span class="${k <= st ? 'on' : ''}">★</span>`).join('')}</span></button>`;
    }
    $('levelGrid').innerHTML = html;
    const cur = $('levelGrid').querySelector('.cur');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function updateSoundBtn() {
    $('btnSound').textContent = save.muted ? '🔇' : '🔊';
  }

  function showMenu() {
    closeModal();
    $('hud').classList.add('hidden');
    $('fx').innerHTML = '';
    save.level = Math.min(save.level, save.unlocked);
    buildLevel(save.level);
    G.state = 'menu';
    $('menuLevel').textContent = save.level;
    $('menuCoins').textContent = save.coins;
    $('btnDaily').textContent = save.daily && save.daily[todayKey()] ? '📅 今日已完成 ✓' : '📅 每日挑戰';
    renderLevelGrid();
    updateSoundBtn();
    $('menu').classList.remove('hidden');
    updateCamera(0, true);
  }

  $('btnPlay').addEventListener('click', () => { A.unlock(); A.click(); startLevel(save.level, false); });
  $('btnDaily').addEventListener('click', () => { A.unlock(); A.click(); startLevel('daily', false); });
  $('btnSkins').addEventListener('click', () => { A.unlock(); A.click(); skinModal(); });
  $('btnDex').addEventListener('click', () => { A.unlock(); A.click(); dexModal(); });
  $('levelGrid').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-level]');
    if (!b) return;
    A.unlock();
    A.click();
    save.level = +b.dataset.level;
    persist();
    startLevel(save.level, false);
  });
  $('btnSound').addEventListener('click', () => {
    save.muted = !save.muted;
    A.setMuted(save.muted);
    persist();
    updateSoundBtn();
    A.click();
  });
  $('btnPause').addEventListener('click', () => { A.click(); pause(); });

  // ---------- 版本（由 deploy.mjs 發佈時自動寫入 index.html） ----------
  const VERSION = 'v' + (document.documentElement.dataset.version || '?');
  const BUILD = document.documentElement.dataset.build || '本機開發版';
  $('appVersion').textContent = `版本 ${VERSION}・${BUILD}`;

  // ---------- 啟動 ----------
  resize();
  showMenu();
  // 測試用：網址加 ?level=N 直接開第 N 關（同時解鎖到該關）
  const testLv = parseInt(new URLSearchParams(location.search).get('level'), 10);
  if (testLv >= 1) {
    save.unlocked = Math.max(save.unlocked, testLv);
    save.level = testLv;
    persist();
    startLevel(testLv, false);
  }
  frame();

  // 除錯 / 自動測試用
  window.__hole = { G, hole, save, startLevel, camera, renderer, scene };
})();
