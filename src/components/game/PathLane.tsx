import { useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  RepeatWrapping,
  Vector3,
  type Texture,
} from "three";
import type { MapId } from "@/game/types";

const HALF = 0.62;
const LANE_Y = 0.014;
const MARK_Y = 0.018;
const SEGS = 180;

type Waypoint = { x: number; z: number };

/** Packed trail + a thin shoulder mark. Both sit flush on the play plane. */
export function PathLane({
  points,
  mapId,
  ground,
  mark,
  metalness,
  roughness,
}: {
  points: Waypoint[];
  mapId: MapId;
  ground: Texture;
  mark: string;
  metalness: number;
  roughness: number;
}) {
  const { lane, edge } = useMemo(() => buildLane(points, mapId), [points, mapId]);
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
          color="#d8d4cc"
          roughness={roughness}
          metalness={metalness}
          vertexColors
          emissive={mark}
          emissiveIntensity={0.045}
        />
      </mesh>
      {edge ? (
        <mesh geometry={edge}>
          <meshStandardMaterial
            color={mark}
            emissive={mark}
            emissiveIntensity={0.11}
            roughness={0.72}
            metalness={0.08}
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function buildLane(points: Waypoint[], mapId: MapId) {
  if (points.length < 2) return { lane: null as BufferGeometry | null, edge: null as BufferGeometry | null };
  const pts = points.map((w) => new Vector3(w.x, 0, w.z));
  const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.15);
  const frames = sampleFrames(curve);
  const worn = mapId === "forge" ? 0.78 : mapId === "aegis" ? 0.84 : 0.8;
  const shoulder = mapId === "forge" ? 0.94 : mapId === "aegis" ? 0.97 : 0.93;
  return {
    lane: strip(frames, [-HALF, -HALF * 0.42, 0, HALF * 0.42, HALF], LANE_Y, (u, v) => {
      const rut = v > 0.18 && v < 0.38 || v > 0.62 && v < 0.82;
      const edge = v < 0.08 || v > 0.92;
      const k = rut ? worn * 0.82 : edge ? shoulder : worn;
      return { u: u * 0.62, v, r: k, g: k * (mapId === "mycelion" ? 1.04 : 1), b: k * (mapId === "aegis" ? 1.06 : 0.97) };
    }),
    edge: strip(frames, [-HALF * 0.96, -HALF * 0.88, HALF * 0.88, HALF * 0.96], MARK_Y, (u, v) => ({
      u: u * 1.4,
      v,
      r: 1,
      g: 1,
      b: 1,
    })),
  };
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
      // Skip the gap between the two shoulder pairs (edge strip has 4 verts: L L R R).
      if (cols === 4 && c === 1) continue;
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
