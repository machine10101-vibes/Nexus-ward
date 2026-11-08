import type { MapId } from "./types";

/** Strata on every planet. Index 0 is the calmest ground; the last is the heart. */
export const STAGE_COUNT = 4;

export type StageDef = {
  name: string;
  /** One line under the name on the stratum card. */
  place: string;
  blurb: string;
  /** Host health, on top of the usual per-wave growth. */
  hp: number;
  /** Movement speed. */
  speed: number;
  /** Flat plate added to every host. */
  armor: number;
  /** Pack size after the usual inflation. Below 1 thins a wave. */
  pack: number;
  /** Spawn spacing. Below 1 means the wave arrives sooner. */
  rush: number;
  /** Kill pay. It climbs, and it does not keep up with vitality. */
  pay: number;
  gold: number;
  lives: number;
  /** Pulled off the 5-incursion gate cadence. Higher strata open lanes sooner. */
  gatePull: number;
  /** Lane wander. Later strata bend harder. */
  wobble: number;
  /** Mixed into the field roll so the roads are not the stratum below. */
  seed: number;
  /** Hill height. The skyline grows with the stratum. */
  relief: number;
  /** Shifts the ridge noise so each stratum is a different stretch of planet. */
  phase: number;
  fog: string;
  sky: string;
  /** Scales fog distances. Lower is a closer horizon. */
  fogMul: number;
  ambient: number;
  key: number;
  /** Ground-shader life. Hills use this; the arena uses a fraction of it. */
  life: number;
  /** Vein, crack, and glint frequency. 1 matches the first audited ground. */
  vein: number;
  groundTint: string;
  hillTint: string;
  mist: number;
  mistColor: string;
  decor: number;
  /** Added to the battle grade. */
  gradeSat: number;
  gradeContrast: number;
};

const CLIMB = [
  { hp: 0.9, speed: 0.94, armor: 0, pack: 0.9, rush: 1.1, pay: 1, gold: 280, lives: 22, gatePull: 0, wobble: 0.72, relief: 0.78, life: 0.42, vein: 0.62, mist: 0.65, decor: 0.75, gradeSat: -0.04, gradeContrast: 0.04, fogMul: 1.18, ambient: 1.14, key: 1.06 },
  { hp: 1, speed: 1, armor: 0, pack: 1, rush: 1, pay: 1, gold: 230, lives: 20, gatePull: 0, wobble: 1, relief: 1, life: 1, vein: 1, mist: 1, decor: 1, gradeSat: 0, gradeContrast: 0.14, fogMul: 1, ambient: 1, key: 1 },
  { hp: 1.32, speed: 1.1, armor: 2, pack: 1.18, rush: 0.86, pay: 1.08, gold: 250, lives: 17, gatePull: 1, wobble: 1.22, relief: 1.28, life: 1.35, vein: 1.45, mist: 1.35, decor: 1.25, gradeSat: 0.06, gradeContrast: 0.2, fogMul: 0.82, ambient: 0.86, key: 0.9 },
  { hp: 1.7, speed: 1.2, armor: 4, pack: 1.36, rush: 0.74, pay: 1.14, gold: 280, lives: 14, gatePull: 2, wobble: 1.48, relief: 1.62, life: 1.8, vein: 2, mist: 1.7, decor: 1.5, gradeSat: 0.1, gradeContrast: 0.28, fogMul: 0.68, ambient: 0.72, key: 0.78 },
] as const;

function stratum(
  index: number,
  copy: Pick<StageDef, "name" | "place" | "blurb" | "fog" | "sky" | "groundTint" | "hillTint" | "mistColor">,
  phase: number,
  seed: number,
): StageDef {
  return { ...CLIMB[index], ...copy, phase, seed };
}

export const STAGES: Record<MapId, StageDef[]> = {
  mycelion: [
    stratum(0, {
      name: "Spore Meadow",
      place: "Open caps, thin mist",
      blurb: "The swarm is young here. Lanes run straighter, packs are thin, and the veins are only just awake.",
      fog: "#16382c",
      sky: "#10241c",
      groundTint: "#d7f3e4",
      hillTint: "#c5e6d4",
      mistColor: "#d8ffe8",
    }, 2.2, 1101),
    stratum(1, {
      name: "Marrow Canyon",
      place: "The lattice as first held",
      blurb: "Cuts in the marrow and a working glow. This is the Mycelion line the ward was built against.",
      fog: "#081411",
      sky: "#050d0b",
      groundTint: "#e8e4dc",
      hillTint: "#f2f4f1",
      mistColor: "#6fe8c0",
    }, 0, 1202),
    stratum(2, {
      name: "Bloom Mire",
      place: "Standing water, heavy spores",
      blurb: "The ground drinks light. Fog sits low, packs overlap, and new gates open a wave early.",
      fog: "#0a1c14",
      sky: "#07140f",
      groundTint: "#8fbfa4",
      hillTint: "#6a9a7c",
      mistColor: "#3a8a5c",
    }, 11.4, 1303),
    stratum(3, {
      name: "Heart Lattice",
      place: "The core's own light",
      blurb: "Hosts come plated and fast, from more gates, sooner. The veins never go dark.",
      fog: "#04110c",
      sky: "#030a08",
      groundTint: "#4d7a62",
      hillTint: "#2f4e3e",
      mistColor: "#c6ff6a",
    }, 23.7, 1404),
  ],
  forge: [
    stratum(0, {
      name: "Ash Flats",
      place: "Cooled slag, wide sky",
      blurb: "The shelf has gone quiet. Cracks are rare, the march is slow, and you can see the rim.",
      fog: "#1c1612",
      sky: "#14100e",
      groundTint: "#c4a48e",
      hillTint: "#b09078",
      mistColor: "#6a5044",
    }, 4.1, 2101),
    stratum(1, {
      name: "Cinder Shelf",
      place: "The shelf still burns",
      blurb: "Heat in the stone and the forge line as it was first dropped. Cracks flicker, they do not own the field.",
      fog: "#130d0a",
      sky: "#0a0706",
      groundTint: "#e8e4dc",
      hillTint: "#f2f4f1",
      mistColor: "#3a2418",
    }, 0, 2202),
    stratum(2, {
      name: "Slag Basin",
      place: "A bowl of working metal",
      blurb: "Short sight, extra plate, and a hotter web of cracks. The second gate opens before you are ready.",
      fog: "#1a0c08",
      sky: "#120804",
      groundTint: "#a06040",
      hillTint: "#7a4030",
      mistColor: "#5a2410",
    }, 13.6, 2303),
    stratum(3, {
      name: "Core Crucible",
      place: "The forge's heart",
      blurb: "White cracks and a close sky. The march does not pause, and every host wears the crucible's plate.",
      fog: "#200a06",
      sky: "#1a0804",
      groundTint: "#c45a28",
      hillTint: "#8a3018",
      mistColor: "#ff6a1a",
    }, 27.2, 2404),
  ],
  aegis: [
    stratum(0, {
      name: "Rime Shelf",
      place: "Quiet ice, a pale band",
      blurb: "The rift is a rumor past the rim. Ice is bright, glints are few, and the lanes stay gentle.",
      fog: "#1a2832",
      sky: "#121a22",
      groundTint: "#d5e4ee",
      hillTint: "#c5d4e0",
      mistColor: "#eef6f8",
    }, 6.4, 3101),
    stratum(1, {
      name: "Scar Verge",
      place: "Flesh one side, steel the other",
      blurb: "The scar is the road. This is the rift as the ward first held it, split and awake.",
      fog: "#0a1016",
      sky: "#06090e",
      groundTint: "#aab6c2",
      hillTint: "#b4c0cc",
      mistColor: "#cfe8f2",
    }, 0, 3202),
    stratum(2, {
      name: "Glass Waste",
      place: "Ice gone to shards",
      blurb: "Glints multiply and the wind bends the lanes. Hosts wear plate, and the scar cuts deeper.",
      fog: "#0c141c",
      sky: "#070c12",
      groundTint: "#7e92a4",
      hillTint: "#6a7e90",
      mistColor: "#9fb8c8",
    }, 15.8, 3303),
    stratum(3, {
      name: "Rift Heart",
      place: "Night ice, hard aurora",
      blurb: "Both halves push at once. The aurora is a weather, the gates open early, and nothing is slow.",
      fog: "#071018",
      sky: "#04070c",
      groundTint: "#4a6274",
      hillTint: "#3a4e60",
      mistColor: "#7ee0ff",
    }, 29.5, 3404),
  ],
};

export function stageKey(id: MapId, index: number) {
  return `${id}:${clampStage(index)}`;
}

export function clampStage(index: number) {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(index)));
}

export function stageOf(id: MapId, index: number): StageDef {
  return STAGES[id][clampStage(index)];
}

/** Incursions between new gates. The base cadence is 5; later strata pull it down to 3. */
export function gateEvery(stage: StageDef) {
  return Math.max(3, 5 - stage.gatePull);
}

export const STAGE_RANK = ["I", "II", "III", "IV"] as const;
