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

const HALF = 0.7;
const LANE_Y = 0.012;
const MARK_Y = 0.016;
const SEGS = 180;

type Waypoint = { x: number; z: number };

/** Packed trail on the play plane. The only cue is worn dirt and a dull curb. */
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
  const { lane, curb } = useMemo(() => buildLane(points, mapId), [points, mapId]);
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
      {curb ? (
        <mesh geometry={curb} receiveShadow>
          <meshStandardMaterial
            color={mapId === "forge" ? "#3a2c22" : mapId === "aegis" ? "#2a3238" : "#243028"}
            roughness={0.92}
            metalness={0.04}
            emissive="#000000"
            emissiveIntensity={0}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function buildLane(points: Waypoint[], mapId: MapId) {
  if (points.length < 2) return { lane: null as BufferGeometry | null, curb: null as BufferGeometry | null };
  const pts = points.map((w) => new Vector3(w.x, 0, w.z));
  const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.15);
  const frames = sampleFrames(curve);
  const packed = mapId === "forge" ? 0.72 : mapId === "aegis" ? 0.78 : 0.74;
  return {
    lane: strip(frames, [-HALF * 0.9, -HALF * 0.38, 0, HALF * 0.38, HALF * 0.9], LANE_Y, (u, v) => {
      const rut = (v > 0.2 && v < 0.38) || (v > 0.62 && v < 0.8);
      const k = rut ? packed * 0.78 : packed;
      return { u: u * 0.55, v, r: k, g: k, b: k };
    }),
    curb: strip(frames, [-HALF, -HALF * 0.9, HALF * 0.9, HALF], MARK_Y, (u, v) => ({
      u: u * 0.9,
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
