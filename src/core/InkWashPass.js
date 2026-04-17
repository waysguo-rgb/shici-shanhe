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

const InkWashShader = {
  uniforms: {
    tDiffuse:       { value: null },
    uRes:           { value: new THREE.Vector2(1, 1) },
    uPaperStrength: { value: 0.085 },
    uWarmth:        { value: 0.10  },
    uDesat:         { value: 0.10  },
    uVignette:      { value: 0.28  },
    // Sobel ink stroke — only the strongest edges get a whisper of ink.
    // Raised threshold from 0.09 → 0.22 (most mid-contrast noise skipped) and
    // dropped strength from 0.55 → 0.22 so the line is suggested, not drawn.
    uEdgeStrength:  { value: 0.22 },
    uEdgeThreshold: { value: 0.22 }
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
      // Wider ramp (0.22 → 0.22+0.30) so the ink fades in gently — no hard edge.
      float ink  = smoothstep(uEdgeThreshold, uEdgeThreshold + 0.30, edge) * uEdgeStrength;
      // Gentle multiply darken (was 0.85 → 0.55) + warmer ink (was cold sumi
      // 0.08/0.05/0.03 → warm tea 0.22/0.16/0.10) to avoid the "dirty" look.
      col.rgb *= (1.0 - ink * 0.55);
      col.rgb = mix(col.rgb, vec3(0.22, 0.16, 0.10), ink * 0.12);

      // 1. Xuan paper fiber (coarse undulation + fine speckle)
      vec2 p   = vUv * uRes;
      float coarse = vnoise(p * 0.0016) - 0.5;        // slow, long fibers
      float medium = vnoise(p * 0.012)  - 0.5;         // mid-scale paper pulp
      float fine   = hash(p) - 0.5;                    // fiber speckle
      float grain  = coarse * 0.55 + medium * 0.30 + fine * 0.15;
      col.rgb += grain * uPaperStrength;

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
