import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  CircleGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  RingGeometry,
  RepeatWrapping,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { CELL } from "@/game/config";
import type { MapId } from "@/game/types";

const RIM = 3.2;

export function arenaMetrics(cols: number, rows: number) {
  const arenaR = (cols * CELL) / 2 + RIM;
  const squash = ((rows * CELL) / 2 + RIM) / arenaR;
  return { arenaR, squash };
}

/** Height outside the play ellipse. Pads and path stay on y=0. */
export function terrainElevation(x: number, z: number, arenaR: number, squash: number, style: MapId) {
  const inset = Math.hypot(x / arenaR, z / (arenaR * squash));
  const edge = smooth(clamp((inset - 1) / 0.62, 0, 1));
  if (edge <= 0) return 0;
  let n =
    Math.sin(x * 0.1) * Math.cos(z * 0.08) * 0.95 +
    Math.sin(x * 0.21 + z * 0.16) * 0.48 +
    Math.sin(x * 0.44 - z * 0.29) * 0.22 +
    Math.sin(x * 0.06 + z * 0.045) * 1.2 +
    Math.sin(x * 0.73) * Math.cos(z * 0.61) * 0.14;
  if (style === "forge") {
    n = Math.round(n * 1.45) / 1.45 + Math.sin(x * 0.31) * Math.sin(z * 0.27) * 0.22;
    n += Math.max(0, Math.sin(x * 0.09 + z * 0.07) - 0.35) * 0.55;
  } else if (style === "aegis") {
    const rift = Math.abs(x * 0.2 + z * 0.34);
    n = Math.abs(n) * 1.2 - 0.18 + Math.max(0, 1.05 - rift) * 1.7;
  } else {
    const bowl = Math.max(0, 0.62 - Math.abs(Math.sin(x * 0.17) * Math.cos(z * 0.19)));
    n += Math.sin(x * 0.58 + z * 0.16) * Math.cos(z * 0.48) * 0.28 - bowl * 0.45;
  }
  const far = smooth(clamp((inset - 1.35) / 0.7, 0, 1));
  const amp = style === "forge" ? 2.05 : style === "aegis" ? 3.05 : 2.65;
  return n * edge * amp + edge * 0.7 + far * 1.35;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function makeHills(w: number, d: number, arenaR: number, squash: number, style: MapId, res: number) {
  const g = new PlaneGeometry(w, d, res, Math.max(24, Math.round(res * (d / w))));
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const ao = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainElevation(x, z, arenaR, squash, style);
    pos.setY(i, y);
    const shade = clamp(0.82 + y * 0.025, 0.7, 1);
    ao.setRGB(shade, shade, shade);
    cols[i * 3] = ao.r;
    cols[i * 3 + 1] = ao.g;
    cols[i * 3 + 2] = ao.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function makeBowl(arenaR: number, squash: number, style: MapId) {
  const g = new CircleGeometry(arenaR, 96);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const uv = g.attributes.uv;
  const tile = style === "forge" ? 3.4 : 2.8;
  for (let i = 0; i < pos.count; i++) {
    // Circle sits in XY before we rotate it in the mesh.
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, 0.5 + (x / arenaR) * 0.5 * tile, 0.5 + (y / arenaR) * 0.5 * tile * squash);
    const r = Math.hypot(x / arenaR, y / arenaR);
    const rim = smooth(clamp((r - 0.72) / 0.28, 0, 1));
    const speckle =
      style === "mycelion"
        ? 0.92 + Math.sin(x * 1.7) * Math.cos(y * 1.4) * 0.08
        : style === "forge"
          ? 0.88 + ((Math.sin(x * 3.1) * Math.sin(y * 3.1) + 1) * 0.06)
          : 0.9 + Math.abs(Math.sin(x * 0.9 + y * 1.2)) * 0.1;
    const k = (speckle - rim * 0.12) * (style === "aegis" ? 0.96 : 1);
    cols[i * 3] = k;
    cols[i * 3 + 1] = k;
    cols[i * 3 + 2] = k;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function glowPatch(shader: { fragmentShader: string }, strength: number) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    /* glsl */ `
    #include <emissivemap_fragment>
    diffuseColor.rgb = diffuseColor.rgb * 1.72 + 0.035;
    float teal = max(diffuseColor.b * 0.88 + diffuseColor.g * 0.32 - diffuseColor.r * 0.72 - 0.18, 0.0);
    float ember = max(diffuseColor.r * 0.82 + diffuseColor.g * 0.26 - diffuseColor.b * 0.78 - 0.2, 0.0);
    float vein = max(teal, ember);
    totalEmissiveRadiance += emissive * vein * ${strength.toFixed(2)};
    `,
  );
}

function GroundMat({
  map,
  roughness,
  metalness,
  emissive,
  glow,
  tint = "#f2f4f1",
}: {
  map: Texture;
  roughness: number;
  metalness: number;
  emissive: string;
  glow: number;
  tint?: string;
}) {
  return (
    <meshStandardMaterial
      map={map}
      color={tint}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive}
      emissiveIntensity={0.28}
      vertexColors
      onBeforeCompile={(shader) => glowPatch(shader, glow)}
    />
  );
}

export function WorldGround({
  mapId,
  cols,
  rows,
  quality,
  ground,
  sky,
  fog,
  emissive,
  roughness,
  metalness,
  combat,
}: {
  mapId: MapId;
  cols: number;
  rows: number;
  quality: "high" | "low";
  ground: Texture;
  sky: Texture;
  fog: string;
  emissive: string;
  roughness: number;
  metalness: number;
  combat: boolean;
}) {
  const { arenaR, squash } = arenaMetrics(cols, rows);
  const groundW = cols * CELL + 26;
  const groundD = rows * CELL + 26;
  const hills = useMemo(
    () => makeHills(groundW, groundD, arenaR, squash, mapId, quality === "high" ? 96 : 48),
    [groundW, groundD, arenaR, squash, mapId, quality],
  );
  const bowl = useMemo(() => makeBowl(arenaR, squash, mapId), [arenaR, squash, mapId]);
  const hillMap = useMemo(() => {
    const tex = ground.clone();
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(mapId === "forge" ? 8 : 6.5, mapId === "forge" ? 6.2 : 5);
    tex.needsUpdate = true;
    return tex;
  }, [ground, mapId]);
  const glow = mapId === "forge" ? 2.4 : mapId === "aegis" ? 2.8 : 2.2;

  return (
    <group>
      <SkyShell map={sky} fog={fog} accent={emissive} />
      <mesh geometry={hills} receiveShadow>
        <GroundMat map={hillMap} roughness={roughness} metalness={metalness} emissive={emissive} glow={glow} />
      </mesh>
      <mesh geometry={bowl} rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} receiveShadow>
        <GroundMat
          map={ground}
          roughness={roughness * 0.92}
          metalness={metalness + 0.06}
          emissive={emissive}
          glow={glow * 1.15}
          tint="#ffffff"
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} position={[0, 0.028, 0]}>
        <ringGeometry args={[arenaR - 0.55, arenaR + 0.08, 96]} />
        <meshStandardMaterial
          color={emissive}
          emissive={emissive}
          emissiveIntensity={combat ? 0.62 : 0.32}
          transparent
          opacity={0.78}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} position={[0, 0.034, 0]}>
        <torusGeometry args={[arenaR + 1.15, 0.04, 8, 96]} />
        <meshStandardMaterial color={emissive} emissive={emissive} emissiveIntensity={0.5} metalness={0.55} roughness={0.28} />
      </mesh>
      {quality === "high" ? <HorizonHaze color={fog} accent={emissive} arenaR={arenaR} squash={squash} /> : null}
      {quality === "high" ? <OuterRidges mapId={mapId} arenaR={arenaR} squash={squash} map={hillMap} roughness={roughness} metalness={metalness} emissive={emissive} /> : null}
    </group>
  );
}

function SkyShell({ map, fog, accent }: { map: Texture; fog: string; accent: string }) {
  const uniforms = useMemo(
    () => ({
      sky: { value: map },
      fogCol: { value: new Color(fog) },
      accent: { value: new Color(accent) },
    }),
    [map, fog, accent],
  );
  return (
    <mesh>
      <sphereGeometry args={[78, 48, 32]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; varying vec2 vUv; void main(){ vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform sampler2D sky; uniform vec3 fogCol; uniform vec3 accent;
          varying vec3 vP; varying vec2 vUv;
          void main() {
            vec3 n = normalize(vP);
            vec3 tex = texture2D(sky, vec2(vUv.x + 0.12, vUv.y * 0.78 + 0.14)).rgb * 1.18;
            float h = n.y;
            float haze = smoothstep(0.06, -0.08, h);
            vec3 col = mix(tex, fogCol, haze * 0.62);
            col = mix(col, fogCol * 0.55, smoothstep(-0.05, -0.55, h));
            float rim = pow(1.0 - abs(h), 5.0);
            col += accent * rim * 0.14;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function OuterRidges({
  mapId,
  arenaR,
  squash,
  map,
  roughness,
  metalness,
  emissive,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  map: Texture;
  roughness: number;
  metalness: number;
  emissive: string;
}) {
  const geo = useMemo(() => {
    const g = new RingGeometry(arenaR * 1.58, arenaR * 2.12, 80, 10);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setX(i, x);
      pos.setZ(i, z * squash);
      const r = Math.hypot(x / arenaR, (z * squash) / (arenaR * squash));
      const band = 1 - Math.min(1, Math.abs(r - 1.85) / 0.28);
      pos.setY(i, terrainElevation(x, z * squash, arenaR, squash, mapId) + band * 1.65);
    }
    g.computeVertexNormals();
    return g;
  }, [arenaR, squash, mapId]);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <GroundMat map={map} roughness={roughness} metalness={metalness} emissive={emissive} glow={1.6} />
    </mesh>
  );
}

function HorizonHaze({
  color,
  accent,
  arenaR,
  squash,
}: {
  color: string;
  accent: string;
  arenaR: number;
  squash: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    (m.material as MeshStandardMaterial).opacity = 0.16 + Math.sin(s.clock.elapsedTime * 0.35) * 0.03;
  });
  return (
    <group>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} position={[0, 0.12, 0]}>
        <ringGeometry args={[arenaR + 0.4, arenaR + 7.5, 72]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} position={[0, 0.16, 0]}>
        <ringGeometry args={[arenaR + 6.2, arenaR + 11, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.045} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}
