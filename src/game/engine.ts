import {
  AUTO_WAVE_DELAY,
  ENEMIES,
  inflateSpawnCount,
  MAX_BEAMS,
  MAX_BOLTS,
  MAX_BURSTS,
  MAX_DECALS,
  MAX_ENEMIES,
  MAX_FLOATERS,
  OVERCLOCK_CD,
  OVERCLOCK_DUR,
  SALVAGE_RATE,
  STEP,
  SURGE_CD,
  SYN_RANGE,
  TOWERS,
  towerStats,
  upgradeCost,
} from "./config";
import { HEROES, emptyLoadouts, heroStats, type HeroLoadout, type HeroStats } from "./heroes";
import { MAPS, cellToWorld } from "./maps";
import type {
  Beam,
  BeamStyle,
  Bolt,
  Burst,
  DamageKind,
  Decal,
  DecalKind,
  Enemy,
  EnemyId,
  Floater,
  HeroId,
  MapDef,
  MapId,
  Targeting,
  Tower,
  TowerId,
} from "./types";

export type HeroState = {
  id: HeroId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  cooldown: number;
  abilityCd: number;
  loadout: HeroLoadout;
  stats: HeroStats;
  swing: number;
};

export type CombatPhase = "idle" | "build" | "combat" | "won" | "lost";

type SpawnEvent = { t: number; type: EnemyId; pathId: number };

const GATE_EVERY = 10;

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export class GameEngine {
  map: MapDef = MAPS.mycelion;
  phase: CombatPhase = "idle";
  gold = 0;
  lives = 0;
  wave = 0;
  kills = 0;
  leaked = 0;
  time = 0;
  visualTime = 0;
  acc = 0;
  trauma = 0;
  selectedTower: number | null = null;
  buildType: TowerId | null = null;
  hoverPad: number | null = null;

  waypoints: { x: number; y: number; z: number }[] = [];
  paths: { x: number; y: number; z: number }[][] = [];
  padWorld: { x: number; z: number }[] = [];
  occupied: number[] = [];

  towers: Tower[] = [];
  enemies: Enemy[] = [];
  bolts: Bolt[] = [];
  beams: Beam[] = [];
  bursts: Burst[] = [];
  floaters: Floater[] = [];
  decals: Decal[] = [];

  spawnQueue: SpawnEvent[] = [];
  spawnT = 0;
  spawnI = 0;
  remainingInWave = 0;

  nextTowerId = 1;
  hudDirty = true;
  lastEvent: string | null = null;
  spawnGen = 0;
  sfx:
    | "place"
    | "shoot"
    | "boom"
    | "leak"
    | "wave"
    | "ui"
    | "surge"
    | "overclock"
    | "rank"
    | "deny"
    | null = null;
  speed = 1;
  autoWave = false;
  autoT = 0;
  buildClock = 0;
  combo = 0;
  comboUntil = 0;
  goldEarned = 0;
  surgeCd = 0;
  overclockCd = 0;
  overclockUntil = 0;
  lastBonus = 0;
  lastShooter: Tower | null = null;
  fireGen = 0;
  /** Bumped whenever an action is refused for lack of credits, so the HUD can flash the cost. */
  denyGen = 0;
  denyType: TowerId | null = null;
  denyShort = 0;
  placeGen = 0;
  rankGen = 0;
  leakGen = 0;
  hero: HeroState = {
    id: "fighter",
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    cooldown: 0,
    abilityCd: 0,
    loadout: emptyLoadouts().fighter,
    stats: heroStats("fighter", emptyLoadouts().fighter),
    swing: 0,
  };

  constructor() {
    this.resetPools();
  }

  resetPools() {
    this.enemies = Array.from({ length: MAX_ENEMIES }, (_, slot) => this.emptyEnemy(slot));
    this.bolts = Array.from({ length: MAX_BOLTS }, (_, slot) => this.emptyBolt(slot));
    this.beams = Array.from({ length: MAX_BEAMS }, (_, slot) => this.emptyBeam(slot));
    this.bursts = Array.from({ length: MAX_BURSTS }, (_, slot) => this.emptyBurst(slot));
    this.floaters = Array.from({ length: MAX_FLOATERS }, (_, slot) => this.emptyFloater(slot));
    this.decals = Array.from({ length: MAX_DECALS }, (_, slot) => this.emptyDecal(slot));
  }

  emptyEnemy(slot: number): Enemy {
    return {
      slot,
      type: "mite",
      hp: 0,
      maxHp: 1,
      speed: 0,
      gold: 0,
      armor: 0,
      flying: false,
      leak: 1,
      scale: 1,
      boss: false,
      alive: false,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      wp: 0,
      pathId: 0,
      progress: 0,
      vx: 0,
      vz: 0,
      slowUntil: 0,
      slowFactor: 1,
      hitFlash: 0,
      lane: 0,
      skillT: 0,
      shieldHp: 0,
      hardenUntil: 0,
      sprintUntil: 0,
    };
  }

  emptyBolt(slot: number): Bolt {
    return {
      slot,
      alive: false,
      kind: "bolt",
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      speed: 0,
      damage: 0,
      splash: 0,
      slow: 0,
      slowTime: 0,
      targetSlot: -1,
      ttl: 0,
      color: "#fff",
    };
  }

  emptyBeam(slot: number): Beam {
    return {
      slot,
      alive: false,
      style: "lance",
      x1: 0,
      y1: 0,
      z1: 0,
      x2: 0,
      y2: 0,
      z2: 0,
      ttl: 0,
      maxTtl: 0.12,
      color: "#fff",
      width: 0.08,
      seed: 0,
    };
  }

  emptyBurst(slot: number): Burst {
    return {
      slot,
      alive: false,
      x: 0,
      y: 0,
      z: 0,
      ttl: 0,
      maxTtl: 0.35,
      size: 0.6,
      color: "#fff",
    };
  }

  emptyFloater(slot: number): Floater {
    return { slot, alive: false, x: 0, y: 0, z: 0, ttl: 0, text: "" };
  }

  emptyDecal(slot: number): Decal {
    return { slot, alive: false, kind: "frost", x: 0, z: 0, ttl: 0, maxTtl: 1, size: 1, color: "#fff" };
  }

  load(id: MapId, heroId: HeroId = "fighter", loadout: HeroLoadout = emptyLoadouts()[heroId]) {
    const map = MAPS[id];
    this.map = map;
    this.phase = "build";
    this.gold = map.startGold;
    this.lives = map.lives;
    this.wave = 0;
    this.kills = 0;
    this.leaked = 0;
    this.time = 0;
    this.visualTime = 0;
    this.acc = 0;
    this.trauma = 0;
    this.selectedTower = null;
    this.buildType = "pulse";
    this.hoverPad = null;
    this.towers = [];
    this.occupied = Array(map.pads.length).fill(-1);
    this.nextTowerId = 1;
    this.spawnQueue = [];
    this.spawnI = 0;
    this.spawnT = 0;
    this.remainingInWave = 0;
    this.resetPools();
    const cellPaths = [map.path, ...(map.branches ?? [])];
    this.paths = cellPaths.map((cells) =>
      cells.map((p) => {
        const w = cellToWorld(p.c, p.r, map.cols, map.rows);
        return { x: w.x, y: 0, z: w.z };
      }),
    );
    this.waypoints = this.paths[0] ?? [];
    this.padWorld = map.pads.map((p) => cellToWorld(p.c, p.r, map.cols, map.rows));
    this.hudDirty = true;
    this.lastEvent = `${map.name} · core online`;
    this.spawnGen = 0;
    this.sfx = null;
    this.speed = 1;
    this.autoWave = false;
    this.autoT = 0;
    this.buildClock = 0;
    this.combo = 0;
    this.comboUntil = 0;
    this.goldEarned = 0;
    this.surgeCd = 0;
    this.overclockCd = 0;
    this.overclockUntil = 0;
    this.lastBonus = 0;
    this.denyGen = 0;
    this.denyType = null;
    this.denyShort = 0;
    this.placeGen = 0;
    this.rankGen = 0;
    this.leakGen = 0;
    this.fireGen = 0;
    this.lastShooter = null;
    this.placeHero(heroId, loadout);
  }

  placeHero(id: HeroId, loadout: HeroLoadout) {
    const end = this.endWorld();
    const prev = this.waypoints[this.waypoints.length - 2] ?? end;
    const dx = end.x - prev.x;
    const dz = end.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    this.hero.id = id;
    this.hero.loadout = { ...loadout };
    this.hero.stats = heroStats(id, loadout);
    this.hero.x = end.x - ux * 2.05 + -uz * 1.55;
    this.hero.y = 0;
    this.hero.z = end.z - uz * 2.05 + ux * 1.55;
    this.hero.yaw = Math.atan2(dx, dz);
    this.hero.cooldown = 0;
    this.hero.abilityCd = 0;
    this.hero.swing = 0;
  }

  applyHeroGear(loadout: HeroLoadout) {
    this.hero.loadout = { ...loadout };
    this.hero.stats = heroStats(this.hero.id, loadout);
    this.hudDirty = true;
  }

  startWave() {
    if (this.phase !== "build") return false;
    if (this.wave >= this.map.waves.length) return false;
    const bonus = this.earlyBonus();
    if (bonus > 0) {
      this.gold += bonus;
      this.goldEarned += bonus;
      this.lastBonus = bonus;
    } else {
      this.lastBonus = 0;
    }
    const waveIndex = this.wave;
    const def = this.map.waves[waveIndex];
    const gates = this.pathCountForIndex(waveIndex);
    this.spawnQueue = [];
    let spawnN = 0;
    for (const g of def.groups) {
      const count = inflateSpawnCount(g.enemy, g.count, waveIndex);
      for (let i = 0; i < count; i++) {
        this.spawnQueue.push({ t: g.delay + i * g.interval, type: g.enemy, pathId: spawnN % gates });
        spawnN += 1;
      }
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    this.spawnI = 0;
    this.spawnT = 0;
    this.remainingInWave = this.spawnQueue.length;
    this.phase = "combat";
    this.wave += 1;
    this.hudDirty = true;
    const opened = waveIndex > 0 && waveIndex % GATE_EVERY === 0 && gates > 1;
    this.lastEvent = opened
      ? `Incursion ${this.wave} · gate ${gates} online`
      : bonus > 0
        ? `Incursion ${this.wave} · +${bonus} early`
        : `Incursion ${this.wave} of ${this.map.waves.length}`;
    this.addTrauma(0.18);
    this.sfx = "wave";
    this.autoT = 0;
    return true;
  }

  earlyBonus() {
    if (this.wave === 0) return 0;
    const max = 10 + this.wave * 3;
    const t = Math.min(1, this.buildClock / 16);
    return Math.round(max * (1 - t));
  }

  cycleSpeed() {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    this.hudDirty = true;
  }

  setSpeed(n: number) {
    this.speed = n === 2 || n === 3 ? n : 1;
    this.hudDirty = true;
  }

  toggleAutoWave() {
    this.autoWave = !this.autoWave;
    this.hudDirty = true;
    this.lastEvent = this.autoWave ? "Auto-incursion on" : "Auto-incursion off";
  }

  castSurge() {
    if (this.phase === "idle" || this.phase === "won" || this.phase === "lost") return false;
    if (this.surgeCd > 0) return false;
    this.surgeCd = SURGE_CD;
    const core = this.endWorld();
    this.spawnBurst(core.x, 0.6, core.z, 4.2, "#8fb4c4");
    this.spawnBurst(core.x, 1.2, core.z, 2.4, "#cfe4ee");
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.hurt(e, 36, "surge");
      this.applySlow(e, 0.38, 2.8);
      n += 1;
    }
    this.addTrauma(0.42);
    this.sfx = "surge";
    this.lastEvent = n ? `Ion surge · ${n} marked` : "Ion surge · empty grid";
    this.hudDirty = true;
    return true;
  }

  castOverclock() {
    if (this.phase === "idle" || this.phase === "won" || this.phase === "lost") return false;
    if (this.overclockCd > 0) return false;
    this.overclockCd = OVERCLOCK_CD;
    this.overclockUntil = this.time + OVERCLOCK_DUR;
    this.addTrauma(0.22);
    this.sfx = "overclock";
    this.lastEvent = "Grid overclock";
    this.hudDirty = true;
    return true;
  }

  synergy(t: Tower) {
    const r2 = SYN_RANGE * SYN_RANGE;
    for (const o of this.towers) {
      if (o.id === t.id || o.type !== t.type) continue;
      if (dist2(t.x, t.z, o.x, o.z) <= r2) return true;
    }
    return false;
  }

  nextWaveGroups() {
    const idx = this.phase === "combat" ? this.wave - 1 : this.wave;
    const def = this.map.waves[idx];
    if (!def) return [] as { enemy: EnemyId; count: number }[];
    return def.groups.map((g) => ({
      enemy: g.enemy,
      count: inflateSpawnCount(g.enemy, g.count, idx),
    }));
  }

  placeOnPad(pad: number) {
    if (this.phase === "won" || this.phase === "lost") return false;
    const type = this.buildType;
    if (!type) return false;
    if (pad < 0 || pad >= this.padWorld.length) return false;
    if (this.occupied[pad] !== -1) return false;
    const def = TOWERS[type];
    if (this.gold < def.cost) {
      this.deny(def.cost - this.gold, type);
      return false;
    }
    this.gold -= def.cost;
    const w = this.padWorld[pad];
    const tower: Tower = {
      id: this.nextTowerId++,
      type,
      pad,
      x: w.x,
      z: w.z,
      y: 0,
      level: 1,
      cooldown: 0,
      yaw: 0,
      targeting: "first",
      invested: def.cost,
      kills: 0,
      aiming: false,
    };
    this.towers.push(tower);
    this.occupied[pad] = tower.id;
    // Stay in build mode so a line can be laid without re-arming the tray each time.
    this.selectedTower = null;
    this.placeGen += 1;
    this.hudDirty = true;
    this.lastEvent = `${def.name} deployed · ${this.gold} left`;
    this.addTrauma(0.08);
    this.sfx = "place";
    this.spawnDecal(w.x, w.z, 1.05, def.color, "rank");
    return true;
  }

  selectPad(pad: number) {
    if (this.occupied[pad] !== -1) {
      this.selectedTower = this.occupied[pad];
      this.buildType = null;
      this.hudDirty = true;
      return;
    }
    if (!this.buildType) {
      this.selectedTower = null;
      this.hudDirty = true;
      return;
    }
    this.placeOnPad(pad);
  }

  setBuildType(type: TowerId | null) {
    this.buildType = type;
    if (type) this.selectedTower = null;
    this.hudDirty = true;
  }

  cancelBuild() {
    if (!this.buildType) return false;
    this.buildType = null;
    this.hudDirty = true;
    return true;
  }

  deny(short: number, type: TowerId | null) {
    this.denyGen += 1;
    this.denyType = type;
    this.denyShort = Math.max(1, Math.round(short));
    this.lastEvent = `Need ${this.denyShort} more credits`;
    this.sfx = "deny";
    this.hudDirty = true;
  }

  getSelected(): Tower | undefined {
    if (this.selectedTower == null) return undefined;
    return this.towers.find((t) => t.id === this.selectedTower);
  }

  upgradeSelected() {
    const t = this.getSelected();
    if (!t || t.level >= 3) return false;
    const def = TOWERS[t.type];
    const cost = upgradeCost(def.cost, t.level);
    if (this.gold < cost) {
      this.deny(cost - this.gold, t.type);
      return false;
    }
    this.gold -= cost;
    t.level += 1;
    t.invested += cost;
    this.rankGen += 1;
    this.hudDirty = true;
    this.lastEvent = `${def.name} · rank ${t.level}`;
    this.addTrauma(0.1);
    this.sfx = "rank";
    this.spawnDecal(t.x, t.z, t.level >= 3 ? 1.85 : 1.45, def.color, "rank");
    this.spawnBurst(t.x, 0.9, t.z, t.level >= 3 ? 0.85 : 0.6, def.color);
    return true;
  }

  sellSelected() {
    const t = this.getSelected();
    if (!t) return false;
    const refund = this.refundFor(t);
    this.gold += refund;
    this.occupied[t.pad] = -1;
    this.towers = this.towers.filter((x) => x.id !== t.id);
    this.selectedTower = null;
    this.hudDirty = true;
    this.lastEvent = `Salvaged +${refund} credits`;
    this.spawnFloater(t.x, 1.1, t.z, `+${refund}`);
    this.spawnBurst(t.x, 0.5, t.z, 0.7, "#8fb4c4");
    this.sfx = "place";
    return true;
  }

  refundFor(t: Tower) {
    return Math.floor(t.invested * SALVAGE_RATE);
  }

  cycleTargeting() {
    const t = this.getSelected();
    if (!t) return;
    const order: Targeting[] = ["first", "last", "closest", "strongest", "weakest"];
    t.targeting = order[(order.indexOf(t.targeting) + 1) % order.length];
    this.hudDirty = true;
  }

  setTargeting(policy: Targeting) {
    const t = this.getSelected();
    if (!t) return;
    t.targeting = policy;
    this.hudDirty = true;
  }

  addTrauma(v: number) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  update(dt: number, paused: boolean) {
    const scale = paused ? 1 : this.speed;
    const d = Math.min(dt, 0.08) * scale;
    this.visualTime += d;
    this.trauma = Math.max(0, this.trauma - d * 1.6);
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - d * 6);
    }
    for (const b of this.beams) {
      if (!b.alive) continue;
      b.ttl -= d;
      if (b.ttl <= 0) b.alive = false;
    }
    for (const b of this.bursts) {
      if (!b.alive) continue;
      b.ttl -= d;
      if (b.ttl <= 0) b.alive = false;
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.ttl -= d;
      f.y += d * 1.4;
      if (f.ttl <= 0) f.alive = false;
    }
    for (const g of this.decals) {
      if (!g.alive) continue;
      g.ttl -= d;
      if (g.ttl <= 0) g.alive = false;
    }
    if (paused || this.phase === "won" || this.phase === "lost" || this.phase === "idle") return;
    this.acc += d;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
  }

  step(dt: number) {
    this.time += dt;
    if (this.surgeCd > 0) this.surgeCd = Math.max(0, this.surgeCd - dt);
    if (this.overclockCd > 0) this.overclockCd = Math.max(0, this.overclockCd - dt);
    if (this.hero.abilityCd > 0) this.hero.abilityCd = Math.max(0, this.hero.abilityCd - dt);
    if (this.hero.swing > 0) this.hero.swing = Math.max(0, this.hero.swing - dt);
    if (this.phase === "build") {
      this.buildClock += dt;
      if (this.autoWave && this.wave > 0 && this.wave < this.map.waves.length) {
        this.autoT += dt;
        if (this.autoT >= AUTO_WAVE_DELAY) this.startWave();
      }
    } else {
      this.buildClock = 0;
    }
    if (this.phase === "combat") this.spawnStep(dt);
    this.moveEnemies(dt);
    this.tickTowers(dt);
    this.tickHero(dt);
    this.moveBolts(dt);
    if (this.phase === "combat") this.checkWaveEnd();
  }

  spawnStep(dt: number) {
    this.spawnT += dt;
    while (this.spawnI < this.spawnQueue.length && this.spawnQueue[this.spawnI].t <= this.spawnT) {
      const ev = this.spawnQueue[this.spawnI];
      this.spawnEnemy(ev.type, undefined, ev.pathId);
      this.spawnI++;
    }
  }

  spawnEnemy(
    type: EnemyId,
    at?: { x: number; z: number; y: number; wp: number; progress: number; lane: number; gold?: number; pathId?: number },
    pathId = 0,
  ) {
    const def = ENEMIES[type];
    const slot = this.enemies.find((e) => !e.alive);
    if (!slot) return;
    const pid = at?.pathId ?? pathId;
    const wps = this.paths[pid] ?? this.waypoints;
    const start = wps[0];
    const next = wps[1] ?? start;
    const ddx = next.x - start.x;
    const ddz = next.z - start.z;
    const dlen = Math.hypot(ddx, ddz) || 1;
    const waveScale = 1 + (this.wave - 1) * 0.04;
    slot.alive = true;
    slot.type = type;
    slot.maxHp = Math.round(def.hp * waveScale);
    slot.hp = slot.maxHp;
    slot.speed = def.speed;
    slot.gold = at?.gold ?? def.gold;
    slot.armor = def.armor;
    slot.flying = def.flying;
    slot.leak = def.leak;
    slot.scale = def.scale;
    slot.boss = !!def.boss;
    slot.x = at ? at.x : start.x + (ddx / dlen) * 0.6;
    slot.z = at ? at.z : start.z + (ddz / dlen) * 0.6;
    slot.y = at ? at.y : def.flying ? 1.55 : 0.28 * def.scale;
    slot.yaw = 0;
    slot.wp = at ? at.wp : 1;
    slot.pathId = pid;
    slot.progress = at ? at.progress : 0;
    slot.vx = 0;
    slot.vz = 0;
    slot.slowUntil = 0;
    slot.slowFactor = 1;
    slot.hitFlash = 0;
    slot.lane = at ? at.lane : ((slot.slot % 5) - 2) * 0.16;
    slot.skillT = 0;
    slot.shieldHp = def.skill === "shield" ? (def.boss ? 90 : 32) : 0;
    slot.hardenUntil = 0;
    slot.sprintUntil = 0;
    this.spawnGen += 1;
    this.hudDirty = true;
  }

  moveEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const wps = this.paths[e.pathId] ?? this.waypoints;
      if (wps.length < 2) continue;
      if (this.time < e.slowUntil) {
        /* keep */
      } else {
        e.slowFactor = 1;
      }
      this.tickSkill(e, dt);
      if (e.wp >= wps.length) {
        this.leak(e);
        continue;
      }
      const sprint = this.time < e.sprintUntil ? 1.55 : 1;
      const pace = e.speed * e.slowFactor * sprint;
      const target = wps[e.wp];
      const prev = wps[Math.max(0, e.wp - 1)];
      const pdx = target.x - prev.x;
      const pdz = target.z - prev.z;
      const plen = Math.hypot(pdx, pdz) || 1;
      const nx = -pdz / plen;
      const nz = pdx / plen;
      const tx = target.x + nx * e.lane;
      const tz = target.z + nz * e.lane;
      const dx = tx - e.x;
      const dz = tz - e.z;
      const dist = Math.hypot(dx, dz);
      const step = pace * dt;
      if (dist <= step || dist < 0.04) {
        e.x = tx;
        e.z = tz;
        e.wp += 1;
        e.progress = e.wp;
        if (e.wp >= wps.length) this.leak(e);
        continue;
      }
      const inv = 1 / dist;
      e.vx = dx * inv * pace;
      e.vz = dz * inv * pace;
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      e.yaw = Math.atan2(dx, dz);
      e.progress = e.wp + (1 - dist / plen);
      if (e.flying) {
        e.y = 1.55 + Math.sin(this.time * 3 + e.slot) * 0.08;
      }
    }
  }

  tickSkill(e: Enemy, dt: number) {
    const def = ENEMIES[e.type];
    const skill = def.skill;
    if (!skill) return;
    e.skillT += dt;
    if (skill === "regen") {
      const rate = e.boss ? 16 : def.flying ? 3.2 : 5.5;
      if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + rate * dt);
      return;
    }
    if (skill === "sprint") {
      if (e.skillT >= 3.1) {
        e.skillT = 0;
        e.sprintUntil = this.time + 0.85;
      }
      return;
    }
    if (skill === "shield" && e.skillT >= 6.8) {
      e.skillT = 0;
      e.shieldHp = e.boss ? 90 : 32;
    }
  }

  applySlow(e: Enemy, factor: number, duration: number) {
    if (ENEMIES[e.type].immuneSlow) return;
    e.slowFactor = factor;
    e.slowUntil = this.time + duration;
  }

  leak(e: Enemy) {
    e.alive = false;
    this.lives = Math.max(0, this.lives - e.leak);
    this.leaked += 1;
    this.leakGen += 1;
    this.hudDirty = true;
    this.lastEvent = `Core breached · −${e.leak}`;
    this.addTrauma(0.55);
    this.sfx = "leak";
    this.spawnBurst(e.x, e.y + 0.4, e.z, 1.2, "#c45c5c");
    const core = this.endWorld();
    this.spawnBurst(core.x, 1.1, core.z, 2.1, "#c45c5c");
    this.spawnDecal(core.x, core.z, 2.6, "#c45c5c", "scorch");
    if (this.lives <= 0) {
      this.phase = "lost";
      this.lastEvent = "Core collapsed";
    }
  }

  tickTowers(dt: number) {
    for (const t of this.towers) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      const def = TOWERS[t.type];
      const stats = towerStats(def, t.level);
      const haste = this.time < this.overclockUntil ? 1.55 : 1;
      const target = this.pickTarget(t, stats.range, def.hitsFlying);
      t.aiming = !!target;
      if (!target) continue;
      const dx = target.x - t.x;
      const dz = target.z - t.z;
      t.yaw = Math.atan2(dx, dz);
      if (t.cooldown > 0) continue;
      this.fire(t, target, def, stats);
      t.cooldown = 1 / (stats.fireRate * haste);
      this.sfx = "shoot";
    }
  }

  tickHero(dt: number) {
    if (this.phase === "idle" || this.phase === "won" || this.phase === "lost") return;
    const h = this.hero;
    const stats = h.stats;
    h.cooldown = Math.max(0, h.cooldown - dt);
    const target = this.pickHeroTarget(stats.range, stats.hitsFlying);
    if (!target) return;
    const dx = target.x - h.x;
    const dz = target.z - h.z;
    h.yaw = Math.atan2(dx, dz);
    if (h.cooldown > 0) return;
    this.fireHero(target);
    const haste = this.time < this.overclockUntil ? 1.35 : 1;
    h.cooldown = 1 / (stats.fireRate * haste);
    h.swing = 0.22;
    this.sfx = "shoot";
    this.hudDirty = true;
  }

  pickHeroTarget(range: number, flying: boolean): Enemy | null {
    const r2 = range * range;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flying && !flying) continue;
      const d2 = dist2(this.hero.x, this.hero.z, e.x, e.z);
      if (d2 > r2) continue;
      const score = e.progress - d2 * 0.02;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  fireHero(target: Enemy) {
    const h = this.hero;
    const stats = h.stats;
    const kind = stats.kind;
    const y = 1.15;
    if (h.id === "fighter") {
      this.spawnBurst(target.x, target.y + 0.35, target.z, 0.55, stats.color);
      this.hurt(target, stats.damage, kind);
      const splash = this.hero.loadout.weapon === "void-greatblade" ? 1.35 : 0.85;
      for (const e of this.enemies) {
        if (!e.alive || e.slot === target.slot || e.flying) continue;
        if (dist2(target.x, target.z, e.x, e.z) <= splash * splash) this.hurt(e, stats.damage * 0.45, kind);
      }
    } else if (h.id === "ranger") {
      const bolt = this.bolts.find((b) => !b.alive);
      if (!bolt) {
        this.hurt(target, stats.damage, kind);
        return;
      }
      const dx = target.x - h.x;
      const dy = target.y + 0.25 - y;
      const dz = target.z - h.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const speed = 20;
      bolt.alive = true;
      bolt.kind = "bolt";
      bolt.x = h.x;
      bolt.y = y;
      bolt.z = h.z;
      bolt.vx = (dx / len) * speed;
      bolt.vy = (dy / len) * speed;
      bolt.vz = (dz / len) * speed;
      bolt.speed = speed;
      bolt.damage = stats.damage;
      bolt.splash = 0;
      bolt.slow = 0;
      bolt.slowTime = 0;
      bolt.targetSlot = target.slot;
      bolt.ttl = 2.2;
      bolt.color = stats.color;
    } else {
      this.spawnBeam(h.x, 1.35, h.z, target.x, target.y + 0.28, target.z, stats.color, 0.14, 0.07, "lance");
      this.hurt(target, stats.damage, kind);
    }
  }

  castHeroAbility() {
    if (this.phase === "idle" || this.phase === "won" || this.phase === "lost") return false;
    const h = this.hero;
    if (h.abilityCd > 0) return false;
    const stats = h.stats;
    h.abilityCd = stats.abilityCd;
    h.swing = 0.34;
    const def = HEROES[h.id];
    if (h.id === "fighter") {
      const reach = stats.range + 1.15;
      let n = 0;
      for (const e of this.enemies) {
        if (!e.alive || e.flying) continue;
        if (dist2(h.x, h.z, e.x, e.z) <= reach * reach) {
          this.hurt(e, stats.damage * 2.15, stats.kind);
          n += 1;
        }
      }
      this.spawnBurst(h.x + Math.sin(h.yaw) * 1.1, 0.7, h.z + Math.cos(h.yaw) * 1.1, 2.2, stats.color);
      this.lastEvent = n ? `${def.ability} · ${n} cut` : `${def.ability} · empty arc`;
    } else if (h.id === "ranger") {
      const marked: Enemy[] = [];
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (dist2(h.x, h.z, e.x, e.z) <= (stats.range + 1.4) * (stats.range + 1.4)) marked.push(e);
      }
      marked.sort((a, b) => dist2(h.x, h.z, a.x, a.z) - dist2(h.x, h.z, b.x, b.z));
      const shots = marked.slice(0, 5);
      for (const e of shots) this.fireHero(e);
      this.lastEvent = shots.length ? `${def.ability} · ${shots.length} marked` : `${def.ability} · no shot`;
    } else {
      const reach = 4.4 + (h.loadout.weapon === "nova-crozier" ? 0.6 : 0);
      let n = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (dist2(h.x, h.z, e.x, e.z) <= reach * reach) {
          this.hurt(e, stats.damage * 1.55, stats.kind);
          n += 1;
        }
      }
      this.spawnBurst(h.x, 1.1, h.z, 3.6, stats.color);
      this.lastEvent = n ? `${def.ability} · ${n} scorched` : `${def.ability} · empty grid`;
    }
    this.addTrauma(0.28);
    this.sfx = "surge";
    this.hudDirty = true;
    return true;
  }

  pickTarget(t: Tower, range: number, flying: boolean): Enemy | null {
    const r2 = range * range;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flying && !flying) continue;
      const d2 = dist2(t.x, t.z, e.x, e.z);
      if (d2 > r2) continue;
      let score = 0;
      if (t.targeting === "first") score = e.progress;
      else if (t.targeting === "last") score = -e.progress;
      else if (t.targeting === "closest") score = -d2;
      else if (t.targeting === "strongest") score = e.hp;
      else score = -e.hp;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  fire(
    t: Tower,
    target: Enemy,
    def: (typeof TOWERS)[TowerId],
    stats: ReturnType<typeof towerStats>,
  ) {
    const muzzleY = 0.85 + (t.level - 1) * 0.08;
    this.lastShooter = t;
    this.fireGen += 1;
    const syn = this.synergy(t) ? 1.15 : 1;
    const rank = t.level >= 3 ? 1.12 : 1;
    const dmg = stats.damage * syn * rank;
    if (def.kind === "bolt" || def.kind === "shell") {
      const lead = def.kind === "shell" ? 0.35 : 0.12;
      const aimX = target.x + target.vx * lead;
      const aimZ = target.z + target.vz * lead;
      const aimY = target.y + 0.2;
      const dx = aimX - t.x;
      const dy = aimY - muzzleY;
      const dz = aimZ - t.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const speed = def.kind === "shell" ? 11 : 18;
      const shots = t.type === "pulse" && t.level >= 3 ? 2 : 1;
      for (let s = 0; s < shots; s++) {
        const bolt = this.bolts.find((b) => !b.alive);
        if (!bolt) break;
        const spread = shots === 2 ? (s === 0 ? -0.08 : 0.08) : 0;
        bolt.alive = true;
        bolt.kind = def.kind === "shell" ? "shell" : "bolt";
        bolt.x = t.x;
        bolt.y = muzzleY;
        bolt.z = t.z;
        bolt.vx = (dx / len) * speed + spread * 4;
        bolt.vy = (dy / len) * speed;
        bolt.vz = (dz / len) * speed;
        bolt.speed = speed;
        bolt.damage = dmg;
        bolt.splash = stats.splash * (t.level >= 3 && t.type === "frost" ? 1.2 : 1);
        bolt.slow = t.level >= 3 && t.type === "frost" ? Math.min(0.32, def.slow) : def.slow;
        bolt.slowTime = def.slowTime + (t.level >= 3 ? 0.6 : 0);
        bolt.targetSlot = target.slot;
        bolt.ttl = 2.4;
        bolt.color = def.color;
      }
    } else if (def.kind === "beam") {
      const wide = t.level >= 3;
      this.spawnBeam(
        t.x,
        muzzleY + 0.4,
        t.z,
        target.x,
        target.y + 0.2,
        target.z,
        def.color,
        0.1,
        wide ? 0.085 : 0.05,
        "lance",
      );
      this.hurt(target, dmg, "beam");
      if (wide) {
        // Wide Lance: the overcharged beam splits onto one neighbouring host.
        const split = this.nearestEnemy(target.x, target.z, 1.35, new Set([target.slot]), def.hitsFlying);
        if (split) {
          this.spawnBeam(target.x, target.y + 0.2, target.z, split.x, split.y + 0.2, split.z, def.color, 0.09, 0.06, "lance");
          this.hurt(split, dmg * 0.5, "beam");
        }
      }
    } else if (def.kind === "rail") {
      const dx = target.x - t.x;
      const dz = target.z - t.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len;
      const uz = dz / len;
      const endX = t.x + ux * stats.range;
      const endZ = t.z + uz * stats.range;
      const width = t.level >= 3 ? 0.82 : 0.55;
      this.spawnBeam(t.x, muzzleY, t.z, endX, muzzleY, endZ, def.color, 0.18, width * 0.34, "rail");
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.flying && !def.hitsFlying) continue;
        const px = e.x - t.x;
        const pz = e.z - t.z;
        const along = px * ux + pz * uz;
        if (along < 0 || along > stats.range) continue;
        const cx = t.x + ux * along;
        const cz = t.z + uz * along;
        if (dist2(cx, cz, e.x, e.z) < width * width) this.hurt(e, dmg, "rail");
      }
      this.addTrauma(0.12);
    } else if (def.kind === "chain") {
      const hit = new Set<number>();
      let cur: Enemy | null = target;
      let fromX = t.x;
      let fromY = muzzleY + 0.6;
      let fromZ = t.z;
      const jumps = Math.max(1, stats.chain) + (t.level >= 3 ? 1 : 0);
      for (let i = 0; i < jumps && cur; i++) {
        hit.add(cur.slot);
        this.spawnBeam(fromX, fromY, fromZ, cur.x, cur.y + 0.25, cur.z, def.color, 0.14, 0.045, "chain");
        this.hurt(cur, dmg * (1 - i * 0.18), "chain");
        fromX = cur.x;
        fromY = cur.y + 0.25;
        fromZ = cur.z;
        cur = this.nearestEnemy(fromX, fromZ, 3.3, hit, true);
      }
    }
    this.hudDirty = true;
  }

  nearestEnemy(x: number, z: number, range: number, exclude: Set<number>, flying: boolean) {
    const r2 = range * range;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || exclude.has(e.slot)) continue;
      if (e.flying && !flying) continue;
      const d = dist2(x, z, e.x, e.z);
      if (d < r2 && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  moveBolts(dt: number) {
    for (const b of this.bolts) {
      if (!b.alive) continue;
      b.ttl -= dt;
      if (b.ttl <= 0) {
        b.alive = false;
        continue;
      }
      if (b.kind === "bolt") {
        const t = this.enemies[b.targetSlot];
        if (t?.alive) {
          const dx = t.x - b.x;
          const dy = t.y + 0.2 - b.y;
          const dz = t.z - b.z;
          const len = Math.hypot(dx, dy, dz) || 1;
          b.vx = (dx / len) * b.speed;
          b.vy = (dy / len) * b.speed;
          b.vz = (dz / len) * b.speed;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.kind === "shell") {
        const t = this.enemies[b.targetSlot];
        const tx = t?.alive ? t.x : b.x + b.vx;
        const tz = t?.alive ? t.z : b.z + b.vz;
        if (dist2(b.x, b.z, tx, tz) < 0.4 * 0.4 || b.ttl < 0.05) {
          this.splashAt(b.x, b.y, b.z, b);
          b.alive = false;
        }
      } else {
        const t = this.enemies[b.targetSlot];
        if (t?.alive && dist2(b.x, b.z, t.x, t.z) < 0.38 * 0.38 && Math.abs(b.y - t.y) < 0.9) {
          this.hurt(t, b.damage, "bolt");
          this.spawnBurst(b.x, b.y, b.z, 0.35, b.color);
          b.alive = false;
        }
      }
    }
  }

  splashAt(x: number, y: number, z: number, b: Bolt) {
    const r2 = b.splash * b.splash;
    this.spawnBurst(x, y, z, b.splash * 0.7, b.color);
    if (b.slow > 0) this.spawnDecal(x, z, b.splash, b.color, "frost");
    this.addTrauma(0.16);
    for (const e of this.enemies) {
      if (!e.alive || e.flying) continue;
      if (dist2(x, z, e.x, e.z) <= r2) {
        this.hurt(e, b.damage, "shell");
        if (b.slow > 0) this.applySlow(e, b.slow, b.slowTime);
      }
    }
  }

  hurt(e: Enemy, raw: number, kind: DamageKind | string) {
    if (!e.alive) return;
    const def = ENEMIES[e.type];
    let armor = e.armor;
    if (this.time < e.hardenUntil) armor += 5;
    if (kind === "rail" || kind === "chain") armor *= 0.35;
    const resist = def.resist?.[kind as DamageKind] ?? 1;
    let dmg = Math.max(1, (raw - armor) * resist);
    if (e.shieldHp > 0) {
      const absorb = Math.min(e.shieldHp, dmg);
      e.shieldHp -= absorb;
      dmg -= absorb;
      if (dmg <= 0) {
        e.hitFlash = 0.45;
        return;
      }
    }
    e.hp -= dmg;
    e.hitFlash = 1;
    if (def.skill === "harden") e.hardenUntil = this.time + 2.2;
    if (e.hp <= 0) this.kill(e);
  }

  kill(e: Enemy) {
    if (ENEMIES[e.type].skill === "split") {
      const lane = e.lane;
      this.spawnEnemy("mite", {
        x: e.x + 0.18,
        z: e.z,
        y: e.y,
        wp: e.wp,
        progress: e.progress,
        lane: lane + 0.12,
        gold: 2,
        pathId: e.pathId,
      });
      this.spawnEnemy("mite", {
        x: e.x - 0.18,
        z: e.z,
        y: e.y,
        wp: e.wp,
        progress: e.progress,
        lane: lane - 0.12,
        gold: 2,
        pathId: e.pathId,
      });
    }
    e.alive = false;
    if (this.time < this.comboUntil) this.combo = Math.min(8, this.combo + 1);
    else this.combo = 1;
    this.comboUntil = this.time + 1.4;
    const extra = this.combo > 1 ? this.combo - 1 : 0;
    const pay = e.gold + extra;
    this.gold += pay;
    this.goldEarned += pay;
    this.kills += 1;
    if (this.lastShooter) this.lastShooter.kills += 1;
    this.hudDirty = true;
    this.spawnBurst(e.x, e.y + 0.2, e.z, e.boss ? 1.6 : 0.55, e.boss ? "#e8dcc8" : "#9db4c4");
    this.spawnFloater(e.x, e.y + 0.8, e.z, extra ? `+${pay}` : `+${e.gold}`);
    this.sfx = "boom";
    if (e.boss) this.addTrauma(0.45);
    else this.addTrauma(0.06);
  }

  spawnBeam(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    color: string,
    ttl: number,
    width: number,
    style: BeamStyle = "lance",
  ) {
    const b = this.beams.find((x) => !x.alive);
    if (!b) return;
    b.alive = true;
    b.style = style;
    b.x1 = x1;
    b.y1 = y1;
    b.z1 = z1;
    b.x2 = x2;
    b.y2 = y2;
    b.z2 = z2;
    b.ttl = ttl;
    b.maxTtl = ttl;
    b.color = color;
    b.width = width;
    b.seed = Math.random() * 100;
  }

  spawnDecal(x: number, z: number, size: number, color: string, kind: DecalKind = "frost") {
    const d = this.decals.find((g) => !g.alive);
    if (!d) return;
    const life = kind === "frost" ? 2.6 : 0.55;
    d.alive = true;
    d.kind = kind;
    d.x = x;
    d.z = z;
    d.size = size;
    d.color = color;
    d.ttl = life;
    d.maxTtl = life;
  }

  spawnBurst(x: number, y: number, z: number, size: number, color: string) {
    const b = this.bursts.find((x) => !x.alive);
    if (!b) return;
    b.alive = true;
    b.x = x;
    b.y = y;
    b.z = z;
    b.size = size;
    b.color = color;
    b.ttl = 0.32;
    b.maxTtl = 0.32;
  }

  spawnFloater(x: number, y: number, z: number, text: string) {
    const f = this.floaters.find((x) => !x.alive);
    if (!f) return;
    f.alive = true;
    f.x = x;
    f.y = y;
    f.z = z;
    f.text = text;
    f.ttl = 0.7;
  }

  livingCount() {
    let n = 0;
    for (const e of this.enemies) if (e.alive) n++;
    return n;
  }

  checkWaveEnd() {
    if (this.phase !== "combat") return;
    if (this.spawnI < this.spawnQueue.length) return;
    if (this.livingCount() > 0) return;
    if (this.wave >= this.map.waves.length) {
      this.phase = "won";
      this.hudDirty = true;
      this.lastEvent = "Core holds";
      this.addTrauma(0.3);
      return;
    }
    this.phase = "build";
    this.buildClock = 0;
    this.autoT = 0;
    this.hudDirty = true;
    this.lastEvent = `Wave ${this.wave} cleared`;
    if (this.combo >= 4) this.lastEvent = `Wave ${this.wave} cleared · combo ${this.combo}`;
  }

  pathCountForIndex(waveIndex: number) {
    return Math.min(this.paths.length, 1 + Math.floor(waveIndex / GATE_EVERY));
  }

  activePathCount() {
    const idx = this.phase === "combat" ? this.wave - 1 : this.wave;
    return this.pathCountForIndex(Math.max(0, idx));
  }

  activePaths() {
    return this.paths.slice(0, this.activePathCount());
  }

  endWorld() {
    const last = this.waypoints[this.waypoints.length - 1];
    return last ?? { x: 0, y: 0, z: 0 };
  }

  startWorld() {
    return this.waypoints[0] ?? { x: 0, y: 0, z: 0 };
  }
}

export const engine = new GameEngine();
