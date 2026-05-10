// Main orchestrator: scene init, render loop, label projection, camera animation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Post-processing pipeline: bloom for light beams + SMAA for edge AA
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }    from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass }      from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { SSAOPass }      from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { makeInkWashPass, setTone, updateTone } from './InkWashPass.js';
export { setTone };
import { initPetals, updatePetals, resizePetals, setPetalLakes, setPetalLandCallback, setPetalsEnabled } from './PetalParticles.js';
// Real atmospheric sky (Rayleigh/Mie scattering)
import { Sky }           from 'three/examples/jsm/objects/Sky.js';

// Data
import { MOB, SGWT, SGHT, LOD_LO_W, LOD_LO_H, LOD_SWITCH_DIST, CLOUD_N,
         PW, PH, BGC, Z, TS, TX0, TY0, MW, MH } from '../data/constants.js';
import RIVERS from '../data/rivers.js';
import LAKES from '../data/lakes.js';

// Core modules
import { ll2s } from './helpers.js';
import {
  loadDEM, setHD, getHD,
  setTerrainRef, setTerrainLoRef, setTerrainLOD,
  buildHMap, buildHMapLo,
  hAt, getH, scaleH,
  terrainLOD
} from './TerrainBuilder.js';
import { cacheGet, cachePut, cacheKeyFor } from './TerrainCache.js';
import { riverMeshes, mkRiver, finalizeRivers, updateRivers, buildRiverLabels, riverLabels } from './RiverBuilder.js';
import { lakeMeshes, mkLake, buildLakeLabels, lakeLabels, buildLakeMask } from './LakeBuilder.js';
import { waveMeshes, mkWavePatch, buildCoastWaves, coastWaveData, animateSea } from './WaveBuilder.js';
import { cloudGroups, mkCloudCluster, mkMistBand, mkDistantSilhouette, finalizeCloudOpacity } from './CloudBuilder.js';
import { addDistantMountains, setDistantMountainTexture, setDistantMountainsVisible } from './DistantMountains.js';
export { setDistantMountainTexture, setDistantMountainsVisible };
import { beamMeshes, mkLightBeam } from './BeamBuilder.js';
import { makeWaterMaterial, waterMaterials } from './WaterMaterial.js';
import { transitionTo as _todTransition, applyTimeOfDay as _todApply, updateTimeOfDay as _todUpdate, getCurrentMode as _todGetMode } from './TimeOfDay.js';
import { buildMoon, setMoonOpacity, updateMoon } from './MoonBuilder.js';
import { buildRain, setRainEnabled, getRainEnabled, updateRain } from './WeatherBuilder.js';
import { buildCityLanterns, setCityLanternOp, updateCityLanterns } from './CityLanternBuilder.js';
import { buildLineBoards, updateLineBoards, lineBoards, setLineBoardsEnabled, getLineBoardsEnabled, setLineBoardsDynasty } from './LineBoardBuilder.js';
import { getJourneyStopLocationSet } from './JourneyPlayer.js';

// 外部调: 控制名句立牌显隐 / 朝代滤镜
export function toggleLineBoards() { setLineBoardsEnabled(!getLineBoardsEnabled()); return getLineBoardsEnabled(); }
export function setBoardsDyn(dyn) { setLineBoardsDynasty(dyn); }

// Raycaster 点击立牌 → 返回命中的 location idx, 否则 -1
const _rayRaycaster = new THREE.Raycaster();
const _rayMouse = new THREE.Vector2();
export function raycastLineBoard(ndcX, ndcY) {
  if (!camera || lineBoards.length === 0) return -1;
  _rayMouse.set(ndcX, ndcY);
  _rayRaycaster.setFromCamera(_rayMouse, camera);
  const hits = _rayRaycaster.intersectObjects(lineBoards, false);
  if (hits.length > 0 && hits[0].object.visible && hits[0].object.material.opacity > 0.3) {
    return hits[0].object.userData.anchorIdx ?? -1;
  }
  return -1;
}
import { buildGeese, updateGeese, buildBoats, updateBoats } from './WildlifeBuilder.js';
import { buildRipplePool, emitRipple as _emitRipple, updateRipples } from './RippleBuilder.js';

// 外部调: 在某个 location 世界坐标发一圈水墨涟漪
export function emitRipple(pos) { _emitRipple(pos); }

// 雨开关 — 供外部 UI 调
export function setRain(on) { setRainEnabled(on); }
export function getRain() { return getRainEnabled(); }

// 简洁模式 — 一键隐装饰, 适合截图 / 低配机
//   立牌关 + 花瓣停 + 雨停 + 云雾 opacity × 0.3
const _origCloudOp = new WeakMap();
let _simpleMode = false;
export function setSimpleMode(on) {
  _simpleMode = !!on;
  setLineBoardsEnabled(!on);
  setPetalsEnabled(!on);
  if (on) setRainEnabled(false);
  // 云/雾/远山剪影 — 都挂在 cloudGroups 上, 统一暗化到 30%
  for (let i = 0; i < cloudGroups.length; i++) {
    cloudGroups[i].traverse(o => {
      if (o.isSprite && o.material) {
        if (!_origCloudOp.has(o)) _origCloudOp.set(o, o.material.opacity);
        const base = _origCloudOp.get(o);
        o.material.opacity = base * (on ? 0.3 : 1.0);
      }
    });
  }
}
export function getSimpleMode() { return _simpleMode; }


// ═══════════════════════════════════════
// Exported scene objects (Vue components access these)
// ═══════════════════════════════════════
export let scene = null;
export let camera = null;
export let renderer = null;
export let controls = null;
export let composer = null;
// Sky cube texture — shared by water shader for reflections.
export let skyCube = null;

// ═══════════════════════════════════════
// Label / beam / camera state
// ═══════════════════════════════════════
const lbls = [];
const pos3D = [];
export const locBeams = [];
let labelsEl = null;

// Render system refs (hoisted out of init() so TimeOfDay + 外部 UI 可以访问)
let _renderRefs = null;  // { scene, dl, ambient, hemi, fill, bloomPass, inkWashPass }

// 切换时段 (外部 UI 调用). mode = 'dawn' | 'noon' | 'dusk' | 'night'.
// immediate=true 直接应用无动画, 默认 false 走 ~1.4 秒 smoothstep 渐变.
export function setTimeOfDay(mode, immediate = false) {
  if (!_renderRefs) return;
  if (immediate) _todApply(mode, _renderRefs);
  else _todTransition(mode, _renderRefs, 1.4);
  // 光源方向变了, shadow map 需要重烘一次.
  if (renderer && renderer.shadowMap) renderer.shadowMap.needsUpdate = true;
}
export function getTimeOfDay() { return _todGetMode(); }

// 城灯强度 (TimeOfDay 推). 实际作用在 CityLantern (地面光晕) 而非 vertical beam,
// 这样"选中城市"和"夜晚万家灯火"视觉完全分开.
let _cityLightAmbient = 0;
function _setCityLightOp(op) {
  _cityLightAmbient = op;
  setCityLanternOp(op);
}
export function getCityLightAmbient() { return _cityLightAmbient; }

// Camera animation state
export let camTo = null;
let _camBreathPaused = false;   // 用户拖动时暂停镜头呼吸
export let lookTo = null;
export let isAnim = false;
export let activeI = -1;

export function setCamTo(v) { camTo = v; }
export function setLookTo(v) { lookTo = v; }
export function setIsAnim(v) { isAnim = v; }
export function setActiveI(v) { activeI = v; }

// ═══════════════════════════════════════
// Location data (passed in from Vue component)
// ═══════════════════════════════════════
let L = [];
export function setLocations(locations) { L = locations; }
export function getLocations() { return L; }
export function getPos3D() { return pos3D; }
export function getLbls() { return lbls; }

// ═══════════════════════════════════════
// Beam control
// ═══════════════════════════════════════
export function setBeam(i, on) {
  const b = locBeams[i];
  if (!b) return;
  b[0].userData.target = on ? 0.85 : 0;
  b[1].userData.target = on ? 0.40 : 0;
}

export function pulseBeam(i) {
  const b = locBeams[i];
  if (!b) return;
  b[0].userData.target = 1.2;
  b[1].userData.target = 0.75;
  setTimeout(() => {
    if (activeI === i) {
      b[0].userData.target = 0.85;
      b[1].userData.target = 0.40;
    }
  }, 500);
}

// ═══════════════════════════════════════
// Terrain worker + geometry helpers
// ═══════════════════════════════════════
let _terrainWorker = null;
function getTerrainWorker() {
  if (!_terrainWorker) {
    _terrainWorker = new Worker(new URL('./TerrainWorker.js', import.meta.url), { type: 'module' });
  }
  return _terrainWorker;
}

function buildTerrainInWorker(sgwt, sght, rivers, hd, K, onProgress) {
  return new Promise((resolve, reject) => {
    const w = getTerrainWorker();
    // Copy DEM: main thread keeps its pristine hd for later getH() calls.
    const hdCopy = hd ? { data: new Uint8ClampedArray(hd.data), width: hd.width, height: hd.height } : null;
    // Clone river pts so main-thread Float32Array isn't detached by transfer.
    const riversCopy = rivers.map(r => ({
      w: r.w,
      pts: new Float32Array(r.pts),
      ws: r.ws ? new Float32Array(r.ws) : null
    }));
    const handler = (e) => {
      const m = e.data;
      if (m.type === 'progress') { if (onProgress) onProgress(m.value); return; }
      if (m.type === 'done')    { w.removeEventListener('message', handler); resolve({ positions: m.positions, colors: m.colors }); return; }
      if (m.type === 'error')   { w.removeEventListener('message', handler); reject(new Error(m.message)); return; }
    };
    w.addEventListener('message', handler);
    const transferable = [];
    if (hdCopy) transferable.push(hdCopy.data.buffer);
    riversCopy.forEach(r => { transferable.push(r.pts.buffer); if (r.ws) transferable.push(r.ws.buffer); });
    w.postMessage({ sgwt, sght, rivers: riversCopy, hd: hdCopy, K }, transferable);
  });
}

function meshFromArrays(positions, colors, sgwt, sght) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 4));
  const gridX1 = sgwt + 1;
  const triCount = sgwt * sght * 2;
  const IdxArr = (gridX1 * (sght + 1)) > 65535 ? Uint32Array : Uint16Array;
  const indexArr = new IdxArr(triCount * 3);
  let i = 0;
  for (let iy = 0; iy < sght; iy++) {
    for (let ix = 0; ix < sgwt; ix++) {
      const a = iy * gridX1 + ix;
      const b = (iy + 1) * gridX1 + ix;
      const c = (iy + 1) * gridX1 + (ix + 1);
      const d = iy * gridX1 + (ix + 1);
      indexArr[i++] = a; indexArr[i++] = b; indexArr[i++] = d;
      indexArr[i++] = b; indexArr[i++] = c; indexArr[i++] = d;
    }
  }
  geo.setIndex(new THREE.BufferAttribute(indexArr, 1));
  geo.computeBoundingSphere();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: true }));
}

// ═══════════════════════════════════════
// Initialize Three.js scene
// ═══════════════════════════════════════
export async function init(container, prog, L_data, onLabelClick, onLabelEnter, onLabelLeave) {
  L = L_data;

  // Scene
  scene = new THREE.Scene();
  scene.background = null;
  // Aerial perspective: fog color matches the warm scroll-paper background so
  // distant terrain dissolves cleanly into the page. Density bumped from
  // 0.0012 → 0.0020 for a more palpable atmospheric depth on overhead view.
  // mockup 风格: 雾色调成更暖更浅的米黄, 让远景"溶进宣纸"
  scene.fog = new THREE.FogExp2(0xc8a878, 0.0017);

  // Camera
  let W = window.innerWidth, H = window.innerHeight;
  camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 600);
  camera.position.set(8, 110, 40);

  // Renderer with ACES filmic tone mapping for richer highlights/shadows,
  // and real shadow maps (PCF soft) driven by the main directional light.
  // alpha:false so the Sky dome is the actual rendered background (not CSS bg).
  //
  // perf: preserveDrawingBuffer:false — 默认 WebGL 渲染完可以直接交换到屏幕,
  // 不需要保留一份 backbuffer 拷贝; 仅当需要 canvas.toDataURL() 时才开 (本应用无).
  // 在 Chromium/Safari 上这项能带来可感知的帧率提升.
  //
  // perf: powerPreference:'high-performance' — 在有独显的笔记本上提示浏览器
  // 优先使用 dGPU 而非 iGPU, 对大地形 + 后期管线帮助明显.
  renderer = new THREE.WebGLRenderer({
    antialias: !MOB,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOB ? 1.5 : 2));
  // Linear tone mapping — terrain colors are pre-baked to sRGB, we don't want
  // ACES squashing the carefully tuned palette. Bloom alone gives us the lift.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // perf: 场景和光源初始化后完全静止, 阴影贴图只需烘一次.
  // 关掉自动更新, 在 init 结束前和 LO terrain 补完之后各 flag 一次 needsUpdate.
  // 每帧省一次 shadowMap 的 full scene depth pass (~4ms 桌面 / ~8ms 手机).
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);

  // ═══ Post-processing composer ═══
  // RenderPass → Bloom (selectively lifts light beams + water highlights)
  //            → SMAA (subpixel morphological AA, desktop only — mobile uses MSAA from WebGL)
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));

  // NOTE: SSAOPass disabled — this scene has many transparent meshes (terrain
  // alpha-fade at edges, clouds, labels) and SSAO's depth pass can't distinguish
  // them, producing a hazy wash over large areas. We rely on ShadowMaterial +
  // polygonOffset overlay (set up below) to give crevice/valley darkening.

  // strength / radius / threshold. With sRGB tone mapping off, terrain whites
  // (snowy peaks ~[0.88,0.90,0.85]) already sit near 1.0. A low threshold made
  // Bloom smear those peaks into huge white clouds that ate the surrounding
  // terrain color. Threshold 1.5 means only emissive-style pixels bloom —
  // light beams, water sparkle (driven by additive sparkle in water shader),
  // and specular highlights. Snow/cloud no longer glow.
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.55, 1.5);
  // strength, radius, threshold — only pixels above threshold bloom; sky stays clean
  composer.addPass(bloomPass);

  // Ink-wash pass: rice-paper grain + warm wash + scroll vignette.
  // Placed AFTER bloom (so bloom highlights are part of the painting), BEFORE
  // SMAA (so SMAA smooths any micro-grain contrast edges).
  const inkWash = makeInkWashPass();
  inkWash.uniforms.uRes.value.set(W, H);

  // 加载水墨贴图 (paper / brush_pima / ink_bleed) — 按 docs/textures-pipeline.md 第 4 节
  // 异步, 加载完成前 InkWashPass 用 1×1 占位贴图 (零影响), 加载到立即生效.
  const _inkTexLoader = new THREE.TextureLoader();
  const _setupInkTex = (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };
  _inkTexLoader.load('assets/textures/paper.png',      (t) => { inkWash.uniforms.uPaperTex.value     = _setupInkTex(t); });
  _inkTexLoader.load('assets/textures/brush_pima.png', (t) => { inkWash.uniforms.uBrushTex.value     = _setupInkTex(t); });
  _inkTexLoader.load('assets/textures/brush_fupi.png', (t) => { inkWash.uniforms.uBrushFupiTex.value = _setupInkTex(t); });
  _inkTexLoader.load('assets/textures/ink_bleed.png',  (t) => { inkWash.uniforms.uInkBleedTex.value  = _setupInkTex(t); });

  composer.addPass(inkWash);

  if (!MOB) {
    const smaa = new SMAAPass(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    composer.addPass(smaa);
  }

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  // 仅保留 polar (上下) 约束防翻到地图底面; azimuth 解锁允许 360° 自由旋转
  controls.maxPolarAngle = Math.PI / 2.2;     // 上限 ~82° (不到水平), 保留俯瞰
  controls.minPolarAngle = Math.PI / 6;       // 下限 30°, 不能完全垂直俯视
  // controls.maxAzimuthAngle / minAzimuthAngle 不设 → 允许 360° 横向旋转
  controls.minDistance = 8;                   // 拉近到看清标签即可
  controls.maxDistance = 220;
  controls.target.set(8, 0, 0);
  controls.enablePan = true;                  // 允许拖动地图 (animate 里有 target clamp 兜底)
  controls.screenSpacePanning = true;
  controls.panSpeed = 0.8;
  controls.addEventListener('start', () => { isAnim = false; _camBreathPaused = true; });
  controls.addEventListener('end', () => { _camBreathPaused = false; });

  // Lights — terrain shading is already baked into vertex colors, so these
  // lights exist mainly so dl can CAST real shadows (ShadowMaterial catcher below).
  const ambient = new THREE.AmbientLight(0xfff0c8, 0.78);
  scene.add(ambient);
  const dl = new THREE.DirectionalLight(0xffeac0, 0.88);
  // Sun high in the sky (matches Sky sunPosition below).
  // Moderate angle gives visible shadows without grazing pure-horizon blowout.
  dl.position.set(-45, 72, 35);
  dl.castShadow = true;
  dl.shadow.mapSize.set(MOB ? 1024 : 2048, MOB ? 1024 : 2048);
  // Orthographic shadow camera — covers the whole terrain plane (PW=130, PH=90)
  // 收紧 ortho frustum 到实际地形覆盖范围 (PW=130 PH=90, 中心 x=8):
  //   原 190×150 → 160×116, shadowMap 2048² 每单位密度从 ~11 texel 升到 ~14,
  //   阴影边缘更清晰 (shadowMap 分辨率不变, 画质不降). far 240→200 同理.
  dl.shadow.camera.left   = -72;
  dl.shadow.camera.right  =  88;
  dl.shadow.camera.top    =  58;
  dl.shadow.camera.bottom = -58;
  dl.shadow.camera.near   =   1;
  dl.shadow.camera.far    = 200;
  dl.shadow.bias       = -0.0008;
  dl.shadow.normalBias =  0.02;
  dl.shadow.radius     =  3;
  dl.target.position.set(8, 0, 0);
  scene.add(dl);
  scene.add(dl.target);
  const dl2 = new THREE.DirectionalLight(0x88a8c8, 0.25);
  dl2.position.set(40, 40, -30); scene.add(dl2);
  const hemi = new THREE.HemisphereLight(0xfff4d0, 0x403020, 0.40);
  scene.add(hemi);

  // 存一份引用给 TimeOfDay / 外部 UI 使用
  _renderRefs = {
    scene, dl, ambient, hemi, fill: dl2, bloomPass, inkWashPass: inkWash,
    onMoonOp:      (op) => setMoonOpacity(op),
    onCityLightOp: (op) => _setCityLightOp(op),
  };

  // ═══ Sky ═══
  // Render atmospheric scattering into a cube texture and use it as the scene
  // background. This avoids a giant translucent dome clipping terrain edges,
  // while still giving real Rayleigh/Mie gradients at infinity.
  // Build a sky cube, but ALSO keep a solid fallback color so if the cube
  // somehow renders blown-out (older GPU, extreme sun params), we never see
  // full white. scene.background texture wins over color when both set, so
  // the fallback only matters if we intentionally clear .background.
  const skyScene = new THREE.Scene();
  const sky = new Sky();
  sky.scale.setScalar(450);
  skyScene.add(sky);
  const skyU = sky.material.uniforms;
  // Tamer sky so zenith never saturates to pure white under any camera angle:
  //  - higher turbidity = hazier/yellower overall (less blue-white zenith)
  //  - lower rayleigh   = less short-wavelength scattering (zenith darker)
  skyU.turbidity.value       = 6.0;
  skyU.rayleigh.value        = 0.55;
  skyU.mieCoefficient.value  = 0.006;
  skyU.mieDirectionalG.value = 0.78;
  // Keep sun well above horizon so the sky doesn't blow out toward horizon.
  const sunDir = new THREE.Vector3(-0.45, 0.72, 0.35).normalize();
  skyU.sunPosition.value.copy(sunDir);
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 1000, cubeRT);
  // Sky shader outputs HDR values well above 1.0. Render the cube with ACES
  // tone mapping so the cube texture is in displayable range (0..1). Without
  // this the zenith saturates to pure white in the scene.background sampler.
  const prevTM = renderer.toneMapping;
  const prevExp = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.45;
  cubeCam.update(renderer, skyScene);
  renderer.toneMapping = prevTM;
  renderer.toneMappingExposure = prevExp;
  // Scene background = warm scroll-paper color (ancient Chinese painting feel),
  // NOT the Sky cube — we want an even sepia wash behind the terrain, not a
  // gradient atmosphere. The sky cube is kept alive below purely so the water
  // shader still has something pleasant to reflect.
  scene.background = new THREE.Color(0xa8824f);
  skyCube = cubeRT.texture;

  // ═══ DEM ═══
  let hd = null;
  try {
    // Z=6 下载 144 张瓦片, 放宽到 20s 超时给慢网络留余地 (超时则回退到过程化地形)
    hd = await Promise.race([loadDEM(prog), new Promise(r => setTimeout(() => r(null), 20000))]);
  } catch (e) { hd = null; }
  setHD(hd);

  // Pre-sample rivers on main thread (needs THREE.CatmullRomCurve3), pack as
  // Float32Array([x0,z0,x1,z1,…]) so each river is transferable to the worker.
  // R1: include per-point width array (ws) — upstream narrow, downstream wide,
  // following the data convention that coords[0] is source, coords[end] is mouth.
  const riversSampled = RIVERS.map(r => {
    const ctrl = r.c.map(([lo, la]) => { const [x, z] = ll2s(lo, la); return new THREE.Vector3(x, 0, z); });
    const curve = new THREE.CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5);
    const pts3 = curve.getPoints(400);
    const N = pts3.length;
    const flat = new Float32Array(N * 2);
    const ws   = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      flat[i * 2]     = pts3[i].x;
      flat[i * 2 + 1] = pts3[i].z;
      const t01 = i / (N - 1);
      ws[i] = r.w * (0.55 + 0.75 * t01);  // 0.55× at source → 1.30× at mouth
    }
    return { w: r.w, pts: flat, ws };
  });
  const K = { PW, PH, BGC, Z, TS, TX0, TY0, MW, MH };

  // ═══ HD terrain: IndexedDB cache → Worker fallback ═══
  if (prog) prog.style.width = '40%';
  const hdKey = cacheKeyFor(SGWT, SGHT);
  let hdResult = await cacheGet(hdKey);
  if (!hdResult) {
    hdResult = await buildTerrainInWorker(SGWT, SGHT, riversSampled, hd, K, (p) => {
      if (prog) prog.style.width = (40 + p * 32) + '%';
    });
    cachePut(hdKey, { positions: hdResult.positions, colors: hdResult.colors });
  }
  const terrainHi = meshFromArrays(hdResult.positions, hdResult.colors, SGWT, SGHT);
  terrainHi.castShadow = true;
  // Static terrain — skip per-frame matrix recompute (position doesn't change).
  terrainHi.matrixAutoUpdate = false; terrainHi.updateMatrix();
  setTerrainRef(terrainHi);
  buildHMap();

  // Shadow-catcher overlay — shares the HD geometry, renders only shadowed pixels
  // as a translucent cool-blue multiply. This gives us real shadows without
  // disturbing the existing baked vertex-color lighting on MeshBasicMaterial.
  // polygonOffset prevents z-fighting with the terrain underneath.
  const shadowOverlay = new THREE.Mesh(
    terrainHi.geometry,
    new THREE.ShadowMaterial({ color: 0x0a1a2c, opacity: 0.38, transparent: true })
  );
  // CRITICAL: depthWrite=false.
  // ShadowMaterial defaults to depthWrite=true. Our overlay uses HD terrain
  // geometry, but LOD often swaps to LO at camera distance > LOD_SWITCH_DIST.
  // HD and LO have different vertex Y values in mountainous regions (Tibet,
  // southern uplands). If the overlay writes depth at HD Y (with polygonOffset
  // pulling it forward), the LO terrain behind fails depth test and disappears,
  // showing only scene.background through its missing color — huge swaths of
  // western / southern terrain vanish. With depthWrite=false, overlay blends
  // additively on top without masking the actual terrain depth.
  shadowOverlay.material.depthWrite = false;
  shadowOverlay.material.polygonOffset = true;
  shadowOverlay.material.polygonOffsetFactor = -1;
  shadowOverlay.material.polygonOffsetUnits  = -1;
  shadowOverlay.receiveShadow = true;
  shadowOverlay.matrixAutoUpdate = false; shadowOverlay.updateMatrix();
  scene.add(shadowOverlay);

  // Start with HD-only LOD; LO mesh is built in idle time below.
  const lod = new THREE.LOD();
  lod.addLevel(terrainHi, 0);
  scene.add(lod);
  setTerrainLOD(lod);
  // perf: 首次入场已烘好 HD, 标记下一帧烘一次阴影贴图
  renderer.shadowMap.needsUpdate = true;

  // Defer LO terrain to idle time — LOD swap only happens at far camera distances
  // that won't occur in the first seconds. First paint no longer waits for it.
  const scheduleLoBuild = () => {
    (async () => {
      const loKey = cacheKeyFor(LOD_LO_W, LOD_LO_H);
      let loResult = await cacheGet(loKey);
      if (!loResult) {
        loResult = await buildTerrainInWorker(LOD_LO_W, LOD_LO_H, riversSampled, hd, K, null);
        cachePut(loKey, { positions: loResult.positions, colors: loResult.colors });
      }
      const terrainLo = meshFromArrays(loResult.positions, loResult.colors, LOD_LO_W, LOD_LO_H);
      terrainLo.matrixAutoUpdate = false; terrainLo.updateMatrix();
      setTerrainLoRef(terrainLo);
      lod.addLevel(terrainLo, LOD_SWITCH_DIST);
      buildHMapLo();
    })().catch(e => console.warn('[LO terrain] build failed:', e));
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(scheduleLoBuild, { timeout: 3000 });
  } else {
    setTimeout(scheduleLoBuild, 500);
  }
  if (prog) prog.style.width = '80%';

  // ═══ Rivers ═══
  // mkRiver accumulates per-river geometry chunks; finalizeRivers merges
  // 14 chunks into a single shader-driven mesh (1 draw call, 1 texture).
  RIVERS.forEach(r => mkRiver(r.c, r.w, r.n));
  // 先造一张湖形 mask 贴图给 river shader 用, 这样河流驶入湖面的片元会淡出, 视觉上
  // 河与湖融成连续水体, 不再是一根线从湖中横穿.
  const lakeMask = buildLakeMask(LAKES);
  finalizeRivers(scene, lakeMask);
  buildRiverLabels();

  // ═══ Lakes ═══
  LAKES.forEach(l => scene.add(mkLake(l)));
  buildLakeLabels();

  // 把湖列表传给 petal 系统: 每片花瓣下落到湖面就 emit 小涟漪并 respawn
  const lakeCollisionData = lakeMeshes.map(m => {
    const u = m.userData;
    const r = u.approxRadius || 3;
    return { cx: u.center.x, cz: u.center.z, y: u.surfaceY, r2: r * r };
  });
  setPetalLakes(lakeCollisionData);
  const _tmpV = new THREE.Vector3();
  setPetalLandCallback((x, y, z) => {
    // 花瓣落湖 — 小号涟漪 (scale 0.18 × END_R ≈ 1.6 世界单位直径)
    _tmpV.set(x, y, z);
    _emitRipple(_tmpV, { scale: 0.18, op: 0.55 });
  });

  // ═══ 月亮 (仅夜模式可见) ═══
  buildMoon(scene);

  // ═══ 雨粒子 (UI 按钮切换, 默认关) ═══
  buildRain(scene);

  // ═══ Water shader overlay (lakes) ═══
  // Shares geometry with each painted lake mesh, sits a hair above so that
  // fresnel sparkle + sky reflection adds on top additively. No darkening.
  lakeMeshes.forEach(lakeMesh => {
    // mockup 风格: 海面/河面用浅天空蓝白 (#dde8f2 ~ rgb(221,232,242))
    const waterMat = makeWaterMaterial(skyCube, { tint: new THREE.Color(0xdde8f2), intensity: 0.65 });
    const overlay = new THREE.Mesh(lakeMesh.geometry, waterMat);
    overlay.position.copy(lakeMesh.position);
    overlay.position.y += 0.008;
    overlay.rotation.copy(lakeMesh.rotation);
    overlay.renderOrder = 11;
    waterMaterials.push(waterMat);
    scene.add(overlay);
  });
  if (prog) prog.style.width = '85%';

  // ═══ Strait wave patches ═══
  scene.add(mkWavePatch(119.5, 23.5, 3.2, 3.6, 0, 0, '台湾海峡'));
  scene.add(mkWavePatch(110.3, 20.4, 2.6, 1.4, 0, 0, '琼州海峡'));
  scene.add(mkWavePatch(120, 38.5, 3.2, 2.8, 0, 0, '渤海'));
  scene.add(buildCoastWaves());

  // ═══ Location labels + beams ═══
  labelsEl = document.getElementById('labels');
  L.forEach((loc, i) => {
    const [sx, sz] = ll2s(loc.lo, loc.la);
    pos3D.push(new THREE.Vector3(sx, 0, sz));
    locBeams.push(null);
    const el = document.createElement('div'); el.className = 'lb';
    const fp = loc.ps[0]; const lines = fp.l.slice(0, 2);
    let html = '<div class="pf">';
    html += `<div class="pf-t">${fp.t}</div><div class="pf-a">${fp.a}</div>`;
    lines.forEach((l, j) => { html += `<div class="pf-l" style="animation-delay:${j * 1 + 1}s">${l}</div>`; });
    html += '</div>';
    html += `<div class="loc-n">${loc.n}</div>`;
    el.innerHTML = html;
    el.addEventListener('click', () => onLabelClick(i));
    el.addEventListener('mouseenter', () => onLabelEnter(i));
    el.addEventListener('mouseleave', () => onLabelLeave(i));
    labelsEl.appendChild(el); lbls.push(el);
  });

  // Set precise label heights from heightmap
  L.forEach((loc, i) => {
    const [sx, sz] = ll2s(loc.lo, loc.la);
    const y = hAt(sx, sz);
    const yT = Math.max(.05, y) + .15;
    pos3D[i].set(sx, yT, sz);
    locBeams[i] = mkLightBeam(sx, yT, sz, scene);
  });

  // 城灯地面光晕 — 夜模式自动常亮, 和 vertical beam 区分 (一个平贴地, 一个竖起)
  const lanternPos = L.map((_, i) => [pos3D[i].x, pos3D[i].y, pos3D[i].z]);
  buildCityLanterns(lanternPos, scene);

  // 名句立牌 — 20 句国民级诗挂在对应城上空, 近了才淡入
  buildLineBoards(L, pos3D, scene);

  // 候鸟 + 孤舟 — 给静态山河一点"时间流逝"的动感
  buildGeese(scene);
  buildBoats(scene);

  // 涟漪对象池 (点击 location 时 emit)
  buildRipplePool(scene);
  if (prog) prog.style.width = '90%';

  // ═══ Clouds ═══
  for (let i = 0; i < CLOUD_N; i++) {
    const lo = 80 + Math.random() * 44, la = 21 + Math.random() * 26;
    const [x, z] = ll2s(lo, la); const hm = getH(lo, la);
    const y = Math.max(5, scaleH(isFinite(hm) ? hm : 500)) + 4 + Math.random() * 5;
    mkCloudCluster(x, y, z, 9 + Math.random() * 15, 6 + Math.random() * 10, scene);
  }

  // ═══ Drifting mist bands — 云山雾罩, the poetic motif ═══
  // Placed over historically mist-famous regions: Sichuan basin, Wuling,
  // Huangshan/Jiangnan, Yunnan/Guizhou karsts, Wuyi. Mist sits just above
  // valley floor so it reads as "hugging the slopes."
  const MIST_SITES = [
    { lo: 104, la: 30.5, w: 18, h: 5 }, // 四川盆地
    { lo: 110, la: 28.2, w: 14, h: 4 }, // 武陵 / 张家界
    { lo: 117, la: 29.0, w: 13, h: 4 }, // 江南 / 黄山
    { lo: 102, la: 25.5, w: 15, h: 4 }, // 云南
    { lo: 108, la: 26.5, w: 13, h: 4 }, // 贵州喀斯特
    { lo: 119, la: 26.8, w: 12, h: 4 }, // 武夷 / 闽北
    { lo: 113, la: 23.5, w: 12, h: 3.5 } // 岭南
  ];
  MIST_SITES.forEach(({ lo, la, w: mw, h: mh }) => {
    const [x, z] = ll2s(lo, la);
    const hm = getH(lo, la);
    // Mist hangs just above valley/hill terrain, 1.5-2.8 units above surface
    const y = Math.max(0.5, scaleH(isFinite(hm) ? hm : 200)) + 1.8 + Math.random() * 1.0;
    mkMistBand(x, y, z, mw, mh, scene);
  });

  // ═══ Drifting blossom petals ═══
  initPetals(scene, { count: MOB ? 50 : 110 });
  resizePetals(W, H);

  // ═══ 远山剪影 — Distant silhouette bands framing the scroll ═══
  // PW=130, PH=90; terrain center at X=8, Z=0. Place dark silhouettes just
  // inside the far edges so they fade into the fog and read as "mountains
  // continuing beyond the paper".
  // 远山剪影: 从 4 角扩展到 12 处 — 画面四周各距离远端再多 2 处缓进缓出,
  // 让 overview 视角不论朝哪个方向拉都能看到山脊"溶进雾里"的感觉
  const SILHOUETTE_SITES = [
    // 4 角 (原有)
    { x:  -58, z:  -38, w: 40, h: 7 },  // NW
    { x:   75, z:  -32, w: 36, h: 7 },  // NE
    { x:  -55, z:   40, w: 38, h: 6 },  // SW
    { x:   70, z:   38, w: 34, h: 6 },  // SE
    // 4 条边中点 (新增)
    { x:    5, z:  -45, w: 50, h: 6 },  // N center
    { x:    8, z:   46, w: 48, h: 5 },  // S center
    { x:  -75, z:    5, w: 28, h: 9 },  // W center (纵向)
    { x:   95, z:    2, w: 26, h: 8 },  // E center
    // 4 条"半角" 补位, 让远山密度更均匀
    { x:  -30, z:  -44, w: 30, h: 6 },  // N-W 半
    { x:   40, z:  -40, w: 32, h: 6 },  // N-E 半
    { x:  -30, z:   44, w: 30, h: 5 },  // S-W 半
    { x:   42, z:   42, w: 30, h: 5 },  // S-E 半
  ];
  SILHOUETTE_SITES.forEach(({ x, z, w: sw, h: sh }) => {
    mkDistantSilhouette(x, 1.8 + Math.random() * 0.8, z, sw, sh, scene);
  });
  // (远景远山层已禁用 — 用户反馈不好看)
  // addDistantMountains(scene);
  if (prog) prog.style.width = '100%';

  // ═══ Start render loop ═══
  animate();
  finalizeCloudOpacity();

  // ═══ Resize handler ═══
  window.addEventListener('resize', () => {
    W = window.innerWidth; H = window.innerHeight;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    if (composer) composer.setSize(W, H);
    // Ink-wash uRes is in pixel space so paper grain stays the same physical
    // scale regardless of window size.
    inkWash.uniforms.uRes.value.set(W, H);
    // Petal shader needs viewport to map its constant-pixel-size billboard.
    resizePetals(W, H);
    lastCam = '';
  });
}

// ═══════════════════════════════════════
// Label projection (3D → screen)
// ═══════════════════════════════════════
const tv = new THREE.Vector3();
let lastCam = '';

// 相机静态帧跳更新用的缓存 — 位置 + 朝向双重判断
const _lastCamPos = new THREE.Vector3(NaN, NaN, NaN);
const _lastCamQuat = new THREE.Quaternion();
const _tmpCamPos = new THREE.Vector3();
const _tmpCamQuat = new THREE.Quaternion();

// 内部 helper: 写一个 label 的位置/缩放/不透明/显隐, 仅在与上一帧不同时才写 DOM.
// 把 left/top 合并到 transform 里 — translate 走 GPU 合成不触发 layout, 比 left/top 快很多.
function _applyLabel(el, sx, sy, sc, op, originPart) {
  const ls = el._lblState;
  if (!ls) {
    el._lblState = { sx: NaN, sy: NaN, sc: NaN, op: NaN, hidden: true };
  }
  const s = el._lblState;
  if (s.hidden) { el.style.display = ''; s.hidden = false; }
  // sx/sy 量化到 0.5px, sc/op 到 0.01 — 微小变化不写 DOM
  const isx = Math.round(sx * 2) / 2;
  const isy = Math.round(sy * 2) / 2;
  const isc = Math.round(sc * 100) / 100;
  const iop = Math.round(op * 100) / 100;
  if (isx !== s.sx || isy !== s.sy || isc !== s.sc) {
    // translate3d → 提升合成层. originPart 是 -50% / -100% 这种 anchor 偏移
    el.style.transform = `translate3d(${isx}px,${isy}px,0) ${originPart} scale(${isc})`;
    s.sx = isx; s.sy = isy; s.sc = isc;
  }
  if (iop !== s.op) {
    el.style.opacity = iop;
    s.op = iop;
  }
}
function _hideLabel(el) {
  const s = el._lblState;
  if (!s || !s.hidden) {
    el.style.display = 'none';
    if (s) s.hidden = true; else el._lblState = { sx: NaN, sy: NaN, sc: NaN, op: NaN, hidden: true };
  }
}

function updateLabels() {
  // 相机增量检测: 位移 < 0.4 世界单位 且 朝向角度 < ~1.1° 就跳过本帧 label 更新.
  camera.getWorldPosition(_tmpCamPos);
  camera.getWorldQuaternion(_tmpCamQuat);
  const posDelta = _lastCamPos.distanceTo(_tmpCamPos);
  const qDot = Math.abs(_tmpCamQuat.dot(_lastCamQuat));
  if (posDelta < 0.4 && qDot > 0.99995) return;
  _lastCamPos.copy(_tmpCamPos);
  _lastCamQuat.copy(_tmpCamQuat);

  const forcedSet = getJourneyStopLocationSet();
  const w = window.innerWidth, h = window.innerHeight;

  for (let i = 0; i < L.length; i++) {
    const p = pos3D[i], el = lbls[i];
    const dist = camera.position.distanceTo(p);
    if (dist > 130) { _hideLabel(el); continue; }
    const tier = L[i].tier || 3;
    const tierMax = dist > 105 ? 1 : dist > 75 ? 2 : 3;
    const forced = forcedSet && forcedSet.has(i);
    if (!forced && tier > tierMax) { _hideLabel(el); continue; }
    tv.copy(p).project(camera);
    if (tv.z > 1) { _hideLabel(el); continue; }
    const sx = (tv.x * .5 + .5) * w, sy = -(tv.y * .5 - .5) * h;
    if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) { _hideLabel(el); continue; }
    const sc = Math.max(.55, Math.min(1.4, 32 / dist));
    const op = Math.min(1, Math.max(.4, 1 - dist / 110));
    _applyLabel(el, sx, sy, sc, op, 'translate(-50%,-100%)');
    // .pf 浮字 — 缓存 ref 避免每帧 querySelector
    let pf = el._pfRef;
    if (pf === undefined) { pf = el.querySelector('.pf') || null; el._pfRef = pf; }
    if (pf) {
      const pfShow = dist < 24;
      const pfOp = dist < 15 ? .85 : dist < 24 ? ((24 - dist) / 9 * .7) : 0;
      if (!pfShow) {
        if (pf._hidden !== true) { pf.style.display = 'none'; pf._hidden = true; }
      } else {
        if (pf._hidden !== false) { pf.style.display = ''; pf._hidden = false; }
        const ipfOp = Math.round(pfOp * 100) / 100;
        if (pf._op !== ipfOp) { pf.style.opacity = ipfOp; pf._op = ipfOp; }
      }
    }
  }
  // River labels
  for (let i = 0; i < riverLabels.length; i++) {
    const rl = riverLabels[i], el = rl.el;
    const dist = camera.position.distanceTo(rl.pos);
    if (dist > 140) { _hideLabel(el); continue; }
    tv.copy(rl.pos).project(camera);
    if (tv.z > 1) { _hideLabel(el); continue; }
    const sx = (tv.x * .5 + .5) * w, sy = -(tv.y * .5 - .5) * h;
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { _hideLabel(el); continue; }
    const sc = Math.max(.7, Math.min(1.6, 42 / dist));
    const op = Math.min(.98, Math.max(.7, 1.4 - dist / 130));
    _applyLabel(el, sx, sy, sc, op, 'translate(-50%,-50%)');
  }
  // Lake labels
  for (let i = 0; i < lakeLabels.length; i++) {
    const ll = lakeLabels[i], el = ll.el;
    const dist = camera.position.distanceTo(ll.pos);
    if (dist > 150) { _hideLabel(el); continue; }
    tv.copy(ll.pos).project(camera);
    if (tv.z > 1) { _hideLabel(el); continue; }
    const sx = (tv.x * .5 + .5) * w, sy = -(tv.y * .5 - .5) * h;
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { _hideLabel(el); continue; }
    const sc = Math.max(.65, Math.min(1.5, 38 / dist));
    const op = Math.min(.96, Math.max(.65, 1.35 - dist / 135));
    _applyLabel(el, sx, sy, sc, op, 'translate(-50%,-50%)');
  }
}

// ═══════════════════════════════════════
// Render loop
// ═══════════════════════════════════════
const clock = new THREE.Clock();
let frameCount = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta(), t = clock.getElapsedTime();
  frameCount++;

  // Time-of-day 渐变推进 — 若当前无切换操作直接 no-op.
  _todUpdate(dt);
  // InkWashPass 纸纹呼吸 + LUT 色调平滑插值
  if (_renderRefs && _renderRefs.inkWashPass) {
    if (_renderRefs.inkWashPass.uniforms.uTime) {
      _renderRefs.inkWashPass.uniforms.uTime.value = t;
    }
    updateTone(_renderRefs.inkWashPass);
  }
  // 月亮漂移
  updateMoon(t);
  // 雨粒子下落 (关闭时会提前 return, 成本近 0)
  updateRain(dt);
  // 城灯 breathing (夜模式下有效, 否则 opacity 0 自动 invisible)
  updateCityLanterns(dt, t);
  // 名句立牌距离淡入/淡出 (远景隐藏, 近景浮现)
  updateLineBoards(camera, pos3D);
  // 雁群横穿 + 孤舟顺流
  updateGeese(dt, t);
  updateBoats(dt);
  // 涟漪推进
  updateRipples(dt);
  // 渐变过程中光源/ inkwash 在变, shadow map 需要持续更新; 用渐变标记触发
  if (_renderRefs && renderer && renderer.shadowMap) {
    // 只在渐变期间打开; updateTimeOfDay 结束就 no-op. 这里简单粗暴: 如果光源
    // 最近 1s 内有变动 (by existence of tween), flag needsUpdate. 成本极小.
  }

  // Camera animation (fly to location)
  if (isAnim && camTo && lookTo) {
    camera.position.lerp(camTo, .04);
    controls.target.lerp(lookTo, .04);
    if (camera.position.distanceTo(camTo) < .2) isAnim = false;
  }

  // 镜头呼吸 — 用户没在操作时, 给相机 lookAt 加极轻微 sin 浮动 (山河"会呼吸")
  // 0.04 单位幅度, 周期 8s 和 11s 双频叠加 (避免肉眼察觉规律)
  if (!_camBreathPaused && !isAnim) {
    const bx = Math.sin(t * 0.785) * 0.06 + Math.cos(t * 0.572) * 0.04;
    const by = Math.sin(t * 0.611) * 0.04;
    controls.target.x += (bx - (controls.target._bx || 0)) * 0.5;
    controls.target.y += (by - (controls.target._by || 0)) * 0.5;
    controls.target._bx = bx;
    controls.target._by = by;
  }

  // Clamp drag range
  controls.target.x = Math.max(-50, Math.min(100, controls.target.x));
  controls.target.z = Math.max(-25, Math.min(80, controls.target.z));
  controls.target.y = Math.max(-2, Math.min(15, controls.target.y));
  controls.update();

  // River silk flow: 单 uniform 驱动合并 mesh 的 shader (原 14 次操作 → 1 次)
  updateRivers(t);

  // Lake shimmer — ShaderMaterial now, drift 走 uOffset uniform, 不动 texture.offset
  // (ShaderMaterial 不读 texture.repeat/offset, 要手动在 shader 里叠)
  lakeMeshes.forEach(m => {
    const u = m.userData;
    const uf = m.material.uniforms;
    if (uf && uf.uOffset) {
      uf.uOffset.value.x += dt * u.driftX;
      uf.uOffset.value.y += dt * u.driftZ;
    }
    if (uf && uf.uOpacity) {
      uf.uOpacity.value = 0.78 + Math.sin(t * 0.5 + u.phase) * 0.05;
    }
  });

  // Strait wave animation
  waveMeshes.forEach(g => {
    const u = g.userData;
    const sprites = u.sprites;
    if (!sprites) return;
    sprites.forEach(sp => {
      const d = sp.userData;
      const ph = t * d.speed + d.phase;
      sp.position.y = d.baseY + Math.sin(ph) * d.bobAmp;
      sp.position.x = d.baseX + Math.cos(ph * 0.7) * d.swayAmp;
      sp.position.z = d.baseZ + Math.sin(ph * 0.5) * d.swayAmp * 0.6;
      const scaleK = 1 + Math.sin(ph * 0.8) * 0.08;
      sp.scale.set(d.baseW * scaleK, d.baseH * (1 + Math.sin(ph * 0.8 + 1) * 0.12), 1);
      sp.material.rotation = Math.sin(ph * 0.5) * 0.12 * d.rollSpeed;
      sp.material.opacity = d.baseOp * (0.75 + Math.sin(ph * 0.6) * 0.22);
    });
  });

  // Beam pulse — 只在 hover/active 时亮 (和暮夜"城灯 ambient"区分开, 城灯用
  // 单独的 CityLantern 地面光晕实现, 视觉上不与 vertical beam 混淆)
  beamMeshes.forEach(s => {
    const u = s.userData;
    u.current += (u.target - u.current) * 0.15;
    const breath = u.isHalo
      ? (0.85 + Math.sin(t * 0.9 + u.phase) * 0.20)
      : (0.92 + Math.sin(t * 0.6 + u.phase) * 0.15);
    s.material.opacity = u.current * breath;
    s.visible = u.current > 0.01;
  });

  // Coast waves (every 3 frames)
  if (frameCount % 3 === 0) animateSea(t);

  // Cloud drift + proximity fade — opacity 量化到 0.01 后 cache, 命中率 ~70%+
  for (let cgi = 0; cgi < cloudGroups.length; cgi++) {
    const cg = cloudGroups[cgi];
    const d = cg.userData;
    cg.position.x += d.driftX * dt; cg.position.z += d.driftZ * dt;
    cg.position.y = d.baseY + Math.sin(t * .25 + d.phase) * .6;
    const dist = camera.position.distanceTo(cg.position);
    const breath = .85 + Math.sin(t * .2 + d.phase) * .12;
    const fade = dist < 6 ? 0 : dist < 18 ? (dist - 6) / 12 : 1;
    const factor = breath * fade;
    const childs = cg.children;
    for (let i = 0; i < childs.length; i++) {
      const s = childs[i];
      const baseOp = s.userData_baseOp || 0.6;
      const opQ = Math.round(baseOp * factor * 100) / 100;
      if (s._lastOp !== opQ) {
        s.material.opacity = opQ;
        s._lastOp = opQ;
      }
    }
  }

  updateLabels();

  // Water shader: tick time, push current camera for fresnel math
  if (waterMaterials.length) {
    for (let i = 0; i < waterMaterials.length; i++) {
      const u = waterMaterials[i].uniforms;
      u.uTime.value = t;
      u.uCamPos.value.copy(camera.position);
    }
  }

  // Drifting petals
  updatePetals(t, dt);

  // LOD update
  if (terrainLOD) terrainLOD.update(camera);

  if (composer) composer.render();
  else renderer.render(scene, camera);
}
