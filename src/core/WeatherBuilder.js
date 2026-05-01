// 天气粒子系统 — 目前只做雨 (雪留给以后做冬季模式).
//
// InstancedMesh, ~800 条垂直线段 (PlaneGeometry 薄长), 每帧 y 下降, 到底 respawn
// 到顶部. 开关由 UI 按钮 → setRainEnabled(bool) 控制, 0.4s 渐入渐出.
import * as THREE from 'three';

const RAIN_COUNT = 800;
// 覆盖范围比 scene bbox 大一圈, 避免能看到粒子从画面边缘凭空出现
const X_MIN = -95, X_MAX = 110;
const Z_MIN = -60, Z_MAX = 60;
const Y_TOP = 32;
const Y_BOT = 0.2;

// 每条雨的 state (pos + speed) — 平对象数组, 热循环零 GC
let _rainInstanced = null;
let _rain = [];
let _rainEnabled = false;
let _rainAlpha   = 0;    // 渐变: 目标 = _rainEnabled ? 1 : 0
let _rainAlphaTarget = 0;
// 模式: 'rain' 垂直白线下落, 'snow' 缓速漂落带横向随机漂移
let _mode = 'rain';
export function setWeatherMode(mode) { _mode = (mode === 'snow') ? 'snow' : 'rain'; }

const _pos  = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl  = new THREE.Vector3();
const _mat  = new THREE.Matrix4();
const _col  = new THREE.Color();

export function buildRain(scene) {
  if (_rainInstanced) return _rainInstanced;
  // 极窄细长矩形, 已经 rotate 过让 +Y 是朝上方向 (PlaneGeometry 默认在 XY 平面)
  const geo = new THREE.PlaneGeometry(0.04, 1.0);

  const mat = new THREE.MeshBasicMaterial({
    color: 0xdde6f0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
  });
  _rainInstanced = new THREE.InstancedMesh(geo, mat, RAIN_COUNT);
  _rainInstanced.frustumCulled = false;
  _rainInstanced.renderOrder = 12;    // 在云下, 在 UI 上
  _rainInstanced.visible = false;     // 默认关

  _rain = new Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    const d = {
      x: X_MIN + Math.random() * (X_MAX - X_MIN),
      y: Y_BOT + Math.random() * (Y_TOP - Y_BOT),
      z: Z_MIN + Math.random() * (Z_MAX - Z_MIN),
      vy: -(18 + Math.random() * 10),          // 下落速度
      tilt: 0.12 + Math.random() * 0.10,       // 轻微前倾角度 (视觉动感)
      len: 0.8 + Math.random() * 1.2,          // 每条长度
    };
    _rain[i] = d;
    _writeInstance(i, d);
  }
  _rainInstanced.instanceMatrix.needsUpdate = true;
  scene.add(_rainInstanced);
  return _rainInstanced;
}

function _writeInstance(i, d) {
  _pos.set(d.x, d.y, d.z);
  // 绕 Z 前倾 tilt, 给下落动感
  _quat.setFromEuler(new THREE.Euler(0, 0, d.tilt));
  _scl.set(1, d.len, 1);
  _mat.compose(_pos, _quat, _scl);
  _rainInstanced.setMatrixAt(i, _mat);
}

export function setRainEnabled(on) {
  _rainEnabled = !!on;
  _rainAlphaTarget = on ? 1 : 0;
  if (_rainInstanced) {
    if (on) _rainInstanced.visible = true;
    // 关雨时不直接隐, 等 fade 到 0 在 update 里再隐
  }
}
export function getRainEnabled() { return _rainEnabled; }

export function updateRain(dt) {
  if (!_rainInstanced) return;
  // alpha 渐变 (0.4s 左右)
  const aStep = dt * 2.5;
  if (_rainAlpha < _rainAlphaTarget) _rainAlpha = Math.min(_rainAlphaTarget, _rainAlpha + aStep);
  else if (_rainAlpha > _rainAlphaTarget) _rainAlpha = Math.max(_rainAlphaTarget, _rainAlpha - aStep);
  // 模式: rain opacity ~0.55, snow 偏轻 ~0.80 (白色、圆形, 视觉上需要更亮)
  _rainInstanced.material.opacity = _rainAlpha * (_mode === 'snow' ? 0.80 : 0.55);
  _rainInstanced.material.color.set(_mode === 'snow' ? '#fbfcfe' : '#dde6f0');
  if (_rainAlpha < 0.01 && !_rainEnabled) {
    _rainInstanced.visible = false;
    return;
  }
  if (!_rainEnabled && _rainAlpha < 0.01) return;

  const zMin = Z_MIN, zMax = Z_MAX;
  const xMin = X_MIN, xMax = X_MAX;
  const snow = _mode === 'snow';
  for (let i = 0; i < _rain.length; i++) {
    const d = _rain[i];
    if (snow) {
      // 雪: 下落慢, 横向漂移大, 粒子视觉更像圆点
      d.y += d.vy * dt * 0.32;                    // 约 1/3 雨速
      d.x += (Math.sin(d.tilt * 3) * 0.8) * dt;   // 更强左右漂移
      d.z += (Math.cos(d.tilt * 2.7) * 0.3) * dt;
    } else {
      d.y += d.vy * dt;
      d.x += Math.sin(d.tilt) * (-d.vy) * dt * 0.35;
    }
    if (d.y < Y_BOT || d.x > xMax + 5 || d.x < xMin - 5) {
      d.x = xMin + Math.random() * (xMax - xMin);
      d.y = Y_TOP;
      d.z = zMin + Math.random() * (zMax - zMin);
    }
    _writeInstance(i, d);
  }
  _rainInstanced.instanceMatrix.needsUpdate = true;
}
