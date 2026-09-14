import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Object3D } from "three";
import { engine } from "@/game/engine";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";
import { createWardenMesh } from "./wardenMesh";

export function HeroModel({
  id,
  weapon = null,
  armor = null,
  scale = 1,
  animate = "idle",
}: {
  id: HeroId;
  weapon?: ItemId | null;
  armor?: ItemId | null;
  scale?: number;
  animate?: "idle" | "combat";
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
    const head = g.getObjectByName("playerHead");
    const armL = g.getObjectByName("armL");
    const armR = g.getObjectByName("armR");
    const torso = g.getObjectByName("playerTorso");
    const pose = (obj: Object3D | undefined, x: number, y = 0, z = 0) => {
      if (!obj) return;
      obj.rotation.x = x;
      obj.rotation.y = y;
      obj.rotation.z = z;
    };

    if (animate === "combat") {
      const swing = engine.hero.swing;
      const art = engine.hero.lastArt;
      const punch = swing > 0 ? Math.min(1, swing / 0.42) : 0;
      if (punch <= 0) {
        g.position.y = Math.sin(t * 1.25) * 0.008;
        pose(armL, Math.sin(t * 0.95) * 0.04);
        pose(armR, Math.sin(t * 0.95 + 0.6) * 0.04);
        if (head) head.rotation.x = -0.12 + Math.sin(t * 0.5) * 0.02;
        if (torso) torso.rotation.x = 0;
        return;
      }
      g.position.y = 0;
      if (id === "fighter") {
        if (art === 1) {
          pose(armR, punch * 0.95);
          pose(armL, punch * 0.85);
        } else if (art === 2) {
          pose(armR, -punch * 1.75);
          pose(armL, punch * 0.35);
        } else {
          pose(armR, -punch * 1.2, punch * 0.9);
          pose(armL, punch * 0.45, -punch * 0.25);
        }
      } else if (id === "ranger") {
        if (art === 1) {
          pose(armR, -punch * 0.95);
          pose(armL, -punch * 0.7);
        } else if (art === 2) {
          pose(armR, -punch * 0.55, punch * 0.7);
          pose(armL, -punch * 0.25);
        } else {
          pose(armR, -punch * 0.75);
          pose(armL, -punch * 0.22);
        }
      } else if (art === 0) {
        pose(armR, -punch * 0.55, 0, punch * 0.45);
        pose(armL, -punch * 0.85, 0, -punch * 0.4);
      } else if (art === 2) {
        pose(armL, punch * 0.7);
        pose(armR, punch * 0.35);
      } else {
        pose(armR, -punch * 0.3);
        pose(armL, -punch * 1.15);
      }
      if (head) head.rotation.x = -0.14 - punch * (art === 1 && id === "fighter" ? 0.22 : 0.1);
      if (torso) torso.rotation.x = punch * (art === 2 && id === "fighter" ? 0.16 : 0.08);
      return;
    }

    g.position.y = Math.sin(t * 1.35) * 0.012;
    g.rotation.y = Math.sin(t * 0.26) * 0.05;
    pose(armL, Math.sin(t * 1.05) * 0.07);
    pose(armR, Math.sin(t * 1.05 + 0.7) * 0.07);
    if (head) {
      head.rotation.x = -0.14 + Math.sin(t * 0.55) * 0.03;
      head.rotation.y = Math.sin(t * 0.38) * 0.08;
    }
    if (torso) torso.position.y = 1.12 + Math.sin(t * 1.55) * 0.01;
  });

  return <primitive ref={root} object={mesh} scale={scale} />;
}
