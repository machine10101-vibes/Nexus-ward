import type { MapId, Quality } from "./types";

const KEY = "nexus-ward-save";
const VERSION = 1;

export type Settings = {
  master: number;
  sfx: number;
  music: number;
  shake: boolean;
  quality: Quality;
};

export type SaveData = {
  version: number;
  completed: MapId[];
  best: Partial<Record<MapId, { wave: number; cores: number }>>;
  settings: Settings;
};

const defaults: SaveData = {
  version: VERSION,
  completed: [],
  best: {},
  settings: {
    master: 0.85,
    sfx: 0.8,
    music: 0.35,
    shake: true,
    quality: "high",
  },
};

function migrate(raw: SaveData): SaveData {
  const s = { ...defaults, ...raw, settings: { ...defaults.settings, ...raw.settings } };
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

export function recordResult(map: MapId, wave: number, cores: number, won: boolean) {
  const s = loadSave();
  const prev = s.best[map];
  if (!prev || wave > prev.wave || (wave === prev.wave && cores > prev.cores)) {
    s.best[map] = { wave, cores };
  }
  if (won && !s.completed.includes(map)) s.completed.push(map);
  writeSave(s);
  return s;
}

export function saveSettings(settings: Settings) {
  const s = loadSave();
  s.settings = settings;
  writeSave(s);
}
