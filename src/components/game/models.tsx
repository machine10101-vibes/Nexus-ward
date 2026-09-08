import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, InstancedMesh, Object3D, type Group, type Mesh, type Side } from "three";
import type { EnemyId, MapId, TowerId } from "@/game/types";
import { TOWERS } from "@/game/config";
import { cellToWorld } from "@/game/maps";
import { arenaMetrics, terrainElevation } from "./WorldGround";

/** Set while rendering a placement preview so every material renders as a hologram. */
const GhostContext = createContext(false);

function HoverFloat({ children, amp = 0.08 }: { children: ReactNode; amp?: number }) {
  const ref = useRef<Group>(null);
  useFrame((s) => {
    if (ref.current) ref.current.position.y = Math.sin(s.clock.elapsedTime * 2.4) * amp;
  });
  return <group ref={ref}>{children}</group>;
}

function Rotor({ position, width = 0.52 }: { position: Vec; width?: number }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 22;
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[width, 0.02, 0.055]} />
      <meshStandardMaterial color="#9aa4ac" metalness={0.7} roughness={0.28} />
    </mesh>
  );
}

type Vec = [number, number, number];

function Mat({
  color,
  metalness = 0.45,
  roughness = 0.38,
  emissive,
  eInt = 0,
  side,
}: {
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  eInt?: number;
  side?: Side;
}) {
  const ghost = useContext(GhostContext);
  return (
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={emissive ?? color}
      emissiveIntensity={ghost ? Math.max(0.35, eInt) : eInt}
      side={side}
      transparent={ghost}
      opacity={ghost ? 0.34 : 1}
      depthWrite={!ghost}
    />
  );
}

function GlowOrb({
  position,
  r,
  color,
  eInt = 2,
}: {
  position?: Vec;
  r: number;
  color: string;
  eInt?: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[r, 10, 8]} />
      <Mat color={color} eInt={eInt} roughness={0.16} />
    </mesh>
  );
}

function PulseLight({
  position,
  r,
  color,
  base = 1.55,
  amp = 0.5,
  speed = 3.1,
}: {
  position?: Vec;
  r: number;
  color: string;
  base?: number;
  amp?: number;
  speed?: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame((s) => {
    const mat = ref.current?.material as { emissiveIntensity?: number } | undefined;
    if (mat) mat.emissiveIntensity = base + Math.sin(s.clock.elapsedTime * speed) * amp;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[r, 10, 8]} />
      <Mat color={color} eInt={base} roughness={0.16} />
    </mesh>
  );
}

function BoltStuds({
  count,
  radius,
  y,
  color,
  size = 0.035,
}: {
  count: number;
  radius: number;
  y: number;
  color: string;
  size?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * radius, y, Math.sin(a) * radius]} castShadow>
            <cylinderGeometry args={[size, size * 1.15, size * 1.4, 6]} />
            <Mat color={color} metalness={0.72} roughness={0.28} />
          </mesh>
        );
      })}
    </>
  );
}

export function TowerModel({ type, level, ghost }: { type: TowerId; level: number; ghost?: boolean }) {
  const body = <TowerBody type={type} level={level} />;
  if (!ghost) return body;
  return <GhostContext.Provider value>{body}</GhostContext.Provider>;
}

function TowerBody({ type, level }: { type: TowerId; level: number }) {
  const def = TOWERS[type];
  const yaw = useRef<Group>(null);
  const dish = useRef<Group>(null);
  useFrame((s, dt) => {
    if (type === "tesla" && yaw.current) yaw.current.rotation.y += dt * 0.8;
    if (type === "frost" && dish.current) dish.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.7) * 0.06;
  });

  // Pulse — squat armored block with twin plasma barrels. Reads as a low rectangle from above.
  if (type === "pulse") {
    return (
      <group>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.54, 0.62, 0.12, 6]} />
          <Mat color="#2c333a" metalness={0.78} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.46, 0.5, 0.1, 6]} />
          <Mat color="#3a434c" metalness={0.72} roughness={0.3} />
        </mesh>
        <BoltStuds count={6} radius={0.5} y={0.14} color="#1c2228" size={0.04} />
        {([-0.42, 0.42] as const).map((x) => (
          <mesh key={`vent-${x}`} position={[x, 0.2, -0.08]} castShadow>
            <boxGeometry args={[0.1, 0.08, 0.28]} />
            <Mat color="#1a2026" metalness={0.55} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.26, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 0.16, 8]} />
          <Mat color="#4a555f" metalness={0.68} roughness={0.28} />
        </mesh>
        <group ref={yaw} position={[0, 0.46, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.22, 0.44]} />
            <Mat color="#5a6570" metalness={0.58} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.02, -0.24]} castShadow>
            <boxGeometry args={[0.38, 0.3, 0.22]} />
            <Mat color="#3e4750" metalness={0.64} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0.16, -0.18]} castShadow>
            <boxGeometry args={[0.22, 0.1, 0.16]} />
            <Mat color="#2a323a" metalness={0.7} roughness={0.26} />
          </mesh>
          {([-0.14, 0.14] as const).map((x) => (
            <mesh key={`sink-${x}`} position={[x, 0.14, -0.32]} castShadow>
              <boxGeometry args={[0.08, 0.16, 0.08]} />
              <Mat color="#1c2228" metalness={0.68} roughness={0.32} />
            </mesh>
          ))}
          {([-0.18, 0.18] as const).map((x) => (
            <group key={x}>
              <mesh position={[x, 0.01, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.11, 0.28, 12]} />
                <Mat color="#4a545e" metalness={0.66} roughness={0.26} />
              </mesh>
              <mesh position={[x, 0.01, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.078, 0.086, 0.36, 12]} />
                <Mat color="#6b7681" metalness={0.62} roughness={0.24} />
              </mesh>
              <mesh position={[x, 0.01, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.07, 0.012, 6, 14]} />
                <Mat color={def.color} eInt={0.55} />
              </mesh>
              <mesh position={[x, 0.01, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.1, 12]} />
                <Mat color={def.color} eInt={0.85 + level * 0.18} />
              </mesh>
              <PulseLight position={[x, 0.01, 0.78]} r={0.045} color={def.color} base={1.1 + level * 0.15} amp={0.35} />
            </group>
          ))}
          {level === 2 ? (
            <group>
              <mesh position={[0, 0.01, 0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.068, 0.076, 0.72, 12]} />
                <Mat color="#73808b" metalness={0.64} roughness={0.22} />
              </mesh>
              <mesh position={[0, 0.01, 0.76]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.048, 0.048, 0.08, 12]} />
                <Mat color={def.color} eInt={1.05} />
              </mesh>
            </group>
          ) : null}
          {level >= 3
            ? ([-0.36, 0.36] as const).map((x) => (
                <group key={`outer-${x}`}>
                  <mesh position={[x, 0.01, 0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.066, 0.072, 0.52, 12]} />
                    <Mat color="#6b7681" metalness={0.62} roughness={0.24} />
                  </mesh>
                  <mesh position={[x, 0.01, 0.56]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.046, 0.046, 0.08, 12]} />
                    <Mat color={def.color} eInt={1.05} />
                  </mesh>
                </group>
              ))
            : null}
          {level >= 2
            ? ([-0.38, 0.38] as const).map((x) => (
                <group key={`armor-${x}`}>
                  <mesh position={[x, 0.02, -0.02]} castShadow>
                    <boxGeometry args={[0.12, 0.32, 0.46]} />
                    <Mat color="#343c44" metalness={0.74} roughness={0.28} />
                  </mesh>
                  <mesh position={[x, 0.14, 0.08]}>
                    <boxGeometry args={[0.04, 0.06, 0.16]} />
                    <Mat color={def.color} eInt={0.7} />
                  </mesh>
                </group>
              ))
            : null}
          {level >= 3 ? (
            <mesh position={[0, 0.22, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.24, 0.032, 8, 22]} />
              <Mat color={def.color} eInt={1.15} />
            </mesh>
          ) : null}
          <mesh position={[0, 0.18, -0.02]}>
            <boxGeometry args={[0.16, 0.07, 0.28]} />
            <Mat color={def.color} eInt={0.85 + level * 0.2} />
          </mesh>
          <mesh position={[0.22, -0.08, -0.18]} rotation={[0.4, 0, 0.6]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.36, 6]} />
            <Mat color="#1c2228" metalness={0.7} roughness={0.3} />
          </mesh>
          <PulseLight position={[0, 0.22, -0.22]} r={0.04} color={def.color} base={0.9} amp={0.4} speed={2.2} />
        </group>
      </group>
    );
  }

  // Arc Lance — tall, thin mast with a bright tip. Reads as a small dot with a long shadow.
  if (type === "arc") {
    return (
      <group>
        <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.36, 0.48, 0.14, 6]} />
          <Mat color="#2c383e" metalness={0.68} roughness={0.36} />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.32, 0.1, 8]} />
          <Mat color="#3a484e" metalness={0.64} roughness={0.32} />
        </mesh>
        <BoltStuds count={6} radius={0.4} y={0.12} color="#1c262a" />
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.28, 0.3, Math.sin(a) * 0.28]} rotation={[0, -a, 0.22]} castShadow>
              <boxGeometry args={[0.07, 0.48, 0.07]} />
              <Mat color="#3a4a52" metalness={0.64} roughness={0.3} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.14, 1.62, 10]} />
          <Mat color="#44565e" metalness={0.58} roughness={0.26} />
        </mesh>
        {[0.48, 0.88, 1.28].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09 + (1.28 - y) * 0.08, 0.016, 8, 20]} />
            <Mat color="#2a383e" metalness={0.7} roughness={0.28} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.21, 0.024, 8, 26]} />
          <Mat color={def.color} eInt={0.5} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.2;
          return (
            <mesh key={`ins-${i}`} position={[Math.cos(a) * 0.12, 0.58, Math.sin(a) * 0.12]} rotation={[0.6, -a, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.04, 0.1, 8]} />
              <Mat color="#2a383e" metalness={0.55} roughness={0.34} />
            </mesh>
          );
        })}
        <mesh position={[0, 1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.02, 8, 22]} />
          <Mat color={def.color} eInt={0.62} />
        </mesh>
        {level >= 2 ? (
          <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.022, 8, 20]} />
            <Mat color={def.color} eInt={0.8} />
          </mesh>
        ) : null}
        {level >= 2
          ? [0, 1, 2].map((i) => {
              const a = (i / 3) * Math.PI * 2 + 1.1;
              return (
                <mesh key={`fin-${i}`} position={[Math.cos(a) * 0.22, 0.54, Math.sin(a) * 0.22]} rotation={[0, -a, 0.48]} castShadow>
                  <boxGeometry args={[0.05, 0.38, 0.05]} />
                  <Mat color="#2e3e46" metalness={0.66} roughness={0.28} />
                </mesh>
              );
            })
          : null}
        {level >= 3 ? (
          <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.03, 8, 30]} />
            <Mat color={def.color} eInt={0.78} />
          </mesh>
        ) : null}
        {level < 3 ? (
          <group position={[0, 1.8, 0]}>
            <mesh>
              <octahedronGeometry args={[0.18 + level * 0.015, 0]} />
              <Mat color={def.color} eInt={1.2 + level * 0.2} roughness={0.16} />
            </mesh>
            <PulseLight r={0.055} color={def.color} base={1.4} amp={0.45} />
          </group>
        ) : (
          ([-0.14, 0.14] as const).map((x) => (
            <group key={x} position={[x, 1.86, 0]}>
              <mesh>
                <octahedronGeometry args={[0.15, 0]} />
                <Mat color={def.color} eInt={1.6} roughness={0.14} />
              </mesh>
              <PulseLight r={0.05} color={def.color} base={1.6} amp={0.5} speed={3.6} />
            </group>
          ))
        )}
        {[0, 1].map((i) => (
          <mesh key={`cable-${i}`} position={[Math.cos(i * Math.PI) * 0.18, 0.42, Math.sin(i * Math.PI) * 0.18]} rotation={[0.35, i * Math.PI, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.016, 0.42, 6]} />
            <Mat color="#1c262a" metalness={0.65} roughness={0.32} />
          </mesh>
        ))}
      </group>
    );
  }

  // Frost Mortar — a wide open dish on a drum. Reads as a filled circle from above.
  if (type === "frost") {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.48, 0.58, 0.2, 8]} />
          <Mat color="#2e3842" metalness={0.52} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.42, 0.08, 8]} />
          <Mat color="#3e4c58" metalness={0.48} roughness={0.36} />
        </mesh>
        <BoltStuds count={8} radius={0.5} y={0.16} color="#1c262e" />
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + 0.3;
          return (
            <mesh key={`ice-${i}`} position={[Math.cos(a) * 0.48, 0.18, Math.sin(a) * 0.48]} rotation={[0.7, 0, a]} castShadow>
              <coneGeometry args={[0.035, 0.14, 5]} />
              <Mat color={def.color} eInt={0.45} />
            </mesh>
          );
        })}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.32, 0.3, Math.sin(a) * 0.32]} castShadow>
              <boxGeometry args={[0.08, 0.28, 0.08]} />
              <Mat color="#44525e" metalness={0.64} roughness={0.28} />
            </mesh>
          );
        })}
        <group ref={dish} position={[0, 0.48, 0]} rotation={[-0.34, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.54, 24, 12, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42]} />
            <Mat color="#5a6e82" metalness={0.38} roughness={0.3} side={DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <torusGeometry args={[0.52, 0.03, 8, 34]} />
            <Mat color={def.color} eInt={0.5 + level * 0.14} />
          </mesh>
          <PulseLight position={[0, 0.16, 0]} r={0.12} color={def.color} base={1.15} amp={0.4} speed={2.4} />
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <mesh key={`rim-${i}`} position={[Math.cos(a) * 0.48, 0.06, Math.sin(a) * 0.48]}>
                <sphereGeometry args={[0.03, 8, 6]} />
                <Mat color={def.color} eInt={0.7} />
              </mesh>
            );
          })}
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2 + 0.2;
            return (
              <mesh key={`rim-${i}`} position={[Math.cos(a) * 0.46, 0.02, Math.sin(a) * 0.46]}>
                <sphereGeometry args={[0.03, 8, 6]} />
                <Mat color={def.color} eInt={0.7} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.075, 0.1, 0.42, 12]} />
            <Mat color="#5f7181" metalness={0.52} roughness={0.26} />
          </mesh>
          {level >= 2
            ? [0, 1, 2].map((i) => {
                const a = (i / 3) * Math.PI * 2 + 0.55;
                return (
                  <mesh key={`brace-${i}`} position={[Math.cos(a) * 0.42, 0.02, Math.sin(a) * 0.42]} rotation={[0.2, -a, 0.55]} castShadow>
                    <boxGeometry args={[0.055, 0.24, 0.055]} />
                    <Mat color="#6a7c8c" metalness={0.58} roughness={0.26} />
                  </mesh>
                );
              })
            : null}
          {level >= 3 ? (
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
              <torusGeometry args={[0.66, 0.032, 8, 34]} />
              <Mat color={def.color} eInt={0.92} />
            </mesh>
          ) : null}
        </group>
        {level >= 3
          ? [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <mesh key={`spike-${i}`} position={[Math.cos(a) * 0.52, 0.22, Math.sin(a) * 0.52]} rotation={[0.9, 0, a]} castShadow>
                  <coneGeometry args={[0.05, 0.22, 6]} />
                  <Mat color={def.color} eInt={0.78} />
                </mesh>
              );
            })
          : null}
      </group>
    );
  }

  // Rail Piercer — one long barrel over a flat sled. Reads as a bar from above.
  if (type === "rail") {
    return (
      <group>
        <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.14, 0.54]} />
          <Mat color="#2e2f34" metalness={0.8} roughness={0.26} />
        </mesh>
        {([-0.34, 0.34] as const).map((x) => (
          <mesh key={`foot-${x}`} position={[x, 0.04, 0.18]} castShadow>
            <boxGeometry args={[0.16, 0.08, 0.22]} />
            <Mat color="#1c1d20" metalness={0.72} roughness={0.32} />
          </mesh>
        ))}
        <mesh position={[0, 0.22, -0.16]} castShadow>
          <boxGeometry args={[0.54, 0.22, 0.36]} />
          <Mat color="#45464c" metalness={0.74} roughness={0.28} />
        </mesh>
        {([-0.38, 0.38] as const).map((x) => (
          <mesh key={`sled-${x}`} position={[x, 0.16, -0.04]} castShadow>
            <boxGeometry args={[0.08, 0.1, 0.42]} />
            <Mat color="#2a2b30" metalness={0.78} roughness={0.26} />
          </mesh>
        ))}
        <group position={[0, 0.46, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.18, 1.54]} />
            <Mat color="#585960" metalness={0.76} roughness={0.22} />
          </mesh>
          {([-0.14, 0.14] as const).map((x) => (
            <mesh key={x} position={[x, 0.12, 0.16]} castShadow>
              <boxGeometry args={[0.055, 0.065, 1.66]} />
              <Mat color={def.color} eInt={0.48 + level * 0.14} metalness={0.52} roughness={0.18} />
            </mesh>
          ))}
          {[-0.32, 0, 0.32].map((z) => (
            <mesh key={z} position={[0, 0.12, z]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.14, 0.016, 6, 16]} />
              <Mat color="#2a2b30" metalness={0.7} roughness={0.24} />
            </mesh>
          ))}
          <mesh position={[0, 0.04, 0.94]}>
            <boxGeometry args={[0.28, 0.12, 0.12]} />
            <Mat color={def.color} eInt={1.05} />
          </mesh>
          <PulseLight position={[0, 0.04, 1.08]} r={0.05} color={def.color} base={1.2} amp={0.45} speed={3.4} />
          {([-0.26, 0.26] as const).map((x) => (
            <mesh key={`coil-${x}`} position={[x, 0.02, -0.44]}>
              <cylinderGeometry args={[0.12, 0.12, 0.12, 12]} />
              <Mat color={def.color} eInt={0.78} />
            </mesh>
          ))}
          {level >= 2
            ? ([-0.4, 0.4] as const).map((x) => (
                <group key={`cap-${x}`}>
                  <mesh position={[x, 0.04, -0.18]} castShadow>
                    <boxGeometry args={[0.18, 0.22, 0.3]} />
                    <Mat color="#2a2b30" metalness={0.82} roughness={0.22} />
                  </mesh>
                  <mesh position={[x, 0.16, -0.18]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.06, 8]} />
                    <Mat color={def.color} eInt={0.9} />
                  </mesh>
                </group>
              ))
            : null}
          {level >= 2 ? (
            <mesh position={[0, 0.22, 0.1]} castShadow>
              <boxGeometry args={[0.042, 0.052, 1.5]} />
              <Mat color={def.color} eInt={0.75} metalness={0.52} roughness={0.16} />
            </mesh>
          ) : null}
          {level >= 3 ? (
            <>
              <mesh position={[0, 0.3, 0.06]} castShadow>
                <boxGeometry args={[0.036, 0.048, 1.38]} />
                <Mat color={def.color} eInt={0.9} metalness={0.54} roughness={0.14} />
              </mesh>
              <mesh position={[0, 0.06, 1.04]} castShadow>
                <boxGeometry args={[0.36, 0.22, 0.24]} />
                <Mat color="#26272c" metalness={0.84} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.06, 1.18]}>
                <boxGeometry args={[0.24, 0.13, 0.09]} />
                <Mat color={def.color} eInt={1.25} />
              </mesh>
            </>
          ) : null}
        </group>
      </group>
    );
  }

  // Tesla Spire — stacked toroids on a mast. Reads as concentric rings from above.
  return (
    <group>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.5, 0.16, 8]} />
        <Mat color="#2c3834" metalness={0.6} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.1, 8]} />
        <Mat color="#3a4842" metalness={0.55} roughness={0.34} />
      </mesh>
      <BoltStuds count={8} radius={0.42} y={0.14} color="#1c2622" />
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.16, 0.92, 12]} />
        <Mat color="#44564e" metalness={0.52} roughness={0.28} />
      </mesh>
      {[0.38, 0.62, 0.86].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.05, 10]} />
          <Mat color="#2a3630" metalness={0.45} roughness={0.42} />
        </mesh>
      ))}
      {[0.48, 0.74].map((y) => (
        <mesh key={`wrap-${y}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.11, 0.014, 6, 16]} />
          <Mat color={def.color} eInt={0.45} />
        </mesh>
      ))}
      <group ref={yaw} position={[0, 0.94, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.36, 0.044, 8, 24]} />
          <Mat color={def.color} eInt={0.55} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.036, 8, 22]} />
          <Mat color={def.color} eInt={0.7} />
        </mesh>
        <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.17, 0.03, 8, 20]} />
          <Mat color={def.color} eInt={0.88} />
        </mesh>
        <mesh position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.032, 8, 26]} />
          <Mat color={def.color} eInt={0.4} />
        </mesh>
        {level >= 2 ? (
          <mesh position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.21, 0.032, 8, 20]} />
            <Mat color={def.color} eInt={0.98} />
          </mesh>
        ) : null}
        {level >= 3 ? (
          <mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.03, 8, 30]} />
            <Mat color={def.color} eInt={0.62} />
          </mesh>
        ) : null}
      </group>
      {level >= 2
        ? [0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={`stud-${i}`} position={[Math.cos(a) * 0.42, 0.22, Math.sin(a) * 0.42]} castShadow>
                <cylinderGeometry args={[0.048, 0.054, 0.14, 8]} />
                <Mat color="#2a3630" metalness={0.62} roughness={0.32} />
              </mesh>
            );
          })
        : null}
      <PulseLight position={[0, level >= 3 ? 1.52 : 1.42, 0]} r={level >= 3 ? 0.18 : 0.12} color={def.color} base={1.4 + level * 0.16} amp={0.55} speed={2.8} />
    </group>
  );
}

function WalkLegs({ children }: { children: ReactNode }) {
  const legs = useRef<Group>(null);
  useFrame((state) => {
    if (!legs.current) return;
    const t = state.clock.elapsedTime;
    legs.current.children.forEach((c, i) => {
      c.rotation.x = Math.sin(t * 8 + i) * 0.45;
    });
  });
  return <group ref={legs}>{children}</group>;
}

export function EnemyModel({ type }: { type: EnemyId }) {
  if (type === "mite") {
    return (
      <group scale={0.86}>
        <mesh position={[0, 0.2, -0.06]} castShadow>
          <sphereGeometry args={[0.2, 12, 10]} />
          <Mat color="#2f7a54" roughness={0.56} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.22, 0.08]} castShadow>
          <sphereGeometry args={[0.18, 12, 10]} />
          <Mat color="#3d8f62" roughness={0.54} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.2, 0.26]} castShadow>
          <sphereGeometry args={[0.13, 10, 8]} />
          <Mat color="#2a6a4a" roughness={0.5} metalness={0.06} />
        </mesh>
        <mesh position={[0, 0.3, 0.04]} castShadow>
          <sphereGeometry args={[0.12, 8, 6]} />
          <Mat color="#1e4a36" roughness={0.48} metalness={0.1} />
        </mesh>
        {([-0.07, 0.07] as const).map((x) => (
          <PulseLight key={x} position={[x, 0.26, 0.36]} r={0.045} color="#b8ffd8" base={3.2} amp={0.7} speed={4.2} />
        ))}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[0.05 * s, 0.32, 0.3]} rotation={[0.55, 0, 0.4 * s]}>
            <cylinderGeometry args={[0.01, 0.016, 0.24, 5]} />
            <Mat color="#1c3a2c" roughness={0.65} />
          </mesh>
        ))}
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.12, -0.04, -0.2].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.16 * s, 0.06, z]} rotation={[0.45, 0, 0.85 * s]}>
                <boxGeometry args={[0.032, 0.22, 0.032]} />
                <Mat color="#1c3a2c" roughness={0.62} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "brood") {
    return (
      <group scale={1.12}>
        <mesh position={[0, 0.28, -0.12]} castShadow>
          <sphereGeometry args={[0.26, 12, 10]} />
          <Mat color="#246848" roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.3, 0.06]} castShadow>
          <sphereGeometry args={[0.24, 12, 10]} />
          <Mat color="#2f7a54" roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.28, 0.26]} castShadow>
          <sphereGeometry args={[0.18, 10, 8]} />
          <Mat color="#348058" roughness={0.48} metalness={0.08} />
        </mesh>
        {([-0.09, 0.09] as const).map((x) => (
          <mesh key={x} position={[x, 0.22, 0.4]} rotation={[0.65, 0, x * 2.2]}>
            <boxGeometry args={[0.055, 0.045, 0.18]} />
            <Mat color="#163428" roughness={0.42} />
          </mesh>
        ))}
        {([-0.07, 0.07] as const).map((x) => (
          <PulseLight key={`e${x}`} position={[x, 0.34, 0.38]} r={0.042} color="#6ad4a0" base={2.6} amp={0.55} speed={3.8} />
        ))}
        <PulseLight position={[0, 0.42, 0]} r={0.09} color="#6ad4a0" base={1.5} amp={0.4} />
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.18, 0.0, -0.22].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.22 * s, 0.08, z]} rotation={[0.4, 0, 0.7 * s]}>
                <boxGeometry args={[0.048, 0.28, 0.048]} />
                <Mat color="#1c3a2c" roughness={0.6} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "husk") {
    return (
      <group scale={1.42}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.3, 14, 12]} />
          <Mat color="#2c6b4c" roughness={0.46} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.26, 0.26]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#245844" roughness={0.44} metalness={0.14} />
        </mesh>
        <mesh position={[0, 0.5, -0.02]} castShadow>
          <boxGeometry args={[0.52, 0.18, 0.48]} />
          <Mat color="#1e4a38" metalness={0.24} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.42, 0.18]} castShadow>
          <boxGeometry args={[0.36, 0.08, 0.2]} />
          <Mat color="#16382c" metalness={0.2} roughness={0.44} />
        </mesh>
        {([-0.26, 0.26] as const).map((x) => (
          <mesh key={x} position={[x, 0.4, 0]} rotation={[0, 0, x > 0 ? -0.45 : 0.45]} castShadow>
            <boxGeometry args={[0.14, 0.32, 0.3]} />
            <Mat color="#1a4034" metalness={0.2} roughness={0.48} />
          </mesh>
        ))}
        <mesh position={[0, 0.52, 0.18]} rotation={[0.4, 0, 0]} castShadow>
          <coneGeometry args={[0.06, 0.28, 5]} />
          <Mat color="#1a3a2c" roughness={0.4} />
        </mesh>
        {([-0.07, 0.07] as const).map((x) => (
          <PulseLight key={`e${x}`} position={[x, 0.32, 0.38]} r={0.04} color="#6ad4a0" base={2.0} amp={0.45} />
        ))}
        <mesh position={[0, 0.56, -0.12]} rotation={[-0.4, 0, 0]} castShadow>
          <coneGeometry args={[0.05, 0.22, 5]} />
          <Mat color="#163428" roughness={0.4} />
        </mesh>
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.14, -0.08, -0.26].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.24 * s, 0.08, z]} rotation={[0.35, 0, 0.65 * s]}>
                <boxGeometry args={[0.07, 0.3, 0.07]} />
                <Mat color="#163428" roughness={0.62} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "myrmidon") {
    return (
      <group scale={1.58}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.3, 14, 12]} />
          <Mat color="#245c40" roughness={0.44} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.26, 0.24]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#1c4a34" roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.52, -0.02]} castShadow>
          <boxGeometry args={[0.46, 0.16, 0.42]} />
          <Mat color="#163828" metalness={0.26} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.38, 0.2]} castShadow>
          <boxGeometry args={[0.28, 0.08, 0.16]} />
          <Mat color="#122820" metalness={0.22} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.66, 0]} castShadow>
          <coneGeometry args={[0.1, 0.28, 5]} />
          <Mat color="#7ee0b4" emissive="#8af0c4" eInt={0.9} />
        </mesh>
        <PulseLight position={[0, 0.78, 0]} r={0.04} color="#b8ffd8" base={2.4} amp={0.5} speed={3.2} />
        {([-0.08, 0.08] as const).map((x) => (
          <PulseLight key={`e${x}`} position={[x, 0.3, 0.38]} r={0.035} color="#6ad4a0" base={2.1} amp={0.4} />
        ))}
        {([-0.34, 0.34] as const).map((x) => (
          <mesh key={x} position={[x, 0.48, 0.14]} rotation={[0.15, 0, x > 0 ? -0.85 : 0.85]} castShadow>
            <boxGeometry args={[0.07, 0.42, 0.26]} />
            <Mat color="#1a3a2c" metalness={0.28} roughness={0.42} />
          </mesh>
        ))}
        {([-0.18, 0.18] as const).map((x) => (
          <mesh key={`jaw-${x}`} position={[x, 0.2, 0.34]} rotation={[0.7, 0, x * 1.4]} castShadow>
            <boxGeometry args={[0.045, 0.04, 0.16]} />
            <Mat color="#122820" roughness={0.46} />
          </mesh>
        ))}
        {[-0.9, -0.3, 0.3, 0.9].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.22, 0.58, Math.cos(a) * 0.18]} rotation={[-0.3, a, 0]} castShadow>
            <coneGeometry args={[0.05, 0.32, 5]} />
            <Mat color="#7ee0b4" emissive="#8af0c4" eInt={0.7} />
          </mesh>
        ))}
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.14, -0.08, -0.26].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.22 * s, 0.08, z]} rotation={[0.35, 0, 0.65 * s]}>
                <boxGeometry args={[0.06, 0.3, 0.06]} />
                <Mat color="#122820" roughness={0.6} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "titan") {
    return (
      <group scale={1.95}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <sphereGeometry args={[0.34, 14, 12]} />
          <Mat color="#4aaa78" roughness={0.48} metalness={0.14} />
        </mesh>
        <mesh position={[0, 0.24, 0.28]} castShadow>
          <sphereGeometry args={[0.18, 10, 8]} />
          <Mat color="#3d8f62" roughness={0.46} />
        </mesh>
        <mesh position={[0, 0.54, -0.04]} castShadow>
          <boxGeometry args={[0.54, 0.18, 0.48]} />
          <Mat color="#245844" metalness={0.22} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.42, 0.16]} castShadow>
          <torusGeometry args={[0.22, 0.03, 6, 16]} />
          <Mat color="#7ee0b4" eInt={0.7} />
        </mesh>
        {[-0.9, -0.3, 0.3, 0.9].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.26, 0.64, Math.cos(a) * 0.22]} rotation={[-0.35, a, 0]} castShadow>
            <coneGeometry args={[0.075, 0.48, 5]} />
            <Mat color="#7ee0b4" emissive="#8af0c4" eInt={0.9} />
          </mesh>
        ))}
        <PulseLight position={[0, 0.74, 0]} r={0.13} color="#8af0c4" base={2.6} amp={0.5} speed={2.2} />
        {([-0.28, 0.28] as const).map((x) => (
          <mesh key={`plate-${x}`} position={[x, 0.42, 0]} rotation={[0, 0, x > 0 ? -0.35 : 0.35]} castShadow>
            <boxGeometry args={[0.12, 0.28, 0.36]} />
            <Mat color="#1e4a38" metalness={0.22} roughness={0.44} />
          </mesh>
        ))}
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.16, -0.06, -0.28].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.24 * s, 0.08, z]} rotation={[0.35, 0, 0.6 * s]}>
                <boxGeometry args={[0.07, 0.32, 0.07]} />
                <Mat color="#1c3a2c" roughness={0.58} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "colossus") {
    return (
      <group scale={2.22}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <sphereGeometry args={[0.36, 14, 12]} />
          <Mat color="#5cbc88" roughness={0.46} metalness={0.14} />
        </mesh>
        <mesh position={[0, 0.26, 0.3]} castShadow>
          <sphereGeometry args={[0.2, 10, 8]} />
          <Mat color="#4aaa78" roughness={0.44} />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <torusGeometry args={[0.4, 0.055, 8, 22]} />
          <Mat color="#b8ffd8" eInt={1.5} />
        </mesh>
        {[-1.2, -0.6, 0, 0.6, 1.2].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.34, 0.88, Math.cos(a) * 0.28]} rotation={[-0.5, a, 0]} castShadow>
            <coneGeometry args={[0.09, 0.72, 5]} />
            <Mat color="#9af0c8" emissive="#b8ffd8" eInt={1.2} />
          </mesh>
        ))}
        <PulseLight position={[0, 0.78, 0]} r={0.16} color="#b8ffd8" base={2.8} amp={0.55} speed={1.8} />
        {([-0.32, 0.32] as const).map((x) => (
          <mesh key={`pauldron-${x}`} position={[x, 0.52, 0]} rotation={[0, 0, x > 0 ? -0.4 : 0.4]} castShadow>
            <boxGeometry args={[0.14, 0.32, 0.4]} />
            <Mat color="#245844" metalness={0.2} roughness={0.42} />
          </mesh>
        ))}
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.2, 0.02, -0.18, -0.36].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.26 * s, 0.08, z]} rotation={[0.3, 0, 0.55 * s]}>
                <boxGeometry args={[0.08, 0.34, 0.08]} />
                <Mat color="#1c3a2c" roughness={0.56} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "spore") {
    return (
      <HoverFloat>
        <mesh>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#4aaa88" emissive="#3dcaa0" emissiveIntensity={1.35} roughness={0.3} transparent opacity={0.88} />
        </mesh>
        <mesh>
          <dodecahedronGeometry args={[0.16, 0]} />
          <Mat color="#2a6a52" roughness={0.4} emissive="#3dcaa0" eInt={0.4} />
        </mesh>
        <PulseLight r={0.1} color="#a8f0d4" base={2.5} amp={0.55} speed={2.6} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.22, -0.08, Math.sin(a) * 0.22]} rotation={[0.8, a, 0]}>
              <capsuleGeometry args={[0.022, 0.18, 3, 5]} />
              <Mat color="#2a6a52" roughness={0.42} emissive="#3dcaa0" eInt={0.4} />
            </mesh>
          );
        })}
      </HoverFloat>
    );
  }

  if (type === "bloom") {
    return (
      <HoverFloat amp={0.1}>
        <mesh>
          <icosahedronGeometry args={[0.32, 1]} />
          <meshStandardMaterial color="#6ad4a8" emissive="#3dcaa0" emissiveIntensity={1.7} roughness={0.26} transparent opacity={0.9} />
        </mesh>
        <PulseLight r={0.13} color="#d8ffe8" base={2.8} amp={0.6} speed={2.2} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.34, 0.02, Math.sin(a) * 0.34]} rotation={[0.2, a, 0.4]}>
              <octahedronGeometry args={[0.14, 0]} />
              <Mat color="#8af0c4" eInt={2} />
            </mesh>
          );
        })}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          return (
            <mesh key={`inner-${i}`} position={[Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18]}>
              <octahedronGeometry args={[0.07, 0]} />
              <Mat color="#d8ffe8" eInt={1.4} />
            </mesh>
          );
        })}
      </HoverFloat>
    );
  }

  if (type === "drone") {
    return (
      <HoverFloat amp={0.06}>
        <mesh castShadow>
          <cylinderGeometry args={[0.26, 0.28, 0.1, 6]} />
          <Mat color="#6a7078" metalness={0.8} roughness={0.24} />
        </mesh>
        <mesh position={[0, -0.04, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.22, 0.06, 6]} />
          <Mat color="#3a4048" metalness={0.76} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.08, 8]} />
          <Mat color="#c46a3a" eInt={2.5} />
        </mesh>
        <PulseLight position={[0, 0.16, 0]} r={0.045} color="#e08848" base={2.2} amp={0.5} speed={4.4} />
        {([-0.16, 0.16] as const).map((x) => (
          <mesh key={`fin-${x}`} position={[x, 0.02, -0.04]} castShadow>
            <boxGeometry args={[0.06, 0.04, 0.16]} />
            <Mat color="#2a2e32" metalness={0.72} roughness={0.3} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          return (
            <group key={i} position={[Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3]} rotation={[0, -a, 0]}>
              <mesh position={[-0.08, 0, 0]} castShadow>
                <boxGeometry args={[0.16, 0.03, 0.05]} />
                <Mat color="#4a5058" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.03, 8]} />
                <Mat color="#2a2e32" metalness={0.62} roughness={0.34} />
              </mesh>
              <Rotor position={[0, 0.03, 0]} width={0.34} />
            </group>
          );
        })}
      </HoverFloat>
    );
  }

  if (type === "walker") {
    return (
      <group>
        <mesh position={[0, 0.54, 0]} castShadow>
          <boxGeometry args={[0.36, 0.34, 0.28]} />
          <Mat color="#5e666e" metalness={0.72} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.54, 0.1]} castShadow>
          <boxGeometry args={[0.22, 0.16, 0.08]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.8, 0.04]} castShadow>
          <boxGeometry args={[0.2, 0.22, 0.22]} />
          <Mat color="#3e464e" metalness={0.74} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.82, 0.18]}>
          <boxGeometry args={[0.16, 0.045, 0.045]} />
          <Mat color="#e08848" eInt={2.7} />
        </mesh>
        <PulseLight position={[0, 0.82, 0.22]} r={0.03} color="#e08848" base={2.4} amp={0.45} speed={5.2} />
        <mesh position={[0.2, 0.62, 0.02]} castShadow>
          <boxGeometry args={[0.12, 0.1, 0.16]} />
          <Mat color="#3a4048" metalness={0.76} roughness={0.28} />
        </mesh>
        <mesh position={[0.07, 1.0, -0.02]} rotation={[0.18, 0, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.3, 6]} />
          <Mat color="#2a2e32" metalness={0.72} />
        </mesh>
        <WalkLegs>
          <mesh position={[0.13, 0.2, 0.04]} castShadow>
            <boxGeometry args={[0.1, 0.42, 0.12]} />
            <Mat color="#3a4048" metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh position={[-0.13, 0.2, -0.04]} castShadow>
            <boxGeometry args={[0.1, 0.42, 0.12]} />
            <Mat color="#3a4048" metalness={0.72} roughness={0.3} />
          </mesh>
        </WalkLegs>
      </group>
    );
  }

  if (type === "siege") {
    return (
      <group scale={1.18}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.58, 0.3, 0.46]} />
          <Mat color="#4e545c" metalness={0.74} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.5, 0.16]} castShadow>
          <boxGeometry args={[0.4, 0.1, 0.12]} />
          <Mat color="#2a2e34" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.62, -0.06]} castShadow>
          <boxGeometry args={[0.36, 0.18, 0.3]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[0.18, 0.18, 0.1]} castShadow>
          <boxGeometry args={[0.16, 0.32, 0.22]} />
          <Mat color="#2a2e34" metalness={0.74} roughness={0.3} />
        </mesh>
        <mesh position={[-0.18, 0.18, 0.1]} castShadow>
          <boxGeometry args={[0.16, 0.32, 0.22]} />
          <Mat color="#2a2e34" metalness={0.74} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.58, 0.38]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.12, 0.62, 8]} />
          <Mat color="#5a6068" metalness={0.72} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.58, 0.7]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 8]} />
          <Mat color="#c46a3a" eInt={2.2} />
        </mesh>
        <PulseLight position={[0, 0.58, 0.78]} r={0.04} color="#e08848" base={2.0} amp={0.45} speed={3.6} />
        <mesh position={[0, 0.4, -0.3]} castShadow>
          <boxGeometry args={[0.28, 0.2, 0.16]} />
          <Mat color="#2a2e32" metalness={0.65} roughness={0.36} />
        </mesh>
        {([-0.3, 0.3] as const).map((x) => (
          <mesh key={`skirt-${x}`} position={[x, 0.28, -0.04]} castShadow>
            <boxGeometry args={[0.08, 0.16, 0.36]} />
            <Mat color="#3a4048" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "bulwark") {
    return (
      <group scale={1.32}>
        <mesh position={[0, 0.48, -0.04]} castShadow>
          <boxGeometry args={[0.4, 0.42, 0.28]} />
          <Mat color="#3a4048" metalness={0.8} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.58, 0.22]} castShadow>
          <boxGeometry args={[0.72, 0.52, 0.1]} />
          <Mat color="#2a3038" metalness={0.84} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.72, 0.24]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.06]} />
          <Mat color="#1c2026" metalness={0.8} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.58, 0.28]}>
          <boxGeometry args={[0.18, 0.18, 0.04]} />
          <Mat color="#c46a3a" eInt={1.9} />
        </mesh>
        <PulseLight position={[0, 0.58, 0.32]} r={0.04} color="#e08848" base={1.8} amp={0.4} speed={3.2} />
        {([-0.28, 0.28] as const).map((x) => (
          <mesh key={`rivet-${x}`} position={[x, 0.78, 0.24]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.05, 6]} />
            <Mat color="#1c2026" metalness={0.82} roughness={0.2} />
          </mesh>
        ))}
        {([-0.18, 0.18] as const).map((x) => (
          <mesh key={x} position={[x, 0.18, 0]} castShadow>
            <boxGeometry args={[0.16, 0.34, 0.2]} />
            <Mat color="#24282e" metalness={0.78} roughness={0.26} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "dread") {
    return (
      <group scale={1.6}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.46, 0.4, 0.34]} />
          <Mat color="#54595f" metalness={0.74} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.82, 0.06]} castShadow>
          <boxGeometry args={[0.28, 0.18, 0.26]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.26} />
        </mesh>
        {([-0.34, 0.34] as const).map((x) => (
          <mesh key={x} position={[x, 0.7, -0.02]} rotation={[0, 0, x > 0 ? -0.32 : 0.32]} castShadow>
            <boxGeometry args={[0.2, 0.26, 0.4]} />
            <Mat color="#54595f" metalness={0.72} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 0.98, 0.02]} castShadow>
          <boxGeometry args={[0.6, 0.09, 0.3]} />
          <Mat color="#2f3338" metalness={0.78} roughness={0.26} />
        </mesh>
        {[-0.2, 0, 0.2].map((x) => (
          <group key={x}>
            <mesh position={[x, 1.08, 0.02]} castShadow>
              <boxGeometry args={[0.07, 0.16, 0.07]} />
              <Mat color="#c46a3a" eInt={1.6} />
            </mesh>
            <PulseLight position={[x, 1.18, 0.02]} r={0.028} color="#e08848" base={1.7} amp={0.4} speed={2.8} />
          </group>
        ))}
        <mesh position={[0, 0.58, 0.2]} castShadow>
          <boxGeometry args={[0.22, 0.12, 0.06]} />
          <Mat color="#2a2e34" metalness={0.76} roughness={0.26} />
        </mesh>
        <mesh position={[0.14, 0.22, 0]} castShadow>
          <boxGeometry args={[0.14, 0.44, 0.16]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.32} />
        </mesh>
        <mesh position={[-0.14, 0.22, 0]} castShadow>
          <boxGeometry args={[0.14, 0.44, 0.16]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.32} />
        </mesh>
      </group>
    );
  }

  if (type === "leviathan") {
    return (
      <group scale={1.82}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.52, 0.42, 0.38]} />
          <Mat color="#3e444c" metalness={0.78} roughness={0.26} />
        </mesh>
        {([-0.36, 0.36] as const).map((x) => (
          <mesh key={x} position={[x, 0.72, 0]} rotation={[0, 0, x > 0 ? -0.28 : 0.28]} castShadow>
            <boxGeometry args={[0.22, 0.28, 0.44]} />
            <Mat color="#4a5058" metalness={0.76} roughness={0.28} />
          </mesh>
        ))}
        <mesh position={[0, 1.18, 0]} castShadow>
          <boxGeometry args={[0.76, 0.14, 0.46]} />
          <Mat color="#1f2328" metalness={0.84} roughness={0.2} />
        </mesh>
        {([-0.28, 0.28] as const).map((x) => (
          <group key={`c${x}`}>
            <mesh position={[x, 1.16, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.1, 0.5, 8]} />
              <Mat color="#c46a3a" eInt={1.9} />
            </mesh>
            <PulseLight position={[x, 1.16, 0.58]} r={0.04} color="#e08848" base={2.0} amp={0.45} speed={3.1} />
          </group>
        ))}
        {[-0.22, 0, 0.22].map((x) => (
          <mesh key={x} position={[x, 1.3, 0]} castShadow>
            <boxGeometry args={[0.08, 0.16, 0.08]} />
            <Mat color="#e08848" eInt={1.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, 0.22]} castShadow>
          <boxGeometry args={[0.28, 0.1, 0.08]} />
          <Mat color="#2a2e34" metalness={0.8} roughness={0.22} />
        </mesh>
        <mesh position={[0.16, 0.22, 0]} castShadow>
          <boxGeometry args={[0.16, 0.44, 0.18]} />
          <Mat color="#2a2e34" metalness={0.76} />
        </mesh>
        <mesh position={[-0.16, 0.22, 0]} castShadow>
          <boxGeometry args={[0.16, 0.44, 0.18]} />
          <Mat color="#2a2e34" metalness={0.76} />
        </mesh>
      </group>
    );
  }

  if (type === "gunship") {
    return (
      <HoverFloat amp={0.05}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.13, 0.76]} />
          <Mat color="#5a6068" metalness={0.74} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.08, -0.08]} castShadow>
          <boxGeometry args={[0.16, 0.08, 0.28]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.38, 0, -0.04]} rotation={[0, 0.15, 0.18]} castShadow>
          <boxGeometry args={[0.52, 0.04, 0.26]} />
          <Mat color="#3a4048" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[-0.38, 0, -0.04]} rotation={[0, -0.15, -0.18]} castShadow>
          <boxGeometry args={[0.52, 0.04, 0.26]} />
          <Mat color="#3a4048" metalness={0.6} roughness={0.35} />
        </mesh>
        {([-0.08, 0.08] as const).map((x) => (
          <group key={x}>
            <mesh position={[x, -0.04, 0.26]}>
              <boxGeometry args={[0.07, 0.05, 0.2]} />
              <Mat color="#e08848" eInt={2.5} />
            </mesh>
            <PulseLight position={[x, -0.04, 0.38]} r={0.028} color="#e08848" base={2.2} amp={0.5} speed={5.4} />
          </group>
        ))}
        <mesh position={[0, 0.12, 0.18]} castShadow>
          <boxGeometry args={[0.1, 0.05, 0.12]} />
          <Mat color="#2a2e34" metalness={0.72} roughness={0.28} />
        </mesh>
        <Rotor position={[0.3, 0.1, 0.08]} width={0.4} />
        <Rotor position={[-0.3, 0.1, 0.08]} width={0.4} />
      </HoverFloat>
    );
  }

  if (type === "razor") {
    return (
      <HoverFloat amp={0.07}>
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.075, 1.06]} />
          <Mat color="#6a5050" metalness={0.76} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0.04, 0.1]} castShadow>
          <boxGeometry args={[0.08, 0.05, 0.36]} />
          <Mat color="#3a2828" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[0.22, 0, -0.12]} rotation={[0, 0.45, 0.25]} castShadow>
          <boxGeometry args={[0.4, 0.03, 0.12]} />
          <Mat color="#3a3030" metalness={0.65} roughness={0.32} />
        </mesh>
        <mesh position={[-0.22, 0, -0.12]} rotation={[0, -0.45, -0.25]} castShadow>
          <boxGeometry args={[0.4, 0.03, 0.12]} />
          <Mat color="#3a3030" metalness={0.65} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.02, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.05, 0.26, 6]} />
          <Mat color="#e08848" eInt={2.4} />
        </mesh>
        <PulseLight position={[0, 0.02, 0.66]} r={0.03} color="#e08848" base={2.3} amp={0.5} speed={6.2} />
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[0.12 * s, 0.01, 0.28]} rotation={[0, 0.2 * s, 0.15 * s]} castShadow>
            <boxGeometry args={[0.16, 0.02, 0.08]} />
            <Mat color="#4a3030" metalness={0.68} roughness={0.3} />
          </mesh>
        ))}
        <Rotor position={[0, 0.08, -0.28]} width={0.34} />
      </HoverFloat>
    );
  }

  if (type === "wraith") {
    return (
      <HoverFloat amp={0.1}>
        <mesh>
          <coneGeometry args={[0.16, 0.62, 6]} />
          <meshStandardMaterial color="#6aa0a8" emissive="#8ec8d0" emissiveIntensity={1.05} transparent opacity={0.82} roughness={0.24} />
        </mesh>
        <PulseLight position={[0, 0.3, 0]} r={0.08} color="#cfeaf0" base={3} amp={0.6} speed={2.4} />
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.12, -0.22, Math.sin(a) * 0.12]} rotation={[0.5, a, 0]}>
              <coneGeometry args={[0.04, 0.2, 5]} />
              <meshStandardMaterial color="#8ec8d0" transparent opacity={0.4} emissive="#8ec8d0" emissiveIntensity={0.7} />
            </mesh>
          );
        })}
      </HoverFloat>
    );
  }

  if (type === "specter") {
    return (
      <HoverFloat amp={0.12}>
        <mesh>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#7ab4bc" emissive="#8ec8d0" emissiveIntensity={1.4} transparent opacity={0.88} roughness={0.18} />
        </mesh>
        <PulseLight r={0.1} color="#e8f6f8" base={3.2} amp={0.65} speed={2.1} />
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.4, 6]} />
          <meshStandardMaterial color="#8ec8d0" transparent opacity={0.32} emissive="#8ec8d0" emissiveIntensity={0.85} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          return (
            <mesh key={`shard-${i}`} position={[Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2]} rotation={[0.4, a, 0.2]}>
              <octahedronGeometry args={[0.06, 0]} />
              <Mat color="#cfeaf0" eInt={1.6} />
            </mesh>
          );
        })}
      </HoverFloat>
    );
  }

  if (type === "overlord") {
    return (
      <group scale={1.7}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.38, 12, 10]} />
          <Mat color="#3a5a52" roughness={0.4} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.55, 0.1]} castShadow>
          <boxGeometry args={[0.55, 0.18, 0.4]} />
          <Mat color="#5a686c" metalness={0.7} roughness={0.28} />
        </mesh>
        <PulseLight position={[0, 0.62, 0]} r={0.17} color="#8ec8d0" base={2.8} amp={0.5} speed={2} />
        <mesh position={[0.22, 0.2, 0.1]} castShadow>
          <boxGeometry args={[0.14, 0.4, 0.14]} />
          <Mat color="#4a5858" metalness={0.55} />
        </mesh>
        <mesh position={[-0.22, 0.2, 0.1]} castShadow>
          <boxGeometry args={[0.14, 0.4, 0.14]} />
          <Mat color="#2a4a3c" roughness={0.5} />
        </mesh>
        {[0.16, 0.34, 0.52].map((x) => (
          <mesh key={x} position={[x, 0.86, 0]} rotation={[0, 0, -0.3]} castShadow>
            <boxGeometry args={[0.09, 0.3, 0.16]} />
            <Mat color="#6a787c" metalness={0.72} roughness={0.26} />
          </mesh>
        ))}
        {[-0.16, -0.34, -0.52].map((x) => (
          <mesh key={x} position={[x, 0.86, 0]} rotation={[0, 0, 0.3]} castShadow>
            <coneGeometry args={[0.08, 0.36, 5]} />
            <Mat color="#3f8a72" emissive="#8ec8d0" eInt={0.7} roughness={0.4} />
          </mesh>
        ))}
        <PulseLight position={[0, 0.94, 0]} r={0.11} color="#b8e4ea" base={2.6} amp={0.45} speed={2.4} />
      </group>
    );
  }

  if (type === "sovereign") {
    return (
      <group scale={2.05}>
        <mesh position={[0, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.4, 14, 12]} />
          <Mat color="#2e4e4a" roughness={0.36} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.58, 0.12]} castShadow>
          <boxGeometry args={[0.6, 0.2, 0.42]} />
          <Mat color="#6a787c" metalness={0.74} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <torusGeometry args={[0.54, 0.04, 8, 28]} />
          <Mat color="#8ec8d0" eInt={1.7} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2.4, 0.2, 0]}>
          <torusGeometry args={[0.42, 0.025, 8, 24]} />
          <Mat color="#b8e4ea" eInt={1.3} />
        </mesh>
        {[0.14, 0.32, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.9, 0]} rotation={[0, 0, -0.28]} castShadow>
            <boxGeometry args={[0.1, 0.34, 0.16]} />
            <Mat color="#7a888c" metalness={0.76} roughness={0.22} />
          </mesh>
        ))}
        {[-0.14, -0.32, -0.5].map((x) => (
          <mesh key={x} position={[x, 0.92, 0]} rotation={[0, 0, 0.28]} castShadow>
            <coneGeometry args={[0.085, 0.42, 5]} />
            <Mat color="#3f8a72" emissive="#8ec8d0" eInt={0.9} />
          </mesh>
        ))}
        <PulseLight position={[0, 1.02, 0]} r={0.13} color="#e8f6f8" base={3} amp={0.5} speed={1.8} />
        <mesh position={[0.24, 0.2, 0.1]} castShadow>
          <boxGeometry args={[0.16, 0.42, 0.16]} />
          <Mat color="#4a5858" metalness={0.6} />
        </mesh>
        <mesh position={[-0.24, 0.2, 0.1]} castShadow>
          <boxGeometry args={[0.16, 0.42, 0.16]} />
          <Mat color="#2a4a3c" roughness={0.48} />
        </mesh>
      </group>
    );
  }

  if (type === "amalgam") {
    return (
      <group scale={1.3}>
        <mesh position={[-0.12, 0.4, 0]} castShadow>
          <sphereGeometry args={[0.26, 12, 10]} />
          <Mat color="#3a5a4c" roughness={0.42} metalness={0.28} />
        </mesh>
        <mesh position={[0.2, 0.42, 0.06]} castShadow>
          <boxGeometry args={[0.32, 0.28, 0.3]} />
          <Mat color="#5a686c" metalness={0.76} roughness={0.24} />
        </mesh>
        <mesh position={[-0.22, 0.58, 0.08]} rotation={[-0.2, 0, 0.3]} castShadow>
          <coneGeometry args={[0.1, 0.36, 5]} />
          <Mat color="#3f8a72" emissive="#8ec8d0" eInt={0.85} />
        </mesh>
        <mesh position={[0.28, 0.52, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.28, 8]} />
          <Mat color="#6a787c" metalness={0.7} />
        </mesh>
        <PulseLight position={[0.04, 0.46, 0]} r={0.1} color="#8ec8d0" base={2.7} amp={0.5} />
        <mesh position={[-0.28, 0.32, 0.16]} rotation={[0.5, 0, -0.4]} castShadow>
          <boxGeometry args={[0.06, 0.18, 0.2]} />
          <Mat color="#2a4a3c" roughness={0.46} />
        </mesh>
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.14, -0.16].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.2 * s, 0.1, z]} rotation={[0.3, 0, 0.55 * s]}>
                <boxGeometry args={[0.07, 0.3, 0.07]} />
                <Mat color="#2a3a38" />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  if (type === "chimera") {
    return (
      <group scale={1.08}>
        <mesh position={[0, 0.3, -0.04]} castShadow>
          <sphereGeometry args={[0.24, 12, 10]} />
          <Mat color="#3a5a4c" roughness={0.44} metalness={0.24} />
        </mesh>
        <mesh position={[-0.16, 0.42, 0.16]} castShadow>
          <sphereGeometry args={[0.14, 10, 8]} />
          <Mat color="#2a4a3c" roughness={0.48} />
        </mesh>
        <mesh position={[0.18, 0.44, 0.14]} castShadow>
          <boxGeometry args={[0.2, 0.16, 0.2]} />
          <Mat color="#5a686c" metalness={0.76} roughness={0.24} />
        </mesh>
        <PulseLight position={[-0.16, 0.5, 0.26]} r={0.045} color="#6ad4a0" base={2.6} amp={0.5} speed={3.8} />
        <mesh position={[0.18, 0.48, 0.26]}>
          <boxGeometry args={[0.1, 0.035, 0.035]} />
          <Mat color="#8ec8d0" eInt={2.8} />
        </mesh>
        <PulseLight position={[0.18, 0.48, 0.3]} r={0.028} color="#8ec8d0" base={2.6} amp={0.45} speed={4.2} />
        <mesh position={[-0.22, 0.56, 0.12]} rotation={[-0.3, 0, 0.35]} castShadow>
          <coneGeometry args={[0.05, 0.2, 5]} />
          <Mat color="#3f8a72" emissive="#8ec8d0" eInt={0.7} />
        </mesh>
        <mesh position={[0.26, 0.5, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.18, 8]} />
          <Mat color="#6a787c" metalness={0.72} />
        </mesh>
        <PulseLight position={[0.02, 0.38, 0.04]} r={0.075} color="#8ec8d0" base={2.3} amp={0.5} />
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.14, -0.16].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.17 * s, 0.08, z]} rotation={[0.35, 0, 0.55 * s]}>
                <boxGeometry args={[0.055, 0.26, 0.055]} />
                <Mat color={s < 0 ? "#2a4a3c" : "#3a484c"} metalness={s > 0 ? 0.6 : 0.2} roughness={0.42} />
              </mesh>
            )),
          )}
        </WalkLegs>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.26, -0.04]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <Mat color="#3a5a4c" roughness={0.46} metalness={0.22} />
      </mesh>
      <GlowOrb position={[0.04, 0.34, 0.08]} r={0.08} color="#8ec8d0" eInt={2.4} />
    </group>
  );
}

export function HexPad({
  color,
  emissive,
  selected,
  hover,
  occupied,
}: {
  color: string;
  emissive: string;
  selected?: boolean;
  hover?: boolean;
  occupied?: boolean;
}) {
  const breathe = useRef<Mesh>(null);
  // Empty pads sit proud and lit; taken pads sink and go quiet so towers own the frame.
  const glow = selected ? 0.5 : hover ? 0.42 : occupied ? 0.03 : 0.2;
  const h = occupied ? 0.07 : 0.19;
  useFrame((s) => {
    const m = breathe.current;
    if (!m) return;
    const mat = m.material as { opacity: number };
    if (occupied) {
      mat.opacity = 0.24;
      return;
    }
    mat.opacity = hover || selected ? 0.95 : 0.55 + Math.sin(s.clock.elapsedTime * 1.5) * 0.14;
  });
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.56, 0.64, h, 6]} />
        <meshStandardMaterial
          color={occupied ? color : "#8d9aa2"}
          metalness={occupied ? 0.42 : 0.58}
          roughness={occupied ? 0.52 : 0.3}
          emissive={emissive}
          emissiveIntensity={glow}
        />
      </mesh>
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.68, 0.7, 0.024, 6]} />
        <meshStandardMaterial color="#2a3238" metalness={0.55} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.018, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.74, 0.012, 6]} />
        <meshStandardMaterial color="#1a2026" metalness={0.62} roughness={0.42} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return (
          <mesh key={`stud-${i}`} position={[Math.cos(a) * 0.64, 0.04, Math.sin(a) * 0.64]}>
            <cylinderGeometry args={[0.028, 0.032, 0.04, 6]} />
            <meshStandardMaterial color={emissive} emissive={emissive} emissiveIntensity={occupied ? 0.12 : 0.55} metalness={0.4} roughness={0.32} />
          </mesh>
        );
      })}
      <mesh ref={breathe} rotation={[-Math.PI / 2, 0, 0]} position={[0, h + 0.006, 0]}>
        <ringGeometry args={[occupied ? 0.5 : 0.44, 0.56, 6]} />
        <meshBasicMaterial color={emissive} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
      {!occupied ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h + 0.004, 0]}>
          <circleGeometry args={[0.42, 6]} />
          <meshStandardMaterial
            color={color}
            metalness={0.34}
            roughness={0.62}
            emissive={emissive}
            emissiveIntensity={hover || selected ? 0.55 : 0.28}
          />
        </mesh>
      ) : null}
      {hover || selected ? (
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.018, 0.04, 1.7, 6]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.42} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function NexusCore({ color, health, hitGen = 0 }: { color: string; health: number; hitGen?: number }) {
  const ref = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  const shield = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const ring2 = useRef<Mesh>(null);
  const seenHit = useRef(hitGen);
  const shock = useRef(0);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (hitGen !== seenHit.current) {
      seenHit.current = hitGen;
      shock.current = 1;
    }
    shock.current = Math.max(0, shock.current - dt * 2.6);
    const punch = shock.current * shock.current;
    if (ref.current) {
      ref.current.rotation.y = t * 0.35;
      ref.current.rotation.x = Math.sin(t * 0.4) * 0.12;
      ref.current.position.y = 1.12 - punch * 0.22;
      ref.current.scale.setScalar(1 - punch * 0.16);
    }
    if (inner.current) inner.current.rotation.y = -t * 0.55;
    if (shield.current) {
      const m = shield.current.material as { opacity: number; emissiveIntensity?: number };
      m.opacity = 0.08 + health * 0.22 + Math.sin(t * 2) * 0.04 + punch * 0.4;
      shield.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03 + punch * 0.22);
    }
    if (ring.current) ring.current.rotation.z = t * 0.55;
    if (ring2.current) ring2.current.rotation.z = -t * 0.32;
  });
  const hot = health < 0.35 ? "#c45c5c" : color;
  return (
    <group>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[1.78, 2.02, 0.1, 8]} />
        <Mat color="#242a32" metalness={0.74} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1.42, 1.55, 0.06, 8]} />
        <Mat color="#1c2228" metalness={0.7} roughness={0.36} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.52, i % 2 === 0 ? 0.38 : 0.26, Math.sin(a) * 1.52]} rotation={[0, -a, 0]} castShadow>
            <boxGeometry args={[0.2, i % 2 === 0 ? 0.58 : 0.34, 0.3]} />
            <Mat color="#364048" metalness={0.74} roughness={0.3} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[0.98, 1.16, 0.22, 8]} />
        <Mat color="#1e242c" metalness={0.8} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.95, 8]} />
        <Mat color={hot} eInt={0.4} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={`inlay-${i}`} position={[Math.cos(a) * 0.58, 0.18, Math.sin(a) * 0.58]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.42]} />
            <Mat color={hot} eInt={0.55} />
          </mesh>
        );
      })}
      <PulseLight position={[0, 1.42, 0]} r={0.06} color={hot} base={1.2} amp={0.4} speed={1.8} />
      <mesh ref={ring} position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.92, 0.028, 8, 48]} />
        <Mat color={hot} eInt={0.85} />
      </mesh>
      <mesh ref={ring2} position={[0, 1.05, 0]} rotation={[Math.PI / 2.5, 0.4, 0]}>
        <torusGeometry args={[0.7, 0.016, 8, 36]} />
        <Mat color={hot} eInt={0.6} />
      </mesh>
      <mesh ref={ref} position={[0, 1.12, 0]} castShadow>
        <octahedronGeometry args={[0.52, 0]} />
        <Mat color={hot} eInt={0.95 + health * 0.35} roughness={0.14} metalness={0.28} />
      </mesh>
      <mesh ref={inner} position={[0, 1.12, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <Mat color="#f2f6f8" eInt={1.8} roughness={0.08} />
      </mesh>
      <mesh ref={shield} position={[0, 1.08, 0]}>
        <sphereGeometry args={[1.22, 32, 20]} />
        <meshStandardMaterial
          color={hot}
          emissive={hot}
          emissiveIntensity={0.28}
          transparent
          opacity={0.16}
          roughness={0.08}
          metalness={0.12}
        />
      </mesh>
    </group>
  );
}

export function SpawnGate({ color }: { color: string }) {
  const a = useRef<Mesh>(null);
  const b = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (a.current) a.current.rotation.z = t * 0.8;
    if (b.current) b.current.rotation.z = -t * 1.1;
    if (beam.current) {
      const m = beam.current.material as { opacity: number };
      m.opacity = 0.18 + Math.sin(t * 3.2) * 0.08;
    }
  });
  return (
    <group>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(a) * 0.78, 0.55, Math.sin(a) * 0.78]} rotation={[0, -a, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.14, 1.1, 0.2]} />
              <Mat color="#2a3238" metalness={0.68} roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.58, 0]}>
              <boxGeometry args={[0.16, 0.08, 0.22]} />
              <Mat color={color} eInt={0.7} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.86, 0.94, 0.12, 8]} />
        <Mat color="#1c2228" metalness={0.7} roughness={0.38} />
      </mesh>
      <mesh ref={a} position={[0, 1.12, 0]}>
        <torusGeometry args={[0.74, 0.038, 8, 42]} />
        <Mat color={color} eInt={1.4} />
      </mesh>
      <mesh ref={b} position={[0, 1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.52, 0.03, 8, 30]} />
        <Mat color={color} eInt={1.1} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.018, 8, 28]} />
        <Mat color={color} eInt={0.7} />
      </mesh>
      <mesh ref={beam} position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.05, 0.24, 2.7, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.24} depthWrite={false} />
      </mesh>
      <PulseLight position={[0, 1.12, 0]} r={0.17} color={color} base={2.0} amp={0.55} speed={2.8} />
    </group>
  );
}

/**
 * Coverage footprint for a hovered or selected battery. The wash carries the
 * area, the rim carries the edge; a bare outline reads as stray ground geometry
 * from the iso camera.
 */
export function RangeRing({ radius, color }: { radius: number; color: string }) {
  const wash = useRef<Mesh>(null);
  const rim = useRef<Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current = Math.min(1, t.current + dt * 6);
    const k = t.current * (2 - t.current);
    const w = wash.current;
    const r = rim.current;
    if (w) (w.material as { opacity: number }).opacity = k * 0.075;
    if (r) (r.material as { opacity: number }).opacity = k * 0.85;
    if (w) w.scale.setScalar(0.94 + k * 0.06);
    if (r) r.scale.setScalar(0.94 + k * 0.06);
  });
  const outer = Math.max(0.3, radius);
  return (
    <group>
      <mesh ref={wash} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.075, 0]} renderOrder={2}>
        <circleGeometry args={[outer, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.085, 0]} renderOrder={3}>
        <ringGeometry args={[outer - 0.08, outer, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export function HexField({
  cols,
  rows,
  color,
  accent,
  skip,
}: {
  cols: number;
  rows: number;
  color: string;
  accent: string;
  skip: Set<string>;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const count = cols * rows;
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D();
    let i = 0;
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let n = 0; n < count; n++) m.setMatrixAt(n, dummy.matrix);
    i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (skip.has(`${c},${r}`) || (c + r) % 2 === 0) continue;
        const w = cellToWorld(c, r, cols, rows);
        dummy.position.set(w.x, 0.012, w.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
  }, [cols, rows, count, skip]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <ringGeometry args={[0.74, 0.84, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={accent}
        emissiveIntensity={0.05}
        roughness={0.9}
        metalness={0.08}
        transparent
        opacity={0.12}
      />
    </instancedMesh>
  );
}

type Scatter = { pos: Vec; a: number; k: number; j: number };

/** Mycelion: wet moss beds and glowing spore stalks. Humid, soft, slow. */
export function DecorOrganic({ seed, count = 30 }: { seed: number; count?: number }) {
  const items = useMemo(() => scatter(seed, count, "mycelion"), [seed, count]);
  return (
    <group>
      {items.map((it, i) => {
        const kind = i % 4;
        if (kind === 0) {
          const h = 1.1 + it.k * 1.5;
          return (
            <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.11 + it.j * 0.05, h, 6]} />
                <Mat color="#1c4030" roughness={0.72} metalness={0.04} emissive="#1f8a62" eInt={0.14} />
              </mesh>
              <mesh position={[0, h + 0.06, 0]} castShadow>
                <sphereGeometry args={[0.13 + it.j * 0.08, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
                <Mat color="#2f7d5e" roughness={0.5} emissive="#3dcaa0" eInt={0.55} side={DoubleSide} />
              </mesh>
              <mesh position={[0, h - 0.02, 0]}>
                <sphereGeometry args={[0.055, 8, 8]} />
                <Mat color="#7cf0c4" eInt={2.2} />
              </mesh>
            </group>
          );
        }
        if (kind === 1) {
          return (
            <mesh
              key={i}
              position={[it.pos[0], it.pos[1] + 0.06 + it.k * 0.1, it.pos[2]]}
              rotation={[it.j * 0.5, it.a, it.k * 0.4]}
              scale={[1, 0.52, 1]}
              castShadow
            >
              <icosahedronGeometry args={[0.36 + it.k * 0.3, 1]} />
              <Mat color="#22553f" roughness={0.28} metalness={0.12} emissive="#1f8a62" eInt={0.16} />
            </mesh>
          );
        }
        if (kind === 2) {
          const h = 0.7 + it.k * 0.9;
          return (
            <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.16, h, 7]} />
                <Mat color="#163828" roughness={0.68} metalness={0.06} />
              </mesh>
              {[0, 1, 2, 3].map((n) => {
                const a = (n / 4) * Math.PI * 2;
                return (
                  <mesh key={n} position={[Math.cos(a) * 0.22, h * 0.7, Math.sin(a) * 0.22]} rotation={[0.6, a, 0]} castShadow>
                    <capsuleGeometry args={[0.04, 0.28, 3, 5]} />
                    <Mat color="#2a6a52" roughness={0.4} emissive="#3dcaa0" eInt={0.35} />
                  </mesh>
                );
              })}
              <PulseLight position={[0, h + 0.08, 0]} r={0.07} color="#7cf0c4" base={1.8} amp={0.45} speed={2.1} />
            </group>
          );
        }
        return (
          <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
            {[0, 1, 2].map((n) => (
              <mesh
                key={n}
                position={[(n - 1) * 0.22, 0.28 + n * 0.12, 0]}
                rotation={[0, 0, (n - 1) * 0.4]}
                castShadow
              >
                <capsuleGeometry args={[0.045, 0.34 + n * 0.16, 4, 6]} />
                <Mat color="#2a6a52" roughness={0.42} emissive="#3dcaa0" eInt={0.4} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Kron Forge: plate stacks, slag heaps and cooling ember rails. */
export function DecorMech({ seed, count = 28 }: { seed: number; count?: number }) {
  const items = useMemo(() => scatter(seed, count, "forge"), [seed, count]);
  return (
    <group>
      {items.map((it, i) => {
        const kind = i % 4;
        if (kind === 0) {
          return (
            <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
              {[0, 1, 2].map((n) => (
                <mesh
                  key={n}
                  position={[it.j * 0.1 * n, 0.06 + n * 0.13, it.k * 0.1 * n]}
                  rotation={[0, n * 0.34, 0]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[1.15 - n * 0.2, 0.12, 0.8 - n * 0.14]} />
                  <Mat color={n === 1 ? "#3a322c" : "#2a2e32"} metalness={0.8} roughness={0.34} />
                </mesh>
              ))}
            </group>
          );
        }
        if (kind === 1) {
          return (
            <group key={i} position={it.pos}>
              <mesh position={[0, 0.24, 0]} castShadow>
                <coneGeometry args={[0.55 + it.k * 0.25, 0.55 + it.j * 0.3, 7]} />
                <Mat color="#241a16" metalness={0.35} roughness={0.85} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[0.5, 0.78 + it.k * 0.2, 12]} />
                <meshBasicMaterial color="#c45a28" transparent opacity={0.28} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          );
        }
        if (kind === 2) {
          const h = 1.3 + it.k * 1.1;
          return (
            <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.2, h, 8]} />
                <Mat color="#2a2e32" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, h + 0.04, 0]}>
                <cylinderGeometry args={[0.19, 0.19, 0.08, 8]} />
                <Mat color="#c45a28" eInt={1.1} metalness={0.4} roughness={0.3} />
              </mesh>
              <PulseLight position={[0, h + 0.14, 0]} r={0.06} color="#e07a38" base={1.4} amp={0.4} speed={2.4} />
            </group>
          );
        }
        return (
          <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
            <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 1.6 + it.k * 0.7, 8]} />
              <Mat color="#3a322c" metalness={0.7} roughness={0.36} />
            </mesh>
            <mesh position={[0, 0.3, 0.1]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, 1.5 + it.k * 0.7, 6]} />
              <Mat color="#e07a38" eInt={1.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Aegis Rift: ice shards fused to torn plate. Cold on one side, forged on the other. */
export function DecorHybrid({ seed, count = 30 }: { seed: number; count?: number }) {
  const items = useMemo(() => scatter(seed, count, "aegis"), [seed, count]);
  return (
    <group>
      {items.map((it, i) => {
        const kind = i % 4;
        if (kind === 0) {
          const h = 1.2 + it.k * 1.6;
          return (
            <group key={i} position={it.pos} rotation={[it.j * 0.2, it.a, it.k * 0.24]}>
              <mesh position={[0, h / 2, 0]} castShadow>
                <coneGeometry args={[0.16 + it.j * 0.1, h, 5]} />
                <meshStandardMaterial
                  color="#5f7c8a"
                  emissive="#8ec8d0"
                  emissiveIntensity={0.4}
                  roughness={0.16}
                  metalness={0.3}
                  transparent
                  opacity={0.72}
                />
              </mesh>
            </group>
          );
        }
        if (kind === 1) {
          return (
            <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
              <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0.42 + it.j * 0.3]} castShadow receiveShadow>
                <boxGeometry args={[0.9 + it.k * 0.5, 0.1, 0.62]} />
                <Mat color="#2d353c" metalness={0.78} roughness={0.36} />
              </mesh>
              <mesh position={[0.1, 0.12, 0.16]} rotation={[0, it.j, 0]} castShadow>
                <coneGeometry args={[0.12, 0.5, 5]} />
                <meshStandardMaterial
                  color="#6d8894"
                  emissive="#8ec8d0"
                  emissiveIntensity={0.45}
                  roughness={0.18}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            </group>
          );
        }
        if (kind === 2) {
          return (
            <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
              <mesh position={[0, 0.42, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.14, 0.84, 6]} />
                <Mat color="#2a343c" metalness={0.74} roughness={0.3} />
              </mesh>
              <PulseLight position={[0, 0.88, 0]} r={0.08} color="#8ec8d0" base={1.6} amp={0.4} speed={2.2} />
              <mesh position={[0, 0.88, 0]}>
                <octahedronGeometry args={[0.14, 0]} />
                <Mat color="#8ec8d0" eInt={1.4} />
              </mesh>
              <mesh position={[0.16, 0.28, 0]} rotation={[0, 0, 0.5]} castShadow>
                <coneGeometry args={[0.08, 0.4, 5]} />
                <meshStandardMaterial color="#6d8894" emissive="#8ec8d0" emissiveIntensity={0.4} roughness={0.18} transparent opacity={0.7} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={i} position={it.pos} rotation={[0, it.a, 0]}>
            <mesh position={[0, 0.16, 0]} scale={[1, 0.6, 1]} castShadow>
              <icosahedronGeometry args={[0.32 + it.k * 0.22, 0]} />
              <Mat color="#28453e" roughness={0.42} emissive="#3f8a72" eInt={0.24} />
            </mesh>
            <mesh position={[0, 0.42, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <Mat color="#9fd8de" eInt={1.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export type FieldSpot = { x: number; z: number; k: number; a: number };

/**
 * Ground detail on free cells inside the arena. Deliberately low and small:
 * it should read as surface texture under the pads, never as another object
 * the player has to parse.
 */
export function DecorField({ id, spots }: { id: MapId; spots: FieldSpot[] }) {
  return (
    <group>
      {spots.map((s, i) =>
        id === "mycelion" ? (
          <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.a, 0]}>
            <mesh position={[0, 0.03, 0]} scale={[1, 0.3, 1]} castShadow>
              <icosahedronGeometry args={[0.19 + s.k * 0.3, 0]} />
              <Mat color="#20503c" roughness={0.36} metalness={0.1} emissive="#1f8a62" eInt={0.16} />
            </mesh>
            {i % 3 === 0 ? (
              <>
                <mesh position={[0.1, 0.14, 0.05]} rotation={[0, 0, 0.16]} castShadow>
                  <capsuleGeometry args={[0.022, 0.2, 4, 5]} />
                  <Mat color="#2a6a52" roughness={0.4} emissive="#3dcaa0" eInt={0.24} />
                </mesh>
                <PulseLight position={[0.118, 0.27, 0.05]} r={0.036} color="#7cf0c4" base={1.6} amp={0.4} speed={2.6} />
              </>
            ) : null}
          </group>
        ) : id === "forge" ? (
          <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.a, 0]}>
            <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.34 + s.k * 0.7, 0.05, 0.26 + s.k * 0.4]} />
              <Mat color="#3a332c" metalness={0.8} roughness={0.4} />
            </mesh>
            {i % 3 === 0 ? (
              <mesh position={[0.04, 0.08, 0]} rotation={[0, s.a, 0.26]} castShadow>
                <boxGeometry args={[0.2, 0.08, 0.18]} />
                <Mat color="#4a4038" metalness={0.78} roughness={0.34} />
              </mesh>
            ) : i % 3 === 1 ? (
              <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.07, 0.115, 8]} />
                <Mat color="#e2661c" eInt={0.75} />
              </mesh>
            ) : null}
          </group>
        ) : (
          <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.a, 0]}>
            {i % 3 === 0 ? (
              <mesh position={[0, 0.15, 0]} rotation={[0.1, 0, 0.2]} castShadow>
                <coneGeometry args={[0.075, 0.3 + s.k * 0.5, 5]} />
                <meshStandardMaterial
                  color="#54707c"
                  emissive="#9fd8de"
                  emissiveIntensity={0.22}
                  roughness={0.18}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            ) : (
              <mesh position={[0, 0.03, 0]} rotation={[0, 0, 0.2]} castShadow receiveShadow>
                <boxGeometry args={[0.3 + s.k * 0.6, 0.055, 0.24 + s.k * 0.3]} />
                <Mat color="#38424a" metalness={0.76} roughness={0.38} />
              </mesh>
            )}
          </group>
        ),
      )}
    </group>
  );
}

function scatter(seed: number, n: number, style: MapId): Scatter[] {
  const out: Scatter[] = [];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const { arenaR, squash } = arenaMetrics(16, 11);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.06 + rand() * 0.38;
    const x = Math.cos(a) * r * arenaR;
    const z = Math.sin(a) * r * arenaR * squash;
    out.push({
      pos: [x, terrainElevation(x, z, arenaR, squash, style), z],
      a: rand() * Math.PI * 2,
      k: rand(),
      j: rand() * 2 - 1,
    });
  }
  return out;
}

export function Motes({ color, count = 40 }: { color: string; count?: number }) {
  const ref = useRef<Group>(null);
  const pts = useMemo(() => {
    const a: Vec[] = [];
    for (let i = 0; i < count; i++) {
      a.push([(Math.random() - 0.5) * 28, 0.4 + Math.random() * 4, (Math.random() - 0.5) * 22]);
    }
    return a;
  }, [count]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.y = (ref.current.position.y + dt * 0.12) % 2;
  });
  return (
    <group ref={ref}>
      {pts.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}
