import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group } from "three";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";

type Vec3 = [number, number, number];

function Skin({
  color,
  metalness = 0.18,
  roughness = 0.48,
  emissive,
  eInt = 0,
  side,
}: {
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  eInt?: number;
  side?: typeof DoubleSide;
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

/** Capsule hung from the current origin so the next joint sits in the lower cap. */
function Bone({
  length,
  radius,
  color,
  metal = 0.22,
  rough = 0.42,
}: {
  length: number;
  radius: number;
  color: string;
  metal?: number;
  rough?: number;
}) {
  const total = length + radius * 2;
  return (
    <mesh position={[0, -total / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, length, 8, 16]} />
      <Skin color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

function Joint({ r, color, metal = 0.28, rough = 0.4 }: { r: number; color: string; metal?: number; rough?: number }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[r, 14, 12]} />
      <Skin color={color} metalness={metal} roughness={rough} />
    </mesh>
  );
}

function Box({
  pos,
  rot,
  size,
  color,
  metal = 0.55,
  rough = 0.32,
  eInt = 0,
}: {
  pos?: Vec3;
  rot?: Vec3;
  size: Vec3;
  color: string;
  metal?: number;
  rough?: number;
  eInt?: number;
}) {
  return (
    <mesh position={pos} rotation={rot} castShadow>
      <boxGeometry args={size} />
      <Skin color={color} metalness={metal} roughness={rough} eInt={eInt} />
    </mesh>
  );
}

function joint(length: number, radius: number) {
  return -(length + radius);
}

const RIG = {
  shoulderY: 1.4,
  shoulderX: 0.19,
  hipY: 0.88,
  hipX: 0.1,
  upper: 0.24,
  upperR: 0.044,
  fore: 0.22,
  foreR: 0.036,
  thigh: 0.32,
  thighR: 0.052,
  calf: 0.36,
  calfR: 0.044,
};

function Face({ skin, shade }: { skin: string; shade: string }) {
  return (
    <group position={[0, 1.62, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.1, 20, 16]} />
        <Skin color={skin} metalness={0.05} roughness={0.58} />
      </mesh>
      <mesh position={[0, -0.05, 0.018]} scale={[0.9, 0.7, 0.86]} castShadow>
        <sphereGeometry args={[0.086, 16, 12]} />
        <Skin color={skin} metalness={0.05} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.012, 0.09]} rotation={[0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.02, 0.028, 0.03]} />
        <Skin color={shade} metalness={0.06} roughness={0.5} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <mesh position={[0.034 * s, 0.02, 0.082]} castShadow>
            <sphereGeometry args={[0.015, 10, 8]} />
            <Skin color="#1a1410" roughness={0.32} />
          </mesh>
          <mesh position={[0.034 * s, 0.022, 0.094]}>
            <sphereGeometry args={[0.006, 8, 6]} />
            <Skin color="#d8e8f0" metalness={0.45} roughness={0.16} eInt={0.3} />
          </mesh>
          <mesh position={[0.092 * s, 0, 0.008]} rotation={[0, 0, 0.18 * s]} scale={[0.32, 1, 0.65]} castShadow>
            <sphereGeometry args={[0.028, 10, 8]} />
            <Skin color={skin} roughness={0.62} metalness={0.04} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.04, 0.088]} castShadow>
        <boxGeometry args={[0.036, 0.007, 0.012]} />
        <Skin color="#6a4038" roughness={0.55} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.07, -0.01]} scale={[1, 0.45, 1]} castShadow>
        <sphereGeometry args={[0.1, 14, 10]} />
        <Skin color="#2a2420" roughness={0.7} metalness={0.04} />
      </mesh>
    </group>
  );
}

function Hand({
  skin,
  plate,
  metal = 0.08,
}: {
  skin: string;
  plate?: string;
  metal?: number;
}) {
  const hide = plate ?? skin;
  const m = plate ? 0.7 : metal;
  const rough = plate ? 0.28 : 0.55;
  return (
    <group>
      <mesh position={[0, -0.028, 0.012]} castShadow>
        <boxGeometry args={[0.068, 0.046, 0.086]} />
        <Skin color={hide} metalness={m} roughness={rough} />
      </mesh>
      {[-0.024, -0.008, 0.008, 0.024].map((x, i) => (
        <mesh key={i} position={[x, -0.072, 0.03]} castShadow>
          <capsuleGeometry args={[0.007, 0.03 + (i === 1 || i === 2 ? 0.008 : 0), 4, 8]} />
          <Skin color={hide} metalness={m} roughness={rough} />
        </mesh>
      ))}
      <mesh position={[-0.03, -0.04, 0.012]} rotation={[0.15, -0.7, 0.55]} castShadow>
        <capsuleGeometry args={[0.008, 0.028, 4, 8]} />
        <Skin color={hide} metalness={m} roughness={rough} />
      </mesh>
    </group>
  );
}

function Boot({ color, metal = 0.55 }: { color: string; metal?: number }) {
  return (
    <group>
      <mesh position={[0, -0.04, 0.03]} castShadow>
        <boxGeometry args={[0.09, 0.07, 0.14]} />
        <Skin color={color} metalness={metal} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.068, 0.07]} castShadow>
        <boxGeometry args={[0.088, 0.028, 0.1]} />
        <Skin color="#14181c" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.03, 0.1]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.06]} />
        <Skin color={color} metalness={metal} roughness={0.28} />
      </mesh>
    </group>
  );
}

function Sword({ accent, great }: { accent: string; great: boolean }) {
  const blade = great ? 0.72 : 0.54;
  return (
    <group rotation={[0.15, 0, -0.35]} position={[0.02, -0.06, 0.04]}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.018, 0.12, 10]} />
        <Skin color="#3a2e24" metalness={0.28} roughness={0.5} />
      </mesh>
      <Box pos={[0, 0.08, 0]} size={[0.14, 0.028, 0.036]} color="#d8dee6" metal={0.88} rough={0.12} />
      <Box pos={[0, 0.08 + blade / 2, 0]} size={[0.055, blade, 0.012]} color="#e8eef4" metal={0.92} rough={0.08} />
      <Box pos={[0, 0.08 + blade / 2, 0.008]} size={[0.014, blade * 0.94, 0.005]} color={accent} metal={0.4} rough={0.1} eInt={1.6} />
      <mesh position={[0, 0.08 + blade + 0.03, 0]}>
        <coneGeometry args={[0.024, 0.06, 8]} />
        <Skin color="#f2f6fa" metalness={0.9} roughness={0.08} />
      </mesh>
    </group>
  );
}

function Shield({ accent, steel }: { accent: string; steel: string }) {
  return (
    <group position={[0.0, -0.06, 0.1]} rotation={[0.1, 0.9, 0.15]}>
      <mesh scale={[1, 1.28, 0.16]} castShadow>
        <sphereGeometry args={[0.15, 16, 14]} />
        <Skin color={steel} metalness={0.86} roughness={0.14} />
      </mesh>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.06, 0.012, 10, 18]} />
        <Skin color={accent} metalness={0.5} roughness={0.16} eInt={0.85} />
      </mesh>
      <Box pos={[0, 0, 0.03]} size={[0.04, 0.04, 0.02]} color={accent} metal={0.55} eInt={0.4} />
    </group>
  );
}

function Rifle({ accent, long }: { accent: string; long: boolean }) {
  const body = long ? 0.58 : 0.44;
  return (
    <group rotation={[1.15, 0.15, -0.2]} position={[0.02, -0.04, 0.06]}>
      <Box pos={[0, 0, body * 0.08]} size={[0.055, 0.07, body]} color="#1a2026" metal={0.7} rough={0.24} />
      <mesh position={[0, 0.01, body * 0.52]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.016, long ? 0.28 : 0.18, 10]} />
        <Skin color="#8a949c" metalness={0.88} roughness={0.14} />
      </mesh>
      <Box pos={[0, -0.05, 0]} size={[0.03, 0.08, 0.07]} color="#12161a" metal={0.45} rough={0.4} />
      <Box pos={[0.0, 0.05, 0.06]} size={[0.03, 0.04, 0.08]} color={accent} metal={0.55} rough={0.14} eInt={0.85} />
      <Box pos={[0, 0.01, -body * 0.38]} size={[0.04, 0.055, 0.12]} color="#2a3238" metal={0.4} rough={0.42} />
      <mesh position={[0, 0, body * 0.62]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <Skin color={accent} eInt={1.5} roughness={0.1} />
      </mesh>
    </group>
  );
}

function Staff({ accent, crozier }: { accent: string; crozier: boolean }) {
  const h = crozier ? 1.12 : 0.9;
  return (
    <group rotation={[0.15, 0.2, 0.35]} position={[0.01, -0.04, 0.02]}>
      <mesh position={[0, h * 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.02, h, 12]} />
        <Skin color="#5a5478" metalness={0.4} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.028, 0.007, 8, 16]} />
        <Skin color={accent} metalness={0.35} roughness={0.18} eInt={0.7} />
      </mesh>
      <mesh position={[0, h * 0.55, 0]} castShadow>
        <octahedronGeometry args={[crozier ? 0.1 : 0.078, 0]} />
        <Skin color={accent} metalness={0.16} roughness={0.1} eInt={1.75} />
      </mesh>
    </group>
  );
}

function Arm({
  side,
  upper,
  fore,
  pose,
  hand,
  sleeve,
  shield,
}: {
  side: 1 | -1;
  upper: string;
  fore: string;
  pose: { shoulder: Vec3; elbow: Vec3 };
  hand: ReactNode;
  sleeve?: ReactNode;
  shield?: ReactNode;
}) {
  const r = RIG.upperR;
  const fr = RIG.foreR;
  return (
    <group position={[RIG.shoulderX * side, RIG.shoulderY, 0]} rotation={pose.shoulder}>
      <Joint r={r * 1.15} color={upper} metal={0.45} />
      <Bone length={RIG.upper} radius={r} color={upper} metal={0.5} />
      {sleeve}
      <group position={[0, joint(RIG.upper, r), 0]} rotation={pose.elbow}>
        <Joint r={fr * 1.1} color={fore} metal={0.2} />
        <Bone length={RIG.fore} radius={fr} color={fore} metal={0.12} rough={0.52} />
        {shield}
        <group position={[0, joint(RIG.fore, fr), 0]}>{hand}</group>
      </group>
    </group>
  );
}

function Leg({
  side,
  thigh,
  calf,
  boot,
  pose,
  plates,
}: {
  side: 1 | -1;
  thigh: string;
  calf: string;
  boot: string;
  pose: { hip: Vec3; knee: Vec3 };
  plates?: ReactNode;
}) {
  const r = RIG.thighR;
  const cr = RIG.calfR;
  return (
    <group position={[RIG.hipX * side, RIG.hipY, 0]} rotation={pose.hip}>
      <Joint r={r * 1.05} color={thigh} metal={0.25} />
      <Bone length={RIG.thigh} radius={r} color={thigh} metal={0.2} rough={0.48} />
      <group position={[0, joint(RIG.thigh, r), 0]} rotation={pose.knee}>
        <Joint r={cr * 1.05} color={calf} metal={0.4} />
        <Bone length={RIG.calf} radius={cr} color={calf} metal={0.45} />
        {plates}
        <group position={[0, joint(RIG.calf, cr), 0]}>
          <Boot color={boot} />
        </group>
      </group>
    </group>
  );
}

function Torso({
  chest,
  waist,
  pelvis,
  bulk,
  collar,
  children,
}: {
  chest: string;
  waist: string;
  pelvis: string;
  bulk: number;
  collar?: string;
  children?: ReactNode;
}) {
  const w = bulk;
  return (
    <group>
      <mesh position={[0, 0.9, 0.01]} castShadow>
        <boxGeometry args={[0.26 * w, 0.14, 0.16]} />
        <Skin color={pelvis} metalness={0.22} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.08, 0.015]} castShadow>
        <cylinderGeometry args={[0.1 * w, 0.118 * w, 0.22, 14]} />
        <Skin color={waist} metalness={0.2} roughness={0.48} />
      </mesh>
      <mesh position={[0, 1.28, 0.02]} castShadow>
        <cylinderGeometry args={[0.155 * w, 0.12 * w, 0.3, 16]} />
        <Skin color={chest} metalness={0.5} roughness={0.3} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[0.1 * w * s, 1.4, 0]} rotation={[0, 0, -0.18 * s]} castShadow>
          <boxGeometry args={[0.16 * w, 0.045, 0.055]} />
          <Skin color={collar ?? chest} metalness={0.55} roughness={0.28} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.038, 0.046, 0.09, 12]} />
        <Skin color={collar ?? chest} metalness={0.15} roughness={0.5} />
      </mesh>
      {children}
    </group>
  );
}

function Figure({
  id,
  accent,
  heavy,
  bigWep,
}: {
  id: HeroId;
  accent: string;
  heavy: boolean;
  bigWep: boolean;
}) {
  if (id === "fighter") {
    const steel = heavy ? "#8c949c" : "#c5cdd6";
    const bright = heavy ? "#aeb6be" : "#e4ebf2";
    const dark = heavy ? "#3a424c" : "#4c5662";
    const skin = "#d2ae90";
    return (
      <group>
        <Face skin={skin} shade="#b89074" />
        <group position={[0, 1.64, 0]}>
          <mesh position={[0, 0.04, 0]} castShadow>
            <sphereGeometry args={[0.118, 20, 16]} />
            <Skin color={bright} metalness={0.88} roughness={0.14} />
          </mesh>
          <mesh position={[0, 0.08, -0.01]} scale={[1.02, 0.48, 1]} castShadow>
            <sphereGeometry args={[0.12, 16, 12]} />
            <Skin color={steel} metalness={0.86} roughness={0.16} />
          </mesh>
          <Box pos={[0, -0.05, 0.1]} size={[0.2, 0.05, 0.055]} color={accent} metal={0.55} eInt={1.5} />
          <Box pos={[0, -0.05, 0.13]} size={[0.15, 0.016, 0.014]} color="#fff4c0" metal={0.25} rough={0.08} eInt={2} />
          {([-1, 1] as const).map((s) => (
            <mesh key={s} position={[0.07 * s, -0.08, 0.06]} rotation={[0.2, 0.5 * s, 0]} scale={[0.5, 1, 0.65]} castShadow>
              <sphereGeometry args={[0.07, 12, 10]} />
              <Skin color={steel} metalness={0.84} roughness={0.18} />
            </mesh>
          ))}
          <mesh position={[0, 0.16, -0.01]} rotation={[0.2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.028, 0.09, 8]} />
            <Skin color={accent} metalness={0.55} roughness={0.18} eInt={0.65} />
          </mesh>
        </group>
        <Torso chest={steel} waist={dark} pelvis={dark} bulk={heavy ? 1.14 : 1.08} collar={steel}>
          <Box pos={[0, 1.3, 0.12]} size={[0.22, 0.2, 0.05]} color={bright} metal={0.86} rough={0.14} />
          <Box pos={[0, 1.16, 0.11]} size={[0.18, 0.06, 0.04]} color={dark} metal={0.5} />
          <Box pos={[-0.06, 1.08, 0.1]} size={[0.055, 0.06, 0.035]} color={steel} metal={0.78} />
          <Box pos={[0.06, 1.08, 0.1]} size={[0.055, 0.06, 0.035]} color={steel} metal={0.78} />
          <mesh position={[0, 1.28, 0.145]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055, 0.01, 10, 18]} />
            <Skin color={accent} metalness={0.5} roughness={0.16} eInt={0.8} />
          </mesh>
          <Box pos={[0, 0.96, 0.09]} size={[0.24, 0.04, 0.12]} color="#2a3038" metal={0.35} rough={0.45} />
        </Torso>
        <Arm
          side={1}
          upper={steel}
          fore={steel}
          pose={{ shoulder: [0.55, 0.25, -0.7], elbow: [0.85, 0.1, 0.15] }}
          sleeve={<Box pos={[0, -0.08, 0]} size={[0.1, 0.08, 0.1]} color={bright} metal={0.84} />}
          hand={
            <group>
              <Hand skin={skin} plate={bright} />
              <Sword accent={accent} great={bigWep} />
            </group>
          }
        />
        <Arm
          side={-1}
          upper={steel}
          fore={steel}
          pose={{ shoulder: [0.35, -0.2, 0.65], elbow: [0.45, -0.1, -0.1] }}
          sleeve={<Box pos={[0, -0.08, 0]} size={[0.1, 0.08, 0.1]} color={bright} metal={0.84} />}
          shield={<Shield accent={accent} steel={bright} />}
          hand={<Hand skin={skin} plate={bright} />}
        />
        <Leg
          side={1}
          thigh={dark}
          calf={steel}
          boot="#1a1e24"
          pose={{ hip: [0.06, 0, 0.05], knee: [0.08, 0, 0] }}
          plates={<Box pos={[0, -0.16, 0.04]} size={[0.09, 0.2, 0.08]} color={bright} metal={0.8} />}
        />
        <Leg
          side={-1}
          thigh={dark}
          calf={steel}
          boot="#1a1e24"
          pose={{ hip: [0.07, 0, -0.05], knee: [0.06, 0, 0] }}
          plates={<Box pos={[0, -0.16, 0.04]} size={[0.09, 0.2, 0.08]} color={bright} metal={0.8} />}
        />
      </group>
    );
  }

  if (id === "ranger") {
    const kit = heavy ? "#5a6c72" : "#6e848a";
    const weave = heavy ? "#3a4a4e" : "#4a5e5a";
    const skin = "#c69a76";
    return (
      <group>
        <Face skin={skin} shade="#a87c5c" />
        <group position={[0, 1.66, 0]}>
          <mesh position={[0, 0.04, -0.01]} scale={[1.08, 0.62, 1.05]} castShadow>
            <sphereGeometry args={[0.11, 16, 14]} />
            <Skin color="#2e3c40" metalness={0.5} roughness={0.34} />
          </mesh>
          <Box pos={[0, -0.02, 0.1]} size={[0.2, 0.036, 0.05]} color={accent} metal={0.7} eInt={1.1} />
          <Box pos={[0, -0.02, 0.126]} size={[0.15, 0.012, 0.01]} color="#e8f4f8" metal={0.3} rough={0.1} eInt={0.95} />
        </group>
        <Torso chest={kit} waist={weave} pelvis={weave} bulk={heavy ? 0.98 : 0.94} collar={kit}>
          <Box pos={[0, 1.26, 0.12]} size={[0.18, 0.14, 0.045]} color="#161c20" metal={0.4} rough={0.42} />
          <Box pos={[0, 1.14, 0.11]} rot={[0, 0, 0.55]} size={[0.22, 0.024, 0.028]} color="#1a2024" metal={0.3} rough={0.5} />
          <Box pos={[0, 1.14, 0.11]} rot={[0, 0, -0.55]} size={[0.22, 0.024, 0.028]} color="#1a2024" metal={0.3} rough={0.5} />
          <Box pos={[-0.055, 1.04, 0.12]} size={[0.05, 0.065, 0.038]} color="#12181c" metal={0.55} />
          <Box pos={[0.055, 1.04, 0.12]} size={[0.05, 0.065, 0.038]} color="#12181c" metal={0.55} />
          {heavy ? (
            <>
              <Box pos={[-0.09, 1.2, 0.13]} size={[0.045, 0.045, 0.028]} color={accent} metal={0.5} eInt={0.35} />
              <Box pos={[0.09, 1.2, 0.13]} size={[0.045, 0.045, 0.028]} color={accent} metal={0.5} eInt={0.35} />
            </>
          ) : null}
          <Box pos={[0, 0.96, 0.08]} size={[0.2, 0.035, 0.1]} color="#1c2428" metal={0.3} rough={0.5} />
        </Torso>
        <Arm
          side={1}
          upper={kit}
          fore={skin}
          pose={{ shoulder: [0.95, 0.55, -1.05], elbow: [1.15, 0.25, 0.2] }}
          sleeve={<Box pos={[0, -0.06, 0]} size={[0.08, 0.06, 0.08]} color={kit} metal={0.5} />}
          hand={
            <group>
              <Hand skin={skin} />
              <Rifle accent={accent} long={bigWep} />
            </group>
          }
        />
        <Arm
          side={-1}
          upper={kit}
          fore={skin}
          pose={{ shoulder: [0.75, -0.45, 0.95], elbow: [1.05, -0.2, -0.15] }}
          sleeve={<Box pos={[0, -0.06, 0]} size={[0.08, 0.06, 0.08]} color={kit} metal={0.5} />}
          hand={<Hand skin={skin} />}
        />
        <Leg
          side={1}
          thigh={weave}
          calf={kit}
          boot="#161a1e"
          pose={{ hip: [0.05, 0, 0.04], knee: [0.07, 0, 0] }}
        />
        <Leg
          side={-1}
          thigh={weave}
          calf={kit}
          boot="#161a1e"
          pose={{ hip: [0.06, 0, -0.04], knee: [0.05, 0, 0] }}
        />
      </group>
    );
  }

  const veil = heavy ? "#3c366c" : "#564e96";
  const deep = heavy ? "#282244" : "#383264";
  const lining = heavy ? "#8a7cc8" : "#7a72b0";
  const skin = "#e4c8b0";
  return (
    <group>
      <Face skin={skin} shade="#c8a88c" />
      <group position={[0, 1.64, 0]}>
        <mesh position={[0, 0.12, -0.05]} rotation={[-0.4, 0, 0]} castShadow>
          <coneGeometry args={[0.16, 0.28, 14]} />
          <Skin color={deep} metalness={0.08} roughness={0.7} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, -0.02]} scale={[1.15, 0.7, 1.05]} castShadow>
          <sphereGeometry args={[0.14, 16, 12]} />
          <Skin color={veil} metalness={0.1} roughness={0.66} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.04, 0.08]} rotation={[0.45, 0, 0]} scale={[1, 0.28, 0.7]} castShadow>
          <sphereGeometry args={[0.13, 12, 10]} />
          <Skin color={deep} metalness={0.08} roughness={0.68} />
        </mesh>
      </group>
      <Torso chest={lining} waist={veil} pelvis={veil} bulk={0.9} collar={lining}>
        <mesh position={[0, 0.62, 0]} rotation={[0.08, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.12, 0.55, 14]} />
          <Skin color={veil} metalness={0.06} roughness={0.72} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.55, 0.02]} rotation={[0.12, 0, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.1, 0.42, 14]} />
          <Skin color={deep} metalness={0.05} roughness={0.74} side={DoubleSide} />
        </mesh>
        <Box pos={[0, 1.24, 0.1]} size={[0.2, 0.08, 0.04]} color={lining} metal={0.16} rough={0.55} />
      </Torso>
      <Arm
        side={1}
        upper={veil}
        fore={skin}
        pose={{ shoulder: [0.25, 0.1, -0.45], elbow: [0.35, 0, 0.08] }}
        sleeve={
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.22, 6, 12]} />
            <Skin color={veil} metalness={0.08} roughness={0.68} />
          </mesh>
        }
        hand={<Hand skin={skin} />}
      />
      <Arm
        side={-1}
        upper={veil}
        fore={skin}
        pose={{ shoulder: [0.2, -0.15, 0.4], elbow: [0.25, 0, -0.08] }}
        sleeve={
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.22, 6, 12]} />
            <Skin color={veil} metalness={0.08} roughness={0.68} />
          </mesh>
        }
        hand={
          <group>
            <Hand skin={skin} />
            <Staff accent={accent} crozier={bigWep} />
          </group>
        }
      />
      <Leg
        side={1}
        thigh={veil}
        calf={deep}
        boot="#1a1624"
        pose={{ hip: [0.05, 0, 0.04], knee: [0.06, 0, 0] }}
      />
      <Leg
        side={-1}
        thigh={veil}
        calf={deep}
        boot="#1a1624"
        pose={{ hip: [0.06, 0, -0.04], knee: [0.05, 0, 0] }}
      />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.2, 1.3 + Math.sin(a) * 0.03, Math.sin(a) * 0.14]}>
            <octahedronGeometry args={[0.024, 0]} />
            <Skin color={accent} eInt={1.4} roughness={0.12} />
          </mesh>
        );
      })}
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
    g.position.y = Math.sin(t * 1.4) * 0.008;
    g.rotation.y = Math.sin(t * 0.28) * 0.04;
  });

  const heavy = armor === "aegis-plate" || armor === "ghost-harness" || armor === "star-silk";
  const bigWep = weapon === "void-greatblade" || weapon === "rail-longarm" || weapon === "nova-crozier";

  return (
    <group ref={root} scale={scale}>
      <mesh position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.024, 16]} />
        <Skin color="#14181e" metalness={0.55} roughness={0.4} />
      </mesh>
      <Figure id={id} accent={accent} heavy={heavy} bigWep={bigWep} />
    </group>
  );
}
