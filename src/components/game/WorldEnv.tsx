import { Environment, Lightformer } from "@react-three/drei";
import { BackSide } from "three";
import type { MapId } from "@/game/types";

type Rig = { dome: string; key: string; side: string; rim: string; keyI: number; sideI: number };

const RIGS: Record<MapId | "studio", Rig> = {
  mycelion: { dome: "#2a5e4c", key: "#d8ffe8", side: "#3dcaa0", rim: "#8ef0c4", keyI: 2.6, sideI: 2.2 },
  forge: { dome: "#5a3a22", key: "#ffe2c0", side: "#ff7a2c", rim: "#ffb070", keyI: 2.8, sideI: 2.6 },
  aegis: { dome: "#2c5666", key: "#e4f6ff", side: "#8ec8d0", rim: "#c8f0ff", keyI: 2.6, sideI: 2.4 },
  studio: { dome: "#2a323c", key: "#fff4e0", side: "#9fc4ff", rim: "#ffd8b0", keyI: 3, sideI: 1.8 },
};

/** A softbox rig rendered once into a cube map, so metal has something to reflect. */
export function WorldEnv({ id, intensity = 0.7 }: { id: MapId | "studio"; intensity?: number }) {
  const r = RIGS[id];
  return (
    <Environment key={id} resolution={128} frames={1} environmentIntensity={intensity}>
      <mesh scale={60}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={r.dome} side={BackSide} />
      </mesh>
      <Lightformer form="rect" intensity={r.keyI} color={r.key} position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[16, 12, 1]} />
      <Lightformer form="rect" intensity={r.sideI} color={r.side} position={[-10, 3, 2]} rotation={[0, Math.PI / 2, 0]} scale={[12, 4, 1]} />
      <Lightformer form="rect" intensity={r.sideI * 0.8} color={r.side} position={[10, 2.5, -3]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 3, 1]} />
      <Lightformer form="ring" intensity={r.sideI} color={r.rim} position={[0, 4, -12]} scale={9} />
      <Lightformer form="rect" intensity={1.2} color={r.rim} position={[0, 1.2, 11]} rotation={[0, Math.PI, 0]} scale={[14, 1.5, 1]} />
      <Lightformer form="rect" intensity={1.6} color={r.side} position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
    </Environment>
  );
}
