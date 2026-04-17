// Drifting blossom petals — tiny sprite particles that float across the scene
// at varying speeds and angles. Adds a sense of time and breeze to the map,
// evoking 落花 / 飞花 motifs from classical Chinese poetry.
//
// Performance budget: ~120 sprites max, CPU-updated once per frame. Each is
// a tiny canvas-drawn petal. Total cost ≈ 0.1ms/frame on desktop.
import * as THREE from 'three';

// Procedurally-painted petal texture (soft tear-drop shape, light pink)
function mkPetalTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  // Teardrop / almond shape
  cx.save();
  cx.translate(16, 16);
  cx.rotate(Math.PI / 5);
  const grad = cx.createRadialGradient(0, 0, 0, 0, 0, 14);
  grad.addColorStop(0,    'rgba(255,240,245,0.95)');
  grad.addColorStop(0.55, 'rgba(252,212,214,0.75)');
  grad.addColorStop(0.95, 'rgba(246,184,188,0.15)');
  grad.addColorStop(1,    'rgba(246,184,188,0)');
  cx.fillStyle = grad;
  cx.beginPath();
  // Simple petal: ellipse with one pointy end
  cx.moveTo(0, -13);
  cx.bezierCurveTo(8, -10, 8, 6, 0, 13);
  cx.bezierCurveTo(-8, 6, -8, -10, 0, -13);
  cx.fill();
  cx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export const petalSprites = [];

export function initPetals(scene, { count = 100, xRange = [-70, 85], zRange = [-48, 48], yTop = 14, yBot = 0.5 } = {}) {
  const tex = mkPetalTex();
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.55 + Math.random() * 0.25,
      depthWrite: false,
      fog: true,
      color: new THREE.Color().setHSL(
        0.96 + Math.random() * 0.03,  // pink/warm-white
        0.35 + Math.random() * 0.25,
        0.85 + Math.random() * 0.08
      )
    });
    const sp = new THREE.Sprite(mat);
    const scale = 0.18 + Math.random() * 0.25;
    sp.scale.set(scale, scale, 1);
    // Initial position — randomly distributed across the drift zone so we don't
    // get a synchronized "first wave" falling from the top.
    sp.position.set(
      xRange[0] + Math.random() * (xRange[1] - xRange[0]),
      yBot + Math.random() * (yTop - yBot),
      zRange[0] + Math.random() * (zRange[1] - zRange[0])
    );
    sp.userData = {
      // Per-petal drift: gentle down + sideways breeze + individual phase
      vy: -0.12 - Math.random() * 0.18,
      vx: (Math.random() - 0.4) * 0.25,   // bias slightly east
      vz: (Math.random() - 0.5) * 0.08,
      swirlAmp: 0.3 + Math.random() * 0.4,
      swirlFreq: 0.7 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      xRange, zRange, yTop, yBot,
      baseOp: mat.opacity
    };
    scene.add(sp);
    petalSprites.push(sp);
  }
}

// Called every frame from animate()
export function updatePetals(t, dt) {
  for (let i = 0; i < petalSprites.length; i++) {
    const sp = petalSprites[i];
    const u = sp.userData;
    // Swirl: cheap sinusoidal lateral wobble so petals don't fall straight
    sp.position.x += (u.vx + Math.sin(t * u.swirlFreq + u.phase) * u.swirlAmp * 0.02) * dt;
    sp.position.y += u.vy * dt;
    sp.position.z += (u.vz + Math.cos(t * u.swirlFreq * 0.7 + u.phase) * u.swirlAmp * 0.015) * dt;
    // Gentle rotation of sprite
    sp.material.rotation = Math.sin(t * u.swirlFreq + u.phase) * 0.6;

    // Fade near top/bottom for soft spawn/despawn feel
    const spanY = u.yTop - u.yBot;
    const frac = (sp.position.y - u.yBot) / spanY;
    let opMul = 1;
    if (frac < 0.15) opMul = Math.max(0, frac / 0.15);
    else if (frac > 0.85) opMul = Math.max(0, (1 - frac) / 0.15);
    sp.material.opacity = u.baseOp * opMul;

    // Recycle petals that fell off the bottom or drifted out
    if (sp.position.y < u.yBot ||
        sp.position.x < u.xRange[0] - 5 || sp.position.x > u.xRange[1] + 5 ||
        sp.position.z < u.zRange[0] - 5 || sp.position.z > u.zRange[1] + 5) {
      sp.position.x = u.xRange[0] + Math.random() * (u.xRange[1] - u.xRange[0]);
      sp.position.y = u.yTop - Math.random() * 2;
      sp.position.z = u.zRange[0] + Math.random() * (u.zRange[1] - u.zRange[0]);
    }
  }
}
