// Drifting blossom petals — instanced flat-quad system for 落花 / 飞花 motif.
//
// 单 InstancedMesh 一次 draw call 容纳 ~100 片花瓣 (原来 N 个 Sprite 各自一次).
// 每帧 CPU 更新每实例 Matrix4 + Color (instanceMatrix / instanceColor, 零 GC).
// 手机 tile-based GPU 受益显著 (draw call 是瓶颈).
import * as THREE from 'three';

function mkPetalTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  cx.save();
  cx.translate(16, 16);
  cx.rotate(Math.PI / 5);
  const grad = cx.createRadialGradient(0, 0, 0, 0, 0, 14);
  grad.addColorStop(0,    'rgba(255,240,245,0.95)');
  grad.addColorStop(0.55, 'rgba(252,212,214,0.75)');
  grad.addColorStop(0.95, 'rgba(246,184,188,0.15)');
  grad.addColorStop(1,    'rgba(246,184,188,0)');
  cx.fillStyle = grad;
  cx.beginPath();
  cx.moveTo(0, -13);
  cx.bezierCurveTo(8, -10, 8, 6, 0, 13);
  cx.bezierCurveTo(-8, 6, -8, -10, 0, -13);
  cx.fill();
  cx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Per-petal state (plain objects, zero garbage in hot loop)
let _petals = [];          // array of { vx, vy, vz, swirlAmp, swirlFreq, phase, scale, baseOp, color }
let _instanced = null;     // THREE.InstancedMesh
let _xRange = [-70, 85];
let _yRange = [0.5, 14];
let _zRange = [-48, 48];

// Reused temp objects (avoid per-frame allocations)
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _col = new THREE.Color();
const _euler = new THREE.Euler();

export function initPetals(scene, { count = 100, xRange = [-70, 85], zRange = [-48, 48], yTop = 14, yBot = 0.5 } = {}) {
  _xRange = xRange; _yRange = [yBot, yTop]; _zRange = zRange;

  const tex = mkPetalTex();
  // Flat quad lying in the X-Z plane; geometry pre-rotated so +Y (up) is world +Y normal.
  // This means petals appear as overhead dabs — works well for top-down map view.
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    vertexColors: false,   // InstancedMesh uses instanceColor instead
  });

  _instanced = new THREE.InstancedMesh(geo, mat, count);
  _instanced.frustumCulled = false;   // petals scattered widely, skip cull test
  // Enable per-instance color (three.js will upload instanceColor buffer)
  _instanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  _instanced.renderOrder = 6;

  // Seed per-petal state + initial matrices
  _petals = new Array(count);
  for (let i = 0; i < count; i++) {
    const p = {
      x: xRange[0] + Math.random() * (xRange[1] - xRange[0]),
      y: yBot + Math.random() * (yTop - yBot),
      z: zRange[0] + Math.random() * (zRange[1] - zRange[0]),
      vy: -0.12 - Math.random() * 0.18,
      vx: (Math.random() - 0.4) * 0.25,
      vz: (Math.random() - 0.5) * 0.08,
      swirlAmp: 0.3 + Math.random() * 0.4,
      swirlFreq: 0.7 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      scale: 0.18 + Math.random() * 0.25,
      baseOp: 0.55 + Math.random() * 0.25,
      // store pink/white color once
      hue: 0.96 + Math.random() * 0.03,
      sat: 0.35 + Math.random() * 0.25,
      lit: 0.85 + Math.random() * 0.08,
    };
    _petals[i] = p;
    _writeInstance(i, p, 1);
  }
  _instanced.instanceMatrix.needsUpdate = true;
  _instanced.instanceColor.needsUpdate = true;
  scene.add(_instanced);
}

function _writeInstance(i, p, opMul) {
  _euler.set(0, p.rot || 0, 0);
  _quat.setFromEuler(_euler);
  _pos.set(p.x, p.y, p.z);
  _scl.set(p.scale, p.scale, p.scale);
  _mat.compose(_pos, _quat, _scl);
  _instanced.setMatrixAt(i, _mat);
  // Color includes opacity multiplier baked in (alpha channel via lightness scaling
  // is approximate; since petals are already semi-transparent texture, we just
  // modulate color toward dark to simulate fade near boundaries).
  const finalOp = p.baseOp * opMul;
  _col.setHSL(p.hue, p.sat, p.lit * (0.5 + 0.5 * finalOp));
  _instanced.setColorAt(i, _col);
}

// Called every frame from animate(). No allocations here.
export function updatePetals(t, dt) {
  if (!_instanced || _petals.length === 0) return;
  const [xMin, xMax] = _xRange, [yMin, yMax] = _yRange, [zMin, zMax] = _zRange;
  const ySpan = yMax - yMin;
  for (let i = 0; i < _petals.length; i++) {
    const p = _petals[i];
    p.x += (p.vx + Math.sin(t * p.swirlFreq + p.phase) * p.swirlAmp * 0.02) * dt;
    p.y += p.vy * dt;
    p.z += (p.vz + Math.cos(t * p.swirlFreq * 0.7 + p.phase) * p.swirlAmp * 0.015) * dt;
    p.rot = Math.sin(t * p.swirlFreq + p.phase) * 0.6;
    // Spawn/despawn soft fade
    const frac = (p.y - yMin) / ySpan;
    let opMul = 1;
    if (frac < 0.15) opMul = Math.max(0, frac / 0.15);
    else if (frac > 0.85) opMul = Math.max(0, (1 - frac) / 0.15);
    // Recycle if out of zone
    if (p.y < yMin ||
        p.x < xMin - 5 || p.x > xMax + 5 ||
        p.z < zMin - 5 || p.z > zMax + 5) {
      p.x = xMin + Math.random() * (xMax - xMin);
      p.y = yMax - Math.random() * 2;
      p.z = zMin + Math.random() * (zMax - zMin);
    }
    _writeInstance(i, p, opMul);
  }
  _instanced.instanceMatrix.needsUpdate = true;
  if (_instanced.instanceColor) _instanced.instanceColor.needsUpdate = true;
}
