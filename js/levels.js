/* 關卡：地板貼圖、圖樣擺放工具（螺旋／圓環／馬賽克／金字塔／高塔）、手工關卡與程序生成關卡 */
(function () {
  'use strict';
  const T = THREE;
  const H = window.HoleIt;
  const PI = Math.PI;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 地板 ----------
  const GAP = 12, RH = 2.2;
  function blobs(ctx, n, colors, rmin, rmax, R, px) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(R() * px, R() * px, rmin + R() * (rmax - rmin), 0, PI * 2);
      ctx.fill();
    }
  }
  function gridLines(ctx, S, u, w, px, step, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw * u;
    for (let v = -S / 2; v <= S / 2 + 0.01; v += step) {
      ctx.beginPath(); ctx.moveTo(w(v), 0); ctx.lineTo(w(v), px); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, w(v)); ctx.lineTo(px, w(v)); ctx.stroke();
    }
  }

  const FLOORS = {
    slate: {
      sky: '#5f9e3a', outer: '#5aa83a', outerTex: 'grass', border: '#9aa3ae', borderH: 0.7,
      draw(ctx, S, u, w, px, R) {
        ctx.fillStyle = '#3d4a5f';
        ctx.fillRect(0, 0, px, px);
        // 石板質感：深淺斑點與細紋
        blobs(ctx, Math.round(S * S * 1.5), ['rgba(30,38,52,.16)', 'rgba(90,104,128,.10)'], 0.05 * u, 0.35 * u, R, px);
        for (let i = 0; i < S * S * 6; i++) {
          ctx.fillStyle = R() < 0.5 ? 'rgba(20,26,38,.35)' : 'rgba(120,135,160,.18)';
          ctx.fillRect(R() * px, R() * px, Math.max(1, 0.05 * u), Math.max(1, 0.05 * u));
        }
        // 外緣內側陰影
        const g = ctx.createLinearGradient(0, 0, 0, 0.8 * u);
        g.addColorStop(0, 'rgba(0,0,0,.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, px, 0.8 * u);
      },
    },
    grass: {
      sky: '#bdeaff', outer: '#5aa82a', border: '#8fd14f',
      draw(ctx, S, u, w, px, R) {
        ctx.fillStyle = '#7ccf3c';
        ctx.fillRect(0, 0, px, px);
        blobs(ctx, Math.round(S * S * 0.25), ['rgba(95,175,40,.45)', 'rgba(160,225,95,.4)'], 0.3 * u, 1.2 * u, R, px);
        ctx.lineCap = 'round';
        for (let i = 0; i < S * S * 5; i++) {
          const x = R() * px, y = R() * px, l = (0.1 + R() * 0.16) * u;
          ctx.strokeStyle = R() < 0.5 ? 'rgba(70,150,30,.55)' : 'rgba(185,240,120,.55)';
          ctx.lineWidth = Math.max(1, 0.035 * u);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * l * 0.6, y - l); ctx.stroke();
        }
      },
    },
    sky: {
      sky: '#d4f2ff', outer: '#4fb3e3', border: '#c4ecff',
      draw(ctx, S, u, w, px) {
        ctx.fillStyle = '#8fd6f5';
        ctx.fillRect(0, 0, px, px);
        gridLines(ctx, S, u, w, px, 1, 'rgba(255,255,255,.35)', 0.05);
        gridLines(ctx, S, u, w, px, 4, 'rgba(255,255,255,.45)', 0.09);
      },
    },
    blue: {
      sky: '#9fc4ff', outer: '#1f56c2', border: '#7fb0ff',
      draw(ctx, S, u, w, px) {
        ctx.fillStyle = '#3a7ef0';
        ctx.fillRect(0, 0, px, px);
        gridLines(ctx, S, u, w, px, 0.5, 'rgba(255,255,255,.08)', 0.04);
        gridLines(ctx, S, u, w, px, 2, 'rgba(255,255,255,.16)', 0.06);
      },
    },
    pink: {
      sky: '#ffe0ef', outer: '#e8669f', border: '#ffd0e4',
      draw(ctx, S, u, w, px) {
        ctx.fillStyle = '#ff9cc6';
        ctx.fillRect(0, 0, px, px);
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        for (let x = -S / 2; x <= S / 2; x += 1.5) {
          for (let z = -S / 2; z <= S / 2; z += 1.5) {
            const off = (Math.round((z + S / 2) / 1.5) % 2) * 0.75;
            ctx.beginPath(); ctx.arc(w(x + off), w(z), 0.22 * u, 0, PI * 2); ctx.fill();
          }
        }
      },
    },
    purple: {
      sky: '#eadfff', outer: '#7b4fd6', border: '#d9c6ff',
      draw(ctx, S, u, w, px) {
        ctx.fillStyle = '#a67ef5';
        ctx.fillRect(0, 0, px, px);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        for (let x = -S / 2; x < S / 2; x += 2) {
          for (let z = -S / 2; z < S / 2; z += 2) {
            if ((Math.round(x / 2) + Math.round(z / 2)) % 2 === 0) ctx.fillRect(w(x), w(z), 2 * u, 2 * u);
          }
        }
      },
    },
    city: {
      sky: '#bfe6ff', outer: '#8e959e', border: '#cfd8dc',
      draw(ctx, S, u, w, px, R) {
        ctx.fillStyle = '#d3d7dc';
        ctx.fillRect(0, 0, px, px);
        const kMax = Math.ceil(S / 2 / GAP) + 1;
        for (let i = -kMax; i < kMax; i++) {
          for (let j = -kMax; j < kMax; j++) {
            const x0 = i * GAP + RH + 0.9, x1 = (i + 1) * GAP - RH - 0.9;
            const z0 = j * GAP + RH + 0.9, z1 = (j + 1) * GAP - RH - 0.9;
            ctx.fillStyle = R() < 0.5 ? '#9ccc65' : '#e9e3d5';
            ctx.fillRect(w(x0), w(z0), (x1 - x0) * u, (z1 - z0) * u);
          }
        }
        for (let k = -kMax; k <= kMax; k++) {
          const c = k * GAP;
          ctx.fillStyle = '#a8adb4';
          ctx.fillRect(w(c - RH - 0.15), 0, (RH * 2 + 0.3) * u, px);
          ctx.fillRect(0, w(c - RH - 0.15), px, (RH * 2 + 0.3) * u);
        }
        for (let k = -kMax; k <= kMax; k++) {
          const c = k * GAP;
          ctx.fillStyle = '#5f6672';
          ctx.fillRect(w(c - RH), 0, RH * 2 * u, px);
          ctx.fillRect(0, w(c - RH), px, RH * 2 * u);
        }
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 0.14 * u;
        ctx.setLineDash([1.1 * u, 0.9 * u]);
        for (let k = -kMax; k <= kMax; k++) {
          const c = k * GAP;
          ctx.beginPath(); ctx.moveTo(w(c), 0); ctx.lineTo(w(c), px); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, w(c)); ctx.lineTo(px, w(c)); ctx.stroke();
        }
        ctx.setLineDash([]);
        for (let i = -kMax; i <= kMax; i++) {
          for (let j = -kMax; j <= kMax; j++) {
            const cx = i * GAP, cz = j * GAP;
            ctx.fillStyle = '#5f6672';
            ctx.fillRect(w(cx - RH), w(cz - RH), RH * 2 * u, RH * 2 * u);
            ctx.fillStyle = 'rgba(255,255,255,.9)';
            for (let s = -RH + 0.3; s < RH - 0.2; s += 0.62) {
              ctx.fillRect(w(cx + s), w(cz + RH + 0.25), 0.32 * u, 1.0 * u);
              ctx.fillRect(w(cx + s), w(cz - RH - 1.25), 0.32 * u, 1.0 * u);
              ctx.fillRect(w(cx + RH + 0.25), w(cz + s), 1.0 * u, 0.32 * u);
              ctx.fillRect(w(cx - RH - 1.25), w(cz + s), 1.0 * u, 0.32 * u);
            }
          }
        }
      },
    },
  };

  function groundTexture(L, aniso) {
    const S = L.size;
    const u = Math.floor(Math.min(40, 2048 / S));
    const px = S * u;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    const w = (v) => (v + S / 2) * u;
    FLOORS[L.floor].draw(ctx, S, u, w, px, rng(L.seed + 11));
    const tex = new T.CanvasTexture(c);
    tex.anisotropy = aniso || 1;
    return tex;
  }

  // ---------- 擺放工具 ----------
  function Field(L) {
    const R = rng(L.seed);
    const half = L.size / 2 - 0.4;
    const items = [];
    const grid = new Map();
    const start = L.start || [0, 0];
    const clear = L.holeR + 0.6;
    const cell = 1;
    const key = (ix, iz) => ix * 10007 + iz;
    let colorIdx = 0;
    // 迷宮牆：[中心x, 中心z, 寬, 深]，物品不能壓在牆上
    const walls = [];
    const hitsWall = (x, z, r) => walls.some(([wx, wz, ww, wd]) =>
      Math.abs(x - wx) < ww / 2 + r && Math.abs(z - wz) < wd / 2 + r);

    function pickColor(kind, color) {
      const def = H.KINDS[kind];
      if (!def.colors) return null;
      if (Array.isArray(color)) return color[colorIdx++ % color.length];
      if (color && color !== 'random') return color;
      const keys = Object.keys(def.colors);
      return keys[Math.floor(R() * keys.length)];
    }
    const footprint = (kind) => H.KINDS[kind].w || H.KINDS[kind].r;
    const heightOf = (kind, color) => H.getGeo(kind, color).boundingBox.max.y;

    function add(kind, x, z, o) {
      o = o || {};
      const def = H.KINDS[kind];
      const color = pickColor(kind, o.color);
      const y = o.y || 0;
      const sc = o.s || 1;               // 巨大版本的放大倍率
      const rr = def.r * sc;
      if (Math.abs(x) > half - rr * 0.6 || Math.abs(z) > half - rr * 0.6) return null;
      if (walls.length && hitsWall(x, z, rr * 0.8)) return null;
      if (y === 0) {
        if (Math.hypot(x - start[0], z - start[1]) < clear + rr * 0.5) return null;
        const f = footprint(kind) * sc;
        const reach = Math.ceil((f + 2.4) * 0.6) + 1;
        const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
        for (let a = ix - reach; a <= ix + reach; a++) {
          for (let b = iz - reach; b <= iz + reach; b++) {
            const list = grid.get(key(a, b));
            if (!list) continue;
            for (const it of list) {
              const min = (f + it.f) * (o.tight ? 0.5 : 0.62);
              if ((it.x - x) * (it.x - x) + (it.z - z) * (it.z - z) < min * min) return null;
            }
          }
        }
      }
      let yaw = o.yaw;
      if (yaw == null) yaw = R() * PI * 2;
      const it = { kind, color, x, z, y, yaw, f: footprint(kind) * sc };
      if (sc !== 1) it.s = sc;
      items.push(it);
      if (y === 0) {
        const k = key(Math.floor(x / cell), Math.floor(z / cell));
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(it);
      }
      return it;
    }

    function faceYaw(face, dx, dz, x, z, cx, cz) {
      if (typeof face === 'number') return face;
      if (face === 'tangent') return Math.atan2(dx, dz);
      if (face === 'radial') return Math.atan2(cx - x, cz - z);
      if (face === 'out') return Math.atan2(x - cx, z - cz);
      return R() * PI * 2;
    }

    const spinners = [];
    const F = {
      R, items, add, half, walls, spinners,
      // 鑰匙迷宮的門：跟牆一樣擋路，多記一個顏色，吃到同色鑰匙就打開
      door(x0, z0, x1, z1, color) {
        F.wall(x0, z0, x1, z1, 0.5);
        walls[walls.length - 1].push(color);
      },
      // 旋轉盤：盤上的東西會跟著轉
      spinner(cx, cz, r, speed) { spinners.push([cx, cz, r, speed]); },
      // 迷宮牆（從 (x0,z0) 到 (x1,z1) 的水平或垂直線段，厚度 t）
      wall(x0, z0, x1, z1, t) {
        t = t || 0.5;
        walls.push([(x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) || t, Math.abs(z1 - z0) || t]);
      },
      spiral(kind, o) {
        const cx = o.cx || 0, cz = o.cz || 0, b = o.gap / (2 * PI), ph = o.phase || 0;
        let th = Math.max(o.r0 / b, 0.01);
        while (b * th <= o.r1) {
          const r = b * th, a = th + ph;
          const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          const dx = -Math.sin(a) * r + Math.cos(a) * b, dz = Math.cos(a) * r + Math.sin(a) * b;
          add(kind, x, z, { color: o.color, yaw: faceYaw(o.face, dx, dz, x, z, cx, cz), tight: o.tight });
          th += o.step / Math.max(r, 0.4);
        }
      },
      arc(kind, o) {
        const cx = o.cx || 0, cz = o.cz || 0;
        const n = Math.max(2, Math.round((Math.abs(o.a1 - o.a0) * o.r) / o.step));
        for (let i = 0; i <= n; i++) {
          const a = o.a0 + ((o.a1 - o.a0) * i) / n;
          const x = cx + Math.cos(a) * o.r, z = cz + Math.sin(a) * o.r;
          add(kind, x, z, { color: o.color, yaw: faceYaw(o.face, -Math.sin(a), Math.cos(a), x, z, cx, cz) });
        }
      },
      ring(kind, o) {
        const cx = o.cx || 0, cz = o.cz || 0, n = Math.max(3, Math.round((2 * PI * o.r) / o.step));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * PI * 2 + (o.phase || 0);
          const x = cx + Math.cos(a) * o.r, z = cz + Math.sin(a) * o.r;
          add(kind, x, z, { color: o.color, yaw: faceYaw(o.face, -Math.sin(a), Math.cos(a), x, z, cx, cz), tight: o.tight });
        }
      },
      rings(kind, o) {
        let i = 0;
        for (let r = o.r0; r <= o.r1 + 0.001; r += o.gap, i++) {
          const k = Array.isArray(kind) ? kind[i % kind.length] : kind;
          const col = o.colors ? o.colors[i % o.colors.length] : o.color;
          F.ring(k, { cx: o.cx, cz: o.cz, r, step: o.step, color: col, face: o.face, phase: i * 0.3 });
        }
      },
      disc(kind, o) {
        const cx = o.cx || 0, cz = o.cz || 0, s = o.step, hs = s * 0.866;
        let row = 0;
        for (let z = -o.r; z <= o.r; z += hs, row++) {
          for (let x = -o.r + (row % 2) * s * 0.5; x <= o.r; x += s) {
            if (x * x + z * z <= o.r * o.r) add(kind, cx + x, cz + z, { color: o.color, yaw: o.face === 'random' ? undefined : o.yaw || 0 });
          }
        }
      },
      rect(kind, o) {
        const sx = o.step, sz = o.stepZ || o.step;
        let i = 0;
        for (let z = -o.d / 2; z <= o.d / 2 + 0.001; z += sz) {
          for (let x = -o.w / 2; x <= o.w / 2 + 0.001; x += sx, i++) {
            const k = o.checker ? o.checker[(Math.round((x + o.w / 2) / sx) + Math.round((z + o.d / 2) / sz)) % o.checker.length] : kind;
            add(k, (o.cx || 0) + x, (o.cz || 0) + z, { color: o.color, yaw: o.yaw == null ? 0 : o.yaw });
          }
        }
      },
      line(kind, o) {
        const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0), n = Math.floor(len / o.step);
        const yaw = o.yaw != null ? o.yaw : Math.atan2(o.x1 - o.x0, o.z1 - o.z0);
        for (let i = 0; i <= n; i++) {
          const t = n ? i / n : 0;
          add(kind, o.x0 + (o.x1 - o.x0) * t, o.z0 + (o.z1 - o.z0) * t, { color: o.color, yaw });
        }
      },
      shape(o) {
        const s = o.step, hs = s * 0.866;
        let row = 0;
        for (let z = -o.d / 2; z <= o.d / 2; z += hs, row++) {
          for (let x = -o.w / 2 + (row % 2) * s * 0.5; x <= o.w / 2; x += s) {
            const r = o.fn(x, z);
            if (r) add(r[0], (o.cx || 0) + x, (o.cz || 0) + z, { color: r[1], yaw: R() * PI * 2 });
          }
        }
      },
      pyramid(kind, o) {
        // o.color 可給陣列（每層換顏色），o.kinds 可給陣列（每層換物品）；回傳金字塔頂端高度
        let y = o.y0 || 0;
        for (let lv = 0; lv < o.n; lv++) {
          const k = o.kinds ? o.kinds[lv % o.kinds.length] : kind;
          const color = pickColor(k, Array.isArray(o.color) ? o.color[lv % o.color.length] : o.color);
          const m = o.n - lv, off = ((m - 1) * o.step) / 2;
          for (let i = 0; i < m; i++) {
            for (let j = 0; j < m; j++) {
              add(k, (o.cx || 0) + i * o.step - off, (o.cz || 0) + j * o.step - off, { color, y, yaw: o.yaw || 0 });
            }
          }
          y += heightOf(k, color);
        }
        return y;
      },
      stack(kind, o) {
        // 從高度 y0 開始往上疊 n 個（y0=0 時最底下那個會做重疊檢查）；回傳頂端高度
        let y = o.y0 || 0;
        for (let i = 0; i < o.n; i++) {
          const color = pickColor(kind, Array.isArray(o.color) ? o.color[i % o.color.length] : o.color);
          const it = add(kind, o.cx, o.cz, { color, y, yaw: i * 0.4 });
          if (!it && y === 0) return 0;
          y += heightOf(kind, color);
        }
        return y;
      },
      tower(kind, o) {
        return F.stack(kind, { cx: o.cx, cz: o.cz, n: o.n, color: o.color });
      },
      block(kind, o) {
        // 方陣排列的高柱（每格疊 n 個）
        for (let z = -o.d / 2; z <= o.d / 2 + 0.001; z += o.step) {
          for (let x = -o.w / 2; x <= o.w / 2 + 0.001; x += o.step) {
            F.stack(kind, { cx: (o.cx || 0) + x, cz: (o.cz || 0) + z, n: o.n, color: o.color });
          }
        }
      },
      scatter(kind, o) {
        const area = o.r || half;
        let placed = 0;
        for (let t = 0; t < o.n * 40 && placed < o.n; t++) {
          let x, z;
          if (o.r) {
            const a = R() * PI * 2, d = Math.sqrt(R()) * area;
            x = (o.cx || 0) + Math.cos(a) * d; z = (o.cz || 0) + Math.sin(a) * d;
          } else {
            x = (R() * 2 - 1) * area; z = (R() * 2 - 1) * area;
          }
          if (add(kind, x, z, { color: o.color })) placed++;
        }
      },
    };
    return F;
  }

  // 「不能吃」的物品若離任務物品太近（黑洞吃大後一定會順便吞到），就移到空地；找不到位置就移除
  const AVOID_CLEAR = 2.6;
  function separate(L, items) {
    const hit = (it, list) => list.some((sp) => it.kind === sp[0] && (!sp[2] || it.color === sp[2]));
    const isAvoid = (it) => (L.avoid || []).some(([k, c]) => it.kind === k && (!c || it.color === c));
    const goals = items.filter((it) => hit(it, L.goals));
    const R = rng(L.seed + 99);
    const half = L.size / 2 - 0.6;
    const start = L.start || [0, 0];
    const safe = (x, z, r) => goals.every((g) => (g.x - x) ** 2 + (g.z - z) ** 2 >= (AVOID_CLEAR + r) ** 2);
    const out = [];
    for (const it of items) {
      const r = H.KINDS[it.kind].r;
      if (!isAvoid(it) || safe(it.x, it.z, r)) { out.push(it); continue; }
      if (it.y > 0) continue;
      for (let t = 0; t < 120; t++) {
        const x = (R() * 2 - 1) * (half - r), z = (R() * 2 - 1) * (half - r);
        if (Math.hypot(x - start[0], z - start[1]) < L.holeR + 2) continue;
        if (!safe(x, z, r)) continue;
        if ((L.walls || []).some(([wx, wz, ww, wd]) => Math.abs(x - wx) < ww / 2 + r && Math.abs(z - wz) < wd / 2 + r)) continue;
        if (items.some((o) => o !== it && o.y === 0 && (o.x - x) ** 2 + (o.z - z) ** 2 < ((o.f + it.f) * 0.62) ** 2)) continue;
        it.x = x;
        it.z = z;
        out.push(it);
        break;
      }
    }
    return out;
  }

  // 任務物品若擺得比任務數量多，把多的拿掉（先拿堆在高處的、再拿最後擺的），讓場上數量剛好等於任務
  function trimToGoals(L, items) {
    if (!L.goals) return items;
    const drop = new Set();
    for (const [kind, need, color] of L.goals) {
      if (kind === 'star') continue;
      const list = items.filter((it) => it.kind === kind && (!color || it.color === color));
      if (list.length <= need) continue;
      list.map((it, i) => ({ it, i })).sort((a, b) => b.it.y - a.it.y || b.i - a.i)
        .slice(0, list.length - need).forEach(({ it }) => drop.add(it));
    }
    return drop.size ? items.filter((it) => !drop.has(it)) : items;
  }

  // 任務物被更高的東西蓋住：長條形物品（木板、球拍）擺放時只用寬度判斷間距，常被木箱、球、船壓在底下看不到。
  // 鏡頭固定從南邊（+z）斜看，每往上 1 單位視線往 +z 偏約 0.5，所以高的東西也會擋住它北邊的東西。
  // 自動生成的關卡把被擋住的任務物搬到原位附近看得到的空地
  const VIEW_K = 0.5;
  const SAMPLE = [[0, 0]].concat([0.5, 0.9].flatMap((k) => [0, 1, 2, 3, 4, 5].map((i) => [k * Math.cos(i + k), k * Math.sin(i + k)])));
  // 地面物品的格子索引：只查附近的格子，不然幾百個物品兩兩比對在手機上會卡好幾秒
  function groundIndex(items) {
    const CELL = 2, R = new Map(), Ht = new Map(), grid = new Map();
    const key = (ix, iz) => ix * 10007 + iz;
    const cellOf = (it) => key(Math.floor(it.x / CELL), Math.floor(it.z / CELL));
    let maxR = 0, maxH = 0;
    for (const it of items) {
      const s = it.s || 1, r = H.KINDS[it.kind].r * s, h = H.getGeo(it.kind, it.color).boundingBox.max.y * s;
      R.set(it, r);
      Ht.set(it, h);
      if (it.y !== 0) continue;
      maxR = Math.max(maxR, r);
      maxH = Math.max(maxH, h);
      const k = cellOf(it);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(it);
    }
    const ix = {
      r: (it) => R.get(it), h: (it) => Ht.get(it), maxR, maxH,
      move(it, x, z) {
        const a = grid.get(cellOf(it));
        a.splice(a.indexOf(it), 1);
        it.x = x;
        it.z = z;
        const k = cellOf(it);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(it);
      },
      // 半徑 d 範圍內的地面物品逐一丟給 fn，fn 回傳 true 就提早結束並回傳 true
      some(x, z, d, fn) {
        for (let a = Math.floor((x - d) / CELL); a <= Math.floor((x + d) / CELL); a++) {
          for (let b = Math.floor((z - d) / CELL); b <= Math.floor((z + d) / CELL); b++) {
            const list = grid.get(key(a, b));
            if (list) for (const o of list) if (fn(o)) return true;
          }
        }
        return false;
      },
    };
    return ix;
  }
  // 被擋住的比例：在物品頂面取樣，看有幾成被更高的東西擋住（從正上方蓋住，或站在南邊擋住視線）
  function coverFrac(ix, it, x, z) {
    const r = ix.r(it), h = ix.h(it), tall = [];
    ix.some(x, z, r + ix.maxR + VIEW_K * ix.maxH, (o) => {
      if (o === it) return false;
      const oh = ix.h(o), or = ix.r(o);
      if (oh > h * 1.2 && Math.hypot(o.x - x, o.z - z) < or + r + VIEW_K * oh) tall.push([o.x, o.z, or * 0.9, oh]);
      return false;
    });
    if (!tall.length) return 0;
    const hit = SAMPLE.filter(([u, v]) => tall.some(([ox, oz, or, oh]) => [0, 0.5, 1].some((t) => {
      const y = h + (oh - h) * t; // 視線在高度 y 時的位置
      return Math.hypot(ox - x - u * r, oz - (z + v * r + VIEW_K * (y - h))) < or;
    }))).length;
    return hit / SAMPLE.length;
  }
  const isGoal = (L, it) => L.goals.some(([k, , c]) => k === it.kind && (!c || it.color === c));
  const HIDDEN = 0.3;
  function hiddenGoals(L, items) {
    const ix = groundIndex(items);
    return items.filter((it) => it.y === 0 && isGoal(L, it) && coverFrac(ix, it, it.x, it.z) >= HIDDEN);
  }
  function unhide(L, items) {
    if (L.official || !L.goals) return items;
    const R = rng(L.seed + 7);
    const half = L.size / 2 - 0.6;
    const start = L.start || [0, 0];
    const ix = groundIndex(items);
    const avoid = items.filter((it) => (L.avoid || []).some(([k, c]) => it.kind === k && (!c || it.color === c)));
    const goals = new Set(items.filter((it) => it.y === 0 && isGoal(L, it)));
    // loose：最後手段，可以壓在比自己矮很多的東西上（例如大托盤壓著小網球），那些不會擋到它
    const free = (it, x, z, gap, loose) => {
      const r = ix.r(it);
      if (Math.abs(x) > half - r || Math.abs(z) > half - r) return false;
      if (Math.hypot(x - start[0], z - start[1]) < L.holeR + 0.6 + r) return false;
      if ((L.walls || []).some(([wx, wz, ww, wd]) => Math.abs(x - wx) < ww / 2 + r && Math.abs(z - wz) < wd / 2 + r)) return false;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < AVOID_CLEAR + r)) return false;
      const h = ix.h(it);
      if (ix.some(x, z, r + ix.maxR, (o) => o !== it && !(loose && ix.h(o) < h * 0.5) &&
        Math.hypot(o.x - x, o.z - z) < (ix.r(o) + r) * gap)) return false;
      if (coverFrac(ix, it, x, z) > 0) return false;
      // 搬過去也不能反過來把別的任務物擋住
      const ox = it.x, oz = it.z;
      ix.move(it, x, z);
      const blocks = ix.some(x, z, r + ix.maxR + VIEW_K * ix.h(it), (g) => g !== it && goals.has(g) && ix.h(g) * 1.2 < ix.h(it) &&
        coverFrac(ix, g, g.x, g.z) >= HIDDEN);
      ix.move(it, ox, oz);
      return !blocks;
    };
    for (const it of items.filter((x) => goals.has(x) && coverFrac(ix, x, x.x, x.z) >= HIDDEN)) {
      // 從原位往外一圈圈找，盡量留在同一區；場地太擠找不到就放寬間距，最後整個場地隨便找
      search: for (const [gap, loose] of [[0.7, false], [0.5, false], [0.5, true]]) {
        for (let t = 0; t < (loose ? 600 : 300); t++) {
          let x, z;
          if (loose) {
            x = (R() * 2 - 1) * half;
            z = (R() * 2 - 1) * half;
          } else {
            const d = 0.6 + t * 0.05, a = R() * PI * 2;
            x = it.x + Math.cos(a) * d;
            z = it.z + Math.sin(a) * d;
          }
          if (!free(it, x, z, gap, loose)) continue;
          ix.move(it, x, z);
          break search;
        }
      }
    }
    return items;
  }

  function layout(L) {
    const F = Field(L);
    L.build(F);
    L.walls = F.walls;
    L.spinners = F.spinners;
    const items = L.avoid && L.avoid.length && L.goals ? separate(L, F.items) : F.items;
    return unhide(L, trimToGoals(L, items));
  }

  // ---------- 手工關卡 ----------
  // goals: [種類, 數量, 顏色?]   avoid: [種類, 顏色?]
  const LEVELS = [
    // ===== 第 1～5 關：照 YouTube 官方實機影片（Hole It 3D）重做 =====
    { name: '第一次吞噬', floor: 'slate', size: 22, time: 300, holeR: 0.7, start: [0, 5], official: true,
      goals: [['duck', 6], ['apple', 15], ['bird', 9]], avoid: [],
      build(F) {
        // 教學關：一排小鴨、成排紅蘋果、小藍鳥方陣
        F.line('duck', { x0: -4, z0: -5, x1: 4, z1: -5, step: 0.8, yaw: 0 });
        F.rect('apple', { cx: -4.5, cz: -0.5, w: 2.4, d: 3, step: 0.6, color: 'red' });
        F.rect('bird', { cx: 4.5, cz: -0.5, w: 1.8, d: 2.4, step: 0.6, yaw: 0 });
      } },
    { name: '水果漩渦', floor: 'slate', size: 26, time: 240, holeR: 0.7, start: [0, 9], official: true,
      goals: [['watermelon', 1], ['apple', 18, 'green']], avoid: [],
      build(F) {
        // 柳橙片與草莓排成的大螺旋，上方散落青蘋果，最上面一顆大西瓜
        F.spiral('slice', { cx: 0, cz: -2, r0: 1.2, r1: 7.5, gap: 1.3, step: 0.62, color: 'orange' });
        F.spiral('strawberry', { cx: 0, cz: -2, r0: 1.2, r1: 7.5, gap: 1.3, step: 0.45, phase: PI });
        F.add('watermelon', 0, -11.3, { yaw: 0 });
        F.scatter('apple', { n: 22, color: 'green', cx: 0, cz: -8.5, r: 3.5 });
      } },
    { name: '甜椒大冒險', floor: 'slate', size: 26, time: 240, holeR: 0.7, start: [0, 3], official: true,
      goals: [['pepper', 1, 'green'], ['pepper', 2, 'red'], ['pepper', 2, 'orange']], avoid: [],
      build(F) {
        // 上方小鴨方陣、一排骰子、粉紅糖球團、水蜜桃，下方左右兩道冰棒弧線，甜椒藏在各處
        F.rect('duck', { cx: 0, cz: -9.5, w: 4.8, d: 2.4, step: 0.6, yaw: 0 });
        F.line('dice', { x0: -6, z0: -4.5, x1: 6, z1: -4.5, step: 0.55, yaw: 0, color: 'white' });
        F.disc('gumball', { cx: -7, cz: -7, r: 1.2, step: 0.46 });
        F.disc('peach', { cx: 7, cz: -7, r: 1.3, step: 0.62 });
        F.arc('popsicle', { cx: -9, cz: 3, r: 5, a0: -0.9, a1: 1.1, step: 0.36, color: 'red', face: 'radial' });
        F.arc('popsicle', { cx: 9, cz: 3, r: 5, a0: PI - 1.1, a1: PI + 0.9, step: 0.36, color: 'red', face: 'radial' });
        F.arc('popsicle', { cx: -9, cz: 3, r: 6, a0: -0.6, a1: 0.9, step: 0.36, color: 'blue', face: 'radial' });
        F.arc('popsicle', { cx: 9, cz: 3, r: 6, a0: PI - 0.9, a1: PI + 0.6, step: 0.36, color: 'blue', face: 'radial' });
        [[0, -7, 'green'], [-3, 9, 'green'], [-8, -1, 'red'], [8, -1, 'red'], [3, 9, 'red'], [-5, 10.5, 'orange'], [5, 10.5, 'orange'], [0, 11.5, 'orange']]
          .forEach(([x, z, c]) => F.add('pepper', x, z, { color: c }));
      } },
    { name: '蔬果大農場', floor: 'slate', size: 30, time: 240, holeR: 0.7, start: [0, 0], official: true,
      goals: [['strawberry', 200], ['onion', 88], ['tomato', 228], ['peach', 3]], avoid: [],
      build(F) {
        // 大量草莓、紫洋蔥、番茄排成密集方陣，角落幾顆大水蜜桃
        F.rect('strawberry', { cx: -7.5, cz: -7.5, w: 4.6, d: 4.6, step: 0.42 });
        F.rect('strawberry', { cx: 7.5, cz: 7.5, w: 4.6, d: 4.6, step: 0.42 });
        F.rect('tomato', { cx: 7.5, cz: -7.5, w: 5.4, d: 5.4, step: 0.54 });
        F.rect('tomato', { cx: -7.5, cz: 7.5, w: 5.4, d: 5.4, step: 0.54 });
        F.rect('onion', { cx: 0, cz: -11.5, w: 9.2, d: 1.8, step: 0.46 });
        F.rect('onion', { cx: 0, cz: 11.5, w: 9.2, d: 1.8, step: 0.46 });
        F.rect('onion', { cx: -11.5, cz: 0, w: 1.8, d: 6.4, step: 0.46 });
        [[12, 0], [-3.5, -4], [3.5, 4], [12.5, -3]].forEach(([x, z]) => F.add('peach', x, z, {}));
      } },
    { name: '冰棒樂園', floor: 'slate', size: 30, time: 240, holeR: 0.7, start: [0, 0], official: true,
      goals: [['toytrain', 4]], avoid: [],
      build(F) {
        // 多色冰棒排成大同心圓，四個角落是積木堆，積木火車停在積木堆上（要先吃大才吞得下）
        F.rings('popsicle', { r0: 2.2, r1: 12.5, gap: 1.15, step: 0.36, colors: ['red', 'orange', 'yellow', 'green', 'blue', 'pink'], face: 'radial' });
        [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]].forEach(([x, z], i) => {
          const top = F.pyramid('brick', { cx: x, cz: z, n: 3, step: 0.62, color: ['red', 'yellow', 'blue', 'green'][i] });
          F.add('toytrain', x, z, { y: top, yaw: 0 });
        });
      } },
    // ===== 第 6～16 關：照 YouTube 官方實機影片（Hole It 3D）重做 =====
    { name: '家電大掃除', floor: 'slate', size: 30, time: 120, holeR: 0.55, start: [0, 4], official: true,
      goals: [['fridge', 2], ['helicopter', 2], ['tv', 7]], avoid: [],
      build(F) {
        // 大型家電先擺，再鋪滿紫色對講機、藍色麥克風、耳機圈、果汁機
        [[11.5, 11.5], [-11.5, -12.5], [11.5, -12.5]].forEach(([x, z]) => F.add('fridge', x, z, { yaw: 0 }));
        [[9.5, -9], [-10, 11], [0, -13]].forEach(([x, z]) => F.add('helicopter', x, z, { yaw: 0.5 }));
        F.line('tv', { x0: -4.5, z0: 12.5, x1: 4.5, z1: 12.5, step: 1.3, yaw: 0 });
        F.add('tv', -12, 4, { yaw: 0.4 });
        F.add('tv', 12, 4, { yaw: -0.4 });
        F.add('microwave', -12, -6, { yaw: 0.3 });
        F.add('microwave', 12.3, 0, { yaw: -0.3 });
        F.rect('walkie', { cx: 0, cz: -8.5, w: 12, d: 6, step: 0.45, yaw: -0.6 });
        F.rect('walkie', { cx: -6, cz: 6.5, w: 5, d: 5, step: 0.45, yaw: -0.6 });
        F.line('mic', { x0: -8, z0: 1.2, x1: 8, z1: 1.2, step: 0.5, yaw: -0.6 });
        F.ring('headphones', { cx: 7, cz: -2, r: 1.7, step: 0.66, color: ['pink', 'purple'] });
        F.ring('headphones', { cx: 6, cz: 7.5, r: 1.5, step: 0.66, color: ['purple', 'pink'] });
        F.rect('blender', { cx: -9.5, cz: -1.5, w: 2, d: 2, step: 1 });
      } },
    { name: '運動器材', floor: 'slate', size: 30, time: 120, holeR: 0.55, start: [0, 2], official: true,
      goals: [['tennis', 66], ['racket', 3], ['basketball', 4], ['ball', 3], ['board', 4]], avoid: [],
      build(F) {
        [[-12, -12], [12, 12], [-12, 12], [12, -12], [0, 12.5]].forEach(([x, z]) => F.add('board', x, z, { yaw: 0.4 }));
        [[-11.5, 0], [11.5, 3], [-4, 12.5], [5, -12.5]].forEach(([x, z]) => F.add('racket', x, z, { yaw: 0.8 }));
        [[-6, 9], [8, 9], [-9, -4], [9.5, -6], [2, -9]].forEach(([x, z]) => F.add('basketball', x, z, {}));
        [[-3, 7], [4, 4], [-8, 3], [10, 0]].forEach(([x, z]) => F.add('ball', x, z, {}));
        // 木箱上擺紅球
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const x = 3 + (i - 1) * 0.86, z = 7 + (j - 1) * 0.86;
          if (F.add('crate', x, z, { yaw: 0 })) F.add('billiard', x, z, { y: 0.8 });
        }
        F.disc('tennis', { cx: -7, cz: -8, r: 1.6, step: 0.28 });
        F.disc('tennis', { cx: 7.5, cz: -9.5, r: 1.2, step: 0.28 });
        F.disc('soccer', { cx: 8, cz: -2.5, r: 1.9, step: 0.55 });
        F.scatter('billiard', { n: 20, cx: -2, cz: -3, r: 3 });
        F.ring('plum', { cx: -6, cz: 5.5, r: 2.2, step: 0.32 });
        F.scatter('gumball', { n: 12 });
        F.scatter('brick', { n: 14 });
      } },
    { name: '玩具派對', floor: 'slate', size: 30, time: 120, holeR: 0.55, start: [0, 2], official: true,
      goals: [['tv', 23], ['minitrain', 28], ['helicopter', 10], ['radio', 4], ['arcade', 2]], avoid: [],
      build(F) {
        F.rect('tv', { cx: -10, cz: 4, w: 2.2, d: 8.8, step: 1.1, yaw: 0 });
        F.rect('helicopter', { cx: 0, cz: 11.8, w: 8, d: 1.2, step: 1.15, yaw: 0 });
        [[12, 12], [-12, -12.5], [12, -12.5], [5, 6]].forEach(([x, z]) => F.add('radio', x, z, { yaw: 0.3 }));
        [[-5, 6], [6, 0.5], [-12.5, 12.5]].forEach(([x, z]) => F.add('arcade', x, z, { yaw: -0.3 }));
        F.rect('minitrain', { cx: 9.5, cz: -4, w: 2, d: 4, step: 0.5, yaw: -0.5 });
        F.rect('can', { cx: -8, cz: -10, w: 4, d: 2.4, step: 0.32, color: 'red' });
        F.rect('gift', { cx: 7.5, cz: -10.5, w: 3, d: 1.5, step: 0.5 });
        F.rect('peach', { cx: 0, cz: -6.5, w: 2.4, d: 1.2, step: 0.62 });
        F.rect('mic', { cx: 0, cz: -3.8, w: 3, d: 1.2, step: 0.35, yaw: 0 });
        F.arc('ball', { cx: -4, cz: 7, r: 5, a0: -1.2, a1: 1.0, step: 0.62, color: 'blue' });
        F.ring('can', { cx: 2.5, cz: 7.5, r: 0.9, step: 0.3, color: 'white' });
      } },
    { name: '速食時間', floor: 'slate', size: 28, time: 200, holeR: 0.55, start: [0, 4], official: true,
      goals: [['pot', 2], ['board', 3], ['burger', 9]], avoid: [],
      build(F) {
        // 托盤上擺兩個漢堡
        [[2.5, -8], [6.5, -8], [2.5, -4], [6.5, -4], [10, 8]].forEach(([x, z]) => {
          if (F.add('board', x, z, { yaw: 0 })) {
            F.add('burger', x, z - 0.2, { y: 0.12 });
            F.add('burger', x, z + 0.22, { y: 0.12 });
          }
        });
        [[-3, 10], [8, 2], [-11, -11]].forEach(([x, z]) => F.add('pot', x, z, {}));
        F.scatter('burger', { n: 3 });
        F.block('cheese', { cx: -9, cz: -6, w: 0.6, d: 3, step: 0.62, n: 4 });
        F.line('hotdog', { x0: -10.5, z0: 2, x1: -10.5, z1: 10, step: 0.42, yaw: PI / 2 });
        F.line('melonslice', { x0: -4, z0: 0, x1: 4, z1: 0, step: 0.55, yaw: 0 });
        F.line('popsicle', { x0: -3, z0: 1.4, x1: 5, z1: 1.4, step: 0.36, color: 'red', yaw: 0 });
        F.rect('apple', { cx: 1, cz: 7.5, w: 2.4, d: 2.4, step: 0.62, color: 'green' });
        F.line('plum', { x0: -6.5, z0: 3, x1: -6.5, z1: 10, step: 0.34 });
        F.rect('egg', { cx: 0, cz: -11.5, w: 4.2, d: 1.2, step: 0.7 });
      } },
    { name: '南瓜田', floor: 'slate', size: 30, time: 150, holeR: 0.55, start: [0, 1], official: true,
      goals: [['tomato', 138], ['board', 6], ['pumpkin', 6]], avoid: [],
      build(F) {
        F.rect('pumpkin', { cx: 7, cz: 6, w: 2.2, d: 3.3, step: 1.1 });
        [[-12, -12], [12, -12], [-12, 12], [12, 12.5], [0, 12.5], [0, -12.5], [-5, 5]].forEach(([x, z]) => F.add('board', x, z, { yaw: 0.6 }));
        F.rect('papercup', { cx: -8, cz: 4, w: 3, d: 6, step: 0.36, color: ['red', 'green'] });
        F.arc('carrot', { cx: 6, cz: -6, r: 2.6, a0: -2.6, a1: -0.4, step: 0.36, face: 'out', color: 'orange' });
        F.ring('strawberry', { cx: 0, cz: -4, r: 1.6, step: 0.36 });
        F.arc('gumball', { cx: -9, cz: -4, r: 3, a0: -1.2, a1: 1.2, step: 0.45 });
        F.rect('tomato', { cx: -8, cz: -9, w: 3.6, d: 3.6, step: 0.52 });
        F.rect('tomato', { cx: 9, cz: -11, w: 3.6, d: 2.6, step: 0.52 });
        F.rect('tomato', { cx: 1, cz: 8, w: 3.6, d: 3.6, step: 0.52 });
        F.rect('tomato', { cx: -2, cz: -11.5, w: 4.2, d: 1.6, step: 0.52 });
      } },
    { name: '樂器行', floor: 'slate', size: 30, time: 120, holeR: 0.55, start: [0, 0], official: true,
      goals: [['hairdryer', 24], ['blender', 18], ['tv', 9], ['trumpet', 10], ['violin', 4]], avoid: [],
      build(F) {
        [[-10, -10], [10, -10], [-10, 10], [10, 10.5], [0, -12]].forEach(([x, z]) => F.add('violin', x, z, { yaw: 0.7 }));
        F.rect('tv', { cx: 0, cz: 11, w: 3.3, d: 2.2, step: 1.1, yaw: 0 });
        F.rect('blender', { cx: -9.5, cz: 0, w: 3, d: 4, step: 1 });
        F.rect('hairdryer', { cx: 8.5, cz: 0, w: 3, d: 3.6, step: 0.62, yaw: -0.5 });
        F.line('trumpet', { x0: -5, z0: -6, x1: 5, z1: -6, step: 0.8, yaw: PI / 2 });
        F.ring('headphones', { cx: 4.5, cz: 5, r: 1.5, step: 0.66, color: ['pink', 'purple'] });
        F.ring('headphones', { cx: -4.5, cz: 5, r: 1.5, step: 0.66, color: ['purple', 'pink'] });
        F.scatter('mic', { n: 20 });
      } },
    { name: '南瓜與披薩', floor: 'slate', size: 30, time: 120, holeR: 0.55, start: [0, 0], official: true,
      goals: [['pumpkin', 8], ['watermelon', 8], ['pizza', 30]], avoid: [],
      build(F) {
        // 三組被草莓圍起來的南瓜、蘋果番茄螺旋、一排紅蘋果、梨子、藍冰棒、西瓜、披薩
        [[-7, -7], [7, -7], [0, 8]].forEach(([x, z]) => {
          F.rect('pumpkin', { cx: x, cz: z, w: 1.1, d: 1.1, step: 1.1 });
          F.ring('strawberry', { cx: x, cz: z, r: 1.9, step: 0.38 });
        });
        F.rect('watermelon', { cx: 10.5, cz: 4, w: 2, d: 3, step: 1.0, yaw: 0 });
        F.rect('pizza', { cx: -10, cz: 4, w: 3.1, d: 4.3, step: 0.62 });
        F.spiral('apple', { cx: 0, cz: 0, r0: 1.6, r1: 4.2, gap: 1.2, step: 0.58, color: 'green' });
        F.spiral('tomato', { cx: 0, cz: 0, r0: 1.6, r1: 4.2, gap: 1.2, step: 0.55, phase: PI });
        F.line('apple', { x0: -6, z0: -12, x1: 6, z1: -12, step: 0.62, color: 'red' });
        F.scatter('pear', { n: 10 });
        F.arc('popsicle', { cx: 12, cz: -4, r: 3, a0: 1.8, a1: 4.4, step: 0.36, color: 'blue', face: 'radial' });
      } },
    { name: '星星收集', floor: 'slate', size: 30, time: 120, holeR: 0.55, start: [0, 0], official: true,
      goals: [['star', 900]], avoid: [],
      build(F) {
        // 吃任何東西都會加星星點數（越大越多）：果汁盒排成方框、玩具船圍圈、收音機、木箱與水桶、拖鞋、星星
        [[-10, -10], [10, 10]].forEach(([x, z]) => F.add('radio', x, z, { yaw: 0.3 }));
        F.ring('boat', { cx: 0, cz: 0, r: 3.2, step: 1.15, face: 'out' });
        F.line('juicebox', { x0: -6, z0: -6, x1: 6, z1: -6, step: 0.32, yaw: 0 });
        F.line('juicebox', { x0: -6, z0: 6, x1: 6, z1: 6, step: 0.32, yaw: 0 });
        F.line('juicebox', { x0: -6, z0: -5.6, x1: -6, z1: 5.6, step: 0.32, yaw: 0 });
        F.line('juicebox', { x0: 6, z0: -5.6, x1: 6, z1: 5.6, step: 0.32, yaw: 0 });
        F.block('crate', { cx: 10, cz: -9, w: 1.7, d: 1.7, step: 0.86, n: 2 });
        F.block('crate', { cx: -10, cz: 9, w: 1.7, d: 1.7, step: 0.86, n: 2 });
        F.rect('flipflop', { cx: 9.5, cz: 2, w: 2.4, d: 4, step: 0.5, yaw: 0.4 });
        F.rect('flipflop', { cx: -9.5, cz: -2, w: 2.4, d: 4, step: 0.5, yaw: -0.4 });
        F.scatter('star', { n: 40 });
        F.scatter('cube', { n: 260, color: 'blue' });
        F.scatter('juicebox', { n: 60 });
      } },
    { name: '超級困難', floor: 'slate', size: 32, time: 120, holeR: 0.55, start: [0, 0], official: true, hard: true,
      goals: [['cube', 120, 'blue'], ['dice', 75, 'yellow'], ['ringstack', 4], ['phone', 26], ['abacus', 2]], avoid: [],
      build(F) {
        [[-11, -11], [11, 11], [11, -11], [-11, 11]].forEach(([x, z]) => F.add('ringstack', x, z, {}));
        [[-12.5, 0], [12.5, 0], [0, 12.5]].forEach(([x, z]) => F.add('abacus', x, z, { yaw: 0.4 }));
        F.rect('phone', { cx: 7, cz: 5, w: 3.2, d: 4, step: 0.8, yaw: 0.3 });
        F.ring('brick', { cx: -6, cz: -6, r: 2.2, step: 0.4, color: 'red', face: 'tangent' });
        F.ring('cube', { cx: -6, cz: -6, r: 3, step: 0.3, color: 'blue' });
        F.ring('cube', { cx: -6, cz: -6, r: 3.5, step: 0.3, color: 'blue' });
        F.block('dice', { cx: -6, cz: -6, w: 0.84, d: 0.84, step: 0.42, n: 4, color: 'yellow' });
        F.rect('brick', { cx: 6, cz: -6, w: 4, d: 4, step: 0.62, color: 'green', yaw: 0 });
        F.rect('brick', { cx: -6, cz: 6, w: 3, d: 3, step: 0.62, color: 'orange', yaw: PI / 2 });
        F.line('cube', { x0: -13, z0: -13.5, x1: 13, z1: -13.5, step: 0.3, color: 'blue' });
        F.rect('dice', { cx: 1, cz: 8.5, w: 3, d: 2.5, step: 0.42, color: 'yellow' });
      } },
    { name: '水果盤', floor: 'slate', size: 30, time: 150, holeR: 0.55, start: [0, 2], official: true,
      goals: [['tomato', 42], ['pear', 52], ['backpack', 4], ['watermelon', 4]], avoid: [],
      build(F) {
        [[-11, -11], [11, -11], [-11, 11], [11, 11]].forEach(([x, z]) => F.add('backpack', x, z, { yaw: 0.3 }));
        F.rect('watermelon', { cx: -7, cz: -6, w: 1, d: 2, step: 1.0, yaw: 0 });
        F.rect('watermelon', { cx: 7.5, cz: 7, w: 1, d: 2, step: 1.0, yaw: 0 });
        F.block('plate', { cx: -3.5, cz: -8, w: 1.8, d: 1.2, step: 0.62, n: 6 });
        F.rect('plum', { cx: 3, cz: -7, w: 3, d: 2.4, step: 0.32 });
        F.line('slice', { x0: 4, z0: -3, x1: 4, z1: 5, step: 0.62, color: 'lemon' });
        F.line('slice', { x0: -4, z0: 9, x1: 4, z1: 9, step: 0.62, color: 'lemon' });
        F.rect('pear', { cx: -8, cz: 5, w: 3.3, d: 3.3, step: 0.6 });
        F.rect('pear', { cx: 9, cz: -3, w: 2.4, d: 3.6, step: 0.6 });
        F.rect('tomato', { cx: 0, cz: 12, w: 6, d: 1.2, step: 0.55 });
        F.rect('tomato', { cx: 9, cz: -11.8, w: 3, d: 1.2, step: 0.55 });
        F.scatter('apple', { n: 14, color: 'red' });
      } },
    { name: '火箭基地', floor: 'slate', size: 32, time: 150, holeR: 0.55, start: [0, 1], official: true,
      goals: [['rocket', 5], ['jeep', 5], ['dice', 150, 'white'], ['cube', 400, 'blue']], avoid: [],
      build(F) {
        [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, -13]].forEach(([x, z]) => F.add('rocket', x, z, {}));
        [[-12.5, 0], [12.5, 0], [-6, 12.5], [6, 12.5], [0, 7]].forEach(([x, z]) => F.add('jeep', x, z, { yaw: 0.4 }));
        F.add('abacus', 5, 4, { yaw: 0.3 });
        F.block('cube', { cx: -7, cz: -8, w: 3.6, d: 1.2, step: 0.3, n: 3, color: 'red' });
        F.block('dice', { cx: 5, cz: -8, w: 2.1, d: 2.1, step: 0.42, n: 4, color: 'white' });
        F.rect('dice', { cx: -3, cz: 3, w: 2.1, d: 1.7, step: 0.42, color: 'white' });
        for (let k = 0; k < 4; k++) F.line('cube', { x0: -10 + k * 0.32, z0: -4, x1: -10 + k * 0.32, z1: 10, step: 0.3, color: 'blue' });
        F.spiral('cube', { cx: 6, cz: 3, r0: 1.4, r1: 4.5, gap: 0.7, step: 0.3, color: 'blue' });
        F.line('cube', { x0: -6, z0: -13.5, x1: 6, z1: -13.5, step: 0.3, color: 'blue' });
        F.pyramid('gumball', { cx: -4, cz: 9, n: 4, step: 0.42 });
        F.pyramid('gumball', { cx: 10, cz: 7, n: 3, step: 0.42 });
        F.scatter('duck', { n: 12 });
      } },
  ];

  // ---------- 第 17 關之後：程序生成 ----------
  // 核心是「尺寸階梯」：同一關裡東西分成好幾層，越大的要黑洞升越多級才吞得下（放大版本用 s 倍率）；
  // 越後面層數越多、數量越多。時間不是用公式猜，而是用 simulate() 模擬玩家實際跑一遍再乘上寬裕倍數。
  // 每個主題：地板、物品池（[種類, 顏色?]）。分層時從池子裡挑，不同層不會用同一種物品（任務才不會混在一起算）
  const GEN = [
    { name: '城市街道', floor: 'city', pool: [['cone'], ['hydrant'], ['trash'], ['flower', 'yellow'], ['can', 'red'], ['papercup', 'green'], ['lamp'], ['bush'], ['bench'], ['tree'], ['pine'], ['car', 'red'], ['car', 'blue'], ['building', 'a']] },
    { name: '公園野餐', floor: 'grass', pool: [['flower', 'pink'], ['duck'], ['bird'], ['soccer'], ['juicebox'], ['ball', 'blue'], ['apple', 'red'], ['bush'], ['bench'], ['tree'], ['pine'], ['lamp'], ['trash']] },
    { name: '開心農場', floor: 'grass', pool: [['chicken'], ['turnip'], ['onion'], ['egg'], ['broccoli'], ['barrel'], ['crate'], ['hay'], ['pumpkin'], ['sheep'], ['pig'], ['tree']] },
    { name: '水果市集', floor: 'sky', pool: [['plum'], ['cherry'], ['strawberry'], ['orange'], ['tomato'], ['apple', 'green'], ['pear'], ['peach'], ['melonslice'], ['avocado'], ['pie'], ['watermelon'], ['pumpkin']] },
    { name: '甜點店', floor: 'pink', pool: [['gumball'], ['macaron', 'pink'], ['cookie'], ['icecream', 'mint'], ['jar'], ['candy', 'red'], ['cocoa'], ['popsicle', 'yellow'], ['cupcake', 'blue'], ['waffle'], ['donut', 'choc'], ['cake', 'pink']] },
    { name: '壽司吧', floor: 'blue', pool: [['maki', 'salmon'], ['maki', 'cucumber'], ['nigiri', 'tuna'], ['cup'], ['plate'], ['shrimp'], ['onigiri'], ['egg'], ['pot'], ['boat'], ['soydish']] },
    { name: '玩具房', floor: 'purple', pool: [['cube', 'blue'], ['gumball'], ['dice', 'yellow'], ['star'], ['gift', 'red'], ['duck'], ['brick', 'green'], ['minitrain'], ['ringstack'], ['rocket'], ['arcade'], ['abacus'], ['helicopter'], ['jeep'], ['toytrain']] },
    { name: '家電行', floor: 'slate', pool: [['can', 'white'], ['walkie'], ['mic'], ['juicebox'], ['hairdryer'], ['headphones', 'pink'], ['phone'], ['blender'], ['radio'], ['microwave'], ['tv'], ['fridge']] },
    { name: '運動場', floor: 'grass', pool: [['tennis'], ['billiard'], ['flipflop'], ['basketball'], ['soccer'], ['ball', 'red'], ['juicebox'], ['racket'], ['crate'], ['board'], ['boat']] },
    { name: '樂器派對', floor: 'purple', pool: [['mic'], ['dice', 'white'], ['star'], ['headphones', 'purple'], ['gift', 'blue'], ['hairdryer'], ['trumpet'], ['radio'], ['tv'], ['violin'], ['abacus']] },
  ];
  // 各層的目標半徑：第 0 層原尺寸（開局就能吃），之後每層大約要再升 1～2 級
  const TIER_R = [0, 0.6, 0.78, 0.95, 1.25, 1.55, 1.85];
  // 黑洞第 n 級的半徑（與 game.js radiusOf 相同：起始 0.55，每級 +30%），能吞下 r ≤ 半徑 × 0.95 的東西
  const holeR = (n) => 0.55 * (1 + 0.3 * (n - 1));
  const needLv = (r) => { let n = 1; while (holeR(n) * 0.95 < r) n++; return n; };
  const STACKABLE = ['cube', 'dice', 'brick', 'crate', 'gift', 'cheese', 'plate', 'juicebox', 'can', 'papercup', 'macaron', 'cookie', 'hay', 'barrel', 'gumball', 'waffle'];
  const WALKERS = ['chicken', 'pig', 'sheep', 'person'];
  const MODES = ['night', 'normal', 'maze', 'chase', 'spin', 'normal', 'keymaze', 'order', 'shrink', 'normal', 'normal'];
  const MODE_NAME = { maze: '迷宮', chase: '追逐', order: '順序', night: '夜晚', boss: '頭目', spin: '旋轉盤', keymaze: '鑰匙迷宮', shrink: '縮圈' };
  const MODE_TIP = {
    maze: '牆吃不掉也穿不過，繞路找出所有目標！',
    chase: '小動物看到黑洞會逃跑，把牠們逼到角落再吃！',
    order: '要照順序吃：吃完第一項，下一項才會解鎖。',
    night: '天黑了！只有黑洞周圍看得見，慢慢摸索。',
    boss: '頭目出現！先把黑洞養到最大，再一口吞掉牠！',
    spin: '有些東西放在旋轉盤上，抓準時機再吃！',
    keymaze: '彩色的門擋住了去路，吃到同色鑰匙門就會打開！',
    shrink: '場地會越縮越小，沒用的東西會被擠出場外，任務物會被推往中間！',
  };
  // 整關的擺法：同心圓（越外圈越大）、條紋（從下往上越來越大）、島嶼、扇形、城市街區、隨機群落
  const LAYOUTS = ['rings', 'stripes', 'islands', 'sectors', 'blocks', 'clusters'];
  const PATTERNS = ['grid', 'towers', 'pyramid', 'rings', 'spiral', 'rows', 'mosaic', 'disc', 'scatter'];
  const SPEED_K = 0.2; // 搖桿速度係數（game.js 共用）：世界速度 = 鏡頭高度 × 0.2

  // 迷宮：N×N 格，從中央格開始挖。用「成長樹」法：大多時候從已挖區域隨機挑一格往外挖（像 Prim，岔路很多），
  // 偶爾接著最新那格挖（做出一點長走道），避免整個迷宮只有一條路走到底；再隨機打通一些牆做出環路
  function makeMaze(N, R, braid) {
    const key = (a, b, c, d) => (a < c || (a === c && b < d) ? `${a},${b}|${c},${d}` : `${c},${d}|${a},${b}`);
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const mid = (N - 1) / 2, open = new Set(), seen = new Set([mid + ',' + mid]), active = [[mid, mid]], parent = {};
    while (active.length) {
      const i = R() < 0.75 ? Math.floor(R() * active.length) : active.length - 1;
      const [a, b] = active[i];
      const nb = DIRS.map(([x, y]) => [a + x, b + y]).filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && !seen.has(x + ',' + y));
      if (!nb.length) { active.splice(i, 1); continue; }
      const [x, y] = nb[Math.floor(R() * nb.length)];
      open.add(key(a, b, x, y));
      seen.add(x + ',' + y);
      parent[x + ',' + y] = [a, b];
      active.push([x, y]);
    }
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      if (a < N - 1 && R() < braid) open.add(key(a, b, a + 1, b));
      if (b < N - 1 && R() < braid) open.add(key(a, b, a, b + 1));
    }
    const deg = (a, b) => DIRS.filter(([x, y]) => open.has(key(a, b, a + x, b + y))).length;
    // 從中央走過去要幾步（越深的格子放越大的東西）
    const depth = { [mid + ',' + mid]: 0 }, q = [[mid, mid]];
    while (q.length) {
      const [a, b] = q.shift();
      DIRS.forEach(([x, y]) => {
        const c = a + x, d = b + y;
        if (c < 0 || d < 0 || c >= N || d >= N || depth[c + ',' + d] != null || !open.has(key(a, b, c, d))) return;
        depth[c + ',' + d] = depth[a + ',' + b] + 1;
        q.push([c, d]);
      });
    }
    return { N, open, key, deg, parent, depth };
  }

  // 模擬玩家：貪心地往最近、吞得下的東西移動（任務物優先），沿路順便吞掉路徑旁的東西。
  // 速度、成長規則都跟 game.js 一樣（手機直式畫面）。回傳完成秒數；卡關（吃不到任務物）回傳 Infinity
  function simulate(L, items) {
    const goals = (L.goals || []).filter((g) => g[0] !== 'star');
    const isGoal = (it) => goals.some(([k, , c]) => it.kind === k && (!c || it.color === c));
    const list = items.map((it) => {
      const r = H.KINDS[it.kind].r * (it.s || 1);
      return { x: it.x, z: it.z, r, pts: Math.max(1, Math.round(r * 10)), goal: isGoal(it), alive: it.kind !== 'bomb' && it.kind !== 'key' };
    });
    const total = list.reduce((t, e) => t + e.pts, 0);
    const xpUnit = L.xpUnit || Math.max(2, Math.round((total * 0.8) / 36));
    const maxR = L.maxR || (L.size / 2) * 0.3;
    let left = list.filter((e) => e.goal && e.alive).length;
    let x = (L.start || [0, 0])[0], z = (L.start || [0, 0])[1], size = 1, xp = 0, R = holeR(1), t = 0;
    const eat = (e) => {
      e.alive = false;
      if (e.goal) left--;
      xp += e.pts;
      while (holeR(size + 1) <= maxR && xp >= xpUnit * size) { xp -= xpUnit * size; size++; }
      R = holeR(size);
    };
    for (let guard = 0; left > 0 && guard < 5000; guard++) {
      let best = null, bd = 1e9;
      for (const e of list) {
        if (!e.alive || e.r > R * 0.95) continue;
        const d = Math.hypot(e.x - x, e.z - z) - (e.goal ? 2.5 : 0); // 任務物優先一點
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return Infinity;
      const tx = best.x, tz = best.z, dist = Math.hypot(tx - x, tz - z);
      const speed = (7 + R * 5.5) * 1.5 * SPEED_K * (1 + Math.min(0.18, (size - 1) * 0.02));
      t += Math.max(0, dist - R * 0.6) / speed + 0.08;
      // 沿路吞掉路徑旁的東西
      const sx = x, sz = z;
      for (const e of list) {
        if (!e.alive || e.r > R * 0.95) continue;
        const vx = tx - sx, vz = tz - sz, l2 = vx * vx + vz * vz || 1;
        const k = Math.max(0, Math.min(1, ((e.x - sx) * vx + (e.z - sz) * vz) / l2));
        if (Math.hypot(sx + vx * k - e.x, sz + vz * k - e.z) < R - e.r * 0.4) eat(e);
      }
      x = tx; z = tz;
      if (best.alive) eat(best);
    }
    return left > 0 ? Infinity : t;
  }

  // 檢查每個任務物是不是「黑洞找得到位置吞它」：黑洞剛好夠大、以及長到最大時都要吃得到
  // （規則同 game.js：洞中心離邊緣至少半個洞、離牆至少半個洞、不能隔牆吃；縮圈關用縮到最小的邊界）。回傳吃不到的物品
  function checkReach(L, items) {
    const goals = (L.goals || []).filter((g) => g[0] !== 'star');
    const walls = (L.walls || []).filter((w) => !w[4]); // 門最後都會打開
    const maxR = L.maxR || (L.size / 2) * 0.3;
    const edge = (L.size / 2) * (L.shrink ? L.shrink.to : 1);
    let top = 1;
    while (holeR(top + 1) <= maxR) top++;
    const cross = (ax, az, bx, bz) => walls.some(([wx, wz, ww, wd]) => {
      let t0 = 0, t1 = 1;
      for (const [p, d, lo, hi] of [[ax, bx - ax, wx - ww / 2, wx + ww / 2], [az, bz - az, wz - wd / 2, wz + wd / 2]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
        let u = (lo - p) / d, v = (hi - p) / d;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v);
        if (t0 > t1) return false;
      }
      return true;
    });
    const bad = [];
    for (const it of items) {
      if (!goals.some(([k, , c]) => it.kind === k && (!c || it.color === c))) continue;
      const r = H.KINDS[it.kind].r * (it.s || 1);
      const lv0 = needLv(r);
      if (lv0 > top) { bad.push([it, '太大']); continue; }
      const lim0 = edge - r * 0.6;
      const x = Math.max(-lim0, Math.min(lim0, it.x)), z = Math.max(-lim0, Math.min(lim0, it.z));
      const ok = [lv0, top].every((lv) => {
        const R = holeR(lv), reach = Math.max(R - r * 0.4, R * 0.35), lim = edge - R * 0.5 - 0.1;
        for (const k of [0, 0.3, 0.6, 0.9]) for (let a = 0; a < 24; a++) {
          const px = x + Math.cos((a / 24) * PI * 2) * reach * k, pz = z + Math.sin((a / 24) * PI * 2) * reach * k;
          if (Math.abs(px) > lim + 1e-6 || Math.abs(pz) > lim + 1e-6) continue;
          if (walls.some(([wx, wz, ww, wd]) => Math.hypot(px - Math.max(wx - ww / 2, Math.min(wx + ww / 2, px)), pz - Math.max(wz - wd / 2, Math.min(wz + wd / 2, pz))) < R * 0.5 - 1e-6)) continue;
          if (cross(px, pz, x, z)) continue;
          return true;
        }
        return false;
      });
      if (!ok) bad.push([it, '位置吃不到']);
    }
    return bad;
  }

  // o.idx / o.mode：每日挑戰用來指定難度與關型（n 只當亂數種子）
  // 洗牌用 Fisher–Yates：用 sort(() => R() - 0.5) 的話，結果取決於瀏覽器的排序演算法，
  // iPhone Safari 和 Chrome 會生出不一樣的關卡
  function shuffleWith(R, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function genLevel(n, o) {
    o = o || {};
    const R = rng(n * 977 + 3);
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const shuffle = (arr) => shuffleWith(R, arr);
    const idx = o.idx || n - LEVELS.length;     // 1, 2, 3...
    // 難度曲線（全部跟著 idx 慢慢變）：
    //   層數 3 → 7（每 8 關 +1）、每層數量逐關增加、任務 3 → 5 項
    //   炸彈：idx 13 起出現　　時間＝模擬秒數 × 寬裕倍數（1.7 → 1.3，每關 -0.008）
    //   每 10 關一個頭目關：最上層是一隻超巨大頭目
    const hard = !o.mode && idx % 10 === 0;
    const mode = o.mode || (hard ? 'boss' : MODES[idx % MODES.length]);
    const boss = mode === 'boss', chase = mode === 'chase', keymaze = mode === 'keymaze';
    const theme = GEN[(n * 7 + Math.floor(idx / 3)) % GEN.length];
    const size = Math.min(38, 30 + Math.floor(idx / 8));
    const h = size / 2;
    const MN = size >= 34 ? 7 : 5, cellW = size / MN; // 場地大就切更多格，岔路更多
    const maze = mode === 'maze' || keymaze ? makeMaze(MN, R, keymaze ? 0 : 0.22) : null;
    const layoutKind = maze ? 'maze' : o.layout || LAYOUTS[(idx * 5 + n) % LAYOUTS.length];

    // ---- 尺寸階梯：挑每一層的物品 ----
    let nt = Math.min(7, 3 + Math.floor(idx / 8));
    if (boss) nt = 7;
    if (maze) nt = Math.min(nt, 5); // 迷宮裡黑洞不能太大
    const pool = shuffle(theme.pool.filter(([k]) => !(WALKERS.includes(k) && !chase && k !== 'chicken')));
    const runners = chase ? [['chicken', Math.min(18, 8 + Math.floor(idx / 6)), 1], ['pig', Math.min(5, 2 + Math.floor(idx / 20)), 0.62 / 0.5]] : [];
    const used = new Set(runners.map((x) => x[0]));
    // 從池子挑一種：符合 fn 的物品裡，原尺寸最接近 want 的（放大倍率才不會太誇張）
    const take = (fn, want) => {
      const c = pool.filter((p) => !used.has(p[0]) && fn(H.KINDS[p[0]].r))
        .sort((a, b) => Math.abs(Math.log(H.KINDS[a[0]].r / want)) - Math.abs(Math.log(H.KINDS[b[0]].r / want)));
      const p = c[0];
      if (p) used.add(p[0]);
      return p;
    };
    // 第 0 層：兩種原尺寸小東西（一種是任務，一種當雜物）
    const t0 = [take((r) => r <= 0.3, 0.12 + R() * 0.16), take((r) => r <= 0.34, 0.25)].filter(Boolean);
    const tiers = [{ k: 0, kinds: t0.map((p) => ({ p, s: 1 })), r: 0.3 }];
    for (let k = 1; k < nt; k++) {
      const tr = boss && k === nt - 1 ? 1.95 : TIER_R[k];
      // 挑原尺寸接近這層的物品，再放大到目標半徑（最多放大 4 倍）
      const p = take((r) => r <= tr * 1.1 && r >= tr / 4, tr / 1.8) || take((r) => r <= tr * 1.1, tr / 1.8);
      if (!p) break;
      tiers.push({ k, kinds: [{ p, s: Math.max(1, tr / H.KINDS[p[0]].r) }], r: tr });
    }
    nt = tiers.length;

    // 每層的數量：越後面越多
    const more = 1 + Math.min(1.2, idx * 0.02);
    const T0_N = Math.round(Math.min(420, (90 + idx * 3) * more));
    const tierN = (k) => (k === 0 ? T0_N : boss && k === nt - 1 ? 1 : Math.max(2, Math.round([0, 26, 16, 10, 6, 4, 3][k] * more)));

    const L = {
      name: (MODE_NAME[mode] ? MODE_NAME[mode] + '・' : '') + theme.name,
      floor: theme.floor, size, holeR: 0.55, hard, mode, tip: MODE_TIP[mode],
      avoid: idx >= 13 ? [['bomb']] : [],
      start: layoutKind === 'stripes' ? [0, h - 3] : [0, 0],
    };
    if (maze) L.maxR = cellW * 0.36;
    if (chase) L.flee = 1.3 + Math.min(0.5, idx * 0.006);
    if (mode === 'order') L.ordered = true;
    if (mode === 'night') L.night = true;
    if (mode === 'shrink') L.shrink = { to: 0.5, t0: 0.15, t1: 0.8 };
    if (boss) L.boss = tiers[nt - 1].kinds[0].p[0];

    // 鑰匙迷宮的門
    const doors = [];
    if (keymaze) {
      const kid = {};
      Object.entries(maze.parent).forEach(([c, [a, b]]) => { (kid[a + ',' + b] = kid[a + ',' + b] || []).push(c); });
      const sub = (c) => [c].concat(...(kid[c] || []).map(sub));
      const usedRoot = new Set();
      shuffle(Object.keys(maze.parent)).forEach((c) => {
        if (doors.length >= 2) return;
        const cells = sub(c);
        // 門後區域可以巢狀（先開外層門再開內層門），鑰匙一律放在所有門外，所以一定解得開
        if (cells.length < 2 || cells.length > 8 || usedRoot.has(c)) return;
        usedRoot.add(c);
        doors.push({ cell: c.split(',').map(Number), from: maze.parent[c], cells, color: ['red', 'blue', 'yellow'][doors.length] });
      });
    }

    L.build = (F) => {
      // 擺放只能用 F.R（依 L.seed），遊戲重排時才會跟算任務時一模一樣
      const R = F.R;
      const pick = (arr) => arr[Math.floor(R() * arr.length)];
      const shuffle = (arr) => shuffleWith(R, arr);
      const st0 = (p) => Math.max(0.27, H.KINDS[p[0]].r * 2.05);
      const canStack = (p) => STACKABLE.includes(p[0]);
      const sx = L.start[0], sz = L.start[1];

      // 一堆第 0 層小東西：從 9 種擺法挑一種，want 為大約要擺幾個
      function pile(p, cx, cz, want, ext, filler) {
        const st = st0(p);
        let pt = pick(PATTERNS);
        if ((pt === 'towers' || pt === 'pyramid') && !canStack(p)) pt = pick(['grid', 'rows', 'disc']);
        const side = Math.min(ext * 2, Math.sqrt(want) * st * 1.05);
        const o2 = { cx, cz, color: p[1] };
        switch (pt) {
          case 'grid': F.rect(p[0], { ...o2, w: side, d: side * 0.8, step: st, yaw: R() < 0.5 ? 0 : PI / 4 }); break;
          case 'towers': F.block(p[0], { ...o2, w: side * 0.5, d: side * 0.5, step: st * 1.02, n: 2 + Math.floor(R() * 3) }); break;
          case 'pyramid': F.pyramid(p[0], { ...o2, n: Math.max(3, Math.min(6, Math.floor(side / st))), step: st * 0.98 }); break;
          case 'rings': F.rings(p[0], { ...o2, r0: 0.7, r1: side * 0.56, gap: st * 1.8, step: st, face: 'radial' }); break;
          case 'spiral': F.spiral(p[0], { ...o2, r0: 0.6, r1: side * 0.6, gap: st * 2.2, step: st, face: 'tangent' }); break;
          case 'rows':
            for (let r = -side / 2; r <= side / 2; r += st * 2.2)
              F.line(p[0], { x0: cx - side / 2, z0: cz + r, x1: cx + side / 2, z1: cz + r, step: st, color: p[1], yaw: 0 });
            break;
          case 'mosaic': {
            const f2 = filler || ['gumball'];
            const stripe = R() < 0.5, ss = Math.max(st, st0(f2));
            F.shape({ cx, cz, w: side, d: side, step: ss,
              fn: (x, zz) => ((stripe ? Math.floor((x + side) / (ss * 2)) : Math.floor((x + side) / ss) + Math.floor((zz + side) / ss)) % 2 ? f2 : p) });
            break;
          }
          case 'disc': F.disc(p[0], { ...o2, r: side * 0.5, step: st }); break;
          default: F.scatter(p[0], { n: Math.round(want * 0.8), cx, cz, r: ext });
        }
      }

      // 依擺法決定「第 k 層的東西放哪裡」：回傳一個隨機點
      const nk = nt;
      let islands = null;
      if (layoutKind === 'islands') {
        islands = [];
        for (let t = 0; t < 400 && islands.length < 7; t++) {
          const x = (R() * 2 - 1) * (h - 3.2), z = (R() * 2 - 1) * (h - 3.2);
          if (Math.hypot(x - sx, z - sz) < 4) continue;
          if (islands.every((c) => Math.hypot(c[0] - x, c[1] - z) > 7)) islands.push([x, z]);
        }
        islands.sort((a, b) => Math.hypot(a[0] - sx, a[1] - sz) - Math.hypot(b[0] - sx, b[1] - sz));
      }
      const spot = (k) => {
        const f0 = k / Math.max(1, nk - 1), jitter = () => (R() * 2 - 1);
        switch (layoutKind) {
          case 'rings': { // 越外圈越大
            const r0 = 2.5 + (h - 4) * (k / nk), r1 = 2.5 + (h - 4) * ((k + 1) / nk) + 1.5, a = R() * PI * 2, r = r0 + R() * (r1 - r0);
            return [Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15];
          }
          case 'stripes': { // 起點在下方，越往上越大
            const z1 = h - 2 - (2 * h - 4) * (k / nk), z0 = h - 2 - (2 * h - 4) * ((k + 1) / nk);
            return [jitter() * (h - 1.5), z0 + R() * (z1 - z0)];
          }
          case 'islands': { // 越遠的島放越大的東西
            const i = Math.min(islands.length - 1, Math.floor(f0 * (islands.length - 1) + R() * 1.6));
            const c = islands[Math.max(0, i)], a = R() * PI * 2, r = Math.sqrt(R()) * 3.2;
            return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
          }
          case 'sectors': { // 繞一圈的扇形，順時針越來越大
            const a = ((k + R()) / nk) * PI * 2, r = 3 + R() * (h - 4);
            return [Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1];
          }
          case 'blocks': { // 城市街區：小東西在街區裡，大東西排在街道上
            const g = size / 4, bi = Math.floor(R() * 4), bj = Math.floor(R() * 4);
            if (k === 0) return [-h + (bi + 0.5) * g + jitter() * g * 0.25, -h + (bj + 0.5) * g + jitter() * g * 0.25];
            const onX = R() < 0.5, line = -h + g * (1 + Math.floor(R() * 3));
            return onX ? [line, jitter() * (h - 1.5)] : [jitter() * (h - 1.5), line];
          }
          default: { // 群落：大東西離起點遠一點
            const r = 2.5 + (h - 3) * Math.min(1, f0 * 0.8 + R() * 0.45), a = R() * PI * 2;
            return [Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2];
          }
        }
      };

      if (maze) {
        // 先砌牆與門，之後擺的東西都會自動避開
        const c = cellW, at = (i) => -h + (i + 0.5) * c;
        for (let a = 0; a < MN; a++) for (let b = 0; b < MN; b++) {
          const x0 = -h + a * c, z0 = -h + b * c;
          if (a < MN - 1 && !maze.open.has(maze.key(a, b, a + 1, b))) F.wall(x0 + c, z0, x0 + c, z0 + c, 0.5);
          if (b < MN - 1 && !maze.open.has(maze.key(a, b, a, b + 1))) F.wall(x0, z0 + c, x0 + c, z0 + c, 0.5);
        }
        doors.forEach(({ cell: [a2, b2], from: [a1, b1], color }) => {
          if (a1 !== a2) { const x = -h + Math.max(a1, a2) * c, z0 = -h + b1 * c; F.door(x, z0, x, z0 + c, color); }
          else { const z = -h + Math.max(b1, b2) * c, x0 = -h + a1 * c; F.door(x0, z, x0 + c, z, color); }
        });
        const mid = (MN - 1) / 2;
        const locked = new Set([].concat(...doors.map((d) => d.cells)));
        const cells = [...Array(MN * MN).keys()].map((i) => [i % MN, Math.floor(i / MN)]).filter(([a, b]) => a !== mid || b !== mid);
        const free = shuffle(cells.filter(([a, b]) => !locked.has(a + ',' + b)));
        doors.forEach((d, i) => F.add('key', at(free[i][0]), at(free[i][1]), { color: d.color, yaw: R() * PI }));
        // 越深的格子（門後也算很深）放越大的東西
        // 排序鍵先算好（比較函式裡呼叫 R() 一樣會因瀏覽器而異）
        const depthKey = new Map(cells.map((c) => [c, maze.depth[c[0] + ',' + c[1]] + (locked.has(c[0] + ',' + c[1]) ? 9 : 0) + R()]));
        const deep = cells.slice().sort((p, q) => depthKey.get(p) - depthKey.get(q));
        const cellOf = (k) => deep[Math.min(deep.length - 1, Math.floor(((k + R()) / nt) * deep.length))];
        for (let k = nt - 1; k >= 1; k--) {
          const { p, s } = tiers[k].kinds[0];
          for (let i = 0, t = 0; i < tierN(k) && t < tierN(k) * 30; t++) {
            const [a, b] = cellOf(k);
            if (F.add(p[0], at(a) + (R() - 0.5) * c * 0.4, at(b) + (R() - 0.5) * c * 0.4, { color: p[1], s, yaw: R() * PI })) i++;
          }
        }
        const [g0, f0] = tiers[0].kinds.map((x) => x.p);
        const piles = shuffle(cells).slice(0, Math.round(cells.length * 0.6));
        piles.forEach(([a, b], i) => pile(i % 3 === 2 && f0 ? f0 : g0, at(a), at(b), (T0_N * 1.5) / piles.length, c * 0.26, f0));
      } else {
        // 大的先擺（比較難找位置），小的最後補滿
        for (let k = nt - 1; k >= 1; k--) {
          const { p, s } = tiers[k].kinds[0];
          let placed = 0;
          for (let t = 0; t < tierN(k) * 40 && placed < tierN(k); t++) {
            const [x, z] = spot(k);
            const it = F.add(p[0], x, z, { color: p[1], s, yaw: R() * PI * 2 });
            if (!it) continue;
            placed++;
            // 偶爾在大東西旁邊圍一圈小東西
            if (k >= 3 && R() < 0.35) F.ring(tiers[0].kinds[0].p[0], { cx: it.x, cz: it.z, r: H.KINDS[p[0]].r * s + 0.6, step: st0(tiers[0].kinds[0].p), color: tiers[0].kinds[0].p[1], face: 'radial' });
          }
        }
        runners.forEach(([k, c, s]) => {
          for (let i = 0, t = 0; i < c && t < c * 40; t++) if (F.add(k, ...spot(Math.floor(R() * nt)), { s })) i++;
        });
        // 第 0 層：分成好幾堆，旋轉盤關的前 3 堆放在轉盤上
        const [g0, f0] = tiers[0].kinds.map((x) => x.p);
        const nPiles = Math.max(5, Math.min(12, Math.round(T0_N / 30)));
        for (let i = 0; i < nPiles; i++) {
          const [x, z] = spot(0);
          const cx = Math.max(-h + 3, Math.min(h - 3, x)), cz = Math.max(-h + 3, Math.min(h - 3, z));
          const p = i % 3 === 2 && f0 ? f0 : g0;
          if (mode === 'spin' && i < 3) {
            const sr = 3.4, sp = (0.45 + Math.min(0.45, idx * 0.006)) * (i % 2 ? -1 : 1);
            F.spinner(cx, cz, sr, sp);
            pile(p, cx, cz, (T0_N / nPiles) * 1.2, sr * 0.8, f0);
          } else pile(p, cx, cz, (T0_N / nPiles) * 1.2, 3.2, f0);
        }
      }
      if (L.avoid.length) F.scatter('bomb', { n: Math.min(12, 3 + Math.floor((idx - 13) / 6)) });
    };

    // 先排一次算出實際數量，決定任務（數量＝場上數量，一個都不能漏）
    const probe = Object.assign({ seed: n * 1013 + 7 }, L);
    const items = layout(probe);
    const cnt = (p, s) => items.filter((it) => it.kind === p[0] && (!p[1] || it.color === p[1]) && (s == null || (it.s || 1) === s)).length;
    // 任務層：第 0 層、最上層，中間再挑 1～3 層（越後面越多）
    const goalTiers = [0];
    const midN = Math.min(nt - 2, idx < 10 ? 1 : idx < 30 ? 2 : 3);
    for (let i = 1; i <= midN; i++) goalTiers.push(Math.round((i * (nt - 1)) / (midN + 1)));
    if (nt > 1) goalTiers.push(nt - 1);
    L.goals = [];
    [...new Set(goalTiers)].forEach((k) => {
      const { p } = tiers[k].kinds[0];
      const c = k === 0 ? Math.min(cnt(p), Math.round(T0_N * 0.75)) : cnt(p);
      if (c > 0) L.goals.push(p[1] ? [p[0], c, p[1]] : [p[0], c]);
    });
    runners.forEach(([k]) => { const c = cnt([k]); if (c) L.goals.splice(1, 0, [k, c]); });

    // 時間：模擬玩家跑一遍 × 寬裕倍數（人會比貪心機器人慢、會繞路）
    const final = layout(Object.assign({}, probe, { goals: L.goals }));
    // 成長速度（逐層校正）：每一層都要先吃掉「比它小的東西」約六成，才升到吞得下這層的等級
    const pts = final.filter((it) => it.kind !== 'bomb' && it.kind !== 'key')
      .map((it) => { const r = H.KINDS[it.kind].r * (it.s || 1); return [r, Math.max(1, Math.round(r * 10))]; });
    let unit = Infinity;
    tiers.slice(1).forEach(({ r }) => {
      const lv = needLv(r);
      if (lv <= 1) return;
      const below = pts.reduce((t, [rr, p]) => t + (rr < r * 0.99 ? p : 0), 0);
      unit = Math.min(unit, (0.6 * below) / ((lv * (lv - 1)) / 2));
    });
    L.xpUnit = isFinite(unit) ? Math.max(1, Math.floor(unit)) : null;
    const sim = simulate(L, final);
    L.sim = Math.round(sim);
    const modeK = { maze: 1.3, keymaze: 1.4, chase: 1.35, order: 1.15, night: 1.15, spin: 1.05, shrink: 1, boss: 1.3, normal: 1 }[mode] || 1;
    L.slack = Math.max(1.3, 1.7 - (idx - 1) * 0.008) * modeK * (hard ? 0.95 : 1);
    L.time = isFinite(sim) ? Math.max(60, Math.min(300, Math.round((sim * L.slack + 10) / 5) * 5)) : 300;
    return L;
  }

  // 每日挑戰：用日期當種子，難度固定在中段（約第 40 關），關型每天輪替
  function getDaily(day) {
    const n = 100000 + day;
    const L = genLevel(n, { idx: 24, mode: ['normal', 'maze', 'chase', 'order', 'night', 'boss', 'spin', 'keymaze', 'shrink'][day % 9] });
    L.name = '每日挑戰・' + L.name;
    return Object.assign({ seed: n * 1013 + 7, start: [0, 0] }, L);
  }

  const SIM_CACHE = new Map();
  function getLevel(n) {
    const base = n <= LEVELS.length ? LEVELS[n - 1] : genLevel(n);
    const L = Object.assign({ seed: n * 1013 + 7, start: [0, 0] }, base);
    // 前 16 關：任務照官方，但時間改用模擬計算（官方原本的限時配合的是官方的速度，放到這裡太寬鬆）
    // 第 1 關給模擬時間的 2.5 倍，逐關降到第 16 關的 1.75 倍，接上第 17 關之後的 1.7 倍；星星點數關保留原時間
    if (n <= LEVELS.length && !L.goals.some((g) => g[0] === 'star')) {
      if (!SIM_CACHE.has(n)) SIM_CACHE.set(n, simulate(L, layout(Object.assign({}, L)))); // 每關只算一次
      const sim = SIM_CACHE.get(n);
      if (isFinite(sim)) {
        L.sim = Math.round(sim);
        L.time = Math.max(60, Math.round((sim * (2.5 - ((n - 1) * 0.75) / 15) + 10) / 5) * 5);
      }
    }
    return L;
  }

  Object.assign(H, { rng, FLOORS, groundTexture, layout, hiddenGoals, getLevel, getDaily, simulate, checkReach, SPEED_K, LEVEL_COUNT: LEVELS.length });
})();
