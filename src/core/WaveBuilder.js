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
// Wave patch (strait / sea area sprites)
// ═══════════════════════════════════════
export function mkWavePatch(loCen, laCen, loSpan, laSpan, loOff, laOff, name) {
  const baseW = 3.8;
  const baseH = baseW * 0.52;
  const group = new THREE.Group();
  const [ccx, ccz] = ll2s(loCen, laCen);
  const areaW = loSpan * 1.6;
  const areaH = laSpan * 1.8;
  const cols = Math.max(2, Math.floor(areaW / (baseW * 0.70)));
  const rows = Math.max(1, Math.floor(areaH / (baseH * 1.4)));

  const sprites = [];
  for (let r = 0; r < rows; r++) {
    for (let co = 0; co < cols; co++) {
      const px = -areaW / 2 + (co + 0.5) * areaW / cols + (r % 2 ? baseW * 0.3 : 0);
      const pz = -areaH / 2 + (r + 0.5) * areaH / rows;
      const layers = [
        { dy: 0.08, scale: 1.00, op: 1.0, zOff: 0, depth: 0 },
        { dy: 0.03, scale: 0.78, op: 0.85, zOff: -0.15, depth: 1 }
      ];
      layers.forEach((L, idx) => {
        const mat = new THREE.SpriteMaterial({
          map: _sharedWaveTex,
          transparent: true,
          opacity: L.op,
          depthWrite: false
        });
        const sp = new THREE.Sprite(mat);
        const jitter = 0.88 + Math.random() * 0.24;
        const sw = baseW * L.scale * jitter;
        const sh = baseH * L.scale * jitter;
        sp.scale.set(sw, sh, 1);
        sp.position.set(px, L.dy + sh * 0.5, pz + L.zOff);
        sp.renderOrder = 5 + L.depth;
        sp.userData = {
          baseX: px,
          baseY: sp.position.y,
          baseZ: sp.position.z,
          baseW: sw,
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
  // 密度下调: 原 3.5 桌面端沿岸每隔 3.5 单位一波, 过密.
  // 改为 6.0 (alongshore) + 2 层 (砍掉最外层 LC[2], 远海清爽)
  const spacing = MOB ? 9 : 6.0;
  const nLayers = MOB ? 2 : 2;
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
        const mat = new THREE.SpriteMaterial({ map: _sharedWaveTex, transparent: true, opacity: bOp, depthWrite: false });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(bW, bH, 1);
        sp.position.set(wx, .06 + L * .02, wz);
        sp.renderOrder = 7 - L;
        coastWaveData.push({
          sp, nx, nz, bx: wx, bz: wz, by: .06 + L * .02, bW, bH, bOp,
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
    const d = coastWaveData[i], ph = t * d.spd + d.ph;
    const sv = Math.sin(ph);
    d.sp.position.x = d.bx - d.nx * sv * d.surge;
    d.sp.position.z = d.bz - d.nz * sv * d.surge;
    d.sp.position.y = d.by + Math.max(0, sv) * d.bob * 2.5 + Math.sin(ph * .9) * d.bob * .4;
    const crest = Math.max(0, sv);
    d.sp.scale.set(d.bW * (1 + crest * .12), d.bH * (1 + crest * .25), 1);
    d.sp.material.opacity = d.bOp * (.35 + (sv + 1) * .325);
    d.sp.material.rotation = Math.sin(ph * .4) * .06;
  }
}
