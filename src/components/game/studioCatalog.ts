import { ENEMIES, TOWERS, TOWER_ORDER } from "@/game/config";
import type { EnemyId, MapId, TowerId } from "@/game/types";

export type StudioKind = "tower" | "enemy" | "world";

export type StudioEntry = {
  id: string;
  name: string;
  group: string;
  kind: StudioKind;
  blurb: string;
  variants?: string[];
  tower?: TowerId;
  enemy?: EnemyId;
  world?: "globe" | "core" | "gate" | "pad";
  map?: MapId;
};

const ENEMY_ORDER: EnemyId[] = [
  "mite",
  "brood",
  "husk",
  "spore",
  "titan",
  "drone",
  "walker",
  "siege",
  "gunship",
  "dread",
  "chimera",
  "wraith",
  "overlord",
];

const FACTION_GROUP: Record<EnemyId, string> = {
  mite: "Organic hosts",
  brood: "Organic hosts",
  husk: "Organic hosts",
  spore: "Organic hosts",
  titan: "Organic hosts",
  drone: "Mechanical hosts",
  walker: "Mechanical hosts",
  siege: "Mechanical hosts",
  gunship: "Mechanical hosts",
  dread: "Mechanical hosts",
  chimera: "Hybrid hosts",
  wraith: "Hybrid hosts",
  overlord: "Hybrid hosts",
};

export const STUDIO_CATALOG: StudioEntry[] = [
  ...TOWER_ORDER.map((id) => ({
    id,
    name: TOWERS[id].name,
    group: "Batteries",
    kind: "tower" as const,
    blurb: TOWERS[id].desc,
    variants: ["Rank 1", "Rank 2", "Rank 3"],
    tower: id,
  })),
  ...ENEMY_ORDER.map((id) => ({
    id,
    name: ENEMIES[id].name + (ENEMIES[id].boss ? " · boss" : ENEMIES[id].flying ? " · air" : ""),
    group: FACTION_GROUP[id],
    kind: "enemy" as const,
    blurb: `${ENEMIES[id].hp} hp · ${ENEMIES[id].speed.toFixed(2)} speed · ${ENEMIES[id].gold} cr`,
    enemy: id,
  })),
  {
    id: "globe-mycelion",
    name: "Mycelion",
    group: "Worlds",
    kind: "world",
    blurb: "Living crust. Veins and spore weather.",
    world: "globe",
    map: "mycelion",
  },
  {
    id: "globe-forge",
    name: "Kron Forge",
    group: "Worlds",
    kind: "world",
    blurb: "Plate metal and slag seas.",
    world: "globe",
    map: "forge",
  },
  {
    id: "globe-aegis",
    name: "Aegis Rift",
    group: "Worlds",
    kind: "world",
    blurb: "Rift stone and ice shelves.",
    world: "globe",
    map: "aegis",
  },
  {
    id: "core",
    name: "Nexus core",
    group: "Worlds",
    kind: "world",
    blurb: "The heart the lattice wants.",
    world: "core",
  },
  {
    id: "gate",
    name: "Spawn gate",
    group: "Worlds",
    kind: "world",
    blurb: "Where the hosts step onto the grid.",
    world: "gate",
  },
  {
    id: "pad",
    name: "Hex platform",
    group: "Worlds",
    kind: "world",
    blurb: "Lit pad. Batteries sit here.",
    world: "pad",
  },
];

export function studioEntry(id: string): StudioEntry {
  return STUDIO_CATALOG.find((e) => e.id === id) ?? STUDIO_CATALOG[0];
}
