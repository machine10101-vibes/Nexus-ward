import type { Cell, EnemyId, MapDef, MapId, WaveDef, WaveGroup } from "./types";
import { CELL } from "./config";

function stitch(points: [number, number][]): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [c1, r1] = points[i];
    const [c2, r2] = points[i + 1];
    const dc = Math.sign(c2 - c1);
    const dr = Math.sign(r2 - r1);
    let c = c1;
    let r = r1;
    while (c !== c2 || r !== r2) {
      out.push({ c, r });
      if (c !== c2) c += dc;
      else r += dr;
    }
  }
  const last = points[points.length - 1];
  out.push({ c: last[0], r: last[1] });
  return out;
}

function padsFromPath(path: Cell[], cols: number, rows: number, count: number): Cell[] {
  const pathSet = new Set(path.map((p) => `${p.c},${p.r}`));
  const candidates: Cell[] = [];
  const seen = new Set<string>();
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const p of path) {
    for (const [dc, dr] of dirs) {
      const c = p.c + dc;
      const r = p.r + dr;
      if (c < 1 || r < 1 || c >= cols - 1 || r >= rows - 1) continue;
      const k = `${c},${r}`;
      if (pathSet.has(k) || seen.has(k)) continue;
      seen.add(k);
      candidates.push({ c, r });
    }
  }
  if (candidates.length <= count) return candidates;
  const step = candidates.length / count;
  const pads: Cell[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const pick = candidates[Math.min(candidates.length - 1, Math.floor(i * step))];
    const k = `${pick.c},${pick.r}`;
    if (used.has(k)) continue;
    used.add(k);
    pads.push(pick);
  }
  return pads;
}

export function cellToWorld(c: number, r: number, cols: number, rows: number) {
  return {
    x: (c - (cols - 1) / 2) * CELL,
    z: (r - (rows - 1) / 2) * CELL,
  };
}

/** Odd counts so the heart cell sits on the world origin. */
export const FIELD_COLS = 25;
export const FIELD_ROWS = 23;
export const ROUTE_COUNT = 4;

type Side = "w" | "e" | "n" | "s";
type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function heartCell(cols: number, rows: number): Cell {
  return { c: (cols - 1) / 2, r: (rows - 1) / 2 };
}

function entryFor(side: Side, heart: Cell): Cell {
  if (side === "w") return { c: heart.c - 1, r: heart.r };
  if (side === "e") return { c: heart.c + 1, r: heart.r };
  if (side === "n") return { c: heart.c, r: heart.r - 1 };
  return { c: heart.c, r: heart.r + 1 };
}

function startFor(side: Side, cols: number, rows: number, rng: Rng): Cell {
  if (side === "w" || side === "e") {
    return { c: side === "w" ? 0 : cols - 1, r: 3 + Math.floor(rng() * (rows - 6)) };
  }
  return { c: 3 + Math.floor(rng() * (cols - 6)), r: side === "n" ? 0 : rows - 1 };
}

function shuffleSides(rng: Rng): Side[] {
  const sides: Side[] = ["w", "e", "n", "s"];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = sides[i];
    sides[i] = sides[j];
    sides[j] = swap;
  }
  return sides;
}

/** Keep a bend off the keep so a lane cannot walk through the heart and back out. */
function pullOut(c: number, r: number, heart: Cell, min: number, cols: number, rows: number): [number, number] {
  const cc = clamp(Math.round(c), 1, cols - 2);
  const rr = clamp(Math.round(r), 1, rows - 2);
  const dc = cc - heart.c;
  const dr = rr - heart.r;
  const cheb = Math.max(Math.abs(dc), Math.abs(dr));
  if (cheb >= min) return [cc, rr];
  if (dc === 0 && dr === 0) return [clamp(heart.c + min, 1, cols - 2), heart.r];
  const scale = min / Math.max(1, cheb);
  return [clamp(Math.round(heart.c + dc * scale), 1, cols - 2), clamp(Math.round(heart.r + dr * scale), 1, rows - 2)];
}

function hasLoop(path: Cell[]) {
  const seen = new Set<string>();
  for (const p of path) {
    const k = `${p.c},${p.r}`;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

function wobbleFor(id: MapId) {
  if (id === "forge") return 2.6;
  if (id === "aegis") return 4.2;
  return 5.4;
}

/**
 * Rim start, a run along that edge, then inward cuts with a sideways jog.
 * Every route finishes on its own side of the heart, then the heart itself.
 */
function meander(start: Cell, entry: Cell, heart: Cell, cols: number, rows: number, rng: Rng, wobble: number): Cell[] {
  const points: [number, number][] = [[start.c, start.r]];
  const alongC = start.r === 0 || start.r === rows - 1 ? 1 : 0;
  const alongR = alongC === 0 ? 1 : 0;
  const sign = rng() < 0.5 ? -1 : 1;
  const run = 6 + Math.floor(rng() * 5);
  let c = start.c;
  let r = start.r;
  for (let i = 0; i < run; i++) {
    const nc = c + alongC * sign;
    const nr = r + alongR * sign;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) break;
    c = nc;
    r = nr;
  }
  points.push([c, r]);
  const rings = [0.7, 0.46, 0.28];
  for (const t of rings) {
    const inwardC = heart.c + (c - heart.c) * t;
    const inwardR = heart.r + (r - heart.r) * t;
    const dx = inwardC - heart.c;
    const dy = inwardR - heart.r;
    const len = Math.hypot(dx, dy) || 1;
    const mag = (rng() * 2 - 1) * wobble * (0.85 + rng() * 0.5);
    const jog = pullOut(inwardC + (-dy / len) * mag, inwardR + (dx / len) * mag, heart, 3, cols, rows);
    points.push(jog);
    c = jog[0];
    r = jog[1];
  }
  points.push([entry.c, entry.r], [heart.c, heart.r]);
  const cleaned: [number, number][] = [];
  for (const p of points) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
    cleaned.push(p);
  }
  return stitch(cleaned);
}

function fallbackRoute(start: Cell, entry: Cell, heart: Cell, cols: number, rows: number): Cell[] {
  const mid = pullOut((start.c + entry.c) / 2 + 5, (start.r + entry.r) / 2 - 4, heart, 4, cols, rows);
  const mid2 = pullOut((mid[0] + entry.c) / 2 - 4, (mid[1] + entry.r) / 2 + 5, heart, 3, cols, rows);
  return stitch([
    [start.c, start.r],
    mid,
    mid2,
    [entry.c, entry.r],
    [heart.c, heart.r],
  ]);
}

export type FieldLayout = { paths: Cell[][]; pads: Cell[]; seed: number };

/** Four lanes from the rim to the keep. The same seed rebuilds the same field. */
export function rollField(cols: number, rows: number, seed: number, id: MapId): FieldLayout {
  const rng = mulberry32(seed);
  const heart = heartCell(cols, rows);
  const wobble = wobbleFor(id);
  const paths: Cell[][] = [];
  for (const side of shuffleSides(rng)) {
    const start = startFor(side, cols, rows, rng);
    const entry = entryFor(side, heart);
    let path = meander(start, entry, heart, cols, rows, rng, wobble);
    let tries = 0;
    while ((hasLoop(path) || path.length < 28 || path[path.length - 1].c !== heart.c) && tries < 8) {
      path = meander(start, entry, heart, cols, rows, rng, wobble * (0.7 + tries * 0.08));
      tries += 1;
    }
    if (hasLoop(path) || path.length < 28) path = fallbackRoute(start, entry, heart, cols, rows);
    paths.push(path);
  }
  let pads = padsFromPath(unionCells(...paths), cols, rows, 36).filter(
    (p) => Math.max(Math.abs(p.c - heart.c), Math.abs(p.r - heart.r)) > 2,
  );
  if (pads.length < 22) {
    pads = padsFromPath(unionCells(...paths), cols, rows, 36).filter(
      (p) => Math.max(Math.abs(p.c - heart.c), Math.abs(p.r - heart.r)) > 1,
    );
  }
  return { paths, pads, seed };
}

const PREVIEWS: Record<MapId, FieldLayout> = {
  mycelion: rollField(FIELD_COLS, FIELD_ROWS, 101, "mycelion"),
  forge: rollField(FIELD_COLS, FIELD_ROWS, 202, "forge"),
  aegis: rollField(FIELD_COLS, FIELD_ROWS, 303, "aegis"),
};

export function unionCells(...paths: Cell[][]): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const path of paths) {
    for (const p of path) {
      const k = `${p.c},${p.r}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

export const MAPS: Record<MapId, MapDef> = {
  mycelion: {
    id: "mycelion",
    name: "Mycelion",
    subtitle: "Organic world",
    faction: "organic",
    lore: "A living planet of fungal canyons and bioluminescent marrow. The swarm is not an invasion so much as the lattice reclaiming a core we planted in its heart.",
    hint: "Ground packs hit first. Bring a lance before spores take the air. Incursion 4 holds husks until the spores are committed. Incursion 5 holds spores until the ground pack is out. Incursion 8 holds husks until that pack is out. Incursion 9 holds spores until the ground pack is out. Incursion 12 holds blooms and spores until the ground line is out. After the Titan, Myrmidons, Thorns, and Blooms keep coming. The keep sits in the center. Four lanes roll in from the rim each drop-in. New gates open on incursions 6, 11, and 16. Frost melts mites; rails crack husks and Myrmidons. Flak slows a spore flock. Bore cracks a ground line and ignores the sky. A pylon slows a ground patch.",
    cols: FIELD_COLS,
    rows: FIELD_ROWS,
    path: PREVIEWS.mycelion.paths[0],
    branches: PREVIEWS.mycelion.paths.slice(1),
    pads: PREVIEWS.mycelion.pads,
    startGold: 220,
    lives: 20,
    waves: [
      { groups: [{ enemy: "mite", count: 10, interval: 0.52, delay: 0 }] },
      { groups: [{ enemy: "mite", count: 16, interval: 0.38, delay: 0 }] },
      {
        groups: [
          { enemy: "mite", count: 10, interval: 0.38, delay: 0 },
          { enemy: "brood", count: 6, interval: 0.75, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "spore", count: 8, interval: 0.55, delay: 0 },
          { enemy: "mite", count: 10, interval: 0.38, delay: 0.4 },
          { enemy: "brood", count: 5, interval: 0.7, delay: 1.4 },
          { enemy: "husk", count: 2, interval: 1.1, delay: 5.8 },
        ],
      },
      {
        groups: [
          { enemy: "brood", count: 10, interval: 0.5, delay: 0 },
          { enemy: "husk", count: 3, interval: 1.4, delay: 1.6 },
          { enemy: "mite", count: 8, interval: 0.36, delay: 0.8 },
          { enemy: "spore", count: 3, interval: 0.5, delay: 7.8 },
        ],
      },
      {
        groups: [
          { enemy: "spore", count: 8, interval: 0.48, delay: 0 },
          { enemy: "mite", count: 10, interval: 0.36, delay: 0.6 },
          { enemy: "husk", count: 5, interval: 1.2, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "husk", count: 6, interval: 1.05, delay: 0 },
          { enemy: "marrow", count: 2, interval: 1.3, delay: 0.5 },
          { enemy: "brood", count: 8, interval: 0.45, delay: 0.8 },
        ],
      },
      {
        groups: [
          { enemy: "brood", count: 12, interval: 0.42, delay: 0 },
          { enemy: "spore", count: 8, interval: 0.5, delay: 0.8 },
          { enemy: "husk", count: 6, interval: 1.1, delay: 6.1 },
        ],
      },
      {
        groups: [
          { enemy: "husk", count: 8, interval: 0.85, delay: 0 },
          { enemy: "brood", count: 10, interval: 0.38, delay: 1.2 },
          { enemy: "spore", count: 8, interval: 0.45, delay: 9 },
        ],
      },
      {
        groups: [
          { enemy: "titan", count: 1, interval: 1, delay: 0 },
          { enemy: "brood", count: 10, interval: 0.48, delay: 2.6 },
          { enemy: "spore", count: 8, interval: 0.42, delay: 3.4 },
        ],
      },
      {
        groups: [
          { enemy: "myrmidon", count: 5, interval: 1.05, delay: 0 },
          { enemy: "thorn", count: 4, interval: 1.1, delay: 0.6 },
          { enemy: "mite", count: 14, interval: 0.32, delay: 0.5 },
          { enemy: "husk", count: 4, interval: 1.1, delay: 1.4 },
          { enemy: "brood", count: 8, interval: 0.4, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "bloom", count: 10, interval: 0.48, delay: 10.9 },
          { enemy: "shade", count: 3, interval: 0.7, delay: 0.6 },
          { enemy: "mite", count: 12, interval: 0.34, delay: 0.4 },
          { enemy: "myrmidon", count: 8, interval: 0.85, delay: 1 },
          { enemy: "spore", count: 8, interval: 0.42, delay: 10.9 },
        ],
      },
      {
        groups: [
          { enemy: "myrmidon", count: 8, interval: 0.82, delay: 0 },
          { enemy: "thorn", count: 6, interval: 0.9, delay: 0.5 },
          { enemy: "nidus", count: 2, interval: 1.6, delay: 1.2 },
          { enemy: "brood", count: 10, interval: 0.4, delay: 0.8 },
          { enemy: "bloom", count: 10, interval: 0.42, delay: 1.1 },
        ],
      },
      {
        groups: [
          { enemy: "bloom", count: 10, interval: 0.42, delay: 0 },
          { enemy: "husk", count: 6, interval: 1.05, delay: 1 },
          { enemy: "myrmidon", count: 7, interval: 0.95, delay: 1.4 },
        ],
      },
      {
        groups: [
          { enemy: "titan", count: 1, interval: 1, delay: 0 },
          { enemy: "myrmidon", count: 5, interval: 0.9, delay: 2 },
          { enemy: "bloom", count: 8, interval: 0.42, delay: 2.8 },
        ],
      },
      {
        groups: [
          { enemy: "myrmidon", count: 10, interval: 0.72, delay: 0 },
          { enemy: "thorn", count: 8, interval: 0.72, delay: 1.1 },
          { enemy: "shade", count: 2, interval: 0.75, delay: 0.5 },
          { enemy: "spore", count: 10, interval: 0.4, delay: 0.8 },
          { enemy: "bloom", count: 8, interval: 0.42, delay: 1.2 },
          { enemy: "husk", count: 6, interval: 0.9, delay: 1.5 },
        ],
      },
      {
        groups: [
          { enemy: "bloom", count: 12, interval: 0.38, delay: 0 },
          { enemy: "brood", count: 14, interval: 0.32, delay: 0.6 },
          { enemy: "marrow", count: 2, interval: 1.2, delay: 0.4 },
          { enemy: "myrmidon", count: 10, interval: 0.68, delay: 0.9 },
          { enemy: "husk", count: 4, interval: 0.9, delay: 1.3 },
        ],
      },
      {
        groups: [
          { enemy: "titan", count: 2, interval: 2.2, delay: 0 },
          { enemy: "myrmidon", count: 6, interval: 0.75, delay: 1.8 },
          { enemy: "bloom", count: 8, interval: 0.4, delay: 2.6 },
        ],
      },
      {
        groups: [
          { enemy: "titan", count: 1, interval: 1, delay: 0 },
          { enemy: "husk", count: 8, interval: 0.7, delay: 1.2 },
          { enemy: "myrmidon", count: 8, interval: 0.65, delay: 1.6 },
          { enemy: "bloom", count: 10, interval: 0.38, delay: 2 },
          { enemy: "brood", count: 10, interval: 0.34, delay: 2.4 },
        ],
      },
      {
        groups: [
          { enemy: "colossus", count: 1, interval: 1, delay: 0 },
          { enemy: "titan", count: 1, interval: 1, delay: 3.6 },
          { enemy: "myrmidon", count: 8, interval: 0.65, delay: 2.6 },
          { enemy: "bloom", count: 10, interval: 0.36, delay: 4 },
        ],
      },
    ],
  },
  forge: {
    id: "forge",
    name: "Kron Forge",
    subtitle: "Mechanical world",
    faction: "mech",
    lore: "An industrial planet that smelts warships for the outer fleets. The foundry AIs have recast the nexus as raw stock — and dispatched the line to reclaim it.",
    hint: "Armor is thick. Rails and tesla cut steel. Watch the gunships. Incursion 4 holds siege armor until the sky is committed. Incursion 5 holds gunships until the ground pack is out. Incursion 8 holds siege armor until that pack is out. Incursion 9 holds gunships until the ground pack is out. Incursion 12 holds razors until the ground line is out. Late waves bring Bulwarks, Sentries, and Razors. The keep sits in the center. Four lanes roll in from the rim each drop-in. New gates open on incursions 6, 11, and 16. Walkers shrug frost; tesla shreds drones and Razors. Flak opens Razors and Skiffs. Bore bores Walkers. A pylon slows a ground patch.",
    cols: FIELD_COLS,
    rows: FIELD_ROWS,
    path: PREVIEWS.forge.paths[0],
    branches: PREVIEWS.forge.paths.slice(1),
    pads: PREVIEWS.forge.pads,
    startGold: 240,
    lives: 18,
    waves: [
      { groups: [{ enemy: "drone", count: 8, interval: 0.65, delay: 0 }] },
      { groups: [{ enemy: "drone", count: 13, interval: 0.45, delay: 0 }] },
      {
        groups: [
          { enemy: "drone", count: 8, interval: 0.42, delay: 0 },
          { enemy: "walker", count: 4, interval: 0.95, delay: 0.9 },
        ],
      },
      {
        groups: [
          { enemy: "gunship", count: 8, interval: 0.55, delay: 0 },
          { enemy: "drone", count: 8, interval: 0.36, delay: 0.4 },
          { enemy: "walker", count: 3, interval: 0.95, delay: 1.2 },
          { enemy: "siege", count: 2, interval: 1.2, delay: 5.4 },
        ],
      },
      {
        groups: [
          { enemy: "walker", count: 8, interval: 0.65, delay: 0 },
          { enemy: "siege", count: 3, interval: 1.5, delay: 1.6 },
          { enemy: "drone", count: 8, interval: 0.34, delay: 0.6 },
          { enemy: "gunship", count: 3, interval: 0.55, delay: 8 },
        ],
      },
      {
        groups: [
          { enemy: "gunship", count: 8, interval: 0.45, delay: 0 },
          { enemy: "drone", count: 10, interval: 0.32, delay: 0.5 },
          { enemy: "howler", count: 3, interval: 0.85, delay: 0.7 },
          { enemy: "walker", count: 4, interval: 0.85, delay: 1.2 },
          { enemy: "siege", count: 5, interval: 1.1, delay: 1.4 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 6, interval: 1.05, delay: 0 },
          { enemy: "skiff", count: 4, interval: 0.7, delay: 0.4 },
          { enemy: "bastion", count: 2, interval: 1.5, delay: 1.1 },
          { enemy: "walker", count: 6, interval: 0.55, delay: 0.8 },
        ],
      },
      {
        groups: [
          { enemy: "walker", count: 10, interval: 0.45, delay: 0 },
          { enemy: "gunship", count: 8, interval: 0.45, delay: 0.8 },
          { enemy: "siege", count: 5, interval: 1.05, delay: 5.6 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 6, interval: 0.9, delay: 0 },
          { enemy: "walker", count: 8, interval: 0.42, delay: 1.2 },
          { enemy: "gunship", count: 8, interval: 0.42, delay: 7.7 },
        ],
      },
      {
        groups: [
          { enemy: "dread", count: 1, interval: 1, delay: 0 },
          { enemy: "walker", count: 10, interval: 0.45, delay: 2.6 },
          { enemy: "gunship", count: 8, interval: 0.38, delay: 3.4 },
        ],
      },
      {
        groups: [
          { enemy: "bulwark", count: 5, interval: 1.1, delay: 0 },
          { enemy: "sentry", count: 4, interval: 1.15, delay: 0.6 },
          { enemy: "howler", count: 2, interval: 0.85, delay: 0.5 },
          { enemy: "drone", count: 12, interval: 0.32, delay: 0.4 },
          { enemy: "walker", count: 6, interval: 0.5, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "razor", count: 10, interval: 0.48, delay: 11.6 },
          { enemy: "cinder", count: 3, interval: 0.7, delay: 0.35 },
          { enemy: "drone", count: 10, interval: 0.32, delay: 0.4 },
          { enemy: "walker", count: 4, interval: 0.55, delay: 1 },
          { enemy: "bulwark", count: 8, interval: 0.9, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "bulwark", count: 8, interval: 0.95, delay: 0 },
          { enemy: "sentry", count: 6, interval: 0.95, delay: 0.5 },
          { enemy: "walker", count: 8, interval: 0.45, delay: 0.8 },
          { enemy: "razor", count: 8, interval: 0.45, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "razor", count: 10, interval: 0.42, delay: 0 },
          { enemy: "skiff", count: 2, interval: 0.65, delay: 0.3 },
          { enemy: "siege", count: 5, interval: 1.05, delay: 1 },
          { enemy: "walker", count: 6, interval: 0.45, delay: 1.3 },
          { enemy: "bulwark", count: 8, interval: 0.85, delay: 1.5 },
        ],
      },
      {
        groups: [
          { enemy: "dread", count: 1, interval: 1, delay: 0 },
          { enemy: "bulwark", count: 4, interval: 1, delay: 2 },
          { enemy: "razor", count: 8, interval: 0.42, delay: 2.8 },
        ],
      },
      {
        groups: [
          { enemy: "bulwark", count: 12, interval: 0.7, delay: 0 },
          { enemy: "sentry", count: 8, interval: 0.75, delay: 1.1 },
          { enemy: "gunship", count: 8, interval: 0.4, delay: 0.8 },
          { enemy: "razor", count: 8, interval: 0.4, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "razor", count: 12, interval: 0.36, delay: 0 },
          { enemy: "drone", count: 12, interval: 0.3, delay: 0.5 },
          { enemy: "walker", count: 8, interval: 0.4, delay: 1 },
          { enemy: "siege", count: 6, interval: 0.9, delay: 1.3 },
          { enemy: "bulwark", count: 8, interval: 0.7, delay: 1.6 },
        ],
      },
      {
        groups: [
          { enemy: "dread", count: 2, interval: 2.3, delay: 0 },
          { enemy: "bulwark", count: 6, interval: 0.8, delay: 1.8 },
          { enemy: "razor", count: 8, interval: 0.4, delay: 2.6 },
        ],
      },
      {
        groups: [
          { enemy: "dread", count: 1, interval: 1, delay: 0 },
          { enemy: "siege", count: 8, interval: 0.75, delay: 1.2 },
          { enemy: "bulwark", count: 8, interval: 0.7, delay: 1.6 },
          { enemy: "razor", count: 10, interval: 0.38, delay: 2 },
          { enemy: "walker", count: 8, interval: 0.4, delay: 2.4 },
        ],
      },
      {
        groups: [
          { enemy: "leviathan", count: 1, interval: 1, delay: 0 },
          { enemy: "dread", count: 1, interval: 1, delay: 3.6 },
          { enemy: "bulwark", count: 8, interval: 0.65, delay: 2.6 },
          { enemy: "razor", count: 10, interval: 0.36, delay: 4 },
        ],
      },
    ],
  },
  aegis: {
    id: "aegis",
    name: "Aegis Rift",
    subtitle: "Hybrid world",
    faction: "hybrid",
    lore: "A collision world — living tissue welded to machine along a scar of light. Nothing here agrees what it is. Everything agrees the core must fall.",
    hint: "Both kingdoms come at once. Mix slow control with air cover. Incursion 3 holds wraiths until the ground pack is out. Incursion 4 holds husks until the sky is committed. Incursion 8 holds siege armor until that pack is out. Incursion 9 holds wraiths until the ground pack is out. Incursion 12 holds specters and wraiths until the ground line is out. The second half fuses Amalgams, Relics, and Specters. The keep sits in the center. Four lanes roll in from the rim each drop-in. New gates open on incursions 6, 11, and 16. Each hybrid resists one plate and folds to another — mix the line. Flak holds Wraiths. Bore answers ground plate. A pylon slows a ground patch.",
    cols: FIELD_COLS,
    rows: FIELD_ROWS,
    path: PREVIEWS.aegis.paths[0],
    branches: PREVIEWS.aegis.paths.slice(1),
    pads: PREVIEWS.aegis.pads,
    startGold: 260,
    lives: 16,
    waves: [
      {
        groups: [
          { enemy: "mite", count: 6, interval: 0.6, delay: 0 },
          { enemy: "drone", count: 6, interval: 0.6, delay: 0.3 },
        ],
      },
      {
        groups: [
          { enemy: "chimera", count: 8, interval: 0.65, delay: 0 },
          { enemy: "mite", count: 6, interval: 0.4, delay: 0.5 },
          { enemy: "drone", count: 4, interval: 0.4, delay: 0.8 },
        ],
      },
      {
        groups: [
          { enemy: "brood", count: 6, interval: 0.5, delay: 0 },
          { enemy: "walker", count: 5, interval: 0.75, delay: 0.6 },
          { enemy: "chimera", count: 4, interval: 0.6, delay: 1 },
          { enemy: "wraith", count: 3, interval: 0.5, delay: 4.8 },
        ],
      },
      {
        groups: [
          { enemy: "spore", count: 6, interval: 0.5, delay: 0 },
          { enemy: "wraith", count: 6, interval: 0.5, delay: 0.3 },
          { enemy: "chimera", count: 6, interval: 0.5, delay: 0.8 },
          { enemy: "husk", count: 2, interval: 1.1, delay: 5.2 },
        ],
      },
      {
        groups: [
          { enemy: "chimera", count: 8, interval: 0.5, delay: 0 },
          { enemy: "gnaw", count: 2, interval: 0.9, delay: 0.4 },
          { enemy: "husk", count: 3, interval: 1.3, delay: 1.2 },
          { enemy: "walker", count: 4, interval: 0.7, delay: 0.8 },
        ],
      },
      {
        groups: [
          { enemy: "wraith", count: 8, interval: 0.42, delay: 0 },
          { enemy: "herald", count: 2, interval: 1.2, delay: 0.6 },
          { enemy: "gunship", count: 6, interval: 0.45, delay: 0.8 },
          { enemy: "drone", count: 8, interval: 0.32, delay: 0.4 },
          { enemy: "chimera", count: 4, interval: 0.5, delay: 1.2 },
          { enemy: "husk", count: 4, interval: 1.1, delay: 1.4 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 4, interval: 1.05, delay: 0 },
          { enemy: "howler", count: 2, interval: 0.9, delay: 0.5 },
          { enemy: "husk", count: 4, interval: 1.05, delay: 0.4 },
          { enemy: "chimera", count: 6, interval: 0.45, delay: 0.8 },
        ],
      },
      {
        groups: [
          { enemy: "chimera", count: 10, interval: 0.42, delay: 0 },
          { enemy: "wraith", count: 8, interval: 0.42, delay: 0.8 },
          { enemy: "husk", count: 3, interval: 1.1, delay: 1.2 },
          { enemy: "siege", count: 4, interval: 1.05, delay: 7 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 4, interval: 0.85, delay: 0 },
          { enemy: "husk", count: 4, interval: 0.85, delay: 0.3 },
          { enemy: "wraith", count: 8, interval: 0.38, delay: 5.9 },
          { enemy: "chimera", count: 8, interval: 0.38, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "overlord", count: 1, interval: 1, delay: 0 },
          { enemy: "chimera", count: 10, interval: 0.42, delay: 2.6 },
          { enemy: "wraith", count: 8, interval: 0.38, delay: 3.4 },
          { enemy: "gunship", count: 6, interval: 0.42, delay: 4.2 },
        ],
      },
      {
        groups: [
          { enemy: "amalgam", count: 24, interval: 0.55, delay: 0 },
          { enemy: "relic", count: 6, interval: 0.7, delay: 0.4 },
          { enemy: "nidus", count: 2, interval: 1.5, delay: 0.8 },
          { enemy: "skiff", count: 3, interval: 0.65, delay: 0.5 },
          { enemy: "bastion", count: 2, interval: 1.4, delay: 1.2 },
          { enemy: "chimera", count: 12, interval: 0.38, delay: 0.5 },
          { enemy: "husk", count: 8, interval: 0.9, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "specter", count: 16, interval: 0.42, delay: 17.6 },
          { enemy: "wraith", count: 6, interval: 0.42, delay: 17.6 },
          { enemy: "gnaw", count: 2, interval: 0.8, delay: 0.5 },
          { enemy: "chimera", count: 10, interval: 0.4, delay: 0.7 },
          { enemy: "amalgam", count: 26, interval: 0.55, delay: 1.1 },
        ],
      },
      {
        groups: [
          { enemy: "amalgam", count: 21, interval: 0.6, delay: 0 },
          { enemy: "relic", count: 8, interval: 0.65, delay: 0.5 },
          { enemy: "herald", count: 2, interval: 1.1, delay: 0.6 },
          { enemy: "siege", count: 4, interval: 1.05, delay: 0.7 },
          { enemy: "husk", count: 4, interval: 1.05, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "specter", count: 10, interval: 0.38, delay: 0 },
          { enemy: "gunship", count: 6, interval: 0.42, delay: 0.8 },
          { enemy: "amalgam", count: 27, interval: 0.5, delay: 1 },
          { enemy: "husk", count: 4, interval: 1, delay: 1.4 },
        ],
      },
      {
        groups: [
          { enemy: "overlord", count: 1, interval: 1, delay: 0 },
          { enemy: "amalgam", count: 6, interval: 0.6, delay: 2 },
          { enemy: "specter", count: 8, interval: 0.4, delay: 2.6 },
        ],
      },
      {
        groups: [
          { enemy: "amalgam", count: 29, interval: 0.45, delay: 0 },
          { enemy: "relic", count: 8, interval: 0.55, delay: 0.8 },
          { enemy: "wraith", count: 8, interval: 0.38, delay: 0.6 },
          { enemy: "walker", count: 6, interval: 0.45, delay: 1 },
          { enemy: "specter", count: 6, interval: 0.4, delay: 1.2 },
          { enemy: "husk", count: 4, interval: 0.95, delay: 1.5 },
        ],
      },
      {
        groups: [
          { enemy: "specter", count: 12, interval: 0.36, delay: 0 },
          { enemy: "chimera", count: 10, interval: 0.38, delay: 0.5 },
          { enemy: "drone", count: 3, interval: 0.3, delay: 0.8 },
          { enemy: "amalgam", count: 29, interval: 0.48, delay: 1 },
          { enemy: "husk", count: 4, interval: 0.95, delay: 1.4 },
        ],
      },
      {
        groups: [
          { enemy: "overlord", count: 1, interval: 1, delay: 0 },
          { enemy: "amalgam", count: 8, interval: 0.5, delay: 1.8 },
          { enemy: "specter", count: 10, interval: 0.38, delay: 2.6 },
        ],
      },
      {
        groups: [
          { enemy: "overlord", count: 1, interval: 1, delay: 0 },
          { enemy: "amalgam", count: 10, interval: 0.48, delay: 1.4 },
          { enemy: "specter", count: 10, interval: 0.36, delay: 1.8 },
          { enemy: "siege", count: 4, interval: 0.95, delay: 2.2 },
          { enemy: "husk", count: 4, interval: 0.95, delay: 2.5 },
        ],
      },
      {
        groups: [
          { enemy: "sovereign", count: 1, interval: 1, delay: 0 },
          { enemy: "overlord", count: 1, interval: 1, delay: 3.8 },
          { enemy: "amalgam", count: 8, interval: 0.5, delay: 2.6 },
          { enemy: "specter", count: 10, interval: 0.34, delay: 4 },
        ],
      },
    ],
  },
};

export const MAP_ORDER: MapId[] = ["mycelion", "forge", "aegis"];

/** Non-boss hosts in a breach wave, after the usual late-wave inflation. */
export const BREACH_CAP = 12;
/** Hard stop so called mites and split children still fit in the pool. */
export const BREACH_BUDGET = 56;

const BREACH_BOSS: Record<MapId, EnemyId> = {
  mycelion: "colossus",
  forge: "leviathan",
  aegis: "sovereign",
};

/**
 * Rotating packs for the endless hold. Counts stay small; inflation and the
 * four-wave boss beat supply the pressure. Each world keeps its own language.
 */
export const BREACH: Record<MapId, WaveGroup[][]> = {
  mycelion: [
    [
      { enemy: "shade", count: 3, interval: 0.7, delay: 0.4 },
      { enemy: "bloom", count: 4, interval: 0.46, delay: 0 },
      { enemy: "mite", count: 4, interval: 0.34, delay: 0.8 },
    ],
    [
      { enemy: "marrow", count: 2, interval: 1.2, delay: 0.3 },
      { enemy: "husk", count: 3, interval: 0.9, delay: 0.6 },
      { enemy: "brood", count: 4, interval: 0.4, delay: 0 },
    ],
    [
      { enemy: "nidus", count: 2, interval: 1.4, delay: 0.5 },
      { enemy: "thorn", count: 3, interval: 0.85, delay: 0.2 },
      { enemy: "myrmidon", count: 3, interval: 0.7, delay: 1 },
    ],
    [
      { enemy: "spore", count: 4, interval: 0.42, delay: 0 },
      { enemy: "shade", count: 2, interval: 0.75, delay: 0.5 },
      { enemy: "bloom", count: 3, interval: 0.48, delay: 0.9 },
    ],
  ],
  forge: [
    [
      { enemy: "howler", count: 3, interval: 0.8, delay: 0.3 },
      { enemy: "drone", count: 4, interval: 0.36, delay: 0 },
      { enemy: "walker", count: 3, interval: 0.55, delay: 0.7 },
    ],
    [
      { enemy: "cinder", count: 3, interval: 0.65, delay: 0.2 },
      { enemy: "razor", count: 3, interval: 0.42, delay: 0.5 },
      { enemy: "gunship", count: 3, interval: 0.48, delay: 0 },
    ],
    [
      { enemy: "skiff", count: 3, interval: 0.6, delay: 0 },
      { enemy: "siege", count: 2, interval: 1.1, delay: 0.6 },
      { enemy: "walker", count: 3, interval: 0.5, delay: 1 },
    ],
    [
      { enemy: "sentry", count: 2, interval: 1, delay: 0.4 },
      { enemy: "bulwark", count: 2, interval: 0.9, delay: 0.8 },
      { enemy: "howler", count: 2, interval: 0.75, delay: 0 },
    ],
  ],
  aegis: [
    [
      { enemy: "gnaw", count: 3, interval: 0.7, delay: 0.2 },
      { enemy: "chimera", count: 4, interval: 0.45, delay: 0 },
      { enemy: "wraith", count: 3, interval: 0.42, delay: 0.6 },
    ],
    [
      { enemy: "herald", count: 2, interval: 1.1, delay: 0.3 },
      { enemy: "amalgam", count: 4, interval: 0.5, delay: 0 },
      { enemy: "relic", count: 2, interval: 0.85, delay: 0.8 },
    ],
    [
      { enemy: "specter", count: 3, interval: 0.4, delay: 0 },
      { enemy: "bastion", count: 2, interval: 1.3, delay: 0.6 },
      { enemy: "nidus", count: 2, interval: 1.2, delay: 1 },
    ],
    [
      { enemy: "gnaw", count: 2, interval: 0.7, delay: 0.2 },
      { enemy: "herald", count: 2, interval: 1, delay: 0.5 },
      { enemy: "wraith", count: 3, interval: 0.4, delay: 0 },
    ],
  ],
};

/** The wave that follows the scripted line. Depth 0 is the first breach incursion. */
export function breachWave(mapId: MapId, waveIndex: number): WaveDef {
  const scripted = MAPS[mapId].waves.length;
  const depth = Math.max(0, waveIndex - scripted);
  const steps = BREACH[mapId];
  const step = steps[depth % steps.length];
  const loop = Math.floor(depth / steps.length);
  const groups: WaveGroup[] = step.map((g) => ({
    enemy: g.enemy,
    interval: g.interval,
    delay: g.delay,
    count: Math.min(8, g.count + loop),
  }));
  if (depth % 4 === 3) {
    groups.unshift({
      enemy: BREACH_BOSS[mapId],
      count: 1,
      interval: 1.2,
      delay: 0,
    });
  }
  return { groups };
}

export function mapWorldSize(map: MapDef) {
  return {
    width: map.cols * CELL,
    depth: map.rows * CELL,
  };
}
