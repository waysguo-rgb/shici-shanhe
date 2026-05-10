// PoetGraph3D — 诗人关系 3D 图谱 (Three.js).
// 与地图主 scene 隔离, 独立 webgl 上下文挂在弹层 div.
//
// API:
//   mount(container, callbacks)        — 创建 scene + 启动 animate loop
//   setData({nodes, edges})            — 清旧 mesh 建新的; nodes/edges 来自 App.vue 的 _initGraph 数据收集
//   dispose()                          — 停 animate, 释放 geometry/material/texture/renderer (反复开关图谱不漏)
//
// 布局:
//   X = 中位年份 [-55, 55]   左早右晚
//   Y = 朝代分层 (汉=-12, 唐=0, 宋=8, 元=14, 明=18, 清=22)
//   Z = 名字稳定哈希 [-12, 12] 散开

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── 朝代色带 (画在底面参考用, X 时间轴) ──
const ERA_LAYERS = [
  { name: '先秦', from: -1000, to: -221, color: 0x8c98a0 },
  { name: '汉',   from: -206,  to: 220,  color: 0xa58258 },
  { name: '魏晋', from: 220,   to: 420,  color: 0x788e98 },
  { name: '南北朝', from: 420, to: 589,  color: 0x8385a8 },
  { name: '隋',   from: 581,   to: 618,  color: 0xa58e6a },
  { name: '唐',   from: 618,   to: 907,  color: 0xd0a050 },
  { name: '五代', from: 907,   to: 960,  color: 0xa88e6a },
  { name: '宋',   from: 960,   to: 1279, color: 0x6ea890 },
  { name: '元',   from: 1271,  to: 1368, color: 0x8e8eb0 },
  { name: '明',   from: 1368,  to: 1644, color: 0xb08698 },
  { name: '清',   from: 1644,  to: 1912, color: 0xa89880 },
];
const YEAR_MIN = -1000, YEAR_MAX = 1912;
const X_RANGE = 55;
const yearToX = (y) => ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * (X_RANGE * 2) - X_RANGE;
const eraOf = (year) => {
  for (const e of ERA_LAYERS) if (year >= e.from && year <= e.to) return e;
  return ERA_LAYERS[5];
};

// ── 风格/流派分层 (Y 高度) + 颜色 ──
// 每个流派占一个 Y 层, 节点颜色 = 流派色. 旋转视角能看出诗人风格簇的立体分组.
const STYLE_LAYERS = [
  { name: '豪放',     y:  18, color: 0xb8362a, key: 'haofang' },
  { name: '现实',     y:  12, color: 0x3470a8, key: 'realist' },
  { name: '边塞',     y:   8, color: 0xa8702c, key: 'frontier' },
  { name: '浪漫',     y:   4, color: 0x7a3a9c, key: 'romantic' },
  { name: '山水田园', y:   0, color: 0x4a8a4e, key: 'landscape' },
  { name: '婉约',     y:  -4, color: 0xc8587a, key: 'wanyue' },
  { name: '怀古咏史', y:  -8, color: 0xc87a30, key: 'huaigu' },
  { name: '花间',     y: -12, color: 0xa86890, key: 'huajian' },
  { name: '理学哲思', y: -16, color: 0x3a8c8c, key: 'lixue' },
  { name: '初唐四杰', y:  22, color: 0x7a98c0, key: 'chutang' },
  { name: '其他',     y: -20, color: 0x7a7060, key: 'misc' },
];
const STYLE_BY_KEY = {};
STYLE_LAYERS.forEach(s => { STYLE_BY_KEY[s.key] = s; });

// 作者 → 流派 key 主流派 (有些诗人跨流派, 取代表作的流派)
const AUTHOR_STYLE = {
  // 豪放
  '苏轼':'haofang','辛弃疾':'haofang','岳飞':'haofang','文天祥':'haofang','陆游':'haofang','张孝祥':'haofang','苏舜钦':'haofang','贺铸':'haofang',
  // 现实
  '杜甫':'realist','白居易':'realist','元稹':'realist','张籍':'realist','王建':'realist','聂夷中':'realist','皮日休':'realist','陆龟蒙':'realist',
  // 边塞
  '高适':'frontier','岑参':'frontier','王昌龄':'frontier','王之涣':'frontier','王翰':'frontier','李颀':'frontier','卢纶':'frontier','陈陶':'frontier','畅当':'frontier',
  // 浪漫飘逸
  '李白':'romantic','李贺':'romantic','李商隐':'romantic',
  // 山水田园
  '王维':'landscape','孟浩然':'landscape','储光羲':'landscape','常建':'landscape','韦应物':'landscape','柳宗元':'landscape','陶渊明':'landscape','范成大':'landscape','杨万里':'landscape','林逋':'landscape','张志和':'landscape','皎然':'landscape','贾岛':'landscape',
  // 婉约
  '柳永':'wanyue','李清照':'wanyue','晏殊':'wanyue','晏几道':'wanyue','秦观':'wanyue','周邦彦':'wanyue','欧阳修':'wanyue','张先':'wanyue','姜夔':'wanyue','吴文英':'wanyue','蒋捷':'wanyue','纳兰性德':'wanyue',
  // 怀古咏史
  '杜牧':'huaigu','刘禹锡':'huaigu','张养浩':'huaigu','谭嗣同':'huaigu','龚自珍':'huaigu','黄庭坚':'huaigu',
  // 花间词派
  '温庭筠':'huajian','韦庄':'huajian','冯延巳':'huajian','李煜':'huajian','李璟':'huajian',
  // 理学哲思
  '朱熹':'lixue','邵雍':'lixue','周敦颐':'lixue','张栻':'lixue','陈与义':'lixue',
  // 初唐
  '王勃':'chutang','杨炯':'chutang','卢照邻':'chutang','骆宾王':'chutang','宋之问':'chutang','陈子昂':'chutang',
  // 唐其他大家
  '贺知章':'landscape','张九龄':'landscape','刘长卿':'landscape','韩愈':'realist','贾岛':'landscape',
  // 现代
  '毛泽东':'haofang','谢道韫':'misc','曹操':'haofang',
};
const styleOf = (author) => STYLE_BY_KEY[AUTHOR_STYLE[author]] || STYLE_BY_KEY['misc'];
// 名字 hash → Z 散开
const hashToZ = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % 2400) / 2400) * 22 - 11;
};

// ── 模块状态 ──
let _scene, _camera, _renderer, _controls;
let _nodeGroup, _edgeGroup, _labelGroup, _eraGroup, _timeGroup;
let _nodes = [], _edges = [];                       // 数据
let _nodeMeshes = [], _edgeMeshes = [], _labelSprites = [];
let _nodeIdxToEdges = new Map();                    // node idx → [edge idx]
let _animId = 0, _container = null;
let _raycaster, _pointer = new THREE.Vector2();
let _onHoverNode = null, _onHoverEdge = null, _onClickNode = null;
let _hoverNodeIdx = -1, _hoverEdgeIdx = -1;
let _highlightDirty = false;
let _resizeObs = null;
let _moveRaf = 0, _lastMoveEv = null;
let _cameraDistCache = 0;

// ── 公开 API ──

// 给 App.vue 渲染图例用. 返回 [{key, name, color: '#hex'}]
export function getStyleLegend() {
  return STYLE_LAYERS.map(s => ({
    key: s.key, name: s.name,
    color: '#' + s.color.toString(16).padStart(6, '0'),
  }));
}

export function _testRayAt(cssX, cssY) {
  if (!_raycaster || !_renderer) return { err: 'no raycaster' };
  const rect = _renderer.domElement.getBoundingClientRect();
  _pointer.x = (cssX / rect.width) * 2 - 1;
  _pointer.y = -(cssY / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_pointer, _camera);
  _scene.updateMatrixWorld(true);
  const hitsN = _raycaster.intersectObjects(_nodeMeshes, true);
  const hitsE = _raycaster.intersectObjects(_edgeMeshes, true);
  return {
    pointer: [_pointer.x.toFixed(2), _pointer.y.toFixed(2)],
    rectW: rect.width, rectH: rect.height,
    nodeHits: hitsN.length,
    edgeHits: hitsE.length,
    firstNode: hitsN[0] ? { idx: hitsN[0].object.userData.idx, dist: hitsN[0].distance.toFixed(1), name: _nodes[hitsN[0].object.userData.idx]?.a } : null,
  };
}

export function _debug() {
  // 取若干节点 project 到屏幕看
  if (_camera) _camera.updateMatrixWorld(true);
  const W = _renderer ? _renderer.domElement.width : 1200;
  const H = _renderer ? _renderer.domElement.height : 600;
  const samples = _nodeMeshes.slice(0, 5).map(m => {
    const p = m.position.clone();
    const v = p.project(_camera);
    const sx = ((v.x + 1) * 0.5 * W) | 0;
    const sy = ((1 - (v.y + 1) * 0.5) * H) | 0;
    const dist = _camera ? _camera.position.distanceTo(m.position).toFixed(1) : '?';
    return { a: _nodes[m.userData.idx].a, world: [m.position.x.toFixed(1), m.position.y.toFixed(1), m.position.z.toFixed(1)], r: m.userData.r.toFixed(2), screenPx: [sx, sy], dist };
  });
  return {
    sceneChildren: _scene?.children.length || 0,
    nodeMeshes: _nodeMeshes.length,
    edgeMeshes: _edgeMeshes.length,
    nodes: _nodes.length,
    edges: _edges.length,
    cam: _camera ? [_camera.position.x.toFixed(1), _camera.position.y.toFixed(1), _camera.position.z.toFixed(1)] : null,
    target: _controls ? [_controls.target.x.toFixed(1), _controls.target.y.toFixed(1), _controls.target.z.toFixed(1)] : null,
    rendererSize: _renderer ? [_renderer.domElement.width, _renderer.domElement.height] : null,
    samples,
    hoverNodeIdx: _hoverNodeIdx,
    hoverEdgeIdx: _hoverEdgeIdx,
  };
}


export function mount(container, callbacks = {}) {
  if (_renderer) dispose();   // 防重入
  _container = container;
  _onHoverNode = callbacks.onHoverNode || null;
  _onHoverEdge = callbacks.onHoverEdge || null;
  _onClickNode = callbacks.onClickNode || null;

  const w = container.clientWidth || 1200;
  const h = container.clientHeight || 600;

  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(0xf0e0c0);
  // Fog 关掉 — 之前 (80, 220) 把节点 (距离 ~75) 几乎淡化没

  _camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 1000);
  // 默认略斜俯视, 一眼看出流派分层 + 时间分布
  _camera.position.set(-15, 35, 75);
  _camera.lookAt(0, 0, 0);

  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  _renderer.setSize(w, h);
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(_renderer.domElement);
  _renderer.domElement.style.cursor = 'grab';

  _controls = new OrbitControls(_camera, _renderer.domElement);
  _controls.enableDamping = true;
  _controls.dampingFactor = 0.07;
  _controls.minDistance = 15;
  _controls.maxDistance = 150;
  _controls.minPolarAngle = Math.PI / 8;
  _controls.maxPolarAngle = Math.PI * 5 / 8;
  _controls.target.set(0, 0, 0);

  // 灯光: ambient + 1 directional 给球体高光阴影暗示
  const amb = new THREE.AmbientLight(0xfff4dc, 0.85);
  _scene.add(amb);
  const dl = new THREE.DirectionalLight(0xffeac0, 0.85);
  dl.position.set(-30, 50, 25);
  _scene.add(dl);

  _raycaster = new THREE.Raycaster();
  _raycaster.params.Line = { threshold: 0.6 };

  _nodeGroup = new THREE.Group(); _scene.add(_nodeGroup);
  _edgeGroup = new THREE.Group(); _scene.add(_edgeGroup);
  _labelGroup = new THREE.Group(); _scene.add(_labelGroup);
  _eraGroup = new THREE.Group(); _scene.add(_eraGroup);
  _timeGroup = new THREE.Group(); _scene.add(_timeGroup);

  _buildStyleLayers();      // 流派水平地板 + 流派名 (主视觉骨架)
  _buildEraStripsAtBottom(); // 朝代色带画在底部参考
  _buildTimeAxis();

  // 事件
  const dom = _renderer.domElement;
  dom.addEventListener('mousemove', _onMouseMove);
  dom.addEventListener('click', _onClick);
  dom.addEventListener('mouseleave', _onMouseLeave);
  // resize
  _resizeObs = new ResizeObserver(() => _onResize());
  _resizeObs.observe(container);

  _animate();
}

export function setData({ nodes, edges }) {
  _clearMeshes();
  _nodes = (nodes || []).map(n => {
    const era = eraOf(n.year);
    const style = styleOf(n.a);
    const x = yearToX(n.year);
    const y = style.y;                  // Y = 流派分层 (替代之前的朝代分层)
    const z = hashToZ(n.a);
    return { ...n, _x: x, _y: y, _z: z, _era: era, _style: style };
  });
  _edges = edges || [];

  _nodeIdxToEdges.clear();
  _edges.forEach((e, ei) => {
    if (!_nodeIdxToEdges.has(e.s)) _nodeIdxToEdges.set(e.s, []);
    if (!_nodeIdxToEdges.has(e.t)) _nodeIdxToEdges.set(e.t, []);
    _nodeIdxToEdges.get(e.s).push(ei);
    _nodeIdxToEdges.get(e.t).push(ei);
  });

  _buildNodes();
  _buildEdges();
  _buildLabels();
}

export function dispose() {
  if (_animId) cancelAnimationFrame(_animId), _animId = 0;
  if (_resizeObs) _resizeObs.disconnect(), _resizeObs = null;
  if (_renderer) {
    _renderer.domElement.removeEventListener('mousemove', _onMouseMove);
    _renderer.domElement.removeEventListener('click', _onClick);
    _renderer.domElement.removeEventListener('mouseleave', _onMouseLeave);
  }
  _clearMeshes();
  // era + time
  [_eraGroup, _timeGroup, _labelGroup, _nodeGroup, _edgeGroup].forEach(g => {
    if (!g) return;
    while (g.children.length) {
      const c = g.children.pop();
      _disposeObject(c);
    }
  });
  if (_controls) { _controls.dispose(); _controls = null; }
  if (_renderer) {
    _renderer.dispose();
    _renderer.forceContextLoss();
    if (_renderer.domElement?.parentElement) {
      _renderer.domElement.parentElement.removeChild(_renderer.domElement);
    }
    _renderer = null;
  }
  _scene = null; _camera = null;
  _container = null;
  _nodes = []; _edges = [];
  _nodeMeshes = []; _edgeMeshes = []; _labelSprites = [];
  _hoverNodeIdx = -1; _hoverEdgeIdx = -1;
}

// ── 内部 ──

function _animate() {
  _animId = requestAnimationFrame(_animate);
  if (!_renderer) return;
  _controls.update();

  // LOD: 距离 > 80 时标签淡化 / 隐藏
  const camDist = _camera.position.length();
  if (Math.abs(camDist - _cameraDistCache) > 0.5) {
    _cameraDistCache = camDist;
    const labelOp = camDist < 50 ? 1 : camDist < 80 ? (1 - (camDist - 50) / 30) : 0;
    for (const sp of _labelSprites) {
      if (sp.material) sp.material.opacity = labelOp * (sp._dimmed ? 0.18 : 1);
      sp.visible = labelOp > 0.05;
    }
  }

  _renderer.render(_scene, _camera);
}

function _onResize() {
  if (!_renderer || !_container) return;
  const w = _container.clientWidth, h = _container.clientHeight;
  _renderer.setSize(w, h);
  _camera.aspect = w / h;
  _camera.updateProjectionMatrix();
}

function _onMouseMove(ev) {
  // 直接做 raycast (旧版 rAF 节流方案在某些浏览器下 _lastMoveEv 没被 animate loop 消费)
  _doRaycast(ev);
}
function _onMouseLeave() {
  _lastMoveEv = null;
  _hoverNodeIdx = -1; _hoverEdgeIdx = -1;
  _applyHighlight();
  if (_onHoverNode) _onHoverNode(null);
  if (_onHoverEdge) _onHoverEdge(null);
  _renderer.domElement.style.cursor = 'grab';
}
function _onClick(ev) {
  if (_hoverNodeIdx >= 0 && _onClickNode) {
    _onClickNode(_nodes[_hoverNodeIdx]);
  }
}
function _doRaycast(ev) {
  const rect = _renderer.domElement.getBoundingClientRect();
  _pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  _pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_pointer, _camera);
  // 强制刷新 mesh 世界矩阵 (intersectObjects 默认只刷顶层, 防止落后帧)
  _scene.updateMatrixWorld(true);

  // 先测节点
  const hitsN = _raycaster.intersectObjects(_nodeMeshes, true);
  let nIdx = -1, eIdx = -1;
  if (hitsN.length) nIdx = hitsN[0].object.userData.idx;
  // 只有节点未命中时再测边 (节点优先)
  if (nIdx < 0) {
    const hitsE = _raycaster.intersectObjects(_edgeMeshes, true);
    if (hitsE.length) eIdx = hitsE[0].object.userData.idx;
  }
  let changed = false;
  if (nIdx !== _hoverNodeIdx) { _hoverNodeIdx = nIdx; changed = true; }
  if (eIdx !== _hoverEdgeIdx) { _hoverEdgeIdx = eIdx; changed = true; }
  if (changed) {
    _applyHighlight();
    if (_onHoverNode) _onHoverNode(nIdx >= 0 ? _nodes[nIdx] : null);
    if (_onHoverEdge) _onHoverEdge(eIdx >= 0 ? _edges[eIdx] : null);
    _renderer.domElement.style.cursor = (nIdx >= 0 || eIdx >= 0) ? 'pointer' : 'grab';
  }
}

// ── 建几何体 ──

function _buildNodes() {
  const geo = new THREE.SphereGeometry(1, 16, 12);   // 共享 geometry, 缩放每节点
  for (let i = 0; i < _nodes.length; i++) {
    const n = _nodes[i];
    // 球大小减半: poemCount 1-100 映射到 r=0.9-2.4 (原来 2.2-6.0)
    const r = 0.9 + Math.min(Math.log2(n.poemCount + 1) * 0.32, 1.6);
    const baseColor = n._style.color;
    // 暗色 emissive = baseColor 的 1/4 强度, 让球体在背光面也有微光不全黑
    const emissive = (((baseColor >> 16) & 0xff) >> 2) << 16
                   | (((baseColor >> 8)  & 0xff) >> 2) << 8
                   |  ((baseColor        & 0xff) >> 2);
    const mat = new THREE.MeshPhongMaterial({
      color: baseColor,
      specular: 0x553322,
      shininess: 45,
      emissive,
      transparent: true,
      opacity: 1,
    });
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(r);
    m.position.set(n._x, n._y, n._z);
    m.renderOrder = 5;
    m.userData = { idx: i, baseColor, baseEmissive: emissive, r };
    _nodeGroup.add(m);
    _nodeMeshes.push(m);
  }
}

function _buildEdges() {
  for (let i = 0; i < _edges.length; i++) {
    const e = _edges[i];
    const s = _nodes[e.s], t = _nodes[e.t];
    if (!s || !t) continue;
    const sv = new THREE.Vector3(s._x, s._y, s._z);
    const tv = new THREE.Vector3(t._x, t._y, t._z);
    const mid = sv.clone().add(tv).multiplyScalar(0.5);
    // 控制点朝外凸起 (远离原点) + Y 上抬, 形成 3D 弧
    const outward = mid.clone().setY(0).normalize();
    const archHeight = 4 + Math.log2(e.w + 1) * 3;
    const ctrl = mid.clone().add(outward.multiplyScalar(archHeight * 0.4)).setY(mid.y + archHeight);
    const curve = new THREE.QuadraticBezierCurve3(sv, ctrl, tv);
    // 视觉 tube 半径 (粗到 raycaster 容易命中, 但不至于挤占节点空间)
    const tubeR = 0.22 + Math.min(Math.log2(e.w + 1) * 0.14, 0.65);
    const geo = new THREE.TubeGeometry(curve, 28, tubeR, 8, false);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xd4a050,
      emissive: 0x664020,
      transparent: true,
      opacity: 0.85,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;            // 边画在节点下
    m.userData = { idx: i, baseColor: 0xd4a050 };
    _edgeGroup.add(m);
    _edgeMeshes.push(m);
  }
}

function _buildLabels() {
  for (let i = 0; i < _nodes.length; i++) {
    const n = _nodes[i];
    const sp = _makeTextSprite(n.a, '#fff8e0', 'rgba(40,12,5,0.85)');
    const r = _nodeMeshes[i]?.userData.r || 1.4;
    sp.position.set(n._x, n._y + r + 1.2, n._z);
    sp.userData = { idx: i };
    sp._dimmed = false;
    _labelGroup.add(sp);
    _labelSprites.push(sp);
  }
}

function _makeTextSprite(text, fg, shadow) {
  const dpr = 2;
  const fontPx = 28;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = `bold ${fontPx}px "LXGW WenKai","Noto Serif SC",serif`;
  const tw = ctx.measureText(text).width;
  cv.width  = Math.ceil((tw + 16) * dpr);
  cv.height = Math.ceil((fontPx + 12) * dpr);
  ctx.scale(dpr, dpr);
  ctx.font = `bold ${fontPx}px "LXGW WenKai","Noto Serif SC",serif`;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = shadow; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
  ctx.fillStyle = fg;
  ctx.fillText(text, 8, (fontPx + 12) / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  // 经验比例: canvas 高 = fontPx+12 → world 高 ~ 2 单位
  const worldH = 1.6;
  sp.scale.set(worldH * (cv.width / cv.height), worldH, 1);
  return sp;
}

// 流派水平地板 — 每个流派一个长长的半透明色板, 节点像"立"在板上
function _buildStyleLayers() {
  const Z_HALF = 14;    // Z 方向地板半宽
  for (const s of STYLE_LAYERS) {
    // 流派地板 (X 方向跨整个时间轴, Z 方向 ±Z_HALF)
    const geo = new THREE.PlaneGeometry(X_RANGE * 2 + 8, Z_HALF * 2);
    const mat = new THREE.MeshBasicMaterial({
      color: s.color,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, s.y - 0.4, 0);
    plane.renderOrder = 0;
    _eraGroup.add(plane);
    // 地板边框 (薄线框) 强化分层视觉
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: s.color, transparent: true, opacity: 0.45,
    }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, s.y - 0.4, 0);
    _eraGroup.add(line);
    // 流派名 sprite (左端, 大字)
    const styleSprite = _makeTextSprite(s.name, '#3a1808', 'rgba(255,245,210,1)');
    styleSprite.scale.multiplyScalar(1.15);
    styleSprite.position.set(-X_RANGE - 2, s.y + 0.3, Z_HALF + 1);
    _eraGroup.add(styleSprite);
  }
}

// 朝代色带 (画在最低流派板下面 1 单位作时间参考)
function _buildEraStripsAtBottom() {
  const yBottom = STYLE_LAYERS.reduce((m, s) => Math.min(m, s.y), 0) - 4;
  for (const era of ERA_LAYERS) {
    const fx = yearToX(Math.max(era.from, YEAR_MIN));
    const tx = yearToX(Math.min(era.to, YEAR_MAX));
    const w = tx - fx;
    if (w < 0.5) continue;
    const geo = new THREE.PlaneGeometry(w, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: era.color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(fx + w / 2, yBottom, 0);
    _eraGroup.add(plane);
    if (w > 4) {
      const sp = _makeTextSprite(era.name, '#3a1808', 'rgba(255,245,210,1)');
      sp.scale.multiplyScalar(0.7);
      sp.position.set(fx + w / 2, yBottom + 1.2, 0);
      _eraGroup.add(sp);
    }
  }
}

function _buildTimeAxis() {
  // 底部时间轴线
  const yLine = -28;
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-X_RANGE - 4, yLine, 0),
    new THREE.Vector3(X_RANGE + 4, yLine, 0),
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x6a4015, transparent: true, opacity: 0.55 });
  const line = new THREE.Line(lineGeo, lineMat);
  _timeGroup.add(line);
  // 每 100 年一个刻度 + 数字
  for (let y = Math.ceil(YEAR_MIN / 100) * 100; y <= YEAR_MAX; y += 100) {
    const x = yearToX(y);
    // 短刻度
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, yLine, 0),
      new THREE.Vector3(x, yLine + 0.6, 0),
    ]);
    const tick = new THREE.Line(tickGeo, lineMat);
    _timeGroup.add(tick);
    // 数字 (每 200 年才显字, 避免太挤)
    if (y % 200 === 0) {
      const sp = _makeTextSprite(y < 0 ? '前' + (-y) : String(y), '#5c3010', 'rgba(252,238,205,0.95)');
      sp.position.set(x, yLine - 1.6, 0);
      sp.scale.multiplyScalar(0.55);
      _timeGroup.add(sp);
    }
  }
}

// ── hover 高亮 ──

function _applyHighlight() {
  const hi = _hoverNodeIdx;
  const ei = _hoverEdgeIdx;
  // 计算被点亮的节点集合 (hover 节点 + 它的邻居; 或 hover 边的两端)
  let active = null;
  if (hi >= 0) {
    active = new Set([hi]);
    const elist = _nodeIdxToEdges.get(hi) || [];
    for (const idx of elist) {
      const ed = _edges[idx];
      active.add(ed.s); active.add(ed.t);
    }
  } else if (ei >= 0) {
    const ed = _edges[ei];
    active = new Set([ed.s, ed.t]);
  }
  // 节点
  for (let i = 0; i < _nodeMeshes.length; i++) {
    const m = _nodeMeshes[i];
    const isHover = i === hi;
    const isActive = !active || active.has(i);
    m.material.opacity = isActive ? 1 : 0.18;
    m.material.emissive.setHex(isHover ? 0xffaa44 : m.userData.baseEmissive);
    m.scale.setScalar(m.userData.r * (isHover ? 1.30 : 1));
  }
  // 边
  for (let i = 0; i < _edgeMeshes.length; i++) {
    const m = _edgeMeshes[i];
    const ed = _edges[i];
    const isHoverEdge = i === ei;
    if (isHoverEdge) {
      m.material.color.setHex(0xff5028);
      m.material.emissive.setHex(0xaa2810);
      m.material.opacity = 1;
    } else if (active && (active.has(ed.s) || active.has(ed.t))) {
      // 邻居边: 加亮
      m.material.color.setHex(0xffe8a8);
      m.material.emissive.setHex(0xc88040);
      m.material.opacity = 1;
    } else {
      m.material.color.setHex(0xd4a050);
      m.material.emissive.setHex(0x664020);
      m.material.opacity = active ? 0.10 : 0.85;
    }
  }
  // 标签
  for (let i = 0; i < _labelSprites.length; i++) {
    const sp = _labelSprites[i];
    const isActive = !active || active.has(i);
    sp._dimmed = !isActive;
  }
  // 强制下一帧 LOD pass 应用 _dimmed
  _cameraDistCache = -1;
}

// ── 清理 ──

function _clearMeshes() {
  for (const m of _nodeMeshes) { _nodeGroup?.remove(m); _disposeObject(m); }
  for (const m of _edgeMeshes) { _edgeGroup?.remove(m); _disposeObject(m); }
  for (const m of _labelSprites) { _labelGroup?.remove(m); _disposeObject(m); }
  _nodeMeshes = []; _edgeMeshes = []; _labelSprites = [];
}
function _disposeObject(obj) {
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    const m = obj.material;
    if (m.map) m.map.dispose();
    m.dispose();
  }
}
