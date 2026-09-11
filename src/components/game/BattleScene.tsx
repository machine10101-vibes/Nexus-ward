import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import {
  AdditiveBlending,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { engine } from "@/game/engine";
import {
  PLANET_THEME,
  SYN_RANGE,
  TOWERS,
  towerStats,
  MAX_ENEMIES,
  MAX_BOLTS,
  MAX_BEAMS,
  MAX_BURSTS,
  MAX_DECALS,
  MAX_FLOATERS,
  ENEMIES,
} from "@/game/config";
import { useGameStore } from "@/game/store";
import { audio } from "@/game/audio";
import {
  DecorField,
  DecorHybrid,
  DecorMech,
  DecorOrganic,
  EnemyModel,
  HexField,
  HexPad,
  Motes,
  type FieldSpot,
  NexusCore,
  RangeRing,
  SpawnGate,
  TowerModel,
} from "./models";
import { PlanetGlobe } from "./Planet";
import { PathLane } from "./PathLane";
import { WorldGround } from "./WorldGround";
import { useWorldArt } from "./worldArt";
import { cellToWorld, unionCells } from "@/game/maps";
import type { MapDef, MapId, TowerId } from "@/game/types";

const FACTION_MARK = {
  organic: "#3dcaa0",
  mech: "#c46a3a",
  hybrid: "#8ec8d0",
} as const;

/** Per-world atmosphere: how far you can see, how the ground reads, how hard the key light is. */
const WORLD_TUNE: Record<
  MapId,
  {
    fogNear: number;
    fogFar: number;
    key: number;
    fill: number;
    ambient: number;
    pathMetal: number;
    pathRough: number;
    groundMetal: number;
    groundRough: number;
    rimLight: string;
    rimIntensity: number;
  }
> = {
  mycelion: {
    fogNear: 22,
    fogFar: 78,
    key: 2.25,
    fill: 0.95,
    ambient: 0.36,
    pathMetal: 0.12,
    pathRough: 0.66,
    groundMetal: 0.03,
    groundRough: 0.97,
    rimLight: "#3dcaa0",
    rimIntensity: 26,
  },
  forge: {
    fogNear: 18,
    fogFar: 70,
    key: 2.95,
    fill: 0.62,
    ambient: 0.24,
    pathMetal: 0.82,
    pathRough: 0.24,
    groundMetal: 0.34,
    groundRough: 0.72,
    rimLight: "#e07a38",
    rimIntensity: 34,
  },
  aegis: {
    fogNear: 24,
    fogFar: 82,
    key: 2.38,
    fill: 0.85,
    ambient: 0.3,
    pathMetal: 0.5,
    pathRough: 0.36,
    groundMetal: 0.2,
    groundRough: 0.62,
    rimLight: "#8ec8d0",
    rimIntensity: 30,
  },
};

export function BattleScene() {
  const mapId = useGameStore((s) => s.mapId) ?? "mycelion";
  const quality = useGameStore((s) => s.settings.quality);
  const shake = useGameStore((s) => s.settings.shake);
  const screen = useGameStore((s) => s.screen);
  const paused =
    screen === "paused" ||
    screen === "won" ||
    screen === "lost" ||
    screen === "help" ||
    screen === "settings" ||
    screen === "studio";

  useFrame((state, dt) => {
    engine.update(dt, paused);
    if (engine.sfx) {
      const fn = audio[engine.sfx];
      if (typeof fn === "function") fn.call(audio);
      engine.sfx = null;
    }
    useGameStore.getState().syncHud();
    if (shake && engine.trauma > 0.02) {
      const t = engine.trauma * engine.trauma;
      state.camera.position.x += (Math.random() - 0.5) * t * 0.45;
      state.camera.position.y += (Math.random() - 0.5) * t * 0.28;
    }
  });

  return (
    <>
      <Suspense fallback={null}>
        <World mapId={mapId} quality={quality} />
      </Suspense>
      <Pads />
      <TowersLayer />
      <SynergyLinks />
      <EnemyLayer />
      <BoltLayer />
      <BeamLayer />
      <ArcLayer />
      <BurstLayer />
      <DecalLayer />
      <FloaterLayer />
      <CameraRig />
    </>
  );
}

/** Frames the whole field for the current viewport, then hands the camera to orbit. */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const [dist, setDist] = useState(23);

  useEffect(() => {
    const map = engine.map;
    const halfW = (map.cols * 1.7) / 2 + 1.4;
    const halfD = (map.rows * 1.7) / 2 + 1.4;
    const aspect = Math.max(0.35, size.width / Math.max(1, size.height));
    const half = Math.tan((40 * Math.PI) / 360);
    const need = Math.max(halfD / half, halfW / (half * aspect)) * 1.06;
    const d = Math.min(46, Math.max(20, need));
    setDist(d);
    camera.position.set(0, d * 0.658, d * 0.753);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.48}
      maxPolarAngle={1.12}
      minDistance={dist * 0.5}
      maxDistance={dist * 1.5}
      target={[0, 0.2, 0]}
    />
  );
}

function World({ mapId, quality }: { mapId: MapId; quality: "high" | "low" }) {
  const theme = PLANET_THEME[mapId];
  const tune = WORLD_TUNE[mapId];
  const map = engine.map;
  const art = useWorldArt(mapId);
  const lives = useGameStore((s) => s.hud.lives);
  const leaked = useGameStore((s) => s.hud.leaked);
  const overclock = useGameStore((s) => s.hud.overclockOn);
  const phase = useGameStore((s) => s.hud.phase);
  const wave = useGameStore((s) => s.hud.wave);
  const combat = phase === "combat";
  const skip = useMemo(() => {
    const cells = unionCells(map.path, ...(map.branches ?? []));
    return new Set(cells.map((p) => `${p.c},${p.r}`));
  }, [map]);
  const end = engine.endWorld();
  const health = map.lives ? lives / map.lives : 1;
  const fieldProps = useMemo(() => freeCellProps(map), [map]);
  const pathCount = useMemo(() => engine.activePathCount(), [wave, phase]);
  const activePaths = engine.paths.slice(0, pathCount);
  const keepClear = useMemo(() => engine.paths.flat(), [map]);

  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.fog, tune.fogNear, tune.fogFar]} />
      <ambientLight intensity={tune.ambient} color={theme.ambient} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, mapId === "forge" ? 0.72 : 1.05]} />
      <directionalLight
        position={[12, 18, 9]}
        intensity={tune.key}
        color={theme.dir}
        castShadow={quality === "high"}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={42}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <directionalLight position={[-10, 5, -8]} intensity={tune.fill} color={theme.hemiSky} />
      <pointLight position={[0, 3.4, -12]} intensity={tune.rimIntensity} distance={30} color={tune.rimLight} />
      <pointLight position={[end.x, 2.6, end.z]} intensity={42} distance={15} color={theme.core} />
      {activePaths.map((pts, i) => {
        const gate = pts[0];
        if (!gate) return null;
        return (
          <pointLight
            key={`gate-light-${i}`}
            position={[gate.x, 2.2, gate.z]}
            intensity={14}
            distance={8}
            color={theme.pathEmissive}
          />
        );
      })}
      {overclock ? <pointLight position={[0, 6, 0]} intensity={48} distance={34} color="#d7e6ee" /> : null}
      {quality === "high" ? <Stars radius={110} depth={40} count={2200} factor={3.0} fade speed={0.12} /> : null}
      {quality === "high" ? <Stars radius={150} depth={16} count={700} factor={1.35} fade speed={0.04} /> : null}
      <WorldGround
        mapId={mapId}
        cols={map.cols}
        rows={map.rows}
        quality={quality}
        ground={art.ground}
        sky={art.sky}
        fog={theme.fog}
        emissive={theme.pathEmissive}
        roughness={tune.groundRough}
        metalness={tune.groundMetal}
        combat={combat}
        keepClear={keepClear}
      />
      <group position={[-11, 8.5, -22]} scale={1.05}>
        <PlanetGlobe id={mapId} radius={5.4} spin={0.015} />
      </group>
      <OverclockWash color={theme.padEmi} on={overclock} />
      <HexField cols={map.cols} rows={map.rows} color={theme.pad} accent={theme.padEmi} skip={skip} />
      {activePaths.map((pts, i) => (
        <PathLane
          key={`${map.id}-lane-${i}`}
          points={pts}
          mapId={mapId}
          ground={art.ground}
          metalness={tune.pathMetal * 0.18}
          roughness={Math.min(0.97, tune.pathRough + 0.28)}
        />
      ))}
      <group position={[end.x, 0, end.z]}>
        <NexusCore color={theme.core} health={health} hitGen={leaked} />
      </group>
      {activePaths.map((pts, i) => {
        const gate = pts[0];
        if (!gate) return null;
        return (
          <group key={`${map.id}-gate-${i}`} position={[gate.x, 0, gate.z]}>
            <SpawnGate color={theme.pathEmissive} />
          </group>
        );
      })}
      {mapId === "mycelion" ? (
        <DecorOrganic seed={11} count={quality === "high" ? 30 : 18} />
      ) : mapId === "forge" ? (
        <DecorMech seed={22} count={quality === "high" ? 28 : 16} />
      ) : (
        <DecorHybrid seed={33} count={quality === "high" ? 30 : 18} />
      )}
      <DecorField id={mapId} spots={fieldProps} />
      {quality === "high" ? <Motes color={theme.pathEmissive} count={mapId === "forge" ? 16 : 22} /> : null}
      {quality === "high" ? (
        <Sparkles count={18} scale={[28, 4, 22]} size={1.4} speed={0.18} color={theme.padEmi} opacity={0.18} />
      ) : null}
      {quality === "high" ? (
        <ContactShadows position={[0, 0.02, 0]} opacity={0.48} scale={36} blur={2.2} far={9} />
      ) : null}
    </>
  );
}

/** A slow ground swell while Overclock runs — legible, never a strobe. */
function OverclockWash({ color, on }: { color: string; on: boolean }) {
  const ref = useRef<Mesh>(null);
  useFrame((s) => {
    const m = ref.current;
    if (!m) return;
    m.visible = on;
    if (!on) return;
    const k = (Math.sin(s.clock.elapsedTime * 1.6) + 1) / 2;
    m.scale.setScalar(0.92 + k * 0.1);
    (m.material as MeshBasicMaterial).opacity = 0.06 + k * 0.09;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} visible={false}>
      <ringGeometry args={[2.6, 12, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/** Cells that hold neither path nor pad, thinned out so props never crowd the lanes. */
function freeCellProps(map: MapDef) {
  const taken = new Set<string>();
  for (const p of unionCells(map.path, ...(map.branches ?? []))) taken.add(`${p.c},${p.r}`);
  for (const p of map.pads) taken.add(`${p.c},${p.r}`);
  const out: FieldSpot[] = [];
  let s = 7;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (taken.has(`${c},${r}`)) continue;
      const roll = rand();
      const k = rand();
      const a = rand() * Math.PI * 2;
      if (roll > 0.38) continue;
      const w = cellToWorld(c, r, map.cols, map.rows);
      out.push({ x: w.x + (k - 0.5) * 1.5, z: w.z + (k - 0.5) * 1.5, k, a });
    }
  }
  return out;
}

function Pads() {
  const theme = PLANET_THEME[engine.map.id];
  const buildType = useGameStore((s) => s.buildType);
  const selected = useGameStore((s) => s.hud.selectedId);
  const hover = useGameStore((s) => s.hoverPad);
  const gold = useGameStore((s) => s.hud.gold);
  const pads = engine.padWorld;
  return (
    <group>
      {pads.map((p, i) => {
        const occ = engine.occupied[i] !== -1;
        const previewing = !occ && !!buildType && hover === i;
        return (
          <group
            key={i}
            position={[p.x, 0, p.z]}
            onPointerOver={(e) => {
              e.stopPropagation();
              engine.hoverPad = i;
              useGameStore.setState({ hoverPad: i });
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              if (engine.hoverPad === i) {
                engine.hoverPad = null;
                useGameStore.setState({ hoverPad: null });
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              // Touch has no hover: mirror the pad under the finger before acting on it.
              engine.hoverPad = i;
              useGameStore.setState({ hoverPad: i });
              const before = engine.towers.length;
              engine.selectPad(i);
              if (engine.towers.length > before) audio.place();
              else audio.ui();
              useGameStore.getState().syncHud();
            }}
          >
            <HexPad
              color={theme.pad}
              emissive={theme.padEmi}
              occupied={occ}
              hover={hover === i}
              selected={occ && engine.occupied[i] === selected}
            />
            {previewing ? (
              <>
                <group position={[0, 0.02, 0]} scale={1.2}>
                  <TowerModel type={buildType} level={1} ghost />
                </group>
                <RangeRing radius={towerStats(TOWERS[buildType], 1).range} color={TOWERS[buildType].color} />
                <GhostTag type={buildType} gold={gold} />
              </>
            ) : null}
          </group>
        );
      })}
      <SynergyPreview />
    </group>
  );
}

function GhostTag({ type, gold }: { type: TowerId; gold: number }) {
  const def = TOWERS[type];
  const short = def.cost - gold;
  return (
    <Html position={[0, 1.95, 0]} center sprite pointerEvents="none" zIndexRange={[9, 9]} style={{ pointerEvents: "none" }}>
      <div className="ghost-tag">
        <span className="ghost-tag-cost">
          {def.short} · {def.cost} cr
        </span>
        <span>{def.hitsFlying ? "ground + air" : "ground only"}</span>
        {short > 0 ? (
          <span className="ghost-tag-short">need {short} more</span>
        ) : (
          <span>{gold - def.cost} cr left</span>
        )}
      </div>
    </Html>
  );
}

/** Ticks from the hovered pad to same-type batteries that would link with it. */
function SynergyPreview() {
  const buildType = useGameStore((s) => s.buildType);
  const hover = useGameStore((s) => s.hoverPad);
  if (!buildType || hover == null) return null;
  if (engine.occupied[hover] !== -1) return null;
  const pad = engine.padWorld[hover];
  if (!pad) return null;
  const r2 = SYN_RANGE * SYN_RANGE;
  const color = TOWERS[buildType].color;
  const links = engine.towers.filter((t) => {
    if (t.type !== buildType) return false;
    const dx = t.x - pad.x;
    const dz = t.z - pad.z;
    return dx * dx + dz * dz <= r2;
  });
  if (!links.length) return null;
  return (
    <group>
      {links.map((t) => {
        const dx = t.x - pad.x;
        const dz = t.z - pad.z;
        const len = Math.hypot(dx, dz) || 0.001;
        const yaw = Math.atan2(dx, dz);
        const ticks = Math.max(2, Math.round(len / 0.34));
        return (
          <group key={t.id} position={[pad.x, 0.3, pad.z]} rotation={[0, yaw, 0]}>
            {Array.from({ length: ticks }, (_, k) => (
              <mesh key={k} position={[0, 0, ((k + 0.5) / ticks) * len]}>
                <boxGeometry args={[0.05, 0.05, 0.12]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={0.7}
                  blending={AdditiveBlending}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function TowersLayer() {
  const selected = useGameStore((s) => s.hud.selectedId);
  const count = useGameStore((s) => s.hud.towers);
  const refs = useRef<(Group | null)[]>([]);
  const flashRefs = useRef<(Mesh | null)[]>([]);
  const tickRefs = useRef<(Mesh | null)[]>([]);
  const seenFire = useRef(0);
  const flashAge = useRef<number[]>([]);
  useFrame((_, dt) => {
    if (engine.fireGen !== seenFire.current) {
      seenFire.current = engine.fireGen;
      const shooter = engine.lastShooter;
      if (shooter) {
        const idx = engine.towers.findIndex((x) => x.id === shooter.id);
        if (idx >= 0) flashAge.current[idx] = 1;
      }
    }
    for (let i = 0; i < engine.towers.length; i++) {
      const t = engine.towers[i];
      const g = refs.current[i];
      if (!g || !t) continue;
      g.rotation.y = t.yaw;
      const flash = flashRefs.current[i];
      if (flash) {
        flashAge.current[i] = Math.max(0, (flashAge.current[i] ?? 0) - dt * 7);
        const k = flashAge.current[i] ?? 0;
        flash.visible = k > 0.04;
        const mat = flash.material as MeshBasicMaterial;
        if (mat) mat.opacity = k;
      }
      const tick = tickRefs.current[i];
      if (tick) tick.visible = t.aiming;
    }
  });
  void count;
  return (
    <group>
      {engine.towers.map((t, i) => (
        <group key={t.id} position={[t.x, 0, t.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.48, 0.62, 6]} />
            <meshBasicMaterial
              color={TOWERS[t.type].color}
              transparent
              opacity={0.4 + t.level * 0.12}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <group
            ref={(el) => {
              refs.current[i] = el;
            }}
            scale={1.2}
          >
            <TowerModel type={t.type} level={t.level} />
            <mesh
              ref={(el) => {
                flashRefs.current[i] = el;
              }}
              position={[0, 0.72, 0.42]}
              visible={false}
            >
              <sphereGeometry args={[0.16, 8, 8]} />
              <meshBasicMaterial
                color={TOWERS[t.type].color}
                transparent
                opacity={0}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {selected === t.id ? (
              <mesh
                ref={(el) => {
                  tickRefs.current[i] = el;
                }}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.03, 1.05]}
                visible={false}
              >
                <planeGeometry args={[0.055, 0.62]} />
                <meshBasicMaterial
                  color={TOWERS[t.type].color}
                  transparent
                  opacity={0.8}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ) : null}
          </group>
          {t.level >= 3 ? (
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.7, 0.82, 6]} />
              <meshBasicMaterial color={TOWERS[t.type].color} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          ) : null}
          {selected === t.id ? (
            <RangeRing radius={towerStats(TOWERS[t.type], t.level).range} color={TOWERS[t.type].color} />
          ) : null}
        </group>
      ))}
    </group>
  );
}

function SynergyLinks() {
  const n = useGameStore((s) => s.hud.towers);
  const selected = useGameStore((s) => s.hud.selectedId);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const links: { key: string; ax: number; az: number; bx: number; bz: number; color: string; own: boolean }[] = [];
  const r2 = SYN_RANGE * SYN_RANGE;
  for (let i = 0; i < engine.towers.length; i++) {
    for (let j = i + 1; j < engine.towers.length; j++) {
      const a = engine.towers[i];
      const b = engine.towers[j];
      if (a.type !== b.type) continue;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      if (dx * dx + dz * dz > r2) continue;
      links.push({
        key: `${a.id}-${b.id}`,
        ax: a.x,
        az: a.z,
        bx: b.x,
        bz: b.z,
        color: TOWERS[a.type].color,
        own: selected === a.id || selected === b.id,
      });
    }
  }
  const owned = links.some((l) => l.own);
  useFrame((s) => {
    const pulse = 0.34 + (Math.sin(s.clock.elapsedTime * 2.1) + 1) * 0.09;
    for (let i = 0; i < links.length; i++) {
      const m = mats.current[i];
      if (!m) continue;
      m.opacity = owned ? (links[i].own ? pulse + 0.34 : pulse * 0.3) : pulse;
    }
  });
  void n;
  return (
    <group>
      {links.map((l, i) => {
        const mx = (l.ax + l.bx) / 2;
        const mz = (l.az + l.bz) / 2;
        const len = Math.hypot(l.bx - l.ax, l.bz - l.az) || 0.001;
        const yaw = Math.atan2(l.bx - l.ax, l.bz - l.az);
        return (
          <mesh key={l.key} position={[mx, 0.28, mz]} rotation={[0, yaw, 0]}>
            <boxGeometry args={[0.045, 0.035, len]} />
            <meshBasicMaterial
              ref={(el) => {
                mats.current[i] = el;
              }}
              color={l.color}
              transparent
              opacity={0.5}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function EnemyLayer() {
  const gen = useGameStore((s) => s.hud.spawnGen);
  const groups = useRef<(Group | null)[]>(Array(MAX_ENEMIES).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = engine.enemies[i];
      const g = groups.current[i];
      if (!g) continue;
      g.visible = e.alive;
      if (!e.alive) continue;
      g.position.set(e.x, e.y, e.z);
      g.rotation.y = e.yaw;
      const flash = e.hitFlash;
      const slow = e.slowFactor < 0.95 ? 0.94 : 1;
      const burst = engine.time < e.sprintUntil ? 1.07 : 1;
      g.scale.setScalar((1 + flash * 0.08) * slow * burst);
      const shadow = g.children[1] as Mesh | undefined;
      if (shadow) shadow.position.y = -e.y + 0.03;
      const ringMat = shadow?.material as MeshBasicMaterial | undefined;
      if (ringMat) {
        ringMat.opacity = e.shieldHp > 0 ? 0.95 : ENEMIES[e.type].boss ? 0.8 : 0.55;
      }
    }
  });
  void gen;
  return (
    <group>
      {engine.enemies.map((e) => {
        const def = ENEMIES[e.type];
        const markR = def.boss ? 0.72 : def.scale > 1.2 ? 0.5 : 0.4;
        return (
          <group
            key={`${e.slot}-${e.type}`}
            ref={(el) => {
              groups.current[e.slot] = el;
            }}
            visible={false}
          >
            <EnemyModel type={e.type} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -e.y + 0.03, 0]}>
              <ringGeometry args={[markR * 0.56, markR, def.boss ? 6 : 16]} />
              <meshBasicMaterial
                color={FACTION_MARK[def.faction]}
                transparent
                opacity={def.boss ? 0.8 : 0.55}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <HpPip slot={e.slot} />
          </group>
        );
      })}
    </group>
  );
}

function HpPip({ slot }: { slot: number }) {
  const fill = useRef<Mesh>(null);
  const root = useRef<Group>(null);
  useFrame(({ camera }) => {
    const e = engine.enemies[slot];
    if (!root.current) return;
    const show = e.alive && (e.boss || e.hp < e.maxHp);
    root.current.visible = show;
    if (!show) return;
    root.current.position.y = e.flying ? 1.45 : e.boss ? 2.35 : 1.12;
    root.current.scale.setScalar(e.boss ? 1.5 : 1);
    root.current.lookAt(camera.position);
    const ratio = Math.max(0.05, e.hp / e.maxHp);
    if (fill.current) {
      fill.current.scale.x = ratio;
      fill.current.position.x = (ratio - 1) * 0.38;
      const mat = fill.current.material as MeshBasicMaterial;
      mat.color.set(ratio < 0.32 ? "#c45c5c" : "#8fb4c4");
    }
  });
  return (
    <group ref={root} position={[0, 1.15, 0]} visible={false}>
      <mesh>
        <planeGeometry args={[0.86, 0.13]} />
        <meshBasicMaterial color="#07080a" />
      </mesh>
      <mesh ref={fill} position={[0, 0, 0.01]}>
        <planeGeometry args={[0.76, 0.08]} />
        <meshBasicMaterial color="#8fb4c4" toneMapped={false} />
      </mesh>
    </group>
  );
}

function BoltLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_BOLTS).fill(null));
  const shown = useRef<string[]>(Array(MAX_BOLTS).fill(""));
  useFrame(() => {
    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = engine.bolts[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = b.alive;
      if (!b.alive) continue;
      g.position.set(b.x, b.y, b.z);
      if (b.vx || b.vz || b.vy) g.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
      if (shown.current[i] !== b.color) {
        shown.current[i] = b.color;
        const core = (g.children[0] as Mesh | undefined)?.material as MeshBasicMaterial | undefined;
        const trail = (g.children[1] as Mesh | undefined)?.material as MeshBasicMaterial | undefined;
        core?.color.set(b.color);
        trail?.color.set(b.color);
      }
    }
  });
  return (
    <group>
      {engine.bolts.map((b) => (
        <group
          key={b.slot}
          ref={(el) => {
            refs.current[b.slot] = el;
          }}
          visible={false}
        >
          <mesh>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color={b.color} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.18]} scale={[0.55, 2.4, 0.55]}>
            <coneGeometry args={[0.09, 0.42, 6]} />
            <meshBasicMaterial
              color={b.color}
              transparent
              opacity={0.55}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Straight shots: the lance thread and the rail corridor. */
function BeamLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_BEAMS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_BEAMS; i++) {
      const b = engine.beams[i];
      const g = refs.current[i];
      if (!g) continue;
      const on = b.alive && b.style !== "chain";
      g.visible = on;
      if (!on) continue;
      const dx = b.x2 - b.x1;
      const dy = b.y2 - b.y1;
      const dz = b.z2 - b.z1;
      const len = Math.hypot(dx, dy, dz) || 0.001;
      g.position.set((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, (b.z1 + b.z2) / 2);
      g.lookAt(b.x2, b.y2, b.z2);
      g.scale.set(1, 1, len);
      const fade = Math.max(0, b.ttl / b.maxTtl);
      const core = g.children[0] as Mesh;
      const halo = g.children[1] as Mesh;
      const spark = g.children[2] as Mesh;
      core.scale.set(b.width * 0.5, 1, b.width * 0.5);
      halo.scale.set(b.width * 1.7, 1, b.width * 1.7);
      const cm = core.material as MeshBasicMaterial;
      const hm = halo.material as MeshBasicMaterial;
      cm.opacity = fade;
      hm.opacity = fade * fade * 0.4;
      cm.color.set(b.color);
      hm.color.set(b.color);
      // The rail leaves a hot muzzle bloom; the lance does not.
      spark.visible = b.style === "rail";
      if (spark.visible) {
        const sm = spark.material as MeshBasicMaterial;
        sm.opacity = fade * 0.9;
        sm.color.set(b.color);
        spark.scale.setScalar((0.3 + (1 - fade) * 0.5) / Math.max(0.001, len));
        spark.position.set(0, 0, -0.5);
      }
    }
  });
  return (
    <group>
      {engine.beams.map((b) => (
        <group
          key={b.slot}
          ref={(el) => {
            refs.current[b.slot] = el;
          }}
          visible={false}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1, 1, 6]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh visible={false}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const ARC_SLOTS = 16;
const ARC_SEGS = 4;

/** Tesla jumps drawn as jittered polylines so a chain reads as current, not a pipe. */
function ArcLayer() {
  const refs = useRef<(Group | null)[]>(Array(ARC_SLOTS).fill(null));
  useFrame((s) => {
    let used = 0;
    const t = s.clock.elapsedTime;
    for (let i = 0; i < MAX_BEAMS && used < ARC_SLOTS; i++) {
      const b = engine.beams[i];
      if (!b.alive || b.style !== "chain") continue;
      const g = refs.current[used];
      used++;
      if (!g) continue;
      g.visible = true;
      const fade = Math.max(0, b.ttl / b.maxTtl);
      const dx = b.x2 - b.x1;
      const dy = b.y2 - b.y1;
      const dz = b.z2 - b.z1;
      const len = Math.hypot(dx, dy, dz) || 0.001;
      const px = -dz / len;
      const pz = dx / len;
      const spread = Math.min(0.42, len * 0.16);
      for (let k = 0; k < ARC_SEGS; k++) {
        const seg = g.children[k] as Mesh;
        const t0 = k / ARC_SEGS;
        const t1 = (k + 1) / ARC_SEGS;
        const j0 = k === 0 ? 0 : wiggle(b.seed + k, t) * spread;
        const j1 = k === ARC_SEGS - 1 ? 0 : wiggle(b.seed + k + 1, t) * spread;
        const v0 = k === 0 ? 0 : wiggle(b.seed + k + 17, t) * spread * 0.6;
        const v1 = k === ARC_SEGS - 1 ? 0 : wiggle(b.seed + k + 18, t) * spread * 0.6;
        const ax = b.x1 + dx * t0 + px * j0;
        const ay = b.y1 + dy * t0 + v0;
        const az = b.z1 + dz * t0 + pz * j0;
        const bx = b.x1 + dx * t1 + px * j1;
        const by = b.y1 + dy * t1 + v1;
        const bz = b.z1 + dz * t1 + pz * j1;
        seg.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
        seg.lookAt(bx, by, bz);
        const d = Math.hypot(bx - ax, by - ay, bz - az) || 0.001;
        seg.scale.set(b.width * 1.5, b.width * 1.5, d);
        const m = seg.material as MeshBasicMaterial;
        m.opacity = fade * (0.7 + Math.random() * 0.3);
        m.color.set(b.color);
      }
    }
    for (let i = used; i < ARC_SLOTS; i++) {
      const g = refs.current[i];
      if (g) g.visible = false;
    }
  });
  return (
    <group>
      {Array.from({ length: ARC_SLOTS }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          {Array.from({ length: ARC_SEGS }, (_, k) => (
            <mesh key={k}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial
                color="#8eb8a8"
                transparent
                opacity={0.9}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function wiggle(seed: number, t: number) {
  return Math.sin(seed * 12.9898 + t * 28) * 0.5 + Math.sin(seed * 78.233 + t * 41) * 0.5;
}

function BurstLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_BURSTS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_BURSTS; i++) {
      const b = engine.bursts[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = b.alive;
      if (!b.alive) continue;
      const k = 1 - b.ttl / b.maxTtl;
      const s = b.size * (0.3 + k * 1.55);
      g.position.set(b.x, b.y, b.z);
      g.scale.setScalar(s);
      const fade = Math.max(0, 1 - k);
      const sph = (g.children[0] as Mesh).material as MeshBasicMaterial;
      const ring = (g.children[1] as Mesh).material as MeshBasicMaterial;
      sph.opacity = fade * 0.7;
      ring.opacity = fade * 0.85;
      sph.color.set(b.color);
      ring.color.set(b.color);
    }
  });
  return (
    <group>
      {engine.bursts.map((b) => (
        <group
          key={b.slot}
          ref={(el) => {
            refs.current[b.slot] = el;
          }}
          visible={false}
        >
          <mesh>
            <sphereGeometry args={[0.5, 10, 8]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.62, 24]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Ground marks with a lifetime: frost fields, rank-up rings, breach scorch. */
function DecalLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_DECALS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = engine.decals[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = d.alive;
      if (!d.alive) continue;
      const k = 1 - d.ttl / d.maxTtl;
      g.position.set(d.x, 0.045, d.z);
      const ring = g.children[0] as Mesh;
      const disc = g.children[1] as Mesh;
      const rm = ring.material as MeshBasicMaterial;
      const dm = disc.material as MeshBasicMaterial;
      rm.color.set(d.color);
      dm.color.set(d.color);
      if (d.kind === "frost") {
        const grow = Math.min(1, k * 6);
        g.scale.setScalar(d.size * (0.55 + grow * 0.45));
        const fade = Math.min(1, (1 - k) * 2.4);
        rm.opacity = 0.5 * fade;
        dm.opacity = 0.16 * fade;
        disc.visible = true;
      } else {
        g.scale.setScalar(d.size * (0.25 + k * 1.05));
        rm.opacity = Math.max(0, 1 - k) * 0.85;
        disc.visible = false;
      }
    }
  });
  return (
    <group>
      {engine.decals.map((d) => (
        <group
          key={d.slot}
          ref={(el) => {
            refs.current[d.slot] = el;
          }}
          visible={false}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.78, 1, 28]} />
            <meshBasicMaterial color="#8ab4d4" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
            <circleGeometry args={[0.94, 24]} />
            <meshBasicMaterial color="#8ab4d4" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FloaterLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_FLOATERS).fill(null));
  const labels = useRef<(HTMLSpanElement | null)[]>(Array(MAX_FLOATERS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_FLOATERS; i++) {
      const f = engine.floaters[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = f.alive;
      const el = labels.current[i];
      // drei's Html portals outside the scene graph, so hide the label explicitly.
      if (el) el.style.display = f.alive ? "" : "none";
      if (!f.alive) continue;
      g.position.set(f.x, f.y + 0.15, f.z);
      const k = Math.max(0, Math.min(1, f.ttl / 0.7));
      g.scale.setScalar(0.75 + k * 0.35);
      if (el) {
        if (el.textContent !== f.text) el.textContent = f.text;
        el.style.opacity = String(Math.min(1, k * 1.4));
      }
    }
  });
  return (
    <group>
      {engine.floaters.map((f) => (
        <group
          key={f.slot}
          ref={(el) => {
            refs.current[f.slot] = el;
          }}
          visible={false}
        >
          <Html sprite center pointerEvents="none" zIndexRange={[8, 8]} style={{ pointerEvents: "none" }}>
            <span
              ref={(el) => {
                labels.current[f.slot] = el;
              }}
              className="hud-floater"
              style={{ display: "none" }}
            >
              +0
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}
