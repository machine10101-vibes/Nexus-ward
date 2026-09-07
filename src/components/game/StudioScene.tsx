import { Suspense, useLayoutEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useGameStore } from "@/game/store";
import { PLANET_THEME } from "@/game/config";
import { PlanetGlobe } from "./Planet";
import { EnemyModel, HexPad, NexusCore, SpawnGate, TowerModel } from "./models";
import { studioEntry } from "./studioCatalog";

type StudioControls = {
  target: { set: (x: number, y: number, z: number) => void };
  object: { position: { set: (x: number, y: number, z: number) => void } };
  update: () => void;
};

export function StudioScene() {
  const id = useGameStore((s) => s.studioId);
  const variant = useGameStore((s) => s.studioVariant);
  const spin = useGameStore((s) => s.studioSpin);
  const fit = useGameStore((s) => s.studioFit);
  const controls = useRef<StudioControls>(null);

  useLayoutEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.target.set(0, 0.72, 0);
    c.object.position.set(3.1, 2.15, 4.05);
    c.update();
  }, [fit, id]);

  return (
    <>
      <color attach="background" args={["#12141a"]} />
      <fog attach="fog" args={["#12141a", 14, 32]} />
      <hemisphereLight intensity={0.85} color="#f2f4f8" groundColor="#2a2e34" />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[4.5, 7.2, 5.2]}
        intensity={2.05}
        color="#fff4dc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 3.2, -2]} intensity={0.48} color="#c8dcff" />
      <directionalLight position={[-2, 4, 7]} intensity={0.38} color="#ffe0b8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6.4, 48]} />
        <meshStandardMaterial color="#1a1d24" roughness={0.92} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[1.52, 1.6, 48]} />
        <meshBasicMaterial color="#8fb4c4" transparent opacity={0.45} />
      </mesh>
      <gridHelper args={[8, 16, "#3a4450", "#232830"]} position={[0, 0.004, 0]} />
      <group>
        <Suspense fallback={null}>
          <StudioSubject id={id} variant={variant} />
        </Suspense>
      </group>
      <OrbitControls
        ref={controls as never}
        enableDamping
        dampingFactor={0.08}
        autoRotate={spin}
        autoRotateSpeed={0.85}
        minDistance={1.15}
        maxDistance={16}
        target={[0, 0.72, 0]}
        makeDefault
      />
    </>
  );
}

function StudioSubject({ id, variant }: { id: string; variant: number }) {
  const entry = studioEntry(id);
  if (entry.kind === "tower" && entry.tower) {
    return <TowerModel type={entry.tower} level={Math.min(3, Math.max(1, variant))} />;
  }
  if (entry.kind === "enemy" && entry.enemy) {
    const lift = entry.enemy === "spore" || entry.enemy === "gunship" || entry.enemy === "wraith" ? 0.55 : 0;
    return (
      <group position={[0, lift, 0]}>
        <EnemyModel type={entry.enemy} />
      </group>
    );
  }
  if (entry.world === "globe" && entry.map) {
    return (
      <group position={[0, 1.15, 0]}>
        <PlanetGlobe id={entry.map} radius={1.15} spin={0.08} />
      </group>
    );
  }
  if (entry.world === "core") {
    return <NexusCore color={PLANET_THEME.mycelion.core} health={1} />;
  }
  if (entry.world === "gate") {
    return <SpawnGate color={PLANET_THEME.mycelion.pathEmissive} />;
  }
  return <HexPad color={PLANET_THEME.mycelion.pad} emissive={PLANET_THEME.mycelion.padEmi} />;
}
