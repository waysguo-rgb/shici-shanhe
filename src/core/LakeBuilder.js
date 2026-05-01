// Lake mesh generation
//
// 边界柔化实现说明:
//   之前的做法是把 radial alpha fade 烘进贴图, 再用 RepeatWrapping(2×2) 平铺,
//   结果 fade 被切成了一格格 disconnected 圆点 (湖面看起来就变成一堆蓝点).
//   现在:
//     1) mkLakeTex 只保留水面纹理, 不再烘 alpha fade
//     2) 这里用 ShaderMaterial, 把多边形的"边"作为 uniform 数组传进片元
//     3) 片元按世界 XZ 坐标现算到最近边的距离 (SDF), smoothstep 做柔化
//   这样无论湖的形状多怪 (鄱阳湖的葫芦形, 西湖的不规则), 都只在"真正的湖缘"一圈
//   有柔化, 内部完全不透. ShapeGeometry 的顶点都落在边界上, 做 per-vertex
//   edgeDist 会全是 0 → 整片湖被 fade 吃掉, 所以只能在片元里现算.
import * as THREE from 'three';
import { ll2s } from './helpers.js';
import { hAtMax } from './TerrainBuilder.js';
import { mkLakeTex } from './textures.js';

export const lakeMeshes = [];
export const lakeLabels = []; // {el, pos:Vector3, name}

// 多边形上限 — 真实数据里所有湖最多 ~20 边, 32 足够留余量.
const MAX_EDGES = 32;

const LAKE_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec2 vWorldXZ;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LAKE_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec2  uOffset;
  uniform float uOpacity;
  uniform float uFadeWidth;
  // 每条边存成 vec4: (ax, az, bx, bz). 未用的尾部填 0.
  uniform vec4  uEdges[${MAX_EDGES}];
  uniform int   uEdgeCount;
  varying vec2 vUv;
  varying vec2 vWorldXZ;

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    vec2 pa = p - a;
    float lenSq = dot(ba, ba);
    float h = lenSq > 1e-9 ? clamp(dot(pa, ba) / lenSq, 0.0, 1.0) : 0.0;
    return length(pa - ba * h);
  }

  void main() {
    // repeat 2×2 手动在 UV 上体现 (ShaderMaterial 不读 texture.repeat)
    vec2 uv = vUv * 2.0 + uOffset;
    vec4 col = texture2D(uMap, uv);

    // 到最近边的距离 (SDF, 只求距离不求符号 — 顶点已经保证在多边形内侧)
    float minD = 1e10;
    for (int i = 0; i < ${MAX_EDGES}; i++) {
      if (i >= uEdgeCount) break;
      vec4 e = uEdges[i];
      float d = segDist(vWorldXZ, e.xy, e.zw);
      if (d < minD) minD = d;
    }
    float edgeA = smoothstep(0.0, uFadeWidth, minD);

    gl_FragColor = vec4(col.rgb, col.a * edgeA * uOpacity);
  }
`;

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

  // Build edges uniform array (vec4 per edge: a.xz, b.xz).
  const edgeVec = [];
  for (let i = 0; i < MAX_EDGES; i++) {
    if (i < worldPts.length) {
      const j = (i + 1) % worldPts.length;
      edgeVec.push(new THREE.Vector4(worldPts[i][0], worldPts[i][1], worldPts[j][0], worldPts[j][1]));
    } else {
      edgeVec.push(new THREE.Vector4(0, 0, 0, 0));
    }
  }

  // Fade width proportional to the lake's shorter bbox span — 大湖柔和,
  // 小湖 (西湖) 不会被吃掉.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  worldPts.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  });
  const bboxMin = Math.min(maxX - minX, maxY - minY);
  const fadeWidth = Math.max(0.1, bboxMin * 0.12);

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
  const mat = new THREE.ShaderMaterial({
    vertexShader: LAKE_VERT,
    fragmentShader: LAKE_FRAG,
    uniforms: {
      uMap:       { value: tex },
      uOffset:    { value: new THREE.Vector2(0, 0) },
      uOpacity:   { value: 0.78 },
      uFadeWidth: { value: fadeWidth },
      uEdges:     { value: edgeVec },
      uEdgeCount: { value: worldPts.length },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = lakeY;
  mesh.renderOrder = 10;
  // bbox 近似半径 — 给花瓣落湖碰撞检测用 (粗略点对点)
  const bx = (maxX - minX) * 0.5;
  const by = (maxY - minY) * 0.5;
  const approxRadius = Math.max(bx, by) * 0.85;     // 缩一点避免把湖缘水汽也算成湖面
  mesh.userData = {
    name: lake.n,
    center: new THREE.Vector3(cx, lakeY, cz),
    approxRadius,
    surfaceY: lakeY,
    phase: Math.random() * 6.28,
    tex: tex,
    driftX: 0.008 + Math.random() * 0.008,
    driftZ: 0.004 + Math.random() * 0.006,
  };
  lakeMeshes.push(mesh);
  return mesh;
}

// ═══════════════════════════════════════
// Lake mask texture — 给河流 shader 用的. 把所有湖多边形填成白色并轻微模糊, 河流
// 片元可以按世界 XZ 坐标采样这张 mask 判断"我在不在湖里", 在里面就淡出, 不在就正常
// 渲染. 模糊让边界过渡柔和, 河流驶入湖面时逐渐融入, 驶出时逐渐浮现.
//
// 输入: LAKES 原始数据数组 (每项有 pts = [[lon, lat], ...])
// 输出: { texture, boundsMin: Vector2, boundsMax: Vector2 }  —  片元可据此反投
//       世界 XZ → UV: uv = (worldXZ - boundsMin) / (boundsMax - boundsMin)
// ═══════════════════════════════════════
export function buildLakeMask(lakesData, bounds = { minX: -85, maxX: 90, minZ: -48, maxZ: 48 }) {
  const W = bounds.maxX - bounds.minX;
  const H = bounds.maxZ - bounds.minZ;
  const TEX_W = 512;
  const TEX_H = Math.max(64, Math.round(TEX_W * H / W));

  // 1) 画尖锐多边形 (源 canvas)
  const src = document.createElement('canvas');
  src.width = TEX_W; src.height = TEX_H;
  const sx = src.getContext('2d');
  sx.fillStyle = '#000';
  sx.fillRect(0, 0, TEX_W, TEX_H);
  sx.fillStyle = '#fff';
  lakesData.forEach(lake => {
    sx.beginPath();
    lake.pts.forEach(([lo, la], i) => {
      const [wx, wz] = ll2s(lo, la);
      const u = (wx - bounds.minX) / W;
      const v = (wz - bounds.minZ) / H;
      const px = u * TEX_W;
      const py = v * TEX_H;
      if (i === 0) sx.moveTo(px, py);
      else sx.lineTo(px, py);
    });
    sx.closePath();
    sx.fill();
  });

  // 2) 复制到目标 canvas + 模糊 (CSS filter on 2D context) — 约 4-5 px 羽化带,
  //    换算成世界单位 ~= 1.5 units, 和 LakeBuilder 里 bboxMin × 0.12 的湖缘 fade
  //    带宽接近, 河流淡出和湖泊淡入同一个过渡带, 看起来水体是连续的.
  const dst = document.createElement('canvas');
  dst.width = TEX_W; dst.height = TEX_H;
  const dx = dst.getContext('2d');
  dx.filter = 'blur(5px)';
  dx.drawImage(src, 0, 0);
  dx.filter = 'none';

  const tex = new THREE.CanvasTexture(dst);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  // CanvasTexture 默认 flipY=true (上传时翻 Y). 但我们在 shader 里用 UV.y = (worldZ - minZ)/span
  // 直接匹配 canvas 的 y 坐标 (北在顶, ll2s 的 z=-(la-CA)*SY), 不能再翻一次 → 关掉 flipY,
  // 否则湖内采样会采到湖外像素, mask 恒为 0, 河流根本没被淡出.
  tex.flipY = false;
  tex.needsUpdate = true;

  return {
    texture: tex,
    boundsMin: new THREE.Vector2(bounds.minX, bounds.minZ),
    boundsMax: new THREE.Vector2(bounds.maxX, bounds.maxZ),
  };
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
