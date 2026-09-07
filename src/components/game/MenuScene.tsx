import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import type { Mesh } from "three";
import { useGameStore } from "@/game/store";
import { PLANET_THEME } from "@/game/config";
import { PlanetGlobe, PLANET_PALETTE } from "./Planet";

export function MenuScene() {
  const preview = useGameStore((s) => s.preview);
  const ring = useRef<Mesh>(null);
  const ring2 = useRef<Mesh>(null);

  useFrame((state, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.04;
    if (ring2.current) ring2.current.rotation.z -= dt * 0.025;
    const cam = state.camera;
    const t = state.clock.elapsedTime;
    cam.position.x = Math.sin(t * 0.07) * 0.7;
    cam.position.y = 0.32 + Math.sin(t * 0.05) * 0.18;
    cam.lookAt(0, 0, 0);
  });

  const pal = PLANET_PALETTE[preview];
  const theme = PLANET_THEME[preview];

  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.fog, 10, 40]} />
      <ambientLight intensity={0.22} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 0.75]} />
      <directionalLight position={[6, 8, 4]} intensity={1.85} color={theme.dir} />
      <pointLight position={[-4, 2, 3]} intensity={22} distance={18} color={pal.atmo} />
      <pointLight position={[5, -1, 2]} intensity={10} distance={14} color={pal.ring} />
      <Stars radius={70} depth={32} count={1600} factor={3.1} fade speed={0.45} />
      <Sparkles count={28} scale={12} size={2.4} speed={0.35} color={pal.atmo} opacity={0.55} />
      <PlanetGlobe id={preview} />
      <mesh ref={ring} rotation={[Math.PI / 2.6, 0.2, 0.3]}>
        <torusGeometry args={[3.4, 0.038, 8, 96]} />
        <meshStandardMaterial color={pal.ring} emissive={pal.ring} emissiveIntensity={0.95} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 2.2, -0.15, 0.5]}>
        <torusGeometry args={[3.85, 0.016, 6, 80]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.32} />
      </mesh>
      <mesh rotation={[Math.PI / 2.6, 0.2, 0.3]}>
        <torusGeometry args={[3.55, 0.01, 6, 64]} />
        <meshBasicMaterial color={pal.atmo} transparent opacity={0.5} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 3.4, Math.sin(a) * 0.55, Math.sin(a) * 3.4 * 0.35]}>
            <boxGeometry args={[0.12, 0.08, 0.18]} />
            <meshStandardMaterial color={pal.ring} emissive={pal.ring} emissiveIntensity={0.7} metalness={0.6} roughness={0.28} />
          </mesh>
        );
      })}
      <mesh position={[3.35, 0.85, -1.5]}>
        <sphereGeometry args={[0.24, 20, 16]} />
        <meshStandardMaterial color="#c8d0d4" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[-2.7, -0.45, 2.15]}>
        <sphereGeometry args={[0.13, 14, 12]} />
        <meshStandardMaterial color="#8a9098" roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[1.8, -1.4, -2.4]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color={pal.atmo} emissive={pal.atmo} emissiveIntensity={0.4} roughness={0.4} />
      </mesh>
    </>
  );
}
