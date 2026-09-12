import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";

function Skin({
  color,
  metalness = 0.18,
  roughness = 0.48,
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

function Limb({
  pos,
  rot,
  size,
  color,
  metal = 0.22,
  rough = 0.42,
}: {
  pos: [number, number, number];
  rot?: [number, number, number];
  size: [number, number, number];
  color: string;
  metal?: number;
  rough?: number;
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow>
      <capsuleGeometry args={[size[0], size[1], 6, 10]} />
      <Skin color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

export function HeroModel({
  id,
  weapon = null,
  armor = null,
  scale = 1,
}: {
  id: HeroId;
  weapon?: ItemId | null;
  armor?: ItemId | null;
  scale?: number;
}) {
  const root = useRef<Group>(null);
  const accent = HEROES[id].accent;
  useFrame((s) => {
    const g = root.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.position.y = Math.sin(t * 1.6) * 0.012;
    g.rotation.y = Math.sin(t * 0.35) * 0.04;
  });

  const heavy = armor === "aegis-plate" || armor === "ghost-harness" || armor === "star-silk";
  const bigWep = weapon === "void-greatblade" || weapon === "rail-longarm" || weapon === "nova-crozier";

  return (
    <group ref={root} scale={scale}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.04, 12]} />
        <Skin color="#1a1e24" metalness={0.55} roughness={0.4} />
      </mesh>
      {id === "fighter" ? (
        <FighterBody accent={accent} heavy={heavy} great={bigWep} />
      ) : id === "ranger" ? (
        <RangerBody accent={accent} heavy={heavy} long={bigWep} />
      ) : (
        <MageBody accent={accent} heavy={heavy} crozier={bigWep} />
      )}
    </group>
  );
}

function Humanoid({
  skin,
  plate,
  cloth,
  helm,
  children,
}: {
  skin: string;
  plate: string;
  cloth: string;
  helm?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <group>
      <mesh position={[0, 1.56, 0.01]} castShadow>
        <sphereGeometry args={[0.112, 16, 14]} />
        <Skin color={skin} roughness={0.52} metalness={0.08} />
      </mesh>
      <mesh position={[0.038, 1.58, 0.09]} castShadow>
        <sphereGeometry args={[0.016, 8, 6]} />
        <Skin color="#0b1014" roughness={0.3} />
      </mesh>
      <mesh position={[-0.038, 1.58, 0.09]} castShadow>
        <sphereGeometry args={[0.016, 8, 6]} />
        <Skin color="#0b1014" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.43, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.055, 0.08, 8]} />
        <Skin color={skin} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.18, 0.02]} castShadow>
        <boxGeometry args={[0.34, 0.4, 0.2]} />
        <Skin color={plate} metalness={0.62} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.93, 0]} castShadow>
        <boxGeometry args={[0.3, 0.14, 0.18]} />
        <Skin color={cloth} metalness={0.28} roughness={0.5} />
      </mesh>
      <Limb pos={[0.22, 1.22, 0]} rot={[0.15, 0, -0.35]} size={[0.045, 0.26, 0]} color={plate} metal={0.55} />
      <Limb pos={[-0.22, 1.22, 0]} rot={[0.2, 0, 0.42]} size={[0.045, 0.26, 0]} color={plate} metal={0.55} />
      <Limb pos={[0.3, 0.96, 0.06]} rot={[0.55, 0, -0.15]} size={[0.038, 0.24, 0]} color={skin} metal={0.1} rough={0.55} />
      <Limb pos={[-0.28, 0.94, 0.08]} rot={[0.4, 0, 0.2]} size={[0.038, 0.24, 0]} color={skin} metal={0.1} rough={0.55} />
      <Limb pos={[0.09, 0.62, 0.01]} rot={[0.08, 0, 0.04]} size={[0.055, 0.32, 0]} color={cloth} metal={0.2} />
      <Limb pos={[-0.09, 0.62, 0.01]} rot={[0.1, 0, -0.04]} size={[0.055, 0.32, 0]} color={cloth} metal={0.2} />
      <Limb pos={[0.1, 0.28, 0.02]} rot={[0.05, 0, 0.02]} size={[0.045, 0.3, 0]} color={plate} metal={0.5} />
      <Limb pos={[-0.1, 0.28, 0.02]} rot={[0.06, 0, -0.02]} size={[0.045, 0.3, 0]} color={plate} metal={0.5} />
      <mesh position={[0.1, 0.06, 0.06]} castShadow>
        <boxGeometry args={[0.1, 0.05, 0.16]} />
        <Skin color="#161a20" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[-0.1, 0.06, 0.06]} castShadow>
        <boxGeometry args={[0.1, 0.05, 0.16]} />
        <Skin color="#161a20" metalness={0.7} roughness={0.28} />
      </mesh>
      {helm}
      {children}
    </group>
  );
}

function FighterBody({ accent, heavy, great }: { accent: string; heavy: boolean; great: boolean }) {
  return (
    <Humanoid
      skin="#d2b094"
      plate={heavy ? "#8a929c" : "#9aa4ae"}
      cloth="#4a525c"
      helm={
        <group>
          <mesh position={[0, 1.64, 0]} castShadow>
            <sphereGeometry args={[0.122, 14, 12]} />
            <Skin color={heavy ? "#7a8490" : "#b0b8c0"} metalness={0.82} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.56, 0.1]} castShadow>
            <boxGeometry args={[0.17, 0.045, 0.05]} />
            <Skin color={accent} metalness={0.55} roughness={0.16} eInt={1.1} />
          </mesh>
          <mesh position={[0, 1.5, 0.08]} scale={[1, 0.45, 0.7]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <Skin color="#1a1410" roughness={0.45} />
          </mesh>
        </group>
      }
    >
      <mesh position={[0, 1.22, 0.12]} castShadow>
        <boxGeometry args={[0.28, 0.22, 0.06]} />
        <Skin color={heavy ? "#6a727c" : "#c0c6cc"} metalness={0.78} roughness={0.22} />
      </mesh>
      {([-0.2, 0.2] as const).map((x) => (
        <mesh key={x} position={[x, 1.32, 0.02]} rotation={[0, 0, x > 0 ? -0.35 : 0.35]} castShadow>
          <boxGeometry args={[0.16, 0.16, 0.18]} />
          <Skin color={heavy ? "#707880" : "#b8c0c8"} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0.34, 0.82, 0.16]} rotation={[1.15, 0.2, 0.15]} castShadow>
        <boxGeometry args={[0.05, 0.08, great ? 0.72 : 0.52]} />
        <Skin color="#8a9098" metalness={0.82} roughness={0.18} />
      </mesh>
      <mesh position={[0.34, 0.74, great ? 0.58 : 0.46]} rotation={[1.15, 0.2, 0.15]}>
        <boxGeometry args={[0.018, 0.04, great ? 0.42 : 0.28]} />
        <Skin color={accent} metalness={0.4} roughness={0.16} eInt={1.4} />
      </mesh>
      <mesh position={[-0.32, 0.88, 0.14]} rotation={[0.2, 0, 0.3]} castShadow>
        <boxGeometry args={[0.18, 0.28, 0.04]} />
        <Skin color="#9aa4ae" metalness={0.8} roughness={0.2} />
      </mesh>
    </Humanoid>
  );
}

function RangerBody({ accent, heavy, long }: { accent: string; heavy: boolean; long: boolean }) {
  return (
    <Humanoid
      skin="#c4a07c"
      plate={heavy ? "#6a7a80" : "#7a8a90"}
      cloth="#4a5a58"
      helm={
        <group>
          <mesh position={[0, 1.6, 0.01]} castShadow>
            <sphereGeometry args={[0.118, 14, 12]} />
            <Skin color="#5a686c" metalness={0.55} roughness={0.34} />
          </mesh>
          <mesh position={[0, 1.585, 0.1]}>
            <boxGeometry args={[0.18, 0.035, 0.05]} />
            <Skin color={accent} metalness={0.65} roughness={0.16} eInt={0.9} />
          </mesh>
        </group>
      }
    >
      <mesh position={[0, 1.16, 0.12]} castShadow>
        <boxGeometry args={[0.22, 0.16, 0.05]} />
        <Skin color="#1e262a" metalness={0.45} roughness={0.4} />
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 1.05, 0.12]} castShadow>
          <boxGeometry args={[0.06, 0.08, 0.04]} />
          <Skin color="#1a2024" metalness={0.5} roughness={0.36} />
        </mesh>
      ))}
      <group position={[0.28, 1.02, 0.18]} rotation={[0.15, -0.35, 0.4]}>
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.08, long ? 0.62 : 0.44]} />
          <Skin color="#2a3238" metalness={0.7} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.02, long ? 0.28 : 0.2]}>
          <cylinderGeometry args={[0.016, 0.02, long ? 0.28 : 0.18, 8]} />
          <Skin color="#6a7278" metalness={0.8} roughness={0.18} />
        </mesh>
        <mesh position={[0, 0.04, -0.08]}>
          <boxGeometry args={[0.04, 0.05, 0.08]} />
          <Skin color={accent} metalness={0.5} roughness={0.2} eInt={0.7} />
        </mesh>
      </group>
    </Humanoid>
  );
}

function MageBody({ accent, heavy, crozier }: { accent: string; heavy: boolean; crozier: boolean }) {
  return (
    <Humanoid
      skin="#e0c8b0"
      plate={heavy ? "#6a6490" : "#7a74a0"}
      cloth={heavy ? "#5a5480" : "#6a6498"}
      helm={
        <group>
          <mesh position={[0, 1.64, -0.02]} rotation={[-0.2, 0, 0]} castShadow>
            <coneGeometry args={[0.18, 0.28, 8]} />
            <Skin color={heavy ? "#2a2448" : "#3a3460"} metalness={0.12} roughness={0.62} />
          </mesh>
          <mesh position={[0, 1.52, 0.06]} scale={[1, 0.55, 0.8]} castShadow>
            <sphereGeometry args={[0.16, 12, 10]} />
            <Skin color={heavy ? "#2e2850" : "#3e3870"} roughness={0.58} metalness={0.1} />
          </mesh>
        </group>
      }
    >
      <mesh position={[0, 0.72, -0.04]} rotation={[0.15, 0, 0]} castShadow>
        <coneGeometry args={[0.28, 0.7, 8]} />
            <Skin color={heavy ? "#4a4470" : "#5a5490"} metalness={0.08} roughness={0.68} />
      </mesh>
      <group position={[-0.28, 0.95, 0.16]} rotation={[0.2, 0.15, 0.35]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.018, 0.024, crozier ? 0.95 : 0.72, 8]} />
          <Skin color="#6a6280" metalness={0.45} roughness={0.32} />
        </mesh>
        <mesh position={[0, crozier ? 0.52 : 0.4, 0]} castShadow>
          <octahedronGeometry args={[crozier ? 0.1 : 0.075, 0]} />
          <Skin color={accent} metalness={0.2} roughness={0.12} eInt={1.6} />
        </mesh>
      </group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.22, 1.28, Math.sin(a) * 0.16]}>
            <octahedronGeometry args={[0.03, 0]} />
            <Skin color={accent} eInt={1.3} roughness={0.14} />
          </mesh>
        );
      })}
    </Humanoid>
  );
}
