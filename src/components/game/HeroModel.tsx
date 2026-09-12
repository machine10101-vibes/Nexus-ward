import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";
import { createWardenMesh } from "./wardenMesh";

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
  const heavy = armor === "aegis-plate" || armor === "ghost-harness" || armor === "star-silk";
  const bigWep = weapon === "void-greatblade" || weapon === "rail-longarm" || weapon === "nova-crozier";
  const accent = HEROES[id].accent;
  const mesh = useMemo(
    () => createWardenMesh(id, { heavy, bigWep, accent }),
    [id, heavy, bigWep, accent],
  );

  useFrame((s) => {
    const g = root.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.position.y = Math.sin(t * 1.35) * 0.01;
    g.rotation.y = Math.sin(t * 0.26) * 0.05;
  });

  return <primitive ref={root} object={mesh} scale={scale} />;
}
