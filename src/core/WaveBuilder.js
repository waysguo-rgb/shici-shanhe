// Wave sprites: strait wave patches + coast wave generation + animation
import * as THREE from 'three';
import { MOB, SX, SY } from '../data/constants.js';
import { BD_MAIN } from '../data/boundaries.js';
import { inLand, ll2s } from './helpers.js';
import { _sharedWaveTex } from './textures.js';

// Mutable state
export const waveMeshes = [];
export const coastWaveData = [];

// ═══════════════════════════════════════
// Per-sprite color variation (淡蓝 → 青 → 浅灰蓝, 个别偏暖白)
// 给每个浪沫 sprite 一点点不同的颜色, 避免完全一致显得呆板
// ═══════════════════════════════════════
// 水墨整体调: 浪沫推暖到米白/暖灰, 不再冷蓝, 避免"蓝白浪花 + 暖棕地图"撕裂
const _waveTints = [
  new THREE.Color('#ece5d6'),  // 暖米白 (主调)
  new THREE.Color('#e2dac6'),  // 偏暖灰
  new THREE.Color('#f0ebe0'),  // 暖白 (高光)
  new THREE.Color('#d6ccb4'),  // 中暖灰
  new THREE.Color('#e6dece'),  // 浅暖灰
];
function _pickTint() {
  return _waveTints[Math.floor(Math.random() * _waveTints.length)];
}

// ═══════════════════════════════════════
// Wave patch (strait / sea area sprites)
// ═══════════════════════════════════════
export function mkWavePatch(loCen, laCen, loSpan, laSpan, loOff, laOff, name) {
  const baseW = 3.8;
  const baseH = baseW * 0.52;
  const group = new THREE.Group();
  const [ccx, ccz] = ll2s(loCen, laCen);
  const areaW = loSpan * 1.6;
  const areaH = laSpan * 1.8;
  // 网格除数调大 (0.70→1.4, 1.4→2.4): 浪沫更稀, 走向水墨"计白当黑"的留白, 顺带减 draw call
  const cols = Math.max(2, Math.floor(areaW / (baseW * 1.4)));
  const rows = Math.max(1, Math.floor(areaH / (baseH * 2.4)));

  const sprites = [];
  for (let r = 0; r < rows; r++) {
    for (let co = 0; co < cols; co++) {
      const px = -areaW / 2 + (co + 0.5) * areaW / cols + (r % 2 ? baseW * 0.3 : 0);
      const pz = -areaH / 2 + (r + 0.5) * areaH / rows;
      // 只留主层, 删掉第二层 depth sprite (减半 sprite 数, 画面更克制)
      const layers = [
        { dy: 0.08, scale: 1.00, op: 1.0, zOff: 0, depth: 0 }
      ];
      layers.forEach((L, idx) => {
        const mat = new THREE.SpriteMaterial({
          map: _sharedWaveTex,
          transparent: true,
          opacity: L.op,
          depthWrite: false,
          color: _pickTint().clone()
        });
        const sp = new THREE.Sprite(mat);
        const jitter = 0.88 + Math.random() * 0.24;
        const sw = baseW * L.scale * jitter;
        const sh = baseH * L.scale * jitter;
        // 一半 sprite 镜像翻转 — 把符号烘进 baseW, 这样 animation 重写 scale 时也能保留
        const flip = Math.random() < 0.5 ? -1 : 1;
        const sw_signed = sw * flip;
        sp.scale.set(sw_signed, sh, 1);
        sp.position.set(px, L.dy + sh * 0.5, pz + L.zOff);
        sp.renderOrder = 5 + L.depth;
        sp.userData = {
          baseX: px,
          baseY: sp.position.y,
          baseZ: sp.position.z,
          baseW: sw_signed,
          baseH: sh,
          baseOp: L.op,
          phase: Math.random() * Math.PI * 2 + co * 0.4 + r * 0.3,
          speed: 0.9 + Math.random() * 0.6,
          swayAmp: 0.06 + Math.random() * 0.05,
          bobAmp: 0.10 + Math.random() * 0.08,
          rollSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.4)
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
// Coast waves: auto-placed along coastline
// ═══════════════════════════════════════
export function buildCoastWaves() {
  const grp = new THREE.Group();
  // 再降密度 (10 → 18), 海岸浪更稀疏留白, 顺带少一堆 sprite draw call
  const spacing = MOB ? 22 : 18;
  const nLayers = 1;
  const LC = [
    [0.3, 3.0, .30, .50, .12, .02],
    [2.0, 1.8, .48, .65, .35, .04],
    [4.5, 2.2, .48, .50, .55, .05],
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
        const mat = new THREE.SpriteMaterial({
          map: _sharedWaveTex,
          transparent: true,
          opacity: bOp,
          depthWrite: false,
          color: _pickTint().clone()
        });
        const sp = new THREE.Sprite(mat);
        // 一半 sprite 镜像翻转, 朝向多样化
        const flip = Math.random() < 0.5 ? -1 : 1;
        sp.scale.set(bW * flip, bH, 1);
        sp.position.set(wx, .06 + L * .02, wz);
        sp.renderOrder = 7 - L;
        coastWaveData.push({
          sp, nx, nz, bx: wx, bz: wz, by: .06 + L * .02, bW: bW * flip, bH, bOp,
          ph: Math.random() * 6.28 + i * .3 + s * .5,
          spd: .45 + Math.random() * .4,
          surge: c[4], bob: c[5] + Math.random() * .03
        });
        grp.add(sp);
      }
    }
  }
  return grp;
}

// ═══════════════════════════════════════
// Coast wave animation (called each frame)
// ═══════════════════════════════════════
export function animateSea(t) {
  for (let i = 0; i < coastWaveData.length; i++) {
    // ×0.55 整体降速 — 水墨"静中微动", 不要快频抖动
    const d = coastWaveData[i], ph = t * d.spd * 0.55 + d.ph;
    const sv = Math.sin(ph);
    d.sp.position.x = d.bx - d.nx * sv * d.surge * 0.6;
    d.sp.position.z = d.bz - d.nz * sv * d.surge * 0.6;
    // 抬升幅度 2.5→0.8: 浪沫贴着水面低频起伏, 不再大起大落
    d.sp.position.y = d.by + Math.max(0, sv) * d.bob * 0.8;
    const crest = Math.max(0, sv);
    // scale 摆动 ±12%/±25% → ±5%/±6%: 几乎不缩放, 去掉"搏动"感
    d.sp.scale.set(d.bW * (1 + crest * 0.05), d.bH * (1 + crest * 0.06), 1);
    // opacity 近 3 倍跳变 → 0.82±0.06: 透明度突变是肉眼最敏感的廉价信号, 压成微呼吸
    d.sp.material.opacity = d.bOp * (0.82 + sv * 0.06);
    d.sp.material.rotation = Math.sin(ph * 0.4) * 0.03;
  }
}
