// 夜模式月亮 sprite — 放在天空东北高处, 缓慢位移.
// 不归到 CloudBuilder 是因为 moon 的生命周期绑定 TimeOfDay, 单文件管理更清晰.
import * as THREE from 'three';

// Canvas 生成月亮: 主体柔和白盘 + 极淡月海斑 + 月晕光圈
function mkMoonTex() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const cx = c.getContext('2d');

  // 1) 外围月晕 (模糊光圈)
  const halo = cx.createRadialGradient(S / 2, S / 2, S * 0.22, S / 2, S / 2, S * 0.5);
  halo.addColorStop(0,    'rgba(255,248,220,0.55)');
  halo.addColorStop(0.45, 'rgba(255,245,215,0.22)');
  halo.addColorStop(1,    'rgba(255,240,200,0)');
  cx.fillStyle = halo;
  cx.fillRect(0, 0, S, S);

  // 2) 月盘主体 (radial gradient 让边缘微暗, 有 3D 感)
  const body = cx.createRadialGradient(S * 0.42, S * 0.42, 0, S / 2, S / 2, S * 0.23);
  body.addColorStop(0,   '#fffdf2');
  body.addColorStop(0.6, '#fbf2d0');
  body.addColorStop(1,   '#e6d7a2');
  cx.fillStyle = body;
  cx.beginPath();
  cx.arc(S / 2, S / 2, S * 0.23, 0, Math.PI * 2);
  cx.fill();

  // 3) 月海斑 (极淡的灰影)
  cx.globalAlpha = 0.18;
  cx.fillStyle = '#8a7a50';
  const maria = [
    [0.46, 0.45, 0.08],
    [0.54, 0.52, 0.055],
    [0.50, 0.60, 0.04],
    [0.58, 0.42, 0.035],
    [0.44, 0.55, 0.03],
  ];
  maria.forEach(([u, v, r]) => {
    cx.beginPath();
    cx.arc(u * S, v * S, r * S, 0, Math.PI * 2);
    cx.fill();
  });
  cx.globalAlpha = 1;

  // ── 月相阴影 — 按当日真实月相在月盘上盖一片半球阴影 ──
  // phase ∈ [0,1): 0 新月, 0.5 满月, 回到 1 又是新月.
  const phase = _computeMoonPhase(new Date());
  const moonR = S * 0.23;
  const mcx = S / 2, mcy = S / 2;
  // 阴影球圆心水平偏移: 新月时 0 (完全遮), 满月时 ±2R (球体移出), 半月时 ±R.
  let offsetX;
  if (phase < 0.5) offsetX = -moonR * 4 * phase;           // waxing: 0 → -2R
  else             offsetX = moonR * 2 * (1 - (phase - 0.5) * 2); // waning: 2R → 0
  // 满月附近 (偏移接近 ±2R) 就不画阴影了
  if (Math.abs(offsetX) < moonR * 1.95) {
    cx.save();
    cx.beginPath();
    cx.arc(mcx, mcy, moonR, 0, Math.PI * 2);
    cx.clip();
    const shadowG = cx.createRadialGradient(
      mcx + offsetX, mcy, moonR * 0.65,
      mcx + offsetX, mcy, moonR * 1.02
    );
    shadowG.addColorStop(0,    'rgba(22,18,35,0.82)');
    shadowG.addColorStop(0.85, 'rgba(22,18,35,0.78)');
    shadowG.addColorStop(1,    'rgba(22,18,35,0)');
    cx.fillStyle = shadowG;
    cx.beginPath();
    cx.arc(mcx + offsetX, mcy, moonR, 0, Math.PI * 2);
    cx.fill();
    cx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// 距参考新月 (2000-01-06 18:14 UTC) 的天数 mod 朔望周期 29.530588853, 归一化到 [0,1)
function _computeMoonPhase(date) {
  const refNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const lunarMonth = 29.530588853 * 86400 * 1000;
  const diff = date.getTime() - refNewMoon;
  return (((diff % lunarMonth) + lunarMonth) % lunarMonth) / lunarMonth;
}

let _moon = null;

export function buildMoon(scene) {
  if (_moon) return _moon;
  const tex = mkMoonTex();
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0,         // 默认隐, 由 setMoonOpacity 控制
    depthWrite: false,
    fog: false,         // 远天体不吃 fog
  });
  const sp = new THREE.Sprite(mat);
  // 放大 + 拉近: 原来 (55,60,-35) scale 14 过于遥远小, 改到 (35,45,-18) scale 24
  sp.scale.set(24, 24, 1);
  sp.position.set(35, 45, -18);
  sp.renderOrder = 2;
  sp.userData = { baseX: 35, baseZ: -18, phase: Math.random() * 6.28 };
  scene.add(sp);
  _moon = sp;
  return sp;
}

// TimeOfDay 系统调用. opacity 直接 set, 不做 tween (TimeOfDay 自己 tween 过一遍已经够柔).
export function setMoonOpacity(op) {
  if (!_moon) return;
  _moon.material.opacity = op;
  _moon.visible = op > 0.01;
}

// 每帧缓慢漂移 — 给夜景一点"时间流"
export function updateMoon(t) {
  if (!_moon || !_moon.visible) return;
  const u = _moon.userData;
  _moon.position.x = u.baseX + Math.sin(t * 0.015 + u.phase) * 3;
  _moon.position.z = u.baseZ + Math.cos(t * 0.012 + u.phase) * 2;
}
