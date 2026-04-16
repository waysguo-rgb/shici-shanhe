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
// ═══════════════════════════════════════
export function mkDecorativeWaveTex() {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d');
  cx.clearRect(0, 0, W, H);

  const baseY = H * 0.92;
  const crestH = H * 0.72;
  const cxMid = W * 0.5;

  const g = cx.createLinearGradient(0, baseY - crestH, 0, baseY);
  g.addColorStop(0, '#7ce0f0');
  g.addColorStop(0.25, '#3ab4d2');
  g.addColorStop(0.55, '#1870b0');
  g.addColorStop(1, '#0a4580');

  cx.fillStyle = g;
  cx.beginPath();
  cx.moveTo(W * 0.05, baseY);
  cx.bezierCurveTo(W * 0.18, baseY - crestH * 0.55, W * 0.32, baseY - crestH * 0.95, cxMid, baseY - crestH);
  cx.bezierCurveTo(W * 0.68, baseY - crestH * 0.95, W * 0.82, baseY - crestH * 0.55, W * 0.95, baseY);
  cx.lineTo(W * 0.05, baseY);
  cx.closePath();
  cx.fill();

  cx.strokeStyle = '#e8c070';
  cx.lineWidth = 5;
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(W * 0.05, baseY);
  cx.bezierCurveTo(W * 0.18, baseY - crestH * 0.55, W * 0.32, baseY - crestH * 0.95, cxMid, baseY - crestH);
  cx.bezierCurveTo(W * 0.68, baseY - crestH * 0.95, W * 0.82, baseY - crestH * 0.55, W * 0.95, baseY);
  cx.stroke();

  for (let layer = 1; layer <= 6; layer++) {
    const off = layer * 13;
    cx.strokeStyle = `rgba(235,200,120,${0.88 - layer * 0.11})`;
    cx.lineWidth = 1.8;
    cx.beginPath();
    cx.moveTo(W * 0.05 + off * 0.15, baseY);
    cx.bezierCurveTo(
      W * 0.18 + off * 0.08, baseY - crestH * 0.55 + off * 0.45,
      W * 0.32 + off * 0.04, baseY - crestH * 0.95 + off * 0.7,
      cxMid, baseY - crestH + off
    );
    cx.bezierCurveTo(
      W * 0.68 - off * 0.04, baseY - crestH * 0.95 + off * 0.7,
      W * 0.82 - off * 0.08, baseY - crestH * 0.55 + off * 0.45,
      W * 0.95 - off * 0.15, baseY
    );
    cx.stroke();
  }

  cx.strokeStyle = 'rgba(255,250,200,0.7)';
  cx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    cx.beginPath();
    cx.arc(cxMid, baseY - crestH + i * 4, 10 - i * 2, Math.PI * 1.2, Math.PI * 1.8);
    cx.stroke();
  }

  function drawPearl(x, y, r) {
    const g = cx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, '#fff8dc');
    g.addColorStop(0.5, '#f0d878');
    g.addColorStop(0.9, '#c89830');
    g.addColorStop(1, 'rgba(120,80,20,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(x, y, r, 0, 6.28); cx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 0.7 - Math.PI * 0.35 - Math.PI / 2;
    const dist = 8 + Math.random() * 35;
    const px = cxMid + Math.cos(angle) * dist * 1.2;
    const py = baseY - crestH + Math.sin(angle) * dist * 0.5;
    drawPearl(px, py, 3 + Math.random() * 3);
  }
  for (let i = 0; i < 8; i++) {
    const t = Math.random();
    const px = W * 0.1 + t * W * 0.8;
    const py = baseY - crestH * 0.3 - Math.random() * 30;
    drawPearl(px, py, 2.5 + Math.random() * 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Shared wave texture instance (created once, reused by WaveBuilder)
export const _sharedWaveTex = mkDecorativeWaveTex();
