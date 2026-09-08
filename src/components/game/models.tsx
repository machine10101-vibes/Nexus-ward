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

export function TowerModel({ type, level, ghost }: { type: TowerId; level: number; ghost?: boolean }) {
  const body = <TowerBody type={type} level={level} />;
  if (!ghost) return body;
  return <GhostContext.Provider value>{body}</GhostContext.Provider>;
}

function TowerBody({ type, level }: { type: TowerId; level: number }) {
  const def = TOWERS[type];
  const yaw = useRef<Group>(null);
  useFrame((_, dt) => {
    if (type === "tesla" && yaw.current) yaw.current.rotation.y += dt * 0.8;
  });

  // Pulse — squat, wide, twin barrels forward. Reads as a low block from above.
  if (type === "pulse") {
    return (
      <group>
        <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.58, 0.14, 6]} />
          <Mat color="#3b444d" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.36, 0.18, 8]} />
          <Mat color="#49535d" metalness={0.65} roughness={0.3} />
        </mesh>
        <group ref={yaw} position={[0, 0.42, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.56, 0.2, 0.4]} />
            <Mat color="#5c6771" metalness={0.55} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0, -0.2]} castShadow>
            <boxGeometry args={[0.34, 0.26, 0.2]} />
            <Mat color="#454f58" metalness={0.6} roughness={0.34} />
          </mesh>
          {([-0.17, 0.17] as const).map((x) => (
            <group key={x}>
              <mesh position={[x, 0.01, 0.36]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.085, 0.09, 0.62, 10]} />
                <Mat color="#6b7681" metalness={0.6} roughness={0.28} />
              </mesh>
              <mesh position={[x, 0.01, 0.66]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.09, 10]} />
                <Mat color={def.color} eInt={0.75 + level * 0.18} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.16, -0.02]}>
            <boxGeometry args={[0.14, 0.06, 0.24]} />
            <Mat color={def.color} eInt={0.8 + level * 0.2} />
          </mesh>
        </group>
      </group>
    );
  }

  // Arc Lance — tall, thin mast with a bright tip. Reads as a small dot with a long shadow.
  if (type === "arc") {
    return (
      <group>
        <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.44, 0.14, 6]} />
          <Mat color="#39464b" metalness={0.6} roughness={0.4} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.4;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.26, 0.26, Math.sin(a) * 0.26]} rotation={[0, -a, 0.22]} castShadow>
              <boxGeometry args={[0.06, 0.42, 0.06]} />
              <Mat color="#414f56" metalness={0.6} roughness={0.34} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.13, 1.6, 8]} />
          <Mat color="#4a5c64" metalness={0.55} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.022, 8, 24]} />
          <Mat color={def.color} eInt={0.42} />
        </mesh>
        <mesh position={[0, 1.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.018, 8, 20]} />
          <Mat color={def.color} eInt={0.55} />
        </mesh>
        <mesh position={[0, 1.78, 0]}>
          <octahedronGeometry args={[0.17 + level * 0.015, 0]} />
          <Mat color={def.color} eInt={1.15 + level * 0.2} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  // Frost Mortar — a wide open dish on a drum. Reads as a filled circle from above.
  if (type === "frost") {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.46, 0.56, 0.2, 8]} />
          <Mat color="#3a444e" metalness={0.5} roughness={0.42} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.3, 0.28, Math.sin(a) * 0.3]} castShadow>
              <boxGeometry args={[0.07, 0.24, 0.07]} />
              <Mat color="#4a5563" metalness={0.62} roughness={0.3} />
            </mesh>
          );
        })}
        <group position={[0, 0.46, 0]} rotation={[-0.34, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.52, 22, 10, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42]} />
            <Mat color="#55677a" metalness={0.42} roughness={0.34} side={DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <torusGeometry args={[0.5, 0.026, 8, 32]} />
            <Mat color={def.color} eInt={0.45 + level * 0.14} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <Mat color={def.color} eInt={1.0} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.4, 10]} />
            <Mat color="#5f7181" metalness={0.5} roughness={0.28} />
          </mesh>
        </group>
      </group>
    );
  }

  // Rail Piercer — one long barrel over a flat sled. Reads as a bar from above.
  if (type === "rail") {
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.74, 0.14, 0.5]} />
          <Mat color="#3f4045" metalness={0.75} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.22, -0.16]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.34]} />
          <Mat color="#4b4c52" metalness={0.7} roughness={0.3} />
        </mesh>
        <group position={[0, 0.44, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.16, 1.5]} />
            <Mat color="#5d5e63" metalness={0.72} roughness={0.24} />
          </mesh>
          {([-0.13, 0.13] as const).map((x) => (
            <mesh key={x} position={[x, 0.11, 0.16]} castShadow>
              <boxGeometry args={[0.05, 0.06, 1.62]} />
              <Mat color={def.color} eInt={0.42 + level * 0.14} metalness={0.5} roughness={0.2} />
            </mesh>
          ))}
          <mesh position={[0, 0.03, 0.92]}>
            <boxGeometry args={[0.26, 0.1, 0.1]} />
            <Mat color={def.color} eInt={0.95} />
          </mesh>
          {([-0.24, 0.24] as const).map((x) => (
            <mesh key={x} position={[x, 0.02, -0.42]}>
              <cylinderGeometry args={[0.11, 0.11, 0.1, 10]} />
              <Mat color={def.color} eInt={0.7} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }

  // Tesla Spire — stacked toroids on a mast. Reads as concentric rings from above.
  return (
    <group>
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.46, 0.16, 8]} />
        <Mat color="#3a4640" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.15, 0.9, 10]} />
        <Mat color="#4a5a54" metalness={0.5} roughness={0.3} />
      </mesh>
      <group ref={yaw} position={[0, 0.92, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.34, 0.042, 8, 22]} />
          <Mat color={def.color} eInt={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.034, 8, 20]} />
          <Mat color={def.color} eInt={0.65} />
        </mesh>
        <mesh position={[0, 0.37, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.028, 8, 18]} />
          <Mat color={def.color} eInt={0.8} />
        </mesh>
        <mesh position={[0, -0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.03, 8, 24]} />
          <Mat color={def.color} eInt={0.35} />
        </mesh>
      </group>
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <Mat color={def.color} eInt={1.35 + level * 0.15} />
      </mesh>
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
        <mesh position={[0, 0.22, 0.02]} castShadow>
          <sphereGeometry args={[0.22, 10, 8]} />
          <Mat color="#3d8f62" roughness={0.58} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.2, 0.22]} castShadow>
          <sphereGeometry args={[0.14, 8, 8]} />
          <Mat color="#348058" roughness={0.52} metalness={0.06} />
        </mesh>
        {([-0.07, 0.07] as const).map((x) => (
          <mesh key={x} position={[x, 0.26, 0.32]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <Mat color="#b8ffd8" eInt={3.4} />
          </mesh>
        ))}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[0.05 * s, 0.3, 0.28]} rotation={[0.5, 0, 0.35 * s]}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 5]} />
            <Mat color="#1c3a2c" roughness={0.65} />
          </mesh>
        ))}
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.12, -0.04, -0.2].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.16 * s, 0.06, z]} rotation={[0.45, 0, 0.85 * s]}>
                <boxGeometry args={[0.035, 0.22, 0.035]} />
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
        <mesh position={[0, 0.3, -0.08]} castShadow>
          <sphereGeometry args={[0.28, 12, 10]} />
          <Mat color="#2f7a54" roughness={0.52} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.28, 0.22]} castShadow>
          <sphereGeometry args={[0.2, 10, 8]} />
          <Mat color="#348058" roughness={0.5} metalness={0.08} />
        </mesh>
        {([-0.08, 0.08] as const).map((x) => (
          <mesh key={x} position={[x, 0.22, 0.36]} rotation={[0.6, 0, x * 2]}>
            <boxGeometry args={[0.05, 0.04, 0.16]} />
            <Mat color="#1a4030" roughness={0.45} />
          </mesh>
        ))}
        {([-0.07, 0.07] as const).map((x) => (
          <mesh key={`e${x}`} position={[x, 0.34, 0.36]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <Mat color="#6ad4a0" eInt={2.8} />
          </mesh>
        ))}
        <mesh position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <Mat color="#6ad4a0" eInt={1.4} />
        </mesh>
        <WalkLegs>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.18, 0.0, -0.22].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.22 * s, 0.08, z]} rotation={[0.4, 0, 0.7 * s]}>
                <boxGeometry args={[0.05, 0.28, 0.05]} />
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
          <sphereGeometry args={[0.3, 12, 10]} />
          <Mat color="#2c6b4c" roughness={0.48} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.26, 0.26]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#245844" roughness={0.46} metalness={0.14} />
        </mesh>
        <mesh position={[0, 0.48, -0.02]} castShadow>
          <boxGeometry args={[0.5, 0.16, 0.46]} />
          <Mat color="#1e4a38" metalness={0.22} roughness={0.42} />
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
          <mesh key={`e${x}`} position={[x, 0.32, 0.38]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <Mat color="#6ad4a0" eInt={2.2} />
          </mesh>
        ))}
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
          <sphereGeometry args={[0.3, 12, 10]} />
          <Mat color="#245c40" roughness={0.46} metalness={0.14} />
        </mesh>
        <mesh position={[0, 0.26, 0.24]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#1c4a34" roughness={0.44} />
        </mesh>
        <mesh position={[0, 0.5, -0.02]} castShadow>
          <boxGeometry args={[0.44, 0.14, 0.4]} />
          <Mat color="#163828" metalness={0.24} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.66, 0]} castShadow>
          <coneGeometry args={[0.1, 0.28, 5]} />
          <Mat color="#7ee0b4" emissive="#8af0c4" eInt={0.9} />
        </mesh>
        {([-0.34, 0.34] as const).map((x) => (
          <mesh key={x} position={[x, 0.48, 0.14]} rotation={[0.15, 0, x > 0 ? -0.85 : 0.85]} castShadow>
            <boxGeometry args={[0.07, 0.42, 0.26]} />
            <Mat color="#1a3a2c" metalness={0.28} roughness={0.42} />
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
          <sphereGeometry args={[0.34, 12, 10]} />
          <Mat color="#4aaa78" roughness={0.5} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.24, 0.28]} castShadow>
          <sphereGeometry args={[0.18, 10, 8]} />
          <Mat color="#3d8f62" roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.52, -0.04]} castShadow>
          <boxGeometry args={[0.5, 0.16, 0.46]} />
          <Mat color="#245844" metalness={0.2} roughness={0.44} />
        </mesh>
        {[-0.9, -0.3, 0.3, 0.9].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.26, 0.64, Math.cos(a) * 0.22]} rotation={[-0.35, a, 0]} castShadow>
            <coneGeometry args={[0.075, 0.48, 5]} />
            <Mat color="#7ee0b4" emissive="#8af0c4" eInt={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.74, 0]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <Mat color="#8af0c4" eInt={2.6} />
        </mesh>
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
        <mesh position={[0, 0.78, 0]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#b8ffd8" eInt={2.8} />
        </mesh>
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
          <icosahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial color="#4aaa88" emissive="#3dcaa0" emissiveIntensity={1.25} roughness={0.32} transparent opacity={0.9} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.1, 10, 8]} />
          <Mat color="#a8f0d4" eInt={2.6} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.2, -0.08, Math.sin(a) * 0.2]} rotation={[0.8, a, 0]}>
              <capsuleGeometry args={[0.02, 0.16, 3, 5]} />
              <Mat color="#2a6a52" roughness={0.45} emissive="#3dcaa0" eInt={0.35} />
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
          <icosahedronGeometry args={[0.3, 1]} />
          <meshStandardMaterial color="#6ad4a8" emissive="#3dcaa0" emissiveIntensity={1.6} roughness={0.28} transparent opacity={0.92} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.12, 10, 8]} />
          <Mat color="#d8ffe8" eInt={3} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.32, 0.02, Math.sin(a) * 0.32]} rotation={[0.2, a, 0.4]}>
              <octahedronGeometry args={[0.13, 0]} />
              <Mat color="#8af0c4" eInt={1.9} />
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
          <cylinderGeometry args={[0.26, 0.26, 0.09, 6]} />
          <Mat color="#6a7078" metalness={0.78} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.08, 8]} />
          <Mat color="#c46a3a" eInt={2.4} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          return (
            <group key={i} position={[Math.cos(a) * 0.28, 0.05, Math.sin(a) * 0.28]} rotation={[0, -a, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.03, 8]} />
                <Mat color="#2a2e32" metalness={0.6} roughness={0.35} />
              </mesh>
              <Rotor position={[0, 0.03, 0]} width={0.32} />
            </group>
          );
        })}
      </HoverFloat>
    );
  }

  if (type === "walker") {
    return (
      <group>
        <mesh position={[0, 0.52, 0]} castShadow>
          <boxGeometry args={[0.34, 0.32, 0.26]} />
          <Mat color="#5e666e" metalness={0.68} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.78, 0.04]} castShadow>
          <boxGeometry args={[0.18, 0.2, 0.2]} />
          <Mat color="#3e464e" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.8, 0.16]}>
          <boxGeometry args={[0.16, 0.04, 0.04]} />
          <Mat color="#e08848" eInt={2.6} />
        </mesh>
        <mesh position={[0.06, 0.96, -0.02]} rotation={[0.15, 0, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
          <Mat color="#2a2e32" metalness={0.7} />
        </mesh>
        <mesh position={[0.12, 0.2, 0.02]} castShadow>
          <boxGeometry args={[0.1, 0.4, 0.12]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.32} />
        </mesh>
        <mesh position={[-0.12, 0.2, -0.02]} castShadow>
          <boxGeometry args={[0.1, 0.4, 0.12]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.32} />
        </mesh>
      </group>
    );
  }

  if (type === "siege") {
    return (
      <group scale={1.18}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.56, 0.28, 0.44]} />
          <Mat color="#4e545c" metalness={0.72} roughness={0.3} />
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
        <mesh position={[0, 0.4, -0.3]} castShadow>
          <boxGeometry args={[0.28, 0.2, 0.16]} />
          <Mat color="#2a2e32" metalness={0.65} roughness={0.36} />
        </mesh>
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
          <boxGeometry args={[0.7, 0.5, 0.1]} />
          <Mat color="#2a3038" metalness={0.82} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.58, 0.28]}>
          <boxGeometry args={[0.18, 0.18, 0.04]} />
          <Mat color="#c46a3a" eInt={1.8} />
        </mesh>
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
          <mesh key={x} position={[x, 1.08, 0.02]} castShadow>
            <boxGeometry args={[0.07, 0.16, 0.07]} />
            <Mat color="#c46a3a" eInt={1.6} />
          </mesh>
        ))}
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
          <mesh key={`c${x}`} position={[x, 1.16, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 0.5, 8]} />
            <Mat color="#c46a3a" eInt={1.9} />
          </mesh>
        ))}
        {[-0.22, 0, 0.22].map((x) => (
          <mesh key={x} position={[x, 1.3, 0]} castShadow>
            <boxGeometry args={[0.08, 0.16, 0.08]} />
            <Mat color="#e08848" eInt={1.7} />
          </mesh>
        ))}
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
          <boxGeometry args={[0.28, 0.12, 0.72]} />
          <Mat color="#5a6068" metalness={0.7} roughness={0.28} />
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
          <mesh key={x} position={[x, -0.04, 0.26]}>
            <boxGeometry args={[0.07, 0.05, 0.2]} />
            <Mat color="#e08848" eInt={2.5} />
          </mesh>
        ))}
        <Rotor position={[0.3, 0.1, 0.08]} width={0.4} />
        <Rotor position={[-0.3, 0.1, 0.08]} width={0.4} />
      </HoverFloat>
    );
  }

  if (type === "razor") {
    return (
      <HoverFloat amp={0.07}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.07, 1.02]} />
          <Mat color="#6a5050" metalness={0.74} roughness={0.24} />
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
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <Mat color="#cfeaf0" eInt={3} />
        </mesh>
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
        <mesh>
          <sphereGeometry args={[0.1, 10, 8]} />
          <Mat color="#e8f6f8" eInt={3.2} />
        </mesh>
        <mesh position={[0, -0.28, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.4, 6]} />
          <meshStandardMaterial color="#8ec8d0" transparent opacity={0.32} emissive="#8ec8d0" emissiveIntensity={0.85} />
        </mesh>
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
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.17, 10, 8]} />
          <Mat color="#8ec8d0" eInt={2.8} />
        </mesh>
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
        <mesh position={[0, 0.94, 0]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <Mat color="#b8e4ea" eInt={2.6} />
        </mesh>
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
        <mesh position={[0, 1.02, 0]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <Mat color="#e8f6f8" eInt={3} />
        </mesh>
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
        <mesh position={[0.04, 0.46, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <Mat color="#8ec8d0" eInt={2.7} />
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

  return (
    <group>
      <mesh position={[0, 0.26, -0.04]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <Mat color="#3a5a4c" roughness={0.46} metalness={0.22} />
      </mesh>
      <mesh position={[0.16, 0.32, 0.16]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.2]} />
        <Mat color="#5a686c" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[-0.12, 0.28, 0.2]} castShadow>
        <sphereGeometry args={[0.1, 8, 8]} />
        <Mat color="#2a4a3c" roughness={0.5} />
      </mesh>
      <mesh position={[0.04, 0.34, 0.08]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <Mat color="#8ec8d0" eInt={2.4} />
      </mesh>
      <WalkLegs>
        {([-1, 1] as const).flatMap((s, i) =>
          [0.16, -0.14].map((z, j) => (
            <mesh key={`${i}${j}`} position={[0.16 * s, 0.08, z]} rotation={[0.35, 0, 0.55 * s]}>
              <boxGeometry args={[0.055, 0.24, 0.055]} />
              <Mat color="#2a3a38" />
            </mesh>
          )),
        )}
      </WalkLegs>
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
        <cylinderGeometry args={[0.56, 0.62, h, 6]} />
        <meshStandardMaterial
          color={occupied ? color : "#8d9aa2"}
          metalness={0.5}
          roughness={occupied ? 0.5 : 0.34}
          emissive={emissive}
          emissiveIntensity={glow}
        />
      </mesh>
      <mesh ref={breathe} rotation={[-Math.PI / 2, 0, 0]} position={[0, h + 0.006, 0]}>
        <ringGeometry args={[occupied ? 0.5 : 0.44, 0.56, 6]} />
        <meshBasicMaterial color={emissive} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
      {!occupied ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, h + 0.004, 0]}>
          <circleGeometry args={[0.42, 6]} />
          <meshStandardMaterial
            color={color}
            metalness={0.3}
            roughness={0.68}
            emissive={emissive}
            emissiveIntensity={hover || selected ? 0.5 : 0.24}
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
        <cylinderGeometry args={[1.75, 1.95, 0.1, 8]} />
        <Mat color="#2a3038" metalness={0.7} roughness={0.42} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.45, 0.32, Math.sin(a) * 1.45]} rotation={[0, -a, 0]} castShadow>
            <boxGeometry args={[0.22, 0.46, 0.34]} />
            <Mat color="#39414a" metalness={0.72} roughness={0.32} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[0.95, 1.12, 0.22, 8]} />
        <Mat color="#232830" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.95, 8]} />
        <Mat color={hot} eInt={0.4} />
      </mesh>
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
      <mesh ref={a} position={[0, 1.05, 0]}>
        <torusGeometry args={[0.72, 0.035, 8, 40]} />
        <Mat color={color} eInt={1.35} />
      </mesh>
      <mesh ref={b} position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.028, 8, 28]} />
        <Mat color={color} eInt={1.05} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <circleGeometry args={[0.48, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh ref={beam} position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.05, 0.22, 2.6, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <Mat color={color} eInt={2} />
      </mesh>
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
        emissiveIntensity={0.02}
        roughness={0.9}
        metalness={0.08}
        transparent
        opacity={0.07}
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
        const kind = i % 3;
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
        const kind = i % 3;
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
                <mesh position={[0.118, 0.27, 0.05]}>
                  <sphereGeometry args={[0.036, 6, 6]} />
                  <Mat color="#7cf0c4" eInt={1.5} />
                </mesh>
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
