import { clearUnlocks, emptyLoadouts, starterOwned, type HeroLoadout } from "./heroes";
import { STAGE_COUNT, stageKey } from "./stages";
import type { BaseClass, HeroId, ItemId, MapId, Quality } from "./types";

const KEY = "nexus-ward-save";
const VERSION = 4;

export type ArtBind = "art1" | "art2" | "art3";

export type Keybinds = {
  art1: string;
  art2: string;
  art3: string;
};

export const DEFAULT_KEYS: Keybinds = {
  art1: "KeyR",
  art2: "KeyT",
  art3: "KeyY",
};

export const RESERVED_CODES = new Set([
  "Escape",
  "Space",
  "Tab",
  "Enter",
  "MetaLeft",
  "MetaRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
  "Digit7",
  "Digit8",
  "Digit9",
  "Digit0",
  "KeyQ",
  "KeyE",
  "KeyL",
  "KeyA",
  "KeyV",
  "KeyU",
  "KeyX",
  "KeyF",
  "KeyG",
]);

export function formatKey(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  return code.replace(/Left|Right/, "");
}

export type Settings = {
  master: number;
  sfx: number;
  music: number;
  shake: boolean;
  quality: Quality;
  keys: Keybinds;
};

export type HeroSave = {
  last: HeroId;
  loadouts: Record<HeroId, HeroLoadout>;
  owned: ItemId[];
};

export type StageScore = { wave: number; cores: number };

export type SaveData = {
  version: number;
  completed: MapId[];
  best: Partial<Record<MapId, StageScore>>;
  /** Deepest run on one stratum, keyed `planet:index`. */
  stageBest: Partial<Record<string, StageScore>>;
  /** Strata whose scripted line was held, keyed `planet:index`. */
  stageClear: string[];
  settings: Settings;
  hero: HeroSave;
  /** Null until the player picks a keep. A match then uses the world's own class. */
  baseClass: BaseClass | null;
};

const defaults: SaveData = {
  version: VERSION,
  completed: [],
  best: {},
  stageBest: {},
  stageClear: [],
  settings: {
    master: 0.85,
    sfx: 0.8,
    music: 0.35,
    shake: true,
    quality: "high",
    keys: { ...DEFAULT_KEYS },
  },
  hero: {
    last: "fighter",
    loadouts: emptyLoadouts(),
    owned: starterOwned(),
  },
  baseClass: null,
};

function migrate(raw: SaveData): SaveData {
  const s = {
    ...defaults,
    ...raw,
    settings: {
      ...defaults.settings,
      ...raw.settings,
      keys: { ...defaults.settings.keys, ...raw.settings?.keys },
    },
    hero: {
      ...defaults.hero,
      ...raw.hero,
      loadouts: { ...emptyLoadouts(), ...raw.hero?.loadouts },
      owned: raw.hero?.owned?.length ? raw.hero.owned : starterOwned(),
    },
  };
  if (s.baseClass !== "organic" && s.baseClass !== "mech" && s.baseClass !== "hybrid") s.baseClass = null;
  if (!s.stageBest || typeof s.stageBest !== "object") s.stageBest = {};
  if (!Array.isArray(s.stageClear)) s.stageClear = [];
  // A clear from before strata were a choice counts as the first ground of that planet.
  for (const map of s.completed) {
    const key = stageKey(map, 0);
    if (!s.stageClear.includes(key)) s.stageClear.push(key);
    const prev = s.best[map];
    if (prev && !s.stageBest[key]) s.stageBest[key] = prev;
  }
  s.version = VERSION;
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return structuredClone(defaults);
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION }));
  } catch {
    /* private mode / quota */
  }
}

export function recordResult(map: MapId, stage: number, wave: number, cores: number, won: boolean) {
  const s = loadSave();
  const key = stageKey(map, stage);
  const prev = s.stageBest[key];
  if (!prev || wave > prev.wave || (wave === prev.wave && cores > prev.cores)) {
    s.stageBest[key] = { wave, cores };
  }
  const planet = s.best[map];
  const here = s.stageBest[key]!;
  if (!planet || here.wave > planet.wave || (here.wave === planet.wave && here.cores > planet.cores)) {
    s.best[map] = here;
  }
  if (won && !s.stageClear.includes(key)) s.stageClear.push(key);
  const heldAll = Array.from({ length: STAGE_COUNT }, (_, i) => stageKey(map, i)).every((k) => s.stageClear.includes(k));
  if (won && heldAll && !s.completed.includes(map)) s.completed.push(map);
  if (won) {
    const extra = clearUnlocks().filter((id) => !s.hero.owned.includes(id));
    if (extra.length) s.hero.owned = [...s.hero.owned, ...extra];
  }
  writeSave(s);
  return s;
}

export function saveBase(baseClass: BaseClass) {
  const s = loadSave();
  s.baseClass = baseClass;
  writeSave(s);
  return s;
}

export function saveHero(hero: HeroSave) {
  const s = loadSave();
  s.hero = hero;
  writeSave(s);
}

export function saveSettings(settings: Settings) {
  const s = loadSave();
  s.settings = settings;
  writeSave(s);
}
