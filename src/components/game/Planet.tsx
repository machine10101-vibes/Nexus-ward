import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { BackSide, Color, SRGBColorSpace, type Mesh, type ShaderMaterial, type Texture } from "three";
import type { MapId } from "@/game/types";
import { asset } from "@/lib/asset";

const vert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main() {
  vN = normalize(normalMatrix * normal);
  vP = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform sampler2D planetMap;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 atmo;
uniform float time;
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
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
  vec3 tex = texture2D(planetMap, vUv).rgb;
  float n = noise(vP * 2.4);
  n += 0.5 * noise(vP * 5.4 + time * 0.04);
  vec3 proc = mix(colorA, colorB, smoothstep(0.32, 0.62, n));
  proc = mix(proc, colorC, smoothstep(0.72, 0.9, n) * 0.65);
  vec3 albedo = mix(tex, proc, 0.28);
  albedo *= 0.72 + n * 0.38;
  float ndv = pow(1.0 - abs(vN.z), 2.2);
  albedo += atmo * ndv * 0.42;
  float day = smoothstep(-0.15, 0.55, vN.z);
  albedo *= 0.32 + 0.68 * day;
  albedo += colorC * (1.0 - day) * 0.18 * step(0.55, n);
  gl_FragColor = vec4(albedo, 1.0);
}
`;

export const PLANET_PALETTE: Record<MapId, { a: string; b: string; c: string; atmo: string; ring: string }> = {
  mycelion: { a: "#08241c", b: "#1d6a4a", c: "#3dcaa0", atmo: "#5ad4b0", ring: "#2a8f6a" },
  forge: { a: "#1a0c08", b: "#6a3a28", c: "#c46a3a", atmo: "#e08848", ring: "#c45a28" },
  aegis: { a: "#0c141c", b: "#3a5860", c: "#8ec8d0", atmo: "#8ec8d0", ring: "#6aa8b0" },
};

const MAP_INDEX: Record<MapId, number> = { mycelion: 0, forge: 1, aegis: 2 };

/** Derived from PLANET_PALETTE so the two can never drift apart. */
const PALETTE_COLORS = Object.fromEntries(
  (Object.keys(PLANET_PALETTE) as MapId[]).map((id) => {
    const p = PLANET_PALETTE[id];
    return [id, { a: new Color(p.a), b: new Color(p.b), c: new Color(p.c), atmo: new Color(p.atmo) }];
  }),
) as Record<MapId, { a: Color; b: Color; c: Color; atmo: Color }>;

function prep(tex: Texture) {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
}

export function usePlanetMaps() {
  const [mycelion, forge, aegis] = useTexture([
    asset("/textures/mycelion-planet.jpg"),
    asset("/textures/forge-planet.jpg"),
    asset("/textures/aegis-planet.jpg"),
  ]) as Texture[];
  useLayoutEffect(() => {
    [mycelion, forge, aegis].forEach(prep);
  }, [mycelion, forge, aegis]);
  // `useTexture` hands back a new array every render; anything memoised against
  // it would be rebuilt constantly, so re-key on the textures themselves.
  return useMemo(() => [mycelion, forge, aegis], [mycelion, forge, aegis]);
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
  const maps = usePlanetMaps();
  const planet = useRef<Mesh>(null);
  // Rebuilt per world and paired with a keyed material below, so switching
  // worlds swaps the sampler instead of leaving the previous planet bound.
  const uniforms = useMemo<ShaderMaterial["uniforms"]>(() => {
    const pal = PALETTE_COLORS[id];
    return {
      planetMap: { value: maps[MAP_INDEX[id]] },
      colorA: { value: pal.a.clone() },
      colorB: { value: pal.b.clone() },
      colorC: { value: pal.c.clone() },
      atmo: { value: pal.atmo.clone() },
      time: { value: 0 },
    };
  }, [id, maps]);

  useFrame((state, dt) => {
    uniforms.time.value = state.clock.elapsedTime;
    if (planet.current) planet.current.rotation.y += dt * spin;
  });

  const pal = PLANET_PALETTE[id];

  return (
    <group>
      <mesh ref={planet}>
        <sphereGeometry args={[radius, 64, 48]} />
        <shaderMaterial
          key={id}
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.12} side={BackSide} />
      </mesh>
      <mesh scale={1.16}>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.05} side={BackSide} />
      </mesh>
    </group>
  );
}
