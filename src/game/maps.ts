import type { Cell, MapDef, MapId } from "./types";
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

const COLS = 16;
const ROWS = 11;

const mycelionPath = stitch([
  [0, 1],
  [6, 1],
  [6, 4],
  [2, 4],
  [2, 8],
  [8, 8],
  [8, 3],
  [13, 3],
  [13, 7],
  [10, 7],
  [10, 9],
  [15, 9],
]);

const forgePath = stitch([
  [0, 2],
  [12, 2],
  [12, 5],
  [3, 5],
  [3, 8],
  [14, 8],
  [14, 5],
  [15, 5],
]);

const aegisPath = stitch([
  [0, 8],
  [4, 8],
  [4, 2],
  [9, 2],
  [9, 9],
  [13, 9],
  [13, 4],
  [15, 4],
]);

export const MAPS: Record<MapId, MapDef> = {
  mycelion: {
    id: "mycelion",
    name: "Mycelion",
    subtitle: "Organic world",
    faction: "organic",
    lore: "A living planet of fungal canyons and bioluminescent marrow. The swarm is not an invasion so much as the lattice reclaiming a core we planted in its heart.",
    hint: "Ground packs hit first. Bring a lance before spores take the air.",
    cols: COLS,
    rows: ROWS,
    path: mycelionPath,
    pads: padsFromPath(mycelionPath, COLS, ROWS, 22),
    startGold: 220,
    lives: 20,
    waves: [
      { groups: [{ enemy: "mite", count: 8, interval: 0.7, delay: 0 }] },
      { groups: [{ enemy: "mite", count: 12, interval: 0.55, delay: 0 }] },
      {
        groups: [
          { enemy: "mite", count: 8, interval: 0.5, delay: 0 },
          { enemy: "brood", count: 4, interval: 0.9, delay: 1.2 },
        ],
      },
      { groups: [{ enemy: "spore", count: 7, interval: 0.7, delay: 0 }] },
      {
        groups: [
          { enemy: "brood", count: 10, interval: 0.55, delay: 0 },
          { enemy: "husk", count: 2, interval: 1.6, delay: 2 },
        ],
      },
      {
        groups: [
          { enemy: "spore", count: 8, interval: 0.5, delay: 0 },
          { enemy: "mite", count: 10, interval: 0.4, delay: 0.8 },
        ],
      },
      { groups: [{ enemy: "husk", count: 6, interval: 1.1, delay: 0 }] },
      {
        groups: [
          { enemy: "brood", count: 12, interval: 0.45, delay: 0 },
          { enemy: "spore", count: 8, interval: 0.55, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "husk", count: 6, interval: 0.9, delay: 0 },
          { enemy: "brood", count: 10, interval: 0.4, delay: 1.5 },
          { enemy: "spore", count: 8, interval: 0.5, delay: 2 },
        ],
      },
      {
        groups: [
          { enemy: "titan", count: 1, interval: 1, delay: 0 },
          { enemy: "brood", count: 10, interval: 0.5, delay: 3 },
          { enemy: "spore", count: 8, interval: 0.45, delay: 4 },
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
    hint: "Armor is thick. Rails and tesla cut steel. Watch the gunships.",
    cols: COLS,
    rows: ROWS,
    path: forgePath,
    pads: padsFromPath(forgePath, COLS, ROWS, 20),
    startGold: 240,
    lives: 18,
    waves: [
      { groups: [{ enemy: "drone", count: 8, interval: 0.65, delay: 0 }] },
      { groups: [{ enemy: "drone", count: 12, interval: 0.5, delay: 0 }] },
      {
        groups: [
          { enemy: "drone", count: 8, interval: 0.45, delay: 0 },
          { enemy: "walker", count: 4, interval: 1, delay: 1 },
        ],
      },
      { groups: [{ enemy: "gunship", count: 7, interval: 0.7, delay: 0 }] },
      {
        groups: [
          { enemy: "walker", count: 8, interval: 0.7, delay: 0 },
          { enemy: "siege", count: 2, interval: 1.8, delay: 2 },
        ],
      },
      {
        groups: [
          { enemy: "gunship", count: 8, interval: 0.5, delay: 0 },
          { enemy: "drone", count: 10, interval: 0.35, delay: 0.6 },
        ],
      },
      { groups: [{ enemy: "siege", count: 6, interval: 1.15, delay: 0 }] },
      {
        groups: [
          { enemy: "walker", count: 10, interval: 0.5, delay: 0 },
          { enemy: "gunship", count: 8, interval: 0.5, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 6, interval: 0.95, delay: 0 },
          { enemy: "walker", count: 8, interval: 0.45, delay: 1.4 },
          { enemy: "gunship", count: 8, interval: 0.45, delay: 2 },
        ],
      },
      {
        groups: [
          { enemy: "dread", count: 1, interval: 1, delay: 0 },
          { enemy: "walker", count: 10, interval: 0.5, delay: 3 },
          { enemy: "gunship", count: 8, interval: 0.4, delay: 4 },
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
    hint: "Both kingdoms come at once. Mix slow control with air cover.",
    cols: COLS,
    rows: ROWS,
    path: aegisPath,
    pads: padsFromPath(aegisPath, COLS, ROWS, 22),
    startGold: 260,
    lives: 16,
    waves: [
      {
        groups: [
          { enemy: "mite", count: 6, interval: 0.6, delay: 0 },
          { enemy: "drone", count: 6, interval: 0.6, delay: 0.3 },
        ],
      },
      { groups: [{ enemy: "chimera", count: 8, interval: 0.7, delay: 0 }] },
      {
        groups: [
          { enemy: "brood", count: 6, interval: 0.55, delay: 0 },
          { enemy: "walker", count: 5, interval: 0.8, delay: 0.8 },
        ],
      },
      {
        groups: [
          { enemy: "spore", count: 6, interval: 0.55, delay: 0 },
          { enemy: "wraith", count: 6, interval: 0.55, delay: 0.4 },
        ],
      },
      {
        groups: [
          { enemy: "chimera", count: 8, interval: 0.55, delay: 0 },
          { enemy: "husk", count: 2, interval: 1.5, delay: 1.5 },
        ],
      },
      {
        groups: [
          { enemy: "wraith", count: 8, interval: 0.45, delay: 0 },
          { enemy: "gunship", count: 6, interval: 0.5, delay: 1 },
          { enemy: "drone", count: 8, interval: 0.35, delay: 0.5 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 4, interval: 1.1, delay: 0 },
          { enemy: "husk", count: 4, interval: 1.1, delay: 0.5 },
        ],
      },
      {
        groups: [
          { enemy: "chimera", count: 10, interval: 0.45, delay: 0 },
          { enemy: "wraith", count: 8, interval: 0.45, delay: 1 },
        ],
      },
      {
        groups: [
          { enemy: "siege", count: 4, interval: 0.9, delay: 0 },
          { enemy: "husk", count: 4, interval: 0.9, delay: 0.4 },
          { enemy: "wraith", count: 8, interval: 0.4, delay: 2 },
          { enemy: "chimera", count: 8, interval: 0.4, delay: 1.2 },
        ],
      },
      {
        groups: [
          { enemy: "overlord", count: 1, interval: 1, delay: 0 },
          { enemy: "chimera", count: 10, interval: 0.45, delay: 3 },
          { enemy: "wraith", count: 8, interval: 0.4, delay: 4 },
          { enemy: "gunship", count: 6, interval: 0.45, delay: 5 },
        ],
      },
    ],
  },
};

export const MAP_ORDER: MapId[] = ["mycelion", "forge", "aegis"];

export function mapWorldSize(map: MapDef) {
  return {
    width: map.cols * CELL,
    depth: map.rows * CELL,
  };
}
