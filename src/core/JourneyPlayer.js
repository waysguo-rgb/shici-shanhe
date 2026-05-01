// 诗人游记 — 选中某位诗人后:
//   1) 除该诗人到过的城市外, 其它 label 淡到 12% opacity
//   2) 沿路线画一条金色虚线 (LineDashedMaterial)
//   3) 每个站点贴一枚带编号的金色圆标 (① ② ③ ...)
//   4) Play 按钮驱动 camera 依次飞临各站, 每站自动弹出诗词面板
//
// 和现有系统的集成通过 initJourneyPlayer({scene, L, pos3D, lbls, setCamTo, ...})
// 注入依赖, 解耦 App.vue / SceneManager 互相的依赖链.
import * as THREE from 'three';
import POET_JOURNEYS from '../data/poet_journeys.js';

const _state = {
  active:        null,
  stopIndices:   [],    // [{ idx: locationIndex, stop: { city, year, note } }]
  pathMesh:      null,
  stopMarkers:   [],
  playing:       false,
  playIdx:       0,
  playTimers:    [],
};

// 注入依赖 (scene, 现场数据, 相机控制, 面板触发)
let _scene = null, _L = null, _pos3D = null, _lbls = null;
let _setCamTo = null, _setLookTo = null, _setIsAnim = null, _openPanel = null;

export function initJourneyPlayer(deps) {
  _scene      = deps.scene;
  _L          = deps.L;
  _pos3D      = deps.pos3D;
  _lbls       = deps.lbls;
  _setCamTo   = deps.setCamTo;
  _setLookTo  = deps.setLookTo;
  _setIsAnim  = deps.setIsAnim;
  _openPanel  = deps.openPanel;
}

export function listPoets() {
  return POET_JOURNEYS.map(j => ({
    name: j.name, dyn: j.dyn, life: j.life, desc: j.desc, stopCount: j.stops.length
  }));
}

export function getActivePoet() {
  return _state.active ? _state.active.name : null;
}

export function isJourneyPlaying() {
  return _state.playing;
}

// 给 SceneManager 用 — 返回当前 journey 激活的 location 索引集合 (Set), 为空集表示没激活.
// updateLabels 会用这个"强制可见集", 让诗人游记下所有站点无视 tier 过滤.
export function getJourneyStopLocationSet() {
  if (!_state.active || _state.stopIndices.length === 0) return null;
  return new Set(_state.stopIndices.map(s => s.idx));
}

// ═══════════════════════════════════════
// Activate / deactivate
// ═══════════════════════════════════════
export function activateJourney(poetName) {
  const journey = POET_JOURNEYS.find(j => j.name === poetName);
  if (!journey || !_scene) return false;
  deactivateJourney();
  _state.active = journey;
  // 把 stop city name 解析成 location 索引 (对不上的就跳过, 不报错)
  _state.stopIndices = [];
  journey.stops.forEach(stop => {
    const idx = _L.findIndex(l => l.n === stop.city);
    if (idx >= 0) _state.stopIndices.push({ idx, stop });
  });
  _fadeNonStops();
  _buildPath();
  _buildStopNumbers();
  return true;
}

export function deactivateJourney() {
  stopJourney();
  _state.active = null;
  _state.stopIndices = [];
  if (_state.pathMesh) {
    _scene.remove(_state.pathMesh);
    _state.pathMesh.geometry.dispose();
    _state.pathMesh.material.dispose();
    _state.pathMesh = null;
  }
  _state.stopMarkers.forEach(m => {
    _scene.remove(m);
    if (m.material.map) m.material.map.dispose();
    m.material.dispose();
  });
  _state.stopMarkers = [];
  _restoreAllLabels();
}

function _fadeNonStops() {
  const stopSet = new Set(_state.stopIndices.map(s => s.idx));
  _lbls.forEach((el, i) => {
    if (stopSet.has(i)) {
      el.classList.remove('journey-dim');
      el.classList.add('journey-stop');
    } else {
      el.classList.add('journey-dim');
      el.classList.remove('journey-stop');
    }
  });
}

function _restoreAllLabels() {
  _lbls.forEach(el => {
    el.classList.remove('journey-dim');
    el.classList.remove('journey-stop');
  });
}

// ═══════════════════════════════════════
// Path: 真正有粗细的 TubeGeometry (WebGL 原生 Line 只有 1px, 太细看不见).
// CatmullRom 让路径带弧度, 比硬折线优雅. fog: false 远处也看得清.
// ═══════════════════════════════════════
function _buildPath() {
  const pts = _state.stopIndices.map(({ idx }) => {
    const p = _pos3D[idx];
    return new THREE.Vector3(p.x, p.y + 0.4, p.z);
  });
  if (pts.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.35);
  const segs = Math.max(64, pts.length * 12);
  const geo = new THREE.TubeGeometry(curve, segs, 0.18, 6, false);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe6c05a,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 15;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  _scene.add(mesh);
  _state.pathMesh = mesh;
}

// ═══════════════════════════════════════
// 站点编号圆标 (金色圆 + 数字)
// ═══════════════════════════════════════
function _mkNumberTex(n) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const cx = c.getContext('2d');
  // 圆形底
  const g = cx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S*0.45);
  g.addColorStop(0,   'rgba(255,225,120,1.0)');
  g.addColorStop(0.7, 'rgba(225,175,60,0.95)');
  g.addColorStop(1,   'rgba(150,95,30,0)');
  cx.fillStyle = g;
  cx.beginPath();
  cx.arc(S/2, S/2, S*0.42, 0, Math.PI*2);
  cx.fill();
  // 数字
  cx.fillStyle = '#2a1208';
  cx.font = 'bold 60px "Noto Serif SC", serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(String(n), S/2, S/2 + 5);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function _buildStopNumbers() {
  _state.stopIndices.forEach((s, order) => {
    const tex = _mkNumberTex(order + 1);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false,
      fog: false,        // 编号圆标也不吃 fog, 远处的站点号码可见
    });
    const sp = new THREE.Sprite(mat);
    sp.center = new THREE.Vector2(0.5, 0);     // 底部锚地面, 不漂
    sp.scale.set(2.0, 2.0, 1);
    const p = _pos3D[s.idx];
    sp.position.set(p.x, p.y + 0.1, p.z);
    sp.renderOrder = 16;
    // journey 站点编号位置一激活就不再动, 关 matrix autoUpdate
    sp.matrixAutoUpdate = false; sp.updateMatrix();
    _scene.add(sp);
    _state.stopMarkers.push(sp);
  });
}

// ═══════════════════════════════════════
// Auto-play
// ═══════════════════════════════════════
export function playJourney(stepDuration = 5000) {
  if (!_state.active || _state.stopIndices.length === 0) return;
  stopJourney();
  _state.playing = true;
  _state.playIdx = 0;
  _playStep(stepDuration);
}

function _playStep(stepDuration) {
  if (!_state.playing || _state.playIdx >= _state.stopIndices.length) {
    _state.playing = false;
    return;
  }
  const { idx } = _state.stopIndices[_state.playIdx];
  const p = _pos3D[idx];
  // 相机飞到 stop 上空 — 播放时拉得比单选诗词远, 让路线 + 编号 + 周围 stops
  // 能同时入画 (不像 selectLoc 那样贴脸, 贴脸会看不到全路线).
  _setCamTo(new THREE.Vector3(p.x + 8, p.y + 35, p.z + 28));
  _setLookTo(new THREE.Vector3(p.x, p.y, p.z));
  _setIsAnim(true);
  // 1.5s 后 camera 接近, 弹出诗词面板
  const openT = setTimeout(() => {
    if (_state.playing && _openPanel) _openPanel(idx);
  }, 1500);
  const nextT = setTimeout(() => {
    _state.playIdx++;
    _playStep(stepDuration);
  }, stepDuration);
  _state.playTimers.push(openT, nextT);
}

export function stopJourney() {
  _state.playing = false;
  _state.playTimers.forEach(t => clearTimeout(t));
  _state.playTimers = [];
}
