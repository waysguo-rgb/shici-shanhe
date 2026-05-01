// 城市灯笼 — 夜模式下每个 location 在地面散出一圈暖黄光晕 (instanced quads,
// 平贴地面). 视觉上和"选中城市" 的垂直 vertical light beam 完全区分:
//   beam:    竖直, 金色, hover/click 触发
//   lantern: 水平光斑, 暖橙黄, 夜模式自动常亮
//
// 所以"看到哪些城亮着灯"就能直接感受"整个画面进入夜晚"的感觉, 不会误以为某座城
// 被选中.
import * as THREE from 'three';

// 灯笼光晕 — 金黄暖调 (AdditiveBlending)
function mkLanternTex() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S * 0.48);
  g.addColorStop(0,    'rgba(255,220,140,0.95)');
  g.addColorStop(0.25, 'rgba(255,200,110,0.72)');
  g.addColorStop(0.55, 'rgba(250,170,80,0.35)');
  g.addColorStop(0.85, 'rgba(220,130,60,0.10)');
  g.addColorStop(1,    'rgba(200,100,40,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

let _instanced = null;
let _count = 0;
let _opacity = 0;                  // 当前不透明度 (由 TimeOfDay 通过 setter 推)
let _opacityTarget = 0;            // 目标值 (由 setCityLanternOp 写入, update 里平滑)

const _pos  = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl  = new THREE.Vector3();
const _mat  = new THREE.Matrix4();

// 建所有灯笼. 每个 location 出一盏大灯 + 6 盏散落卫星灯 (半径 1-4 单位偏移),
// 视觉上形成 "万家灯火" 的城镇光团. 总 lantern = locations × 7.
// 用 per-instance instanceColor 让部分灯更亮部分更暗, 层次更丰富.
const SATELLITES_PER_CITY = 3;   // 每城 3 个散点灯 (原 6, 太密)

export function buildCityLanterns(positions, scene) {
  if (_instanced) return _instanced;
  const N = positions.length;
  _count = N * (1 + SATELLITES_PER_CITY);  // 总 instance 数
  const tex = mkLanternTex();
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
    blending: THREE.AdditiveBlending,
  });
  _instanced = new THREE.InstancedMesh(geo, mat, _count);
  _instanced.frustumCulled = false;
  _instanced.renderOrder = 8;
  _instanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(_count * 3), 3);

  const col = new THREE.Color();
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const [x, y, z] = positions[i];
    // 1) 主灯 (城中心, 大号, 亮度 1.0)
    {
      const r = 3.2 + Math.random() * 1.2;
      _pos.set(x, y + 0.05, z);
      _quat.set(0, 0, 0, 1);
      _scl.set(r, 1, r);
      _mat.compose(_pos, _quat, _scl);
      _instanced.setMatrixAt(idx, _mat);
      // 超过 1.0 让 bloom pass 可以咬上, 夜里城灯带金辉
      col.setRGB(1.45, 1.32, 1.15);
      _instanced.instanceColor.setXYZ(idx, col.r, col.g, col.b);
      idx++;
    }
    // 2) 6 盏卫星灯 (城郊), 小号, 亮度 0.5-1.2 随机 (万家错落感)
    for (let s = 0; s < SATELLITES_PER_CITY; s++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 1.5 + Math.random() * 3.0;
      const sx = x + Math.cos(ang) * dist;
      const sz = z + Math.sin(ang) * dist;
      const r = 1.1 + Math.random() * 0.9;
      _pos.set(sx, y + 0.05, sz);
      _scl.set(r, 1, r);
      _mat.compose(_pos, _quat, _scl);
      _instanced.setMatrixAt(idx, _mat);
      // 有的卫星灯偏亮 (1.2), 有的很暗 (0.45) — 错落感
      const b = 0.45 + Math.random() * 0.75;
      col.setRGB(b, b * 0.95, b * 0.84);
      _instanced.instanceColor.setXYZ(idx, col.r, col.g, col.b);
      idx++;
    }
  }
  _instanced.instanceMatrix.needsUpdate = true;
  _instanced.instanceColor.needsUpdate = true;
  scene.add(_instanced);
  return _instanced;
}

// TimeOfDay 调 — 目标 opacity
export function setCityLanternOp(op) {
  _opacityTarget = op;
}

// 每帧推 opacity 平滑追目标, 再做呼吸 breathing 调光
export function updateCityLanterns(dt, t) {
  if (!_instanced) return;
  // 追目标
  const step = dt * 3.0;
  if (_opacity < _opacityTarget) _opacity = Math.min(_opacityTarget, _opacity + step);
  else if (_opacity > _opacityTarget) _opacity = Math.max(_opacityTarget, _opacity - step);
  // 复合 breathing: 主呼吸 (0.8 Hz) + 快速二阶 (2.3 Hz) — 叠加出"灯芯跳动"的不规则感
  const breath = 0.88 + Math.sin(t * 0.8) * 0.08 + Math.sin(t * 2.3 + 1.7) * 0.045;
  _instanced.material.opacity = _opacity * breath;
  _instanced.visible = _opacity > 0.01;
}
