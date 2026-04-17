// 植被点染 (点苔法) — InstancedMesh of tiny billboard dabs scattered on
// mid-elevation slopes to suggest forest/shrub cover in the painterly style.
// Each "dab" is one instance of a quad sharing a single ink-dot texture;
// all instances render in ONE draw call regardless of count.
//
// Distribution strategy:
//   - Random (lon, la) rejection-sample within scene lon/la bounds
//   - Keep only points that are inLand, in elevation band 250-1800m
//   - Geographic bias: south & east China are heavily forested, west/north sparse
//   - Each kept point gets Y = terrain height (via hAt) + small lift
//   - Color uses a tiny warm-green palette with per-instance variation
import * as THREE from 'three';
import { ll2s, inLand, s2ll } from './helpers.js';
import { hAt } from './TerrainBuilder.js';

// Procedurally paint the ink-dab texture: irregular dark-green blob.
function mkDabTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  cx.translate(16, 16);
  // Soft radial falloff base
  const g = cx.createRadialGradient(0, 0, 0, 0, 0, 14);
  g.addColorStop(0,    'rgba(40,62,32,0.95)');
  g.addColorStop(0.55, 'rgba(42,66,30,0.70)');
  g.addColorStop(0.90, 'rgba(40,58,26,0.25)');
  g.addColorStop(1,    'rgba(40,58,26,0)');
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(0, 0, 14, 0, Math.PI * 2); cx.fill();
  // Irregular brush dabs on top so it reads as a "group of leaves"
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2 + Math.random() * 7;
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    const dr = 3 + Math.random() * 4;
    const dg = cx.createRadialGradient(dx, dy, 0, dx, dy, dr);
    dg.addColorStop(0, `rgba(30,50,20,${0.5 + Math.random()*0.3})`);
    dg.addColorStop(1, 'rgba(30,50,20,0)');
    cx.fillStyle = dg;
    cx.beginPath(); cx.arc(dx, dy, dr, 0, Math.PI * 2); cx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// Forest density at (lon, la) in 0..1. Higher = more vegetation probability.
// Based on rough climate zones of historical China: south/east wet, north/west dry.
function forestDensity(lo, la) {
  // Base by latitude (lower lat = wetter)
  let d = Math.max(0, Math.min(1, (42 - la) / 20));  // 42°N→0, 22°N→1
  // Boost south China (22-30°N, 100-120°E) — subtropical forest
  const south = Math.max(0,
    Math.exp(-Math.pow((lo - 112) / 12, 2)) * Math.exp(-Math.pow((la - 26) / 6, 2))
  );
  d += south * 0.5;
  // Boost Sichuan basin & Yangtze middle (105-115°E, 28-32°N)
  const yangtze = Math.exp(-Math.pow((lo - 109) / 7, 2)) * Math.exp(-Math.pow((la - 30) / 3, 2));
  d += yangtze * 0.35;
  // Boost Jiangnan (116-122°E, 28-32°N)
  const jiangnan = Math.exp(-Math.pow((lo - 119) / 4, 2)) * Math.exp(-Math.pow((la - 30) / 3, 2));
  d += jiangnan * 0.30;
  // Boost NE forest (125-132°E, 42-48°N)
  const northeast = Math.exp(-Math.pow((lo - 128) / 5, 2)) * Math.exp(-Math.pow((la - 45) / 3, 2));
  d += northeast * 0.45;
  // Heavy penalty on western plateau + deserts
  if (lo < 95)                        d *= 0.15;  // 青藏 high + dry
  if (la > 38 && lo < 110)            d *= 0.25;  // 内蒙/甘肃干旱
  return Math.max(0, Math.min(1, d));
}

export function buildVegetation(scene, {
  target     = 3600,      // approximate instance count to place
  maxTries   = 60000,     // rejection-sample tries budget
  minH       = 0.18,      // minimum scene-unit terrain height (≈200m)
  maxH       = 6.5,       // (≈1600m)
  scaleMin   = 0.14,
  scaleMax   = 0.36,
} = {}) {
  const tex = mkDabTex();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: true,
  });
  const inst = new THREE.InstancedMesh(geo, mat, target);
  inst.renderOrder = 6;
  inst.frustumCulled = false;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();

  let placed = 0, tries = 0;
  while (placed < target && tries < maxTries) {
    tries++;
    const lo = 78 + Math.random() * 56;   // 78° → 134°E
    const la = 18 + Math.random() * 32;   // 18° → 50°N
    if (!inLand(lo, la)) continue;
    const density = forestDensity(lo, la);
    if (Math.random() > density) continue;

    const [x, z] = ll2s(lo, la);
    const y = hAt(x, z);
    if (y < minH || y > maxH) continue;

    // Place: billboard orientation — face roughly up + slight camera lean.
    // For an overhead view we just lie flat with small tilt so they read as
    // painterly canopy dabs, not upright banners.
    const scale = scaleMin + Math.random() * (scaleMax - scaleMin);
    p.set(x, y + 0.035, z);
    s.set(scale, scale, scale);
    // Euler: rotate around X so dab lies horizontal, with tiny random yaw
    q.setFromEuler(new THREE.Euler(-Math.PI / 2, Math.random() * Math.PI * 2, 0));
    m.compose(p, q, s);
    inst.setMatrixAt(placed, m);

    // Per-instance color tint (small palette for variation)
    const cv = new THREE.Color().setHSL(
      0.26 + Math.random() * 0.06,   // green hue range
      0.30 + Math.random() * 0.18,   // medium-low sat
      0.28 + Math.random() * 0.14    // dark to mid
    );
    inst.setColorAt(placed, cv);

    placed++;
  }
  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

  scene.add(inst);
  return { mesh: inst, placed, tries };
}
