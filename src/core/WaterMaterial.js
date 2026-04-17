// Lightweight stylised water ShaderMaterial.
// Designed to sit as an OVERLAY on top of the existing lake / wave-patch meshes,
// so we keep all current vertex-color tinting + the painterly texture, and just
// add three things on top:
//   1. Fresnel — edges (low incidence) show stronger sky reflection
//   2. Cube-sampled sky reflection (blurred via mipmap)
//   3. Animated procedural normal noise → shimmering highlights
//
// The material is additive+transparent, so it NEVER darkens the underlying
// lake color — only adds sparkle.
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform samplerCube uSky;
  uniform vec3  uCamPos;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3  uTint;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  // Cheap 2D hash noise
  float hash(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    // Two drifting noise layers → ripple normal perturbation
    vec2 uv = vWorldPos.xz * 1.2;
    float n1 = vnoise(uv + vec2(uTime * 0.09, uTime * 0.06));
    float n2 = vnoise(uv * 2.3 + vec2(-uTime * 0.05, uTime * 0.11));
    float ripple = (n1 + n2 * 0.5) - 0.75;
    vec3 N = normalize(vWorldNormal + vec3(ripple * 0.18, 0.0, ripple * 0.15));

    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 R = reflect(-V, N);
    // Mip-biased cube lookup gives soft sky reflection
    vec3 skyCol = textureCube(uSky, R, 3.0).rgb;

    // Schlick Fresnel — F0 for water ~0.02
    float cosTheta = clamp(dot(V, N), 0.0, 1.0);
    float fres = 0.02 + (1.0 - 0.02) * pow(1.0 - cosTheta, 5.0);

    // Tiny specular sparkle from high-frequency noise
    float spark = smoothstep(0.82, 0.98, vnoise(uv * 7.0 + uTime * 0.2));

    vec3 col = skyCol * fres + uTint * spark * 0.35;
    float alpha = clamp(fres * 0.85 + spark * 0.4, 0.0, 0.95) * uIntensity;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function makeWaterMaterial(skyCube, { tint = new THREE.Color(0xaac7e6), intensity = 1.0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSky:       { value: skyCube },
      uCamPos:    { value: new THREE.Vector3() },
      uTime:      { value: 0 },
      uIntensity: { value: intensity },
      uTint:      { value: tint }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

// Track all water materials so the render loop can tick their uTime uniform.
export const waterMaterials = [];
