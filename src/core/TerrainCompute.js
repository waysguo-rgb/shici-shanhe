// Pure terrain compute — no THREE, no module state. Callable from main thread or Web Worker.
// Operates on raw Float32Arrays / Uint8ClampedArrays to allow zero-copy transfer.
import { n2d, fbm, gauss, smoothstep, ridge, inLand, dBd, s2ll } from './helpers.js';

// ═══ DEM sampling on raw Uint8Clamped buffer ═══
function sampleDEMRaw(lo, la, hdData, Z, TX0, TY0, TS, MW, MH) {
  if (!hdData) return null;
  const pow = Math.pow(2, Z);
  const px = ((lo + 180) / 360 * pow - TX0) * TS;
  const lr = la * Math.PI / 180;
  const py = ((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * pow - TY0) * TS;
  const x0 = Math.floor(px), y0 = Math.floor(py);
  if (x0 < 0 || x0 >= MW - 1 || y0 < 0 || y0 >= MH - 1) return null;
  const fx = px - x0, fy = py - y0;
  const s = (x, y) => {
    const i = (y * MW + x) * 4;
    return (hdData[i] * 256 + hdData[i + 1] + hdData[i + 2] / 256) - 32768;
  };
  return s(x0, y0) * (1 - fx) * (1 - fy) + s(x0 + 1, y0) * fx * (1 - fy) +
    s(x0, y0 + 1) * (1 - fx) * fy + s(x0 + 1, y0 + 1) * fx * fy;
}

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

export function getHRaw(lo, la, hdData, K) {
  if (!inLand(lo, la)) return -200 - dBd(lo, la) * 100;
  const d = sampleDEMRaw(lo, la, hdData, K.Z, K.TX0, K.TY0, K.TS, K.MW, K.MH);
  if (d !== null && isFinite(d)) {
    if (d < 5) return -50;
    const nf = smoothstep(200, 800, d);
    return d + n2d(lo * 2.5, la * 2.5) * 50 * nf * Math.min(1, Math.max(0, (d - 100) / 2000)) + n2d(lo * 8, la * 8) * 30 * nf;
  }
  const p = procH(lo, la);
  return isFinite(p) ? p : 0;
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

const CS = [
  // 海岸过渡加两段: 极浅处偏米沙, 退到内陆恢复灰绿底色, 形成宽约 0.3 单位的沙滩条
  [-5, .50, .58, .38], [2, .60, .58, .42], [12, .58, .58, .38], [30, .48, .56, .30], [60, .44, .54, .28],
  [200, .36, .48, .24], [400, .30, .42, .22], [700, .24, .36, .18],
  [1100, .20, .32, .16], [1500, .16, .28, .14], [2000, .13, .24, .13],
  [2400, .11, .22, .11], [2800, .10, .20, .10], [3400, .09, .19, .10],
  [4000, .09, .18, .11], [4600, .10, .19, .12], [5200, .14, .22, .15],
  [5800, .28, .34, .26], [6500, .60, .66, .58], [7500, .88, .90, .85]
];

function tColor(h, lo, la) {
  if (!inLand(lo, la) || h < 5) return [.42, .55, .42];
  let r, g, b;
  if (h <= CS[0][0]) { r = CS[0][1]; g = CS[0][2]; b = CS[0][3]; }
  else if (h >= CS[CS.length - 1][0]) { const L = CS[CS.length - 1]; r = L[1]; g = L[2]; b = L[3]; }
  else {
    for (let i = 0; i < CS.length - 1; i++) {
      if (h >= CS[i][0] && h < CS[i + 1][0]) {
        const t = (h - CS[i][0]) / (CS[i + 1][0] - CS[i][0]);
        const u = t * t * (3 - 2 * t);
        r = CS[i][1] + (CS[i + 1][1] - CS[i][1]) * u;
        g = CS[i][2] + (CS[i + 1][2] - CS[i][2]) * u;
        b = CS[i][3] + (CS[i + 1][3] - CS[i][3]) * u;
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

// ═══ Vertex normals from plane-topology positions ═══
function addTriNormal(pos, nor, a, b, c) {
  const ax = pos[a * 3],     ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
  const bx = pos[b * 3],     by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
  const cx = pos[c * 3],     cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  nor[a * 3] += nx; nor[a * 3 + 1] += ny; nor[a * 3 + 2] += nz;
  nor[b * 3] += nx; nor[b * 3 + 1] += ny; nor[b * 3 + 2] += nz;
  nor[c * 3] += nx; nor[c * 3 + 1] += ny; nor[c * 3 + 2] += nz;
}

function computeNormalsRaw(positions, sgwt, sght) {
  const gridX1 = sgwt + 1;
  const N = gridX1 * (sght + 1);
  const normals = new Float32Array(N * 3);
  for (let iy = 0; iy < sght; iy++) {
    for (let ix = 0; ix < sgwt; ix++) {
      const a = iy * gridX1 + ix;
      const b = (iy + 1) * gridX1 + ix;
      const c = (iy + 1) * gridX1 + (ix + 1);
      const d = iy * gridX1 + (ix + 1);
      addTriNormal(positions, normals, a, b, d);
      addTriNormal(positions, normals, b, c, d);
    }
  }
  for (let i = 0; i < N * 3; i += 3) {
    const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    normals[i] = nx / l; normals[i + 1] = ny / l; normals[i + 2] = nz / l;
  }
  return normals;
}

// ═══ Compute positions + colors for a plane grid of (sgwt+1)×(sght+1) verts ═══
// Grid layout matches THREE.PlaneGeometry(PW, PH, sgwt, sght).rotateX(-PI/2):
//   vertex (ix, iy) at index iy*(sgwt+1)+ix  →  (x, y, z) where
//   x = ix*(PW/sgwt) - PW/2, z = iy*(PH/sght) - PH/2
export function computeTerrainArrays(sgwt, sght, hdData, K, report) {
  const { PW, PH, BGC } = K;
  const gridX1 = sgwt + 1, gridY1 = sght + 1;
  const N = gridX1 * gridY1;
  const positions = new Float32Array(N * 3);
  const colors    = new Float32Array(N * 4);
  const segX = PW / sgwt, segY = PH / sght;
  const halfW = PW / 2, halfH = PH / 2;

  // Cache raw heights + inLand to avoid recomputing in color pass
  const heightsM  = new Float32Array(N);
  const inLandArr = new Uint8Array(N);

  // Pass 1: positions + cache heights
  for (let iy = 0; iy < gridY1; iy++) {
    const z = iy * segY - halfH;
    for (let ix = 0; ix < gridX1; ix++) {
      const idx = iy * gridX1 + ix;
      const x = ix * segX - halfW;
      const [lo, la] = s2ll(x, z);
      const inL = inLand(lo, la);
      const hm = getHRaw(lo, la, hdData, K);
      heightsM[idx] = isFinite(hm) ? hm : 0;
      inLandArr[idx] = inL ? 1 : 0;
      const sy = inL ? scaleH(hm) : 0;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = isFinite(sy) ? sy : 0;
      positions[idx * 3 + 2] = z;
    }
    if (report && (iy & 31) === 0) report(0.05 + iy / gridY1 * 0.35);
  }

  // Pass 2: normals
  const normals = computeNormalsRaw(positions, sgwt, sght);
  if (report) report(0.45);

  // Pass 3: colors with lighting
  const lx = -30, ly = 70, lz = 25;
  const ll_ = Math.hypot(lx, ly, lz);
  const ldx = lx / ll_, ldy = ly / ll_, ldz = lz / ll_;
  const l2x = 40, l2y = 40, l2z = -30;
  const l2l = Math.hypot(l2x, l2y, l2z);
  const l2dx = l2x / l2l, l2dy = l2y / l2l, l2dz = l2z / l2l;

  for (let iy = 0; iy < gridY1; iy++) {
    for (let ix = 0; ix < gridX1; ix++) {
      const idx = iy * gridX1 + ix;
      const x  = positions[idx * 3];
      const zz = positions[idx * 3 + 2];
      const [lo, la] = s2ll(x, zz);
      const hm = heightsM[idx];
      const inL = inLandArr[idx] === 1;
      const [r0, g0, b0] = tColor(hm, lo, la);
      let fr = r0, fg = g0, fb = b0;
      if (!inL) {
        const dist = dBd(lo, la);
        const t = Math.min(1, Math.max(0, dist / 2.5));
        const u = t * t * (3 - 2 * t);
        fr = r0 * (1 - u) + BGC[0] * u;
        fg = g0 * (1 - u) + BGC[1] * u;
        fb = b0 * (1 - u) + BGC[2] * u;
      } else {
        const nx = normals[idx * 3], ny = normals[idx * 3 + 1], nz = normals[idx * 3 + 2];
        const nd1 = Math.max(0, nx * ldx + ny * ldy + nz * ldz);
        const nd2 = Math.max(0, nx * l2dx + ny * l2dy + nz * l2dz);
        const shade = 0.65 + 0.55 * nd1 + 0.18 * nd2;
        fr = Math.min(1, fr * shade);
        fg = Math.min(1, fg * shade);
        fb = Math.min(1, fb * shade * 0.98);
      }
      let alpha;
      if (inL) alpha = 1.0;
      else {
        const dLand = dBd(lo, la);
        const edgeD = Math.min(halfW - Math.abs(x), halfH - Math.abs(zz));
        const landFade = Math.min(1, dLand / 2.2);
        const edgeFade = Math.max(0, Math.min(1, (edgeD - 3) / 18));
        alpha = edgeFade * (1 - landFade * 0.9);
      }
      colors[idx * 4]     = fr;
      colors[idx * 4 + 1] = fg;
      colors[idx * 4 + 2] = fb;
      colors[idx * 4 + 3] = alpha;
    }
    if (report && (iy & 31) === 0) report(0.45 + iy / gridY1 * 0.35);
  }

  return { positions, colors };
}

// ═══ Carve river valleys, 3-pass box smoothing, moisture tint ═══
// riversSampled: [{ w: number, pts: Float32Array([x0, z0, x1, z1, ...]) }, ...]
export function carveRiversArrays(positions, colors, sgwt, sght, riversSampled, K, report) {
  const { PW, PH } = K;
  const gridX1 = sgwt + 1;
  const N = gridX1 * (sght + 1);
  const moistColor = [0.44, 0.56, 0.38];
  const nearestDist     = new Float32Array(N); nearestDist.fill(999);
  const nearestNormDist = new Float32Array(N); nearestNormDist.fill(999);
  const valleyFloorY    = new Float32Array(N);
  const origY           = new Float32Array(N);
  for (let i = 0; i < N; i++) origY[i] = positions[i * 3 + 1];

  for (let ri = 0; ri < riversSampled.length; ri++) {
    const { w, pts } = riversSampled[ri];
    const wScale = 0.85 + w * 0.90;
    const valleyR = Math.max(1.2, w * 4.5);
    const outerR = valleyR * 2.5;
    const maxDepth = 0.35 + w * 0.25;
    const radInGridX = Math.ceil(outerR / PW * sgwt) + 1;
    const radInGridZ = Math.ceil(outerR / PH * sght) + 1;
    const ptCount = pts.length >> 1;
    for (let pi = 0; pi < ptCount; pi++) {
      const rpx = pts[pi * 2];
      const rpz = pts[pi * 2 + 1];
      const fgx = (rpx + PW / 2) / PW * sgwt;
      const fgz = (rpz + PH / 2) / PH * sght;
      const cgx = Math.round(fgx);
      const cgz = Math.round(fgz);
      for (let dz = -radInGridZ; dz <= radInGridZ; dz++) {
        const gz = cgz + dz;
        if (gz < 0 || gz > sght) continue;
        const rowBase = gz * gridX1;
        for (let dx = -radInGridX; dx <= radInGridX; dx++) {
          const gx = cgx + dx;
          if (gx < 0 || gx > sgwt) continue;
          const idx = rowBase + gx;
          const vx = positions[idx * 3];
          const vz = positions[idx * 3 + 2];
          const ddx = vx - rpx, ddz = vz - rpz;
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
    }
  }

  for (let i = 0; i < N; i++) {
    if (nearestDist[i] >= 999) continue;
    const orig = origY[i];
    const target = valleyFloorY[i];
    if (target < orig) positions[i * 3 + 1] = target;
  }
  if (report) report(0.85);

  // 3-pass 9-tap box smoothing — direct typed-array access
  const smoothed = new Float32Array(N);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) smoothed[i] = positions[i * 3 + 1];
    for (let gz = 1; gz < sght; gz++) {
      const rowTop = (gz - 1) * gridX1;
      const rowMid = gz * gridX1;
      const rowBot = (gz + 1) * gridX1;
      for (let gx = 1; gx < sgwt; gx++) {
        const idx = rowMid + gx;
        if (nearestDist[idx] >= 999) continue;
        const sum =
          positions[(rowTop + gx - 1) * 3 + 1] + positions[(rowTop + gx) * 3 + 1] + positions[(rowTop + gx + 1) * 3 + 1] +
          positions[(rowMid + gx - 1) * 3 + 1] + positions[(rowMid + gx) * 3 + 1] + positions[(rowMid + gx + 1) * 3 + 1] +
          positions[(rowBot + gx - 1) * 3 + 1] + positions[(rowBot + gx) * 3 + 1] + positions[(rowBot + gx + 1) * 3 + 1];
        smoothed[idx] = sum / 9;
      }
    }
    for (let i = 0; i < N; i++) {
      if (nearestDist[i] < 999) {
        const orig = positions[i * 3 + 1];
        positions[i * 3 + 1] = orig * 0.3 + smoothed[i] * 0.7;
      }
    }
    if (report) report(0.85 + (pass + 1) / 3 * 0.1);
  }

  const moistRad = 0.80;
  for (let i = 0; i < N; i++) {
    const dist = nearestNormDist[i];
    if (dist >= moistRad) continue;
    const t = dist / moistRad;
    const k = 1 - t * t * (3 - 2 * t);
    const blend = 0.28 * k;
    colors[i * 4]     = colors[i * 4]     * (1 - blend) + moistColor[0] * blend;
    colors[i * 4 + 1] = colors[i * 4 + 1] * (1 - blend) + moistColor[1] * blend;
    colors[i * 4 + 2] = colors[i * 4 + 2] * (1 - blend) + moistColor[2] * blend;
  }
  if (report) report(1.0);
}
