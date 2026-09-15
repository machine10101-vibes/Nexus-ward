import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, type Group, type Material, type Object3D } from "three";
import { engine } from "@/game/engine";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";
import { createWardenMesh } from "./wardenMesh";

function strikeCurve(swing: number, max: number) {
  if (swing <= 0 || max <= 0) return 0;
  const u = 1 - Math.min(1, swing / max);
  const raw = u < 0.3 ? u / 0.3 : Math.max(0, 1 - (u - 0.3) / 0.7);
  return raw * raw * (3 - 2 * raw);
}

function ghostify(root: Group) {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    const src = obj.material as Material | Material[];
    const list = Array.isArray(src) ? src : [src];
    const cloned = list.map((m) => {
      const next = m.clone();
      next.transparent = true;
      next.opacity = 0.38;
      next.depthWrite = false;
      return next;
    });
    obj.material = Array.isArray(src) ? cloned : cloned[0];
  });
}

export function HeroModel({
  id,
  weapon = null,
  armor = null,
  scale = 1,
  animate = "idle",
  ghost = false,
}: {
  id: HeroId;
  weapon?: ItemId | null;
  armor?: ItemId | null;
  scale?: number;
  animate?: "idle" | "combat";
  ghost?: boolean;
}) {
  const root = useRef<Group>(null);
  const heavy = armor === "aegis-plate" || armor === "ghost-harness" || armor === "star-silk";
  const bigWep = weapon === "void-greatblade" || weapon === "rail-longarm" || weapon === "nova-crozier";
  const accent = HEROES[id].accent;
  const mesh = useMemo(() => {
    const next = createWardenMesh(id, { heavy, bigWep, accent });
    if (ghost) ghostify(next);
    return next;
  }, [id, heavy, bigWep, accent, ghost]);

  useFrame((s) => {
    const g = root.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    const head = g.getObjectByName("playerHead");
    const armL = g.getObjectByName("armL");
    const armR = g.getObjectByName("armR");
    const torso = g.getObjectByName("playerTorso");
    const wep = g.getObjectByName("wep");
    const cloth = g.getObjectByName("clothSwing");
    const orbit = g.getObjectByName("orbit");
    const legL = g.getObjectByName("legL");
    const legR = g.getObjectByName("legR");
    if (orbit) orbit.rotation.y = t * (0.85 + (animate === "combat" && engine.hero.swing > 0 ? 2.2 : 0));
    const pose = (obj: Object3D | undefined, x: number, y = 0, z = 0) => {
      if (!obj) return;
      obj.rotation.x = x;
      obj.rotation.y = y;
      obj.rotation.z = z;
    };

    const restWep = () => {
      if (!wep) return;
      if (id === "fighter") wep.rotation.set(0.15, 0.35, -1.15);
      else if (id === "ranger") wep.rotation.set(0.35, 0.55, 0.12);
      else wep.rotation.set(0, 0, 0);
    };

    if (animate === "combat") {
      const swing = engine.hero.swing;
      const kind = engine.hero.swingKind;
      const strike = strikeCurve(swing, engine.hero.swingMax);
      const clothBase = id === "ranger" ? 0.18 : 0;

      if (strike <= 0.02) {
        g.position.y = Math.sin(t * 1.25) * 0.008;
        if (id === "fighter") {
          pose(armR, -0.32);
          pose(armL, 0.18);
        } else if (id === "ranger") {
          pose(armR, -0.48);
          pose(armL, -0.22);
        } else {
          pose(armL, -0.28);
          pose(armR, 0.06);
        }
        pose(legL, Math.sin(t * 0.7) * 0.02);
        pose(legR, Math.sin(t * 0.7 + 1) * 0.02);
        if (head) head.rotation.x = -0.12 + Math.sin(t * 0.5) * 0.02;
        if (torso) {
          torso.rotation.x = 0;
          torso.rotation.z = 0;
        }
        restWep();
        if (cloth) cloth.rotation.x = clothBase + Math.sin(t * 1.8) * 0.03;
        return;
      }

      g.position.y = id === "fighter" && kind === 2 ? strike * 0.04 : 0;
      if (id === "fighter") {
        if (kind === 1) {
          pose(armR, 0.35 - strike * 1.25);
          pose(armL, 0.3 - strike * 1.15);
          if (wep) wep.rotation.set(0.15 + strike * 0.4, 0.35, -1.15);
        } else if (kind === 2) {
          pose(armR, 0.4 - strike * 2.15);
          pose(armL, 0.2 + strike * 0.25);
          pose(legR, -strike * 0.4);
          pose(legL, strike * 0.18);
          if (wep) wep.rotation.set(0.05, 0.2, -1.35);
        } else if (kind === 0) {
          pose(armR, 0.55 - strike * 1.9, -0.2 + strike * 1.25);
          pose(armL, 0.15 + strike * 0.35, -strike * 0.2);
          if (wep) wep.rotation.set(0.1, 0.35 + strike * 0.55, -1.15 - strike * 0.3);
        } else {
          pose(armR, 0.45 - strike * 1.7, -0.1 + strike * 0.85);
          pose(armL, 0.12 + strike * 0.2);
          if (wep) wep.rotation.set(0.15, 0.35 + strike * 0.35, -1.15 - strike * 0.2);
        }
        if (torso) {
          torso.rotation.x = strike * (kind === 2 ? 0.18 : 0.08);
          torso.rotation.z = (kind === 0 ? 1 : kind === -1 ? 0.6 : 0) * strike * -0.12;
        }
      } else if (id === "ranger") {
        if (kind === 1) {
          pose(armR, -0.55 - strike * 0.55);
          pose(armL, -0.35 - strike * 0.4);
        } else if (kind === 2) {
          pose(armR, -0.4 - strike * 0.25, strike * 0.7);
          pose(armL, -0.2);
        } else if (kind === 0) {
          pose(armR, -0.35 - strike * 0.55);
          pose(armL, -0.18 - strike * 0.15);
        } else {
          pose(armR, -0.4 - strike * 0.35);
          pose(armL, -0.2 - strike * 0.08);
        }
        if (wep) wep.rotation.set(0.35 - strike * 0.12, 0.55, 0.12);
        if (torso) {
          torso.rotation.x = -strike * 0.05;
          torso.rotation.z = 0;
        }
        pose(legL, 0);
        pose(legR, 0);
      } else if (kind === 0) {
        pose(armR, -strike * 0.7, 0, strike * 0.5);
        pose(armL, -0.2 - strike * 0.85, 0, -strike * 0.45);
        if (wep) wep.rotation.set(-strike * 0.25, 0, 0);
        if (torso) torso.rotation.x = -strike * 0.06;
      } else if (kind === 2) {
        pose(armL, -0.1 + strike * 0.85);
        pose(armR, strike * 0.3);
        if (wep) wep.rotation.set(strike * 0.35, 0, 0);
        if (torso) torso.rotation.x = strike * 0.12;
      } else if (kind === 1) {
        pose(armR, -strike * 0.25);
        pose(armL, -0.25 - strike * 1.15);
        if (wep) wep.rotation.set(-strike * 0.4, 0, 0);
      } else {
        pose(armR, 0.05);
        pose(armL, -0.15 - strike * 0.85);
        if (wep) wep.rotation.set(-strike * 0.2, 0, 0);
      }
      if (head) head.rotation.x = -0.14 - strike * (kind === 1 && id === "fighter" ? 0.2 : 0.08);
      if (cloth) cloth.rotation.x = clothBase + strike * 0.22;
      return;
    }

    g.position.y = Math.sin(t * 1.35) * 0.012;
    g.rotation.y = Math.sin(t * 0.26) * 0.05;
    pose(armL, Math.sin(t * 1.05) * 0.07);
    pose(armR, Math.sin(t * 1.05 + 0.7) * 0.07);
    pose(legL, 0);
    pose(legR, 0);
    restWep();
    if (head) {
      head.rotation.x = -0.14 + Math.sin(t * 0.55) * 0.03;
      head.rotation.y = Math.sin(t * 0.38) * 0.08;
    }
    if (torso) {
      torso.position.y = 1.12 + Math.sin(t * 1.55) * 0.01;
      torso.rotation.x = 0;
      torso.rotation.z = 0;
    }
    if (cloth) cloth.rotation.x = (id === "ranger" ? 0.18 : 0) + Math.sin(t * 1.6) * 0.04;
  });

  return <primitive ref={root} object={mesh} scale={scale} />;
}
