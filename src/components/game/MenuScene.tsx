import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import { AdditiveBlending, BackSide, Color, DoubleSide, Vector3, type Mesh, type ShaderMaterial } from "three";
import { useGameStore } from "@/game/store";
import { PLANET_THEME } from "@/game/config";
import type { MapId } from "@/game/types";
import { PlanetGlobe, PLANET_PALETTE } from "./Planet";
import { SPACE_VERT, STAR_GLSL } from "./spaceField";
import { useWorldLibrary, type WorldLibrary } from "./worldArt";

const skyFrag = /* glsl */ `
  uniform sampler2D sky;
  uniform vec3 fogCol;
  uniform vec3 accent;
  uniform float time;
  varying vec3 vP;
  varying vec2 vUv;
  ${STAR_GLSL}
  void main() {
    vec3 n = normalize(vP);
    vec3 tex = texture2D(sky, vec2(vUv.x * 0.92 + 0.04, vUv.y * 0.72 + 0.16)).rgb;
    float lum = dot(tex, vec3(0.3, 0.52, 0.18));
    vec3 nebula = tex * tex * 0.38;
    nebula *= smoothstep(0.1, 0.48, lum);
    nebula *= 0.55 + 0.45 * sfbm(n * 2.4);
    vec3 space = mix(vec3(0.004, 0.005, 0.01), fogCol * 0.12, 0.25);
    vec3 col = space + nebula * 0.42;
    col += milkyLane(n, mix(accent, tex, 0.35));
    col += starField(n, time) * 1.35;
    col += accent * pow(1.0 - abs(n.y), 8.5) * 0.045;
    col += accent * vec3(1.15, 0.78, 0.55) * pow(max(dot(n, normalize(vec3(0.55, 0.42, 0.28))), 0.0), 48.0) * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const moonVert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vView;
void main() {
  vN = normalize(normalMatrix * normal);
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const moonFrag = /* glsl */ `
uniform vec3 tint;
uniform vec3 sunDir;
varying vec3 vN;
varying vec3 vP;
varying vec3 vView;
${STAR_GLSL}
void main() {
  vec3 pn = normalize(vP);
  float pits = sfbm(pn * 7.2);
  float bowl = smoothstep(0.58, 0.8, pits);
  float rim = smoothstep(0.48, 0.6, pits) * (1.0 - bowl);
  float grain = snoise(pn * 22.0);
  vec3 Nw = normalize(vN + pn * ((rim - bowl) * 0.55 + grain * 0.08));
  vec3 L = normalize(sunDir);
  vec3 V = normalize(vView);
  float ndl = max(dot(Nw, L) * 0.72 + 0.18, 0.0);
  float dusk = exp(-dot(Nw, L) * dot(Nw, L) * 10.0);
  vec3 albedo = tint * (0.72 + grain * 0.12);
  albedo = mix(albedo, tint * 0.42, bowl * 0.7);
  albedo = mix(albedo, vec3(0.82, 0.84, 0.86), rim * 0.35);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Nw, H), 0.0), 36.0) * 0.08;
  vec3 lit = albedo * (0.06 + ndl * 0.95) + tint * dusk * 0.08 + spec;
  gl_FragColor = vec4(lit, 1.0);
}
`;

const ringFrag = /* glsl */ `
uniform vec3 color;
uniform float opacity;
uniform float time;
varying vec2 vUv;
${STAR_GLSL}
void main() {
  float r = vUv.y;
  float a = vUv.x * 6.2831853;
  float bands = 0.42 + 0.58 * sin(r * 92.0 + sfbm(vec3(r * 14.0, sin(a), cos(a))) * 6.0);
  float gaps = smoothstep(0.12, 0.4, abs(sin(r * 18.0 + 0.4)));
  gaps *= smoothstep(0.05, 0.22, abs(sin(r * 41.0)));
  float dust = sfbm(vec3(r * 20.0, sin(a * 2.0) * 3.0, cos(a * 2.0) * 3.0 + time * 0.02));
  float edge = smoothstep(0.0, 0.07, r) * smoothstep(1.0, 0.9, r);
  float aout = bands * gaps * (0.18 + dust * 0.82) * edge * opacity;
  vec3 col = mix(color, vec3(0.92, 0.9, 0.86), dust * 0.35);
  gl_FragColor = vec4(col, clamp(aout, 0.0, 0.85));
}
`;

const SUN_DIR = new Vector3(6, 8, 4).normalize();

export function MenuScene() {
  return (
    <>
      <color attach="background" args={["#03040a"]} />
      <fog attach="fog" args={["#07080f", 34, 120]} />
      <ambientLight intensity={0.16} />
      <Stars radius={100} depth={48} count={2800} factor={3.2} fade speed={0.28} />
      <Stars radius={130} depth={18} count={900} factor={1.5} fade speed={0.08} />
      <Sparkles count={48} scale={16} size={2.6} speed={0.32} color="#d4deea" opacity={0.42} />
      <Sparkles count={18} scale={22} size={4.2} speed={0.12} color="#f0e6d0" opacity={0.28} />
      <Suspense fallback={null}>
        <MenuArt />
      </Suspense>
    </>
  );
}

function MenuArt() {
  const lib = useWorldLibrary();
  return <MenuWorld lib={lib} />;
}

function MenuWorld({ lib }: { lib: WorldLibrary }) {
  const preview = useGameStore((s) => s.preview);
  const pal = PLANET_PALETTE[preview];
  const theme = PLANET_THEME[preview];

  useFrame((state) => {
    const cam = state.camera;
    const t = state.clock.elapsedTime;
    cam.position.x = Math.sin(t * 0.07) * 0.7;
    cam.position.y = 0.32 + Math.sin(t * 0.05) * 0.18;
    cam.lookAt(0, 0, 0);
  });

  return (
    <>
      <hemisphereLight intensity={0.58} color={theme.hemiSky} groundColor={theme.hemiGround} />
      <directionalLight position={[6, 8, 4]} intensity={2.15} color={theme.dir} />
      <pointLight position={[-4, 2, 3]} intensity={22} distance={18} color={pal.atmo} />
      <pointLight position={[5, -1, 2]} intensity={10} distance={14} color={pal.ring} />
      <pointLight position={[16, 12, 9]} intensity={28} distance={40} color="#fff1d0" />
      <MenuSky lib={lib} preview={preview} />
      <SunGlint />
      <PlanetGlobe id={preview} />
      <DustRing inner={3.18} outer={3.82} color={pal.ring} opacity={0.7} tilt={[1.02, 0.38, 0.18]} spin={0.035} />
      <DustRing inner={3.92} outer={4.28} color={pal.atmo} opacity={0.38} tilt={[0.92, -0.22, 0.42]} spin={-0.022} />
      <DustRing inner={4.36} outer={4.62} color={pal.ring} opacity={0.22} tilt={[1.08, 0.12, -0.16]} spin={0.016} />
      <mesh rotation={[1.02, 0.38, 0.18]}>
        <torusGeometry args={[3.48, 0.007, 6, 96]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.28} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 3.46, Math.sin(a) * 0.55, Math.sin(a) * 3.46 * 0.35]}>
            <boxGeometry args={[0.1, 0.06, 0.16]} />
            <meshStandardMaterial color={pal.ring} emissive={pal.ring} emissiveIntensity={0.7} metalness={0.6} roughness={0.28} />
          </mesh>
        );
      })}
      <CraterMoon position={[3.35, 0.85, -1.5]} radius={0.32} tint="#c6ccd2" />
      <CraterMoon position={[-2.7, -0.45, 2.15]} radius={0.17} tint="#8a9098" />
      <CraterMoon position={[1.8, -1.4, -2.4]} radius={0.1} tint={pal.atmo} glow />
    </>
  );
}

function MenuSky({ lib, preview }: { lib: WorldLibrary; preview: MapId }) {
  const mat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      sky: { value: lib.mycelion.sky },
      fogCol: { value: new Color("#07080f") },
      accent: { value: new Color(PLANET_PALETTE.mycelion.atmo) },
      time: { value: 0 },
    }),
    [lib.mycelion.sky],
  );

  useLayoutEffect(() => {
    uniforms.sky.value = lib[preview].sky;
    uniforms.fogCol.value.set(PLANET_THEME[preview].fog);
    uniforms.accent.value.set(PLANET_PALETTE[preview].atmo);
    if (mat.current) mat.current.uniformsNeedUpdate = true;
  }, [preview, lib, uniforms]);

  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
  });

  return (
    <mesh>
      <sphereGeometry args={[86, 56, 36]} />
      <shaderMaterial
        ref={mat}
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={SPACE_VERT}
        fragmentShader={skyFrag}
        toneMapped={false}
      />
    </mesh>
  );
}

function DustRing({
  inner,
  outer,
  color,
  opacity,
  tilt,
  spin,
}: {
  inner: number;
  outer: number;
  color: string;
  opacity: number;
  tilt: [number, number, number];
  spin: number;
}) {
  const ref = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      color: { value: new Color(color) },
      opacity: { value: opacity },
      time: { value: 0 },
    }),
    [color, opacity],
  );
  useFrame((state, dt) => {
    uniforms.time.value = state.clock.elapsedTime;
    if (ref.current) ref.current.rotation.z += dt * spin;
  });
  return (
    <group rotation={tilt}>
      <mesh ref={ref}>
        <ringGeometry args={[inner, outer, 128, 18]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={SPACE_VERT}
          fragmentShader={ringFrag}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CraterMoon({
  position,
  radius,
  tint,
  glow,
}: {
  position: [number, number, number];
  radius: number;
  tint: string;
  glow?: boolean;
}) {
  const uniforms = useMemo(
    () => ({
      tint: { value: new Color(tint) },
      sunDir: { value: SUN_DIR.clone() },
    }),
    [tint],
  );
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 28, 22]} />
      {glow ? (
        <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.45} roughness={0.42} metalness={0.18} />
      ) : (
        <shaderMaterial vertexShader={moonVert} fragmentShader={moonFrag} uniforms={uniforms} toneMapped={false} />
      )}
    </mesh>
  );
}

function SunGlint() {
  return (
    <group position={[18.5, 13.2, 10.4]}>
      <mesh>
        <sphereGeometry args={[0.42, 20, 16]} />
        <meshBasicMaterial color="#fff6dc" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.9, 20, 16]} />
        <meshBasicMaterial color="#ffd9a4" transparent opacity={0.14} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.6, 16, 12]} />
        <meshBasicMaterial color="#f0b878" transparent opacity={0.05} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
