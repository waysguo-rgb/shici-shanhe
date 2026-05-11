// Ink-wash / rice-paper post-processing pass.
// Takes the composed rendered image and gives it the tone of a classical
// Chinese scroll painting:
//   1. Xuan-paper fiber grain (coarse + fine layers, position-stable)
//   2. Soft warm tint bias toward sepia gold
//   3. Gentle desaturation toward luminance (limits oversaturated greens/blues)
//   4. Scroll-edge vignette (darker toward corners, like an aged unrolled scroll)
//   5. Slight bottom-edge ink-damp stain (the tactile "touched the paper" feel)
//
// Philosophy: every effect is dialed low. The goal is a coherent mood, not
// obvious filters. If you notice any single effect by itself, turn it down.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// 1×1 灰度占位贴图: 真贴图加载完成前 sampler 不为 null, 且对画面零影响.
//   level=0.50 → grain offset = (0.5 - 0.5) = 0
//   level=0.60 → brush mix(1, 0.7+0.6*0.5=1.0, strength) = 1 不变
//   level=0.00 → ink_bleed mask = 0, 不施加扩散
function _placeholderTex(level) {
  const v = Math.round(level * 255);
  const t = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

const InkWashShader = {
  uniforms: {
    tDiffuse:       { value: null },
    uRes:           { value: new THREE.Vector2(1, 1) },
    // 水墨感强化 (不动边缘墨线阈值/强度, 避免回到"脏"的状态).
    uPaperStrength: { value: 0.115 },  // 宣纸纤维更可辨 (0.085 → 0.115)
    uWarmth:        { value: 0.14  },  // 暖调更像绢本 (0.10 → 0.14)
    uDesat:         { value: 0.14  },  // 向墨调收窄色阶 (0.10 → 0.14)
    uVignette:      { value: 0.32  },  // 卷轴边缘压暗一点 (0.28 → 0.32)
    // Sobel ink stroke — threshold stays high (only real edges get ink, no
    // noise), but strength is the middle-ground 0.40: visible brushwork on
    // rivers/coastlines/ridges without descending into "dirty" density.
    uEdgeStrength:  { value: 0.40 },
    uEdgeThreshold: { value: 0.20 },
    // === 真水墨贴图 (按 docs/textures-pipeline.md 第 4 节接入) ===
    uPaperTex:        { value: _placeholderTex(0.50) },
    uBrushTex:        { value: _placeholderTex(0.60) },   // pima (披麻皴, 缓坡)
    uBrushFupiTex:    { value: _placeholderTex(0.60) },   // fupi (斧劈皴, 陡坡)
    uInkBleedTex:     { value: _placeholderTex(0.00) },
    uMistTex:         { value: _placeholderTex(0.00) },   // 雾(屏幕空间叠加, 占位 0=不施加)
    uPaperScale:      { value: 2.5 },
    uBrushScale:      { value: 6.0 },
    uBrushFupiScale:  { value: 6.0 },
    uInkBleedScale:   { value: 3.0 },
    uMistScale:       { value: 1.2 },                     // 偏大尺度, 避免可见 tiling
    uBrushStrength:   { value: 0.15 },                    // 0.45 → 0.25 → 0.15 (再轻)
    uInkBleedStrength:{ value: 0.18 },
    uMistStrength:    { value: 0.10 }                     // 雾很轻; 太重就调 0.05
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2  uRes;
    uniform float uPaperStrength;
    uniform float uWarmth;
    uniform float uDesat;
    uniform float uVignette;
    uniform float uEdgeStrength;
    uniform float uEdgeThreshold;
    uniform sampler2D uPaperTex;
    uniform sampler2D uBrushTex;
    uniform sampler2D uBrushFupiTex;
    uniform sampler2D uInkBleedTex;
    uniform sampler2D uMistTex;
    uniform float uPaperScale;
    uniform float uBrushScale;
    uniform float uBrushFupiScale;
    uniform float uInkBleedScale;
    uniform float uMistScale;
    uniform float uBrushStrength;
    uniform float uInkBleedStrength;
    uniform float uMistStrength;
    varying vec2 vUv;

    // Luminance helper
    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    // Position-stable value noise so grain doesn't shimmer between frames.
    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix( mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),
                  mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);

      // 0. Sobel ink stroke — edge detect on luminance, darken strong edges.
      // Sampling 8 neighbors with 1-pixel offsets gives us a 3x3 Sobel kernel.
      vec2 px = 1.0 / uRes;
      float l00 = lum(texture2D(tDiffuse, vUv + px * vec2(-1.0, -1.0)).rgb);
      float l10 = lum(texture2D(tDiffuse, vUv + px * vec2( 0.0, -1.0)).rgb);
      float l20 = lum(texture2D(tDiffuse, vUv + px * vec2( 1.0, -1.0)).rgb);
      float l01 = lum(texture2D(tDiffuse, vUv + px * vec2(-1.0,  0.0)).rgb);
      float l21 = lum(texture2D(tDiffuse, vUv + px * vec2( 1.0,  0.0)).rgb);
      float l02 = lum(texture2D(tDiffuse, vUv + px * vec2(-1.0,  1.0)).rgb);
      float l12 = lum(texture2D(tDiffuse, vUv + px * vec2( 0.0,  1.0)).rgb);
      float l22 = lum(texture2D(tDiffuse, vUv + px * vec2( 1.0,  1.0)).rgb);
      float gx = (l20 + 2.0*l21 + l22) - (l00 + 2.0*l01 + l02);
      float gy = (l02 + 2.0*l12 + l22) - (l00 + 2.0*l10 + l20);
      float edge = sqrt(gx*gx + gy*gy);
      // Ramp of 0.25 — soft enough to avoid hard edges, narrow enough so
      // inking reaches full effect on genuine ridges/rivers.
      float ink  = smoothstep(uEdgeThreshold, uEdgeThreshold + 0.25, edge) * uEdgeStrength;
      // Multiply darken 0.70 (darker than last round's 0.55 but still below
      // original 0.85). Warm tea ink at 0.15 mix.
      col.rgb *= (1.0 - ink * 0.70);
      col.rgb = mix(col.rgb, vec3(0.20, 0.14, 0.09), ink * 0.15);

      // 1. Xuan paper fiber — 真贴图主纹 + 高频细斑补偿 (按 docs T1)
      vec3  paperRgb  = texture2D(uPaperTex, vUv * uPaperScale).rgb;
      float paperBase = paperRgb.r - 0.5;                          // 主纹 (-0.5..+0.5)
      float fineSpec  = hash(vUv * uRes) - 0.5;                    // 高频细斑
      float grain     = paperBase * 0.85 + fineSpec * 0.15;
      col.rgb += grain * uPaperStrength;

      // 1.5 Brush stroke — pima (缓坡) / fupi (陡坡) 按 luma 近似坡度做 mix
      // 后处理 pass 拿不到 3D 坡度, luma 最低成本的代理: 暗区(阴影=背光面=陡)用 fupi,
      // 亮区(受光=平/远)用 pima. smoothstep 平滑过渡, 避免硬切.
      float pimaSample  = texture2D(uBrushTex,     vUv * uBrushScale).r;
      float fupiSample  = texture2D(uBrushFupiTex, vUv * uBrushFupiScale).r;
      float brushLuma   = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      float slopeMask   = smoothstep(0.40, 0.18, brushLuma);   // 0=亮(平) → 1=暗(陡)
      float brushSample = mix(pimaSample, fupiSample, slopeMask);
      col.rgb *= mix(1.0, 0.7 + brushSample * 0.5, uBrushStrength);

      // 1.7 Ink bleed — 扩散区域拉向陈旧墨色 (按 docs T3)
      float inkBleed = texture2D(uInkBleedTex, vUv * uInkBleedScale).r;
      col.rgb = mix(col.rgb, vec3(0.10, 0.08, 0.07), inkBleed * uInkBleedStrength);

      // 1.8 Mist overlay — 屏幕空间雾叠加, 上半屏更显, 模拟"天边溶进宣纸"
      float mistSample = texture2D(uMistTex, vUv * uMistScale).r;
      float mistVGrad  = smoothstep(0.0, 0.55, vUv.y);   // 0=底=清晰, 1=顶=雾浓
      col.rgb = mix(col.rgb, vec3(0.92, 0.90, 0.84), mistSample * uMistStrength * mistVGrad);

      // 2. Warm bias (gentle sepia wash)
      col.r += uWarmth * 0.06;
      col.g += uWarmth * 0.02;
      col.b -= uWarmth * 0.05;

      // 3. Desaturate toward luminance — brings screaming greens down to ink tones
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(col.rgb, vec3(lum), uDesat);

      // 4. Scroll vignette (soft, not theatrical)
      vec2 ctr = vUv - 0.5;
      // anisotropic — more fade at horizontal edges than vertical, since a
      // hanging scroll is tall and its sides frame in first
      float d = length(vec2(ctr.x * 1.25, ctr.y * 0.95));
      float vig = 1.0 - smoothstep(0.32, 0.78, d) * uVignette;
      col.rgb *= vig;

      // 5. Age damp — tiny darkening right at bottom margin
      float dampEdge = smoothstep(0.93, 1.0, vUv.y) * 0.08;
      col.rgb *= (1.0 - dampEdge);

      gl_FragColor = col;
    }
  `
};

export function makeInkWashPass() {
  return new ShaderPass(InkWashShader);
}

// === stub: SceneManager 仍 import setTone/updateTone (主仓库版有, worktree 版没有).
//     worktree 版 shader 不含 tone uniforms, 所以这里两个函数都做 no-op.
//     效果: 色调使用 worktree 默认 (无运行时切换), 但 SceneManager 调用不会报错.
export function setTone(name, lerpSpeed = 0.04) { /* no-op */ }
export function updateTone(inkWashPass) { /* no-op */ }
