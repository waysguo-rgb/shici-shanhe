// 候鸟 + 孤舟 — 给静态的山河加一点"时间流逝"的动感.
//   雁群: V 字编队, 每 ~30-60s 从西往东飞过天空
//   孤舟: 长江 / 湘江 / 赣江 上各放一艘, 顺流缓慢漂移
import * as THREE from 'three';
import RIVERS from '../data/rivers.js';
import { ll2s } from './helpers.js';

// ═══════════════════════════════════════
// 雁群
// ═══════════════════════════════════════
const GOOSE_COUNT = 7;
let _gooseGroup = null;
let _flightSpeed = 4.5;
let _nextFlightAt = 10;
let _flightY = 28, _flightZ = 0;
let _geeseRateMul = 1.0;   // 1 默认, 3 秋季迁徙, 0.1 冬季几乎无
export function setGeeseRate(mul) { _geeseRateMul = Math.max(0.05, mul); }

// 简笔雁剪影 (飞翔态 "M" 形)
function mkGooseTex() {
  const W = 64, H = 32;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d');
  cx.strokeStyle = 'rgba(35,25,20,0.88)';
  cx.lineWidth = 2.2;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  cx.beginPath();
  cx.moveTo(W * 0.10, H * 0.62);
  cx.quadraticCurveTo(W * 0.30, H * 0.28, W * 0.50, H * 0.60);
  cx.quadraticCurveTo(W * 0.70, H * 0.28, W * 0.90, H * 0.62);
  cx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function buildGeese(scene) {
  const tex = mkGooseTex();
  _gooseGroup = new THREE.Group();
  for (let i = 0; i < GOOSE_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.78,
      depthWrite: false, fog: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(2.0, 1.0, 1);
    // V 字编队偏移: 0 号是领头, 1/2 号左右紧跟, 3/4 再后一点, 5/6 最末
    const pairIdx = Math.floor((i + 1) / 2);
    const side = i === 0 ? 0 : (i % 2 === 0 ? 1 : -1);
    sp.userData = { offX: -pairIdx * 2.2, offZ: side * pairIdx * 1.5 };
    sp.position.set(sp.userData.offX, 0, sp.userData.offZ);
    _gooseGroup.add(sp);
  }
  _gooseGroup.position.set(-120, _flightY, _flightZ);
  _gooseGroup.visible = false;
  scene.add(_gooseGroup);
  return _gooseGroup;
}

export function updateGeese(dt, t) {
  if (!_gooseGroup) return;
  if (!_gooseGroup.visible) {
    if (t > _nextFlightAt) {
      _gooseGroup.visible = true;
      _gooseGroup.position.set(-120, _flightY, _flightZ);
    }
    return;
  }
  _gooseGroup.position.x += _flightSpeed * dt;
  // 翅膀轻微上下摆动 (节律感)
  _gooseGroup.children.forEach((sp, i) => {
    const phase = t * 3.2 + i * 0.4;
    sp.position.y = Math.sin(phase) * 0.18;
  });
  if (_gooseGroup.position.x > 120) {
    _gooseGroup.visible = false;
    _nextFlightAt = t + (30 + Math.random() * 30) / _geeseRateMul;
    _flightY = 22 + Math.random() * 10;
    _flightZ = -30 + Math.random() * 60;
    _flightSpeed = 3.5 + Math.random() * 2.5;
  }
}

// ═══════════════════════════════════════
// 孤舟 — 三条大河上各一艘
// ═══════════════════════════════════════
const BOAT_RIVER_NAMES = ['长江', '湘江', '赣江'];
const _boats = [];

function mkBoatTex() {
  const W = 48, H = 28;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d');
  // 船身 - 褐色月牙
  cx.fillStyle = 'rgba(60,38,20,0.80)';
  cx.beginPath();
  cx.moveTo(W * 0.10, H * 0.64);
  cx.quadraticCurveTo(W * 0.50, H * 0.94, W * 0.90, H * 0.64);
  cx.lineTo(W * 0.78, H * 0.56);
  cx.lineTo(W * 0.22, H * 0.56);
  cx.closePath();
  cx.fill();
  // 桅
  cx.strokeStyle = 'rgba(50,32,18,0.85)';
  cx.lineWidth = 1.4;
  cx.beginPath();
  cx.moveTo(W * 0.50, H * 0.56);
  cx.lineTo(W * 0.50, H * 0.14);
  cx.stroke();
  // 帆 (小三角)
  cx.fillStyle = 'rgba(225,208,170,0.80)';
  cx.beginPath();
  cx.moveTo(W * 0.50, H * 0.16);
  cx.lineTo(W * 0.74, H * 0.54);
  cx.lineTo(W * 0.50, H * 0.54);
  cx.closePath();
  cx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function buildBoats(scene) {
  const boatTex = mkBoatTex();
  BOAT_RIVER_NAMES.forEach(name => {
    const river = RIVERS.find(r => r.n === name);
    if (!river) return;
    const pts = river.c.map(([lo, la]) => {
      const [x, z] = ll2s(lo, la);
      return new THREE.Vector3(x, 0.18, z);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3);
    const mat = new THREE.SpriteMaterial({
      map: boatTex, transparent: true, opacity: 0.88,
      depthWrite: false, fog: true,
    });
    const sp = new THREE.Sprite(mat);
    sp.center = new THREE.Vector2(0.5, 0);
    sp.scale.set(1.4, 0.9, 1);
    sp.renderOrder = 11;
    _boats.push({
      sprite: sp, curve,
      t: Math.random(),
      // 顺流 ~3 分钟走完; Math.random 生成的 dt 范围 [0.006, 0.010] 每秒
      speed: 0.006 + Math.random() * 0.004,
    });
    scene.add(sp);
  });
  return _boats;
}

export function updateBoats(dt) {
  for (let i = 0; i < _boats.length; i++) {
    const b = _boats[i];
    b.t = (b.t + b.speed * dt) % 1;
    const pos = b.curve.getPoint(b.t);
    b.sprite.position.set(pos.x, pos.y, pos.z);
  }
}
