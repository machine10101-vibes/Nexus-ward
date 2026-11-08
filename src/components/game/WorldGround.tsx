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
  type WebGLProgramParametersWithUniforms,
} from "three";
import { CELL } from "@/game/config";
import type { MapId } from "@/game/types";
import { PlanetCrust, scarSigned } from "./PlanetCrust";
import { surfaceTime } from "./surface";
import { GroundBeds, GroundMist, HillWilds, RimBelt } from "./PlanetWilds";
import { SPACE_VERT, STAR_GLSL } from "./spaceField";
import { arenaMetrics, clamp, smooth, terrainElevation, type TerrainShape } from "./terrain";

export { arenaMetrics, terrainElevation };

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

function makeHills(w: number, d: number, arenaR: number, squash: number, style: MapId, res: number, shape?: TerrainShape) {
  const g = new PlaneGeometry(w, d, res, Math.max(24, Math.round(res * (d / w))));
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const ao = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainElevation(x, z, arenaR, squash, style, shape);
    pos.setY(i, y);
    const grain = Math.sin(x * 0.55) * Math.cos(z * 0.48) * 0.06 + Math.sin(x * 1.9 + z * 1.4) * 0.03;
    const shade = clamp(0.78 + y * 0.03 + grain, 0.62, 1.04);
    if (style === "forge") {
      const step = Math.abs(y * 1.7 - Math.round(y * 1.7));
      const riser = 1 - clamp((0.18 - step) * 3.2, 0, 0.45);
      const ember = y < 1.35 ? 0.16 : 0;
      ao.setRGB(shade * 1.14 * riser + ember, shade * 0.74 * riser + ember * 0.35, shade * 0.52 * riser);
    } else if (style === "aegis") {
      const signed = scarSigned(x, z);
      const rift = Math.exp(-signed * signed * 0.12);
      if (signed < 0) ao.setRGB(shade * 0.62, shade * 0.98, shade * 0.66);
      else ao.setRGB(shade * 0.58, shade * 0.7, shade * 1.02);
      ao.r += rift * 0.22;
      ao.g += rift * 0.28;
      ao.b += rift * 0.34;
    } else {
      const canyon = Math.abs(Math.sin(x * 0.09 + z * 0.045));
      const floor = canyon < 0.22 ? 0.72 : 1;
      const cap = y > 3.4 ? 1.12 : 1;
      ao.setRGB(shade * 0.7 * floor, shade * 1.08 * cap, shade * 0.74 * floor);
    }
    cols[i * 3] = ao.r;
    cols[i * 3 + 1] = ao.g;
    cols[i * 3 + 2] = ao.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function makeBowl(arenaR: number, squash: number, style: MapId, res: number) {
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
        ? 0.82 + Math.sin(x * 1.7) * Math.cos(y * 1.4) * 0.1
        : style === "forge"
          ? 0.8 + ((Math.sin(x * 3.1) * Math.sin(y * 3.1) + 1) * 0.08)
          : 0.84 + Math.abs(Math.sin(x * 0.9 + y * 1.2)) * 0.08;
    const grain = Math.sin(x * 7.4) * Math.cos(y * 6.2) * 0.05 + Math.sin(x * 14.1 + y * 9.6) * 0.03;
    const blotch = Math.sin(x * 0.36 + y * 0.29) * Math.cos(y * 0.24) * 0.08;
    let tint = style === "mycelion" ? [0.72, 1.02, 0.7] : style === "forge" ? [1.12, 0.84, 0.68] : [0.78, 0.9, 1.05];
    const macro = Math.sin(x * 0.13 + 1.3) * Math.sin(y * 0.11) * 0.5 + Math.sin(x * 0.31 - y * 0.27) * 0.25;
    let k = clamp((speckle + grain + blotch) * (1 + macro * 0.24) - rim * 0.16, 0.46, 1.12);
    if (style === "mycelion") tint = [tint[0] * (1 + macro * 0.26), tint[1], tint[2] * (1 - macro * 0.2)];
    else if (style === "forge") tint = [tint[0], tint[1] * (1 + macro * 0.18), tint[2] * (1 - macro * 0.1)];
    if (style === "mycelion") {
      const mott = Math.pow(clamp(Math.sin(x * 0.62) * Math.cos(y * 0.48) * 0.5 + 0.5, 0, 1), 2) * 0.22;
      tint = [tint[0] * (1 - mott) + 0.55 * mott, tint[1] * (1 - mott) + 1.05 * mott, tint[2] * (1 - mott) + 0.72 * mott];
    } else if (style === "forge") {
      const fx = Math.abs(x / 4.2 - Math.round(x / 4.2));
      const fy = Math.abs(y / 4.2 - Math.round(y / 4.2));
      const seam = clamp((0.06 - Math.min(fx, fy)) * 8, 0, 1);
      k *= 1 - seam * 0.32;
    } else {
      const signed = scarSigned(x, -y * squash);
      const flesh = signed < 0;
      const side = flesh ? [0.58, 1.08, 0.66] : [0.58, 0.7, 1.12];
      tint = [tint[0] * 0.35 + side[0] * 0.65, tint[1] * 0.35 + side[1] * 0.65, tint[2] * 0.35 + side[2] * 0.65];
    }
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

const LIFE_COMMON = /* glsl */ `
varying vec2 vWXZ;
uniform float uSurfT;
float lgh(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float lgn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(lgh(i), lgh(i + vec2(1.0, 0.0)), f.x), mix(lgh(i + vec2(0.0, 1.0)), lgh(i + vec2(1.0, 1.0)), f.x), f.y);
}
float lridge(vec2 p) {
  vec2 q = p + 0.9 * vec2(lgn(p * 0.7 + 4.0), lgn(p * 0.7 + 9.0));
  return 1.0 - abs(2.0 * lgn(q) - 1.0);
}
`;

const LIFE: Record<MapId, string> = {
  mycelion: /* glsl */ `
    float lr1 = lridge(vWXZ * (0.55 * VEIN));
    float lr2 = lridge(vWXZ * (1.35 * VEIN) + 7.0);
    float lw = fwidth(lr1) * 1.6;
    float lline = smoothstep(0.972 - lw, 0.993, lr1) + 0.5 * smoothstep(0.982 - lw, 0.996, lr2);
    float lpulse = 0.5 + 0.5 * sin(uSurfT * 0.9 + lgn(vWXZ * 0.3) * 12.0);
    lline *= 1.0 - smoothstep(0.35, 1.2, lw);
    totalEmissiveRadiance += vec3(0.16, 0.9, 0.58) * lline * (0.3 + lpulse * 0.7) * 0.7 * LIFE_K;
    diffuseColor.rgb *= 1.0 - lline * 0.12 * LIFE_K;
  `,
  forge: /* glsl */ `
    float lr1 = lridge(vWXZ * (0.4 * VEIN) + 3.0);
    float lw = fwidth(lr1) * 1.6;
    float lcrack = smoothstep(0.982 - lw, 0.996, lr1);
    float lhalo = smoothstep(0.93, 0.995, lr1) * 0.2;
    float lheat = 0.7 + 0.3 * sin(uSurfT * 1.7 + lgn(vWXZ * 0.45) * 9.0) * sin(uSurfT * 0.6 + vWXZ.x * 0.2);
    float lfade = 1.0 - smoothstep(0.35, 1.2, lw);
    totalEmissiveRadiance += vec3(1.0, 0.36, 0.07) * (lcrack * lheat * 1.2 + lhalo * 0.4) * lfade * LIFE_K;
    diffuseColor.rgb *= 1.0 - lcrack * lfade * 0.4 * LIFE_K;
  `,
  aegis: /* glsl */ `
    vec2 lsp = vWXZ * (6.0 * VEIN);
    vec2 lid = floor(lsp);
    float lh = lgh(lid);
    float ltw = step(0.93, lh) * (0.45 + 0.55 * sin(uSurfT * 2.4 + lh * 60.0));
    float ld = smoothstep(0.3, 0.0, length(fract(lsp) - 0.5));
    float lfade = 1.0 - smoothstep(0.5, 1.4, fwidth(lsp.x));
    totalEmissiveRadiance += vec3(0.75, 0.92, 1.0) * max(ltw, 0.0) * ld * lfade * 2.4 * LIFE_K;
    float lcr = lridge(vWXZ * (0.28 * VEIN) + 11.0);
    float lcw = fwidth(lcr) * 1.6;
    float lcrev = smoothstep(0.978 - lcw, 0.995, lcr) * (1.0 - smoothstep(0.35, 1.2, lcw));
    diffuseColor.rgb *= 1.0 - lcrev * 0.55 * LIFE_K;
    totalEmissiveRadiance += vec3(0.1, 0.5, 0.65) * lcrev * 0.5 * LIFE_K;
    float lband = sin(vWXZ.x * 0.12 + uSurfT * 0.18 + lgn(vWXZ * 0.07) * 6.0) * 0.5 + 0.5;
    totalEmissiveRadiance += vec3(0.1, 0.4, 0.46) * lband * lband * 0.34 * LIFE_K;
  `,
};

function glowPatch(shader: WebGLProgramParametersWithUniforms, strength: number, biome: boolean, style: MapId, life: number, vein: number) {
  shader.uniforms.uSurfT = surfaceTime;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec2 vWXZ;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${LIFE_COMMON}`);
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
    ${
      biome
        ? `float side = vColor.g - vColor.b;
    vec3 biomeCol = side > 0.02 ? vec3(0.2, 0.46, 0.26) : vec3(0.24, 0.32, 0.48);
    diffuseColor.rgb = mix(diffuseColor.rgb, biomeCol, 0.5);`
        : ""
    }
    diffuseColor.rgb = diffuseColor.rgb * 1.22 + 0.015;
    float teal = max(diffuseColor.b * 0.88 + diffuseColor.g * 0.32 - diffuseColor.r * 0.72 - 0.18, 0.0);
    float ember = max(diffuseColor.r * 0.82 + diffuseColor.g * 0.26 - diffuseColor.b * 0.78 - 0.2, 0.0);
    float vein = max(teal, ember);
    totalEmissiveRadiance += emissive * vein * ${strength.toFixed(2)};
    ${LIFE[style].replaceAll("LIFE_K", life.toFixed(2)).replaceAll("VEIN", vein.toFixed(2))}
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
  biome = false,
  style,
  life = 1,
  vein = 1,
}: {
  style: MapId;
  life?: number;
  vein?: number;
  map: Texture;
  roughness: number;
  metalness: number;
  emissive: string;
  glow: number;
  tint?: string;
  biome?: boolean;
}) {
  return (
    <meshStandardMaterial
      key={`${style}-${biome ? "split" : "whole"}-${life}-${vein}`}
      map={map}
      color={tint}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive}
      emissiveIntensity={0.28}
      vertexColors
      envMapIntensity={0.3}
      customProgramCacheKey={() => `${style}-${biome ? "split" : "whole"}-${life}-${vein}`}
      onBeforeCompile={(shader) => glowPatch(shader, glow, biome, style, life, vein)}
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
  shape,
  life = 1,
  vein = 1,
  hillTint,
  groundTint,
  mist = 1,
  mistColor,
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
  shape?: TerrainShape;
  /** Hill life. The arena uses about half of this so the lanes stay readable. */
  life?: number;
  vein?: number;
  hillTint?: string;
  groundTint?: string;
  mist?: number;
  mistColor?: string;
}) {
  const { arenaR, squash } = arenaMetrics(cols, rows);
  const groundW = cols * CELL + 26;
  const groundD = rows * CELL + 26;
  const hills = useMemo(
    () => makeHills(groundW, groundD, arenaR, squash, mapId, quality === "high" ? 120 : 56, shape),
    [groundW, groundD, arenaR, squash, mapId, quality, shape?.relief, shape?.phase],
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
        <GroundMat
          style={mapId}
          map={hillMap}
          roughness={roughness}
          metalness={metalness}
          emissive={emissive}
          glow={glow}
          tint={hillTint}
          life={life}
          vein={vein}
          biome={mapId === "aegis"}
        />
      </mesh>
      <mesh geometry={bowl} rotation={[-Math.PI / 2, 0, 0]} scale={[1, squash, 1]} receiveShadow>
        <GroundMat
          style={mapId}
          life={life * 0.45}
          vein={vein}
          map={ground}
          roughness={roughness * 0.92}
          metalness={metalness + 0.06}
          emissive={emissive}
          glow={glow * 0.42}
          tint={groundTint ?? (mapId === "aegis" ? "#aab6c2" : "#e8e4dc")}
          biome={mapId === "aegis"}
        />
      </mesh>
      <GroundPebbles mapId={mapId} arenaR={arenaR} squash={squash} keepClear={keepClear} count={quality === "high" ? 220 : 110} />
      <PlanetCrust mapId={mapId} arenaR={arenaR} squash={squash} keepClear={keepClear} />
      <GroundBeds mapId={mapId} arenaR={arenaR} squash={squash} keepClear={keepClear} />
      <HillWilds mapId={mapId} arenaR={arenaR} squash={squash} count={quality === "high" ? 16 : 8} shape={shape} />
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
      <RimBelt mapId={mapId} arenaR={arenaR} squash={squash} />
      {quality === "high" ? <GroundMist mapId={mapId} arenaR={arenaR} squash={squash} strength={mist} color={mistColor} /> : null}
      {quality === "high" ? <HorizonHaze color={fog} accent={emissive} arenaR={arenaR} squash={squash} /> : null}
      {quality === "high" ? (
        <OuterRidges
          mapId={mapId}
          arenaR={arenaR}
          squash={squash}
          map={hillMap}
          roughness={roughness}
          metalness={metalness}
          emissive={emissive}
          shape={shape}
          vein={vein}
          tint={hillTint}
        />
      ) : null}
    </group>
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
  shape,
  vein,
  tint,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  map: Texture;
  roughness: number;
  metalness: number;
  emissive: string;
  shape?: TerrainShape;
  vein: number;
  tint?: string;
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
      pos.setY(i, terrainElevation(x, z * squash, arenaR, squash, mapId, shape) + band * 1.65);
    }
    g.computeVertexNormals();
    return g;
  }, [arenaR, squash, mapId, shape?.relief, shape?.phase]);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <GroundMat style={mapId} map={map} roughness={roughness} metalness={metalness} emissive={emissive} glow={1.6} vein={vein} tint={tint} biome={mapId === "aegis"} />
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
