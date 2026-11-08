import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, NormalBlending, Object3D, type InstancedMesh, type Mesh, type MeshBasicMaterial } from "three";
import { softGlowTexture } from "./fx";
import type { MapId } from "@/game/types";
import { scarSigned } from "./PlanetCrust";
import { BevelBox } from "./bevel";
import { SURFACE_KEY, SURFACE_PATCH } from "./surface";
import { terrainElevation, type TerrainShape } from "./terrain";

type Clear = { x: number; z: number };
type Spot = { x: number; y: number; z: number; a: number; k: number; n: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function blocked(x: number, z: number, keep: Clear[], clear: number, center: number) {
  if (x * x + z * z < center * center) return true;
  const c2 = clear * clear;
  for (let i = 0; i < keep.length; i++) {
    const dx = keep[i].x - x;
    const dz = keep[i].z - z;
    if (dx * dx + dz * dz < c2) return true;
  }
  return false;
}

function Flesh({ color, rough = 0.7, glow = 0 }: { color: string; rough?: number; glow?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={0.05}
      emissive={glow ? "#1f6a48" : "#000"}
      emissiveIntensity={glow}
      onBeforeCompile={SURFACE_PATCH.organic}
      customProgramCacheKey={SURFACE_KEY.organic}
    />
  );
}

function Steel({ color, rough = 0.38 }: { color: string; rough?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={0.8}
      onBeforeCompile={SURFACE_PATCH.metal}
      customProgramCacheKey={SURFACE_KEY.metal}
    />
  );
}

function hillSpots(mapId: MapId, arenaR: number, squash: number, count: number, shape?: TerrainShape): Spot[] {
  const rand = rng(mapId === "forge" ? 501 : mapId === "aegis" ? 808 : 303);
  const out: Spot[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard += 1;
    const ang = rand() * Math.PI * 2;
    const inset = 1.12 + rand() * 0.48;
    const x = Math.cos(ang) * arenaR * inset;
    const z = Math.sin(ang) * arenaR * squash * inset;
    const y = terrainElevation(x, z, arenaR, squash, mapId, shape);
    if (y < 0.35) continue;
    if (out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 22)) continue;
    out.push({ x, y: y - 0.12, z, a: rand() * Math.PI * 2, k: rand(), n: out.length });
  }
  return out;
}

function ShelfOutcrop({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0.15, spot.a, spot.k * 0.2]} scale={1.15 + spot.k * 0.45}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.42, 1.1, 7]} />
        <Flesh color="#1a3c2c" rough={0.82} />
      </mesh>
      <mesh position={[0.15, 1.25, 0]} scale={[1.55, 0.38, 1.25]} rotation={[0.2, 0.4, 0.1]} castShadow>
        <sphereGeometry args={[0.7, 14, 10]} />
        <Flesh color="#4e9a70" rough={0.42} glow={0.22} />
      </mesh>
      <mesh position={[-0.35, 0.95, 0.2]} scale={[0.85, 0.22, 0.7]} rotation={[0.3, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.55, 12, 8]} />
        <Flesh color="#3d8a62" rough={0.46} glow={0.16} />
      </mesh>
    </group>
  );
}

function SporeStand({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]}>
      {[0, 1, 2].map((i) => {
        const h = 0.8 + i * 0.45 + spot.k * 0.3;
        const a = i * 2.1;
        return (
          <group key={i} position={[Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28]}>
            <mesh position={[0, h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.09, h, 6]} />
              <Flesh color="#1c4030" />
            </mesh>
            <mesh position={[0, h + 0.08, 0]} castShadow>
              <sphereGeometry args={[0.1 + i * 0.02, 8, 8]} />
              <meshStandardMaterial color="#e7fff2" emissive="#8ef0c4" emissiveIntensity={0.9} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function TerraceBlock({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]} scale={1.05 + spot.k * 0.35}>
      {[0, 1, 2].map((n) => (
        <mesh key={n} position={[n * 0.08, 0.16 + n * 0.28, n * 0.05]} castShadow receiveShadow>
          <BevelBox args={[1.6 - n * 0.28, 0.28, 1.05 - n * 0.16]} />
          <Steel color={n === 1 ? "#3a322c" : "#2a2e32"} rough={0.42} />
        </mesh>
      ))}
      <mesh position={[0.35, 0.95, 0.1]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function SlopeStack({ spot }: { spot: Spot }) {
  const h = 1.6 + spot.k * 0.9;
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <BevelBox args={[0.9, 0.16, 0.9]} />
        <Steel color="#2c3136" />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, h, 8]} />
        <Steel color="#3a322c" rough={0.48} />
      </mesh>
      <mesh position={[0, h + 0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 8]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function FleshBulb({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, spot.k * 0.15]}>
      <mesh position={[0, 0.35, 0]} scale={[0.85, 0.7, 0.75]} castShadow>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshStandardMaterial color="#4e6e58" roughness={0.58} emissive="#24543c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.15, 0.85, 0]} scale={[0.5, 0.6, 0.45]} castShadow>
        <sphereGeometry args={[0.42, 10, 8]} />
        <meshStandardMaterial color="#6d9a72" roughness={0.42} emissive="#2f6a48" emissiveIntensity={0.28} />
      </mesh>
      <mesh position={[0.05, 1.25, 0]} rotation={[0.2, 0, 0.2]} castShadow>
        <coneGeometry args={[0.1, 0.45, 5]} />
        <meshStandardMaterial color="#b7e4d4" emissive="#7ec8b0" emissiveIntensity={0.4} roughness={0.22} />
      </mesh>
    </group>
  );
}

function SteelRib({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0.2, spot.a, 0.25]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <BevelBox args={[0.22, 1.5, 0.48]} />
        <Steel color="#3a444c" />
      </mesh>
      <mesh position={[0.25, 1.15, 0]} rotation={[0, 0, 0.8]} castShadow>
        <BevelBox args={[0.14, 0.7, 0.36]} />
        <Steel color="#2a3238" rough={0.5} />
      </mesh>
      <mesh position={[0, 1.35, 0.2]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#d7f4f8" emissive="#9fd8de" emissiveIntensity={0.85} />
      </mesh>
    </group>
  );
}

export function HillWilds({
  mapId,
  arenaR,
  squash,
  count,
  shape,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  count: number;
  shape?: TerrainShape;
}) {
  const spots = useMemo(
    () => hillSpots(mapId, arenaR, squash, count, shape),
    [arenaR, count, mapId, squash, shape?.relief, shape?.phase],
  );
  return (
    <group name="hill-wilds">
      {spots.map((spot) => {
        if (mapId === "mycelion") {
          return spot.n % 2 === 0 ? <ShelfOutcrop key={spot.n} spot={spot} /> : <SporeStand key={spot.n} spot={spot} />;
        }
        if (mapId === "forge") {
          return spot.n % 2 === 0 ? <TerraceBlock key={spot.n} spot={spot} /> : <SlopeStack key={spot.n} spot={spot} />;
        }
        const flesh = scarSigned(spot.x, spot.z) < 0;
        return flesh ? <FleshBulb key={spot.n} spot={spot} /> : <SteelRib key={spot.n} spot={spot} />;
      })}
    </group>
  );
}

function bedSpots(mapId: MapId, arenaR: number, squash: number, keep: Clear[]): Spot[] {
  const rand = rng(mapId === "forge" ? 640 : mapId === "aegis" ? 770 : 410);
  const out: Spot[] = [];
  let guard = 0;
  while (out.length < 6 && guard < 180) {
    guard += 1;
    const ang = rand() * Math.PI * 2;
    const rad = (0.28 + rand() * 0.5) * arenaR;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad * squash;
    if (Math.hypot(x / arenaR, z / (arenaR * squash)) > 0.78) continue;
    if (blocked(x, z, keep, 5.4, 6.6)) continue;
    if (out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 30)) continue;
    out.push({ x, y: 0.02, z, a: rand() * Math.PI * 2, k: rand(), n: out.length });
  }
  return out;
}

function DampPool({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]} scale={1.3 + spot.k * 0.5}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 18]} />
        <meshStandardMaterial color="#0c2418" roughness={0.35} metalness={0.08} emissive="#143828" emissiveIntensity={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.92, 1.12, 18]} />
        <meshStandardMaterial color="#3d8a62" emissive="#2f6a48" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.25, 0.02, 0.15]}>
        <circleGeometry args={[0.16, 8]} />
        <meshStandardMaterial color="#d8ffe8" emissive="#8ef0c4" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function GrateInset({ spot }: { spot: Spot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]} scale={1.2 + spot.k * 0.35}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.7, 1.15]} />
        <Steel color="#1c2024" rough={0.55} />
      </mesh>
      {[-0.45, -0.15, 0.15, 0.45].map((z) => (
        <mesh key={z} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.9, 0.06]} />
          <Steel color="#3a4046" rough={0.4} />
        </mesh>
      ))}
      <mesh position={[0.7, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 10]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.75} />
      </mesh>
    </group>
  );
}

function BiomePatch({ spot }: { spot: Spot }) {
  const flesh = scarSigned(spot.x, spot.z) < 0;
  if (flesh) {
    return (
      <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]} scale={1.25 + spot.k * 0.4}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.05, 16]} />
          <meshStandardMaterial color="#2a4638" roughness={0.55} emissive="#1f4a34" emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[0.1, 0.04, 0]} rotation={[0.4, 0.3, 0]}>
          <capsuleGeometry args={[0.04, 0.7, 4, 6]} />
          <meshStandardMaterial color="#6d9a72" emissive="#2f6a48" emissiveIntensity={0.3} roughness={0.4} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.a, 0]} scale={1.2 + spot.k * 0.35}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.7, 1.15]} />
        <Steel color="#2c363e" rough={0.28} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[1.1, 0.08]} />
        <meshStandardMaterial color="#d7f4f8" emissive="#9fd8de" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

export function GroundBeds({
  mapId,
  arenaR,
  squash,
  keepClear,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  keepClear: Clear[];
}) {
  const spots = useMemo(() => bedSpots(mapId, arenaR, squash, keepClear), [arenaR, keepClear, mapId, squash]);
  return (
    <group name="ground-beds">
      {spots.map((spot) =>
        mapId === "mycelion" ? (
          <DampPool key={spot.n} spot={spot} />
        ) : mapId === "forge" ? (
          <GrateInset key={spot.n} spot={spot} />
        ) : (
          <BiomePatch key={spot.n} spot={spot} />
        ),
      )}
    </group>
  );
}

/** Planet border around the flat field. Sits outside the lanes. */
export function RimBelt({ mapId, arenaR, squash }: { mapId: MapId; arenaR: number; squash: number }) {
  const pieces = useMemo(() => {
    const n = 26;
    const out: Spot[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.08;
      const r = arenaR + 0.42;
      out.push({
        x: Math.cos(a) * r,
        y: 0,
        z: Math.sin(a) * r * squash,
        a,
        k: ((i * 7) % 10) / 10,
        n: i,
      });
    }
    return out;
  }, [arenaR, squash]);
  return (
    <group name="rim-belt">
      {pieces.map((p) => {
        if (mapId === "mycelion") {
          return (
            <group key={p.n} position={[p.x, 0, p.z]} rotation={[0.35, p.a, 0]}>
              <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.16, 0.7 + p.k * 0.35, 6]} />
                <Flesh color="#1a3228" rough={0.8} />
              </mesh>
              {p.n % 2 === 0 ? (
                <mesh position={[0, 0.72, 0.05]} scale={[0.55, 0.16, 0.4]} castShadow>
                  <sphereGeometry args={[0.7, 10, 8]} />
                  <Flesh color="#3d8a62" rough={0.45} glow={0.18} />
                </mesh>
              ) : null}
            </group>
          );
        }
        if (mapId === "forge") {
          return (
            <group key={p.n} position={[p.x, 0, p.z]} rotation={[0, p.a, 0]}>
              <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
                <BevelBox args={[0.85, 0.32, 0.38]} />
                <Steel color="#2a2e32" rough={0.4} />
              </mesh>
              {p.n % 4 === 0 ? (
                <mesh position={[0, 0.7, 0]} castShadow>
                  <cylinderGeometry args={[0.1, 0.14, 0.7, 6]} />
                  <Steel color="#3a322c" rough={0.46} />
                </mesh>
              ) : null}
              {p.n % 4 === 0 ? (
                <mesh position={[0, 1.08, 0]}>
                  <sphereGeometry args={[0.06, 6, 6]} />
                  <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.9} />
                </mesh>
              ) : null}
            </group>
          );
        }
        const near = Math.abs(scarSigned(p.x, p.z)) < 1.4;
        const flesh = scarSigned(p.x, p.z) < 0;
        return (
          <group key={p.n} position={[p.x, 0, p.z]} rotation={[0, p.a, flesh ? 0.1 : 0]}>
            {flesh ? (
              <mesh position={[0, 0.22, 0]} scale={[0.7, 0.4, 0.5]} castShadow>
                <sphereGeometry args={[0.45, 10, 8]} />
                <meshStandardMaterial color="#3d5c48" roughness={0.62} emissive="#1f4a34" emissiveIntensity={0.16} />
              </mesh>
            ) : (
              <mesh position={[0, 0.14, 0]} castShadow>
                <BevelBox args={[0.7, 0.26, 0.36]} />
                <Steel color="#343c44" />
              </mesh>
            )}
            {near ? (
              <mesh position={[0, 0.32, 0]}>
                <sphereGeometry args={[0.07, 6, 6]} />
                <meshStandardMaterial color="#e7f6f8" emissive="#b7e4ea" emissiveIntensity={0.8} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

/** Framing on either side of a lane mouth. Local +X is across the path. */
export function GateMouth({ mapId, yaw }: { mapId: MapId; yaw: number }) {
  return (
    <group rotation={[0, yaw, 0]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.9, 0, 0]}>
          {mapId === "mycelion" ? (
            <>
              <mesh position={[0, 0.7, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.22, 1.4, 7]} />
                <Flesh color="#1c4030" />
              </mesh>
              <mesh position={[0, 1.55, 0]} scale={[0.85, 0.28, 0.85]} castShadow>
                <sphereGeometry args={[0.7, 12, 10]} />
                <Flesh color="#5aaa78" rough={0.4} glow={0.24} />
              </mesh>
            </>
          ) : mapId === "forge" ? (
            <>
              <mesh position={[0, 0.75, 0]} castShadow>
                <BevelBox args={[0.28, 1.5, 0.4]} />
                <Steel color="#2a2e32" />
              </mesh>
              <mesh position={[0, 1.55, 0]}>
                <BevelBox args={[0.34, 0.1, 0.46]} />
                <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.85} />
              </mesh>
            </>
          ) : side < 0 ? (
            <mesh position={[0, 0.45, 0]} scale={[0.7, 0.85, 0.6]} castShadow>
              <sphereGeometry args={[0.5, 12, 10]} />
              <meshStandardMaterial color="#4e6e58" roughness={0.55} emissive="#24543c" emissiveIntensity={0.22} />
            </mesh>
          ) : (
            <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0.18]} castShadow>
              <BevelBox args={[0.22, 1.4, 0.46]} />
              <Steel color="#3a444c" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function PlanetAir({ mapId, count = 64 }: { mapId: MapId; count?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const rand = rng(mapId === "forge" ? 17 : mapId === "aegis" ? 29 : 5);
    return Array.from({ length: count }, () => ({
      x: (rand() - 0.5) * 44,
      y: rand() * 6,
      z: (rand() - 0.5) * 40,
      s: 0.045 + rand() * (mapId === "mycelion" ? 0.09 : 0.04),
      p: rand() * Math.PI * 2,
    }));
  }, [count, mapId]);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const rise = mapId === "forge" ? 0.75 : mapId === "mycelion" ? 0.28 : 0.16;
    const drift = mapId === "aegis" ? 0.22 : 0.05;
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      p.y += dt * rise;
      p.x += dt * Math.sin(p.p + p.y) * drift;
      if (p.y > 6.8) p.y = 0.12;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  const color = mapId === "forge" ? "#ff8a3c" : mapId === "aegis" ? "#c5eef2" : "#d8ffe8";
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 5]} />
      <meshBasicMaterial color={color} transparent opacity={mapId === "forge" ? 0.82 : 0.58} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

const MIST: Record<MapId, { color: string; add: boolean; opacity: number; rise: number }> = {
  mycelion: { color: "#6fe8c0", add: true, opacity: 0.1, rise: 0.22 },
  forge: { color: "#3a2418", add: false, opacity: 0.2, rise: 0.38 },
  aegis: { color: "#cfe8f2", add: false, opacity: 0.13, rise: 0.12 },
};

/** Low drifting banks that give the field depth. They sit under the hosts, never over the lanes' read. */
export function GroundMist({
  mapId,
  arenaR,
  squash,
  count = 14,
  strength = 1,
  color,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  count?: number;
  strength?: number;
  color?: string;
}) {
  const tex = useMemo(() => softGlowTexture(), []);
  const banks = useMemo(() => {
    const rand = rng(mapId === "forge" ? 91 : mapId === "aegis" ? 83 : 71);
    return Array.from({ length: count }, (_, i) => {
      const a = rand() * Math.PI * 2;
      const r = (0.35 + rand() * 0.8) * arenaR;
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r * squash,
        y: 0.14 + rand() * 0.5,
        s: 4.5 + rand() * 6,
        spin: (rand() - 0.5) * 0.06,
        drift: (rand() - 0.5) * 0.18,
        phase: rand() * Math.PI * 2,
        k: i,
      };
    });
  }, [arenaR, count, mapId, squash]);
  const refs = useRef<(Mesh | null)[]>([]);
  const cfg = MIST[mapId];
  useFrame((s, dt) => {
    for (let i = 0; i < banks.length; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const b = banks[i];
      m.rotation.z += dt * b.spin;
      m.position.x = b.x + Math.sin(s.clock.elapsedTime * 0.12 + b.phase) * 1.4 * (b.drift > 0 ? 1 : -1);
      const mat = m.material as MeshBasicMaterial;
      mat.opacity = cfg.opacity * strength * (0.72 + Math.sin(s.clock.elapsedTime * 0.3 + b.phase) * 0.28);
    }
  });
  if (!tex) return null;
  return (
    <group name="ground-mist">
      {banks.map((b, i) => (
        <mesh
          key={b.k}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, b.phase]}
          position={[b.x, b.y, b.z]}
          scale={[b.s, b.s * 0.7, 1]}
          renderOrder={2}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={tex}
            color={color ?? cfg.color}
            transparent
            opacity={cfg.opacity * strength}
            depthWrite={false}
            blending={cfg.add ? AdditiveBlending : NormalBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
