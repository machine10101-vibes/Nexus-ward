import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, type Group, type Material, type Object3D } from "three";
import { engine } from "@/game/engine";
import { HEROES } from "@/game/heroes";
import type { HeroId, ItemId } from "@/game/types";
import { createWardenMesh } from "./wardenMesh";

function strikeCurve(swing: number, max: number, windup = 0.32) {
  if (swing <= 0 || max <= 0) return 0;
  const u = 1 - Math.min(1, swing / max);
  const raw = u < windup ? u / windup : Math.max(0, 1 - (u - windup) / (1 - windup));
  return raw * raw * (3 - 2 * raw);
}

function damp(obj: Object3D | undefined, x: number, y = 0, z = 0, k = 0.18) {
  if (!obj) return;
  obj.rotation.x += (x - obj.rotation.x) * k;
  obj.rotation.y += (y - obj.rotation.y) * k;
  obj.rotation.z += (z - obj.rotation.z) * k;
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

  useFrame((s, dt) => {
    const g = root.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 11);
    const kSoft = 1 - Math.exp(-dt * 7.2);
    const head = g.getObjectByName("playerHead");
    const armL = g.getObjectByName("armL");
    const armR = g.getObjectByName("armR");
    const torso = g.getObjectByName("playerTorso");
    const wep = g.getObjectByName("wep");
    const cloth = g.getObjectByName("clothSwing");
    const orbit = g.getObjectByName("orbit");
    const legL = g.getObjectByName("legL");
    const legR = g.getObjectByName("legR");
    const wepGlow = g.getObjectByName("wepGlow");
    const visorGlow = g.getObjectByName("visorGlow");
    const shieldGlow = g.getObjectByName("shieldGlow");
    if (orbit) orbit.rotation.y = t * (0.85 + (animate === "combat" && engine.hero.swing > 0 ? 2.2 : 0));
    const pulse = (obj: Object3D | undefined, base: number, amp: number, speed: number, strike = 0) => {
      const mesh = obj as Mesh | undefined;
      const mat = mesh?.material as { emissiveIntensity?: number } | undefined;
      if (mat) mat.emissiveIntensity = base + Math.sin(t * speed) * amp + strike;
    };
    pulse(wepGlow, 1.15, 0.35, 7.5, animate === "combat" && engine.hero.swing > 0 ? 1.1 : 0);
    pulse(visorGlow, 0.85, 0.25, 5.2, engine.hero.aiming ? 0.45 : 0);
    pulse(shieldGlow, 0.7, 0.2, 4.4, engine.hero.aiming ? 0.35 : 0);

    const breath = Math.sin(t * 1.28);
    const sway = Math.sin(t * 0.48);
    const shift = Math.sin(t * 0.62);

    let armLx = 0;
    let armLy = 0;
    let armLz = 0;
    let armRx = 0;
    let armRy = 0;
    let armRz = 0;
    let legLx = 0;
    let legLy = 0;
    let legLz = 0;
    let legRx = 0;
    let legRy = 0;
    let legRz = 0;
    let headX = -0.1;
    let headY = 0;
    let headZ = 0;
    let torsoX = 0;
    let torsoY = 0;
    let torsoZ = 0;
    let wepX = 0;
    let wepY = 0;
    let wepZ = 0;
    let clothX = id === "ranger" ? 0.18 : 0;
    let rootY = 0;
    let rootYaw = g.rotation.y;

    if (id === "fighter") {
      wepX = 0.15;
      wepY = 0.35;
      wepZ = -1.15;
    } else if (id === "ranger") {
      wepX = 0.35;
      wepY = 0.55;
      wepZ = 0.12;
    }

    if (animate === "combat") {
      const swing = engine.hero.swing;
      const kind = engine.hero.swingKind;
      const art = kind >= 0;
      const strike = strikeCurve(swing, engine.hero.swingMax, art ? 0.38 : 0.28);
      const aiming = engine.hero.aiming;
      rootY = breath * 0.006 + (aiming ? 0.01 : 0);
      headX = -0.1 + breath * 0.012;
      torsoX = breath * 0.016;
      torsoZ = shift * 0.018;
      clothX += breath * 0.02;
      if (id === "fighter") {
        armRx = aiming ? -0.38 : -0.26;
        armLx = aiming ? 0.22 : 0.12;
        legLx = shift * 0.035;
        legRx = -shift * 0.035;
        if (strike > 0.01) {
          if (kind === 1) {
            armRx = 0.58 - strike * 2.08;
            armLx = 0.48 - strike * 1.88;
            armRy = strike * 0.12;
            wepX = 0.28 + strike * 0.5;
            wepZ = -1.02;
            torsoX = 0.1 + strike * 0.24;
            torsoZ = 0;
            headX = -0.05 - strike * 0.3;
            legLx = strike * 0.24;
            legRx = strike * 0.24;
            rootY = -strike * 0.038;
          } else if (kind === 2) {
            armRx = 0.5 - strike * 2.28;
            armLx = 0.22 + strike * 0.38;
            armRy = -0.12 + strike * 0.42;
            wepX = 0.04;
            wepY = 0.16;
            wepZ = -1.42;
            torsoX = strike * 0.3;
            torsoZ = -strike * 0.08;
            headX = -0.16 - strike * 0.1;
            legRx = -strike * 0.58;
            legLx = strike * 0.3;
            rootY = strike * 0.048;
          } else if (kind === 0) {
            armRx = 0.64 - strike * 2.08;
            armRy = -0.48 + strike * 1.58;
            armRz = -strike * 0.22;
            armLx = 0.18 + strike * 0.48;
            armLy = -strike * 0.32;
            wepX = 0.08;
            wepY = 0.35 + strike * 0.78;
            wepZ = -1.15 - strike * 0.42;
            torsoX = strike * 0.1;
            torsoY = -strike * 0.2;
            torsoZ = -strike * 0.24;
            headY = strike * 0.12;
            headX = -0.12;
            legLx = strike * 0.14;
            legRx = -strike * 0.24;
          } else {
            armRx = 0.4 - strike * 1.62;
            armRy = -0.16 + strike * 0.92;
            armLx = 0.1 + strike * 0.22;
            wepY = 0.35 + strike * 0.38;
            wepZ = -1.15 - strike * 0.2;
            torsoZ = -strike * 0.14;
            torsoY = -strike * 0.08;
            headY = strike * 0.06;
            legRx = -strike * 0.14;
            legLx = strike * 0.08;
          }
        }
      } else if (id === "ranger") {
        armRx = aiming ? -0.58 : -0.46;
        armLx = aiming ? -0.3 : -0.2;
        armLz = aiming ? 0.12 : 0.06;
        headX = -0.08 + (aiming ? -0.04 : 0) + breath * 0.01;
        torsoX = aiming ? -0.06 : breath * 0.012;
        if (strike > 0.01) {
          if (kind === 0) {
            armRx = -0.42 - strike * 0.88;
            armLx = -0.28 - strike * 0.55;
            armLz = 0.1 + strike * 0.08;
            wepX = 0.28 - strike * 0.2;
            torsoX = -0.08 - strike * 0.1;
            headX = -0.14;
            legLx = -strike * 0.08;
            rootY = strike * 0.012;
          } else if (kind === 1) {
            armRx = -0.34 - strike * 0.98;
            armRy = strike * 0.14;
            armLx = -0.22 - strike * 0.42;
            wepX = 0.2 - strike * 0.3;
            torsoX = strike * 0.16;
            headX = -0.06 - strike * 0.08;
            legRx = -strike * 0.3;
            legLx = strike * 0.16;
          } else if (kind === 2) {
            armRx = -0.38 - strike * 0.45;
            armRy = -0.38 + strike * 0.98;
            armLx = -0.18 + strike * 0.12;
            wepY = 0.55 + strike * 0.22;
            torsoY = -0.12 + strike * 0.3;
            torsoZ = strike * 0.08;
            headY = strike * 0.1;
          } else {
            armRx = -0.42 - strike * 0.5;
            armLx = -0.2 - strike * 0.14;
            wepX = 0.32 - strike * 0.16;
            torsoX = -0.04 - strike * 0.06;
            headX = -0.1;
          }
        }
      } else {
        armLx = aiming ? -0.36 : -0.24;
        armRx = aiming ? 0.12 : 0.04;
        torsoX = breath * 0.02;
        if (strike > 0.01) {
          if (kind === 0) {
            armRx = -strike * 1.08;
            armRz = strike * 0.64;
            armLx = -0.15 - strike * 1.28;
            armLz = -strike * 0.58;
            wepX = -strike * 0.48;
            torsoX = -0.12 + strike * 0.3;
            headX = -0.18 - strike * 0.08;
            rootY = strike * 0.028;
          } else if (kind === 2) {
            armLx = -0.08 + strike * 1.18;
            armRx = strike * 0.5;
            wepX = strike * 0.64;
            torsoX = strike * 0.24;
            headX = -0.2;
            rootY = -strike * 0.032;
            legLx = strike * 0.12;
            legRx = strike * 0.12;
          } else if (kind === 1) {
            armRx = -strike * 0.44;
            armLx = -0.22 - strike * 1.48;
            wepX = -strike * 0.64;
            torsoX = -strike * 0.14;
            headX = -0.08 - strike * 0.1;
            legRx = -strike * 0.1;
          } else {
            armRx = 0.04;
            armLx = -0.14 - strike * 1.1;
            wepX = -strike * 0.36;
            torsoX = -strike * 0.08;
            headX = -0.1;
          }
        }
      }
      clothX += strike * 0.28;
    } else {
      rootY = breath * 0.01;
      rootYaw = sway * 0.05;
      armLx = Math.sin(t * 1.02) * 0.05 + 0.04;
      armRx = Math.sin(t * 1.02 + 0.9) * 0.05 + 0.02;
      headX = -0.12 + breath * 0.02;
      headY = sway * 0.07;
      torsoX = breath * 0.02;
      torsoZ = shift * 0.024;
      legLx = shift * 0.028;
      legRx = -shift * 0.028;
      clothX += Math.sin(t * 1.45) * 0.032;
    }

    g.position.y += (rootY - g.position.y) * kSoft;
    g.rotation.y += (rootYaw - g.rotation.y) * kSoft;
    damp(armL, armLx, armLy, armLz, k);
    damp(armR, armRx, armRy, armRz, k);
    damp(legL, legLx, legLy, legLz, k);
    damp(legR, legRx, legRy, legRz, k);
    damp(head, headX, headY, headZ, kSoft);
    damp(torso, torsoX, torsoY, torsoZ, k);
    damp(wep, wepX, wepY, wepZ, k);
    if (torso) {
      const lift = animate === "idle" ? breath * 0.008 : breath * 0.004;
      torso.position.y += (lift - torso.position.y) * kSoft;
    }
    if (cloth) cloth.rotation.x += (clothX - cloth.rotation.x) * kSoft;
  });

  return <primitive ref={root} object={mesh} scale={scale} />;
}
