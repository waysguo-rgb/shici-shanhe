// 三层山水"远景"层 — 在 DEM 真实地形外围加几层水墨远山 plane,
// 让画面有"画卷尽头"而不是"地形末端"的感觉.
//
// 当前用 CanvasTexture 程序生成水墨远山轮廓 (作占位).
// 用户后续提供 distant_mountains.png 后, 调 setDistantMountainTexture(tex) 一键替换.
import * as THREE from 'three';

let _layers = [];
let _curTex = null;

// ─── Canvas 程序生成水墨远山轮廓 (占位贴图) ───
// 4 层不同深度的山脊, 黑墨在透明背景上. 顶部留白让其溶入雾.
function makeProceduralMountainTex(seed = 0) {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // 透明背景
  ctx.clearRect(0, 0, W, H);
  // 4 层山脊: 远→近 透明度递增, 高度递增
  const layers = [
    { yBase: H * 0.55, amp: 28,  step: 110, alpha: 0.18, color: '#4a3520' },
    { yBase: H * 0.65, amp: 38,  step: 90,  alpha: 0.30, color: '#3a2818' },
    { yBase: H * 0.75, amp: 52,  step: 70,  alpha: 0.50, color: '#2a1a08' },
    { yBase: H * 0.86, amp: 38,  step: 60,  alpha: 0.75, color: '#1a0c04' },
  ];
  // pseudo-random with seed
  let rng = seed * 9301 + 49297;
  const r = () => { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; };
  layers.forEach(({ yBase, amp, step, alpha, color }) => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    let y = yBase;
    for (let x = 0; x <= W; x += step) {
      // 山头位置: 在 yBase 附近 sin + 随机扰动, 取 min 形成尖
      const peak = yBase - amp * (0.5 + r() * 0.5);
      const ctrlX = x - step / 2;
      const ctrlY = y;
      ctx.quadraticCurveTo(ctrlX, ctrlY, x, peak);
      y = peak;
      // 下行 valley
      x += step / 2;
      const valley = yBase + amp * 0.3 * r();
      ctx.quadraticCurveTo(x - step / 4, peak, x, valley);
      y = valley;
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ─── 创建一个远山 plane 层 ───
// pos: 远景中心位置 (Vector3)
// face: 朝哪个方向 (Vector3, 朝向相机方向)
// w/h: plane 大小, opacity: 整体透明度
function makeMountainBand(scene, pos, face, w, h, opacity, repeat = 1) {
  const tex = _curTex || makeProceduralMountainTex(Math.random() * 100);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: true,
  });
  if (repeat !== 1) {
    // clone tex to avoid sharing repeat
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = repeat;
    t.needsUpdate = true;
    mat.map = t;
  }
  const geo = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos);
  m.lookAt(face);
  m.renderOrder = -10;   // 远景最先渲染
  // 远山位置/朝向永久锁死, 关 matrixAutoUpdate 省每帧重算
  m.matrixAutoUpdate = false; m.updateMatrix();
  scene.add(m);
  _layers.push(m);
  return m;
}

// ─── 入口: 4 层远山布在地图四周远端 ───
// terrain center 大约 (8, 0, 0); PW=130 PH=90 → 远景放 z=±100, x=±90
export function addDistantMountains(scene) {
  // 北侧远山 (z 负方向, 最远)
  makeMountainBand(scene, new THREE.Vector3(8,  6,  -110), new THREE.Vector3(8, 6, 0), 280, 50, 0.65, 1.5);
  // 南侧远山 (z 正方向)
  makeMountainBand(scene, new THREE.Vector3(8,  6,   110), new THREE.Vector3(8, 6, 0), 280, 50, 0.55, 1.5);
  // 西侧远山
  makeMountainBand(scene, new THREE.Vector3(-100, 6,  0),  new THREE.Vector3(0, 6, 0), 240, 45, 0.50, 1.4);
  // 东侧 (海面方向, 透明度低让海更敞亮)
  makeMountainBand(scene, new THREE.Vector3( 130, 6,  0),  new THREE.Vector3(0, 6, 0), 240, 40, 0.30, 1.4);
}

// ─── 一键替换贴图 (用户提供 distant_mountains.png 后调用) ───
// path: '/assets/textures/distant_mountains.png' 或 THREE.Texture 实例
export function setDistantMountainTexture(pathOrTex) {
  const apply = (tex) => {
    _curTex = tex;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    _layers.forEach(m => {
      const oldMap = m.material.map;
      const repeatX = oldMap?.repeat?.x || 1;
      const t = tex.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = repeatX;
      t.needsUpdate = true;
      m.material.map = t;
      m.material.needsUpdate = true;
    });
  };
  if (typeof pathOrTex === 'string') {
    new THREE.TextureLoader().load(pathOrTex, apply);
  } else if (pathOrTex && pathOrTex.isTexture) {
    apply(pathOrTex);
  }
}

// 简洁模式开关 (与现有 setSimpleMode 联动, 隐藏远山)
export function setDistantMountainsVisible(on) {
  _layers.forEach(m => { m.visible = !!on });
}
