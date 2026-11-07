import { useFrame } from "@react-three/fiber";
import type { Material, MeshPhysicalMaterial, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from "three";

export type SurfaceKind = "metal" | "organic" | "fabric";

export const surfaceTime = { value: 0 };

/** Drives the slow vein pulse on living surfaces. Mount once inside the Canvas. */
export function SurfaceClock() {
  useFrame((s) => {
    surfaceTime.value = s.clock.elapsedTime;
  });
  return null;
}

const COMMON = /* glsl */ `
varying vec3 vDPos;
varying vec3 vDNrm;
uniform float uSurfT;
float dHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float dNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dHash(i), dHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(dHash(i + vec3(0.0, 1.0, 0.0)), dHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(dHash(i + vec3(0.0, 0.0, 1.0)), dHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(dHash(i + vec3(0.0, 1.0, 1.0)), dHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}
float dFade(float freq, float fw) {
  return 1.0 - smoothstep(0.18, 0.55, fw * freq);
}
float dFbmA(vec3 p, float freq, float fw) {
  return dNoise(p) * 0.55 + dNoise(p * 2.07 + 3.3) * 0.3 * dFade(freq * 2.07, fw) + dNoise(p * 4.13 + 7.1) * 0.15 * dFade(freq * 4.13, fw);
}
vec3 dPerturb(vec3 surfPos, vec3 n, vec2 dH, float strength) {
  vec3 dpdx = dFdx(surfPos);
  vec3 dpdy = dFdy(surfPos);
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 g = sign(det) * (dH.x * r1 + dH.y * r2) * strength;
  return normalize(abs(det) * n - g);
}
`;

const PLANAR = /* glsl */ `
  vec3 dp = vDPos;
  vec3 dan = abs(vDNrm);
  vec2 duv = (dan.x > dan.y && dan.x > dan.z) ? dp.yz : (dan.y > dan.z ? dp.xz : dp.xy);
  float dFw = length(fwidth(dp));
  float dH = 0.0;
  float dVein = 0.0;
  float dSeam = 0.0;
  float dWear = 0.5;
  float dMott2 = 0.5;
`;

const COLOR: Record<SurfaceKind, string> = {
  metal: /* glsl */ `
    vec2 dcell = duv * 5.0;
    vec2 dcid = floor(dcell);
    vec2 dg = abs(fract(dcell) - 0.5);
    dSeam = smoothstep(0.42, 0.49, max(dg.x, dg.y));
    float dSeamF = dFade(70.0, dFw);
    dSeam *= dSeamF;
    float dRivet = (1.0 - smoothstep(0.03, 0.07, length(dg - vec2(0.4)))) * dFade(70.0, dFw);
    float dAxis = (dan.x > dan.y && dan.x > dan.z) ? 0.0 : (dan.y > dan.z ? 1.0 : 2.0);
    float dPan = (dHash(vec3(dcid, dAxis)) - 0.5) * dFade(10.0, dFw);
    dWear = dFbmA(dp * 9.0 + 3.1, 9.0, dFw);
    float dBrush = dNoise(vec3(duv.x * 70.0, duv.y * 3.0, 1.0)) * dFade(70.0, dFw) + 0.5 * (1.0 - dFade(70.0, dFw));
    dH = (-dSeam * 0.9 + dRivet * 0.7 + dPan * 0.2 + (dBrush - 0.5) * 0.1 + (dWear - 0.5) * 0.25) * 0.006;
    diffuseColor.rgb *= (0.74 + dWear * 0.5) * (1.0 - dSeam * 0.45) * (1.0 + dRivet * 0.25) * (0.94 + dPan * 0.2);
  `,
  organic: /* glsl */ `
    float dMott = dFbmA(dp * 7.0, 7.0, dFw);
    dMott2 = dFbmA(dp * 21.0 + 7.0, 21.0, dFw);
    float dRidge = 1.0 - abs(2.0 * dNoise(dp * 10.0 + 1.7) - 1.0);
    dVein = smoothstep(0.86, 0.97, dRidge) * smoothstep(0.3, 0.7, dNoise(dp * 3.0)) * dFade(40.0, dFw);
    float dPore = smoothstep(0.72, 0.9, dNoise(dp * 48.0)) * dFade(96.0, dFw);
    dH = (dMott + dMott2 * 0.5 - dPore * 0.7 - dVein * 0.4) * 0.005;
    diffuseColor.rgb *= (0.68 + dMott * 0.66) * (1.0 - dPore * 0.24) * (1.0 - dVein * 0.18);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.0, 0.86), dMott2 * 0.5);
  `,
  fabric: /* glsl */ `
    vec2 dw = duv * 64.0;
    float dWeave = 0.5 + 0.5 * sin(dw.x * 6.2831) * sin(dw.y * 6.2831) * dFade(128.0, dFw);
    float dMottF = dFbmA(dp * 6.0, 6.0, dFw);
    dH = (dWeave * 0.3 + (dMottF - 0.5) * 0.3) * 0.003;
    diffuseColor.rgb *= (0.8 + dMottF * 0.4) * (0.9 + 0.1 * dWeave);
  `,
};

const ROUGH: Record<SurfaceKind, string> = {
  metal: `roughnessFactor = clamp(roughnessFactor + (dWear - 0.5) * 0.4 + dSeam * 0.25, 0.1, 1.0);`,
  organic: `roughnessFactor = clamp(roughnessFactor * (0.75 + dMott2 * 0.55), 0.12, 1.0);`,
  fabric: `roughnessFactor = clamp(roughnessFactor + 0.06, 0.1, 1.0);`,
};

const EMISSIVE: Record<SurfaceKind, string> = {
  metal: "",
  organic: /* glsl */ `
    vec3 dHue = diffuseColor.rgb / max(max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), 0.001);
    float dPulse = 0.65 + 0.35 * sin(uSurfT * 1.8 + dp.x * 14.0 + dp.z * 9.0);
    totalEmissiveRadiance += dHue * dHue * dVein * 0.5 * dPulse;
    float dRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += dHue * dHue * dRim * 0.14;
  `,
  fabric: "",
};

const BUMP: Record<SurfaceKind, string> = {
  metal: "0.8",
  organic: "0.9",
  fabric: "0.6",
};

function makePatch(kind: SurfaceKind) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSurfT = surfaceTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vDPos;\nvarying vec3 vDNrm;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvDPos = position;\nvDNrm = normal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${COMMON}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${PLANAR}\n${COLOR[kind]}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\n${ROUGH[kind]}`)
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\nnormal = dPerturb(-vViewPosition, normal, vec2(dFdx(dH), dFdy(dH)), ${BUMP[kind]});`,
      )
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${EMISSIVE[kind]}`);
  };
}

export const SURFACE_PATCH: Record<SurfaceKind, (shader: WebGLProgramParametersWithUniforms) => void> = {
  metal: makePatch("metal"),
  organic: makePatch("organic"),
  fabric: makePatch("fabric"),
};

export const SURFACE_KEY: Record<SurfaceKind, () => string> = {
  metal: () => "surface-metal",
  organic: () => "surface-organic",
  fabric: () => "surface-fabric",
};

/** For materials built in code rather than JSX. */
export function detailize<T extends MeshStandardMaterial | MeshPhysicalMaterial>(m: T, kind: SurfaceKind): T {
  const mat = m as Material & { onBeforeCompile: unknown; customProgramCacheKey: () => string };
  mat.onBeforeCompile = SURFACE_PATCH[kind];
  mat.customProgramCacheKey = SURFACE_KEY[kind];
  m.needsUpdate = true;
  return m;
}
