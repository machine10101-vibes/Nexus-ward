import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, RepeatWrapping, Vector3, type Mesh, type ShaderMaterial } from "three";
import type { MapId } from "@/game/types";
import { useWorldArt } from "./worldArt";

const vert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
varying vec3 vWorldN;
void main() {
  vN = normalize(normalMatrix * normal);
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vP = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
varying vec3 vWorldN;
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
void main() {
  vec3 crust = texture2D(crustMap, vUv * vec2(2.6, 1.55)).rgb;
  crust = crust * 1.28 + 0.03;
  float n = noise(vP * 1.28);
  n += 0.48 * noise(vP * 2.7 + time * 0.01);
  n += 0.22 * noise(vP * 5.8);
  float land = smoothstep(0.4, 0.58, n);
  float coast = smoothstep(0.36, 0.5, n) * (1.0 - smoothstep(0.52, 0.64, n));
  vec3 deep = colorA * 0.7;
  vec3 shelf = mix(colorA, colorB, 0.4);
  vec3 ocean = mix(deep, shelf, smoothstep(0.18, 0.4, n));
  vec3 albedo = mix(ocean, crust, land);
  albedo = mix(albedo, mix(colorC, crust, 0.55), coast * 0.5);
  float ndl = max(dot(normalize(vWorldN), normalize(sunDir)), 0.0);
  float day = smoothstep(-0.04, 0.38, ndl);
  float spec = pow(ndl, 32.0) * (1.0 - land) * 0.32;
  float vein = max(crust.b * 0.78 + crust.g * 0.28 - crust.r * 0.58 - 0.12, 0.0);
  vein = max(vein, max(crust.r * 0.76 + crust.g * 0.2 - crust.b * 0.62 - 0.14, 0.0));
  vec3 lit = albedo * (0.14 + 0.9 * day);
  lit += spec * mix(colorC, vec3(0.85, 0.9, 0.95), 0.35);
  lit += colorC * vein * land * mix(0.18, 0.95, 1.0 - day);
  float fres = pow(1.0 - max(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
  lit += atmo * fres * (0.32 + 0.4 * day);
  gl_FragColor = vec4(lit, 1.0);
}
`;

const cloudFrag = /* glsl */ `
uniform vec3 atmo;
uniform float time;
uniform float cover;
varying vec3 vP;
varying vec3 vN;
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
void main() {
  float n = noise(vP * 2.6 + vec3(time * 0.03, 0.0, time * 0.018));
  n += 0.45 * noise(vP * 5.8 - vec3(time * 0.035, time * 0.01, 0.0));
  float mask = smoothstep(cover, cover + 0.2, n);
  float fres = pow(1.0 - abs(vN.z), 2.1);
  float a = mask * (0.08 + fres * 0.1);
  gl_FragColor = vec4(mix(vec3(0.55, 0.64, 0.68), atmo, 0.5), a);
}
`;

export const PLANET_PALETTE: Record<MapId, { a: string; b: string; c: string; atmo: string; ring: string }> = {
  mycelion: { a: "#08241c", b: "#1d6a4a", c: "#3dcaa0", atmo: "#5ad4b0", ring: "#2a8f6a" },
  forge: { a: "#1a0c08", b: "#6a3a28", c: "#c46a3a", atmo: "#e08848", ring: "#c45a28" },
  aegis: { a: "#0c141c", b: "#3a5860", c: "#8ec8d0", atmo: "#8ec8d0", ring: "#6aa8b0" },
};

const PALETTE_COLORS = Object.fromEntries(
  (Object.keys(PLANET_PALETTE) as MapId[]).map((id) => {
    const p = PLANET_PALETTE[id];
    return [id, { a: new Color(p.a), b: new Color(p.b), c: new Color(p.c), atmo: new Color(p.atmo) }];
  }),
) as Record<MapId, { a: Color; b: Color; c: Color; atmo: Color }>;

export function PlanetGlobe({
  id,
  radius = 2.35,
  spin = 0.08,
}: {
  id: MapId;
  radius?: number;
  spin?: number;
}) {
  const art = useWorldArt(id);
  const planet = useRef<Mesh>(null);
  const clouds = useRef<Mesh>(null);
  const crust = useMemo(() => {
    const tex = art.ground.clone();
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.needsUpdate = true;
    return tex;
  }, [art.ground]);

  const uniforms = useMemo<ShaderMaterial["uniforms"]>(() => {
    const pal = PALETTE_COLORS[id];
    return {
      crustMap: { value: crust },
      colorA: { value: pal.a.clone() },
      colorB: { value: pal.b.clone() },
      colorC: { value: pal.c.clone() },
      atmo: { value: pal.atmo.clone() },
      sunDir: { value: new Vector3(0.62, 0.48, 0.62) },
      time: { value: 0 },
    };
  }, [id, crust]);

  const cloudUniforms = useMemo<ShaderMaterial["uniforms"]>(
    () => ({
      atmo: { value: PALETTE_COLORS[id].atmo.clone() },
      time: { value: 0 },
      cover: { value: id === "forge" ? 0.76 : id === "aegis" ? 0.72 : 0.74 },
    }),
    [id],
  );

  useFrame((state, dt) => {
    uniforms.time.value = state.clock.elapsedTime;
    cloudUniforms.time.value = state.clock.elapsedTime;
    if (planet.current) planet.current.rotation.y += dt * spin;
    if (clouds.current) clouds.current.rotation.y += dt * spin * 1.28;
  });

  const pal = PLANET_PALETTE[id];

  return (
    <group>
      <mesh ref={planet}>
        <sphereGeometry args={[radius, 80, 56]} />
        <shaderMaterial key={id} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} toneMapped={false} />
      </mesh>
      <mesh ref={clouds} scale={1.018}>
        <sphereGeometry args={[radius, 48, 32]} />
        <shaderMaterial
          key={`${id}-cloud`}
          vertexShader={vert}
          fragmentShader={cloudFrag}
          uniforms={cloudUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.055}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.1} side={BackSide} depthWrite={false} />
      </mesh>
      <mesh scale={1.12}>
        <sphereGeometry args={[radius, 28, 20]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.045} side={BackSide} depthWrite={false} />
      </mesh>
      <mesh scale={1.2}>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.02} side={BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
