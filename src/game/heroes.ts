import type { DamageKind, HeroId, ItemId, ItemSlot } from "./types";

export type HeroDef = {
  id: HeroId;
  name: string;
  title: string;
  role: string;
  blurb: string;
  accent: string;
  damage: number;
  range: number;
  fireRate: number;
  armor: number;
  abilityCd: number;
  ability: string;
  abilityHint: string;
  hitsFlying: boolean;
  kind: DamageKind;
  starterWeapon: ItemId;
  starterArmor: ItemId;
};

export type ItemDef = {
  id: ItemId;
  name: string;
  slot: ItemSlot;
  hero: HeroId;
  blurb: string;
  unlock: "start" | "clear";
  damage: number;
  range: number;
  fireRate: number;
  armor: number;
  abilityCd: number;
};

export type HeroLoadout = {
  weapon: ItemId | null;
  armor: ItemId | null;
};

export type HeroStats = {
  damage: number;
  range: number;
  fireRate: number;
  armor: number;
  abilityCd: number;
  hitsFlying: boolean;
  kind: DamageKind;
  color: string;
};

export const HERO_ORDER: HeroId[] = ["fighter", "ranger", "mage"];

export const HEROES: Record<HeroId, HeroDef> = {
  fighter: {
    id: "fighter",
    name: "Vanguard",
    title: "Fighter",
    role: "Swords · heavy plate",
    blurb: "A close-grid knight in reactive plate. Holds the last meters of the lane with an ion blade and a crushing cleave.",
    accent: "#c4a574",
    damage: 26,
    range: 2.15,
    fireRate: 1.12,
    armor: 9,
    abilityCd: 16,
    ability: "Cleave",
    abilityHint: "Arc the blade through every host in reach.",
    hitsFlying: false,
    kind: "shell",
    starterWeapon: "ion-cleaver",
    starterArmor: "plate-cuirass",
  },
  ranger: {
    id: "ranger",
    name: "Pathfinder",
    title: "Ranger",
    role: "Guns · light harness",
    blurb: "A long-lane marksman in kinetic weave. Tracks air and ground with a pulse rifle, then empties a volley down the path.",
    accent: "#7aa8b8",
    damage: 15,
    range: 5.5,
    fireRate: 2.35,
    armor: 3,
    abilityCd: 14,
    ability: "Volley",
    abilityHint: "Dump a burst into the nearest hosts, including air.",
    hitsFlying: true,
    kind: "bolt",
    starterWeapon: "pulse-rifle",
    starterArmor: "scout-weave",
  },
  mage: {
    id: "mage",
    name: "Lumen",
    title: "Mage",
    role: "Arcana · cloth veil",
    blurb: "A rift caster in star-thread. Slow, heavy aether strikes from mid-lane, then a nova that cooks the grid.",
    accent: "#8b7cc8",
    damage: 42,
    range: 4.7,
    fireRate: 0.7,
    armor: 2,
    abilityCd: 18,
    ability: "Nova",
    abilityHint: "Detonate aether in a wide sphere. Hits everything.",
    hitsFlying: true,
    kind: "beam",
    starterWeapon: "aether-rod",
    starterArmor: "veil-mantle",
  },
};

export const ITEMS: Record<ItemId, ItemDef> = {
  "ion-cleaver": {
    id: "ion-cleaver",
    name: "Ion Cleaver",
    slot: "weapon",
    hero: "fighter",
    blurb: "Short energy longsword. Honest cuts at arm's length.",
    unlock: "start",
    damage: 6,
    range: 0.1,
    fireRate: 0.08,
    armor: 0,
    abilityCd: 0,
  },
  "void-greatblade": {
    id: "void-greatblade",
    name: "Void Greatblade",
    slot: "weapon",
    hero: "fighter",
    blurb: "Heavier ion slab. Slower swings, deeper plates, a wider cleave.",
    unlock: "clear",
    damage: 16,
    range: 0.35,
    fireRate: -0.18,
    armor: 0,
    abilityCd: -1,
  },
  "plate-cuirass": {
    id: "plate-cuirass",
    name: "Plate Cuirass",
    slot: "armor",
    hero: "fighter",
    blurb: "Reactive heavy plate. The chassis a Vanguard is built around.",
    unlock: "start",
    damage: 0,
    range: 0,
    fireRate: 0,
    armor: 4,
    abilityCd: 0,
  },
  "aegis-plate": {
    id: "aegis-plate",
    name: "Aegis Plate",
    slot: "armor",
    hero: "fighter",
    blurb: "Layered fortress mail. More mass, faster recoveries.",
    unlock: "clear",
    damage: 3,
    range: 0,
    fireRate: 0,
    armor: 8,
    abilityCd: -3,
  },
  "pulse-rifle": {
    id: "pulse-rifle",
    name: "Pulse Rifle",
    slot: "weapon",
    hero: "ranger",
    blurb: "Compact kinetic carbine. Fast follow-up shots.",
    unlock: "start",
    damage: 4,
    range: 0.2,
    fireRate: 0.2,
    armor: 0,
    abilityCd: 0,
  },
  "rail-longarm": {
    id: "rail-longarm",
    name: "Rail Longarm",
    slot: "weapon",
    hero: "ranger",
    blurb: "Stretched barrel and a hotter cell. Reach and punch over rate.",
    unlock: "clear",
    damage: 10,
    range: 1.1,
    fireRate: -0.25,
    armor: 0,
    abilityCd: -1,
  },
  "scout-weave": {
    id: "scout-weave",
    name: "Scout Weave",
    slot: "armor",
    hero: "ranger",
    blurb: "Light harness and magazine webbing. Moves like cloth, stops like mesh.",
    unlock: "start",
    damage: 0,
    range: 0.15,
    fireRate: 0.1,
    armor: 2,
    abilityCd: 0,
  },
  "ghost-harness": {
    id: "ghost-harness",
    name: "Ghost Harness",
    slot: "armor",
    hero: "ranger",
    blurb: "Slimmer plates, extra cells. Quicker volleys and a longer sightline.",
    unlock: "clear",
    damage: 2,
    range: 0.45,
    fireRate: 0.25,
    armor: 3,
    abilityCd: -2,
  },
  "aether-rod": {
    id: "aether-rod",
    name: "Aether Rod",
    slot: "weapon",
    hero: "mage",
    blurb: "Short focus stave. A bright, heavy lance from mid-grid.",
    unlock: "start",
    damage: 8,
    range: 0.2,
    fireRate: 0.04,
    armor: 0,
    abilityCd: 0,
  },
  "nova-crozier": {
    id: "nova-crozier",
    name: "Nova Crozier",
    slot: "weapon",
    hero: "mage",
    blurb: "Tall rift crozier. Slower casts, much harder falls.",
    unlock: "clear",
    damage: 18,
    range: 0.55,
    fireRate: -0.08,
    armor: 0,
    abilityCd: -2,
  },
  "veil-mantle": {
    id: "veil-mantle",
    name: "Veil Mantle",
    slot: "armor",
    hero: "mage",
    blurb: "Star-thread cloth and a hood. Almost no weight, a little ward.",
    unlock: "start",
    damage: 2,
    range: 0.1,
    fireRate: 0,
    armor: 1,
    abilityCd: 0,
  },
  "star-silk": {
    id: "star-silk",
    name: "Star Silk",
    slot: "armor",
    hero: "mage",
    blurb: "Rift-woven veil. Feeds the nova and stretches the lance.",
    unlock: "clear",
    damage: 6,
    range: 0.35,
    fireRate: 0.06,
    armor: 2,
    abilityCd: -3,
  },
};

export const ITEM_ORDER: ItemId[] = [
  "ion-cleaver",
  "void-greatblade",
  "plate-cuirass",
  "aegis-plate",
  "pulse-rifle",
  "rail-longarm",
  "scout-weave",
  "ghost-harness",
  "aether-rod",
  "nova-crozier",
  "veil-mantle",
  "star-silk",
];

export function emptyLoadouts(): Record<HeroId, HeroLoadout> {
  return {
    fighter: { weapon: "ion-cleaver", armor: "plate-cuirass" },
    ranger: { weapon: "pulse-rifle", armor: "scout-weave" },
    mage: { weapon: "aether-rod", armor: "veil-mantle" },
  };
}

export function starterOwned(): ItemId[] {
  return ITEM_ORDER.filter((id) => ITEMS[id].unlock === "start");
}

export function clearUnlocks(): ItemId[] {
  return ITEM_ORDER.filter((id) => ITEMS[id].unlock === "clear");
}

export function heroStats(id: HeroId, loadout: HeroLoadout): HeroStats {
  const h = HEROES[id];
  let damage = h.damage;
  let range = h.range;
  let fireRate = h.fireRate;
  let armor = h.armor;
  let abilityCd = h.abilityCd;
  for (const slot of [loadout.weapon, loadout.armor] as const) {
    if (!slot) continue;
    const item = ITEMS[slot];
    if (item.hero !== id) continue;
    damage += item.damage;
    range += item.range;
    fireRate += item.fireRate;
    armor += item.armor;
    abilityCd += item.abilityCd;
  }
  return {
    damage: Math.max(6, damage),
    range: Math.max(1.4, range),
    fireRate: Math.max(0.35, fireRate),
    armor: Math.max(0, armor),
    abilityCd: Math.max(8, abilityCd),
    hitsFlying: h.hitsFlying,
    kind: h.kind,
    color: h.accent,
  };
}

export function itemsForHero(id: HeroId, slot?: ItemSlot) {
  return ITEM_ORDER.filter((itemId) => {
    const item = ITEMS[itemId];
    return item.hero === id && (!slot || item.slot === slot);
  });
}
