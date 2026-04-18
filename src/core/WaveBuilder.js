// 海浪: 把原来的 Sprite billboard 换成"贴在水面"的水平 PlaneGeometry mesh,
// 让从上往下俯视时浪花真的像铺在海面上, 而不是立在水面上空飘.
import * as THREE from 'three';
import { MOB, SX, SY } from '../data/constants.js';
import { BD_MAIN } from '../data/boundaries.js';
import { inLand, ll2s } from './helpers.js';
import { _sharedWaveTex } from './textures.js';

// Mutable state
export const waveMeshes = [];
export const coastWaveData = [];

// ═══════════════════════════════════════
// Per-mesh tint 微调, 避免整片浪颜色完全一致
// ═══════════════════════════════════════
const _waveTints = [
  new THREE.Color('#dfeff5'),
  new THREE.Color('#cfe4ee'),
  new THREE.Color('#e6eef0'),
  new THREE.Color('#bfdce7'),
  new THREE.Color('#d8e8ec'),
];
function _pickTint() { return _waveTints[Math.floor(Math.random() * _waveTints.length)]; }

// 预烘一个水平朝向的 plane geometry (只做一次, 后续共享实例化不同尺寸)
// 水平放置: rotateX(-π/2) 之后 plane 的原 +Y 指向 world -Z.
function _mkWaveGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ═══════════════════════════════════════
// Strait wave patch — 海峡/浅海区浪花
// 平铺多条水平浪, 各自独立 y-rotation, 轻微 opacity 呼吸
// ═══════════════════════════════════════
export function mkWavePatch(loCen, laCen, loSpan, laSpan, loOff, laOff, name) {
  const baseW = 3.8, baseH = baseW * 0.52;
  const group = new THREE.Group();
  const [ccx, ccz] = ll2s(loCen, laCen);
  const areaW = loSpan * 1.6, areaH = laSpan * 1.8;
  const cols = Math.max(2, Math.floor(areaW / (baseW * 0.70)));
  const rows = Math.max(1, Math.floor(areaH / (baseH * 1.4)));

  const sprites = [];
  for (let r = 0; r < rows; r++) {
    for (let co = 0; co < cols; co++) {
      const px = -areaW / 2 + (co + 0.5) * areaW / cols + (r % 2 ? baseW * 0.3 : 0);
      const pz = -areaH / 2 + (r + 0.5) * areaH / rows;
      const layers = [
        { op: 0.9,  scale: 1.00 },
        { op: 0.65, scale: 0.78 },
      ];
      layers.forEach((L, idx) => {
        const jitter = 0.88 + Math.random() * 0.24;
        const sw = baseW * L.scale * jitter;
        const sh = baseH * L.scale * jitter;
        const geo = _mkWaveGeo(sw, sh);
        const mat = new THREE.MeshBasicMaterial({
          map: _sharedWaveTex,
          transparent: true,
          opacity: L.op,
          depthWrite: false,
          color: _pickTint().clone(),
          side: THREE.DoubleSide,
        });
        const sp = new THREE.Mesh(geo, mat);
        const baseAngle = Math.random() * Math.PI * 2;  // 朝向随机
        sp.rotation.y = baseAngle;
        // 非常贴近水面 y, 海面在 -0.04, 浪花比它高一点点
        sp.position.set(px, 0.008 + idx * 0.002, pz);
        sp.renderOrder = 5 + idx;
        sp.userData = {
          baseOp: L.op,
          baseAngle,
          phase: Math.random() * Math.PI * 2 + co * 0.4 + r * 0.3,
          speed: 0.5 + Math.random() * 0.4,
        };
        group.add(sp);
        sprites.push(sp);
      });
    }
  }
  group.position.set(ccx + loOff, 0.02, ccz + laOff);
  group.userData = { name, phase: Math.random() * Math.PI * 2, sprites };
  waveMeshes.push(group);
  return group;
}

// ═══════════════════════════════════════
// Coast waves — 沿海岸线自动布点
// 每朵浪水平放置, y-rotation 对齐海岸外法向 (浪峰朝向外海)
// ═══════════════════════════════════════
export function buildCoastWaves() {
  const grp = new THREE.Group();
  const spacing = MOB ? 10 : 7;
  const nLayers = 1;
  // [outward offset, width, aspect ratio, opacity, -, -]
  const LC = [
    [0.3, 3.0, .30, .55],
    [2.0, 1.8, .48, .65],
    [4.5, 2.2, .48, .50],
  ];
  for (let i = 0; i < BD_MAIN.length; i++) {
    const j = (i + 1) % BD_MAIN.length;
    const [aLo, aLa] = BD_MAIN[i], [bLo, bLa] = BD_MAIN[j];
    const mLo = (aLo + bLo) / 2, mLa = (aLa + bLa) / 2;
    if (mLo < 108 || mLa > 41.5) continue;
    const dLo = bLo - aLo, dLa = bLa - aLa;
    const sl = Math.sqrt(dLo * dLo + dLa * dLa);
    if (sl < .05) continue;
    const nLo = -dLa / sl, nLa = dLo / sl;
    const lftLand = inLand(mLo + nLo * .3, mLa + nLa * .3);
    const rgtLand = inLand(mLo - nLo * .3, mLa - nLa * .3);
    if (lftLand === rgtLand) continue;
    const sd = lftLand ? -1 : 1;
    const sNx = (nLo * sd) * SX, sNz = -(nLa * sd) * SY;
    const sn = Math.sqrt(sNx * sNx + sNz * sNz) || 1;
    const nx = sNx / sn, nz = sNz / sn;
    const [ax, az] = ll2s(aLo, aLa), [bx, bz] = ll2s(bLo, bLa);
    const wl = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);
    const nP = Math.max(1, Math.ceil(wl / spacing));
    for (let s = 0; s < nP; s++) {
      const tt = (s + .5) / nP;
      const cx = ax + (bx - ax) * tt, cz = az + (bz - az) * tt;
      for (let L = 0; L < nLayers; L++) {
        const c = LC[Math.min(L, 2)];
        const wx = cx + nx * c[0], wz = cz + nz * c[0];
        const bW = c[1] * (.85 + Math.random() * .3);
        const bH = bW * c[2];
        const bOp = c[3];
        const geo = _mkWaveGeo(bW, bH);
        const mat = new THREE.MeshBasicMaterial({
          map: _sharedWaveTex,
          transparent: true,
          opacity: bOp,
          depthWrite: false,
          color: _pickTint().clone(),
          side: THREE.DoubleSide,
        });
        const sp = new THREE.Mesh(geo, mat);
        // 图像 "up" 默认指向 world -Z; 想让"浪峰"朝海外法向 (nx, nz)
        // 需要 rotation.y = atan2(nx, -nz)
        const baseAngle = Math.atan2(nx, -nz);
        sp.rotation.y = baseAngle;
        sp.position.set(wx, 0.006, wz);  // 紧贴海面 (海面 -0.04)
        sp.renderOrder = 5;
        coastWaveData.push({
          sp, bx: wx, bz: wz, bW, bH, bOp,
          baseAngle,
          ph: Math.random() * 6.28 + i * .3 + s * .5,
          spd: .45 + Math.random() * .4,
        });
        grp.add(sp);
      }
    }
  }
  return grp;
}

// ═══════════════════════════════════════
// 每帧动画: 轻微 opacity 呼吸 + 角度微摆 + 尺度脉冲
// ═══════════════════════════════════════
export function animateSea(t) {
  for (let i = 0; i < coastWaveData.length; i++) {
    const d = coastWaveData[i];
    const ph = t * d.spd + d.ph;
    const sv = Math.sin(ph);
    const crest = Math.max(0, sv);
    // opacity 呼吸
    d.sp.material.opacity = d.bOp * (0.55 + (sv + 1) * 0.225);
    // 角度微摆 (±3°)
    d.sp.rotation.y = d.baseAngle + Math.sin(ph * 0.35) * 0.05;
    // 尺度小脉冲 (浪峰时略鼓)
    const sc = 1 + crest * 0.08;
    d.sp.scale.set(sc, 1, sc);
  }
  // Strait patches 同样呼吸
  for (let i = 0; i < waveMeshes.length; i++) {
    const g = waveMeshes[i];
    if (!g.userData.sprites) continue;
    for (let k = 0; k < g.userData.sprites.length; k++) {
      const sp = g.userData.sprites[k];
      const u = sp.userData;
      const ph = t * u.speed + u.phase;
      const sv = Math.sin(ph);
      sp.material.opacity = u.baseOp * (0.6 + (sv + 1) * 0.2);
      sp.rotation.y = u.baseAngle + Math.sin(ph * 0.4) * 0.05;
    }
  }
}
