// River ribbon system.
// 旧实现: 每条河一个 Mesh, 各自 THREE.CanvasTexture 独立 tex.offset 驱动流动.
//         14 条河 → 14 个 draw call + 14 个 material + 14 份纹理实例.
// 新实现: 把所有河流的几何合并为一个 BufferGeometry, per-vertex `flowSpeed`
//         属性告诉 shader 这顶点属于哪条河的流向 (+1/-1). 单一 ShaderMaterial
//         共享一张 silk 纹理, uTime 驱动 UV 滚动.
//         14 draw call → 1, 材质/纹理 14 份 → 1 份. 手机 GPU 受益显著.
import * as THREE from 'three';
import { RIVER_PTS } from '../data/constants.js';
import { ll2s, s2ll, inLand, dBd } from './helpers.js';
import { hAt, hAtMax, scaleH, getH } from './TerrainBuilder.js';
import { mkSilkTex } from './textures.js';
import RIVERS from '../data/rivers.js';

// Mutable state. `riverMeshes` contains the single merged mesh (post-finalize)
// so the animate loop can still iterate it for uniform updates.
export const riverMeshes = [];
export const riverLabels = []; // {el, pos:Vector3, name}

// Pending per-river buffers, populated by mkRiver, consumed by finalizeRivers.
const _pendingGeoms = [];
const _pendingInfo = [];  // { name, curvePts, flow, lblAt }

// ═══════════════════════════════════════
// Build a single river's geometry chunk (no mesh, no scene add).
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

  const _lc = coords[coords.length - 1], isEstuary = dBd(_lc[0], _lc[1]) < 1.5;
  const origLen = cpts.length;
  if (isEstuary) {
    const _lk = Math.min(20, Math.floor(origLen * .03));
    const _dx = cpts[origLen - 1].x - cpts[origLen - 1 - _lk].x;
    const _dz = cpts[origLen - 1].z - cpts[origLen - 1 - _lk].z;
    const _dl = Math.sqrt(_dx * _dx + _dz * _dz) || 1;
    const eLen = width * 4.5, eN = 28;
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
  const heights = [];
  const SAMPLE_R = 0.60, SAMPLE_L = 0.20;
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
        const ys = hAtMax(p.x + nx * off + tx * dl, p.z + nz * off + tz * dl);
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

  if (isEstuary) {
    const _fs = Math.floor(origLen * .82), _sh = smH[_fs];
    for (let i = _fs; i < cpts.length; i++) {
      const t = (i - _fs) / (cpts.length - 1 - _fs || 1);
      smH[i] = _sh * (1 - t) + (-0.02) * t;
    }
  }

  cpts.forEach((p, i) => { p.y = smH[i]; });

  // flow direction: +1 means coords go downstream; -1 means upstream to downstream
  const startH = getH(coords[0][0], coords[0][1]);
  const endH = getH(coords[coords.length - 1][0], coords[coords.length - 1][1]);
  const flow = startH >= endH ? -1 : 1;

  // Generate strip vertices + per-vertex attributes
  const verts = [], uvs = [], indices = [], colors = [], flows = [];
  for (let i = 0; i < cpts.length; i++) {
    const p = cpts[i];
    let tx = 0, tz = 0;
    if (i > 0) { tx += p.x - cpts[i - 1].x; tz += p.z - cpts[i - 1].z; }
    if (i < cpts.length - 1) { tx += cpts[i + 1].x - p.x; tz += cpts[i + 1].z - p.z; }
    const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
    const nx = -tz, nz = tx;
    const tSourceMouth = Math.min(1, i / Math.max(1, origLen - 1));
    let wScale = rw * (0.55 + 0.75 * tSourceMouth);
    wScale *= 0.97 + 0.05 * Math.sin(i * 0.11);
    let rR = 1, rG = 1, rB = 1, rA = 1;
    if (isEstuary) {
      const _t = i / (cpts.length - 1);
      const flareStart = .85 * origLen / (cpts.length - 1);
      if (_t > flareStart) {
        const _e = Math.min(1, (_t - flareStart) / (1 - flareStart));
        wScale *= 1 + _e * _e * rw * 25;
      }
      const fadeStart = origLen / (cpts.length - 1);
      if (_t > fadeStart) {
        const _f = Math.min(1, (_t - fadeStart) / (1 - fadeStart));
        rA = 1 - _f;
      }
    }
    const half = wScale / 2;
    verts.push(p.x + nx * half, p.y, p.z + nz * half,
               p.x - nx * half, p.y, p.z - nz * half);
    const u = i / (cpts.length - 1) * 6;
    uvs.push(u, 0, u, 1);
    colors.push(rR, rG, rB, rA, rR, rG, rB, rA);
    flows.push(flow, flow);
    if (i < cpts.length - 1) { const b = i * 2; indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position',  new THREE.Float32BufferAttribute(verts,  3));
  geo.setAttribute('uv',        new THREE.Float32BufferAttribute(uvs,    2));
  geo.setAttribute('color',     new THREE.Float32BufferAttribute(colors, 4));
  geo.setAttribute('flowSpeed', new THREE.Float32BufferAttribute(flows,  1));

  _pendingGeoms.push(geo);
  _pendingInfo.push({ name: riverName, curvePts: cpts });
}

// ═══════════════════════════════════════
// Merge all pending river geometries into ONE mesh + single shader material.
// Call AFTER all mkRiver() invocations, then add returned mesh to scene.
// ═══════════════════════════════════════
export function finalizeRivers(scene) {
  if (_pendingGeoms.length === 0) return null;

  // Manual concat (avoid BufferGeometryUtils dep; our geoms all share same attribute layout).
  let vTotal = 0, iTotal = 0;
  for (const g of _pendingGeoms) {
    vTotal += g.attributes.position.count;
    iTotal += g.index.count;
  }
  const positions = new Float32Array(vTotal * 3);
  const uvs       = new Float32Array(vTotal * 2);
  const colors    = new Float32Array(vTotal * 4);
  const flows     = new Float32Array(vTotal);
  const indices   = new Uint32Array(iTotal);
  let vOff = 0, iOff = 0;
  for (const g of _pendingGeoms) {
    positions.set(g.attributes.position.array, vOff * 3);
    uvs      .set(g.attributes.uv.array,       vOff * 2);
    colors   .set(g.attributes.color.array,    vOff * 4);
    flows    .set(g.attributes.flowSpeed.array, vOff);
    const gi = g.index.array;
    for (let k = 0; k < gi.length; k++) indices[iOff + k] = gi[k] + vOff;
    vOff += g.attributes.position.count;
    iOff += gi.length;
    g.dispose();
  }
  _pendingGeoms.length = 0;

  const merged = new THREE.BufferGeometry();
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.setAttribute('position',  new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv',        new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute('color',     new THREE.BufferAttribute(colors, 4));
  merged.setAttribute('flowSpeed', new THREE.BufferAttribute(flows, 1));
  merged.computeBoundingSphere();

  const silkTex = mkSilkTex();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap:  { value: silkTex },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute vec4 color;
      attribute float flowSpeed;
      varying vec2 vUv;
      varying vec4 vColor;
      varying float vFlow;
      void main() {
        vUv = uv;
        vColor = color;
        vFlow = flowSpeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec4 vColor;
      varying float vFlow;
      void main() {
        vec2 uv = vec2(vUv.x + uTime * 0.045 * vFlow, vUv.y);
        vec4 tex = texture2D(uMap, uv);
        float opPulse = 0.88 + sin(uTime * 0.6 + vFlow * 3.14159) * 0.05;
        gl_FragColor = vec4(tex.rgb, tex.a * opPulse) * vColor;
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -10;
  mat.polygonOffsetUnits  = -10;

  const mesh = new THREE.Mesh(merged, mat);
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  mesh.renderOrder = 3;
  mesh.userData = { name: '__rivers_merged__' };
  scene.add(mesh);
  riverMeshes.length = 0;
  riverMeshes.push(mesh);
  return mesh;
}

// Per-frame tick (call from animate). Single uniform update regardless of river count.
export function updateRivers(t) {
  if (riverMeshes.length === 0) return;
  const m = riverMeshes[0];
  if (m && m.material && m.material.uniforms && m.material.uniforms.uTime) {
    m.material.uniforms.uTime.value = t;
  }
}

// ═══════════════════════════════════════
// River labels — uses pending infos captured during mkRiver
// ═══════════════════════════════════════
export function buildRiverLabels() {
  const cont = document.getElementById('rlbls');
  _pendingInfo.forEach((info, idx) => {
    if (!info.name) return;
    const r = RIVERS[idx];
    const frac = (r.lblAt || Math.floor(r.c.length / 2)) / (r.c.length - 1);
    const cpts = info.curvePts;
    const at = Math.min(cpts.length - 1, Math.max(0, Math.floor(frac * (cpts.length - 1))));
    const p = cpts[at];
    const el = document.createElement('div');
    el.className = 'rlb';
    el.textContent = info.name;
    cont.appendChild(el);
    riverLabels.push({ el, pos: new THREE.Vector3(p.x, p.y + .4, p.z), name: info.name });
  });
}
