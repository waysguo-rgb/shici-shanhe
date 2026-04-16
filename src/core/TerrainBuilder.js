// Terrain heightmap, DEM loading, terrain mesh, and sea mesh
import * as THREE from 'three';
import { CL, CA, SX, SY, PW, PH, BGC, SGWT, SGHT, LOD_LO_W, LOD_LO_H, LOD_SWITCH_DIST,
         Z, TS, TX0, TY0, TX1, TY1, TC, TR_, MW, MH, SEA_SEG } from '../data/constants.js';
import { BD_LIST } from '../data/boundaries.js';
import { n2d, fbm, gauss, smoothstep, ridge, inLand, dBd, ll2s, s2ll } from './helpers.js';

// ═══════════════════════════════════════
// DEM loading
// ═══════════════════════════════════════
let hd = null;

function loadTile(tx, ty) {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res({ img, tx, ty });
    img.onerror = () => res(null);
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`;
  });
}

export async function loadDEM(prog) {
  const j = [];
  for (let ty = TY0; ty <= TY1; ty++)
    for (let tx = TX0; tx <= TX1; tx++) j.push(loadTile(tx, ty));
  let d = 0;
  const r = await Promise.all(j.map(p => p.then(r => {
    d++;
    if (prog) prog.style.width = (d / j.length * 40) + '%';
    return r;
  })));
  const ok = r.filter(Boolean);
  if (!ok.length) return null;
  const c = document.createElement('canvas');
  c.width = MW; c.height = MH;
  const cx = c.getContext('2d');
  ok.forEach(({ img, tx, ty }) => cx.drawImage(img, (tx - TX0) * TS, (ty - TY0) * TS));
  return cx.getImageData(0, 0, MW, MH);
}

export function setHD(data) { hd = data; }
export function getHD() { return hd; }

function ll2px(lo, la) {
  const px = ((lo + 180) / 360 * Math.pow(2, Z) - TX0) * TS;
  const lr = la * Math.PI / 180;
  const py = ((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * Math.pow(2, Z) - TY0) * TS;
  return [px, py];
}

function sampleDEM(lo, la) {
  if (!hd) return null;
  const [px, py] = ll2px(lo, la);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  if (x0 < 0 || x0 >= MW - 1 || y0 < 0 || y0 >= MH - 1) return null;
  const fx = px - x0, fy = py - y0;
  const s = (x, y) => {
    const i = (y * MW + x) * 4;
    return (hd.data[i] * 256 + hd.data[i + 1] + hd.data[i + 2] / 256) - 32768;
  };
  return s(x0, y0) * (1 - fx) * (1 - fy) + s(x0 + 1, y0) * fx * (1 - fy) +
    s(x0, y0 + 1) * (1 - fx) * fy + s(x0 + 1, y0 + 1) * fx * fy;
}

// ═══════════════════════════════════════
// Procedural terrain height
// ═══════════════════════════════════════
function procH(lo, la) {
  if (!inLand(lo, la)) return -50 - dBd(lo, la) * 80;
  let h = 50; const cd = Math.min(1, dBd(lo, la) / 3);
  h += ridge(lo, la, 78, 28, 95, 28, 1.5, 8000); h += ridge(lo, la, 74, 36, 100, 36, 2.5, 5500);
  h += ridge(lo, la, 75, 42, 95, 43, 2.5, 4500); h += ridge(lo, la, 94, 38, 103, 37, 2, 4200);
  h += ridge(lo, la, 104, 34, 113, 34, 1.2, 2800); h += ridge(lo, la, 113, 35, 115, 40, 1.2, 2200);
  h += ridge(lo, la, 108, 25, 116, 25.5, 1.5, 1600); h += ridge(lo, la, 116, 24.5, 118.5, 28, 1.3, 1400);
  h += ridge(lo, la, 109, 30, 110.5, 32, 1.5, 2200); h += ridge(lo, la, 126, 41, 129, 44, 2, 2200);
  h += ridge(lo, la, 119, 44, 126, 50, 2, 1500); h += ridge(lo, la, 107, 41, 114, 42, 1.5, 1800);
  h += ridge(lo, la, 96, 24, 100, 32, 2, 4800); h += ridge(lo, la, 88, 33, 95, 33, 2, 5200);
  h += ridge(lo, la, 80, 31, 88, 31, 2, 5800); h += ridge(lo, la, 103, 32, 104.5, 34, 1, 3200);
  h += ridge(lo, la, 96, 34, 101, 34, 2, 4200); h += ridge(lo, la, 108, 28, 111, 30, 1.5, 1500);
  h += ridge(lo, la, 85, 47, 92, 49, 2, 2500); h += ridge(lo, la, 105.8, 38, 106.5, 40, .8, 2800);
  h += 4200 * gauss(lo, 88, 12) * gauss(la, 33, 6);
  h += 1800 * gauss(lo, 104, 5) * gauss(la, 25, 4);
  h += 1000 * gauss(lo, 112, 10) * gauss(la, 43, 4);
  h += 1300 * gauss(lo, 108, 5) * gauss(la, 37, 3);
  h -= 2200 * gauss(lo, 105, 3) * gauss(la, 30.5, 2.5);
  h -= 3000 * gauss(lo, 83, 6) * gauss(la, 39, 3);
  h -= 2200 * gauss(lo, 86, 5) * gauss(la, 45, 2.5);
  h -= 800 * gauss(lo, 116, 4) * gauss(la, 36, 4);
  h -= 600 * gauss(lo, 117, 5) * gauss(la, 31, 2);
  h -= 900 * gauss(lo, 125, 4) * gauss(la, 45, 4);
  const plain = Math.max(
    gauss(lo, 115, 6) * gauss(la, 35, 4),
    gauss(lo, 117, 5) * gauss(la, 31, 3),
    gauss(lo, 125, 5) * gauss(la, 45, 4)
  );
  if (plain > 0.1) h = h * (1 - plain * 0.8) + 50 * plain * 0.8;
  const nf = smoothstep(200, 800, h);
  h += fbm(lo * .3, la * .3, 4) * 500 * cd * nf;
  h += fbm(lo * .8 + 50, la * .8 + 50, 3) * 200 * nf;
  h *= cd;
  return Math.max(1, h);
}

export function getH(lo, la) {
  if (!inLand(lo, la)) {
    return -200 - dBd(lo, la) * 100;
  }
  const d = sampleDEM(lo, la);
  if (d !== null && isFinite(d)) {
    if (d < 5) return -50;
    const nf = smoothstep(200, 800, d);
    return d + n2d(lo * 2.5, la * 2.5) * 50 * nf * Math.min(1, Math.max(0, (d - 100) / 2000)) + n2d(lo * 8, la * 8) * 30 * nf;
  }
  const p = procH(lo, la); return isFinite(p) ? p : 0;
}

export function scaleH(m) {
  if (!isFinite(m)) return -0.6;
  if (m <= 0) return Math.max(-2, m * 0.005 - 0.3);
  if (m < 300) return m * 0.0005;
  if (m < 600) {
    const t = smoothstep(300, 600, m);
    return 0.15 * (1 - t) + (0.15 + Math.pow((600 - 200) / 8800, .55) * 8.5 * ((600 - 300) / 8800)) * t;
  }
  return Math.pow(m / 9000, .55) * 10;
}

// ═══════════════════════════════════════
// Terrain coloring
// ═══════════════════════════════════════
function tColor(h, lo, la) {
  if (!inLand(lo, la) || h < 5) { return [.42, .55, .42]; }
  const S = [
    [-5, .50, .58, .38], [10, .48, .58, .30], [60, .44, .54, .28],
    [200, .36, .48, .24], [400, .30, .42, .22], [700, .24, .36, .18],
    [1100, .20, .32, .16], [1500, .16, .28, .14], [2000, .13, .24, .13],
    [2400, .11, .22, .11], [2800, .10, .20, .10], [3400, .09, .19, .10],
    [4000, .09, .18, .11], [4600, .10, .19, .12], [5200, .14, .22, .15],
    [5800, .28, .34, .26], [6500, .60, .66, .58], [7500, .88, .90, .85]
  ];
  let r, g, b;
  if (h <= S[0][0]) { [, r, g, b] = S[0]; }
  else if (h >= S[S.length - 1][0]) { [, r, g, b] = S[S.length - 1]; }
  else {
    for (let i = 0; i < S.length - 1; i++) {
      if (h >= S[i][0] && h < S[i + 1][0]) {
        const t = (h - S[i][0]) / (S[i + 1][0] - S[i][0]);
        const u = t * t * (3 - 2 * t);
        r = S[i][1] + (S[i + 1][1] - S[i][1]) * u;
        g = S[i][2] + (S[i + 1][2] - S[i][2]) * u;
        b = S[i][3] + (S[i + 1][3] - S[i][3]) * u;
        break;
      }
    }
  }
  if (r === undefined) { r = .6; g = .4; b = .25; }

  const desert = Math.max(0,
    gauss(lo, 83, 7) * gauss(la, 39, 4) * .95 +
    gauss(lo, 102, 6) * gauss(la, 40, 3) * .65 +
    gauss(lo, 86, 6) * gauss(la, 45, 3) * .50 +
    gauss(lo, 108, 4) * gauss(la, 38, 3) * .55
  );
  if (desert > .06 && h > -5 && h < 4000) {
    const k = Math.min(.75, desert);
    r = r * (1 - k) + .82 * k; g = g * (1 - k) + .68 * k; b = b * (1 - k) + .38 * k;
  }

  const veg = Math.max(0,
    gauss(lo, 113, 8) * gauss(la, 26, 6) * 1.0 +
    gauss(lo, 109, 6) * gauss(la, 30, 4) * .85 +
    gauss(lo, 118, 5) * gauss(la, 28, 4) * .95 +
    gauss(lo, 128, 5) * gauss(la, 46, 5) * .75 +
    gauss(lo, 101, 4) * gauss(la, 25, 4) * .95 +
    gauss(lo, 116, 4) * gauss(la, 32, 4) * .75
  );
  if (veg > .05 && h > 10 && h < 1500) {
    const v = Math.min(.60, veg) * (1 - smoothstep(1000, 1600, h));
    r = r * (1 - v * .30) + .55 * v * .30;
    g = g * (1 - v * .10) + .62 * v * .10;
    b = b * (1 - v * .30) + .36 * v * .30;
  }

  if (h > 30 && h < 2800) {
    const tree = n2d(lo * 8, la * 8) + n2d(lo * 16 + 17, la * 16 + 17) * .5;
    const treeMask = smoothstep(40, 300, h) * (1 - smoothstep(2000, 2800, h));
    const tStr = Math.max(0, tree) * .08 * treeMask;
    r -= tStr * .45; g -= tStr * .35; b -= tStr * .55;
  }

  const ridgeNoise = Math.abs(n2d(lo * 2, la * 2)) * Math.abs(n2d(lo * 4 + 33, la * 4 + 33));
  if (h > 400) {
    const inkStrength = Math.min(1, (h - 400) / 1200) * ridgeNoise * 2.0;
    r -= inkStrength * .16; g -= inkStrength * .14; b -= inkStrength * .10;
  }

  if (h > 800) {
    const layerNoise = Math.abs(n2d(lo * 3, la * 3)) * Math.abs(n2d(lo * 6 + 19, la * 6 + 19));
    const layer = smoothstep(800, 3000, h) * layerNoise * 1.8;
    r -= layer * .10; g -= layer * .13; b -= layer * .08;
  }

  if (h > 2500) {
    const peak = smoothstep(2500, 4500, h);
    const peakNoise = (n2d(lo * 5, la * 5) * .5 + .5);
    const coolWash = peak * peakNoise * .20;
    r = r * (1 - coolWash) + .28 * coolWash;
    g = g * (1 - coolWash) + .34 * coolWash;
    b = b * (1 - coolWash) + .32 * coolWash;
  }

  if (h > 100 && h < 2200) {
    const wash = n2d(lo * 0.8, la * 0.8) * 0.5 + 0.5;
    const washStr = wash * 0.06 * smoothstep(100, 800, h);
    r -= washStr; g -= washStr * 0.95; b -= washStr * 0.85;
  }

  const slope = n2d(lo * 3.5, la * 3.5) * .05;
  r += slope * 1.1; g += slope; b += slope * .75;

  const grain = n2d(lo * 12, la * 12) * .022 + n2d(lo * 28 + 99, la * 28 + 99) * .012;
  return [
    Math.max(0, Math.min(1, r + grain)),
    Math.max(0, Math.min(1, g + grain * .85)),
    Math.max(0, Math.min(1, b + grain * .65))
  ];
}

// ═══════════════════════════════════════
// Height maps and terrain mesh references (mutable state)
// ═══════════════════════════════════════
export let terrainRef = null;
export let terrainLoRef = null;
export let terrainLOD = null;
export let hMap = null;
export let hMapLo = null;

// ═══════════════════════════════════════
// Build terrain mesh
// ═══════════════════════════════════════
export async function buildTerrain(sgwt, sght) {
  const geo = new THREE.PlaneGeometry(PW, PH, sgwt, sght);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const total = pos.count;
  for (let i = 0; i < total; i++) {
    const sx = pos.getX(i), sz = pos.getZ(i);
    const [lo, la] = s2ll(sx, sz);
    const hm = getH(lo, la);
    const inL = inLand(lo, la);
    const sy = inL ? scaleH(hm) : 0;
    pos.setY(i, isFinite(sy) ? sy : 0);
  }
  geo.computeVertexNormals();
  const cols = [];
  const nor = geo.attributes.normal;
  const lx = -30, ly = 70, lz = 25;
  const ll = Math.hypot(lx, ly, lz);
  const ldx = lx / ll, ldy = ly / ll, ldz = lz / ll;
  const l2x = 40, l2y = 40, l2z = -30;
  const l2l = Math.hypot(l2x, l2y, l2z);
  const l2dx = l2x / l2l, l2dy = l2y / l2l, l2dz = l2z / l2l;
  for (let s = 0; s < total; s += 3000) {
    const end = Math.min(s + 3000, total);
    for (let i = s; i < end; i++) {
      const sx = pos.getX(i), sz = pos.getZ(i);
      const [lo, la] = s2ll(sx, sz);
      const hm = getH(lo, la);
      const inL = inLand(lo, la);
      const [r0, g0, b0] = tColor(isFinite(hm) ? hm : 0, lo, la);
      let fr = r0, fg = g0, fb = b0;
      if (!inL) {
        const dist = dBd(lo, la);
        const t = Math.min(1, Math.max(0, dist / 2.5));
        const u = t * t * (3 - 2 * t);
        fr = r0 * (1 - u) + BGC[0] * u;
        fg = g0 * (1 - u) + BGC[1] * u;
        fb = b0 * (1 - u) + BGC[2] * u;
      }
      if (inL) {
        const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
        const nd1 = Math.max(0, nx * ldx + ny * ldy + nz * ldz);
        const nd2 = Math.max(0, nx * l2dx + ny * l2dy + nz * l2dz);
        const amb = 0.65;
        const dir1 = 0.55 * nd1;
        const dir2 = 0.18 * nd2;
        const shade = amb + dir1 + dir2;
        fr = Math.min(1, fr * shade);
        fg = Math.min(1, fg * shade);
        fb = Math.min(1, fb * shade * 0.98);
      }
      let alpha;
      if (inL) {
        alpha = 1.0;
      } else {
        const dLand = dBd(lo, la);
        const edgeD = Math.min(PW / 2 - Math.abs(sx), PH / 2 - Math.abs(sz));
        const landFade = Math.min(1, dLand / 2.2);
        const edgeFade = Math.max(0, Math.min(1, (edgeD - 3) / 18));
        alpha = edgeFade * (1 - landFade * 0.9);
      }
      cols.push(fr, fg, fb, alpha);
    }
    await new Promise(r => setTimeout(r, 0));
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: true }));
}

// ═══════════════════════════════════════
// Carve river valleys into terrain
// ═══════════════════════════════════════
export async function carveRivers(mesh, sgwt, sght, RIVERS) {
  if (!mesh) return;
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const cols = geo.attributes.color;
  const vertIdx = (gx, gz) => {
    if (gx < 0 || gx > sgwt || gz < 0 || gz > sght) return -1;
    return gz * (sgwt + 1) + gx;
  };
  const moistColor = [0.44, 0.56, 0.38];
  const nearestDist = new Float32Array(pos.count).fill(999);
  const nearestNormDist = new Float32Array(pos.count).fill(999);
  const valleyFloorY = new Float32Array(pos.count);
  const origY = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) origY[i] = pos.getY(i);

  const allRivers = RIVERS.map(r => {
    const ctrl = r.c.map(([lo, la]) => {
      const [x, z] = ll2s(lo, la);
      return new THREE.Vector3(x, 0, z);
    });
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
    const pts = curve.getPoints(400);
    return { r, pts };
  });

  allRivers.forEach(({ r, pts }) => {
    const wScale = 0.85 + r.w * 0.90;
    const valleyR = Math.max(1.2, r.w * 4.5);
    const outerR = valleyR * 2.5;
    const maxDepth = 0.35 + r.w * 0.25;
    const radInGridX = Math.ceil(outerR / PW * sgwt) + 1;
    const radInGridZ = Math.ceil(outerR / PH * sght) + 1;
    pts.forEach(rp => {
      const fgx = (rp.x + PW / 2) / PW * sgwt;
      const fgz = (rp.z + PH / 2) / PH * sght;
      const cgx = Math.round(fgx);
      const cgz = Math.round(fgz);
      for (let dz = -radInGridZ; dz <= radInGridZ; dz++) {
        for (let dx = -radInGridX; dx <= radInGridX; dx++) {
          const gx = cgx + dx, gz = cgz + dz;
          const idx = vertIdx(gx, gz);
          if (idx < 0) continue;
          const vx = pos.getX(idx);
          const vz = pos.getZ(idx);
          const ddx = vx - rp.x, ddz = vz - rp.z;
          const d = Math.sqrt(ddx * ddx + ddz * ddz);
          if (d >= outerR) continue;
          if (d < nearestDist[idx]) {
            nearestDist[idx] = d;
            const orig = origY[idx];
            let targetY;
            if (d <= valleyR) {
              targetY = orig - maxDepth;
            } else {
              const t = (d - valleyR) / (outerR - valleyR);
              const k = 1 - t * t * (3 - 2 * t);
              targetY = orig - maxDepth * k;
            }
            valleyFloorY[idx] = targetY;
          }
          const nd = d / wScale;
          if (nd < nearestNormDist[idx]) nearestNormDist[idx] = nd;
        }
      }
    });
  });

  for (let i = 0; i < pos.count; i++) {
    if (nearestDist[i] >= 999) continue;
    const orig = origY[i];
    const target = valleyFloorY[i];
    if (target < orig) { pos.setY(i, target); }
  }

  const YIELD_EVERY = Math.max(40, Math.floor(sght / 8));
  for (let pass = 0; pass < 3; pass++) {
    const smoothed = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) smoothed[i] = pos.getY(i);
    for (let gz = 1; gz < sght; gz++) {
      for (let gx = 1; gx < sgwt; gx++) {
        const idx = gz * (sgwt + 1) + gx;
        if (nearestDist[idx] >= 999) continue;
        let sum = 0, cnt = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ni = (gz + dz) * (sgwt + 1) + (gx + dx);
            sum += pos.getY(ni);
            cnt++;
          }
        }
        smoothed[idx] = sum / cnt;
      }
      if (gz % YIELD_EVERY === 0) await new Promise(r => setTimeout(r, 0));
    }
    for (let i = 0; i < pos.count; i++) {
      if (nearestDist[i] < 999) {
        const orig = pos.getY(i);
        pos.setY(i, orig * 0.3 + smoothed[i] * 0.7);
      }
    }
    await new Promise(r => setTimeout(r, 0));
  }

  if (cols) {
    const moistRad = 0.80;
    for (let i = 0; i < pos.count; i++) {
      const dist = nearestNormDist[i];
      if (dist >= moistRad) continue;
      const t = dist / moistRad;
      const k = 1 - t * t * (3 - 2 * t);
      const blend = 0.28 * k;
      const r = cols.getX(i);
      const g = cols.getY(i);
      const b = cols.getZ(i);
      cols.setXYZ(i,
        r * (1 - blend) + moistColor[0] * blend,
        g * (1 - blend) + moistColor[1] * blend,
        b * (1 - blend) + moistColor[2] * blend
      );
    }
    cols.needsUpdate = true;
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

// ═══════════════════════════════════════
// Height map construction from rendered terrain mesh
// ═══════════════════════════════════════
export function buildHMap() {
  if (!terrainRef) return;
  const pos = terrainRef.geometry.attributes.position;
  hMap = [];
  for (let j = 0; j <= SGHT; j++) {
    hMap[j] = new Float32Array(SGWT + 1);
    for (let i = 0; i <= SGWT; i++) hMap[j][i] = pos.getY(j * (SGWT + 1) + i);
  }
}

export function buildHMapLo() {
  if (!terrainLoRef) return;
  const pos = terrainLoRef.geometry.attributes.position;
  hMapLo = [];
  for (let j = 0; j <= LOD_LO_H; j++) {
    hMapLo[j] = new Float32Array(LOD_LO_W + 1);
    for (let i = 0; i <= LOD_LO_W; i++) hMapLo[j][i] = pos.getY(j * (LOD_LO_W + 1) + i);
  }
}

export function hAt(x, z) {
  if (!hMap) return 0;
  const gx = (x + PW / 2) / PW * SGWT, gz = (z + PH / 2) / PH * SGHT;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  if (ix < 0 || ix >= SGWT || iz < 0 || iz >= SGHT) return 0;
  const fx = gx - ix, fz = gz - iz;
  return hMap[iz][ix] * (1 - fx) * (1 - fz) + hMap[iz][ix + 1] * fx * (1 - fz) +
    hMap[iz + 1][ix] * (1 - fx) * fz + hMap[iz + 1][ix + 1] * fx * fz;
}

export function hAtLo(x, z) {
  if (!hMapLo) return -999;
  const gx = (x + PW / 2) / PW * LOD_LO_W, gz = (z + PH / 2) / PH * LOD_LO_H;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  if (ix < 0 || ix >= LOD_LO_W || iz < 0 || iz >= LOD_LO_H) return -999;
  const fx = gx - ix, fz = gz - iz;
  return hMapLo[iz][ix] * (1 - fx) * (1 - fz) + hMapLo[iz][ix + 1] * fx * (1 - fz) +
    hMapLo[iz + 1][ix] * (1 - fx) * fz + hMapLo[iz + 1][ix + 1] * fx * fz;
}

export function hAtMax(x, z) {
  const a = hAt(x, z);
  const b = hAtLo(x, z);
  return b > a ? b : a;
}

// ═══════════════════════════════════════
// Sea mesh
// ═══════════════════════════════════════
export let seaMesh = null;
export let seaBaseY = null;

export function buildSea() {
  const geo = new THREE.PlaneGeometry(200, 160, SEA_SEG, SEA_SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  seaBaseY = new Float32Array(pos.count);
  const cols = [];
  const cx = 8, cz = 0;
  const rx = 85, rz = 65;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    seaBaseY[i] = -0.04;
    pos.setY(i, -0.04);
    const d = Math.sqrt(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2);
    const alpha = Math.max(0, Math.min(1, 1.4 - d));
    const fd = Math.pow(alpha, 1.5);
    const noise = n2d(x * .15, z * .15) * .04 + n2d(x * .4 + 50, z * .4 + 50) * .02;
    const r = 0.42 + noise * .3;
    const g = 0.55 + noise * .3;
    const b = 0.38 + noise * .3;
    cols.push(r, g, b, fd);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false });
  seaMesh = new THREE.Mesh(geo, mat);
  seaMesh.renderOrder = -1;
  return seaMesh;
}

// Setters for mutable references (called from SceneManager after build)
export function setTerrainRef(ref) { terrainRef = ref; }
export function setTerrainLoRef(ref) { terrainLoRef = ref; }
export function setTerrainLOD(lod) { terrainLOD = lod; }
