/* 物件庫：所有可被吃掉的低多邊形物件（以基本幾何拼裝後合併成單一 geometry，一個物件 = 一次 draw call） */
(function () {
  'use strict';
  const T = THREE;
  const H = (window.HoleIt = window.HoleIt || {});
  const PI = Math.PI;

  const _e = new T.Euler(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3();
  function P(geo, color, pos, rot, scl) {
    _p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _q.setFromEuler(_e);
    if (scl == null) _s.set(1, 1, 1);
    else if (typeof scl === 'number') _s.set(scl, scl, scl);
    else _s.set(scl[0], scl[1], scl[2]);
    return { geo, color, m: new T.Matrix4().compose(_p, _q, _s) };
  }
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s) => new T.CylinderGeometry(rt, rb, h, s || 12);
  const sph = (r, w, h) => new T.SphereGeometry(r, w || 12, h || 8);
  const hemi = (r, w) => new T.SphereGeometry(r, w || 12, 5, 0, PI * 2, 0, PI / 2);
  const ico = (r, d) => new T.IcosahedronGeometry(r, d || 0);
  const cone = (r, h, s) => new T.ConeGeometry(r, h, s || 10);
  const torus = (R, t, rs, ts) => new T.TorusGeometry(R, t, rs || 8, ts || 18);

  const _c = new T.Color();
  function merge(parts) {
    let count = 0;
    const geos = parts.map((p) => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m);
      count += g.attributes.position.count;
      return g;
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
    let o = 0;
    geos.forEach((g, i) => {
      const color = parts[i].color, fn = typeof color === 'function';
      if (!fn) _c.set(color);
      const n = g.attributes.position.count, ga = g.attributes.position.array;
      pos.set(ga, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      for (let k = 0; k < n; k++) {
        if (fn) _c.set(color(ga[k * 3], ga[k * 3 + 1], ga[k * 3 + 2]));
        col[(o + k) * 3] = _c.r; col[(o + k) * 3 + 1] = _c.g; col[(o + k) * 3 + 2] = _c.b;
      }
      o += n;
      g.dispose();
    });
    parts.forEach((p) => p.geo.dispose());
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  const CAR = { red: '#e53935', blue: '#1e88e5', yellow: '#fbc02d', green: '#43a047', white: '#eceff1' };
  const COLOR_ZH = {
    red: '紅色', blue: '藍色', yellow: '黃色', green: '綠色', white: '白色',
    pink: '粉紅', choc: '巧克力', mint: '薄荷', purple: '紫色', orange: '橘色',
  };
  const SPRINKLE = ['#ffffff', '#ffeb3b', '#4fc3f7', '#e57373', '#81c784'];
  const BUILD_H = { a: 5.2, b: 7.2, c: 8.8, d: 6.2 };

  // r = 佔地半徑（判斷能否掉進洞），walk = 會走動的速度
  const KINDS = {
    cone: {
      name: '三角錐', r: 0.32,
      build: () => [
        P(box(0.62, 0.08, 0.62), '#ff7a1a', [0, 0.04, 0]),
        P(cyl(0.04, 0.27, 0.68, 14), '#ff7a1a', [0, 0.42, 0]),
        P(cyl(0.14, 0.18, 0.12, 14), '#ffffff', [0, 0.42, 0]),
      ],
    },
    hydrant: {
      name: '消防栓', r: 0.3,
      build: () => [
        P(cyl(0.24, 0.26, 0.08), '#b71c1c', [0, 0.04, 0]),
        P(cyl(0.18, 0.18, 0.5), '#e53935', [0, 0.33, 0]),
        P(hemi(0.19), '#e53935', [0, 0.58, 0]),
        P(cyl(0.07, 0.07, 0.52, 8), '#c62828', [0, 0.4, 0], [0, 0, PI / 2]),
        P(cyl(0.05, 0.06, 0.12, 8), '#ffd54f', [0, 0.8, 0]),
      ],
    },
    trash: {
      name: '垃圾桶', r: 0.35,
      build: () => [
        P(cyl(0.3, 0.26, 0.8, 14), '#43a047', [0, 0.4, 0]),
        P(cyl(0.33, 0.33, 0.06, 14), '#2e7d32', [0, 0.83, 0]),
        P(box(0.18, 0.06, 0.06), '#1b5e20', [0, 0.89, 0]),
        P(box(0.12, 0.3, 0.02), '#ffffff', [0, 0.45, 0.29]),
      ],
    },
    bench: {
      name: '長椅', r: 0.82, w: 0.3,
      build: () => {
        const leg = box(0.08, 0.45, 0.45);
        return [
          P(box(1.6, 0.08, 0.5), '#b0703f', [0, 0.45, 0]),
          P(box(1.6, 0.34, 0.07), '#b0703f', [0, 0.76, -0.24], [-0.15, 0, 0]),
          P(leg, '#546e7a', [-0.68, 0.225, 0]),
          P(leg.clone(), '#546e7a', [0.68, 0.225, 0]),
          P(box(0.08, 0.4, 0.06), '#546e7a', [-0.68, 0.65, -0.24]),
          P(box(0.08, 0.4, 0.06), '#546e7a', [0.68, 0.65, -0.24]),
        ];
      },
    },
    lamp: {
      name: '路燈', r: 0.3,
      build: () => [
        P(cyl(0.15, 0.2, 0.18), '#37474f', [0, 0.09, 0]),
        P(cyl(0.05, 0.07, 2.8, 8), '#455a64', [0, 1.5, 0]),
        P(box(0.6, 0.06, 0.08), '#455a64', [0.28, 2.88, 0]),
        P(box(0.32, 0.1, 0.22), '#fff59d', [0.56, 2.82, 0]),
      ],
    },
    tree: {
      name: '樹', r: 0.65,
      build: () => [
        P(cyl(0.12, 0.16, 1.1, 8), '#795548', [0, 0.55, 0]),
        P(ico(0.72), '#43a047', [0, 1.45, 0]),
        P(ico(0.52), '#66bb6a', [0.12, 2.0, 0.05]),
      ],
    },
    pine: {
      name: '松樹', r: 0.6,
      build: () => [
        P(cyl(0.1, 0.13, 0.6, 8), '#6d4c41', [0, 0.3, 0]),
        P(cone(0.62, 1.0, 8), '#2e7d32', [0, 1.0, 0]),
        P(cone(0.47, 0.8, 8), '#388e3c', [0, 1.5, 0]),
        P(cone(0.3, 0.6, 8), '#43a047', [0, 1.95, 0]),
      ],
    },
    bush: {
      name: '樹叢', r: 0.5,
      build: () => [
        P(ico(0.42), '#558b2f', [0, 0.32, 0], null, [1, 0.8, 1]),
        P(ico(0.3), '#689f38', [0.28, 0.25, 0.1]),
        P(ico(0.28), '#7cb342', [-0.24, 0.24, -0.1]),
      ],
    },
    flower: {
      name: '花', r: 0.16,
      colors: { pink: '#ec407a', yellow: '#fdd835', purple: '#ab47bc', orange: '#ff7043' },
      build: (c) => [
        P(cyl(0.02, 0.02, 0.32, 5), '#558b2f', [0, 0.16, 0]),
        P(box(0.12, 0.02, 0.06), '#7cb342', [0.06, 0.12, 0], [0, 0, 0.4]),
        P(ico(0.1), c, [0, 0.34, 0], null, [1.2, 0.6, 1.2]),
        P(sph(0.045, 6, 4), '#fff59d', [0, 0.38, 0]),
      ],
    },
    person: {
      name: '行人', r: 0.26, walk: 1.3,
      colors: { red: '#e53935', blue: '#1e88e5', yellow: '#fdd835', purple: '#8e24aa', green: '#00897b', orange: '#fb8c00' },
      build: (c) => [
        P(box(0.09, 0.42, 0.12), '#37474f', [-0.07, 0.21, 0]),
        P(box(0.09, 0.42, 0.12), '#37474f', [0.07, 0.21, 0]),
        P(cyl(0.16, 0.19, 0.46, 10), c, [0, 0.64, 0]),
        P(sph(0.15, 10, 8), '#ffcc99', [0, 1.0, 0]),
        P(hemi(0.158, 10), '#4e342e', [0, 1.02, -0.01]),
        P(box(0.05, 0.03, 0.02), '#4e342e', [0, 0.98, 0.15]),
      ],
    },
    car: {
      name: '汽車', r: 1.05, w: 0.55,
      colors: CAR,
      build: (c) => {
        const wheel = cyl(0.21, 0.21, 0.14, 12);
        const parts = [
          P(box(1.04, 0.46, 2.1), c, [0, 0.43, 0]),
          P(box(0.88, 0.4, 1.12), '#263238', [0, 0.85, -0.12]),
          P(box(0.92, 0.07, 1.0), c, [0, 1.07, -0.14]),
          P(box(0.18, 0.1, 0.04), '#fff9c4', [-0.32, 0.5, 1.06]),
          P(box(0.18, 0.1, 0.04), '#fff9c4', [0.32, 0.5, 1.06]),
          P(box(0.18, 0.1, 0.04), '#c62828', [-0.32, 0.5, -1.06]),
          P(box(0.18, 0.1, 0.04), '#c62828', [0.32, 0.5, -1.06]),
          P(box(1.08, 0.1, 0.1), '#90a4ae', [0, 0.26, 1.06]),
          P(box(1.08, 0.1, 0.1), '#90a4ae', [0, 0.26, -1.06]),
        ];
        [[-0.53, 0.68], [0.53, 0.68], [-0.53, -0.68], [0.53, -0.68]].forEach(([x, z]) =>
          parts.push(P(wheel.clone(), '#212121', [x, 0.21, z], [0, 0, PI / 2])));
        wheel.dispose();
        return parts;
      },
    },
    building: {
      name: '大樓', r: 2.1, noColorLabel: true,
      colors: { a: '#90caf9', b: '#ffcc80', c: '#ef9a9a', d: '#ce93d8' },
      build: (c, key) => {
        const h = BUILD_H[key] || 6;
        const parts = [
          P(box(3.6, h, 3.6), c, [0, h / 2, 0]),
          P(box(3.84, 0.3, 3.84), '#78909c', [0, h + 0.15, 0]),
          P(box(1.0, 0.6, 1.0), '#b0bec5', [0.8, h + 0.6, -0.6]),
        ];
        const win = box(0.55, 0.65, 0.06);
        for (let side = 0; side < 4; side++) {
          const ry = side * PI / 2;
          const sx = Math.sin(ry), sz = Math.cos(ry);
          for (let y = 1.0; y < h - 0.6; y += 1.25) {
            for (const off of [-1.1, 0, 1.1]) {
              if (side === 0 && y === 1.0 && off === 0) continue;
              const x = sx * 1.81 + Math.cos(ry) * off, z = sz * 1.81 - Math.sin(ry) * off;
              parts.push(P(win.clone(), '#1e3a5f', [x, y + 0.2, z], [0, ry, 0]));
            }
          }
        }
        win.dispose();
        parts.push(P(box(0.85, 1.15, 0.06), '#5d4037', [0, 0.58, 1.82]));
        return parts;
      },
    },
    donut: {
      name: '甜甜圈', r: 0.45,
      colors: { pink: '#f48fb1', choc: '#6d4c41', mint: '#80deea' },
      build: (c) => {
        const parts = [
          P(torus(0.28, 0.14, 8, 20), '#e0a96d', [0, 0.14, 0], [PI / 2, 0, 0]),
          P(torus(0.28, 0.125, 8, 20), c, [0, 0.19, 0], [PI / 2, 0, 0], [1, 1, 0.62]),
        ];
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * PI * 2, rr = 0.2 + (i % 3) * 0.07;
          parts.push(P(box(0.06, 0.025, 0.02), SPRINKLE[i % SPRINKLE.length], [Math.cos(a) * rr, 0.28, Math.sin(a) * rr], [0, a * 1.7, 0]));
        }
        return parts;
      },
    },
    burger: {
      name: '漢堡', r: 0.45,
      build: () => {
        const parts = [
          P(cyl(0.4, 0.37, 0.14, 16), '#d9a05b', [0, 0.07, 0]),
          P(cyl(0.42, 0.42, 0.12, 16), '#5d3a1a', [0, 0.2, 0]),
          P(box(0.66, 0.04, 0.66), '#ffca28', [0, 0.28, 0], [0, PI / 4, 0]),
          P(cyl(0.45, 0.45, 0.04, 16), '#7cb342', [0, 0.32, 0]),
          P(hemi(0.41, 16), '#e0a55f', [0, 0.34, 0], null, [1, 0.72, 1]),
        ];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          parts.push(P(box(0.05, 0.02, 0.03), '#fff3e0', [Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.2], [0.5, a, 0]));
        }
        return parts;
      },
    },
    cupcake: {
      name: '杯子蛋糕', r: 0.33,
      colors: { blue: '#4fc3f7', orange: '#ffb74d', purple: '#ba68c8' },
      build: (c) => [
        P(cyl(0.28, 0.2, 0.3, 12), c, [0, 0.15, 0]),
        P(sph(0.28, 12, 8), '#fce4ec', [0, 0.36, 0], null, [1, 0.6, 1]),
        P(cone(0.2, 0.26, 12), '#f8bbd0', [0, 0.56, 0]),
        P(sph(0.07, 8, 6), '#d32f2f', [0, 0.73, 0]),
      ],
    },
    icecream: {
      name: '冰淇淋', r: 0.27,
      colors: { pink: '#f48fb1', mint: '#a5d6a7', choc: '#8d6e63' },
      build: (c) => [
        P(cyl(0.2, 0.03, 0.5, 12), '#d7a86e', [0, 0.25, 0]),
        P(sph(0.21, 12, 8), c, [0, 0.58, 0]),
        P(sph(0.18, 12, 8), '#fff8e1', [0, 0.82, 0]),
        P(sph(0.05, 6, 4), '#d32f2f', [0, 1.0, 0]),
      ],
    },
    apple: {
      name: '蘋果', r: 0.28,
      colors: { red: '#e53935', green: '#7cb342' },
      names: { red: '紅蘋果', green: '青蘋果' },
      build: (c) => [
        P(sph(0.25, 12, 10), c, [0, 0.25, 0], null, [1, 0.95, 1]),
        P(cyl(0.02, 0.02, 0.12, 5), '#5d4037', [0, 0.53, 0]),
        P(box(0.13, 0.02, 0.06), '#43a047', [0.07, 0.55, 0], [0, 0, 0.4]),
      ],
    },
    cup: {
      name: '馬克杯', r: 0.28,
      build: () => [
        P(cyl(0.2, 0.17, 0.4, 14), '#fafafa', [0, 0.2, 0]),
        P(cyl(0.18, 0.18, 0.02, 14), '#6d4c41', [0, 0.39, 0]),
        P(torus(0.1, 0.03, 6, 10), '#fafafa', [0.22, 0.22, 0]),
      ],
    },
    bomb: {
      name: '炸彈', r: 0.34,
      build: () => [
        P(sph(0.3, 14, 10), '#263238', [0, 0.32, 0]),
        P(cyl(0.1, 0.1, 0.08, 10), '#455a64', [0, 0.63, 0]),
        P(cyl(0.025, 0.025, 0.22, 5), '#a1887f', [0.03, 0.75, 0], [0, 0, -0.3]),
        P(ico(0.07), '#ffca28', [0.07, 0.88, 0]),
        P(sph(0.07, 6, 4), '#ffffff', [-0.13, 0.45, 0.2]),
      ],
    },
    sheep: {
      name: '綿羊', r: 0.5, walk: 0.5,
      build: () => {
        const leg = box(0.09, 0.3, 0.09);
        return [
          P(ico(0.42, 1), '#fafafa', [0, 0.52, 0], null, [1, 0.85, 1.25]),
          P(box(0.24, 0.28, 0.3), '#37474f', [0, 0.64, 0.52]),
          P(box(0.12, 0.05, 0.08), '#37474f', [-0.16, 0.7, 0.48]),
          P(box(0.12, 0.05, 0.08), '#37474f', [0.16, 0.7, 0.48]),
          P(leg, '#37474f', [-0.18, 0.15, 0.25]),
          P(leg.clone(), '#37474f', [0.18, 0.15, 0.25]),
          P(leg.clone(), '#37474f', [-0.18, 0.15, -0.25]),
          P(leg.clone(), '#37474f', [0.18, 0.15, -0.25]),
        ];
      },
    },
    pig: {
      name: '小豬', r: 0.5, walk: 0.5,
      build: () => {
        const leg = box(0.12, 0.22, 0.12);
        return [
          P(box(0.6, 0.48, 0.85), '#f8bbd0', [0, 0.45, 0]),
          P(box(0.44, 0.4, 0.32), '#f8bbd0', [0, 0.56, 0.55]),
          P(box(0.22, 0.15, 0.08), '#ec407a', [0, 0.5, 0.74]),
          P(box(0.1, 0.12, 0.05), '#f48fb1', [-0.15, 0.8, 0.5], [0.3, 0, 0]),
          P(box(0.1, 0.12, 0.05), '#f48fb1', [0.15, 0.8, 0.5], [0.3, 0, 0]),
          P(leg, '#f48fb1', [-0.18, 0.11, 0.28]),
          P(leg.clone(), '#f48fb1', [0.18, 0.11, 0.28]),
          P(leg.clone(), '#f48fb1', [-0.18, 0.11, -0.28]),
          P(leg.clone(), '#f48fb1', [0.18, 0.11, -0.28]),
        ];
      },
    },
    chicken: {
      name: '小雞', r: 0.24, walk: 0.9,
      build: () => [
        P(sph(0.18, 10, 8), '#fafafa', [0, 0.28, 0], null, [1, 1, 1.2]),
        P(sph(0.11, 10, 8), '#fafafa', [0, 0.48, 0.13]),
        P(box(0.03, 0.08, 0.1), '#e53935', [0, 0.6, 0.13]),
        P(cone(0.04, 0.09, 6), '#ffb300', [0, 0.47, 0.27], [PI / 2, 0, 0]),
        P(box(0.03, 0.14, 0.03), '#ffb300', [-0.07, 0.07, 0]),
        P(box(0.03, 0.14, 0.03), '#ffb300', [0.07, 0.07, 0]),
      ],
    },
    hay: {
      name: '乾草捆', r: 0.55,
      build: () => [
        P(cyl(0.4, 0.4, 0.9, 14), '#e6c35c', [0, 0.4, 0], [0, 0, PI / 2]),
        P(cyl(0.36, 0.36, 0.92, 14), '#c9a43f', [0, 0.4, 0], [0, 0, PI / 2]),
        P(cyl(0.41, 0.41, 0.05, 14), '#a1887f', [-0.22, 0.4, 0], [0, 0, PI / 2]),
        P(cyl(0.41, 0.41, 0.05, 14), '#a1887f', [0.22, 0.4, 0], [0, 0, PI / 2]),
      ],
    },
    barrel: {
      name: '木桶', r: 0.38,
      build: () => [
        P(cyl(0.32, 0.32, 0.86, 14), '#8d5a2b', [0, 0.43, 0]),
        P(cyl(0.36, 0.36, 0.42, 14), '#9c6634', [0, 0.43, 0]),
        P(cyl(0.34, 0.34, 0.05, 14), '#424242', [0, 0.14, 0]),
        P(cyl(0.34, 0.34, 0.05, 14), '#424242', [0, 0.72, 0]),
      ],
    },
    fence: {
      name: '柵欄', r: 0.9, w: 0.12,
      build: () => {
        const post = box(0.12, 0.72, 0.12);
        return [
          P(post, '#a1887f', [-0.8, 0.36, 0]),
          P(post.clone(), '#a1887f', [0, 0.36, 0]),
          P(post.clone(), '#a1887f', [0.8, 0.36, 0]),
          P(box(1.8, 0.1, 0.06), '#bcaaa4', [0, 0.26, 0.06]),
          P(box(1.8, 0.1, 0.06), '#bcaaa4', [0, 0.56, 0.06]),
        ];
      },
    },
    crate: {
      name: '木箱', r: 0.48,
      build: () => [
        P(box(0.8, 0.8, 0.8), '#c58b4e', [0, 0.4, 0]),
        P(box(0.84, 0.1, 0.84), '#8d5a2b', [0, 0.06, 0]),
        P(box(0.84, 0.1, 0.84), '#8d5a2b', [0, 0.74, 0]), // 頂面要比箱身低一點，同高會 z-fighting 閃線
        P(box(0.1, 0.8, 0.84), '#8d5a2b', [0, 0.4, 0], [0, 0, 0.78]),
      ],
    },
    carrot: {
      name: '胡蘿蔔', r: 0.5, w: 0.16,
      colors: { orange: '#ff8a1f', white: '#f1ead8' },
      names: { orange: '胡蘿蔔', white: '白蘿蔔' },
      build: (c) => {
        const leaf = (yaw) => P(box(0.05, 0.04, 0.36), '#43a047', [Math.sin(yaw) * 0.06, 0.2, -0.52], [0.5, yaw, 0]);
        return [
          P(cone(0.14, 0.8, 8), c, [0, 0.14, 0.06], [PI / 2, 0, 0]),
          P(sph(0.14, 8, 6), c, [0, 0.14, -0.34], null, [1, 1, 0.5]),
          leaf(0), leaf(0.35), leaf(-0.35),
        ];
      },
    },
    tomato: {
      name: '番茄', r: 0.26,
      build: () => {
        const parts = [P(sph(0.24, 10, 8), '#e53935', [0, 0.21, 0], null, [1, 0.86, 1])];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          parts.push(P(box(0.04, 0.02, 0.15), '#2e7d32', [Math.sin(a) * 0.06, 0.41, Math.cos(a) * 0.06], [0, a, 0]));
        }
        parts.push(P(cyl(0.015, 0.02, 0.07, 5), '#2e7d32', [0, 0.45, 0]));
        return parts;
      },
    },
    strawberry: {
      name: '草莓', r: 0.2,
      build: () => [
        P(cone(0.17, 0.3, 9), '#e53935', [0, 0.17, 0], [PI, 0, 0]),
        P(sph(0.17, 9, 6), '#e53935', [0, 0.31, 0], null, [1, 0.55, 1]),
        P(cone(0.13, 0.06, 6), '#43a047', [0, 0.4, 0], [PI, 0, 0]),
        P(cyl(0.015, 0.015, 0.08, 4), '#2e7d32', [0, 0.45, 0]),
      ],
    },
    slice: {
      name: '水果片', r: 0.3,
      colors: { orange: '#f57c00', lemon: '#f9c825', kiwi: '#6d9b2e', straw: '#d32f2f' },
      names: { orange: '柳橙片', lemon: '檸檬片', kiwi: '奇異果片', straw: '草莓片' },
      build: (c, key) => {
        const inner = { orange: '#ffb74d', lemon: '#fff176', kiwi: '#9ccc65', straw: '#ef5350' }[key] || '#ffb74d';
        const parts = [
          P(cyl(0.3, 0.3, 0.08, 16), c, [0, 0.04, 0]),
          P(cyl(0.26, 0.26, 0.09, 16), inner, [0, 0.045, 0]),
        ];
        if (key === 'kiwi') {
          parts.push(P(cyl(0.07, 0.07, 0.095, 8), '#f1f8e9', [0, 0.045, 0]));
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * PI * 2;
            parts.push(P(box(0.025, 0.02, 0.04), '#212121', [Math.sin(a) * 0.13, 0.09, Math.cos(a) * 0.13], [0, a, 0]));
          }
        } else if (key === 'straw') {
          parts.push(P(cyl(0.12, 0.12, 0.095, 10), '#ffcdd2', [0, 0.045, 0], null, [0.6, 1, 1]));
        } else {
          parts.push(P(cyl(0.035, 0.035, 0.095, 6), '#fffde7', [0, 0.045, 0]));
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * PI * 2;
            parts.push(P(box(0.018, 0.012, 0.21), '#fffde7', [Math.sin(a) * 0.13, 0.09, Math.cos(a) * 0.13], [0, a, 0]));
          }
        }
        return parts;
      },
    },
    watermelon: {
      name: '西瓜', r: 0.5,
      build: () => [
        P(sph(0.4, 14, 10), (x, y) => ((Math.floor((Math.atan2(y - 0.34, x) + PI) / (PI / 6)) % 2) ? '#43a047' : '#2e7d32'),
          [0, 0.34, 0], null, [1, 0.85, 1.22]),
        P(cyl(0.02, 0.03, 0.08, 5), '#6d4c41', [0, 0.69, 0.1]),
      ],
    },
    melonslice: {
      name: '西瓜片', r: 0.32, w: 0.26,
      build: () => {
        const wedge = (rad, depth) => {
          const sh = new T.Shape();
          const a0 = PI / 2 - PI / 5.5, a1 = PI / 2 + PI / 5.5;
          sh.moveTo(0, -0.22);
          sh.absarc(0, -0.22, rad, a0, a1, false);
          sh.lineTo(0, -0.22);
          return new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 10 }).rotateX(-PI / 2);
        };
        const parts = [
          P(wedge(0.48, 0.12), '#2e7d32'),
          P(wedge(0.445, 0.13), '#e8f5e9'),
          P(wedge(0.42, 0.14), '#ef5350'),
        ];
        [[0, -0.02], [-0.07, -0.1], [0.07, -0.1], [0, -0.17]].forEach(([x, z]) =>
          parts.push(P(box(0.03, 0.02, 0.05), '#212121', [x, 0.145, z])));
        return parts;
      },
    },
    jelly: {
      name: '果凍', r: 0.36,
      colors: { orange: '#ff7043', pink: '#f06292', green: '#9ccc65' },
      noColorLabel: true,
      build: (c) => [
        P(cyl(0.24, 0.34, 0.36, 10), c, [0, 0.18, 0]),
        P(cyl(0.2, 0.24, 0.06, 10), c, [0, 0.39, 0]),
        P(sph(0.1, 8, 6), '#e53935', [0, 0.47, 0], null, [1, 1.2, 1]),
        P(cone(0.08, 0.05, 6), '#43a047', [0, 0.55, 0], [PI, 0, 0]),
      ],
    },
    broccoli: {
      name: '青花菜', r: 0.3,
      build: () => {
        const parts = [P(cyl(0.07, 0.1, 0.26, 7), '#9ccc65', [0, 0.13, 0]), P(ico(0.17), '#2e7d32', [0, 0.34, 0])];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          parts.push(P(ico(0.12), i % 2 ? '#388e3c' : '#43a047', [Math.sin(a) * 0.15, 0.28, Math.cos(a) * 0.15]));
        }
        return parts;
      },
    },
    maki: {
      name: '壽司卷', r: 0.23,
      colors: { salmon: '#ff7043', tamago: '#ffca28', cucumber: '#66bb6a' },
      names: { salmon: '鮭魚卷', tamago: '玉子卷', cucumber: '小黃瓜卷' },
      build: (c) => [
        P(cyl(0.22, 0.22, 0.36, 12), '#1f2d1f', [0, 0.18, 0]),
        P(cyl(0.19, 0.19, 0.02, 12), '#fafafa', [0, 0.365, 0]),
        P(cyl(0.08, 0.08, 0.025, 8), c, [0, 0.37, 0]),
      ],
    },
    nigiri: {
      name: '握壽司', r: 0.27, w: 0.17,
      colors: { salmon: '#ff8a65', tuna: '#e53935', egg: '#ffd54f' },
      names: { salmon: '鮭魚握壽司', tuna: '鮪魚握壽司', egg: '玉子握壽司' },
      build: (c, key) => {
        const parts = [
          P(box(0.26, 0.16, 0.44), '#fafafa', [0, 0.08, 0]),
          P(box(0.3, 0.08, 0.52), c, [0, 0.2, 0]),
        ];
        if (key === 'egg') parts.push(P(box(0.32, 0.02, 0.08), '#212121', [0, 0.18, 0]));
        else [-0.14, 0, 0.14].forEach((z) => parts.push(P(box(0.31, 0.01, 0.025), '#ffe0d6', [0, 0.245, z], [0, 0.3, 0])));
        return parts;
      },
    },
    onigiri: {
      name: '飯糰', r: 0.32,
      build: () => [
        P(cyl(0.3, 0.3, 0.22, 3), '#fafafa', [0, 0.15, 0], [-PI / 2, 0, 0]),
        P(box(0.3, 0.17, 0.24), '#1f2d1f', [0, 0.085, 0]),
      ],
    },
    cookie: {
      name: '餅乾', r: 0.25,
      build: () => {
        const parts = [P(cyl(0.24, 0.24, 0.07, 12), '#c98b4b', [0, 0.035, 0])];
        [[0.08, 0.05], [-0.1, 0.08], [0.02, -0.11], [-0.06, -0.03], [0.12, -0.06]].forEach(([x, z]) =>
          parts.push(P(box(0.05, 0.03, 0.05), '#4e342e', [x, 0.075, z], [0, x * 9, 0])));
        return parts;
      },
    },
    candy: {
      name: '糖果', r: 0.3, w: 0.17,
      colors: { red: '#e53935', blue: '#1e88e5', yellow: '#fdd835', purple: '#8e24aa' },
      build: (c) => [
        P(sph(0.14, 10, 8), c, [0, 0.14, 0]),
        P(cone(0.1, 0.17, 8), c, [0.2, 0.14, 0], [0, 0, PI / 2]),
        P(cone(0.1, 0.17, 8), c, [-0.2, 0.14, 0], [0, 0, -PI / 2]),
        P(box(0.02, 0.06, 0.24), '#ffffff', [0.05, 0.27, 0], [0, 0, 0.3]),
      ],
    },
    cherry: {
      name: '櫻桃', r: 0.2,
      build: () => [
        P(sph(0.1, 9, 7), '#c62828', [-0.08, 0.1, 0]),
        P(sph(0.1, 9, 7), '#c62828', [0.08, 0.1, 0.02]),
        P(cyl(0.012, 0.012, 0.28, 4), '#558b2f', [-0.04, 0.32, 0], [0, 0, -0.3]),
        P(cyl(0.012, 0.012, 0.28, 4), '#558b2f', [0.04, 0.32, 0.01], [0, 0, 0.3]),
        P(box(0.12, 0.02, 0.06), '#43a047', [0.04, 0.46, 0]),
      ],
    },
    cake: {
      name: '蛋糕', r: 0.45,
      colors: { pink: '#f48fb1', choc: '#6d4c41', white: '#fafafa' },
      noColorLabel: true,
      build: (c) => {
        const parts = [
          P(cyl(0.42, 0.42, 0.3, 16), '#ffe0b2', [0, 0.15, 0]),
          P(cyl(0.43, 0.43, 0.08, 16), c, [0, 0.33, 0]),
        ];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          parts.push(P(sph(0.06, 6, 5), '#e53935', [Math.sin(a) * 0.3, 0.4, Math.cos(a) * 0.3]));
        }
        return parts;
      },
    },
    orange: {
      name: '柳橙', r: 0.25,
      build: () => [
        P(sph(0.24, 12, 9), '#fb8c00', [0, 0.23, 0]),
        P(cyl(0.02, 0.02, 0.06, 5), '#5d4037', [0, 0.48, 0]),
        P(box(0.12, 0.02, 0.06), '#43a047', [0.06, 0.49, 0], [0, 0, 0.3]),
      ],
    },
    turnip: {
      name: '蕪菁', r: 0.23,
      build: () => [
        P(sph(0.21, 10, 8), (x, y) => (y > 0.27 ? '#8e24aa' : '#f3e5f5'), [0, 0.24, 0]),
        P(cone(0.08, 0.16, 6), '#f3e5f5', [0, 0.04, 0], [PI, 0, 0]),
        P(box(0.05, 0.3, 0.02), '#43a047', [-0.04, 0.55, 0], [0, 0, 0.25]),
        P(box(0.05, 0.3, 0.02), '#43a047', [0.04, 0.55, 0], [0, 0, -0.25]),
      ],
    },
    avocado: {
      name: '酪梨', r: 0.32, w: 0.22,
      build: () => [
        P(hemi(0.22, 12), '#33691e', [0, 0.12, 0], [PI, 0, 0], [1, 0.55, 1.4]),
        P(cyl(0.2, 0.2, 0.02, 14), '#d4e7a1', [0, 0.125, 0], null, [1, 1, 1.4]),
        P(hemi(0.085, 10), '#6d4c41', [0, 0.13, 0.04], null, [1, 0.9, 1]),
      ],
    },
    lemonwedge: {
      name: '檸檬角', r: 0.26,
      colors: { lemon: '#f9a825', orange: '#ef6c00' },
      names: { lemon: '檸檬角', orange: '柳橙角' },
      build: (c, key) => {
        const half = (rad, depth) => {
          const sh = new T.Shape();
          sh.moveTo(-rad, 0);
          sh.absarc(0, 0, rad, PI, 0, true);
          sh.lineTo(-rad, 0);
          return new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -depth / 2);
        };
        return [
          P(half(0.25, 0.14), c, [0, 0, 0]),
          P(half(0.21, 0.15), key === 'orange' ? '#ffb74d' : '#fff59d', [0, 0.005, 0]),
        ];
      },
    },
    jar: {
      name: '果醬罐', r: 0.27,
      build: () => {
        const parts = [
          P(cyl(0.22, 0.22, 0.32, 14), '#c62828', [0, 0.16, 0]),
          P(cyl(0.19, 0.19, 0.04, 14), '#fbc02d', [0, 0.34, 0]),
          P(cyl(0.26, 0.24, 0.07, 14), '#fafafa', [0, 0.39, 0]),
        ];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * PI * 2;
          parts.push(P(box(0.07, 0.075, 0.07), '#e53935', [Math.sin(a) * 0.17, 0.392, Math.cos(a) * 0.17], [0, a, 0]));
        }
        return parts;
      },
    },
    macaron: {
      name: '馬卡龍', r: 0.21,
      colors: { pink: '#f48fb1', mint: '#80cbc4', yellow: '#fff176', purple: '#b39ddb', blue: '#81d4fa', orange: '#ffb74d' },
      noColorLabel: true,
      build: (c) => [
        P(cyl(0.2, 0.19, 0.08, 14), c, [0, 0.04, 0]),
        P(cyl(0.17, 0.17, 0.05, 14), '#fffde7', [0, 0.105, 0]),
        P(cyl(0.19, 0.2, 0.08, 14), c, [0, 0.17, 0]),
      ],
    },
    waffle: {
      name: '鬆餅', r: 0.33,
      build: () => {
        const parts = [P(cyl(0.32, 0.32, 0.1, 16), '#e6a63c', [0, 0.05, 0])];
        [-0.16, -0.05, 0.05, 0.16].forEach((o) => {
          parts.push(P(box(0.025, 0.02, 0.56), '#b9741f', [o, 0.105, 0]));
          parts.push(P(box(0.56, 0.02, 0.025), '#b9741f', [0, 0.105, o]));
        });
        return parts;
      },
    },
    pie: {
      name: '派', r: 0.38,
      build: () => {
        const parts = [
          P(cyl(0.37, 0.3, 0.14, 16), '#d8954a', [0, 0.07, 0]),
          P(cyl(0.31, 0.31, 0.02, 16), '#c62828', [0, 0.145, 0]),
        ];
        [-0.15, 0, 0.15].forEach((o) => {
          parts.push(P(box(0.05, 0.03, 0.6), '#e8a95c', [o, 0.16, 0]));
          parts.push(P(box(0.6, 0.03, 0.05), '#e8a95c', [0, 0.17, o]));
        });
        parts.push(P(sph(0.06, 6, 5), '#3949ab', [0.07, 0.2, -0.07]));
        parts.push(P(sph(0.06, 6, 5), '#3949ab', [-0.06, 0.2, 0.05]));
        return parts;
      },
    },
    cocoa: {
      name: '熱可可', r: 0.3,
      build: () => [
        P(cyl(0.22, 0.19, 0.32, 14), '#e53935', [0, 0.16, 0]),
        P(cyl(0.2, 0.2, 0.02, 14), '#5d4037', [0, 0.315, 0]),
        P(box(0.09, 0.07, 0.09), '#fff8e1', [0.06, 0.34, 0.03], [0, 0.4, 0]),
        P(box(0.09, 0.07, 0.09), '#fff8e1', [-0.06, 0.34, -0.03], [0, 1.1, 0]),
        P(box(0.09, 0.07, 0.09), '#fff8e1', [0, 0.345, -0.08], [0, 0.2, 0]),
        P(torus(0.09, 0.03, 6, 10), '#e53935', [0.23, 0.17, 0]),
      ],
    },
    shrimp: {
      name: '炸蝦', r: 0.3, w: 0.16,
      build: () => [
        P(cyl(0.1, 0.13, 0.48, 10), '#f4b860', [0, 0.12, 0.02], [PI / 2, 0, 0]),
        P(sph(0.13, 9, 7), '#f4b860', [0, 0.12, 0.26], null, [1, 1, 0.8]),
        P(cone(0.1, 0.16, 6), '#ff5722', [0, 0.12, -0.28], [-PI / 2, 0, 0], [1.2, 1, 0.5]),
      ],
    },
    soydish: {
      name: '醬油碟', r: 0.5, w: 0.3,
      build: () => [
        P(cyl(0.28, 0.22, 0.08, 16), '#fafafa', [0, 0.04, 0]),
        P(cyl(0.22, 0.22, 0.02, 16), '#3e2723', [0, 0.075, 0]),
        P(box(0.035, 0.035, 1.0), '#fafafa', [-0.06, 0.1, 0.05], [0, 0.12, 0]),
        P(box(0.035, 0.035, 1.0), '#fafafa', [0.05, 0.1, 0.05], [0, 0.18, 0]),
      ],
    },
    duck: {
      name: '小鴨', r: 0.27,
      build: () => [
        P(sph(0.2, 12, 9), '#ffd600', [0, 0.18, -0.02], null, [1, 0.85, 1.2]),
        P(sph(0.13, 10, 8), '#ffd600', [0, 0.38, 0.12]),
        P(box(0.12, 0.04, 0.09), '#ff8f00', [0, 0.36, 0.26]),
        P(sph(0.025, 5, 4), '#212121', [-0.06, 0.42, 0.22]),
        P(sph(0.025, 5, 4), '#212121', [0.06, 0.42, 0.22]),
        P(cone(0.07, 0.12, 5), '#ffd600', [0, 0.26, -0.24], [-1.2, 0, 0]),
      ],
    },
    bird: {
      name: '小藍鳥', r: 0.26,
      build: () => [
        P(sph(0.2, 12, 9), '#29b6f6', [0, 0.21, 0], null, [1, 1, 1.05]),
        P(sph(0.13, 10, 8), '#e1f5fe', [0, 0.17, 0.1], null, [1, 1, 0.6]),
        P(cone(0.05, 0.1, 5), '#ffa000', [0, 0.27, 0.22], [PI / 2, 0, 0]),
        P(sph(0.03, 5, 4), '#212121', [-0.08, 0.31, 0.15]),
        P(sph(0.03, 5, 4), '#212121', [0.08, 0.31, 0.15]),
        P(cone(0.06, 0.14, 4), '#0288d1', [0, 0.42, -0.02]),
        P(box(0.06, 0.12, 0.2), '#0288d1', [-0.2, 0.22, -0.02], [0, 0, -0.4]),
        P(box(0.06, 0.12, 0.2), '#0288d1', [0.2, 0.22, -0.02], [0, 0, 0.4]),
      ],
    },
    dice: {
      name: '骰子', r: 0.26,
      colors: { white: '#fafafa', yellow: '#ffd54f' },
      names: { white: '骰子', yellow: '黃骰子' },
      build: (c) => {
        const parts = [P(box(0.4, 0.4, 0.4), c, [0, 0.2, 0])];
        const pip = (x, y, z) => parts.push(P(box(0.07, 0.07, 0.07), '#263238', [x, y, z]));
        // 上面 5 點、正面 4 點、右邊 6 點（只做看得到的面）
        [[0, 0], [-0.1, -0.1], [0.1, 0.1], [-0.1, 0.1], [0.1, -0.1]].forEach(([a, b]) => pip(a, 0.385, b));
        [[-0.1, -0.1], [0.1, 0.1], [-0.1, 0.1], [0.1, -0.1]].forEach(([a, b]) => pip(a, 0.2 + b, 0.185));
        [[-0.1, -0.1], [-0.1, 0], [-0.1, 0.1], [0.1, -0.1], [0.1, 0], [0.1, 0.1]].forEach(([a, b]) => pip(0.185, 0.2 + b, a));
        return parts;
      },
    },
    popsicle: {
      name: '冰棒', r: 0.32, w: 0.16,
      colors: { red: '#ef5350', blue: '#42a5f5', green: '#9ccc65', yellow: '#ffca28', orange: '#ff8a65', pink: '#f06292' },
      noColorLabel: true,
      build: (c) => [
        P(box(0.28, 0.14, 0.46), c, [0, 0.07, -0.06]),
        P(box(0.29, 0.02, 0.12), '#ffffff', [0, 0.145, 0.08]),
        P(box(0.07, 0.04, 0.22), '#d7a86e', [0, 0.05, 0.26]),
      ],
    },
    pepper: {
      name: '甜椒', r: 0.27,
      colors: { green: '#43a047', red: '#e53935', orange: '#fb8c00' },
      names: { green: '青椒', red: '紅椒', orange: '橘椒' },
      build: (c) => {
        const parts = [];
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * PI * 2;
          parts.push(P(sph(0.15, 10, 8), c, [Math.sin(a) * 0.08, 0.2, Math.cos(a) * 0.08], null, [1, 1.3, 1]));
        }
        parts.push(P(cyl(0.035, 0.04, 0.12, 6), '#2e7d32', [0, 0.44, 0]));
        return parts;
      },
    },
    peach: {
      name: '水蜜桃', r: 0.3,
      build: () => [
        P(sph(0.28, 12, 10), (x, y, z) => (x + z > 0.05 ? '#ff8a65' : '#ffb74d'), [0, 0.27, 0]),
        P(cyl(0.02, 0.025, 0.08, 5), '#5d4037', [0, 0.56, 0]),
        P(box(0.16, 0.02, 0.08), '#66bb6a', [0.08, 0.57, 0], [0, 0, 0.3]),
      ],
    },
    onion: {
      name: '紫洋蔥', r: 0.22,
      build: () => [
        P(sph(0.19, 10, 8), '#8e24aa', [0, 0.19, 0], null, [1, 0.95, 1]),
        P(cone(0.08, 0.2, 6), '#ab47bc', [0, 0.44, 0]),
        P(cone(0.05, 0.08, 5), '#efebe9', [0, 0.02, 0], [PI, 0, 0]),
      ],
    },
    gumball: {
      name: '粉紅糖球', r: 0.22,
      build: () => [
        P(sph(0.2, 12, 9), '#f06292', [0, 0.2, 0]),
        P(sph(0.04, 5, 4), '#fce4ec', [0.12, 0.3, 0.1]),
        P(sph(0.04, 5, 4), '#fce4ec', [-0.1, 0.25, 0.13]),
        P(sph(0.04, 5, 4), '#fce4ec', [0.02, 0.37, -0.08]),
      ],
    },
    brick: {
      name: '積木', r: 0.3, w: 0.18,
      colors: { red: '#e53935', blue: '#1e88e5', yellow: '#fdd835', green: '#43a047', orange: '#fb8c00', purple: '#8e24aa' },
      noColorLabel: true,
      build: (c) => {
        const parts = [P(box(0.3, 0.22, 0.56), c, [0, 0.11, 0])];
        [[-0.07, -0.19], [0.07, -0.19], [-0.07, -0.06], [0.07, -0.06], [-0.07, 0.06], [0.07, 0.06], [-0.07, 0.19], [0.07, 0.19]]
          .forEach(([x, z]) => parts.push(P(cyl(0.045, 0.045, 0.05, 8), c, [x, 0.245, z])));
        return parts;
      },
    },
    toytrain: {
      name: '積木火車', r: 0.75, w: 0.4,
      build: () => {
        const wheel = cyl(0.13, 0.13, 0.08, 10);
        const parts = [
          P(box(0.6, 0.3, 1.3), '#e53935', [0, 0.32, 0]),
          P(box(0.6, 0.45, 0.5), '#1e88e5', [0, 0.7, -0.38]),
          P(box(0.66, 0.08, 0.6), '#fdd835', [0, 0.96, -0.38]),
          P(cyl(0.11, 0.13, 0.35, 8), '#fdd835', [0, 0.65, 0.42]),
          P(box(0.5, 0.06, 0.06), '#fafafa', [0, 0.32, 0.66]),
        ];
        [[-0.32, 0.4], [0.32, 0.4], [-0.32, -0.1], [0.32, -0.1], [-0.32, -0.5], [0.32, -0.5]].forEach(([x, z]) =>
          parts.push(P(wheel.clone(), '#212121', [x, 0.14, z], [0, 0, PI / 2])));
        wheel.dispose();
        return parts;
      },
    },
    // ===== 第 6～16 關：玩具、家電、運動用品等 =====
    walkie: {
      name: '對講機', r: 0.2, w: 0.1,
      build: () => [
        P(box(0.17, 0.08, 0.34), '#8e44d6', [0, 0.04, 0]),
        P(box(0.12, 0.02, 0.1), '#f5c542', [0, 0.09, 0.05]),
        P(box(0.12, 0.02, 0.06), '#4a2a7a', [0, 0.09, -0.08]),
        P(cyl(0.015, 0.015, 0.16, 5), '#333', [0.05, 0.05, -0.24], [PI / 2, 0, 0]),
      ],
    },
    mic: {
      name: '麥克風', r: 0.2, w: 0.08,
      build: () => [
        P(cyl(0.035, 0.05, 0.28, 8), '#3d8bfd', [0, 0.05, 0.06], [PI / 2, 0, 0]),
        P(sph(0.085, 10, 8), '#d6dbe4', [0, 0.085, -0.14]),
      ],
    },
    headphones: {
      name: '耳機', r: 0.3,
      colors: { pink: '#f06292', purple: '#ab47bc' },
      noColorLabel: true,
      build: (c) => [
        P(new T.TorusGeometry(0.2, 0.035, 6, 16, PI), c, [0, 0.06, 0], [PI / 2, 0, 0]),
        P(cyl(0.09, 0.09, 0.09, 12), c, [-0.2, 0.09, 0], [0, 0, PI / 2]),
        P(cyl(0.09, 0.09, 0.09, 12), c, [0.2, 0.09, 0], [0, 0, PI / 2]),
        P(cyl(0.07, 0.07, 0.1, 12), '#ffd54f', [-0.2, 0.09, 0], [0, 0, PI / 2]),
        P(cyl(0.07, 0.07, 0.1, 12), '#ffd54f', [0.2, 0.09, 0], [0, 0, PI / 2]),
      ],
    },
    blender: {
      name: '果汁機', r: 0.42,
      build: () => [
        P(box(0.6, 0.3, 0.6), '#26a69a', [0, 0.15, 0]),
        P(cyl(0.24, 0.2, 0.6, 12), '#80cbc4', [0, 0.6, 0]),
        P(cyl(0.26, 0.26, 0.08, 12), '#e53935', [0, 0.93, 0]),
        P(box(0.05, 0.3, 0.12), '#26a69a', [0.27, 0.6, 0]),
      ],
    },
    tv: {
      name: '電視', r: 0.5,
      build: () => [
        P(box(0.9, 0.62, 0.55), '#ff8a00', [0, 0.39, 0]),
        P(box(0.62, 0.42, 0.04), '#3a7bd5', [-0.06, 0.4, 0.28]),
        P(cyl(0.04, 0.04, 0.03, 8), '#fff', [0.34, 0.5, 0.28], [PI / 2, 0, 0]),
        P(box(0.7, 0.08, 0.4), '#b35f00', [0, 0.04, 0]),
        P(cyl(0.012, 0.012, 0.35, 4), '#555', [-0.1, 0.82, -0.05], [0, 0, 0.5]),
        P(cyl(0.012, 0.012, 0.35, 4), '#555', [0.1, 0.82, -0.05], [0, 0, -0.5]),
      ],
    },
    fridge: {
      name: '冰箱', r: 0.55,
      build: () => [
        P(box(0.75, 1.5, 0.65), '#8bc34a', [0, 0.75, 0]),
        P(box(0.76, 0.03, 0.66), '#558b2f', [0, 1.0, 0]),
        P(box(0.05, 0.3, 0.05), '#eeeeee', [0.28, 1.2, 0.34]),
        P(box(0.05, 0.4, 0.05), '#eeeeee', [0.28, 0.6, 0.34]),
      ],
    },
    helicopter: {
      name: '直升機', r: 0.5,
      build: () => [
        P(sph(0.26, 12, 9), '#29b6f6', [0, 0.3, 0.05], null, [1, 0.95, 1.2]),
        P(sph(0.16, 10, 8), '#e1f5fe', [0, 0.36, 0.25]),
        P(box(0.08, 0.08, 0.5), '#29b6f6', [0, 0.32, -0.42]),
        P(box(0.04, 0.2, 0.12), '#ffca28', [0, 0.4, -0.66]),
        P(box(0.9, 0.02, 0.08), '#ffca28', [0, 0.6, 0.05], [0, 0.5, 0]),
        P(box(0.9, 0.02, 0.08), '#ffca28', [0, 0.6, 0.05], [0, -1.07, 0]),
        P(cyl(0.03, 0.03, 0.06, 6), '#555', [0, 0.57, 0.05]),
        P(box(0.05, 0.05, 0.5), '#555', [-0.18, 0.04, 0.05]),
        P(box(0.05, 0.05, 0.5), '#555', [0.18, 0.04, 0.05]),
      ],
    },
    microwave: {
      name: '微波爐', r: 0.5,
      build: () => [
        P(box(0.85, 0.5, 0.55), '#f48fb1', [0, 0.25, 0]),
        P(box(0.5, 0.32, 0.03), '#37474f', [-0.1, 0.26, 0.28]),
        P(box(0.14, 0.32, 0.03), '#fce4ec', [0.3, 0.26, 0.28]),
      ],
    },
    tennis: {
      name: '網球', r: 0.13,
      build: () => [P(sph(0.12, 10, 8), '#c6e03a', [0, 0.12, 0]), P(new T.TorusGeometry(0.12, 0.012, 4, 16), '#ffffff', [0, 0.12, 0], [0.4, 0, 0])],
    },
    racket: {
      name: '球拍', r: 0.42, w: 0.18,
      build: () => [
        P(new T.TorusGeometry(0.17, 0.025, 6, 20), '#ec407a', [0, 0.03, -0.12], [PI / 2, 0, 0], [1, 1.25, 1]),
        P(cyl(0.16, 0.16, 0.01, 16), '#fafafa', [0, 0.03, -0.12], null, [1, 1, 1.25]),
        P(cyl(0.03, 0.03, 0.34, 8), '#5c6bc0', [0, 0.03, 0.27], [PI / 2, 0, 0]),
      ],
    },
    basketball: {
      name: '籃球', r: 0.26,
      build: () => [
        P(sph(0.25, 14, 10), '#ef6c00', [0, 0.25, 0]),
        P(new T.TorusGeometry(0.252, 0.01, 4, 24), '#3e2723', [0, 0.25, 0], [PI / 2, 0, 0]),
        P(new T.TorusGeometry(0.252, 0.01, 4, 24), '#3e2723', [0, 0.25, 0]),
      ],
    },
    soccer: {
      name: '足球', r: 0.26,
      build: () => [P(new T.IcosahedronGeometry(0.25, 1), (x, y, z) => ((Math.round(x * 9) + Math.round(y * 9) + Math.round(z * 9)) % 3 === 0 ? '#212121' : '#fafafa'), [0, 0.25, 0])],
    },
    board: {
      name: '托盤', r: 0.48, w: 0.28,
      build: () => [
        P(box(0.5, 0.07, 0.8), '#c68a4e', [0, 0.035, 0]),
        P(box(0.5, 0.08, 0.04), '#9c6a37', [0, 0.08, 0.38]),
        P(box(0.5, 0.08, 0.04), '#9c6a37', [0, 0.08, -0.38]),
        P(box(0.04, 0.08, 0.8), '#9c6a37', [0.23, 0.08, 0]),
        P(box(0.04, 0.08, 0.8), '#9c6a37', [-0.23, 0.08, 0]),
      ],
    },
    billiard: {
      name: '紅球', r: 0.17,
      build: () => [P(sph(0.16, 12, 9), '#d32f2f', [0, 0.16, 0]), P(cyl(0.06, 0.06, 0.01, 10), '#fafafa', [0, 0.3, 0.05], [0.4, 0, 0])],
    },
    gift: {
      name: '禮物', r: 0.28,
      colors: { red: '#e53935', purple: '#8e24aa', green: '#43a047', blue: '#1e88e5' },
      noColorLabel: true,
      build: (c) => [
        P(box(0.4, 0.36, 0.4), c, [0, 0.18, 0]),
        P(box(0.42, 0.37, 0.07), '#ffd54f', [0, 0.18, 0]),
        P(box(0.07, 0.37, 0.42), '#ffd54f', [0, 0.18, 0]),
        P(sph(0.07, 6, 5), '#ffd54f', [0, 0.39, 0]),
      ],
    },
    can: {
      name: '罐子', r: 0.14,
      colors: { red: '#e53935', white: '#eceff1' },
      noColorLabel: true,
      build: (c) => [P(cyl(0.12, 0.12, 0.32, 12), c, [0, 0.16, 0]), P(cyl(0.121, 0.121, 0.08, 12), c === '#e53935' ? '#fafafa' : '#e53935', [0, 0.18, 0]), P(cyl(0.1, 0.1, 0.02, 12), '#b0bec5', [0, 0.33, 0])],
    },
    arcade: {
      name: '遊戲機', r: 0.38,
      build: () => [
        P(box(0.5, 0.7, 0.4), '#3949ab', [0, 0.35, 0]),
        P(box(0.36, 0.26, 0.03), '#81d4fa', [0, 0.5, 0.21]),
        P(box(0.4, 0.06, 0.18), '#ffca28', [0, 0.28, 0.26]),
        P(sph(0.04, 6, 5), '#e53935', [-0.08, 0.33, 0.3]),
        P(sph(0.04, 6, 5), '#43a047', [0.08, 0.33, 0.3]),
      ],
    },
    radio: {
      name: '收音機', r: 0.45,
      build: () => [
        P(box(0.85, 0.55, 0.32), '#43a047', [0, 0.3, 0]),
        P(cyl(0.18, 0.18, 0.03, 16), '#ff8f00', [0.18, 0.3, 0.17], [PI / 2, 0, 0]),
        P(box(0.28, 0.14, 0.03), '#c8e6c9', [-0.2, 0.38, 0.17]),
        P(box(0.6, 0.05, 0.05), '#2e7d32', [0, 0.7, 0]),
        P(box(0.05, 0.14, 0.05), '#2e7d32', [-0.28, 0.62, 0]),
        P(box(0.05, 0.14, 0.05), '#2e7d32', [0.28, 0.62, 0]),
      ],
    },
    pot: {
      name: '鍋子', r: 0.36,
      build: () => [
        P(cyl(0.3, 0.27, 0.3, 14), '#f48fb1', [0, 0.15, 0]),
        P(cyl(0.31, 0.31, 0.04, 14), '#fce4ec', [0, 0.32, 0]),
        P(sph(0.05, 6, 5), '#ad1457', [0, 0.37, 0]),
        P(box(0.12, 0.05, 0.06), '#ad1457', [-0.35, 0.24, 0]),
        P(box(0.12, 0.05, 0.06), '#ad1457', [0.35, 0.24, 0]),
      ],
    },
    cheese: {
      name: '起司', r: 0.3,
      build: () => {
        const parts = [P(box(0.46, 0.28, 0.46), '#fdd835', [0, 0.14, 0])];
        [[-0.1, 0.1], [0.12, -0.05], [0, -0.14]].forEach(([x, z]) => parts.push(P(cyl(0.05, 0.05, 0.02, 8), '#f9a825', [x, 0.285, z])));
        return parts;
      },
    },
    hotdog: {
      name: '熱狗', r: 0.36, w: 0.14,
      build: () => [
        P(cyl(0.12, 0.12, 0.6, 10), '#e0a55f', [0, 0.1, 0], [PI / 2, 0, 0], [1.2, 1, 0.7]),
        P(cyl(0.065, 0.065, 0.7, 8), '#c62828', [0, 0.17, 0], [PI / 2, 0, 0]),
        P(box(0.03, 0.02, 0.55), '#fdd835', [0, 0.24, 0], [0, 0.08, 0]),
      ],
    },
    egg: {
      name: '恐龍蛋', r: 0.32,
      build: () => [P(sph(0.26, 12, 10), (x, y, z) => ((Math.round(x * 7) * 3 + Math.round(y * 7) * 5 + Math.round(z * 7)) % 4 === 0 ? '#d81b60' : '#f8bbd0'), [0, 0.32, 0], null, [1, 1.25, 1])],
    },
    papercup: {
      name: '紙杯', r: 0.16,
      colors: { red: '#e53935', green: '#2e7d32' },
      noColorLabel: true,
      build: (c) => [P(cyl(0.15, 0.11, 0.34, 12), '#fafafa', [0, 0.17, 0]), P(cyl(0.152, 0.14, 0.09, 12), c, [0, 0.28, 0])],
    },
    pumpkin: {
      name: '南瓜', r: 0.5,
      build: () => {
        const parts = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          parts.push(P(sph(0.26, 10, 8), '#fb8c00', [Math.sin(a) * 0.2, 0.3, Math.cos(a) * 0.2], null, [1, 1.05, 1]));
        }
        parts.push(P(cyl(0.04, 0.06, 0.16, 6), '#558b2f', [0, 0.62, 0]));
        return parts;
      },
    },
    hairdryer: {
      name: '吹風機', r: 0.3,
      build: () => [
        P(cyl(0.11, 0.11, 0.36, 10), '#29b6f6', [0, 0.13, -0.02], [PI / 2, 0, 0]),
        P(cyl(0.07, 0.09, 0.14, 10), '#0288d1', [0, 0.13, 0.22], [PI / 2, 0, 0]),
        P(box(0.09, 0.08, 0.26), '#0288d1', [0, 0.05, -0.12], [0.3, 0, 0]),
      ],
    },
    trumpet: {
      name: '小號', r: 0.42, w: 0.16,
      build: () => [
        P(cyl(0.03, 0.03, 0.6, 8), '#f9a825', [0, 0.06, -0.05], [PI / 2, 0, 0]),
        P(cone(0.13, 0.22, 12), '#fbc02d', [0, 0.08, 0.34], [-PI / 2, 0, 0]),
        P(box(0.12, 0.1, 0.16), '#c79100', [0, 0.1, -0.05]),
        P(cyl(0.02, 0.02, 0.08, 6), '#c79100', [0, 0.18, -0.08]),
      ],
    },
    violin: {
      name: '小提琴', r: 0.75, w: 0.32,
      build: () => [
        P(sph(0.26, 12, 8), '#f5a623', [0, 0.1, 0.22], null, [1, 0.35, 1.1]),
        P(sph(0.2, 12, 8), '#f5a623', [0, 0.1, -0.12], null, [1, 0.35, 1.1]),
        P(box(0.07, 0.05, 0.55), '#3e2723', [0, 0.17, -0.45]),
        P(sph(0.06, 8, 6), '#3e2723', [0, 0.17, -0.74]),
        P(box(0.1, 0.03, 0.08), '#3e2723', [0, 0.18, 0.28]),
      ],
    },
    pizza: {
      name: '披薩', r: 0.3,
      build: () => {
        const sh = new T.Shape();
        sh.moveTo(0, 0.3);
        sh.lineTo(-0.22, -0.22);
        sh.lineTo(0.22, -0.22);
        sh.lineTo(0, 0.3);
        const g = new T.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }).rotateX(-PI / 2);
        return [
          P(g, '#ffca28', [0, 0, 0]),
          P(box(0.5, 0.08, 0.08), '#d7953f', [0, 0.04, 0.24]),
          P(cyl(0.05, 0.05, 0.02, 8), '#c62828', [0, 0.065, -0.05]),
          P(cyl(0.05, 0.05, 0.02, 8), '#c62828', [-0.07, 0.065, 0.1]),
          P(cyl(0.05, 0.05, 0.02, 8), '#c62828', [0.08, 0.065, 0.12]),
        ];
      },
    },
    pear: {
      name: '梨子', r: 0.27,
      build: () => [
        P(sph(0.22, 12, 9), '#9ccc65', [0, 0.22, 0]),
        P(sph(0.14, 10, 8), '#9ccc65', [0, 0.44, 0]),
        P(cyl(0.02, 0.02, 0.1, 5), '#5d4037', [0, 0.6, 0]),
      ],
    },
    juicebox: {
      name: '果汁盒', r: 0.2,
      build: () => [P(box(0.24, 0.38, 0.18), '#ff9800', [0, 0.19, 0]), P(box(0.16, 0.14, 0.01), '#fff3e0', [0, 0.2, 0.095]), P(cyl(0.012, 0.012, 0.16, 5), '#fafafa', [0.06, 0.42, 0], [0, 0, 0.3])],
    },
    boat: {
      name: '玩具船', r: 0.48,
      build: () => [
        P(box(0.5, 0.2, 0.85), '#fafafa', [0, 0.1, 0]),
        P(box(0.52, 0.06, 0.87), '#1e88e5', [0, 0.06, 0]),
        P(box(0.36, 0.22, 0.4), '#e3f2fd', [0, 0.31, -0.05]),
        P(box(0.38, 0.05, 0.42), '#1e88e5', [0, 0.44, -0.05]),
        P(cone(0.25, 0.3, 4), '#fafafa', [0, 0.1, 0.52], [PI / 2, PI / 4, 0], [1, 1, 0.66]),
      ],
    },
    flipflop: {
      name: '拖鞋', r: 0.24, w: 0.11,
      build: () => [P(box(0.18, 0.04, 0.44), '#f06292', [0, 0.02, 0]), P(new T.TorusGeometry(0.07, 0.015, 4, 10, PI), '#fafafa', [0, 0.04, 0.08], [0, 0, 0])],
    },
    star: {
      name: '星星', r: 0.25,
      build: () => {
        const sh = new T.Shape();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * PI * 2 - PI / 2, rr = i % 2 ? 0.1 : 0.24;
          if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        return [P(new T.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }).translate(0, 0, -0.05), '#ffc107', [0, 0.24, 0])];
      },
    },
    ringstack: {
      name: '疊疊樂', r: 0.36,
      build: () => {
        const cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5'];
        const parts = [P(cyl(0.3, 0.3, 0.08, 14), '#8d6e63', [0, 0.04, 0])];
        cols.forEach((c, i) => parts.push(P(new T.TorusGeometry(0.24 - i * 0.035, 0.06, 6, 16), c, [0, 0.13 + i * 0.11, 0], [PI / 2, 0, 0])));
        parts.push(P(cyl(0.04, 0.04, 0.7, 6), '#8d6e63', [0, 0.4, 0]));
        return parts;
      },
    },
    phone: {
      name: '電話', r: 0.36,
      build: () => [
        P(box(0.5, 0.2, 0.45), '#f06292', [0, 0.1, 0]),
        P(cyl(0.12, 0.12, 0.02, 12), '#fce4ec', [0, 0.21, 0.04]),
        P(box(0.56, 0.08, 0.12), '#ec407a', [0, 0.28, -0.12]),
        P(box(0.12, 0.1, 0.14), '#ec407a', [-0.24, 0.24, -0.12]),
        P(box(0.12, 0.1, 0.14), '#ec407a', [0.24, 0.24, -0.12]),
      ],
    },
    abacus: {
      name: '算盤', r: 0.48,
      build: () => {
        const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5'];
        const parts = [
          P(box(0.06, 0.6, 0.06), '#8d6e63', [-0.4, 0.3, 0]),
          P(box(0.06, 0.6, 0.06), '#8d6e63', [0.4, 0.3, 0]),
          P(box(0.9, 0.06, 0.2), '#8d6e63', [0, 0.03, 0]),
        ];
        cols.forEach((c, i) => {
          parts.push(P(cyl(0.012, 0.012, 0.8, 4), '#bdbdbd', [0, 0.14 + i * 0.13, 0], [0, 0, PI / 2]));
          for (let k = 0; k < 4; k++) parts.push(P(sph(0.05, 6, 5), c, [-0.25 + k * 0.1, 0.14 + i * 0.13, 0]));
        });
        return parts;
      },
    },
    plate: {
      name: '盤子', r: 0.3,
      build: () => [P(cyl(0.29, 0.22, 0.06, 16), '#fafafa', [0, 0.03, 0]), P(cyl(0.3, 0.3, 0.012, 16), '#f48fb1', [0, 0.062, 0])],
    },
    plum: {
      name: '紫李', r: 0.15,
      build: () => [P(sph(0.14, 10, 8), '#7b1fa2', [0, 0.14, 0]), P(cyl(0.01, 0.01, 0.06, 4), '#4e342e', [0, 0.3, 0])],
    },
    backpack: {
      name: '書包', r: 0.42,
      build: () => [
        P(box(0.6, 0.62, 0.36), '#ec407a', [0, 0.31, 0]),
        P(sph(0.3, 10, 8), '#ec407a', [0, 0.62, 0], null, [1, 0.35, 0.6]),
        P(box(0.42, 0.26, 0.08), '#f8bbd0', [0, 0.24, 0.21]),
      ],
    },
    rocket: {
      name: '火箭', r: 0.42,
      build: () => [
        P(cyl(0.18, 0.2, 0.75, 12), '#fafafa', [0, 0.48, 0]),
        P(cone(0.18, 0.32, 12), '#e53935', [0, 1.01, 0]),
        P(cyl(0.07, 0.07, 0.02, 10), '#42a5f5', [0, 0.65, 0.18], [PI / 2, 0, 0]),
        P(box(0.06, 0.3, 0.3), '#e53935', [0.2, 0.2, 0], [0, 0, -0.3]),
        P(box(0.06, 0.3, 0.3), '#e53935', [-0.2, 0.2, 0], [0, 0, 0.3]),
        P(cone(0.12, 0.14, 8), '#ff9800', [0, 0.06, 0], [PI, 0, 0]),
      ],
    },
    jeep: {
      name: '吉普車', r: 0.55,
      build: () => {
        const wheel = cyl(0.17, 0.17, 0.12, 10);
        const parts = [
          P(box(0.66, 0.32, 1.0), '#7cb342', [0, 0.36, 0]),
          P(box(0.6, 0.3, 0.45), '#558b2f', [0, 0.65, -0.15]),
          P(box(0.56, 0.24, 0.02), '#b3e5fc', [0, 0.65, 0.08]),
        ];
        [[-0.36, 0.32], [0.36, 0.32], [-0.36, -0.32], [0.36, -0.32]].forEach(([x, z]) => parts.push(P(wheel.clone(), '#212121', [x, 0.17, z], [0, 0, PI / 2])));
        wheel.dispose();
        return parts;
      },
    },
    cube: {
      name: '小方塊', r: 0.13,
      colors: { blue: '#42a5f5', red: '#e53935' },
      names: { blue: '藍色方塊', red: '紅色方塊' },
      build: (c) => [P(box(0.22, 0.22, 0.22), c, [0, 0.11, 0]), P(cyl(0.05, 0.05, 0.04, 8), c, [0, 0.24, 0])],
    },
    key: {
      name: '鑰匙', r: 0.3,
      colors: { red: '#e53935', blue: '#1e88e5', yellow: '#fdd835' },
      names: { red: '紅色鑰匙', blue: '藍色鑰匙', yellow: '黃色鑰匙' },
      build: (c) => [
        P(new T.TorusGeometry(0.12, 0.045, 8, 18), c, [0, 0.3, -0.12]),
        P(box(0.07, 0.07, 0.34), c, [0, 0.3, 0.13]),
        P(box(0.05, 0.12, 0.06), c, [0, 0.22, 0.22]),
        P(box(0.05, 0.09, 0.06), c, [0, 0.235, 0.3]),
        P(cyl(0.1, 0.12, 0.16, 10), '#fff8e1', [0, 0.08, 0]),
      ],
    },
    minitrain: {
      name: '小火車', r: 0.32, w: 0.16,
      build: () => [
        P(box(0.24, 0.18, 0.5), '#ec407a', [0, 0.15, 0]),
        P(box(0.24, 0.18, 0.2), '#ab47bc', [0, 0.32, -0.12]),
        P(cyl(0.05, 0.05, 0.12, 6), '#ffd54f', [0, 0.3, 0.16]),
        P(cyl(0.07, 0.07, 0.3, 8), '#212121', [0, 0.07, 0.15], [0, 0, PI / 2]),
        P(cyl(0.07, 0.07, 0.3, 8), '#212121', [0, 0.07, -0.15], [0, 0, PI / 2]),
      ],
    },
    ball: {
      name: '海灘球', r: 0.3,
      colors: { red: '#e53935', blue: '#1e88e5', yellow: '#fdd835' },
      build: (c) => [
        P(hemi(0.3, 14), c, [0, 0.3, 0]),
        P(hemi(0.3, 14), '#ffffff', [0, 0.3, 0], [PI, 0, 0]),
        P(cyl(0.305, 0.305, 0.05, 14), '#ffffff', [0, 0.3, 0], [0, 0, PI / 2]),
      ],
    },
    // 神秘寶箱：關卡開始時隨機放在地上，吞下去會得到隨機效果（不算任務、不進圖鑑）
    treasure: {
      name: '神秘寶箱', r: 0.3,
      build: () => [
        P(box(0.5, 0.28, 0.36), '#8d5a2b', [0, 0.14, 0]),
        P(cyl(0.18, 0.18, 0.5, 12), '#a86b32', [0, 0.28, 0], [0, 0, PI / 2]),
        P(box(0.06, 0.3, 0.38), '#f2c94c', [-0.15, 0.15, 0]),
        P(box(0.06, 0.3, 0.38), '#f2c94c', [0.15, 0.15, 0]),
        P(box(0.06, 0.06, 0.38), '#f2c94c', [-0.15, 0.44, 0]),
        P(box(0.06, 0.06, 0.38), '#f2c94c', [0.15, 0.44, 0]),
        P(box(0.11, 0.13, 0.05), '#ffe27a', [0, 0.26, 0.19]),
        P(ico(0.08), '#7cf3ff', [0, 0.55, 0]),
      ],
    },
  };

  const geoCache = {};
  function getGeo(kind, color) {
    const key = kind + '|' + (color || '');
    if (!geoCache[key]) {
      const def = KINDS[kind];
      const hex = def.colors ? def.colors[color] || Object.values(def.colors)[0] : null;
      geoCache[key] = merge(def.build(hex, color));
    }
    return geoCache[key];
  }

  function defaultColor(kind) {
    const def = KINDS[kind];
    return def.colors ? Object.keys(def.colors)[0] : null;
  }

  function labelOf(kind, color) {
    const def = KINDS[kind];
    if (color && def.names && def.names[color]) return def.names[color];
    if (color && !def.noColorLabel && COLOR_ZH[color]) return COLOR_ZH[color] + def.name;
    return def.name;
  }

  const objMat = new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 14, specular: 0x1a1a1a });

  // 目標圖示：用獨立的小渲染器把物件拍成縮圖
  let tR = null, tScene = null, tCam = null;
  const thumbCache = {};
  function thumb(kind, color) {
    const c = color || defaultColor(kind);
    const key = kind + '|' + (c || '');
    if (thumbCache[key]) return thumbCache[key];
    try {
      if (!tR) {
        tR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        tR.setPixelRatio(1);
        tR.setSize(128, 128);
        tScene = new T.Scene();
        tScene.add(new T.HemisphereLight(0xffffff, 0x8a7f70, 0.6));
        const dl = new T.DirectionalLight(0xffffff, 0.6);
        dl.position.set(3, 6, 4);
        tScene.add(dl);
        tCam = new T.PerspectiveCamera(30, 1, 0.05, 200);
      }
      const geo = getGeo(kind, c);
      const mesh = new T.Mesh(geo, objMat);
      tScene.add(mesh);
      const bs = geo.boundingSphere;
      const dist = bs.radius / Math.sin((15 * PI) / 180) * 1.02;
      const dir = new T.Vector3(1, 0.95, 1.4).normalize();
      tCam.position.copy(bs.center).addScaledVector(dir, dist);
      tCam.lookAt(bs.center);
      tR.render(tScene, tCam);
      thumbCache[key] = tR.domElement.toDataURL('image/png');
      tScene.remove(mesh);
    } catch (err) {
      thumbCache[key] = '';
    }
    return thumbCache[key];
  }

  Object.assign(H, { KINDS, COLOR_ZH, getGeo, defaultColor, labelOf, objMat, thumb });
})();
