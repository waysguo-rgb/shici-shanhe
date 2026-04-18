// Low-level utility functions — NO Three.js dependency
import { CL, CA, SX, SY } from '../data/constants.js';
import { BD_LIST } from '../data/boundaries.js';

// ═══════════════════════════════════════
// Noise helpers
// ═══════════════════════════════════════
export function hash2(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function n2d(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy,
    u = fade(fx), v = fade(fy);
  return (hash2(ix, iy) * (1 - u) + hash2(ix + 1, iy) * u) * (1 - v) +
    (hash2(ix, iy + 1) * (1 - u) + hash2(ix + 1, iy + 1) * u) * v - 0.5;
}

export function fbm(x, y, o) {
  let v = 0, a = 1, f = 1, t = 0;
  for (let i = 0; i < (o || 4); i++) {
    v += n2d(x * f, y * f) * a; t += a; a *= .5; f *= 2;
  }
  return v / t;
}

export function gauss(x, c, s) {
  return Math.exp(-.5 * ((x - c) / s) ** 2);
}

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function ridge(lo, la, x0, y0, x1, y1, w, h) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  if (!l2) return h * gauss(lo, x0, w) * gauss(la, y0, w);
  const t = Math.max(0, Math.min(1, ((lo - x0) * dx + (la - y0) * dy) / l2));
  const d = Math.sqrt((lo - (x0 + t * dx)) ** 2 + (la - (y0 + t * dy)) ** 2);
  return h * Math.exp(-.5 * (d / w) ** 2);
}

// ═══════════════════════════════════════
// Geometry helpers: boundary, point-in-polygon
// ═══════════════════════════════════════
export function pip(px, py, po) {
  let i2 = false;
  for (let i = 0, j = po.length - 1; i < po.length; j = i++) {
    const [xi, yi] = po[i], [xj, yj] = po[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      i2 = !i2;
  }
  return i2;
}

export function inLand(lo, la) {
  for (let i = 0; i < BD_LIST.length; i++)
    if (pip(lo, la, BD_LIST[i])) return true;
  return false;
}

export function dBd(lo, la) {
  let m = 999;
  for (let p = 0; p < BD_LIST.length; p++) {
    const po = BD_LIST[p];
    for (let i = 0; i < po.length; i++) {
      const j = (i + 1) % po.length;
      const [ax, ay] = po[i], [bx, by] = po[j];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      if (l2 < 1e-9) {
        const d = Math.sqrt((lo - ax) ** 2 + (la - ay) ** 2);
        if (d < m) m = d;
        continue;
      }
      const t = Math.max(0, Math.min(1, ((lo - ax) * dx + (la - ay) * dy) / l2));
      const d = Math.sqrt((lo - (ax + t * dx)) ** 2 + (la - (ay + t * dy)) ** 2);
      if (d < m) m = d;
    }
  }
  return m;
}

// dSea — 类似 dBd, 但只统计"海岸段":
// 片段中点位于中国东/南海岸 bbox 内才算 (lon 108–124, lat 18–41.5).
// 内陆国境 (新疆/内蒙/东北俄朝段) 被过滤掉, 所以海岸坡度平滑不会波及内陆边境.
function _isCoastalSeg(mLo, mLa) {
  return mLo >= 108 && mLo <= 124.5 && mLa >= 18 && mLa <= 41.5;
}
export function dSea(lo, la) {
  let m = 999;
  for (let p = 0; p < BD_LIST.length; p++) {
    const po = BD_LIST[p];
    for (let i = 0; i < po.length; i++) {
      const j = (i + 1) % po.length;
      const [ax, ay] = po[i], [bx, by] = po[j];
      const mLo = (ax + bx) * 0.5, mLa = (ay + by) * 0.5;
      if (!_isCoastalSeg(mLo, mLa)) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      if (l2 < 1e-9) {
        const d = Math.sqrt((lo - ax) ** 2 + (la - ay) ** 2);
        if (d < m) m = d;
        continue;
      }
      const t = Math.max(0, Math.min(1, ((lo - ax) * dx + (la - ay) * dy) / l2));
      const d = Math.sqrt((lo - (ax + t * dx)) ** 2 + (la - (ay + t * dy)) ** 2);
      if (d < m) m = d;
    }
  }
  return m;
}

// ═══════════════════════════════════════
// Coordinate transforms
// ═══════════════════════════════════════
export function ll2s(lo, la) {
  return [(lo - CL) * SX, -(la - CA) * SY];
}

export function s2ll(x, z) {
  return [x / SX + CL, -z / SY + CA];
}
