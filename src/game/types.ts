export type Faction = "organic" | "mech" | "hybrid";
export type MapId = "mycelion" | "forge" | "aegis";
export type TowerId = "pulse" | "arc" | "frost" | "rail" | "tesla";
export type EnemyId =
  | "mite"
  | "brood"
  | "husk"
  | "spore"
  | "titan"
  | "myrmidon"
  | "bloom"
  | "colossus"
  | "thorn"
  | "drone"
  | "walker"
  | "siege"
  | "gunship"
  | "dread"
  | "bulwark"
  | "razor"
  | "leviathan"
  | "sentry"
  | "chimera"
  | "wraith"
  | "overlord"
  | "amalgam"
  | "specter"
  | "sovereign"
  | "relic";
export type HeroId = "fighter" | "ranger" | "mage";
export type ItemSlot = "weapon" | "armor";
export type ItemId =
  | "ion-cleaver"
  | "void-greatblade"
  | "plate-cuirass"
  | "aegis-plate"
  | "pulse-rifle"
  | "rail-longarm"
  | "scout-weave"
  | "ghost-harness"
  | "aether-rod"
  | "nova-crozier"
  | "veil-mantle"
  | "star-silk";
export type Targeting = "first" | "last" | "closest" | "strongest" | "weakest";
export type ProjectileKind = "bolt" | "shell" | "beam" | "rail" | "chain";
export type DamageKind = ProjectileKind | "surge";
export type EnemySkill = "regen" | "sprint" | "split" | "shield" | "harden";
export type Screen =
  | "title"
  | "select"
  | "briefing"
  | "playing"
  | "paused"
  | "won"
  | "lost"
  | "hero"
  | "loadout"
  | "help"
  | "settings"
  | "studio";
export type Quality = "high" | "low";

export type Cell = { c: number; r: number };

export type TowerDef = {
  id: TowerId;
  name: string;
  short: string;
  cost: number;
  range: number;
  fireRate: number;
  damage: number;
  kind: ProjectileKind;
  hitsFlying: boolean;
  splash: number;
  slow: number;
  slowTime: number;
  chain: number;
  pierce: boolean;
  color: string;
  desc: string;
};

export type EnemyDef = {
  id: EnemyId;
  name: string;
  faction: Faction;
  hp: number;
  speed: number;
  gold: number;
  armor: number;
  flying: boolean;
  scale: number;
  leak: number;
  boss?: boolean;
  /** Damage multiplier after armor. Below 1 resists, above 1 is a weakness. */
  resist?: Partial<Record<DamageKind, number>>;
  immuneSlow?: boolean;
  skill?: EnemySkill;
};

export type WaveGroup = {
  enemy: EnemyId;
  count: number;
  interval: number;
  delay: number;
};

export type WaveDef = { groups: WaveGroup[] };

export type MapDef = {
  id: MapId;
  name: string;
  subtitle: string;
  faction: Faction;
  lore: string;
  hint: string;
  cols: number;
  rows: number;
  path: Cell[];
  /** Extra lanes that open every 10 incursions. */
  branches?: Cell[][];
  pads: Cell[];
  startGold: number;
  lives: number;
  waves: WaveDef[];
};

export type Enemy = {
  slot: number;
  type: EnemyId;
  hp: number;
  maxHp: number;
  speed: number;
  gold: number;
  armor: number;
  flying: boolean;
  leak: number;
  scale: number;
  boss: boolean;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  wp: number;
  pathId: number;
  progress: number;
  vx: number;
  vz: number;
  slowUntil: number;
  slowFactor: number;
  hitFlash: number;
  lane: number;
  skillT: number;
  shieldHp: number;
  hardenUntil: number;
  sprintUntil: number;
};

export type Tower = {
  id: number;
  type: TowerId;
  pad: number;
  x: number;
  z: number;
  y: number;
  level: number;
  cooldown: number;
  yaw: number;
  targeting: Targeting;
  invested: number;
  kills: number;
  aiming: boolean;
};

export type Bolt = {
  slot: number;
  alive: boolean;
  kind: "bolt" | "shell";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  damage: number;
  splash: number;
  slow: number;
  slowTime: number;
  targetSlot: number;
  ttl: number;
  color: string;
};

export type BeamStyle = "lance" | "chain" | "rail";

export type Beam = {
  slot: number;
  alive: boolean;
  style: BeamStyle;
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  ttl: number;
  maxTtl: number;
  color: string;
  width: number;
  seed: number;
};

export type Burst = {
  slot: number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  ttl: number;
  maxTtl: number;
  size: number;
  color: string;
};

export type Floater = {
  slot: number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  ttl: number;
  text: string;
};

export type DecalKind = "frost" | "rank" | "scorch";

export type Decal = {
  slot: number;
  alive: boolean;
  kind: DecalKind;
  x: number;
  z: number;
  ttl: number;
  maxTtl: number;
  size: number;
  color: string;
};
