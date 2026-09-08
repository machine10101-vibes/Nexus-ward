import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  Object3D,
  RepeatWrapping,
  Vector3,
  type Texture,
} from "three";
import type { MapId } from "@/game/types";

const HALF = 0.7;
const LANE_Y = 0.01;
const DOT_Y = 0.022;
const SEGS = 180;
const DOT_GAP = 0.4;
const DOT_R = 0.075;

type Waypoint = { x: number; z: number };

const DOT_COLOR: Record<MapId, string> = {
  mycelion: "#c5d6c8",
  forge: "#d2b48a",
  aegis: "#c5d4da",
};

/** Packed trail on the play plane, marked by a dotted centerline. */
export function PathLane({
  points,
  mapId,
  ground,
  metalness,
  roughness,
}: {
  points: Waypoint[];
  mapId: MapId;
  ground: Texture;
  metalness: number;
  roughness: number;
}) {
  const { lane, dots, shoulders } = useMemo(() => buildLane(points, mapId), [points, mapId]);
  const laneMap = useMemo(() => {
    const tex = ground.clone();
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.needsUpdate = true;
    return tex;
  }, [ground]);

  if (!lane) return null;
  return (
    <group>
      <mesh geometry={lane} receiveShadow>
        <meshStandardMaterial
          map={laneMap}
          color={mapId === "forge" ? "#8a6a4e" : mapId === "aegis" ? "#6e7880" : "#4f5c50"}
          roughness={roughness}
          metalness={metalness}
          vertexColors
          emissive="#000000"
          emissiveIntensity={0}
        />
      </mesh>
      <PathDots points={dots} color={DOT_COLOR[mapId]} />
      <PathShoulders points={shoulders} mapId={mapId} />
    </group>
  );
}

function PathDots({ points, color }: { points: Vector3[]; color: string }) {
  const mesh = useRef<InstancedMesh>(null);
  const tint = useMemo(() => new Color(color), [color]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D();
    for (let i = 0; i < points.length; i++) {
      dummy.position.copy(points[i]);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.count = points.length;
  }, [points]);
  if (!points.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, points.length]}>
      <circleGeometry args={[DOT_R, 10]} />
      <meshBasicMaterial color={tint} toneMapped={false} />
    </instancedMesh>
  );
}

function buildLane(points: Waypoint[], mapId: MapId) {
  if (points.length < 2) return { lane: null as BufferGeometry | null, dots: [] as Vector3[], shoulders: [] as Vector3[] };
  const pts = points.map((w) => new Vector3(w.x, 0, w.z));
  const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.15);
  const frames = sampleFrames(curve);
  const packed = mapId === "forge" ? 0.72 : mapId === "aegis" ? 0.78 : 0.74;
  const len = frames[frames.length - 1]?.u ?? 0;
  const n = Math.max(2, Math.floor(len / DOT_GAP));
  const dots: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const p = curve.getPointAt((i + 0.5) / n);
    dots.push(new Vector3(p.x, DOT_Y, p.z));
  }
  const shoulders: Vector3[] = [];
  const step = Math.max(2, Math.floor(frames.length / 28));
  for (let i = 2; i < frames.length - 2; i += step) {
    const f = frames[i];
    shoulders.push(new Vector3(f.p.x + f.side.x * (HALF + 0.12), 0.03, f.p.z + f.side.z * (HALF + 0.12)));
    shoulders.push(new Vector3(f.p.x - f.side.x * (HALF + 0.12), 0.03, f.p.z - f.side.z * (HALF + 0.12)));
  }
  return {
    lane: strip(frames, [-HALF, -HALF * 0.42, 0, HALF * 0.42, HALF], LANE_Y, (u, v) => {
      const rut = (v > 0.2 && v < 0.38) || (v > 0.62 && v < 0.8);
      const k = rut ? packed * 0.78 : packed;
      return { u: u * 0.55, v, r: k, g: k, b: k };
    }),
    dots,
    shoulders,
  };
}

function PathShoulders({ points, mapId }: { points: Vector3[]; mapId: MapId }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D();
    for (let i = 0; i < points.length; i++) {
      dummy.position.copy(points[i]);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(0.7 + (i % 3) * 0.18, 0.55 + (i % 2) * 0.2, 0.55);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.count = points.length;
  }, [points]);
  if (!points.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, points.length]}>
      <dodecahedronGeometry args={[0.07, 0]} />
      <meshStandardMaterial
        color={mapId === "forge" ? "#4a3a2c" : mapId === "aegis" ? "#3a444c" : "#2c3830"}
        roughness={0.88}
        metalness={0.08}
      />
    </instancedMesh>
  );
}

function sampleFrames(curve: CatmullRomCurve3) {
  const frames: { p: Vector3; side: Vector3; u: number }[] = [];
  let run = 0;
  let prev: Vector3 | null = null;
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const side = new Vector3(-tan.z, 0, tan.x);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    else side.normalize();
    if (prev) run += p.distanceTo(prev);
    prev = p;
    frames.push({ p, side, u: run });
  }
  return frames;
}

function strip(
  frames: { p: Vector3; side: Vector3; u: number }[],
  offsets: number[],
  y: number,
  shade: (u: number, v: number) => { u: number; v: number; r: number; g: number; b: number },
) {
  const cols = offsets.length;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const vSpan = offsets[cols - 1] - offsets[0] || 1;
  for (const f of frames) {
    for (let c = 0; c < cols; c++) {
      const ox = offsets[c];
      pos.push(f.p.x + f.side.x * ox, y, f.p.z + f.side.z * ox);
      nrm.push(0, 1, 0);
      const v = (ox - offsets[0]) / vSpan;
      const s = shade(f.u, v);
      uv.push(s.u, s.v);
      col.push(s.r, s.g, s.b);
    }
  }
  for (let i = 0; i < frames.length - 1; i++) {
    const a = i * cols;
    const b = (i + 1) * cols;
    for (let c = 0; c < cols - 1; c++) {
      idx.push(a + c, b + c, a + c + 1, b + c, b + c + 1, a + c + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  return g;
}
