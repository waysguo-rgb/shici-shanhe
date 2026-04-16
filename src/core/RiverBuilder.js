// River ribbon mesh generation
import * as THREE from 'three';
import { RIVER_PTS } from '../data/constants.js';
import { ll2s, s2ll, inLand, dBd } from './helpers.js';
import { hAt, hAtMax, scaleH, getH } from './TerrainBuilder.js';
import { mkSilkTex } from './textures.js';
import RIVERS from '../data/rivers.js';

// Mutable state
export const riverMeshes = [];
export const riverLabels = []; // {el, pos:Vector3, name}

// ═══════════════════════════════════════
// Build a single river ribbon mesh
// ═══════════════════════════════════════
export function mkRiver(coords, width, riverName) {
  width = width || 0.5;
  const ctrl = coords.map(([lo, la]) => {
    const [x, z] = ll2s(lo, la);
    return new THREE.Vector3(x, 0, z);
  });
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
  const N = Math.max(RIVER_PTS, 600);
  let cpts = curve.getPoints(N);

  // Estuary detection
  const _lc = coords[coords.length - 1], isEstuary = dBd(_lc[0], _lc[1]) < 1.5;
  const origLen = cpts.length;
  if (isEstuary) {
    const _lk = Math.min(20, Math.floor(origLen * .03));
    const _dx = cpts[origLen - 1].x - cpts[origLen - 1 - _lk].x;
    const _dz = cpts[origLen - 1].z - cpts[origLen - 1 - _lk].z;
    const _dl = Math.sqrt(_dx * _dx + _dz * _dz) || 1;
    const eLen = width * 2, eN = 10;
    for (let k = 1; k <= eN; k++) {
      const t = k / eN;
      cpts.push(new THREE.Vector3(
        cpts[origLen - 1].x + (_dx / _dl) * eLen * t,
        -0.04,
        cpts[origLen - 1].z + (_dz / _dl) * eLen * t
      ));
    }
  } else {
    for (let i = cpts.length - 1; i >= 0; i--) {
      const [lo, la] = s2ll(cpts[i].x, cpts[i].z);
      if (inLand(lo, la)) { if (i < cpts.length - 1) cpts = cpts.slice(0, i + 1); break; }
    }
  }

  const rw = Math.max(0.22, width * 0.85);
  const hw = rw / 2;
  const heights = [];
  const SAMPLE_R = 0.60;
  const SAMPLE_L = 0.20;
  for (let i = 0; i < cpts.length; i++) {
    const p = cpts[i];
    let tx = 0, tz = 0;
    if (i > 0) { tx += p.x - cpts[i - 1].x; tz += p.z - cpts[i - 1].z; }
    if (i < cpts.length - 1) { tx += cpts[i + 1].x - p.x; tz += cpts[i + 1].z - p.z; }
    const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
    const nx = -tz, nz = tx;
    let minH = 999;
    for (let k = -5; k <= 5; k++) {
      const off = k / 5 * SAMPLE_R;
      for (let df = -2; df <= 2; df++) {
        const dl = df / 2 * SAMPLE_L;
        const sx = p.x + nx * off + tx * dl;
        const sz = p.z + nz * off + tz * dl;
        const ys = hAtMax(sx, sz);
        if (ys < minH) minH = ys;
      }
    }
    heights.push(minH);
  }

  const smH = new Array(cpts.length);
  const WIN = 15;
  for (let i = 0; i < cpts.length; i++) {
    let s = 0, n = 0;
    for (let k = -WIN; k <= WIN; k++) {
      const j = i + k; if (j < 0 || j >= cpts.length) continue;
      const w = WIN + 1 - Math.abs(k); s += heights[j] * w; n += w;
    }
    smH[i] = s / n + 0.12;
  }

  // Estuary: force descent to sea level in last 18%
  if (isEstuary) {
    const _fs = Math.floor(origLen * .82), _sh = smH[_fs];
    for (let i = _fs; i < cpts.length; i++) {
      const t = (i - _fs) / (cpts.length - 1 - _fs || 1);
      smH[i] = _sh * (1 - t) + (-0.02) * t;
    }
  }

  cpts.forEach((p, i) => { p.y = smH[i]; });

  // Generate strip vertices
  const verts = [], uvs = [], indices = [];
  for (let i = 0; i < cpts.length; i++) {
    const p = cpts[i];
    let tx = 0, tz = 0;
    if (i > 0) { tx += p.x - cpts[i - 1].x; tz += p.z - cpts[i - 1].z; }
    if (i < cpts.length - 1) { tx += cpts[i + 1].x - p.x; tz += cpts[i + 1].z - p.z; }
    const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
    const nx = -tz, nz = tx;
    let wScale = rw * (0.88 + 0.22 * Math.sin(i / cpts.length * Math.PI));
    // Estuary flare
    if (isEstuary) {
      const _t = i / (cpts.length - 1), _es = .78 * origLen / (cpts.length - 1);
      if (_t > _es) { const _e = (_t - _es) / (1 - _es); wScale *= 1 + _e * _e * rw * 25; }
    }
    const half = wScale / 2;
    verts.push(p.x + nx * half, p.y, p.z + nz * half,
      p.x - nx * half, p.y, p.z - nz * half);
    const u = i / (cpts.length - 1) * 6;
    uvs.push(u, 0, u, 1);
    if (i < cpts.length - 1) { const b = i * 2; indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  const tex = mkSilkTex();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -10;
  mat.polygonOffsetUnits = -10;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  const startH = getH(coords[0][0], coords[0][1]);
  const endH = getH(coords[coords.length - 1][0], coords[coords.length - 1][1]);
  mesh.userData = { tex, flow: startH >= endH ? -1 : 1, name: riverName, curvePts: cpts };
  riverMeshes.push(mesh);
  return mesh;
}

// ═══════════════════════════════════════
// River labels (DOM elements positioned in 3D)
// ═══════════════════════════════════════
export function buildRiverLabels() {
  const cont = document.getElementById('rlbls');
  riverMeshes.forEach((m, idx) => {
    if (!m.userData.name) return;
    const cpts = m.userData.curvePts;
    const r = RIVERS[idx];
    const frac = (r.lblAt || Math.floor(r.c.length / 2)) / (r.c.length - 1);
    const at = Math.min(cpts.length - 1, Math.max(0, Math.floor(frac * (cpts.length - 1))));
    const p = cpts[at];
    const el = document.createElement('div');
    el.className = 'rlb';
    el.textContent = m.userData.name;
    cont.appendChild(el);
    riverLabels.push({ el, pos: new THREE.Vector3(p.x, p.y + .4, p.z), name: m.userData.name });
  });
}
