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
// Decorative wave sprite texture (mkDecorativeWaveTex) — 浮世绘 Great Wave
// 北斋神奈川冲浪里 启发: 深蓝 + 浅青绿的波身, 奶油白泡沫爪状曲线,
// 深墨描边, 非对称峰型.
// ═══════════════════════════════════════
export function mkDecorativeWaveTex() {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, W, H);

  // Hokusai palette
  const NAVY_DEEP = '#0b2553';
  const NAVY_MID  = '#1e4f91';
  const TEAL_HI   = '#6ea6c4';
  const TEAL_LIGHT= '#b1d1dd';
  const FOAM      = '#f4ead0';    // 奶油色而非纯白, 匹配绢纸主色调
  const INK       = '#0a1a33';

  const baseY = H * 0.94;
  const crestTop = H * 0.10;      // peak at very top
  const peakX = W * 0.40;

  // ── Step 1: 主波体 (dark-to-light 垂直渐变) ──
  const bodyPath = new Path2D();
  bodyPath.moveTo(0, baseY);
  // 左坡缓慢抬升
  bodyPath.bezierCurveTo(W*0.08, baseY, W*0.20, H*0.55, W*0.32, H*0.30);
  // 上升到峰顶
  bodyPath.bezierCurveTo(W*0.36, H*0.15, peakX-10, crestTop+6, peakX, crestTop);
  // 顶部向右卷 (浮世绘的招牌 curl)
  bodyPath.bezierCurveTo(peakX+W*0.08, crestTop-6, peakX+W*0.18, H*0.18, peakX+W*0.22, H*0.28);
  // 卷回钩状
  bodyPath.bezierCurveTo(peakX+W*0.20, H*0.36, peakX+W*0.12, H*0.36, peakX+W*0.06, H*0.32);
  // 回到波体内部再转向右侧下落
  bodyPath.bezierCurveTo(peakX+W*0.10, H*0.40, peakX+W*0.18, H*0.48, W*0.70, H*0.55);
  bodyPath.bezierCurveTo(W*0.82, H*0.68, W*0.92, baseY-10, W, baseY);
  bodyPath.lineTo(W, H);
  bodyPath.lineTo(0, H);
  bodyPath.closePath();

  const bodyGrad = cx.createLinearGradient(0, crestTop, 0, baseY);
  bodyGrad.addColorStop(0.00, TEAL_LIGHT);
  bodyGrad.addColorStop(0.18, TEAL_HI);
  bodyGrad.addColorStop(0.45, NAVY_MID);
  bodyGrad.addColorStop(1.00, NAVY_DEEP);
  cx.fillStyle = bodyGrad;
  cx.fill(bodyPath);

  // ── Step 2: 内部平行浪纹线 (ukiyo-e 水纹特征) ──
  cx.save();
  cx.clip(bodyPath);
  cx.strokeStyle = 'rgba(12, 40, 85, 0.55)';
  cx.lineWidth = 1.4;
  cx.lineCap = 'round';
  for (let layer = 1; layer <= 6; layer++) {
    const off = layer * 14;
    cx.beginPath();
    cx.moveTo(0, baseY - off * 0.3);
    cx.bezierCurveTo(W*0.12, baseY - crestTop*0.5 - off*0.6, W*0.22, H*0.45 + off*0.3, W*0.30 + off*0.2, H*0.38 + off*0.4);
    cx.bezierCurveTo(W*0.35 + off*0.15, H*0.28 + off*0.5, peakX - off*0.1, crestTop + 5 + off, peakX + off*0.1, crestTop + 10 + off);
    cx.stroke();
  }
  cx.restore();

  // ── Step 3: 深墨色描边 (画面骨架) ──
  cx.strokeStyle = INK;
  cx.lineWidth = 2.4;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  cx.stroke(bodyPath);

  // ── Step 4: 波顶泡沫爪 (浮世绘招牌 finger-claws) ──
  function foamClaw(x, y, size, angle, curl) {
    cx.save();
    cx.translate(x, y);
    cx.rotate(angle);
    // drop shape with finger-like tip
    cx.beginPath();
    cx.moveTo(0, 0);
    cx.bezierCurveTo(size*0.55, -size*0.35, size*1.20, -size*0.40*curl, size*1.55, size*0.05);
    cx.bezierCurveTo(size*1.20, size*0.28, size*0.60, size*0.32, 0, size*0.08);
    cx.closePath();
    cx.fillStyle = FOAM;
    cx.fill();
    cx.strokeStyle = INK;
    cx.lineWidth = 1.4;
    cx.stroke();
    cx.restore();
  }
  // 从波峰向右延伸的一串爪子 (主要特征)
  const clawBaseX = peakX + W*0.06;
  const clawBaseY = crestTop + 4;
  foamClaw(clawBaseX,         clawBaseY,         30, -0.20, 1.1);
  foamClaw(clawBaseX + 20,    clawBaseY - 10,    25, -0.05, 1.0);
  foamClaw(clawBaseX + 38,    clawBaseY + 3,     22,  0.12, 0.9);
  foamClaw(clawBaseX - 12,    clawBaseY + 15,    24, -0.55, 1.2);
  // 内侧小爪子 (curl 下面)
  foamClaw(peakX + W*0.10,    H*0.25,            18,  0.35, 0.8);
  foamClaw(peakX + W*0.04,    H*0.32,            14,  0.85, 0.7);

  // ── Step 5: 飞溅水珠 (奶油色小圆) ──
  cx.fillStyle = FOAM;
  cx.strokeStyle = INK;
  cx.lineWidth = 1.0;
  for (let i = 0; i < 18; i++) {
    // 集中在峰顶附近, 向右上喷发
    const angle = Math.random() * 1.2 - 0.6 - Math.PI * 0.35;
    const dist = 18 + Math.random() * 80;
    const dx = peakX + W*0.08 + Math.cos(angle) * dist * 0.9;
    const dy = crestTop + Math.sin(angle) * dist * 0.55;
    if (dx < 0 || dx > W || dy < 0 || dy > H) continue;
    const r = 2.5 + Math.random() * 3.5;
    cx.beginPath();
    cx.arc(dx, dy, r, 0, Math.PI * 2);
    cx.fill();
    cx.stroke();
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
