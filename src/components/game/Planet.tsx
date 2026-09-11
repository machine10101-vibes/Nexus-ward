import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Vector3, type Mesh, type ShaderMaterial } from "three";
import type { MapId } from "@/game/types";
import { useWorldLibrary } from "./worldArt";

const vert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vWorldN;
varying vec3 vView;
void main() {
  vN = normalize(normalMatrix * normal);
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
uniform sampler2D crustMap;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 atmo;
uniform vec3 sunDir;
uniform float time;
uniform float landBias;
uniform float iceAmt;
uniform float cloudCover;
varying vec3 vN;
varying vec3 vP;
varying vec3 vWorldN;
varying vec3 vView;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float t = 0.0;
  t += noise(p) * a; p *= 2.07; a *= 0.5;
  t += noise(p) * a; p *= 2.03; a *= 0.5;
  t += noise(p) * a; p *= 2.11; a *= 0.5;
  t += noise(p) * a; p *= 2.02; a *= 0.5;
  t += noise(p) * a;
  return t;
}
vec3 triplanar(sampler2D tex, vec3 p, float scale) {
  vec3 n = abs(normalize(p));
  n = pow(n, vec3(3.0));
  n /= (n.x + n.y + n.z + 1e-4);
  return texture2D(tex, p.yz * scale).rgb * n.x
       + texture2D(tex, p.xz * scale).rgb * n.y
       + texture2D(tex, p.xy * scale).rgb * n.z;
}

void main() {
  vec3 pn = normalize(vP);
  vec3 crust = triplanar(crustMap, vP, 0.46);
  crust = crust * 1.42 + 0.02;
  float bump = dot(crust, vec3(0.28, 0.5, 0.22));
  vec3 Nw = normalize(vWorldN + vWorldN * (bump - 0.48) * 0.42);
  vec3 Nv = normalize(vN);
  vec3 V = normalize(vView);
  vec3 L = normalize(sunDir);

  float n = fbm(pn * 2.15 + 0.12);
  n += 0.18 * noise(pn * 9.5);
  float land = smoothstep(landBias, landBias + 0.15, n);
  float coast = smoothstep(landBias - 0.06, landBias + 0.04, n)
              * (1.0 - smoothstep(landBias + 0.08, landBias + 0.22, n));
  float depth = smoothstep(landBias - 0.28, landBias - 0.02, n);
  vec3 deep = colorA * 0.55;
  vec3 shelf = mix(colorA, colorB, 0.55);
  vec3 ocean = mix(deep, shelf, depth);
  ocean += colorC * pow(depth, 3.0) * 0.08;

  vec3 albedo = mix(ocean, crust, land);
  albedo = mix(albedo, mix(colorC, crust, 0.42), coast * 0.55);
  float ice = smoothstep(0.68, 0.9, abs(pn.y)) * iceAmt * (0.55 + land * 0.45);
  albedo = mix(albedo, mix(vec3(0.78, 0.86, 0.92), crust, 0.18), ice);

  float ndl = dot(Nw, L);
  float day = smoothstep(-0.18, 0.42, ndl);
  float dusk = exp(-ndl * ndl * 10.0);
  float wrap = max(ndl * 0.72 + 0.28, 0.0);

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Nw, H), 0.0), 52.0) * (1.0 - land) * day * 0.55;
  spec += pow(max(dot(Nw, H), 0.0), 12.0) * (1.0 - land) * day * 0.08;

  float cld = fbm(pn * 3.1 + vec3(time * 0.018, 0.0, time * 0.012));
  cld = smoothstep(cloudCover - 0.04, cloudCover + 0.18, cld);

  float vein = max(crust.b * 0.8 + crust.g * 0.28 - crust.r * 0.58 - 0.1, 0.0);
  vein = max(vein, max(crust.r * 0.78 + crust.g * 0.22 - crust.b * 0.64 - 0.12, 0.0));

  vec3 lit = albedo * (0.07 + 0.95 * wrap * day);
  lit *= 1.0 - cld * day * 0.28;
  lit += spec * mix(colorC, vec3(0.9, 0.93, 0.98), 0.55);
  lit += colorC * vein * land * mix(0.12, 1.05, 1.0 - day);
  lit += albedo * dusk * 0.12;
  lit += atmo * dusk * 0.16;

  float fres = pow(1.0 - max(dot(Nv, normalize(V)), 0.0), 2.6);
  lit += atmo * fres * (0.14 + day * 0.16 + dusk * 0.32);
  lit += atmo * pow(fres, 3.6) * 0.1;

  gl_FragColor = vec4(lit, 1.0);
}
`;

const cloudFrag = /* glsl */ `
uniform sampler2D skyMap;
uniform vec3 atmo;
uniform vec3 tint;
uniform float time;
uniform float cover;
uniform float opacity;
uniform vec3 sunDir;
varying vec3 vP;
varying vec3 vN;
varying vec3 vWorldN;
varying vec3 vView;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float t = 0.0;
  t += noise(p) * a; p *= 2.07; a *= 0.5;
  t += noise(p) * a; p *= 2.03; a *= 0.5;
  t += noise(p) * a; p *= 2.11; a *= 0.5;
  t += noise(p) * a; p *= 2.02; a *= 0.5;
  t += noise(p) * a;
  return t;
}

void main() {
  vec3 pn = normalize(vP);
  vec3 Nw = normalize(vWorldN);
  vec3 L = normalize(sunDir);
  vec3 V = normalize(vView);
  float n = fbm(pn * 2.55 + vec3(time * 0.022, 0.05, time * 0.014));
  n += 0.28 * noise(pn * 8.4 - vec3(time * 0.03, time * 0.012, 0.0));
  n += 0.08 * noise(pn * 18.0 + time * 0.01);
  float bands = 0.08 * sin(pn.y * 9.0 + n * 4.0 + time * 0.2);
  float mask = smoothstep(cover - 0.02, cover + 0.2, n + bands);
  float heads = smoothstep(cover + 0.1, cover + 0.34, n);
  float ndl = dot(Nw, L);
  float day = smoothstep(-0.16, 0.42, ndl);
  float dusk = exp(-ndl * ndl * 9.0);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 1.7);
  vec2 skyUv = vec2(atan(pn.z, pn.x) * 0.1591549 + 0.5, pn.y * 0.46 + 0.52);
  vec3 sky = texture2D(skyMap, skyUv).rgb;
  vec3 col = mix(vec3(0.78, 0.82, 0.86), tint, 0.55);
  col = mix(col, sky, 0.22);
  col = mix(col, atmo, 0.2);
  float lining = pow(max(ndl, 0.0), 3.4) * heads;
  col += mix(vec3(1.0), atmo, 0.35) * lining * 0.38;
  col = mix(col, atmo * vec3(1.2, 0.78, 0.48), dusk * 0.4);
  col *= 0.55 + day * 0.5;
  float a = mask * opacity * (0.22 + heads * 0.38) * (0.42 + day * 0.58);
  a *= 0.5 + fres * 0.5;
  gl_FragColor = vec4(col, a);
}
`;

const atmoFrag = /* glsl */ `
uniform sampler2D skyMap;
uniform vec3 atmo;
uniform vec3 sunDir;
uniform float density;
uniform float mie;
varying vec3 vN;
varying vec3 vWorldN;
varying vec3 vView;
varying vec3 vP;
void main() {
  vec3 Nv = normalize(vN);
  vec3 Nw = normalize(vWorldN);
  vec3 V = normalize(vView);
  vec3 L = normalize(sunDir);
  vec3 pn = normalize(vP);
  float fres = pow(1.0 - abs(dot(Nv, V)), 2.15);
  float ndl = dot(Nw, L);
  float dusk = exp(-ndl * ndl * 7.2);
  float day = smoothstep(-0.3, 0.38, ndl);
  vec2 skyUv = vec2(atan(pn.z, pn.x) * 0.1591549 + 0.5, pn.y * 0.48 + 0.5);
  vec3 sky = texture2D(skyMap, skyUv).rgb;
  vec3 scatter = mix(atmo * 0.52, atmo * 1.12, day);
  scatter = mix(scatter, sky, 0.42);
  float sunGlow = pow(max(ndl, 0.0), 2.2) * mie;
  float mieLobe = pow(max(dot(reflect(-L, Nw), V), 0.0), 7.0) * mie;
  vec3 col = mix(scatter, atmo * vec3(1.2, 0.8, 0.5), dusk * 0.58);
  col += sky * sunGlow * 0.32;
  col += atmo * mieLobe * 0.5;
  float a = fres * density * (0.4 + dusk * 0.78 + sunGlow * 0.26);
  a *= 0.82 + pow(fres, 2.2) * 0.4;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
}
`;

export const PLANET_PALETTE: Record<MapId, { a: string; b: string; c: string; atmo: string; ring: string }> = {
  mycelion: { a: "#06241c", b: "#1a7a54", c: "#3dcaa0", atmo: "#6ee0b8", ring: "#2a8f6a" },
  forge: { a: "#1c0a06", b: "#7a3a22", c: "#e08848", atmo: "#f09a58", ring: "#c45a28" },
  aegis: { a: "#07141c", b: "#3a6070", c: "#8ec8d0", atmo: "#9ad4dc", ring: "#6aa8b0" },
};

const PALETTE_COLORS = Object.fromEntries(
  (Object.keys(PLANET_PALETTE) as MapId[]).map((id) => {
    const p = PLANET_PALETTE[id];
    return [id, { a: new Color(p.a), b: new Color(p.b), c: new Color(p.c), atmo: new Color(p.atmo) }];
  }),
) as Record<MapId, { a: Color; b: Color; c: Color; atmo: Color }>;

const WORLD_SHAPE: Record<
  MapId,
  { landBias: number; iceAmt: number; cover: number; density: number; halo: number; mie: number; opacity: number }
> = {
  mycelion: { landBias: 0.4, iceAmt: 0.16, cover: 0.58, density: 0.64, halo: 0.36, mie: 1.05, opacity: 0.92 },
  forge: { landBias: 0.34, iceAmt: 0.0, cover: 0.66, density: 0.72, halo: 0.42, mie: 1.35, opacity: 1.05 },
  aegis: { landBias: 0.44, iceAmt: 0.38, cover: 0.5, density: 0.6, halo: 0.4, mie: 0.95, opacity: 0.82 },
};

const CLOUD_TINT: Record<MapId, Color> = {
  mycelion: new Color("#c8f4e4"),
  forge: new Color("#e8b090"),
  aegis: new Color("#d4eef4"),
};

const SUN_DIR = new Vector3(6, 8, 4).normalize();

function applyPalette(
  uniforms: ShaderMaterial["uniforms"],
  cloudUniforms: ShaderMaterial["uniforms"],
  atmoUniforms: ShaderMaterial["uniforms"],
  haloUniforms: ShaderMaterial["uniforms"],
  id: MapId,
  art: ReturnType<typeof useWorldLibrary>[MapId],
) {
  const pal = PALETTE_COLORS[id];
  const shape = WORLD_SHAPE[id];
  // Seamless ground maps only. The *-planet.jpg files are pre-lit portraits of a
  // whole globe on black — triplanar-wrapping those stamps flat planets into the sphere.
  uniforms.crustMap.value = art.ground;
  (uniforms.colorA.value as Color).copy(pal.a);
  (uniforms.colorB.value as Color).copy(pal.b);
  (uniforms.colorC.value as Color).copy(pal.c);
  (uniforms.atmo.value as Color).copy(pal.atmo);
  uniforms.landBias.value = shape.landBias;
  uniforms.iceAmt.value = shape.iceAmt;
  uniforms.cloudCover.value = shape.cover;
  (cloudUniforms.atmo.value as Color).copy(pal.atmo);
  (cloudUniforms.tint.value as Color).copy(CLOUD_TINT[id]);
  cloudUniforms.cover.value = shape.cover;
  cloudUniforms.opacity.value = shape.opacity;
  cloudUniforms.skyMap.value = art.sky;
  (atmoUniforms.atmo.value as Color).copy(pal.atmo);
  atmoUniforms.density.value = shape.density;
  atmoUniforms.mie.value = shape.mie;
  atmoUniforms.skyMap.value = art.sky;
  haloUniforms.density.value = shape.halo;
  haloUniforms.mie.value = shape.mie * 0.7;
  haloUniforms.skyMap.value = art.sky;
}

export function PlanetGlobe({
  id,
  radius = 2.35,
  spin = 0.08,
}: {
  id: MapId;
  radius?: number;
  spin?: number;
}) {
  const lib = useWorldLibrary();
  const planet = useRef<Mesh>(null);
  const clouds = useRef<Mesh>(null);

  const uniforms = useMemo<ShaderMaterial["uniforms"]>(
    () => ({
      crustMap: { value: lib.mycelion.ground },
      colorA: { value: PALETTE_COLORS.mycelion.a.clone() },
      colorB: { value: PALETTE_COLORS.mycelion.b.clone() },
      colorC: { value: PALETTE_COLORS.mycelion.c.clone() },
      atmo: { value: PALETTE_COLORS.mycelion.atmo.clone() },
      sunDir: { value: SUN_DIR.clone() },
      time: { value: 0 },
      landBias: { value: WORLD_SHAPE.mycelion.landBias },
      iceAmt: { value: WORLD_SHAPE.mycelion.iceAmt },
      cloudCover: { value: WORLD_SHAPE.mycelion.cover },
    }),
    [lib.mycelion.ground],
  );

  const cloudUniforms = useMemo<ShaderMaterial["uniforms"]>(
    () => ({
      skyMap: { value: lib.mycelion.sky },
      atmo: { value: PALETTE_COLORS.mycelion.atmo.clone() },
      tint: { value: CLOUD_TINT.mycelion.clone() },
      time: { value: 0 },
      cover: { value: WORLD_SHAPE.mycelion.cover },
      opacity: { value: WORLD_SHAPE.mycelion.opacity },
      sunDir: { value: SUN_DIR.clone() },
    }),
    [lib.mycelion.sky],
  );

  const atmoUniforms = useMemo<ShaderMaterial["uniforms"]>(
    () => ({
      skyMap: { value: lib.mycelion.sky },
      atmo: { value: PALETTE_COLORS.mycelion.atmo.clone() },
      sunDir: { value: SUN_DIR.clone() },
      density: { value: WORLD_SHAPE.mycelion.density },
      mie: { value: WORLD_SHAPE.mycelion.mie },
    }),
    [lib.mycelion.sky],
  );

  const haloUniforms = useMemo<ShaderMaterial["uniforms"]>(
    () => ({
      skyMap: { value: lib.mycelion.sky },
      atmo: atmoUniforms.atmo,
      sunDir: atmoUniforms.sunDir,
      density: { value: WORLD_SHAPE.mycelion.halo },
      mie: { value: WORLD_SHAPE.mycelion.mie * 0.7 },
    }),
    [atmoUniforms, lib.mycelion.sky],
  );

  useLayoutEffect(() => {
    applyPalette(uniforms, cloudUniforms, atmoUniforms, haloUniforms, id, lib[id]);
  }, [id, lib, uniforms, cloudUniforms, atmoUniforms, haloUniforms]);

  useFrame((state, dt) => {
    uniforms.time.value = state.clock.elapsedTime;
    cloudUniforms.time.value = state.clock.elapsedTime;
    if (planet.current) planet.current.rotation.y += dt * spin;
    if (clouds.current) clouds.current.rotation.y += dt * spin * 1.22;
  });

  return (
    <group>
      <mesh ref={planet}>
        <sphereGeometry args={[radius, 80, 56]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} toneMapped={false} />
      </mesh>
      <mesh ref={clouds} scale={1.018}>
        <sphereGeometry args={[radius, 72, 52]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={cloudFrag}
          uniforms={cloudUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.048}>
        <sphereGeometry args={[radius, 64, 44]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={atmoFrag}
          uniforms={atmoUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.12}>
        <sphereGeometry args={[radius, 56, 40]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={atmoFrag}
          uniforms={atmoUniforms}
          transparent
          depthWrite={false}
          side={BackSide}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.24}>
        <sphereGeometry args={[radius, 40, 28]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={atmoFrag}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          side={BackSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
