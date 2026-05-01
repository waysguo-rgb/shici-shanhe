// 点击涟漪 — 用户点一座城, 以该点为中心发一圈水墨涟漪 (圆环 sprite 平贴地面,
// 逐帧放大 + 淡出). 给交互加"仪式感".
//
// 用对象池 (pool of 5 ripples) 避免频繁 new/dispose. 每次 emitRipple 挑一个空闲的
// 循环利用.
import * as THREE from 'three';

const POOL_SIZE = 5;
const LIFE = 1.4;              // 每次涟漪生命 (秒)
const START_R = 0.6;           // 起始半径 (世界单位)
const END_R = 9.0;             // 终止半径

// 单圈墨环 texture
function mkRippleTex() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const cx = c.getContext('2d');
  // 先画一个完整墨色盘, 然后挖掉中心做环
  const grad = cx.createRadialGradient(S/2, S/2, S*0.30, S/2, S/2, S*0.50);
  grad.addColorStop(0,    'rgba(45,30,20,0)');
  grad.addColorStop(0.20, 'rgba(45,30,20,0.7)');
  grad.addColorStop(0.50, 'rgba(45,30,20,0.85)');
  grad.addColorStop(0.78, 'rgba(45,30,20,0.35)');
  grad.addColorStop(1,    'rgba(45,30,20,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const _pool = [];
let _tex = null;

export function buildRipplePool(scene) {
  _tex = mkRippleTex();
  for (let i = 0; i < POOL_SIZE; i++) {
    // 水平贴地平面 (PlaneGeometry rotateX -π/2)
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: _tex, transparent: true, opacity: 0,
      depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 12;
    mesh.userData = { active: false, age: 0 };
    scene.add(mesh);
    _pool.push(mesh);
  }
  return _pool;
}

// 发一个涟漪, pos 是世界坐标 Vector3.
// opts.scale: 尺寸倍率 (0.15 给花瓣落湖, 1.0 给点城)
// opts.op:    初始不透明度 (默认 0.85)
export function emitRipple(pos, opts = {}) {
  const scaleMul = opts.scale || 1.0;
  const baseOp = opts.op != null ? opts.op : 0.85;
  let slot = _pool.find(m => !m.userData.active);
  if (!slot) slot = _pool[0];
  slot.position.set(pos.x, pos.y + 0.12, pos.z);
  slot.scale.set(START_R * scaleMul, 1, START_R * scaleMul);
  slot.material.opacity = baseOp;
  slot.visible = true;
  slot.userData.active = true;
  slot.userData.age = 0;
  slot.userData.scaleMul = scaleMul;
  slot.userData.baseOp = baseOp;
}

export function updateRipples(dt) {
  for (let i = 0; i < _pool.length; i++) {
    const m = _pool[i];
    if (!m.userData.active) continue;
    m.userData.age += dt;
    const k = m.userData.age / LIFE;
    if (k >= 1) {
      m.userData.active = false;
      m.visible = false;
      continue;
    }
    // 放大曲线: easeOut (1 - (1-k)^2) 让初段快后段慢
    const ease = 1 - (1 - k) * (1 - k);
    const scaleMul = m.userData.scaleMul || 1.0;
    const r = (START_R + (END_R - START_R) * ease) * scaleMul;
    m.scale.set(r, 1, r);
    // 透明度: 初始 → 0, 后半段加速褪去
    const baseOp = m.userData.baseOp || 0.85;
    m.material.opacity = baseOp * (1 - k) * (1 - k * 0.4);
  }
}
