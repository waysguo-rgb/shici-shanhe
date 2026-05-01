// Time-of-day 预设 — 切换 4 个时段: 晨 / 昼 / 暮 / 夜.
// 每个 preset 声明: fog color / background color / 主光源 (太阳) 方向+颜色+强度 /
// 环境光色调 / 半球光 / bloom 强度 / inkwash 暖度和暗角.
//
// 调用方式:
//   import { TIME_PRESETS, applyTimeOfDay } from './TimeOfDay.js';
//   applyTimeOfDay('dusk', { scene, dl, ambient, hemi, bloomPass, inkWashPass });
//
// 数值是第一轮, 接预览后需要再 tune. 主要原则:
//   - 晨: 粉金, 光从东, 低强度, inkwash 偏暖
//   - 昼: 当前状态 (0xa8824f fog, 白日暖光), 作为 "noon" 基准
//   - 暮: 橙红, 光从西, 中高强度, bloom 拉高
//   - 夜: 深靛, 月光从天顶, 低强度, bloom 主要作用在灯火
import * as THREE from 'three';

export const TIME_PRESETS = {
  dawn: {
    fogColor:       0xc8a090,
    bgColor:        0xe8c4a0,
    sunPos:         [70, 30, -20],   // 东, 低
    sunColor:       0xffd4a8,
    sunIntensity:   0.55,
    ambientColor:   0xffd0b8,
    ambientIntensity: 0.65,
    hemiSky:        0xfadabc,
    hemiGround:     0x4a3a2e,
    hemiIntensity:  0.38,
    fillColor:      0xb0a8d0,         // 冷色补光
    fillIntensity:  0.22,
    bloomStrength:  0.62,
    inkWarmth:      0.20,
    inkDesat:       0.14,
    inkVignette:    0.30,
    moonOpacity:    0,
    cityLightOp:    0,
  },
  noon: {
    // 当前项目已有状态的数值化快照
    fogColor:       0xa8824f,
    bgColor:        0xa8824f,
    sunPos:         [-45, 72, 35],
    sunColor:       0xffeac0,
    sunIntensity:   0.88,
    ambientColor:   0xfff0c8,
    ambientIntensity: 0.78,
    hemiSky:        0xfff4d0,
    hemiGround:     0x403020,
    hemiIntensity:  0.40,
    fillColor:      0x88a8c8,
    fillIntensity:  0.25,
    bloomStrength:  0.55,
    inkWarmth:      0.14,
    inkDesat:       0.14,
    inkVignette:    0.32,
    moonOpacity:    0,
    cityLightOp:    0,
  },
  dusk: {
    fogColor:       0xc87858,
    bgColor:        0xd88c5c,
    sunPos:         [-70, 20, 30],   // 西, 低
    sunColor:       0xff8858,
    sunIntensity:   0.78,
    ambientColor:   0xff9878,
    ambientIntensity: 0.60,
    hemiSky:        0xff9c68,
    hemiGround:     0x382838,
    hemiIntensity:  0.42,
    fillColor:      0x6870a0,
    fillIntensity:  0.30,
    bloomStrength:  0.78,
    inkWarmth:      0.22,
    inkDesat:       0.12,
    inkVignette:    0.34,
    moonOpacity:    0.25,     // 夕阳时天边已见一点月影
    cityLightOp:    0.35,     // 黄昏: 城灯开始点起来
  },
  night: {
    fogColor:       0x1a1f3a,
    bgColor:        0x111428,
    sunPos:         [10, 90, 20],    // 月光从天顶偏东
    sunColor:       0xa8b8d8,
    sunIntensity:   0.28,
    ambientColor:   0x405070,
    ambientIntensity: 0.35,
    hemiSky:        0x2a3850,
    hemiGround:     0x0a0c18,
    hemiIntensity:  0.28,
    fillColor:      0x304a70,
    fillIntensity:  0.20,
    bloomStrength:  0.90,              // bloom 主要给夜灯加光晕
    inkWarmth:     -0.10,              // 冷调
    inkDesat:       0.22,
    inkVignette:    0.42,
    moonOpacity:    0.95,
    cityLightOp:    0.78,      // 万家灯火: 0.55 → 0.78, 和选中光柱区分靠颜色 (金黄 vs 金黄, 但 beam 竖起来 + breath 更强)
  },
};

// Runtime state — 当前时段 + 是否在渐变
let _currentMode = 'noon';
let _tween = null;     // { fromPreset, toPreset, startT, dur, refs }

export function getCurrentMode() { return _currentMode; }

// 立即应用 (不渐变).
export function applyTimeOfDay(mode, refs) {
  const p = TIME_PRESETS[mode];
  if (!p) return;
  _currentMode = mode;
  _tween = null;
  _write(p, refs);
}

// 渐变过渡到目标时段. dur 单位秒. 调用方需在 animate 循环调 updateTimeOfDay(dt).
export function transitionTo(mode, refs, dur = 1.4) {
  const to = TIME_PRESETS[mode];
  if (!to) return;
  const from = _snapshotCurrent(refs);
  _tween = { from, to, refs, t: 0, dur };
  _currentMode = mode;
}

// 每帧推进渐变 — 若当前无 tween 直接 no-op.
export function updateTimeOfDay(dt) {
  if (!_tween) return;
  _tween.t += dt;
  const a = Math.min(1, _tween.t / _tween.dur);
  const k = a * a * (3 - 2 * a);   // smoothstep
  const lerped = _lerpPreset(_tween.from, _tween.to, k);
  _write(lerped, _tween.refs);
  if (a >= 1) _tween = null;
}

// ═══════════════════════════════════════
// 内部: 把 preset 写入到渲染 refs
// ═══════════════════════════════════════
function _write(p, refs) {
  const { scene, dl, ambient, hemi, fill, bloomPass, inkWashPass } = refs;
  if (scene && scene.fog) scene.fog.color.setHex(p.fogColor);
  if (scene) {
    if (scene.background && scene.background.isColor) {
      scene.background.setHex(p.bgColor);
    } else {
      scene.background = new THREE.Color(p.bgColor);
    }
  }
  if (dl) {
    dl.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    dl.color.setHex(p.sunColor);
    dl.intensity = p.sunIntensity;
  }
  if (ambient) {
    ambient.color.setHex(p.ambientColor);
    ambient.intensity = p.ambientIntensity;
  }
  if (hemi) {
    hemi.color.setHex(p.hemiSky);
    hemi.groundColor.setHex(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
  }
  if (fill) {
    fill.color.setHex(p.fillColor);
    fill.intensity = p.fillIntensity;
  }
  if (bloomPass) {
    bloomPass.strength = p.bloomStrength;
  }
  if (inkWashPass && inkWashPass.uniforms) {
    if (inkWashPass.uniforms.uWarmth)  inkWashPass.uniforms.uWarmth.value  = p.inkWarmth;
    if (inkWashPass.uniforms.uDesat)   inkWashPass.uniforms.uDesat.value   = p.inkDesat;
    if (inkWashPass.uniforms.uVignette) inkWashPass.uniforms.uVignette.value = p.inkVignette;
  }
  // 月亮 / 城灯 opacity 通过 refs 上的 callback 注入, 避免 TimeOfDay 依赖各 builder.
  if (refs.onMoonOp      && typeof p.moonOpacity  === 'number') refs.onMoonOp(p.moonOpacity);
  if (refs.onCityLightOp && typeof p.cityLightOp  === 'number') refs.onCityLightOp(p.cityLightOp);
  // Shadow map 需要重新烘 (光源方向变了)
  // 但 renderer.shadowMap.autoUpdate = false, 外层调用方需手动 flag.
}

// 读取当前渲染状态快照 (渐变起点). 回退 preset 默认值填空.
function _snapshotCurrent(refs) {
  const p = TIME_PRESETS[_currentMode] || TIME_PRESETS.noon;
  const snap = { ...p };
  const { scene, dl, ambient, hemi, fill, bloomPass, inkWashPass } = refs;
  if (scene && scene.fog)      snap.fogColor = scene.fog.color.getHex();
  if (scene && scene.background && scene.background.isColor) snap.bgColor = scene.background.getHex();
  if (dl) {
    snap.sunPos = [dl.position.x, dl.position.y, dl.position.z];
    snap.sunColor = dl.color.getHex();
    snap.sunIntensity = dl.intensity;
  }
  if (ambient) { snap.ambientColor = ambient.color.getHex(); snap.ambientIntensity = ambient.intensity; }
  if (hemi) {
    snap.hemiSky = hemi.color.getHex();
    snap.hemiGround = hemi.groundColor.getHex();
    snap.hemiIntensity = hemi.intensity;
  }
  if (fill) { snap.fillColor = fill.color.getHex(); snap.fillIntensity = fill.intensity; }
  if (bloomPass) snap.bloomStrength = bloomPass.strength;
  if (inkWashPass && inkWashPass.uniforms) {
    if (inkWashPass.uniforms.uWarmth)  snap.inkWarmth  = inkWashPass.uniforms.uWarmth.value;
    if (inkWashPass.uniforms.uDesat)   snap.inkDesat   = inkWashPass.uniforms.uDesat.value;
    if (inkWashPass.uniforms.uVignette) snap.inkVignette = inkWashPass.uniforms.uVignette.value;
  }
  return snap;
}

function _lerpHexColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bch = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bch;
}
function _lerp(a, b, t) { return a + (b - a) * t; }
function _lerpPreset(A, B, t) {
  return {
    fogColor:         _lerpHexColor(A.fogColor,       B.fogColor,       t),
    bgColor:          _lerpHexColor(A.bgColor,        B.bgColor,        t),
    sunPos:           [_lerp(A.sunPos[0], B.sunPos[0], t), _lerp(A.sunPos[1], B.sunPos[1], t), _lerp(A.sunPos[2], B.sunPos[2], t)],
    sunColor:         _lerpHexColor(A.sunColor,       B.sunColor,       t),
    sunIntensity:     _lerp(A.sunIntensity,           B.sunIntensity,   t),
    ambientColor:     _lerpHexColor(A.ambientColor,   B.ambientColor,   t),
    ambientIntensity: _lerp(A.ambientIntensity,       B.ambientIntensity, t),
    hemiSky:          _lerpHexColor(A.hemiSky,        B.hemiSky,        t),
    hemiGround:       _lerpHexColor(A.hemiGround,     B.hemiGround,     t),
    hemiIntensity:    _lerp(A.hemiIntensity,          B.hemiIntensity,  t),
    fillColor:        _lerpHexColor(A.fillColor,      B.fillColor,      t),
    fillIntensity:    _lerp(A.fillIntensity,          B.fillIntensity,  t),
    bloomStrength:    _lerp(A.bloomStrength,          B.bloomStrength,  t),
    inkWarmth:        _lerp(A.inkWarmth,              B.inkWarmth,      t),
    inkDesat:         _lerp(A.inkDesat,               B.inkDesat,       t),
    inkVignette:      _lerp(A.inkVignette,            B.inkVignette,    t),
    moonOpacity:      _lerp(A.moonOpacity || 0,       B.moonOpacity || 0,  t),
    cityLightOp:      _lerp(A.cityLightOp || 0,       B.cityLightOp || 0,  t),
  };
}
