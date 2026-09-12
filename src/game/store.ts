import { create } from "zustand";
import { AUTO_WAVE_DELAY } from "./config";
import { engine } from "./engine";
import { ITEMS } from "./heroes";
import { loadSave, recordResult, saveHero, saveSettings, type HeroSave, type Settings } from "./save";
import { audio } from "./audio";
import type { HeroId, ItemId, ItemSlot, MapId, Screen, TowerId } from "./types";

export type HudSnap = {
  gold: number;
  lives: number;
  maxLives: number;
  wave: number;
  waveTotal: number;
  phase: "idle" | "build" | "combat" | "won" | "lost";
  kills: number;
  event: string | null;
  selectedId: number | null;
  towers: number;
  spawnGen: number;
  speed: number;
  autoWave: boolean;
  surgeCd: number;
  overclockCd: number;
  overclockOn: boolean;
  combo: number;
  living: number;
  remaining: number;
  waveSize: number;
  bonus: number;
  leaked: number;
  autoIn: number;
  denyGen: number;
  rankGen: number;
  placeGen: number;
  heroId: HeroId | null;
  heroAbilityCd: number;
  heroAbilityMax: number;
};

type GameStore = {
  screen: Screen;
  mapId: MapId | null;
  preview: MapId;
  heroId: HeroId | null;
  previewHero: HeroId;
  heroSave: HeroSave;
  helpFrom: Screen;
  settingsFrom: Screen;
  studioFrom: Screen;
  loadoutFrom: Screen;
  studioId: string;
  studioVariant: number;
  studioSpin: boolean;
  studioFit: number;
  settings: Settings;
  completed: MapId[];
  hud: HudSnap;
  hoverPad: number | null;
  buildType: TowerId | null;
  setScreen: (s: Screen) => void;
  setPreview: (id: MapId) => void;
  openHelp: () => void;
  openSettings: () => void;
  openStudio: () => void;
  setStudioId: (id: string) => void;
  setStudioVariant: (n: number) => void;
  toggleStudioSpin: () => void;
  fitStudio: () => void;
  closeOverlay: () => void;
  startHeroSelect: (id: MapId) => void;
  setPreviewHero: (id: HeroId) => void;
  confirmHero: (id: HeroId) => void;
  startBriefing: (id: MapId) => void;
  openLoadout: () => void;
  equipItem: (id: ItemId) => void;
  unequipSlot: (slot: ItemSlot) => void;
  dropIn: () => void;
  abortToSelect: () => void;
  pause: () => void;
  resume: () => void;
  syncHud: () => void;
  patchSettings: (p: Partial<Settings>) => void;
  noteResult: (won: boolean) => void;
};

const save = loadSave();

const emptyHud: HudSnap = {
  gold: 0,
  lives: 0,
  maxLives: 0,
  wave: 0,
  waveTotal: 0,
  phase: "idle",
  kills: 0,
  event: null,
  selectedId: null,
  towers: 0,
  spawnGen: 0,
  speed: 1,
  autoWave: false,
  surgeCd: 0,
  overclockCd: 0,
  overclockOn: false,
  combo: 0,
  living: 0,
  remaining: 0,
  waveSize: 0,
  bonus: 0,
  leaked: 0,
  autoIn: -1,
  denyGen: 0,
  rankGen: 0,
  placeGen: 0,
  heroId: null,
  heroAbilityCd: 0,
  heroAbilityMax: 16,
};

export const useGameStore = create<GameStore>((set, get) => ({
  screen: "title",
  mapId: null,
  preview: "mycelion",
  heroId: save.hero.last,
  previewHero: save.hero.last,
  heroSave: save.hero,
  helpFrom: "title",
  settingsFrom: "title",
  studioFrom: "title",
  loadoutFrom: "briefing",
  studioId: "pulse",
  studioVariant: 3,
  studioSpin: false,
  studioFit: 0,
  settings: save.settings,
  completed: save.completed,
  hud: emptyHud,
  hoverPad: null,
  buildType: "pulse",
  setScreen: (screen) => set({ screen }),
  setPreview: (preview) => {
    if (get().preview === preview) return;
    set({ preview });
  },
  openHelp: () => set({ helpFrom: get().screen, screen: "help" }),
  openSettings: () => set({ settingsFrom: get().screen, screen: "settings" }),
  openStudio: () => {
    const { screen, studioFrom } = get();
    if (screen === "studio") {
      set({ screen: studioFrom === "studio" ? "title" : studioFrom });
      return;
    }
    audio.ui();
    set({ studioFrom: screen === "playing" ? "paused" : screen, screen: "studio" });
  },
  setStudioId: (studioId) => {
    if (get().studioId === studioId) return;
    set({ studioId, studioVariant: 3, studioFit: get().studioFit + 1 });
  },
  setStudioVariant: (studioVariant) => set({ studioVariant }),
  toggleStudioSpin: () => set({ studioSpin: !get().studioSpin }),
  fitStudio: () => set({ studioFit: get().studioFit + 1, studioSpin: false }),
  closeOverlay: () => {
    const { screen, helpFrom, settingsFrom, studioFrom, loadoutFrom } = get();
    if (screen === "help") set({ screen: helpFrom });
    else if (screen === "settings") set({ screen: settingsFrom });
    else if (screen === "studio") set({ screen: studioFrom === "studio" ? "title" : studioFrom });
    else if (screen === "loadout") set({ screen: loadoutFrom === "loadout" ? "briefing" : loadoutFrom });
  },
  startHeroSelect: (id) => {
    audio.ui();
    set({ mapId: id, preview: id, screen: "hero", previewHero: get().heroSave.last });
  },
  setPreviewHero: (previewHero) => {
    if (get().previewHero === previewHero) return;
    set({ previewHero });
  },
  confirmHero: (id) => {
    audio.ui();
    const heroSave = { ...get().heroSave, last: id };
    saveHero(heroSave);
    set({ heroId: id, previewHero: id, heroSave, screen: "briefing" });
  },
  startBriefing: (id) => {
    audio.ui();
    set({ mapId: id, preview: id, screen: "briefing" });
  },
  openLoadout: () => {
    const { screen } = get();
    audio.ui();
    if (screen === "loadout") {
      get().closeOverlay();
      return;
    }
    set({ loadoutFrom: screen === "playing" ? "paused" : screen, screen: "loadout" });
  },
  equipItem: (id) => {
    const { heroSave, previewHero, heroId } = get();
    const who = heroId ?? previewHero;
    if (!heroSave.owned.includes(id)) return;
    const item = ITEMS[id];
    if (!item || item.hero !== who) return;
    const nextLoad = { ...heroSave.loadouts[who], [item.slot]: id };
    const next = { ...heroSave, last: who, loadouts: { ...heroSave.loadouts, [who]: nextLoad } };
    saveHero(next);
    set({ heroSave: next });
    if (engine.hero.id === who) engine.applyHeroGear(nextLoad);
    audio.ui();
  },
  unequipSlot: (slot) => {
    const { heroSave, previewHero, heroId } = get();
    const who = heroId ?? previewHero;
    const nextLoad = { ...heroSave.loadouts[who], [slot]: null };
    const next = { ...heroSave, last: who, loadouts: { ...heroSave.loadouts, [who]: nextLoad } };
    saveHero(next);
    set({ heroSave: next });
    if (engine.hero.id === who) engine.applyHeroGear(nextLoad);
    audio.ui();
  },
  dropIn: () => {
    const id = get().mapId;
    const heroId = get().heroId ?? get().heroSave.last;
    if (!id) return;
    engine.load(id, heroId, get().heroSave.loadouts[heroId]);
    audio.wave();
    set({
      screen: "playing",
      heroId,
      buildType: engine.buildType,
      hud: snapHud(),
    });
  },
  abortToSelect: () => {
    engine.phase = "idle";
    set({ screen: "select", mapId: null, hud: emptyHud });
  },
  pause: () => {
    if (get().screen === "playing") set({ screen: "paused" });
  },
  resume: () => {
    if (get().screen === "paused") set({ screen: "playing" });
  },
  syncHud: () => {
    const next = snapHud();
    const cur = get().hud;
    if (
      next.gold === cur.gold &&
      next.lives === cur.lives &&
      next.wave === cur.wave &&
      next.phase === cur.phase &&
      next.event === cur.event &&
      next.selectedId === cur.selectedId &&
      next.kills === cur.kills &&
      next.towers === cur.towers &&
      next.spawnGen === cur.spawnGen &&
      next.speed === cur.speed &&
      next.autoWave === cur.autoWave &&
      Math.floor(next.surgeCd) === Math.floor(cur.surgeCd) &&
      Math.floor(next.overclockCd) === Math.floor(cur.overclockCd) &&
      next.overclockOn === cur.overclockOn &&
      next.combo === cur.combo &&
      next.living === cur.living &&
      next.remaining === cur.remaining &&
      next.waveSize === cur.waveSize &&
      next.bonus === cur.bonus &&
      next.leaked === cur.leaked &&
      next.denyGen === cur.denyGen &&
      next.rankGen === cur.rankGen &&
      next.placeGen === cur.placeGen &&
      next.heroId === cur.heroId &&
      Math.floor(next.heroAbilityCd) === Math.floor(cur.heroAbilityCd) &&
      Math.ceil(next.autoIn * 10) === Math.ceil(cur.autoIn * 10)
    ) {
      return;
    }
    const screen = get().screen;
    let s = screen;
    if (next.phase === "won" && screen === "playing") s = "won";
    if (next.phase === "lost" && screen === "playing") s = "lost";
    set({ hud: next, screen: s, buildType: engine.buildType });
  },
  patchSettings: (p) => {
    const settings = { ...get().settings, ...p };
    set({ settings });
    saveSettings(settings);
    audio.setVolumes(settings);
  },
  noteResult: (won) => {
    const id = get().mapId;
    if (!id) return;
    const s = recordResult(id, engine.wave, engine.lives, won);
    set({ completed: s.completed, heroSave: s.hero });
    if (won) audio.win();
    else audio.lose();
  },
}));

function snapHud(): HudSnap {
  return {
    gold: engine.gold,
    lives: engine.lives,
    maxLives: engine.map.lives,
    wave: engine.wave,
    waveTotal: engine.map.waves.length,
    phase: engine.phase,
    kills: engine.kills,
    event: engine.lastEvent,
    selectedId: engine.selectedTower,
    towers: engine.towers.length,
    spawnGen: engine.spawnGen,
    speed: engine.speed,
    autoWave: engine.autoWave,
    surgeCd: engine.surgeCd,
    overclockCd: engine.overclockCd,
    overclockOn: engine.time < engine.overclockUntil,
    combo: engine.time < engine.comboUntil ? engine.combo : 0,
    living: engine.livingCount(),
    remaining: Math.max(0, engine.spawnQueue.length - engine.spawnI) + engine.livingCount(),
    waveSize: engine.spawnQueue.length,
    bonus: engine.earlyBonus(),
    leaked: engine.leaked,
    autoIn:
      engine.autoWave && engine.phase === "build" && engine.wave > 0 && engine.wave < engine.map.waves.length
        ? Math.max(0, AUTO_WAVE_DELAY - engine.autoT)
        : -1,
    denyGen: engine.denyGen,
    rankGen: engine.rankGen,
    placeGen: engine.placeGen,
    heroId: engine.hero.id,
    heroAbilityCd: engine.hero.abilityCd,
    heroAbilityMax: engine.hero.stats.abilityCd,
  };
}

/** First-run defaults taken from the device. Explicit settings always win afterwards. */
export function applyEnvironmentDefaults() {
  if (typeof window === "undefined") return;
  const narrow = window.innerWidth < 720;
  const saveNow = loadSave();
  if (narrow && saveNow.settings.quality === "high" && !localStorage.getItem("nexus-ward-qset")) {
    useGameStore.getState().patchSettings({ quality: "low" });
    localStorage.setItem("nexus-ward-qset", "1");
  }
  const calmed = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (calmed && saveNow.settings.shake && !localStorage.getItem("nexus-ward-shakeset")) {
    useGameStore.getState().patchSettings({ shake: false });
    localStorage.setItem("nexus-ward-shakeset", "1");
  }
}
