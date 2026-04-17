// Lake mesh generation
import * as THREE from 'three';
import { ll2s } from './helpers.js';
import { hAtMax } from './TerrainBuilder.js';
import { mkLakeTex } from './textures.js';

// Mutable state
export const lakeMeshes = [];
export const lakeLabels = []; // {el, pos:Vector3, name}

// ═══════════════════════════════════════
// Build a single lake polygon mesh
// ═══════════════════════════════════════
export function mkLake(lake) {
  const worldPts = lake.pts.map(([lo, la]) => ll2s(lo, la));
  const shape = new THREE.Shape();
  shape.moveTo(worldPts[0][0], worldPts[0][1]);
  for (let i = 1; i < worldPts.length; i++) {
    shape.lineTo(worldPts[i][0], worldPts[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 12);
  geo.rotateX(Math.PI / 2);

  // Sample terrain height for water surface baseline
  let minH = 999;
  worldPts.forEach(([x, z]) => {
    const h = hAtMax(x, z);
    if (h < minH) minH = h;
  });
  const cx = worldPts.reduce((s, p) => s + p[0], 0) / worldPts.length;
  const cz = worldPts.reduce((s, p) => s + p[1], 0) / worldPts.length;
  const hCen = hAtMax(cx, cz);
  if (hCen < minH) minH = hCen;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    const h = hAtMax(cx + Math.cos(a) * 0.4, cz + Math.sin(a) * 0.4);
    if (h < minH) minH = h;
  }
  const lakeY = minH + 0.10;

  const tex = mkLakeTex();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
    // depthTest ON: lakes must be occluded by mountains in front of them.
    // (was false, which let us always see lakes even through terrain.)
    depthTest: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = lakeY;
  mesh.renderOrder = 10;
  mesh.userData = {
    name: lake.n,
    center: new THREE.Vector3(cx, lakeY, cz),
    phase: Math.random() * 6.28,
    tex: tex,
    driftX: 0.008 + Math.random() * 0.008,
    driftZ: 0.004 + Math.random() * 0.006,
  };
  lakeMeshes.push(mesh);
  return mesh;
}

// ═══════════════════════════════════════
// Lake labels (DOM elements positioned in 3D)
// ═══════════════════════════════════════
export function buildLakeLabels() {
  const cont = document.getElementById('rlbls');
  lakeMeshes.forEach(m => {
    const c = m.userData.center;
    const el = document.createElement('div');
    el.className = 'llb';
    el.textContent = m.userData.name;
    cont.appendChild(el);
    lakeLabels.push({ el, pos: new THREE.Vector3(c.x, c.y + 0.5, c.z), name: m.userData.name });
  });
}
