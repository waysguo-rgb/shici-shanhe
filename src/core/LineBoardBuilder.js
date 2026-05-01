// 名句立牌 — 挑选 20 句国民级诗词名句, 在对应城市附近上空贴一块淡墨色立牌.
// 视觉目标: 用户把视角拉近到某座城, 就能看到这里"古人说过什么". 远景时隐藏, 近景
// 淡入, 给场景加一层"可读"的诗意密度.
//
// 实现: 文字→canvas→CanvasTexture→Sprite. 每块立牌带竖写字 + 仿"木楹联"边框.
import * as THREE from 'three';
import FAMOUS_LINES from '../data/famous_lines.js';
import { hAtMax } from './TerrainBuilder.js';

// 距离阈值
const FADE_IN_NEAR   = 25;   // < 25 世界单位: 完全可见
const FADE_OUT_FAR   = 70;   // > 70: 完全隐
// 中间线性淡入/出

export const lineBoards = [];

// 全局开关 + 朝代滤镜. 两者都会影响每块板的 visibility/opacity.
let _boardsEnabled = true;
let _activeDynasty = '';

export function setLineBoardsEnabled(on) { _boardsEnabled = !!on; }
export function getLineBoardsEnabled() { return _boardsEnabled; }
export function setLineBoardsDynasty(dyn) { _activeDynasty = dyn || ''; }

// ═══════════════════════════════════════
// 文字 → canvas (竖写楹联风格). 2× 超采样 + Ma Shan Zheng 字体保持全局一致
// ═══════════════════════════════════════
function mkBoardTex(line, boardSize = 1.0) {
  // 句子用 "·" 分两半; 没有 · 就当单列
  const parts = line.split(' · ');
  const cols = parts.length;
  const colChars = parts.map(p => p.split(''));
  const maxCharsPerCol = Math.max(...colChars.map(c => c.length));

  // 逻辑尺寸 (绘制用)
  const FONT_PX = 34;
  const COL_GAP = 18;
  const PAD_X = 18, PAD_Y = 16;
  const colW = FONT_PX + 6;
  const Wl = Math.ceil(PAD_X * 2 + cols * colW + (cols - 1) * COL_GAP);
  const Hl = Math.ceil(PAD_Y * 2 + maxCharsPerCol * (FONT_PX + 2));

  // 2× 超采样 canvas, sprite 放大后依然锐利 (也兼容 HiDPI 屏)
  const SS = 2;
  const c = document.createElement('canvas');
  c.width = Wl * SS; c.height = Hl * SS;
  const cx = c.getContext('2d');
  cx.scale(SS, SS);

  // 宣纸底 — 半透明米色, 四角微暗 (木匾感)
  const bg = cx.createLinearGradient(0, 0, 0, Hl);
  bg.addColorStop(0,   'rgba(247,232,198,0.88)');
  bg.addColorStop(0.5, 'rgba(238,220,180,0.88)');
  bg.addColorStop(1,   'rgba(230,210,170,0.88)');
  cx.fillStyle = bg;
  cx.fillRect(0, 0, Wl, Hl);

  // 边框 — 深褐色细线, 内外两层
  cx.strokeStyle = 'rgba(80,45,15,0.75)';
  cx.lineWidth = 2;
  cx.strokeRect(3, 3, Wl - 6, Hl - 6);
  cx.strokeStyle = 'rgba(120,75,30,0.45)';
  cx.lineWidth = 1;
  cx.strokeRect(8, 8, Wl - 16, Hl - 16);

  // 竖写文字 — 和 .loc-n / .rlb 共用 Ma Shan Zheng, 保持全场一致感
  cx.fillStyle = '#2a1408';
  cx.font = `700 ${FONT_PX}px "Ma Shan Zheng","ZCOOL XiaoWei","Noto Serif SC",serif`;
  cx.textAlign = 'center';
  cx.textBaseline = 'top';
  colChars.forEach((chars, colIdx) => {
    // 右列先: 传统楹联右起
    const colPos = (cols - 1 - colIdx);
    const x = PAD_X + colPos * (colW + COL_GAP) + colW / 2;
    chars.forEach((ch, chIdx) => {
      const y = PAD_Y + chIdx * (FONT_PX + 2);
      cx.fillText(ch, x, y);
    });
  });

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;  // 2× 采样已足够, 不需要 mipmap
  tex.needsUpdate = true;
  // 记录 aspect 给 sprite scale 用
  tex.userData = { aspect: Wl / Hl, baseSize: boardSize };
  return tex;
}

// ═══════════════════════════════════════
// 构建所有立牌
// ═══════════════════════════════════════
export function buildLineBoards(locations, pos3D, scene) {
  FAMOUS_LINES.forEach(entry => {
    const idx = locations.findIndex(l => l.n === entry.city);
    if (idx < 0) return;   // 城市不在 60 个 location 里, 跳过
    const p = pos3D[idx];
    const tex = mkBoardTex(entry.line, entry.boardSize);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,                // 远处不吃 fog, 只靠 distance fade 控制可见性
    });
    const sp = new THREE.Sprite(mat);
    sp.center = new THREE.Vector2(0.5, 0);
    const aspect = tex.userData.aspect;
    const baseH = 3.6 * (entry.boardSize || 1.0);
    sp.scale.set(baseH * aspect, baseH, 1);
    // 位置: 城市上方, 带一点随机偏移, 避免和 label 完全重叠
    const yOff = entry.yOff || 4.0;
    sp.position.set(p.x, p.y + yOff, p.z);
    sp.renderOrder = 14;
    // 位置永久锁死, 关 matrixAutoUpdate 省每帧 compose()
    sp.matrixAutoUpdate = false; sp.updateMatrix();
    sp.userData = {
      line: entry.line, city: entry.city, dyn: entry.dyn, author: entry.author,
      anchorIdx: idx,
    };
    scene.add(sp);
    lineBoards.push(sp);
  });
  return lineBoards;
}

// 每帧: 根据 camera 到 anchor 的距离 + 全局开关 + 朝代滤镜 算最终 opacity
const _camPos = new THREE.Vector3();
export function updateLineBoards(camera, pos3D) {
  if (lineBoards.length === 0) return;
  camera.getWorldPosition(_camPos);
  for (let i = 0; i < lineBoards.length; i++) {
    const sp = lineBoards[i];
    const anchor = pos3D[sp.userData.anchorIdx];
    if (!anchor) continue;
    // 全局隐 → 直接灭
    if (!_boardsEnabled) {
      sp.material.opacity = 0;
      sp.visible = false;
      continue;
    }
    // 朝代滤镜不匹配 → 灭
    if (_activeDynasty && sp.userData.dyn !== _activeDynasty) {
      sp.material.opacity = 0;
      sp.visible = false;
      continue;
    }
    // 距离淡入/淡出
    const d = _camPos.distanceTo(anchor);
    let op = 0;
    if (d < FADE_IN_NEAR) op = 1;
    else if (d < FADE_OUT_FAR) op = 1 - (d - FADE_IN_NEAR) / (FADE_OUT_FAR - FADE_IN_NEAR);
    sp.material.opacity = op;
    sp.visible = op > 0.02;
  }
}
