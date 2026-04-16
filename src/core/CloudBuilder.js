// Volumetric cloud cluster generation
import * as THREE from 'three';

// Mutable state
export const cloudGroups = [];

// ═══════════════════════════════════════
// Cloud texture (radial gradient + puffy blobs)
// ═══════════════════════════════════════
function mkCloudTex(seed) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const cx = c.getContext('2d');
  const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(255,255,253,${0.85 + seed * 0.1})`);
  g.addColorStop(.25, `rgba(252,252,250,${0.7 + seed * 0.1})`);
  g.addColorStop(.55, 'rgba(248,248,246,0.35)');
  g.addColorStop(.85, 'rgba(240,240,240,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 80; i++) {
    const px = 20 + Math.random() * 88, py = 20 + Math.random() * 88, r = Math.random() * 22 + 8;
    const rg = cx.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, `rgba(255,255,253,${.35 + Math.random() * .4})`);
    rg.addColorStop(.6, `rgba(250,250,248,${.15 + Math.random() * .15})`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = rg; cx.beginPath(); cx.arc(px, py, r, 0, 6.28); cx.fill();
  }
  return new THREE.CanvasTexture(c);
}

// ═══════════════════════════════════════
// Build a single cloud cluster (group of sprites)
// ═══════════════════════════════════════
export function mkCloudCluster(x, y, z, baseW, baseH, scene) {
  const group = new THREE.Group();
  const layers = 3 + Math.floor(Math.random() * 2);
  for (let j = 0; j < layers; j++) {
    const yOff = (j - layers / 2) * 0.7 + Math.random() * 0.3;
    const sc = 0.45 + Math.random() * 0.45;
    const op = 0.42 + 0.3 * (1 - Math.abs(j - layers / 2) / (layers / 2));
    const tex = mkCloudTex(j / layers);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: op, depthWrite: false, fog: true
    }));
    sprite.scale.set(baseW * sc, baseH * sc * 0.5, 1);
    sprite.position.set((Math.random() - .5) * baseW * 0.4, yOff, (Math.random() - .5) * baseH * 0.4);
    group.add(sprite);
  }
  group.position.set(x, y, z);
  group.userData = {
    baseY: y,
    driftX: (Math.random() - .5) * .12,
    driftZ: (Math.random() - .5) * .08,
    phase: Math.random() * 6.28
  };
  scene.add(group);
  cloudGroups.push(group);
  return group;
}

// Store each cloud layer sprite's base opacity (called after init)
export function finalizeCloudOpacity() {
  cloudGroups.forEach(cg => {
    cg.children.forEach(s => { s.userData_baseOp = s.material.opacity || 0.2; });
  });
}
