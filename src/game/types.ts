export type Faction = "organic" | "mech" | "hybrid";
export type MapId = "mycelion" | "forge" | "aegis";
export type TowerId = "pulse" | "arc" | "frost" | "rail" | "tesla";
export type EnemyId =
  | "mite"
  | "brood"
  | "husk"
  | "spore"
  | "titan"
  | "drone"
  | "walker"
  | "siege"
  | "gunship"
  | "dread"
  | "chimera"
  | "wraith"
  | "overlord";
export type Targeting = "first" | "last" | "closest" | "strongest" | "weakest";
export type ProjectileKind = "bolt" | "shell" | "beam" | "rail" | "chain";
export type Screen =
  | "title"
  | "select"
  | "briefing"
  | "playing"
  | "paused"
  | "won"
  | "lost"
  | "help"
  | "settings";
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
  progress: number;
  vx: number;
  vz: number;
  slowUntil: number;
  slowFactor: number;
  hitFlash: number;
  lane: number;
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

export type Beam = {
  slot: number;
  alive: boolean;
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
