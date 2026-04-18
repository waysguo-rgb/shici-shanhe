// Canvas texture generation functions for water, rivers, lakes, and waves
import * as THREE from 'three';

// ═══════════════════════════════════════
// Wide river texture (mkWaterTex)
// ═══════════════════════════════════════
export function mkWaterTex() {
  const W = 1024, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d');
  const bg = cx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(180,150,100,0.95)');
  bg.addColorStop(0.06, 'rgba(200,172,120,0.92)');
  bg.addColorStop(0.12, 'rgba(160,190,160,0.88)');
  bg.addColorStop(0.22, 'rgba(80,150,145,0.96)');
  bg.addColorStop(0.38, 'rgba(35,95,100,1)');
  bg.addColorStop(0.50, 'rgba(18,65,78,1)');
  bg.addColorStop(0.62, 'rgba(35,95,100,1)');
  bg.addColorStop(0.78, 'rgba(80,150,145,0.96)');
  bg.addColorStop(0.88, 'rgba(160,190,160,0.88)');
  bg.addColorStop(0.94, 'rgba(200,172,120,0.92)');
  bg.addColorStop(1, 'rgba(180,150,100,0.95)');
  cx.fillStyle = bg; cx.fillRect(0, 0, W, H);

  cx.globalAlpha = 0.55;
  for (let i = 0; i < 180; i++) {
    const yy = H * 0.15 + Math.random() * H * 0.70;
    const len = 60 + Math.random() * 260;
    const xx = Math.random() * W;
    const isDark = Math.random() < 0.4;
    const grad = cx.createLinearGradient(xx, 0, xx + len, 0);
    if (isDark) {
      grad.addColorStop(0, 'rgba(10,40,55,0)');
      grad.addColorStop(0.5, 'rgba(10,40,55,0.65)');
      grad.addColorStop(1, 'rgba(10,40,55,0)');
    } else {
      grad.addColorStop(0, 'rgba(170,225,220,0)');
      grad.addColorStop(0.5, 'rgba(170,225,220,0.55)');
      grad.addColorStop(1, 'rgba(170,225,220,0)');
    }
    cx.fillStyle = grad; cx.fillRect(xx, yy - 0.5, len, 1);
  }
  cx.globalAlpha = 1;

  cx.globalAlpha = 0.35;
  for (let i = 0; i < 30; i++) {
    const xx = Math.random() * W;
    const yy = H * 0.30 + Math.random() * H * 0.40;
    const rr = 20 + Math.random() * 40;
    const g = cx.createRadialGradient(xx, yy, 0, xx, yy, rr);
    g.addColorStop(0, 'rgba(8,35,50,0.4)');
    g.addColorStop(1, 'rgba(8,35,50,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.ellipse(xx, yy, rr, rr * 0.4, 0, 0, 6.28); cx.fill();
  }
  cx.globalAlpha = 1;

  cx.globalAlpha = 0.45;
  for (let i = 0; i < 200; i++) {
    const xx = Math.random() * W;
    const yy = Math.random() * H * 0.10;
    cx.fillStyle = `rgba(${140 + Math.random() * 40 | 0},${110 + Math.random() * 30 | 0},${70 + Math.random() * 30 | 0},${Math.random() * 0.7})`;
    cx.fillRect(xx, yy, Math.random() * 1.5 + 0.5, Math.random() * 1 + 0.5);
    const yy2 = H * 0.90 + Math.random() * H * 0.10;
    cx.fillStyle = `rgba(${140 + Math.random() * 40 | 0},${110 + Math.random() * 30 | 0},${70 + Math.random() * 30 | 0},${Math.random() * 0.7})`;
    cx.fillRect(xx, yy2, Math.random() * 1.5 + 0.5, Math.random() * 1 + 0.5);
  }
  cx.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(4, 1);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ═══════════════════════════════════════
// Silk-thread river texture (mkSilkTex)
// ═══════════════════════════════════════
export function mkSilkTex() {
  const W = 1024, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d');
  cx.clearRect(0, 0, W, H);
  const bg = cx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(25,65,95,0)');
  bg.addColorStop(0.18, 'rgba(28,78,110,0.35)');
  bg.addColorStop(0.30, 'rgba(32,95,130,0.85)');
  bg.addColorStop(0.42, 'rgba(40,115,155,1.0)');
  bg.addColorStop(0.50, 'rgba(50,140,175,1.0)');
  bg.addColorStop(0.58, 'rgba(40,115,155,1.0)');
  bg.addColorStop(0.70, 'rgba(32,95,130,0.85)');
  bg.addColorStop(0.82, 'rgba(28,78,110,0.35)');
  bg.addColorStop(1, 'rgba(25,65,95,0)');
  cx.fillStyle = bg; cx.fillRect(0, 0, W, H);

  cx.globalAlpha = 0.38;
  for (let i = 0; i < 24; i++) {
    const xx = Math.random() * W;
    const wl = 120 + Math.random() * 180;
    const yOff = (Math.random() - 0.5) * 8;
    const grad = cx.createLinearGradient(xx, H / 2 + yOff, xx + wl, H / 2 + yOff);
    grad.addColorStop(0, 'rgba(15,55,80,0)');
    grad.addColorStop(0.5, 'rgba(15,55,80,0.75)');
    grad.addColorStop(1, 'rgba(15,55,80,0)');
    cx.fillStyle = grad;
    cx.fillRect(xx, H / 2 + yOff - 1.5, wl, 3);
  }
  cx.globalAlpha = 0.35;
  for (let i = 0; i < 10; i++) {
    const xx = Math.random() * W;
    const wl = 80 + Math.random() * 140;
    const yOff = (Math.random() - 0.5) * 6;
    const grad = cx.createLinearGradient(xx, H / 2 + yOff, xx + wl, H / 2 + yOff);
    grad.addColorStop(0, 'rgba(185,225,240,0)');
    grad.addColorStop(0.5, 'rgba(185,225,240,0.9)');
    grad.addColorStop(1, 'rgba(185,225,240,0)');
    cx.fillStyle = grad;
    cx.fillRect(xx, H / 2 + yOff - 0.6, wl, 1.2);
  }
  cx.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(6, 1);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// ═══════════════════════════════════════
// Lake surface texture (mkLakeTex)
// ═══════════════════════════════════════
export function mkLakeTex() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S; const cx = c.getContext('2d');
  cx.fillStyle = 'rgba(45,130,165,1.0)';
  cx.fillRect(0, 0, S, S);

  const g = cx.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.65);
  g.addColorStop(0, 'rgba(80,170,205,0.45)');
  g.addColorStop(0.5, 'rgba(45,130,165,0.0)');
  g.addColorStop(0.85, 'rgba(30,90,125,0.30)');
  g.addColorStop(1, 'rgba(20,65,95,0.55)');
  cx.fillStyle = g; cx.fillRect(0, 0, S, S);

  for (let i = 0; i < 350; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const rr = 0.4 + Math.random() * 1.3;
    cx.fillStyle = `rgba(220,240,250,${0.35 + Math.random() * 0.55})`;
    cx.beginPath(); cx.arc(x, y, rr, 0, Math.PI * 2); cx.fill();
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const rr = 2 + Math.random() * 3.5;
    const gg = cx.createRadialGradient(x, y, 0, x, y, rr);
    gg.addColorStop(0, 'rgba(255,255,255,0.75)');
    gg.addColorStop(0.5, 'rgba(200,230,245,0.30)');
    gg.addColorStop(1, 'rgba(180,220,240,0)');
    cx.fillStyle = gg;
    cx.beginPath(); cx.arc(x, y, rr, 0, Math.PI * 2); cx.fill();
  }
  cx.globalAlpha = 0.32;
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const wl = 20 + Math.random() * 50;
    const gg = cx.createLinearGradient(x, y, x + wl, y);
    gg.addColorStop(0, 'rgba(230,245,255,0)');
    gg.addColorStop(0.5, 'rgba(230,245,255,0.9)');
    gg.addColorStop(1, 'rgba(230,245,255,0)');
    cx.fillStyle = gg;
    cx.fillRect(x, y - 0.6, wl, 1.2);
  }
  cx.globalAlpha = 1;

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.repeat.set(2, 2);
  return t;
}

// ═══════════════════════════════════════
// Decorative wave sprite texture (mkDecorativeWaveTex)
// 用户自定义的 PNG 海浪图 (国潮流线风格).
// 放在 public/assets/textures/wave.png, 透明背景.
// ═══════════════════════════════════════
export function mkDecorativeWaveTex() {
  const loader = new THREE.TextureLoader();
  const tex = loader.load('/assets/textures/wave.png', (t) => { t.needsUpdate = true; });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  // three r128 默认 LinearEncoding 会让 sRGB PNG 偏暗
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  return tex;
}

// Shared wave texture instance (created once, reused by WaveBuilder)
export const _sharedWaveTex = mkDecorativeWaveTex();
