import { useMemo } from "react";
import type { MapId } from "@/game/types";

/**
 * The scar of Aegis, in world XZ. Tissue sits on the negative side, steel on
 * the positive. The offset keeps the trench beside the keep.
 * Direction is (0.8116, 0.5843); the perpendicular is (-0.5843, 0.8116).
 */
export const SCAR_PX = -0.5843;
export const SCAR_PZ = 0.8116;
export const SCAR_OFFSET = 3.6;

export function scarSigned(x: number, z: number) {
  return x * SCAR_PX + z * SCAR_PZ - SCAR_OFFSET;
}

type Clear = { x: number; z: number };
type Site = { x: number; z: number; a: number; k: number; j: number; n: number };

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

function inside(x: number, z: number, arenaR: number, squash: number, margin: number) {
  return Math.hypot(x / arenaR, z / (arenaR * squash)) < margin;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function sites(
  seed: number,
  count: number,
  arenaR: number,
  squash: number,
  keep: Clear[],
  clear: number,
  center: number,
): Site[] {
  const rand = rng(seed);
  const out: Site[] = [];
  let guard = 0;
  while (out.length < count && guard < 240) {
    guard += 1;
    const ang = rand() * Math.PI * 2;
    const rad = (0.26 + rand() * 0.55) * arenaR;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad * squash;
    if (!inside(x, z, arenaR, squash, 0.8)) continue;
    if (blocked(x, z, keep, clear, center)) continue;
    if (out.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < 42)) continue;
    out.push({ x, z, a: rand() * Math.PI * 2, k: rand(), j: rand() * 2 - 1, n: out.length });
  }
  return out;
}

function Flesh({ color, rough = 0.72, glow = 0 }: { color: string; rough?: number; glow?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={0.06} emissive={glow ? "#1f6a48" : "#000"} emissiveIntensity={glow} />;
}

function Steel({ color, rough = 0.38 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={0.82} />;
}

/** A living shelf: wet mound, overlapping caps, a marrow cleft, spore stalks. */
function MarrowGrove({ site }: { site: Site }) {
  const s = 1.85 + site.k * 0.45 + (site.n === 0 ? 0.4 : 0);
  const caps = [
    { x: -0.48, y: 0.34, z: 0.1, rx: 0.78, ry: 0.28, rz: 0.58, rot: 0.4, c: "#3d8a62" },
    { x: 0.22, y: 0.46, z: -0.18, rx: 0.66, ry: 0.24, rz: 0.5, rot: -0.55, c: "#4e9a70" },
    { x: 0.06, y: 0.58, z: 0.26, rx: 0.5, ry: 0.2, rz: 0.4, rot: 0.9, c: "#62b484" },
    { x: -0.16, y: 0.26, z: -0.32, rx: 0.55, ry: 0.18, rz: 0.4, rot: 1.6, c: "#2a6848" },
  ];
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]} scale={s}>
      <mesh position={[0.02, 0.1, 0]} scale={[1.2, 0.32, 0.95]} castShadow receiveShadow>
        <sphereGeometry args={[0.78, 18, 14]} />
        <Flesh color="#173528" rough={0.9} />
      </mesh>
      <mesh position={[-0.35, 0.08, 0.2]} scale={[0.7, 0.24, 0.55]} castShadow>
        <sphereGeometry args={[0.55, 14, 10]} />
        <Flesh color="#12281e" rough={0.92} />
      </mesh>
      {caps.map((cap) => (
        <group key={`${cap.x}-${cap.z}`} position={[cap.x, cap.y, cap.z]} rotation={[0.15, cap.rot, site.j * 0.08]}>
          <mesh scale={[cap.rx, cap.ry, cap.rz]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
            <Flesh color={cap.c} rough={0.48} glow={0.18} />
          </mesh>
          <mesh position={[0, -cap.ry * 0.65, 0]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[cap.rx * 1.15, 0.015, cap.rz * 0.18]} />
            <meshStandardMaterial color="#102018" roughness={0.8} />
          </mesh>
          <mesh position={[0, -cap.ry * 0.65, 0.08]} rotation={[0.2, 0.4, 0]}>
            <boxGeometry args={[cap.rx * 0.9, 0.012, cap.rz * 0.12]} />
            <meshStandardMaterial color="#102018" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.12, 0.18, -0.02]} rotation={[0.2, 0.5 + site.j * 0.2, 0.1]} castShadow>
        <boxGeometry args={[0.07, 0.05, 0.72]} />
        <meshStandardMaterial color="#08140e" roughness={1} />
      </mesh>
      <mesh position={[0.12, 0.2, -0.02]} rotation={[0.2, 0.5 + site.j * 0.2, 0.1]}>
        <capsuleGeometry args={[0.018, 0.42, 4, 6]} />
        <meshStandardMaterial color="#b7f0d4" emissive="#7ddec0" emissiveIntensity={0.7} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = site.a * 0.2 + i * 1.25;
        const rad = 0.55 + (i % 3) * 0.18;
        const h = 0.55 + (i % 2) * 0.35;
        return (
          <group key={i} position={[Math.cos(a) * rad, 0, Math.sin(a) * rad * 0.8]}>
            <mesh position={[0, h * 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.02, 0.035, h, 6]} />
              <Flesh color="#1a3a2a" />
            </mesh>
            <mesh position={[0, h + 0.04, 0]} castShadow>
              <sphereGeometry args={[0.055 + (i % 2) * 0.02, 10, 8]} />
              <meshStandardMaterial color="#d8ffe8" emissive="#8ef0c4" emissiveIntensity={0.85} roughness={0.28} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function PlateYard({ site }: { site: Site }) {
  const s = 1.7 + site.k * 0.35;
  const rivets = [
    [-0.72, -0.42],
    [0.72, -0.42],
    [-0.72, 0.42],
    [0.72, 0.42],
    [0, -0.42],
    [0, 0.42],
  ];
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]} scale={s}>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.08, 1.25]} />
        <Steel color="#2a2e32" />
      </mesh>
      <mesh position={[0.06, 0.09, -0.04]} rotation={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.05, 0.82]} />
        <Steel color="#3a4046" rough={0.32} />
      </mesh>
      <mesh position={[0.78, 0.1, 0.42]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.28, 0.06, 0.22]} />
        <Steel color="#4a4038" rough={0.46} />
      </mesh>
      {rivets.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.09, z]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.04, 8]} />
          <Steel color="#6a6258" rough={0.28} />
        </mesh>
      ))}
      <mesh position={[-0.15, 0.14, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.045, 8, 16]} />
        <Steel color="#241c18" rough={0.55} />
      </mesh>
      <mesh position={[-0.15, 0.15, 0.08]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.9} roughness={0.4} />
      </mesh>
      <mesh position={[0.35, 0.13, -0.28]} castShadow>
        <boxGeometry args={[0.55, 0.04, 0.06]} />
        <Steel color="#1c2024" rough={0.5} />
      </mesh>
      <mesh position={[0.35, 0.13, -0.16]} castShadow>
        <boxGeometry args={[0.55, 0.04, 0.06]} />
        <Steel color="#1c2024" rough={0.5} />
      </mesh>
    </group>
  );
}

function SlagHeap({ site }: { site: Site }) {
  const cones = [
    { x: 0, z: 0, r: 0.62, h: 0.85 },
    { x: 0.42, z: 0.16, r: 0.4, h: 0.55 },
    { x: -0.34, z: 0.12, r: 0.36, h: 0.48 },
    { x: 0.08, z: -0.36, r: 0.32, h: 0.4 },
  ];
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]} scale={1.65 + site.k * 0.4}>
      {cones.map((c) => (
        <mesh key={`${c.x}-${c.z}`} position={[c.x, c.h * 0.45, c.z]} castShadow>
          <coneGeometry args={[c.r, c.h, 7]} />
          <meshStandardMaterial color="#2a211c" roughness={0.94} metalness={0.18} />
        </mesh>
      ))}
      <mesh position={[0.08, 0.2, 0.02]} rotation={[0.4, 0.2, 0.6]}>
        <boxGeometry args={[0.04, 0.03, 0.42]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.85} roughness={0.45} />
      </mesh>
      <mesh position={[-0.05, 0.16, 0.1]} rotation={[0.2, 1.1, 0.3]}>
        <boxGeometry args={[0.03, 0.025, 0.28]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0.22, 0.34, 0.08]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#ffd0a8" emissive="#ff8a3c" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function CoolerBank({ site }: { site: Site }) {
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]} scale={1.6 + site.k * 0.35}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.08, 0.7]} />
        <Steel color="#2c3136" />
      </mesh>
      {[-0.55, -0.28, 0, 0.28, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.56, 0]} castShadow>
          <boxGeometry args={[0.1, 0.95, 0.55]} />
          <Steel color={x === 0 ? "#4a4038" : "#3a4248"} rough={0.34} />
        </mesh>
      ))}
      <mesh position={[0, 0.18, 0.42]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.45, 8]} />
        <Steel color="#2a2622" rough={0.42} />
      </mesh>
      <mesh position={[0.62, 0.18, 0.42]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.16, 8]} />
        <Steel color="#3a322c" rough={0.4} />
      </mesh>
      <mesh position={[-0.72, 0.16, -0.22]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#ffb080" emissive="#e2661c" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

/** Steel torn open, tissue grown through the break, a short weld bead on the join. */
function WeldScar({ site }: { site: Site }) {
  const s = 1.65 + site.k * 0.4 + (site.n === 0 ? 0.3 : 0);
  const beads = [-0.28, -0.14, 0, 0.14, 0.28];
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]} scale={s}>
      <mesh position={[-0.28, 0.05, 0]} rotation={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.08, 0.78]} />
        <Steel color="#3a4248" rough={0.36} />
      </mesh>
      <mesh position={[-0.72, 0.08, 0.22]} rotation={[0.2, 0.5, 0.4]} castShadow>
        <boxGeometry args={[0.34, 0.05, 0.22]} />
        <Steel color="#2a3036" rough={0.5} />
      </mesh>
      <mesh position={[0.42, 0.16, 0.02]} scale={[0.72, 0.42, 0.62]} castShadow>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshStandardMaterial color="#4e6e58" roughness={0.58} metalness={0.08} emissive="#24543c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.62, 0.28, -0.08]} rotation={[0.4, 0.2, 0.5]} castShadow>
        <capsuleGeometry args={[0.06, 0.28, 4, 6]} />
        <meshStandardMaterial color="#6d9a72" roughness={0.4} emissive="#2f6a48" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.22, 0.34, 0.16]} rotation={[0.3, 0, 0.2]} castShadow>
        <coneGeometry args={[0.08, 0.36, 5]} />
        <meshStandardMaterial color="#9fd4c4" emissive="#7ec8b0" emissiveIntensity={0.35} roughness={0.22} transparent opacity={0.85} />
      </mesh>
      {beads.map((z) => (
        <mesh key={z} position={[0.05, 0.12, z]} castShadow>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#e7f6f8" emissive="#b7e4ea" emissiveIntensity={0.75} roughness={0.25} metalness={0.4} />
        </mesh>
      ))}
      {[-0.55, -0.2, 0.05].map((z) => (
        <mesh key={z} position={[-0.55, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.04, 6]} />
          <Steel color="#8a8478" rough={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** Two lips of broken ground along the rift, with a thin light in the crack. */
function ScarTrench({
  arenaR,
  squash,
  keepClear,
}: {
  arenaR: number;
  squash: number;
  keepClear: Clear[];
}) {
  const bits = useMemo(() => {
    const out: { x: number; z: number; side: number; k: number; yaw: number; crack: boolean }[] = [];
    const dx = 0.8116;
    const dz = 0.5843;
    const rand = rng(909);
    for (let t = -arenaR * 1.05; t <= arenaR * 1.05; t += 1.15) {
      const x = SCAR_PX * SCAR_OFFSET + dx * t;
      const z = SCAR_PZ * SCAR_OFFSET + dz * t;
      if (!inside(x, z, arenaR, squash, 0.9)) continue;
      if (blocked(x, z, keepClear, 1.8, 3.2)) continue;
      const yaw = Math.atan2(dx, dz);
      out.push({ x: x + SCAR_PX * -0.55, z: z + SCAR_PZ * -0.55, side: -1, k: rand(), yaw, crack: false });
      out.push({ x, z, side: 0, k: 0, yaw, crack: true });
      out.push({ x: x + SCAR_PX * 0.55, z: z + SCAR_PZ * 0.55, side: 1, k: rand(), yaw, crack: false });
    }
    return out;
  }, [arenaR, keepClear, squash]);
  return (
    <group>
      {bits.map((b, i) => {
        if (b.crack) {
          return (
            <group key={i} position={[b.x, 0.04, b.z]} rotation={[0, b.yaw, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.16, 0.85]} />
                <meshBasicMaterial color="#8ec8d0" transparent opacity={0.34} depthWrite={false} />
              </mesh>
            </group>
          );
        }
        const flesh = b.side < 0;
        const h = 0.42 + b.k * 0.55;
        return (
          <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.yaw + b.k, 0]} scale={1.55}>
            {flesh ? (
              <mesh position={[0, h * 0.4, 0]} scale={[0.55 + b.k * 0.35, h, 0.4 + b.k * 0.2]} castShadow>
                <sphereGeometry args={[0.45, 10, 8]} />
                <meshStandardMaterial color="#3d5c48" roughness={0.7} emissive="#1f4a34" emissiveIntensity={0.12} />
              </mesh>
            ) : (
              <mesh position={[0, h * 0.35, 0]} rotation={[0.1, 0, 0.15]} castShadow>
                <boxGeometry args={[0.42 + b.k * 0.3, h * 0.7, 0.28 + b.k * 0.15]} />
                <meshStandardMaterial color="#343c44" metalness={0.78} roughness={0.4} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function rimSites(arenaR: number, squash: number, keep: Clear[]): Site[] {
  const out: Site[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.35;
    const x = Math.cos(ang) * arenaR * 0.86;
    const z = Math.sin(ang) * arenaR * squash * 0.86;
    if (blocked(x, z, keep, 3.6, 8)) continue;
    out.push({ x, z, a: ang + Math.PI, k: (i % 3) / 3, j: i % 2 === 0 ? 1 : -1, n: out.length });
  }
  return out.slice(0, 4);
}

/** A canopy tall enough to read from orbit: stalk, cap, gills. */
function FungalCrown({ site }: { site: Site }) {
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]}>
      <mesh position={[0, 0.15, 0]} scale={[1.1, 0.2, 1.1]} receiveShadow>
        <sphereGeometry args={[0.8, 14, 10]} />
        <Flesh color="#14281c" rough={0.92} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.38, 1.5, 8]} />
        <Flesh color="#1c4030" rough={0.75} />
      </mesh>
      <mesh position={[0, 1.85, 0]} scale={[1.85, 0.48, 1.85]} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
        <Flesh color="#5aaa78" rough={0.4} glow={0.28} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[0, 1.55, 0]} rotation={[0.35, (i / 6) * Math.PI * 2, 0]} castShadow>
          <boxGeometry args={[0.08, 0.04, 1.35]} />
          <meshStandardMaterial color="#102418" roughness={0.8} />
        </mesh>
      ))}
      {[0.7, -0.55].map((x) => (
        <mesh key={x} position={[x, 2.05, 0.2]} castShadow>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color="#e7fff2" emissive="#8ef0c4" emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** A foundry stack: banded chimney, ember mouth, plate footing. */
function FoundryStack({ site }: { site: Site }) {
  return (
    <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.16, 1.6]} />
        <Steel color="#2a2e32" />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.42, 2.1, 10]} />
        <Steel color="#3a322c" rough={0.48} />
      </mesh>
      {[0.55, 1.15, 1.7].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.48, 0.48, 0.08, 10]} />
          <Steel color="#4a4038" rough={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 2.28, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.16, 10]} />
        <meshStandardMaterial color="#ffb080" emissive="#e25a1c" emissiveIntensity={1} roughness={0.4} />
      </mesh>
      <mesh position={[0.55, 0.28, 0]} castShadow>
        <boxGeometry args={[0.45, 0.28, 0.35]} />
        <Steel color="#241c18" rough={0.7} />
      </mesh>
    </group>
  );
}

/** One side of the rift grows, the other is torn plate. */
function RiftMonument({ site }: { site: Site }) {
  const flesh = scarSigned(site.x, site.z) < 0;
  if (flesh) {
    return (
      <group position={[site.x, 0, site.z]} rotation={[0, site.a, 0]}>
        <mesh position={[0, 0.45, 0]} scale={[0.7, 0.9, 0.6]} castShadow>
          <sphereGeometry args={[0.55, 14, 12]} />
          <meshStandardMaterial color="#4e6e58" roughness={0.6} emissive="#24543c" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0.1, 1.25, 0]} scale={[0.45, 0.7, 0.4]} castShadow>
          <sphereGeometry args={[0.5, 12, 10]} />
          <meshStandardMaterial color="#6d9a72" roughness={0.45} emissive="#2f6a48" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.05, 1.85, 0]} rotation={[0.2, 0, 0.15]} castShadow>
          <coneGeometry args={[0.16, 0.7, 5]} />
          <meshStandardMaterial color="#b7e4d4" emissive="#7ec8b0" emissiveIntensity={0.4} roughness={0.2} transparent opacity={0.88} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[site.x, 0, site.z]} rotation={[site.j * 0.15, site.a, 0.18]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.28, 1.8, 0.55]} />
        <Steel color="#3a444c" rough={0.36} />
      </mesh>
      <mesh position={[0.2, 1.55, 0]} rotation={[0, 0, 0.7]} castShadow>
        <boxGeometry args={[0.16, 0.9, 0.4]} />
        <Steel color="#2a3238" rough={0.5} />
      </mesh>
      <mesh position={[0, 1.7, 0.22]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#d7f4f8" emissive="#9fd8de" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export function PlanetCrust({
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
  const grown = useMemo(
    () => sites(mapId === "forge" ? 220 : mapId === "aegis" ? 330 : 110, 5, arenaR, squash, keepClear, 5.4, 6.4),
    [arenaR, keepClear, mapId, squash],
  );
  const rim = useMemo(() => rimSites(arenaR, squash, keepClear), [arenaR, keepClear, squash]);
  if (mapId === "mycelion") {
    return (
      <group name="mycelion-crust">
        {rim.map((site) => (
          <FungalCrown key={`rim-${site.n}`} site={site} />
        ))}
        {grown.map((site) => (
          <MarrowGrove key={`${site.x}-${site.z}`} site={site} />
        ))}
      </group>
    );
  }
  if (mapId === "forge") {
    return (
      <group name="forge-crust">
        {rim.map((site) => (
          <FoundryStack key={`rim-${site.n}`} site={site} />
        ))}
        {grown.map((site) =>
          site.n % 3 === 0 ? (
            <PlateYard key={`${site.x}-${site.z}`} site={site} />
          ) : site.n % 3 === 1 ? (
            <SlagHeap key={`${site.x}-${site.z}`} site={site} />
          ) : (
            <CoolerBank key={`${site.x}-${site.z}`} site={site} />
          ),
        )}
      </group>
    );
  }
  return (
    <group name="aegis-crust">
      <ScarTrench arenaR={arenaR} squash={squash} keepClear={keepClear} />
      {rim.map((site) => (
        <RiftMonument key={`rim-${site.n}`} site={site} />
      ))}
      {grown.map((site) => (
        <WeldScar key={`${site.x}-${site.z}`} site={site} />
      ))}
    </group>
  );
}
