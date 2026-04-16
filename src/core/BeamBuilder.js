// Golden light beams for location highlights
import * as THREE from 'three';

// Mutable state
export const beamMeshes = [];

// ═══════════════════════════════════════
// Beam texture (vertical gradient with lateral feathering)
// ═══════════════════════════════════════
function mkBeamTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const cx = c.getContext('2d');
  const g = cx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,240,190,0)');
  g.addColorStop(0.10, 'rgba(255,235,180,0.40)');
  g.addColorStop(0.40, 'rgba(255,225,160,0.80)');
  g.addColorStop(0.70, 'rgba(255,220,150,0.95)');
  g.addColorStop(0.92, 'rgba(255,235,180,1)');
  g.addColorStop(1, 'rgba(255,250,220,1)');
  cx.fillStyle = g; cx.fillRect(0, 0, 64, 256);
  const h = cx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.30, 'rgba(0,0,0,0.4)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(0.70, 'rgba(0,0,0,0.4)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  cx.globalCompositeOperation = 'destination-out';
  cx.fillStyle = h; cx.fillRect(0, 0, 64, 256);
  cx.globalCompositeOperation = 'source-over';
  return new THREE.CanvasTexture(c);
}

const beamTex = mkBeamTex();

// ═══════════════════════════════════════
// Build a single light beam + halo at a location
// ═══════════════════════════════════════
export function mkLightBeam(x, y, z, scene) {
  const matB = new THREE.SpriteMaterial({
    map: beamTex, color: 0xffe2a8, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const sp = new THREE.Sprite(matB);
  const beamH = 7 + Math.random() * 2;
  sp.scale.set(0.30, beamH, 1);
  sp.position.set(x, y + beamH / 2, z);
  sp.userData = { baseY: y, h: beamH, phase: Math.random() * Math.PI * 2, target: 0, current: 0 };
  beamMeshes.push(sp);
  scene.add(sp);

  const matG = new THREE.SpriteMaterial({
    map: beamTex, color: 0xffd890, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Sprite(matG);
  halo.scale.set(1.1, 1.1, 1);
  halo.position.set(x, y + 0.25, z);
  halo.userData = { isHalo: true, phase: Math.random() * Math.PI * 2, target: 0, current: 0 };
  beamMeshes.push(halo);
  scene.add(halo);

  return [sp, halo];
}
