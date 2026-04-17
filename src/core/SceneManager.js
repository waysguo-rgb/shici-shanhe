// Main orchestrator: scene init, render loop, label projection, camera animation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Post-processing pipeline: bloom for light beams + SMAA for edge AA
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }    from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass }      from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { SSAOPass }      from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { makeInkWashPass } from './InkWashPass.js';
import { initPetals, updatePetals } from './PetalParticles.js';
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
import { riverMeshes, mkRiver, buildRiverLabels, riverLabels } from './RiverBuilder.js';
import { lakeMeshes, mkLake, buildLakeLabels, lakeLabels } from './LakeBuilder.js';
import { waveMeshes, mkWavePatch, buildCoastWaves, coastWaveData, animateSea } from './WaveBuilder.js';
import { cloudGroups, mkCloudCluster, mkMistBand, mkDistantSilhouette, finalizeCloudOpacity } from './CloudBuilder.js';
import { beamMeshes, mkLightBeam } from './BeamBuilder.js';
import { makeWaterMaterial, waterMaterials } from './WaterMaterial.js';

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

// Camera animation state
export let camTo = null;
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
  scene.fog = new THREE.FogExp2(0xa8824f, 0.0020);

  // Camera
  let W = window.innerWidth, H = window.innerHeight;
  camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 600);
  camera.position.set(8, 110, 40);

  // Renderer with ACES filmic tone mapping for richer highlights/shadows,
  // and real shadow maps (PCF soft) driven by the main directional light.
  // alpha:false so the Sky dome is the actual rendered background, not the
  // CSS page background showing through. Keep preserveDrawingBuffer for screenshots.
  renderer = new THREE.WebGLRenderer({ antialias: !MOB, preserveDrawingBuffer: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOB ? 1.5 : 2));
  // Linear tone mapping — terrain colors are pre-baked to sRGB, we don't want
  // ACES squashing the carefully tuned palette. Bloom alone gives us the lift.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  composer.addPass(inkWash);

  if (!MOB) {
    const smaa = new SMAAPass(W * renderer.getPixelRatio(), H * renderer.getPixelRatio());
    composer.addPass(smaa);
  }

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - .02;
  controls.minDistance = 1.5;
  controls.maxDistance = 220;
  controls.target.set(8, 0, 0);
  controls.screenSpacePanning = true;
  controls.addEventListener('start', () => { isAnim = false; });

  // Lights — terrain shading is already baked into vertex colors, so these
  // lights exist mainly so dl can CAST real shadows (ShadowMaterial catcher below).
  scene.add(new THREE.AmbientLight(0xfff0c8, 0.78));
  const dl = new THREE.DirectionalLight(0xffeac0, 0.88);
  // Sun high in the sky (matches Sky sunPosition below).
  // Moderate angle gives visible shadows without grazing pure-horizon blowout.
  dl.position.set(-45, 72, 35);
  dl.castShadow = true;
  dl.shadow.mapSize.set(MOB ? 1024 : 2048, MOB ? 1024 : 2048);
  // Orthographic shadow camera — covers the whole terrain plane (PW=130, PH=90)
  dl.shadow.camera.left   = -95;
  dl.shadow.camera.right  =  95;
  dl.shadow.camera.top    =  75;
  dl.shadow.camera.bottom = -75;
  dl.shadow.camera.near   =   1;
  dl.shadow.camera.far    = 240;
  dl.shadow.bias       = -0.0008;
  dl.shadow.normalBias =  0.02;
  dl.shadow.radius     =  3;
  dl.target.position.set(8, 0, 0);
  scene.add(dl);
  scene.add(dl.target);
  const dl2 = new THREE.DirectionalLight(0x88a8c8, 0.25);
  dl2.position.set(40, 40, -30); scene.add(dl2);
  scene.add(new THREE.HemisphereLight(0xfff4d0, 0x403020, 0.40));

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
  scene.add(shadowOverlay);

  // Start with HD-only LOD; LO mesh is built in idle time below.
  const lod = new THREE.LOD();
  lod.addLevel(terrainHi, 0);
  scene.add(lod);
  setTerrainLOD(lod);

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
  RIVERS.forEach(r => scene.add(mkRiver(r.c, r.w, r.n)));
  buildRiverLabels();

  // ═══ Lakes ═══
  LAKES.forEach(l => scene.add(mkLake(l)));
  buildLakeLabels();

  // ═══ Water shader overlay (lakes) ═══
  // Shares geometry with each painted lake mesh, sits a hair above so that
  // fresnel sparkle + sky reflection adds on top additively. No darkening.
  lakeMeshes.forEach(lakeMesh => {
    const waterMat = makeWaterMaterial(skyCube, { tint: new THREE.Color(0xaac7e6), intensity: 0.85 });
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

  // ═══ 远山剪影 — Distant silhouette bands framing the scroll ═══
  // PW=130, PH=90; terrain center at X=8, Z=0. Place dark silhouettes just
  // inside the far edges so they fade into the fog and read as "mountains
  // continuing beyond the paper".
  const SILHOUETTE_SITES = [
    { x:  -58, z:  -38, w: 40, h: 7 },  // NW
    { x:   75, z:  -32, w: 36, h: 7 },  // NE
    { x:  -55, z:   40, w: 38, h: 6 },  // SW
    { x:   70, z:   38, w: 34, h: 6 }   // SE
  ];
  SILHOUETTE_SITES.forEach(({ x, z, w: sw, h: sh }) => {
    mkDistantSilhouette(x, 1.8 + Math.random() * 0.8, z, sw, sh, scene);
  });
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
    lastCam = '';
  });
}

// ═══════════════════════════════════════
// Label projection (3D → screen)
// ═══════════════════════════════════════
const tv = new THREE.Vector3();
let lastCam = '';

function updateLabels() {
  const cs = camera.position.toArray().map(v => v.toFixed(1)).join(',');
  if (cs === lastCam) return; lastCam = cs;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < L.length; i++) {
    const p = pos3D[i], el = lbls[i];
    const dist = camera.position.distanceTo(p);
    if (dist > 130) { el.style.display = 'none'; continue; }
    // Zoom-level tiering: at overview only show "major" spots (high poem count);
    // when camera zooms in, lesser spots fade in progressively. Stops the
    // eastern coast labels from piling on top of each other at default view.
    const poemCount = (L[i].ps && L[i].ps.length) || 0;
    const threshold = dist > 95 ? 5 : dist > 65 ? 3 : dist > 40 ? 2 : 0;
    if (poemCount < threshold) { el.style.display = 'none'; continue; }
    tv.copy(p).project(camera);
    if (tv.z > 1) { el.style.display = 'none'; continue; }
    const sx = (tv.x * .5 + .5) * w, sy = -(tv.y * .5 - .5) * h;
    if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) { el.style.display = 'none'; continue; }
    el.style.display = '';
    const sc = Math.max(.55, Math.min(1.4, 32 / dist));
    el.style.left = sx + 'px'; el.style.top = sy + 'px';
    el.style.transform = `translate(-50%,-100%) scale(${sc.toFixed(3)})`;
    el.style.opacity = Math.min(1, Math.max(.4, 1 - dist / 110)).toFixed(2);
    const pf = el.querySelector('.pf');
    if (pf) {
      if (dist < 15) { pf.style.display = ''; pf.style.opacity = '.85'; }
      else if (dist < 24) { pf.style.display = ''; pf.style.opacity = ((24 - dist) / 9 * .7).toFixed(2); }
      else { pf.style.display = 'none'; }
    }
  }
  // River labels
  for (let i = 0; i < riverLabels.length; i++) {
    const rl = riverLabels[i];
    const dist = camera.position.distanceTo(rl.pos);
    if (dist > 140) { rl.el.style.display = 'none'; continue; }
    tv.copy(rl.pos).project(camera);
    if (tv.z > 1) { rl.el.style.display = 'none'; continue; }
    const sx = (tv.x * .5 + .5) * w, sy = -(tv.y * .5 - .5) * h;
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { rl.el.style.display = 'none'; continue; }
    rl.el.style.display = '';
    const sc = Math.max(.7, Math.min(1.6, 42 / dist));
    rl.el.style.left = sx + 'px'; rl.el.style.top = sy + 'px';
    rl.el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
    rl.el.style.opacity = Math.min(.98, Math.max(.7, 1.4 - dist / 130)).toFixed(2);
  }
  // Lake labels
  for (let i = 0; i < lakeLabels.length; i++) {
    const ll = lakeLabels[i];
    const dist = camera.position.distanceTo(ll.pos);
    if (dist > 150) { ll.el.style.display = 'none'; continue; }
    tv.copy(ll.pos).project(camera);
    if (tv.z > 1) { ll.el.style.display = 'none'; continue; }
    const sx = (tv.x * .5 + .5) * w, sy = -(tv.y * .5 - .5) * h;
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { ll.el.style.display = 'none'; continue; }
    ll.el.style.display = '';
    const sc = Math.max(.65, Math.min(1.5, 38 / dist));
    ll.el.style.left = sx + 'px'; ll.el.style.top = sy + 'px';
    ll.el.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
    ll.el.style.opacity = Math.min(.96, Math.max(.65, 1.35 - dist / 135)).toFixed(2);
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

  // Camera animation (fly to location)
  if (isAnim && camTo && lookTo) {
    camera.position.lerp(camTo, .04);
    controls.target.lerp(lookTo, .04);
    if (camera.position.distanceTo(camTo) < .2) isAnim = false;
  }

  // Clamp drag range
  controls.target.x = Math.max(-50, Math.min(100, controls.target.x));
  controls.target.z = Math.max(-25, Math.min(80, controls.target.z));
  controls.target.y = Math.max(-2, Math.min(15, controls.target.y));
  controls.update();

  // River silk flow
  riverMeshes.forEach(m => {
    m.userData.tex.offset.x += dt * 0.045 * m.userData.flow;
    m.material.opacity = 0.88 + Math.sin(t * 0.6 + m.userData.flow) * 0.05;
  });

  // Lake shimmer
  lakeMeshes.forEach(m => {
    const u = m.userData;
    if (u.tex) {
      u.tex.offset.x += dt * u.driftX;
      u.tex.offset.y += dt * u.driftZ;
    }
    m.material.opacity = 0.90 + Math.sin(t * 0.5 + u.phase) * 0.05;
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

  // Beam pulse
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

  // Cloud drift + proximity fade
  cloudGroups.forEach(cg => {
    const d = cg.userData;
    cg.position.x += d.driftX * dt; cg.position.z += d.driftZ * dt;
    cg.position.y = d.baseY + Math.sin(t * .25 + d.phase) * .6;
    const dist = camera.position.distanceTo(cg.position);
    const breath = .85 + Math.sin(t * .2 + d.phase) * .12;
    const fade = dist < 6 ? 0 : dist < 18 ? (dist - 6) / 12 : 1;
    cg.children.forEach(s => { s.material.opacity = (s.userData_baseOp || 0.6) * breath * fade; });
  });

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
