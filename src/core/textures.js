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
// 国潮 line-art 海浪 (参考用户提供的第二张图的造型):
//   - 三级峰: 主峰 cloud-cap (居左) + 中峰 + 右侧小峰簇
//   - 粗蓝色描边 + 浅水蓝半透填充 (不上色块, 走线稿风)
//   - 每峰内有 2-3 条平行水纹
//   - 基部两条横向波纹基线串联三峰
//   - 主峰顶一个小螺旋卷
// 小 sprite 下线稿比渐变色块更耐看, 外轮廓清晰, 颜色淡不抢绢纸底.
// ═══════════════════════════════════════
export function mkDecorativeWaveTex() {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, W, H);

  const OUTLINE_COLOR = '#2578b8';
  const FILL_COLOR    = 'rgba(185, 220, 238, 0.35)';
  const INNER_LINE    = 'rgba(37, 120, 184, 0.55)';

  cx.fillStyle = FILL_COLOR;
  cx.strokeStyle = OUTLINE_COLOR;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';

  const baseY = H * 0.78;  // 三峰共同基准线

  // ── 左主峰 (带 cloud-cap 圆润顶) ──
  const lp = new Path2D();
  lp.moveTo(W * 0.06, baseY);
  lp.bezierCurveTo(W * 0.12, baseY - 20, W * 0.18, H * 0.45, W * 0.26, H * 0.30);
  lp.bezierCurveTo(W * 0.28, H * 0.18, W * 0.26, H * 0.10, W * 0.31, H * 0.08);
  // cloud cap 顶弧
  lp.bezierCurveTo(W * 0.38, H * 0.02, W * 0.48, H * 0.05, W * 0.50, H * 0.18);
  lp.bezierCurveTo(W * 0.51, H * 0.26, W * 0.48, H * 0.31, W * 0.43, H * 0.32);
  lp.bezierCurveTo(W * 0.41, H * 0.36, W * 0.40, H * 0.42, W * 0.42, H * 0.50);
  lp.bezierCurveTo(W * 0.44, H * 0.62, W * 0.44, H * 0.72, W * 0.44, baseY);
  lp.closePath();
  cx.fill(lp); cx.lineWidth = 5; cx.stroke(lp);

  // ── 中峰 ──
  const mp = new Path2D();
  mp.moveTo(W * 0.44, baseY);
  mp.bezierCurveTo(W * 0.50, H * 0.55, W * 0.56, H * 0.32, W * 0.62, H * 0.22);
  mp.bezierCurveTo(W * 0.65, H * 0.14, W * 0.68, H * 0.12, W * 0.72, H * 0.18);
  mp.bezierCurveTo(W * 0.75, H * 0.26, W * 0.73, H * 0.32, W * 0.70, H * 0.34);
  mp.bezierCurveTo(W * 0.71, H * 0.50, W * 0.73, H * 0.64, W * 0.74, baseY);
  mp.closePath();
  cx.fill(mp); cx.lineWidth = 5; cx.stroke(mp);

  // ── 右小峰簇 ──
  const sp = new Path2D();
  sp.moveTo(W * 0.74, baseY);
  sp.bezierCurveTo(W * 0.80, H * 0.62, W * 0.85, H * 0.42, W * 0.88, H * 0.38);
  sp.bezierCurveTo(W * 0.92, H * 0.32, W * 0.96, H * 0.38, W * 0.96, H * 0.48);
  sp.bezierCurveTo(W * 0.98, H * 0.58, W * 0.96, H * 0.70, W * 0.96, baseY);
  sp.closePath();
  cx.fill(sp); cx.lineWidth = 5; cx.stroke(sp);

  // ── 每峰内平行水纹 (clip 到 path) ──
  function drawInner(path, layers, topY) {
    cx.save();
    cx.clip(path);
    cx.strokeStyle = INNER_LINE;
    cx.lineWidth = 2;
    for (let i = 1; i <= layers; i++) {
      const off = i * 12;
      cx.beginPath();
      cx.moveTo(0, baseY - off);
      cx.bezierCurveTo(W * 0.30, baseY - off - 40, W * 0.50, topY + off, W * 0.75, topY + off * 1.2);
      cx.bezierCurveTo(W * 0.85, H * 0.40 + off * 0.3, W * 0.95, H * 0.50 + off * 0.2, W, H * 0.55 + off * 0.2);
      cx.stroke();
    }
    cx.restore();
  }
  drawInner(lp, 3, H * 0.18);
  drawInner(mp, 2, H * 0.25);
  drawInner(sp, 2, H * 0.42);

  // ── 主峰顶螺旋小卷 ──
  cx.strokeStyle = OUTLINE_COLOR;
  cx.lineWidth = 3;
  cx.beginPath();
  cx.arc(W * 0.36, H * 0.24, 7, Math.PI * 1.4, Math.PI * 2.5, false);
  cx.stroke();

  // ── 基部波纹基线 (两条横向) ──
  cx.strokeStyle = OUTLINE_COLOR;
  cx.lineWidth = 4;
  cx.beginPath();
  cx.moveTo(0, H * 0.88);
  cx.bezierCurveTo(W * 0.22, H * 0.82, W * 0.42, H * 0.94, W * 0.62, H * 0.88);
  cx.bezierCurveTo(W * 0.80, H * 0.84, W * 0.93, H * 0.92, W, H * 0.88);
  cx.stroke();

  cx.strokeStyle = 'rgba(37, 120, 184, 0.60)';
  cx.lineWidth = 3;
  cx.beginPath();
  cx.moveTo(0, H * 0.96);
  cx.bezierCurveTo(W * 0.25, H * 0.93, W * 0.45, H * 0.98, W * 0.68, H * 0.94);
  cx.bezierCurveTo(W * 0.85, H * 0.97, W * 0.95, H * 0.95, W, H * 0.96);
  cx.stroke();

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Shared wave texture instance (created once, reused by WaveBuilder)
export const _sharedWaveTex = mkDecorativeWaveTex();
