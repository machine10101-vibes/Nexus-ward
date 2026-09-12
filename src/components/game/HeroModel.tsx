import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group } from "three";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";

function Skin({
  color,
  metalness = 0.16,
  roughness = 0.5,
  emissive,
  eInt = 0,
  side,
}: {
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  eInt?: number;
  side?: typeof DoubleSide | undefined;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={emissive ?? color}
      emissiveIntensity={eInt}
      side={side}
    />
  );
}

function Cap({
  pos,
  rot,
  r,
  h,
  color,
  metal = 0.2,
  rough = 0.44,
  segs = 12,
}: {
  pos: [number, number, number];
  rot?: [number, number, number];
  r: number;
  h: number;
  color: string;
  metal?: number;
  rough?: number;
  segs?: number;
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow>
      <capsuleGeometry args={[r, h, 6, segs]} />
      <Skin color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

function Ball({
  pos,
  r,
  color,
  metal = 0.12,
  rough = 0.5,
  eInt = 0,
  segs = 16,
  scale,
}: {
  pos: [number, number, number];
  r: number;
  color: string;
  metal?: number;
  rough?: number;
  eInt?: number;
  segs?: number;
  scale?: [number, number, number];
}) {
  return (
    <mesh position={pos} scale={scale} castShadow>
      <sphereGeometry args={[r, segs, segs]} />
      <Skin color={color} metalness={metal} roughness={rough} eInt={eInt} />
    </mesh>
  );
}

function Plate({
  pos,
  rot,
  size,
  color,
  metal = 0.72,
  rough = 0.24,
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
      <boxGeometry args={size} />
      <Skin color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

function Face({ skin, shade }: { skin: string; shade: string }) {
  return (
    <group position={[0, 1.62, 0]}>
      <Ball pos={[0, 0.02, 0.01]} r={0.108} color={skin} metal={0.06} rough={0.58} segs={20} />
      <mesh position={[0, -0.055, 0.02]} scale={[0.92, 0.72, 0.88]} castShadow>
        <sphereGeometry args={[0.09, 16, 12]} />
        <Skin color={skin} metalness={0.05} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.01, 0.092]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.022, 0.03, 0.028]} />
        <Skin color={shade} metalness={0.08} roughness={0.52} />
      </mesh>
      <Ball pos={[0.036, 0.018, 0.086]} r={0.016} color="#1a1410" metal={0.05} rough={0.35} segs={10} />
      <Ball pos={[-0.036, 0.018, 0.086]} r={0.016} color="#1a1410" metal={0.05} rough={0.35} segs={10} />
      <Ball pos={[0.036, 0.02, 0.098]} r={0.007} color="#c8dce8" metal={0.4} rough={0.18} eInt={0.35} segs={8} />
      <Ball pos={[-0.036, 0.02, 0.098]} r={0.007} color="#c8dce8" metal={0.4} rough={0.18} eInt={0.35} segs={8} />
      <mesh position={[0, -0.042, 0.09]} castShadow>
        <boxGeometry args={[0.038, 0.008, 0.012]} />
        <Skin color="#6a4038" roughness={0.55} metalness={0.04} />
      </mesh>
      <mesh position={[0.096, 0.0, 0.01]} rotation={[0, 0, 0.2]} scale={[0.35, 1, 0.7]} castShadow>
        <sphereGeometry args={[0.03, 10, 8]} />
        <Skin color={skin} roughness={0.62} metalness={0.05} />
      </mesh>
      <mesh position={[-0.096, 0.0, 0.01]} rotation={[0, 0, -0.2]} scale={[0.35, 1, 0.7]} castShadow>
        <sphereGeometry args={[0.03, 10, 8]} />
        <Skin color={skin} roughness={0.62} metalness={0.05} />
      </mesh>
    </group>
  );
}

function Hand({
  pos,
  rot,
  skin,
  gauntlet,
}: {
  pos: [number, number, number];
  rot?: [number, number, number];
  skin: string;
  gauntlet?: string;
}) {
  const hide = gauntlet ?? skin;
  return (
    <group position={pos} rotation={rot}>
      <mesh castShadow>
        <boxGeometry args={[0.062, 0.04, 0.08]} />
        <Skin color={hide} metalness={gauntlet ? 0.7 : 0.08} roughness={gauntlet ? 0.28 : 0.55} />
      </mesh>
      {[0.018, -0.002, -0.022].map((x, i) => (
        <mesh key={i} position={[x, -0.008, 0.052]} rotation={[0.4, 0, 0]} castShadow>
          <capsuleGeometry args={[0.008, 0.036, 3, 6]} />
          <Skin color={hide} metalness={gauntlet ? 0.65 : 0.08} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[-0.03, 0.006, 0.02]} rotation={[0.2, -0.6, 0.4]} castShadow>
        <capsuleGeometry args={[0.009, 0.03, 3, 6]} />
        <Skin color={hide} metalness={gauntlet ? 0.65 : 0.08} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Humanoid({
  skin,
  shade,
  plate,
  cloth,
  bulk = 1,
  face,
  helm,
  children,
}: {
  skin: string;
  shade: string;
  plate: string;
  cloth: string;
  bulk?: number;
  face?: boolean;
  helm?: ReactNode;
  children?: ReactNode;
}) {
  const b = bulk;
  return (
    <group>
      {face ? <Face skin={skin} shade={shade} /> : <Ball pos={[0, 1.64, 0.01]} r={0.11} color={skin} metal={0.06} rough={0.58} segs={18} />}
      <Cap pos={[0, 1.5, 0]} r={0.038 * b} h={0.07} color={skin} metal={0.06} rough={0.58} />
      <mesh position={[0, 1.28, 0.02]} scale={[1.05 * b, 0.92, 0.72]} castShadow>
        <sphereGeometry args={[0.2, 18, 16]} />
        <Skin color={plate} metalness={0.58} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.06, 0.01]} scale={[0.88 * b, 0.7, 0.62]} castShadow>
        <sphereGeometry args={[0.16, 16, 14]} />
        <Skin color={cloth} metalness={0.22} roughness={0.52} />
      </mesh>
      <mesh position={[0, 0.92, 0]} scale={[1 * b, 0.42, 0.7]} castShadow>
        <sphereGeometry args={[0.15, 14, 12]} />
        <Skin color={cloth} metalness={0.18} roughness={0.55} />
      </mesh>
      <Ball pos={[0.2 * b, 1.4, 0]} r={0.062 * b} color={plate} metal={0.62} rough={0.28} />
      <Ball pos={[-0.2 * b, 1.4, 0]} r={0.062 * b} color={plate} metal={0.62} rough={0.28} />
      <Cap pos={[0.28 * b, 1.2, 0.02]} rot={[0.18, 0, -0.42]} r={0.046 * b} h={0.22} color={plate} metal={0.55} />
      <Cap pos={[-0.28 * b, 1.2, 0.02]} rot={[0.22, 0, 0.48]} r={0.046 * b} h={0.22} color={plate} metal={0.55} />
      <Cap pos={[0.36 * b, 0.96, 0.1]} rot={[0.62, 0.05, -0.12]} r={0.038} h={0.2} color={skin} metal={0.08} rough={0.56} />
      <Cap pos={[-0.34 * b, 0.95, 0.12]} rot={[0.48, -0.08, 0.18]} r={0.038} h={0.2} color={skin} metal={0.08} rough={0.56} />
      <Cap pos={[0.09 * b, 0.66, 0.01]} rot={[0.06, 0, 0.04]} r={0.058 * b} h={0.28} color={cloth} metal={0.16} />
      <Cap pos={[-0.09 * b, 0.66, 0.01]} rot={[0.08, 0, -0.04]} r={0.058 * b} h={0.28} color={cloth} metal={0.16} />
      <Ball pos={[0.09 * b, 0.5, 0.02]} r={0.048 * b} color={plate} metal={0.5} rough={0.34} segs={10} />
      <Ball pos={[-0.09 * b, 0.5, 0.02]} r={0.048 * b} color={plate} metal={0.5} rough={0.34} segs={10} />
      <Cap pos={[0.1 * b, 0.28, 0.03]} rot={[0.04, 0, 0.02]} r={0.044} h={0.26} color={plate} metal={0.48} />
      <Cap pos={[-0.1 * b, 0.28, 0.03]} rot={[0.05, 0, -0.02]} r={0.044} h={0.26} color={plate} metal={0.48} />
      {helm}
      {children}
    </group>
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
    g.position.y = Math.sin(t * 1.55) * 0.01;
    g.rotation.y = Math.sin(t * 0.32) * 0.05;
  });

  const heavy = armor === "aegis-plate" || armor === "ghost-harness" || armor === "star-silk";
  const bigWep = weapon === "void-greatblade" || weapon === "rail-longarm" || weapon === "nova-crozier";

  return (
    <group ref={root} scale={scale}>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.03, 16]} />
        <Skin color="#14181e" metalness={0.6} roughness={0.38} />
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

function FighterBody({ accent, heavy, great }: { accent: string; heavy: boolean; great: boolean }) {
  const steel = heavy ? "#8a929c" : "#c8d0d8";
  const bright = heavy ? "#b0b8c0" : "#e8eef4";
  const dark = heavy ? "#3a424a" : "#4a5460";
  return (
    <Humanoid
      skin="#d4b094"
      shade="#b89074"
      plate={steel}
      cloth={dark}
      bulk={heavy ? 1.16 : 1.1}
      helm={
        <group>
          <mesh position={[0, 1.67, 0]} castShadow>
            <sphereGeometry args={[0.132, 20, 16]} />
            <Skin color={bright} metalness={0.88} roughness={0.14} />
          </mesh>
          <mesh position={[0, 1.72, -0.01]} scale={[1.02, 0.5, 1]} castShadow>
            <sphereGeometry args={[0.13, 16, 12]} />
            <Skin color={steel} metalness={0.86} roughness={0.16} />
          </mesh>
          <mesh position={[0, 1.57, 0.1]} rotation={[0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.2, 0.055, 0.06]} />
            <Skin color={accent} metalness={0.55} roughness={0.12} eInt={1.6} />
          </mesh>
          <mesh position={[0, 1.57, 0.132]}>
            <boxGeometry args={[0.16, 0.02, 0.016]} />
            <Skin color="#fff6c4" metalness={0.25} roughness={0.08} eInt={2.1} />
          </mesh>
          <mesh position={[0.08, 1.54, 0.07]} rotation={[0.2, 0.55, 0]} scale={[0.55, 1, 0.7]} castShadow>
            <sphereGeometry args={[0.08, 12, 10]} />
            <Skin color={steel} metalness={0.84} roughness={0.18} />
          </mesh>
          <mesh position={[-0.08, 1.54, 0.07]} rotation={[0.2, -0.55, 0]} scale={[0.55, 1, 0.7]} castShadow>
            <sphereGeometry args={[0.08, 12, 10]} />
            <Skin color={steel} metalness={0.84} roughness={0.18} />
          </mesh>
          <mesh position={[0, 1.8, -0.01]} rotation={[0.2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.03, 0.1, 8]} />
            <Skin color={accent} metalness={0.6} roughness={0.18} eInt={0.7} />
          </mesh>
        </group>
      }
    >
      <mesh position={[0, 1.3, 0.1]} scale={[1.15, 0.85, 0.55]} castShadow>
        <sphereGeometry args={[0.16, 16, 14]} />
        <Skin color={bright} metalness={0.86} roughness={0.14} />
      </mesh>
      <mesh position={[0, 1.16, 0.08]} scale={[0.95, 0.45, 0.5]} castShadow>
        <sphereGeometry args={[0.14, 14, 12]} />
        <Skin color={dark} metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.28, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.012, 10, 18]} />
        <Skin color={accent} metalness={0.55} roughness={0.16} eInt={0.85} />
      </mesh>
      {([-0.24, 0.24] as const).map((x) => (
        <mesh key={x} position={[x, 1.42, 0.02]} scale={[1.15, 0.85, 1]} castShadow>
          <sphereGeometry args={[0.11, 14, 12]} />
          <Skin color={bright} metalness={0.86} roughness={0.14} />
        </mesh>
      ))}
      <mesh position={[0.12, 0.7, 0.07]} scale={[0.7, 1.2, 0.65]} castShadow>
        <sphereGeometry args={[0.09, 12, 10]} />
        <Skin color={steel} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.12, 0.7, 0.07]} scale={[0.7, 1.2, 0.65]} castShadow>
        <sphereGeometry args={[0.09, 12, 10]} />
        <Skin color={steel} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.11, 0.28, 0.06]} scale={[0.7, 1.35, 0.7]} castShadow>
        <sphereGeometry args={[0.08, 12, 10]} />
        <Skin color={bright} metalness={0.82} roughness={0.16} />
      </mesh>
      <mesh position={[-0.11, 0.28, 0.06]} scale={[0.7, 1.35, 0.7]} castShadow>
        <sphereGeometry args={[0.08, 12, 10]} />
        <Skin color={bright} metalness={0.82} roughness={0.16} />
      </mesh>
      <Hand pos={[0.42, 0.8, 0.22]} rot={[0.35, 0.15, -0.15]} skin="#d4b094" gauntlet={bright} />
      <Hand pos={[-0.4, 0.86, 0.2]} rot={[0.15, -0.2, 0.2]} skin="#d4b094" gauntlet={bright} />
      <group position={[0.5, 0.86, 0.18]} rotation={[0.15, -0.85, 1.15]}>
        <mesh position={[0, -0.08, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.022, 0.16, 10]} />
          <Skin color="#3a2e24" metalness={0.3} roughness={0.48} />
        </mesh>
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[0.12, 0.03, 0.04]} />
          <Skin color={bright} metalness={0.88} roughness={0.12} />
        </mesh>
        <mesh position={[0, great ? 0.42 : 0.34, 0]} castShadow>
          <boxGeometry args={[0.07, great ? 0.72 : 0.56, 0.014]} />
          <Skin color="#dce4ec" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.0, great ? 0.42 : 0.34, 0.009]}>
          <boxGeometry args={[0.018, great ? 0.66 : 0.5, 0.006]} />
          <Skin color={accent} metalness={0.4} roughness={0.1} eInt={1.8} />
        </mesh>
        <mesh position={[0, great ? 0.8 : 0.64, 0]}>
          <coneGeometry args={[0.028, 0.07, 8]} />
          <Skin color="#eef4f8" metalness={0.92} roughness={0.08} />
        </mesh>
      </group>
      <group position={[-0.46, 0.92, 0.12]} rotation={[0.15, 0.85, 0.1]}>
        <mesh scale={[1, 1.25, 0.18]} castShadow>
          <sphereGeometry args={[0.16, 16, 14]} />
          <Skin color={bright} metalness={0.88} roughness={0.14} />
        </mesh>
        <mesh position={[0, 0, 0.03]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.055, 0.012, 10, 16]} />
          <Skin color={accent} metalness={0.5} roughness={0.16} eInt={0.9} />
        </mesh>
      </group>
      <mesh position={[0.12, 0.05, 0.08]} scale={[1, 0.45, 1.4]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Skin color="#1a1e24" metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[-0.12, 0.05, 0.08]} scale={[1, 0.45, 1.4]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Skin color="#1a1e24" metalness={0.72} roughness={0.28} />
      </mesh>
    </Humanoid>
  );
}

function RangerBody({ accent, heavy, long }: { accent: string; heavy: boolean; long: boolean }) {
  const kit = heavy ? "#5a6a70" : "#6e8086";
  const weave = heavy ? "#3a484c" : "#4a5c58";
  const strap = "#1c2428";
  return (
    <Humanoid
      skin="#c8a07c"
      shade="#a88060"
      plate={kit}
      cloth={weave}
      bulk={heavy ? 0.98 : 0.94}
      face
      helm={
        <group>
          <mesh position={[0, 1.68, -0.01]} scale={[1.05, 0.72, 1.05]} castShadow>
            <sphereGeometry args={[0.12, 16, 14]} />
            <Skin color="#3a484c" metalness={0.48} roughness={0.36} />
          </mesh>
          <mesh position={[0, 1.62, 0.1]} castShadow>
            <boxGeometry args={[0.2, 0.038, 0.055]} />
            <Skin color={accent} metalness={0.7} roughness={0.14} eInt={1.05} />
          </mesh>
          <mesh position={[0, 1.62, 0.128]}>
            <boxGeometry args={[0.16, 0.014, 0.01]} />
            <Skin color="#e8f4f8" metalness={0.3} roughness={0.1} eInt={0.9} />
          </mesh>
          <Cap pos={[0, 1.76, -0.02]} r={0.04} h={0.02} color="#2a3438" metal={0.4} rough={0.4} />
        </group>
      }
    >
      <Plate pos={[0, 1.26, 0.12]} size={[0.2, 0.16, 0.05]} color={strap} metal={0.4} rough={0.42} />
      <Plate pos={[0.0, 1.14, 0.11]} rot={[0, 0, 0.55]} size={[0.22, 0.028, 0.03]} color={strap} metal={0.35} rough={0.48} />
      <Plate pos={[0.0, 1.14, 0.11]} rot={[0, 0, -0.55]} size={[0.22, 0.028, 0.03]} color={strap} metal={0.35} rough={0.48} />
      {[-0.06, 0.06].map((x) => (
        <Plate key={x} pos={[x, 1.04, 0.12]} size={[0.055, 0.07, 0.04]} color="#161c20" metal={0.55} />
      ))}
      {heavy
        ? [-0.1, 0.1].map((x) => (
            <Plate key={`c${x}`} pos={[x, 1.2, 0.13]} size={[0.05, 0.05, 0.03]} color={accent} metal={0.5} rough={0.2} />
          ))
        : null}
      <Plate pos={[0.2, 1.38, 0.04]} rot={[0.1, 0, -0.3]} size={[0.1, 0.08, 0.08]} color={kit} metal={0.55} />
      <Plate pos={[-0.2, 1.38, 0.04]} rot={[0.1, 0, 0.3]} size={[0.1, 0.08, 0.08]} color={kit} metal={0.55} />
      <Hand pos={[0.38, 0.86, 0.2]} rot={[0.15, -0.4, -0.15]} skin="#c8a07c" />
      <Hand pos={[-0.22, 1.0, 0.18]} rot={[0.35, 0.5, 0.2]} skin="#c8a07c" />
      <group position={[0.12, 1.02, 0.22]} rotation={[0.05, -0.55, 0.12]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.085, long ? 0.64 : 0.48]} />
          <Skin color="#1e262c" metalness={0.72} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.01, long ? 0.34 : 0.24]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.018, long ? 0.32 : 0.2, 10]} />
          <Skin color="#6a747c" metalness={0.86} roughness={0.16} />
        </mesh>
        <mesh position={[0, -0.05, -0.02]} castShadow>
          <boxGeometry args={[0.03, 0.07, 0.08]} />
          <Skin color="#14181c" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.055, 0.04]} castShadow>
          <boxGeometry args={[0.03, 0.04, 0.08]} />
          <Skin color={accent} metalness={0.55} roughness={0.16} eInt={0.8} />
        </mesh>
        <mesh position={[0, 0, long ? -0.26 : -0.2]} castShadow>
          <boxGeometry args={[0.04, 0.06, 0.12]} />
          <Skin color="#2a3238" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0.0, 0.0, long ? 0.48 : 0.34]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <Skin color={accent} eInt={1.4} roughness={0.12} />
        </mesh>
      </group>
      <Plate pos={[0.1, 0.055, 0.07]} size={[0.1, 0.045, 0.18]} color="#161a1e" metal={0.55} />
      <Plate pos={[-0.1, 0.055, 0.07]} size={[0.1, 0.045, 0.18]} color="#161a1e" metal={0.55} />
    </Humanoid>
  );
}

function MageBody({ accent, heavy, crozier }: { accent: string; heavy: boolean; crozier: boolean }) {
  const veil = heavy ? "#3e3870" : "#5a5498";
  const deep = heavy ? "#2a2448" : "#3a3468";
  const lining = heavy ? "#8a7cc8" : "#7a72b0";
  return (
    <Humanoid
      skin="#e6ccb4"
      shade="#c8a890"
      plate={lining}
      cloth={veil}
      bulk={0.9}
      face
      helm={
        <group>
          <mesh position={[0, 1.72, -0.04]} rotation={[-0.35, 0, 0]} castShadow>
            <coneGeometry args={[0.2, 0.34, 12]} />
            <Skin color={deep} metalness={0.08} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.58, 0.04]} scale={[1.15, 0.7, 1.05]} castShadow>
            <sphereGeometry args={[0.16, 16, 12]} />
            <Skin color={veil} metalness={0.1} roughness={0.66} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.5, 0.1]} rotation={[0.4, 0, 0]} scale={[1.05, 0.35, 0.7]} castShadow>
            <sphereGeometry args={[0.14, 12, 10]} />
            <Skin color={deep} metalness={0.08} roughness={0.68} />
          </mesh>
        </group>
      }
    >
      <mesh position={[0, 0.72, -0.02]} rotation={[0.12, 0, 0]} castShadow>
        <coneGeometry args={[0.32, 0.85, 12]} />
        <Skin color={veil} metalness={0.06} roughness={0.72} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.62, -0.01]} rotation={[0.18, 0, 0]} castShadow>
        <coneGeometry args={[0.26, 0.7, 12]} />
        <Skin color={deep} metalness={0.05} roughness={0.74} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 1.22, 0.08]} scale={[1.15, 0.45, 0.7]} castShadow>
        <sphereGeometry args={[0.2, 14, 10]} />
        <Skin color={lining} metalness={0.14} roughness={0.58} />
      </mesh>
      {([-0.22, 0.22] as const).map((x) => (
        <mesh key={x} position={[x, 1.05, 0.04]} rotation={[0.3, 0, x > 0 ? -0.5 : 0.5]} castShadow>
          <capsuleGeometry args={[0.07, 0.32, 5, 10]} />
          <Skin color={veil} metalness={0.08} roughness={0.68} />
        </mesh>
      ))}
      <Hand pos={[0.34, 0.9, 0.16]} rot={[0.25, 0.1, -0.2]} skin="#e6ccb4" />
      <Hand pos={[-0.32, 0.92, 0.18]} rot={[0.15, -0.1, 0.25]} skin="#e6ccb4" />
      <group position={[-0.3, 0.55, 0.16]} rotation={[0.12, 0.08, 0.18]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.016, 0.022, crozier ? 1.15 : 0.92, 10]} />
          <Skin color="#6a6288" metalness={0.42} roughness={0.34} />
        </mesh>
        <mesh position={[0, crozier ? -0.2 : -0.16, 0]}>
          <torusGeometry args={[0.03, 0.008, 8, 14]} />
          <Skin color={accent} metalness={0.35} roughness={0.2} eInt={0.6} />
        </mesh>
        <mesh position={[0, crozier ? 0.58 : 0.46, 0]} castShadow>
          <octahedronGeometry args={[crozier ? 0.11 : 0.085, 0]} />
          <Skin color={accent} metalness={0.18} roughness={0.1} eInt={1.7} />
        </mesh>
        {heavy ? (
          <mesh position={[0, crozier ? 0.7 : 0.56, 0]}>
            <octahedronGeometry args={[0.045, 0]} />
            <Skin color="#f0e8ff" metalness={0.2} roughness={0.08} eInt={1.4} />
          </mesh>
        ) : null}
      </group>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.24, 1.32 + Math.sin(a * 1.4) * 0.04, Math.sin(a) * 0.16]}>
            <octahedronGeometry args={[0.028, 0]} />
            <Skin color={accent} eInt={1.45} roughness={0.12} />
          </mesh>
        );
      })}
      <Plate pos={[0.09, 0.05, 0.06]} size={[0.09, 0.04, 0.16]} color="#1a1624" metal={0.25} rough={0.55} />
      <Plate pos={[-0.09, 0.05, 0.06]} size={[0.09, 0.04, 0.16]} color="#1a1624" metal={0.25} rough={0.55} />
    </Humanoid>
  );
}
