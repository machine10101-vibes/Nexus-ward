import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  RepeatWrapping,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { CELL } from "@/game/config";
import type { MapId } from "@/game/types";
import { SPACE_VERT, STAR_GLSL } from "./spaceField";

const battleSkyFrag = /* glsl */ `
uniform sampler2D sky;
uniform vec3 fogCol;
uniform vec3 accent;
uniform float time;
varying vec3 vP;
varying vec2 vUv;
${STAR_GLSL}
void main() {
  vec3 n = normalize(vP);
  vec3 tex = texture2D(sky, vec2(vUv.x + 0.12, vUv.y * 0.78 + 0.14)).rgb * 1.12;
  float h = n.y;
  float haze = smoothstep(0.08, -0.1, h);
  float lum = dot(tex, vec3(0.3, 0.52, 0.18));
  vec3 nebula = tex * tex * 0.28 * smoothstep(0.12, 0.5, lum);
  vec3 col = mix(tex * 0.82 + nebula, fogCol, haze * 0.62);
  col = mix(col, fogCol * 0.52, smoothstep(-0.05, -0.55, h));
  float skyAmt = smoothstep(0.02, 0.28, h);
  col += milkyLane(n, mix(accent, tex, 0.4)) * skyAmt;
  col += starField(n, time) * skyAmt * 1.25;
  float rim = pow(1.0 - abs(h), 5.0);
  col += accent * rim * 0.14;
  gl_FragColor = vec4(col, 1.0);
}
`;

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
    const grain = Math.sin(x * 0.55) * Math.cos(z * 0.48) * 0.06 + Math.sin(x * 1.9 + z * 1.4) * 0.03;
    const shade = clamp(0.78 + y * 0.03 + grain, 0.62, 1.04);
    if (style === "forge") ao.setRGB(shade * 1.05, shade * 0.96, shade * 0.88);
    else if (style === "aegis") ao.setRGB(shade * 0.92, shade * 0.98, shade * 1.06);
    else ao.setRGB(shade * 0.95, shade * 1.03, shade * 0.92);
    cols[i * 3] = ao.r;
    cols[i * 3 + 1] = ao.g;
    cols[i * 3 + 2] = ao.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function makeBowl(arenaR: number, _squash: number, style: MapId, res: number) {
  // Dense grid, not a triangle fan — the old circle only had rim verts, so the play
  // field interpolated to a flat wash.
  const g = new PlaneGeometry(arenaR * 2, arenaR * 2, res, res);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const nrm = new Float32Array(pos.count * 3);
  const uv = g.attributes.uv;
  const tile = style === "forge" ? 3.4 : style === "aegis" ? 3.1 : 3;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, 0.5 + (x / arenaR) * 0.5 * tile, 0.5 + (y / arenaR) * 0.5 * tile);
    const r = Math.hypot(x / arenaR, y / arenaR);
    const rim = smooth(clamp((r - 0.72) / 0.28, 0, 1));
    const speckle =
      style === "mycelion"
        ? 0.88 + Math.sin(x * 1.7) * Math.cos(y * 1.4) * 0.08
        : style === "forge"
          ? 0.84 + ((Math.sin(x * 3.1) * Math.sin(y * 3.1) + 1) * 0.07)
          : 0.86 + Math.abs(Math.sin(x * 0.9 + y * 1.2)) * 0.09;
    const grain = Math.sin(x * 7.4) * Math.cos(y * 6.2) * 0.06 + Math.sin(x * 14.1 + y * 9.6) * 0.04;
    const blotch = Math.sin(x * 0.36 + y * 0.29) * Math.cos(y * 0.24) * 0.1;
    const crack = Math.max(0, 0.12 - Math.abs(Math.sin(x * 0.55) * Math.cos(y * 0.48))) * 0.35;
    const k = clamp(speckle + grain + blotch - rim * 0.18 - crack, 0.52, 1.12);
    const tint = style === "mycelion" ? [0.88, 1.12, 0.86] : style === "forge" ? [1.18, 0.9, 0.76] : [0.82, 0.96, 1.16];
    cols[i * 3] = k * tint[0];
    cols[i * 3 + 1] = k * tint[1];
    cols[i * 3 + 2] = k * tint[2];
    const nx = Math.sin(x * 3.3 + y * 0.4) * 0.28 + Math.sin(x * 9.2) * 0.12;
    const ny = Math.cos(y * 3.1 + x * 0.35) * 0.28 + Math.cos(y * 8.6) * 0.12;
    const nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz);
    nrm[i * 3] = nx * inv;
    nrm[i * 3 + 1] = ny * inv;
    nrm[i * 3 + 2] = nz * inv;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  return g;
}

function glowPatch(shader: { fragmentShader: string }, strength: number) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    /* glsl */ `
    #include <emissivemap_fragment>
    #ifdef USE_MAP
      vec3 grit = texture2D(map, vMapUv * 3.7 + vec2(0.13, 0.07)).rgb;
      vec3 grit2 = texture2D(map, vMapUv * 8.4 + vec2(0.41, 0.28)).rgb;
      vec3 grit3 = texture2D(map, vMapUv * 15.2 + vec2(0.62, 0.19)).rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.46 + grit * 0.92), 0.52);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.62 + grit2 * 0.62), 0.34);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.7 + grit3 * 0.5), 0.2);
      float bump = dot(grit2 - grit, vec3(0.35, 0.45, 0.2));
      normal = normalize(normal + vec3(bump * 1.15, 0.0, -bump * 0.85));
    #endif
    diffuseColor.rgb = diffuseColor.rgb * 1.22 + 0.015;
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
  keepClear = [],
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
  keepClear?: { x: number; z: number }[];
}) {
  const { arenaR, squash } = arenaMetrics(cols, rows);
  const groundW = cols * CELL + 26;
  const groundD = rows * CELL + 26;
  const hills = useMemo(
    () => makeHills(groundW, groundD, arenaR, squash, mapId, quality === "high" ? 120 : 56),
    [groundW, groundD, arenaR, squash, mapId, quality],
  );
  const bowl = useMemo(
    () => makeBowl(arenaR, squash, mapId, quality === "high" ? 96 : 48),
    [arenaR, squash, mapId, quality],
  );
  const hillMap = useMemo(() => {
    const tex = ground.clone();
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(mapId === "forge" ? 10 : 8.2, mapId === "forge" ? 7.8 : 6.4);
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
          glow={glow * 0.42}
          tint="#e8e4dc"
        />
      </mesh>
      <GroundPebbles mapId={mapId} arenaR={arenaR} squash={squash} keepClear={keepClear} count={quality === "high" ? 220 : 110} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} position={[0, 0.02, 0]}>
        <ringGeometry args={[arenaR - 0.62, arenaR + 0.22, 96]} />
        <meshStandardMaterial
          color={mapId === "forge" ? "#2c221c" : mapId === "aegis" ? "#1c242c" : "#1a241e"}
          roughness={0.9}
          metalness={0.12}
          emissive={emissive}
          emissiveIntensity={combat ? 0.06 : 0.035}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} position={[0, 0.03, 0]}>
        <torusGeometry args={[arenaR + 1.15, 0.05, 8, 96]} />
        <meshStandardMaterial
          color={mapId === "forge" ? "#3a2c22" : mapId === "aegis" ? "#2a343c" : "#243028"}
          roughness={0.84}
          metalness={0.18}
          emissive={emissive}
          emissiveIntensity={0.04}
        />
      </mesh>
      <ArenaLip mapId={mapId} arenaR={arenaR} squash={squash} emissive={emissive} />
      {quality === "high" ? <HorizonHaze color={fog} accent={emissive} arenaR={arenaR} squash={squash} /> : null}
      {quality === "high" ? <OuterRidges mapId={mapId} arenaR={arenaR} squash={squash} map={hillMap} roughness={roughness} metalness={metalness} emissive={emissive} /> : null}
    </group>
  );
}

function ArenaLip({
  mapId,
  arenaR,
  squash,
  emissive,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  emissive: string;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const count = 64;
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D();
    const r = arenaR + 0.72;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * r, 0.1 + (i % 3) * 0.05, Math.sin(a) * r * squash);
      dummy.rotation.set(0, -a, (i % 2) * 0.12);
      dummy.scale.set(0.95 + (i % 4) * 0.16, 0.85 + (i % 3) * 0.28, 0.58);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [arenaR, squash]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.46, 0.28, 0.3]} />
      <meshStandardMaterial
        color={mapId === "forge" ? "#2a221c" : mapId === "aegis" ? "#1c242c" : "#1a221c"}
        roughness={0.86}
        metalness={0.14}
        emissive={emissive}
        emissiveIntensity={0.03}
      />
    </instancedMesh>
  );
}

function GroundPebbles({
  mapId,
  arenaR,
  squash,
  keepClear,
  count,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  keepClear: { x: number; z: number }[];
  count: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: { x: number; z: number; s: number; a: number }[] = [];
    let s = mapId === "forge" ? 19 : mapId === "aegis" ? 31 : 11;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    let guard = 0;
    while (out.length < count && guard < count * 8) {
      guard += 1;
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * arenaR * 0.92;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad * squash;
      if (keepClear.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 1.35)) continue;
      out.push({ x, z, s: 0.045 + rand() * 0.11, a: rand() * Math.PI * 2 });
    }
    return out;
  }, [arenaR, count, keepClear, mapId, squash]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D();
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      dummy.position.set(p.x, p.s * 0.35, p.z);
      dummy.rotation.set(p.a * 0.3, p.a, p.a * 0.2);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.count = spots.length;
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  const color = mapId === "forge" ? "#3a322c" : mapId === "aegis" ? "#2e3840" : "#1c3328";
  if (!spots.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.88} metalness={mapId === "forge" ? 0.22 : 0.06} />
    </instancedMesh>
  );
}

function SkyShell({ map, fog, accent }: { map: Texture; fog: string; accent: string }) {
  const uniforms = useMemo(
    () => ({
      sky: { value: map },
      fogCol: { value: new Color(fog) },
      accent: { value: new Color(accent) },
      time: { value: 0 },
    }),
    [map, fog, accent],
  );
  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
  });
  return (
    <mesh>
      <sphereGeometry args={[92, 56, 36]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={SPACE_VERT}
        fragmentShader={battleSkyFrag}
        toneMapped={false}
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
        <meshBasicMaterial color={accent} transparent opacity={0.02} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}
