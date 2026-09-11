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

const NOISE = /* glsl */ `
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
float ridged(vec3 p) {
  float t = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    t += (1.0 - abs(noise(p) * 2.0 - 1.0)) * a;
    p *= 2.11;
    a *= 0.5;
  }
  return t;
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
${NOISE}
vec3 triplanar(sampler2D tex, vec3 p, float scale) {
  vec3 n = abs(normalize(p));
  n = pow(n, vec3(4.0));
  n /= (n.x + n.y + n.z + 1e-4);
  return texture2D(tex, p.yz * scale).rgb * n.x
       + texture2D(tex, p.xz * scale).rgb * n.y
       + texture2D(tex, p.xy * scale).rgb * n.z;
}

void main() {
  vec3 pn = normalize(vP);
  vec3 crust = triplanar(crustMap, vP, 0.34) * 0.48
             + triplanar(crustMap, vP, 1.15) * 0.34
             + triplanar(crustMap, vP, 3.8) * 0.18;
  crust = crust * 2.05 + 0.05;
  float bump = dot(crust, vec3(0.28, 0.5, 0.22));
  float ridge = ridged(pn * 3.4 + 0.2);
  vec3 Nw = normalize(vWorldN + vWorldN * ((bump - 0.48) * 0.55 + (ridge - 0.5) * 0.22));
  vec3 Nv = normalize(vN);
  vec3 V = normalize(vView);
  vec3 L = normalize(sunDir);

  vec3 warp = vec3(fbm(pn * 1.4), fbm(pn * 1.4 + 17.2), fbm(pn * 1.4 + 31.7));
  float n = fbm(pn * 2.05 + warp * 0.42);
  n += 0.16 * ridged(pn * 5.2);
  n += 0.08 * noise(pn * 14.0);
  float land = smoothstep(landBias - 0.02, landBias + 0.14, n);
  float coast = smoothstep(landBias - 0.08, landBias + 0.02, n)
              * (1.0 - smoothstep(landBias + 0.06, landBias + 0.2, n));
  float depth = smoothstep(landBias - 0.32, landBias - 0.02, n);
  vec3 deep = mix(colorA, colorB, 0.18) * 0.7;
  vec3 shelf = mix(colorA, colorB, 0.82);
  vec3 ocean = mix(deep, shelf, depth);
  float ofres = pow(1.0 - max(dot(Nw, V), 0.0), 3.4);
  ocean = mix(ocean, mix(colorC, vec3(0.78, 0.88, 0.96), 0.45), ofres * (1.0 - land) * 0.42);
  ocean += colorC * pow(depth, 3.0) * 0.1;

  float mott = fbm(pn * 6.4 + 4.2);
  vec3 dirt = mix(colorB * 0.55 + crust * 0.7, colorC * 0.35 + crust, mott);
  vec3 high = mix(crust, dirt, 0.7);
  high = mix(high, mix(colorB * 0.62, crust, 0.4), ridge * 0.55);
  vec3 albedo = mix(ocean, high, land);
  albedo = mix(albedo, mix(colorC, crust, 0.38), coast * 0.62);
  float ice = smoothstep(0.62, 0.88, abs(pn.y)) * iceAmt * (0.5 + land * 0.5);
  ice *= 0.7 + ridged(pn * 8.0) * 0.4;
  ice += land * ridge * iceAmt * smoothstep(0.72, 0.92, abs(pn.y) + ridge * 0.12) * 0.22;
  albedo = mix(albedo, mix(vec3(0.82, 0.9, 0.96), crust, 0.14), clamp(ice, 0.0, 1.0));

  float ndl = dot(Nw, L);
  float day = smoothstep(-0.05, 0.22, ndl);
  float dusk = exp(-ndl * ndl * 10.0);
  float wrap = max(ndl * 0.88 + 0.1, 0.0);
  float night = 1.0 - day;

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Nw, H), 0.0), 72.0) * (1.0 - land) * day * 0.72;
  spec += pow(max(dot(Nw, H), 0.0), 18.0) * (1.0 - land) * day * 0.12;
  spec += pow(max(dot(Nw, H), 0.0), 28.0) * coast * day * 0.22;
  spec += pow(max(dot(Nw, H), 0.0), 48.0) * ice * day * 0.18;
  spec *= 0.55 + ofres * 0.7;

  float cld = fbm(pn * 2.8 + vec3(time * 0.016, 0.04, time * 0.011) + warp * 0.2);
  cld += 0.2 * noise(pn * 9.0 - vec3(time * 0.02, 0.0, 0.0));
  cld = smoothstep(cloudCover - 0.02, cloudCover + 0.2, cld);

  float vein = max(crust.b * 0.82 + crust.g * 0.28 - crust.r * 0.56 - 0.08, 0.0);
  vein = max(vein, max(crust.r * 0.8 + crust.g * 0.22 - crust.b * 0.62 - 0.1, 0.0));
  float cities = smoothstep(0.72, 0.9, noise(pn * 36.0 + 4.0)) * land * (1.0 - ice);

  vec3 lit = albedo * (0.04 + 1.42 * wrap * day);
  lit *= 1.0 - cld * day * 0.28;
  lit += spec * mix(colorC, vec3(0.92, 0.95, 1.0), 0.6);
  lit += colorC * vein * land * mix(0.1, 1.15, night);
  lit += colorC * cities * night * 0.55;
  lit += albedo * dusk * 0.16;
  lit += atmo * dusk * 0.22;
  lit += atmo * vec3(1.25, 0.72, 0.42) * dusk * coast * 0.18;

  float fres = pow(1.0 - max(dot(Nv, V), 0.0), 2.8);
  lit += atmo * fres * (0.08 + day * 0.08 + dusk * 0.28);
  lit += atmo * pow(fres, 5.0) * 0.08;
  lit += albedo * night * 0.035;

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
${NOISE}
void main() {
  vec3 pn = normalize(vP);
  vec3 Nw = normalize(vWorldN);
  vec3 L = normalize(sunDir);
  vec3 V = normalize(vView);
  vec3 warp = vec3(fbm(pn * 1.2 + time * 0.01), fbm(pn * 1.2 + 9.0), fbm(pn * 1.2 + 19.0));
  float n = fbm(pn * 2.35 + vec3(time * 0.02, 0.05, time * 0.012) + warp * 0.28);
  n += 0.26 * noise(pn * 7.6 - vec3(time * 0.028, time * 0.01, 0.0));
  n += 0.1 * noise(pn * 16.0 + time * 0.008);
  float bands = 0.07 * sin(pn.y * 11.0 + n * 5.0 + time * 0.16);
  float mask = smoothstep(cover - 0.04, cover + 0.18, n + bands);
  float heads = smoothstep(cover + 0.08, cover + 0.32, n);
  float wisps = smoothstep(cover - 0.08, cover + 0.08, n) * (1.0 - heads);
  float ndl = dot(Nw, L);
  float day = smoothstep(-0.14, 0.4, ndl);
  float dusk = exp(-ndl * ndl * 8.0);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 1.55);
  vec2 skyUv = vec2(atan(pn.z, pn.x) * 0.1591549 + 0.5, pn.y * 0.46 + 0.52);
  vec3 sky = texture2D(skyMap, skyUv).rgb;
  vec3 col = mix(vec3(0.82, 0.86, 0.9), tint, 0.58);
  col = mix(col, sky, 0.18);
  col = mix(col, atmo, 0.16);
  float lining = pow(max(ndl, 0.0), 2.8) * (0.45 + heads * 0.55);
  col += mix(vec3(1.0), atmo, 0.3) * lining * 0.48;
  col = mix(col, atmo * vec3(1.28, 0.74, 0.42), dusk * 0.48);
  col *= 0.48 + day * 0.58;
  float a = (heads * 0.55 + wisps * 0.22 + mask * 0.18) * opacity * (0.16 + heads * 0.5) * (0.28 + day * 0.72);
  a *= 0.34 + fres * 0.4;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.72));
}
`;

const atmoFrag = /* glsl */ `
uniform sampler2D skyMap;
uniform vec3 atmo;
uniform vec3 sunDir;
uniform float density;
uniform float mie;
uniform float iceAmt;
uniform float time;
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
  float ndotv = abs(dot(Nv, V));
  float limb = pow(max(1.0 - ndotv, 0.0), 3.35);
  float face = pow(max(1.0 - ndotv, 0.0), 8.5);
  float ndl = dot(Nw, L);
  float dusk = exp(-ndl * ndl * 7.2);
  float day = smoothstep(-0.28, 0.36, ndl);
  vec2 skyUv = vec2(atan(pn.z, pn.x) * 0.1591549 + 0.5, pn.y * 0.48 + 0.5);
  vec3 sky = texture2D(skyMap, skyUv).rgb;
  vec3 rayleigh = mix(atmo * 0.55, atmo * 1.18, day);
  rayleigh = mix(rayleigh, sky, 0.16);
  float sunGlow = pow(max(ndl, 0.0), 2.2) * mie;
  float mieLobe = pow(max(dot(reflect(-L, Nw), V), 0.0), 6.5) * mie;
  vec3 sunset = atmo * vec3(1.32, 0.66, 0.34);
  vec3 col = mix(rayleigh, sunset, dusk * 0.72);
  col += sky * sunGlow * 0.16;
  col += atmo * mieLobe * 0.55;
  col += atmo * vec3(0.7, 0.55, 1.05) * pow(limb, 1.6) * 0.16;
  float pole = smoothstep(0.62, 0.95, abs(pn.y));
  float az = atan(pn.z, pn.x);
  float curtains = 0.5 + 0.5 * sin(az * 10.0 + time * 0.38 + pn.y * 7.0);
  curtains *= 0.55 + 0.45 * sin(az * 6.5 - time * 0.22);
  col += atmo * vec3(0.55, 1.05, 0.78) * pole * curtains * iceAmt * 0.45;
  float a = (limb * 0.82 + face * 0.06) * density * (0.55 + dusk * 0.7 + sunGlow * 0.18);
  a += pole * curtains * iceAmt * limb * 0.12;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.78));
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
  mycelion: { landBias: 0.4, iceAmt: 0.18, cover: 0.66, density: 0.4, halo: 0.16, mie: 0.88, opacity: 0.52 },
  forge: { landBias: 0.34, iceAmt: 0.0, cover: 0.72, density: 0.46, halo: 0.2, mie: 1.05, opacity: 0.58 },
  aegis: { landBias: 0.44, iceAmt: 0.44, cover: 0.68, density: 0.38, halo: 0.18, mie: 0.82, opacity: 0.46 },
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
  atmoUniforms.iceAmt.value = shape.iceAmt;
  atmoUniforms.skyMap.value = art.sky;
  haloUniforms.density.value = shape.halo;
  haloUniforms.mie.value = shape.mie * 0.7;
  haloUniforms.iceAmt.value = 0;
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
      iceAmt: { value: WORLD_SHAPE.mycelion.iceAmt },
      time: { value: 0 },
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
      iceAmt: { value: 0 },
      time: atmoUniforms.time,
    }),
    [atmoUniforms, lib.mycelion.sky],
  );

  useLayoutEffect(() => {
    applyPalette(uniforms, cloudUniforms, atmoUniforms, haloUniforms, id, lib[id]);
  }, [id, lib, uniforms, cloudUniforms, atmoUniforms, haloUniforms]);

  useFrame((state, dt) => {
    uniforms.time.value = state.clock.elapsedTime;
    cloudUniforms.time.value = state.clock.elapsedTime;
    atmoUniforms.time.value = state.clock.elapsedTime;
    if (planet.current) planet.current.rotation.y += dt * spin;
    if (clouds.current) clouds.current.rotation.y += dt * spin * 1.22;
  });

  return (
    <group>
      <mesh ref={planet}>
        <sphereGeometry args={[radius, 112, 80]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} toneMapped={false} />
      </mesh>
      <mesh ref={clouds} scale={1.012}>
        <sphereGeometry args={[radius, 96, 64]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={cloudFrag}
          uniforms={cloudUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.018}>
        <sphereGeometry args={[radius, 80, 56]} />
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={atmoFrag}
          uniforms={atmoUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.052}>
        <sphereGeometry args={[radius, 72, 48]} />
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
      <mesh scale={1.088}>
        <sphereGeometry args={[radius, 56, 36]} />
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
