import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Object3D, Quaternion, Vector3, type InstancedMesh, type MeshBasicMaterial } from "three";
import type { MapId } from "@/game/types";

/**
 * The scar of Aegis, in world XZ. Tissue sits on the negative side, steel on
 * the positive. The offset keeps the bright line beside the keep, not through it.
 * Direction is (0.8116, 0.5843); the perpendicular is (-0.5843, 0.8116).
 */
export const SCAR_PX = -0.5843;
export const SCAR_PZ = 0.8116;
export const SCAR_OFFSET = 3.6;

export function scarSigned(x: number, z: number) {
  return x * SCAR_PX + z * SCAR_PZ - SCAR_OFFSET;
}

type Clear = { x: number; z: number };

function blocked(x: number, z: number, keep: Clear[], clear: number, center: number) {
  if (x * x + z * z < center * center) return true;
  const c2 = clear * clear;
  for (let i = 0; i < keep.length; i++) {
    const dx = keep[i].x - x;
    const dz = keep[i].z - z;
    if (dx * dx + dz * dz < c2) return true;
  }
  return false;
}

function inside(x: number, z: number, arenaR: number, squash: number, margin: number) {
  return Math.hypot(x / arenaR, z / (arenaR * squash)) < margin;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Seg = { x: number; z: number; len: number; yaw: number; wide: number };

function chainSegments(points: { x: number; z: number }[], wide: number, maxGap: number): Seg[] {
  const out: Seg[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.2 || len > maxGap) continue;
    out.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len, yaw: Math.atan2(dx, dz), wide });
  }
  return out;
}

const TUBE_UP = new Vector3(0, 1, 0);
const TUBE_DIR = new Vector3();
const TUBE_QUAT = new Quaternion();

function laySegments(mesh: InstancedMesh | null, segs: Seg[], y: number, thickness: number, tube = false) {
  if (!mesh) return;
  const dummy = new Object3D();
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    dummy.position.set(s.x, y, s.z);
    if (tube) {
      TUBE_DIR.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
      TUBE_QUAT.setFromUnitVectors(TUBE_UP, TUBE_DIR);
      dummy.quaternion.copy(TUBE_QUAT);
      dummy.scale.set(s.wide, s.len, s.wide);
    } else {
      dummy.rotation.set(0, s.yaw, 0);
      dummy.scale.set(s.wide, thickness, s.len);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = segs.length;
  mesh.instanceMatrix.needsUpdate = true;
}

/** Mycelion: branching marrow veins and spore bowls in the living ground. */
function MycelionCrust({
  arenaR,
  squash,
  keepClear,
}: {
  arenaR: number;
  squash: number;
  keepClear: Clear[];
}) {
  const veins = useRef<InstancedMesh>(null);
  const bowls = useRef<InstancedMesh>(null);
  const segs = useMemo(() => {
    const out: Seg[] = [];
    for (let v = 0; v < 5; v++) {
      const rand = rng(1100 + v * 97);
      const ang = rand() * Math.PI * 2;
      let x = Math.cos(ang) * arenaR * (0.55 + rand() * 0.28);
      let z = Math.sin(ang) * arenaR * squash * (0.55 + rand() * 0.28);
      let heading = Math.atan2(-z, -x) + (rand() - 0.5) * 1.4;
      const pts: { x: number; z: number }[] = [];
      for (let i = 0; i < 26; i++) {
        heading += (rand() - 0.48) * 0.85;
        x += Math.cos(heading) * 1.45;
        z += Math.sin(heading) * 1.45;
        if (!inside(x, z, arenaR, squash, 0.9)) break;
        if (blocked(x, z, keepClear, 1.7, 3.4)) continue;
        pts.push({ x, z });
      }
      out.push(...chainSegments(pts, 0.95 + rand() * 0.25, 2.3));
    }
    return out;
  }, [arenaR, keepClear, squash]);
  const pools = useMemo(() => {
    const rand = rng(77);
    const out: { x: number; z: number; s: number }[] = [];
    let guard = 0;
    while (out.length < 7 && guard < 80) {
      guard += 1;
      const ang = rand() * Math.PI * 2;
      const rad = (0.22 + rand() * 0.62) * arenaR;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad * squash;
      if (!inside(x, z, arenaR, squash, 0.82)) continue;
      if (blocked(x, z, keepClear, 3.1, 4.6)) continue;
      out.push({ x, z, s: 0.85 + rand() * 0.7 });
    }
    return out;
  }, [arenaR, keepClear, squash]);
  useLayoutEffect(() => {
    laySegments(veins.current, segs, 0.12, 1, true);
    const mesh = bowls.current;
    if (!mesh) return;
    const dummy = new Object3D();
    for (let i = 0; i < pools.length; i++) {
      const p = pools[i];
      dummy.position.set(p.x, 0.02, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(p.s, p.s, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = pools.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [pools, segs]);
  useFrame((s) => {
    const mat = veins.current?.material as MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.42 + Math.sin(s.clock.elapsedTime * 1.3) * 0.1;
  });
  return (
    <group name="mycelion-crust">
      <instancedMesh ref={veins} args={[undefined, undefined, Math.max(1, segs.length)]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 7]} />
        <meshBasicMaterial color="#7cf0c4" transparent opacity={0.5} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bowls} args={[undefined, undefined, Math.max(1, pools.length)]}>
        <ringGeometry args={[0.62, 1, 20]} />
        <meshBasicMaterial color="#3dcaa0" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Kron Forge: foundry plates and slag channels cut across the floor. */
function ForgeCrust({
  arenaR,
  squash,
  keepClear,
}: {
  arenaR: number;
  squash: number;
  keepClear: Clear[];
}) {
  const plates = useRef<InstancedMesh>(null);
  const slag = useRef<InstancedMesh>(null);
  const ember = useRef<InstancedMesh>(null);
  const tiles = useMemo(() => {
    const out: { x: number; z: number; yaw: number }[] = [];
    const step = 3.9;
    for (let x = -arenaR; x <= arenaR; x += step) {
      for (let z = -arenaR * squash; z <= arenaR * squash; z += step) {
        if (!inside(x, z, arenaR, squash, 0.86)) continue;
        if (blocked(x, z, keepClear, 2.35, 4.4)) continue;
        out.push({ x, z, yaw: ((Math.round(x) + Math.round(z)) % 5) * 0.04 });
      }
    }
    return out;
  }, [arenaR, keepClear, squash]);
  const channels = useMemo(() => {
    const dark: Seg[] = [];
    const hot: Seg[] = [];
    for (let c = 0; c < 3; c++) {
      const ang = 0.5 + c * 2.05;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const pts: { x: number; z: number }[] = [];
      for (let t = 5.2; t < arenaR * 0.88; t += 1.55) {
        const x = dx * t;
        const z = dz * t * 0.92;
        if (!inside(x, z, arenaR, squash, 0.9)) break;
        if (blocked(x, z, keepClear, 2.1, 4.2)) continue;
        pts.push({ x, z });
      }
      dark.push(...chainSegments(pts, 0.95, 2.4));
      hot.push(...chainSegments(pts, 0.34, 2.4));
    }
    return { dark, hot };
  }, [arenaR, keepClear, squash]);
  useLayoutEffect(() => {
    const mesh = plates.current;
    if (mesh) {
      const dummy = new Object3D();
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        dummy.position.set(t.x, 0.035, t.z);
        dummy.rotation.set(0, t.yaw, 0);
        dummy.scale.set(2.15, 1, 1.45);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = tiles.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    laySegments(slag.current, channels.dark, 0.028, 1);
    laySegments(ember.current, channels.hot, 0.05, 1);
  }, [channels, tiles]);
  useFrame((s) => {
    const mat = ember.current?.material as MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.55 + Math.sin(s.clock.elapsedTime * 2.2) * 0.2;
  });
  return (
    <group name="forge-crust">
      <instancedMesh ref={plates} args={[undefined, undefined, Math.max(1, tiles.length)]} receiveShadow>
        <boxGeometry args={[1, 0.05, 1]} />
        <meshStandardMaterial color="#2a2622" metalness={0.72} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={slag} args={[undefined, undefined, Math.max(1, channels.dark.length)]}>
        <boxGeometry args={[1, 0.03, 1]} />
        <meshStandardMaterial color="#1a120e" metalness={0.35} roughness={0.86} />
      </instancedMesh>
      <instancedMesh ref={ember} args={[undefined, undefined, Math.max(1, channels.hot.length)]}>
        <boxGeometry args={[1, 0.02, 1]} />
        <meshBasicMaterial color="#e2661c" transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Aegis: living tissue welded to machine along one scar of light. */
function AegisCrust({
  arenaR,
  squash,
  keepClear,
}: {
  arenaR: number;
  squash: number;
  keepClear: Clear[];
}) {
  const scar = useRef<InstancedMesh>(null);
  const weld = useRef<InstancedMesh>(null);
  const flesh = useRef<InstancedMesh>(null);
  const steel = useRef<InstancedMesh>(null);
  const ribbon = useMemo(() => {
    const pts: { x: number; z: number }[] = [];
    const dx = 0.8116;
    const dz = 0.5843;
    for (let t = -arenaR * 1.15; t <= arenaR * 1.15; t += 1.35) {
      const x = SCAR_PX * SCAR_OFFSET + dx * t;
      const z = SCAR_PZ * SCAR_OFFSET + dz * t;
      if (!inside(x, z, arenaR, squash, 0.94)) continue;
      if (x * x + z * z < 2.8 * 2.8) continue;
      pts.push({ x, z });
    }
    return chainSegments(pts, 1.15, 2.2);
  }, [arenaR, squash]);
  const studs = useMemo(() => {
    const rand = rng(303);
    const tissue: { x: number; z: number; s: number }[] = [];
    const plate: { x: number; z: number; yaw: number }[] = [];
    let guard = 0;
    while ((tissue.length < 8 || plate.length < 8) && guard < 120) {
      guard += 1;
      const ang = rand() * Math.PI * 2;
      const rad = (0.28 + rand() * 0.55) * arenaR;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad * squash;
      if (!inside(x, z, arenaR, squash, 0.84)) continue;
      if (blocked(x, z, keepClear, 2.6, 4.4)) continue;
      const side = scarSigned(x, z);
      if (side < -1.6 && tissue.length < 8) tissue.push({ x, z, s: 0.55 + rand() * 0.7 });
      else if (side > 1.6 && plate.length < 8) plate.push({ x, z, yaw: rand() * Math.PI });
    }
    return { tissue, plate };
  }, [arenaR, keepClear, squash]);
  useLayoutEffect(() => {
    laySegments(scar.current, ribbon, 0.008, 1);
    const mesh = weld.current;
    if (mesh) {
      const dummy = new Object3D();
      for (let i = 0; i < ribbon.length; i += 1) {
        const s = ribbon[i];
        const side = i % 2 === 0 ? 1 : -1;
        dummy.position.set(s.x + Math.cos(s.yaw) * 0.72 * side, 0.05, s.z - Math.sin(s.yaw) * 0.72 * side);
        dummy.rotation.set(0, s.yaw, 0);
        dummy.scale.set(0.28, 0.08, 0.28);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = ribbon.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
    const caps = flesh.current;
    if (caps) {
      const dummy = new Object3D();
      for (let i = 0; i < studs.tissue.length; i++) {
        const p = studs.tissue[i];
        dummy.position.set(p.x, p.s * 0.45, p.z);
        dummy.rotation.set(0.15, i, 0.1);
        dummy.scale.set(p.s * 0.35, p.s, p.s * 0.35);
        dummy.updateMatrix();
        caps.setMatrixAt(i, dummy.matrix);
      }
      caps.count = studs.tissue.length;
      caps.instanceMatrix.needsUpdate = true;
    }
    const bars = steel.current;
    if (bars) {
      const dummy = new Object3D();
      for (let i = 0; i < studs.plate.length; i++) {
        const p = studs.plate[i];
        dummy.position.set(p.x, 0.08, p.z);
        dummy.rotation.set(0, p.yaw, 0.2);
        dummy.scale.set(1.1, 0.1, 0.55);
        dummy.updateMatrix();
        bars.setMatrixAt(i, dummy.matrix);
      }
      bars.count = studs.plate.length;
      bars.instanceMatrix.needsUpdate = true;
    }
  }, [ribbon, studs]);
  useFrame((s) => {
    const mat = scar.current?.material as MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.5 + Math.sin(s.clock.elapsedTime * 1.6) * 0.14;
  });
  return (
    <group name="aegis-crust">
      <instancedMesh ref={scar} args={[undefined, undefined, Math.max(1, ribbon.length)]}>
        <boxGeometry args={[1, 0.02, 1]} />
        <meshBasicMaterial color="#d7f4f8" transparent opacity={0.62} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={weld} args={[undefined, undefined, Math.max(1, ribbon.length)]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a949c" metalness={0.8} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={flesh} args={[undefined, undefined, Math.max(1, studs.tissue.length)]}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color="#6d9a78" emissive="#3dcaa0" emissiveIntensity={0.45} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={steel} args={[undefined, undefined, Math.max(1, studs.plate.length)]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3a444c" metalness={0.78} roughness={0.34} />
      </instancedMesh>
    </group>
  );
}

export function PlanetCrust({
  mapId,
  arenaR,
  squash,
  keepClear,
}: {
  mapId: MapId;
  arenaR: number;
  squash: number;
  keepClear: Clear[];
}) {
  if (mapId === "forge") return <ForgeCrust arenaR={arenaR} squash={squash} keepClear={keepClear} />;
  if (mapId === "aegis") return <AegisCrust arenaR={arenaR} squash={squash} keepClear={keepClear} />;
  return <MycelionCrust arenaR={arenaR} squash={squash} keepClear={keepClear} />;
}
