import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, type Group, type Mesh } from "three";
import type { EnemyId, TowerId } from "@/game/types";
import { TOWERS } from "@/game/config";
import { cellToWorld } from "@/game/maps";

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
}: {
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  eInt?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={emissive ?? color}
      emissiveIntensity={eInt}
    />
  );
}

export function TowerModel({ type, level }: { type: TowerId; level: number }) {
  const def = TOWERS[type];
  const yaw = useRef<Group>(null);
  useFrame((_, dt) => {
    if (type === "tesla" && yaw.current) yaw.current.rotation.y += dt * 0.8;
  });

  if (type === "pulse") {
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.48, 0.55, 0.16, 6]} />
          <Mat color="#1c2228" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 0.28, 8]} />
          <Mat color="#2a323c" metalness={0.65} roughness={0.3} />
        </mesh>
        <group ref={yaw} position={[0, 0.52, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.22, 0.42]} />
            <Mat color="#3a4650" metalness={0.55} roughness={0.32} />
          </mesh>
          <mesh position={[0.14, 0.04, 0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.46, 8]} />
            <Mat color={def.color} metalness={0.4} roughness={0.25} eInt={0.5} />
          </mesh>
          <mesh position={[-0.14, 0.04, 0.28]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.46, 8]} />
            <Mat color={def.color} metalness={0.4} roughness={0.25} eInt={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <Mat color={def.color} eInt={1.4 + level * 0.3} />
          </mesh>
        </group>
      </group>
    );
  }

  if (type === "arc") {
    return (
      <group>
        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.38, 0.46, 0.16, 6]} />
          <Mat color="#1a2428" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.16, 1.2, 8]} />
          <Mat color="#2a3a40" metalness={0.55} roughness={0.28} />
        </mesh>
        <mesh position={[0, 1.38, 0]}>
          <octahedronGeometry args={[0.18, 0]} />
          <Mat color={def.color} eInt={1.6 + level * 0.25} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.025, 8, 24]} />
          <Mat color={def.color} eInt={0.8} />
        </mesh>
      </group>
    );
  }

  if (type === "frost") {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.52, 0.58, 0.18, 8]} />
          <Mat color="#1c242c" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.32, 0]} rotation={[-0.45, 0, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.18, 0.16, 16]} />
          <Mat color="#2a3a48" metalness={0.45} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.55, 0.12]} rotation={[0.9, 0, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.55, 10]} />
          <Mat color={def.color} metalness={0.3} roughness={0.25} eInt={0.55} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <Mat color={def.color} eInt={1.2} />
        </mesh>
      </group>
    );
  }

  if (type === "rail") {
    return (
      <group>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.16, 0.55]} />
          <Mat color="#222226" metalness={0.75} roughness={0.28} />
        </mesh>
        <group position={[0, 0.42, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.2, 1.15]} />
            <Mat color="#3a3a3c" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.08, 0.2]} castShadow>
            <boxGeometry args={[0.1, 0.08, 1.35]} />
            <Mat color={def.color} eInt={0.7} metalness={0.5} roughness={0.2} />
          </mesh>
          <mesh position={[0.22, 0.02, -0.28]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <Mat color={def.color} eInt={1.1} />
          </mesh>
          <mesh position={[-0.22, 0.02, -0.28]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <Mat color={def.color} eInt={1.1} />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.44, 0.18, 8]} />
        <Mat color="#1c2420" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.05, 10]} />
        <Mat color="#2a3834" metalness={0.5} roughness={0.3} />
      </mesh>
      <group ref={yaw} position={[0, 0.85, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.035, 8, 20]} />
          <Mat color={def.color} eInt={1.1} />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.03, 8, 18]} />
          <Mat color={def.color} eInt={1.3} />
        </mesh>
        <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.22, 0.028, 8, 18]} />
          <Mat color={def.color} eInt={0.9} />
        </mesh>
      </group>
      <mesh position={[0, 1.28, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <Mat color={def.color} eInt={1.8} />
      </mesh>
    </group>
  );
}

export function EnemyModel({ type }: { type: EnemyId }) {
  const legs = useRef<Group>(null);
  useFrame((state) => {
    if (!legs.current) return;
    const t = state.clock.elapsedTime;
    legs.current.children.forEach((c, i) => {
      c.rotation.x = Math.sin(t * 8 + i) * 0.45;
    });
  });

  if (type === "mite" || type === "brood" || type === "husk" || type === "titan") {
    const scale = type === "mite" ? 0.9 : type === "brood" ? 1.15 : type === "husk" ? 1.4 : 1.85;
    const color = type === "titan" ? "#4aaa78" : "#3d8f62";
    const belly = type === "titan" ? "#8af0c4" : "#6ad4a0";
    return (
      <group scale={scale}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <sphereGeometry args={[0.32, 12, 10]} />
          <Mat color={color} roughness={0.55} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.22, 0.28]} castShadow>
          <sphereGeometry args={[0.18, 10, 8]} />
          <Mat color={color} roughness={0.5} metalness={0.08} />
        </mesh>
        <mesh position={[0.07, 0.28, 0.4]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <Mat color={belly} eInt={2.1} />
        </mesh>
        <mesh position={[-0.07, 0.28, 0.4]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <Mat color={belly} eInt={2.1} />
        </mesh>
        <mesh position={[0, 0.32, 0]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <Mat color={belly} eInt={1.15} />
        </mesh>
        <group ref={legs}>
          {([-1, 1] as const).flatMap((s, i) =>
            [0.15, -0.1, -0.28].map((z, j) => (
              <mesh key={`${i}${j}`} position={[0.22 * s, 0.08, z]} rotation={[0.4, 0, 0.7 * s]}>
                <boxGeometry args={[0.05, 0.28, 0.05]} />
                <Mat color="#1c3a2c" roughness={0.6} />
              </mesh>
            )),
          )}
        </group>
        {type === "husk" || type === "titan" ? (
          <mesh position={[0, 0.48, -0.05]} castShadow>
            <boxGeometry args={[0.42, 0.12, 0.4]} />
            <Mat color="#245844" metalness={0.2} roughness={0.45} />
          </mesh>
        ) : null}
      </group>
    );
  }

  if (type === "spore") {
    return (
      <HoverFloat>
        <mesh>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial
            color="#4aaa88"
            emissive="#2a8a68"
            emissiveIntensity={0.7}
            roughness={0.3}
            transparent
            opacity={0.88}
          />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#3dcaa0" transparent opacity={0.12} emissive="#3dcaa0" emissiveIntensity={0.3} />
        </mesh>
      </HoverFloat>
    );
  }

  if (type === "drone" || type === "walker" || type === "siege" || type === "dread") {
    const color = "#6a7078";
    const accent = "#c46a3a";
    if (type === "drone") {
      return (
        <HoverFloat amp={0.06}>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.1, 6]} />
            <Mat color={color} metalness={0.75} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.16, 0.08, 0.16]} />
            <Mat color={accent} eInt={1.1} />
          </mesh>
          {([-0.3, 0.3] as const).map((x) => (
            <group key={x} position={[x, 0.06, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
                <Mat color="#2a2e32" metalness={0.6} roughness={0.35} />
              </mesh>
              <Rotor position={[0, 0.04, 0]} width={0.42} />
            </group>
          ))}
        </HoverFloat>
      );
    }
    const big = type === "dread" ? 1.55 : type === "siege" ? 1.2 : 1;
    return (
      <group scale={big}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.42, 0.38, 0.32]} />
          <Mat color={color} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.78, 0.08]} castShadow>
          <boxGeometry args={[0.22, 0.16, 0.22]} />
          <Mat color="#4a5058" metalness={0.65} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.78, 0.22]}>
          <boxGeometry args={[0.08, 0.06, 0.12]} />
          <Mat color={accent} eInt={1} />
        </mesh>
        <mesh position={[0.12, 0.22, 0]} castShadow>
          <boxGeometry args={[0.12, 0.44, 0.14]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.32} />
        </mesh>
        <mesh position={[-0.12, 0.22, 0]} castShadow>
          <boxGeometry args={[0.12, 0.44, 0.14]} />
          <Mat color="#3a4048" metalness={0.7} roughness={0.32} />
        </mesh>
        {type !== "walker" ? (
          <mesh position={[0, 0.4, -0.22]} castShadow>
            <boxGeometry args={[0.5, 0.18, 0.22]} />
            <Mat color="#2a2e34" metalness={0.75} roughness={0.28} />
          </mesh>
        ) : null}
      </group>
    );
  }

  if (type === "gunship") {
    return (
      <HoverFloat amp={0.05}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.1, 0.78]} />
          <Mat color="#5a6068" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[0.3, 0, 0]} rotation={[0, 0, 0.2]} castShadow>
          <boxGeometry args={[0.46, 0.04, 0.2]} />
          <Mat color="#3a4048" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[-0.3, 0, 0]} rotation={[0, 0, -0.2]} castShadow>
          <boxGeometry args={[0.46, 0.04, 0.2]} />
          <Mat color="#3a4048" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.02, 0.24]}>
          <boxGeometry args={[0.08, 0.06, 0.16]} />
          <Mat color="#c46a3a" eInt={1.2} />
        </mesh>
        <Rotor position={[0.28, 0.08, 0]} width={0.38} />
        <Rotor position={[-0.28, 0.08, 0]} width={0.38} />
      </HoverFloat>
    );
  }

  if (type === "wraith") {
    return (
      <HoverFloat amp={0.1}>
        <mesh>
          <coneGeometry args={[0.18, 0.7, 6]} />
          <meshStandardMaterial
            color="#6aa0a8"
            emissive="#4a8890"
            emissiveIntensity={0.55}
            transparent
            opacity={0.85}
            roughness={0.25}
          />
        </mesh>
      </HoverFloat>
    );
  }

  if (type === "overlord") {
    return (
      <group scale={1.6}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.38, 12, 10]} />
          <Mat color="#3a5a52" roughness={0.4} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.55, 0.1]} castShadow>
          <boxGeometry args={[0.55, 0.18, 0.4]} />
          <Mat color="#5a686c" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Mat color="#8ec8d0" eInt={1.9} />
        </mesh>
        <mesh position={[0.22, 0.2, 0.1]} castShadow>
          <boxGeometry args={[0.14, 0.4, 0.14]} />
          <Mat color="#4a5858" metalness={0.55} />
        </mesh>
        <mesh position={[-0.22, 0.2, 0.1]} castShadow>
          <boxGeometry args={[0.14, 0.4, 0.14]} />
          <Mat color="#2a4a3c" roughness={0.5} />
        </mesh>
      </group>
    );
  }

  // chimera
  return (
    <group>
      <mesh position={[0, 0.32, 0]} castShadow>
        <sphereGeometry args={[0.28, 12, 10]} />
        <Mat color="#3a5a4c" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0.18, 0.38, 0.12]} castShadow>
        <boxGeometry args={[0.22, 0.16, 0.22]} />
        <Mat color="#5a686c" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <Mat color="#8ec8d0" eInt={1} />
      </mesh>
      <group ref={legs}>
        {([-1, 1] as const).map((s, i) => (
          <mesh key={i} position={[0.18 * s, 0.1, 0.1]} rotation={[0.3, 0, 0.5 * s]}>
            <boxGeometry args={[0.06, 0.28, 0.06]} />
            <Mat color="#2a3a38" />
          </mesh>
        ))}
      </group>
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
  const glow = selected ? 0.55 : hover ? 0.38 : occupied ? 0.1 : 0.2;
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.56, 0.62, 0.14, 6]} />
        <meshStandardMaterial
          color={color}
          metalness={0.5}
          roughness={0.38}
          emissive={emissive}
          emissiveIntensity={glow}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.145, 0]}>
        <ringGeometry args={[0.46, 0.56, 6]} />
        <meshStandardMaterial
          color={emissive}
          emissive={emissive}
          emissiveIntensity={hover || selected ? 0.85 : 0.28}
          transparent
          opacity={0.9}
        />
      </mesh>
      {hover || selected ? (
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.018, 0.04, 1.7, 6]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.42} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function NexusCore({ color, health }: { color: string; health: number }) {
  const ref = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  const shield = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const ring2 = useRef<Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.35;
      ref.current.rotation.x = Math.sin(t * 0.4) * 0.12;
    }
    if (inner.current) inner.current.rotation.y = -t * 0.55;
    if (shield.current) {
      const m = shield.current.material as { opacity: number; emissiveIntensity?: number };
      m.opacity = 0.08 + health * 0.22 + Math.sin(t * 2) * 0.04;
      shield.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03);
    }
    if (ring.current) ring.current.rotation.z = t * 0.55;
    if (ring2.current) ring2.current.rotation.z = -t * 0.32;
  });
  const hot = health < 0.35 ? "#c45c5c" : color;
  return (
    <group>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.95, 1.12, 0.22, 8]} />
        <Mat color="#14161a" metalness={0.78} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.95, 8]} />
        <Mat color={hot} eInt={0.55} />
      </mesh>
      <mesh ref={ring} position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.92, 0.028, 8, 48]} />
        <Mat color={hot} eInt={1.25} />
      </mesh>
      <mesh ref={ring2} position={[0, 1.05, 0]} rotation={[Math.PI / 2.5, 0.4, 0]}>
        <torusGeometry args={[0.7, 0.016, 8, 36]} />
        <Mat color={hot} eInt={0.85} />
      </mesh>
      <mesh ref={ref} position={[0, 1.12, 0]} castShadow>
        <octahedronGeometry args={[0.52, 0]} />
        <Mat color={hot} eInt={1.6 + health * 0.6} roughness={0.14} metalness={0.28} />
      </mesh>
      <mesh ref={inner} position={[0, 1.12, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <Mat color="#f2f6f8" eInt={2.4} roughness={0.08} />
      </mesh>
      <mesh ref={shield} position={[0, 1.08, 0]}>
        <sphereGeometry args={[1.22, 32, 20]} />
        <meshStandardMaterial
          color={hot}
          emissive={hot}
          emissiveIntensity={0.5}
          transparent
          opacity={0.2}
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

export function RangeRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} renderOrder={2}>
      <ringGeometry args={[Math.max(0.2, radius - 0.1), radius, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.32} depthWrite={false} toneMapped={false} />
    </mesh>
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
  }, [cols, rows, skip]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <ringGeometry args={[0.74, 0.84, 6]} />
      <meshStandardMaterial
        color={color}
        emissive={accent}
        emissiveIntensity={0.06}
        roughness={0.9}
        metalness={0.08}
        transparent
        opacity={0.34}
      />
    </instancedMesh>
  );
}

export function DecorOrganic({ seed }: { seed: number }) {
  const items = useMemo(() => scatter(seed, 34), [seed]);
  return (
    <group>
      {items.map((p, i) =>
        i % 3 === 0 ? (
          <group key={i} position={p}>
            <mesh castShadow>
              <coneGeometry args={[0.2 + (i % 5) * 0.045, 0.85 + (i % 4) * 0.2, 6]} />
              <Mat color={i % 2 ? "#1a3a2c" : "#245040"} roughness={0.6} eInt={0.22} emissive="#1f8a62" />
            </mesh>
            <mesh position={[0, 0.55 + (i % 4) * 0.08, 0]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <Mat color="#3dcaa0" eInt={1.2} />
            </mesh>
          </group>
        ) : (
          <mesh key={i} position={p} castShadow>
            <icosahedronGeometry args={[0.18 + (i % 4) * 0.05, 0]} />
            <Mat color="#2a6a52" eInt={0.45} emissive="#3dcaa0" roughness={0.35} />
          </mesh>
        ),
      )}
    </group>
  );
}

export function DecorMech({ seed }: { seed: number }) {
  const items = useMemo(() => scatter(seed, 26), [seed]);
  return (
    <group>
      {items.map((p, i) => (
        <group key={i} position={p}>
          {i % 2 === 0 ? (
            <>
              <mesh castShadow>
                <boxGeometry args={[0.22, 0.85 + (i % 3) * 0.28, 0.22]} />
                <Mat color="#2a2e32" metalness={0.72} roughness={0.28} />
              </mesh>
              <mesh position={[0, 0.55 + (i % 3) * 0.12, 0.12]}>
                <boxGeometry args={[0.08, 0.08, 0.04]} />
                <Mat color="#c46a3a" eInt={0.9} />
              </mesh>
            </>
          ) : (
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0.2, 0.35, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.07, 0.95, 8]} />
              <Mat color="#3a322c" metalness={0.65} roughness={0.32} emissive="#c45a28" eInt={0.28} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

export function DecorHybrid({ seed }: { seed: number }) {
  return (
    <group>
      <DecorOrganic seed={seed} />
      <DecorMech seed={seed + 9} />
    </group>
  );
}

function scatter(seed: number, n: number): Vec[] {
  const out: Vec[] = [];
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = 11 + rand() * 9;
    out.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
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
