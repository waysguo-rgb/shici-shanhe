// Drifting blossom petals — instanced flat-quad system for 落花 / 飞花 motif.
//
// 单 InstancedMesh 一次 draw call 容纳 ~100 片花瓣 (原来 N 个 Sprite 各自一次).
// 每帧 CPU 更新每实例 Matrix4 + 自定义 attributes (aRot / aScale / aOpacity) + Color.
// 关键特性: 片瓣用 **屏幕空间恒定尺寸** 渲染 — 相机拉近/拉远, 花瓣视觉像素大小不变.
// 实现方式: ShaderMaterial 里把 PlaneGeometry 的 corner offset 在 clip space 加到
// instance center 上, 按 `pixel / (viewport/2) * w` 抵消透视除法.
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

// ─── Shader ──────────────────────────────────────────
// 注意: 故意避开 three.js 内置 instanceColor — 用自定义 aColor, 否则 ShaderMaterial
// 在 InstancedMesh 上启用 USE_INSTANCING_COLOR 会和我们的 declare 冲突.
const PETAL_VS = /* glsl */`
  attribute float aScale;
  attribute float aRot;
  attribute float aOpacity;
  attribute vec3  aColor;
  uniform float uPixelSize;
  uniform vec2  uViewport;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    // Instance center → clip space (translation from instanceMatrix)
    vec4 centerClip = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    // 2D rotate the quad corner in screen plane
    float c = cos(aRot), s = sin(aRot);
    vec2 cornerPx = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    // Corner offset in pixels (position is ±0.5, scale = multiplier)
    cornerPx *= uPixelSize * aScale;
    // Pixel → clip space: (px / (viewport/2)) * w compensates the /w perspective divide
    vec2 clipOffset = cornerPx * 2.0 / uViewport * centerClip.w;
    gl_Position = centerClip + vec4(clipOffset, 0.0, 0.0);
    vUv = uv;
    vColor = aColor;
    vOpacity = aOpacity;
  }
`;
const PETAL_FS = /* glsl */`
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vOpacity;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = vec4(t.rgb * vColor, t.a * vOpacity);
  }
`;

// ─── State ──────────────────────────────────────────
let _petals = [];
let _instanced = null;
let _scaleAttr = null;
let _rotAttr = null;
let _opacityAttr = null;
let _colorAttr = null;
let _xRange = [-70, 85];
let _yRange = [0.5, 14];
let _zRange = [-48, 48];
let _uniforms = null;

// Reused temp objects
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion(0, 0, 0, 1);
const _scl = new THREE.Vector3(1, 1, 1);
const _mat = new THREE.Matrix4();
const _col = new THREE.Color();

// 外部注入的湖泊列表 (每项 { cx, cz, r, y }) 用于花瓣落湖碰撞检测.
// 通过 setPetalLakes() 在湖泊创建后填入, 不在 initPetals 参数里是因为 petals
// 先于 lakes 初始化.
let _lakes = [];
let _onLand = null;
export function setPetalLakes(lakes) { _lakes = lakes || []; }
export function setPetalLandCallback(cb) { _onLand = cb; }
// 简洁模式 / 任何场景都可用的整体开关
export function setPetalsEnabled(on) { if (_instanced) _instanced.visible = !!on; }

export function initPetals(scene, { count = 100, xRange = [-70, 85], zRange = [-48, 48], yTop = 14, yBot = 0.5 } = {}) {
  _xRange = xRange; _yRange = [yBot, yTop]; _zRange = zRange;

  const tex = mkPetalTex();
  // Plain PlaneGeometry (in XY) — shader will billboard it to screen.
  const geo = new THREE.PlaneGeometry(1, 1);

  const mat = new THREE.ShaderMaterial({
    vertexShader: PETAL_VS,
    fragmentShader: PETAL_FS,
    uniforms: {
      uMap:       { value: tex },
      uPixelSize: { value: 26 },     // 基线像素尺寸 (scale=1 时边长 26px)
      uViewport:  { value: new THREE.Vector2(1920, 1080) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  _uniforms = mat.uniforms;

  _instanced = new THREE.InstancedMesh(geo, mat, count);
  _instanced.frustumCulled = false;
  _instanced.renderOrder = 6;

  // Per-instance attributes
  _scaleAttr   = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  _rotAttr     = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  _opacityAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  _colorAttr   = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  geo.setAttribute('aScale',   _scaleAttr);
  geo.setAttribute('aRot',     _rotAttr);
  geo.setAttribute('aOpacity', _opacityAttr);
  geo.setAttribute('aColor',   _colorAttr);

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
      // 相对基线 uPixelSize (26px) 的尺寸. 0.7-1.4 → 最终 18-36 px.
      scale: 0.7 + Math.random() * 0.7,
      baseOp: 0.65 + Math.random() * 0.25,
      hue: 0.96 + Math.random() * 0.03,
      sat: 0.35 + Math.random() * 0.25,
      lit: 0.85 + Math.random() * 0.08,
    };
    _petals[i] = p;
    _writeInstance(i, p, 1);
  }
  _instanced.instanceMatrix.needsUpdate = true;
  _scaleAttr.needsUpdate = true;
  _rotAttr.needsUpdate = true;
  _opacityAttr.needsUpdate = true;
  _colorAttr.needsUpdate = true;
  scene.add(_instanced);
}

function _writeInstance(i, p, opMul) {
  _pos.set(p.x, p.y, p.z);
  _mat.compose(_pos, _quat, _scl);
  _instanced.setMatrixAt(i, _mat);
  _scaleAttr.setX(i, p.scale);
  _rotAttr.setX(i, p.rot || 0);
  _opacityAttr.setX(i, p.baseOp * opMul);
  _col.setHSL(p.hue, p.sat, p.lit);
  _colorAttr.setXYZ(i, _col.r, _col.g, _col.b);
}

// Hook from SceneManager to keep clip-space offset math in sync with the canvas size.
export function resizePetals(w, h) {
  if (_uniforms && _uniforms.uViewport) _uniforms.uViewport.value.set(w, h);
}

// 外部换色 (季节切换用). hueR/satR/litR 都是 [base, random_width].
// opScale 对 baseOp 做 0.3-1.2 倍整体缩放 — 夏天花少.
export function recolorPetals(hueR, satR, litR, opScale = 1.0) {
  if (!_petals || !_petals.length) return;
  const _col = new THREE.Color();
  for (let i = 0; i < _petals.length; i++) {
    const p = _petals[i];
    const h = hueR[0] + Math.random() * hueR[1];
    const s = satR[0] + Math.random() * satR[1];
    const l = litR[0] + Math.random() * litR[1];
    p.hue = h; p.sat = s; p.lit = l;
    p.baseOp = (0.65 + Math.random() * 0.25) * opScale;
    _col.setHSL(h, s, l);
    _colorAttr.setXYZ(i, _col.r, _col.g, _col.b);
  }
  _colorAttr.needsUpdate = true;
}

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
    const frac = (p.y - yMin) / ySpan;
    let opMul = 1;
    if (frac < 0.15) opMul = Math.max(0, frac / 0.15);
    else if (frac > 0.85) opMul = Math.max(0, (1 - frac) / 0.15);
    // 落湖碰撞 — 下落到湖面高度且水平在湖圆范围内 → 发涟漪 + respawn
    let landed = false;
    if (_lakes.length && p.vy < 0 && p.y < 2.5) {
      for (let k = 0; k < _lakes.length; k++) {
        const lk = _lakes[k];
        if (p.y > lk.y + 0.15) continue;          // 还在湖面上方
        const dx = p.x - lk.cx, dz = p.z - lk.cz;
        if (dx * dx + dz * dz < lk.r2) {           // 水平在湖圆内
          if (_onLand) _onLand(p.x, lk.y, p.z);
          landed = true;
          break;
        }
      }
    }
    if (landed ||
        p.y < yMin ||
        p.x < xMin - 5 || p.x > xMax + 5 ||
        p.z < zMin - 5 || p.z > zMax + 5) {
      p.x = xMin + Math.random() * (xMax - xMin);
      p.y = yMax - Math.random() * 2;
      p.z = zMin + Math.random() * (zMax - zMin);
    }
    _writeInstance(i, p, opMul);
  }
  _instanced.instanceMatrix.needsUpdate = true;
  _scaleAttr.needsUpdate = true;
  _rotAttr.needsUpdate = true;
  _opacityAttr.needsUpdate = true;
  _colorAttr.needsUpdate = true;
}
