import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { engine } from "@/game/engine";
import { PLANET_THEME, SYN_RANGE, TOWERS, towerStats, MAX_ENEMIES, MAX_BOLTS, MAX_BEAMS, MAX_BURSTS, MAX_FLOATERS, ENEMIES } from "@/game/config";
import { useGameStore } from "@/game/store";
import { audio } from "@/game/audio";
import {
  DecorHybrid,
  DecorMech,
  DecorOrganic,
  EnemyModel,
  HexField,
  HexPad,
  Motes,
  NexusCore,
  RangeRing,
  SpawnGate,
  TowerModel,
} from "./models";
import { PlanetGlobe } from "./Planet";
import type { MapId, TowerId } from "@/game/types";

const FACTION_MARK = {
  organic: "#3dcaa0",
  mech: "#c46a3a",
  hybrid: "#8ec8d0",
} as const;

export function BattleScene() {
  const mapId = useGameStore((s) => s.mapId) ?? "mycelion";
  const quality = useGameStore((s) => s.settings.quality);
  const shake = useGameStore((s) => s.settings.shake);
  const screen = useGameStore((s) => s.screen);
  const paused = screen === "paused" || screen === "won" || screen === "lost" || screen === "help" || screen === "settings";

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
      <World mapId={mapId} quality={quality} />
      <Pads />
      <TowersLayer />
      <SynergyLinks />
      <EnemyLayer />
      <BoltLayer />
      <BeamLayer />
      <BurstLayer />
      <FloaterLayer />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.48}
        maxPolarAngle={1.12}
        minDistance={12}
        maxDistance={34}
        target={[0, 0.2, 0]}
      />
    </>
  );
}

function World({ mapId, quality }: { mapId: MapId; quality: "high" | "low" }) {
  const theme = PLANET_THEME[mapId];
  const map = engine.map;
  const lives = useGameStore((s) => s.hud.lives);
  const overclock = useGameStore((s) => s.hud.overclockOn);
  const combat = useGameStore((s) => s.hud.phase) === "combat";
  const { tube, rails } = useMemo(() => {
    const pts = engine.waypoints.map((w) => new Vector3(w.x, 0.08, w.z));
    if (pts.length < 2) return { tube: null as TubeGeometry | null, rails: null as TubeGeometry | null };
    const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.15);
    const tube = new TubeGeometry(curve, 120, 0.32, 8, false);
    const rails = new TubeGeometry(curve, 120, 0.09, 6, false);
    return { tube, rails };
  }, [map.id, engine.waypoints.length]);

  const skip = useMemo(() => new Set(map.path.map((p) => `${p.c},${p.r}`)), [map]);
  const groundW = map.cols * 1.7 + 10;
  const groundD = map.rows * 1.7 + 10;
  const start = engine.startWorld();
  const end = engine.endWorld();
  const health = map.lives ? lives / map.lives : 1;
  const { glow } = useMemo(() => {
    const pts = engine.waypoints.map((w) => new Vector3(w.x, 0.08, w.z));
    if (pts.length < 2) return { glow: null as TubeGeometry | null };
    const curve = new CatmullRomCurve3(pts, false, "catmullrom", 0.15);
    return { glow: new TubeGeometry(curve, 80, 0.62, 8, false) };
  }, [map.id, engine.waypoints.length]);
  const terrain = useMemo(() => makeTerrain(groundW, groundD, theme.ground, theme.groundHi), [groundW, groundD, theme.ground, theme.groundHi]);

  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.fog, 16, 54]} />
      <ambientLight intensity={0.2} color={theme.ambient} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, 1.05]} />
      <directionalLight
        position={[12, 18, 9]}
        intensity={2.05}
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
      <directionalLight position={[-10, 5, -8]} intensity={0.62} color={theme.hemiSky} />
      <pointLight position={[end.x, 2.6, end.z]} intensity={42} distance={15} color={theme.core} />
      <pointLight position={[start.x, 2.2, start.z]} intensity={28} distance={11} color={theme.pathEmissive} />
      {overclock ? <pointLight position={[0, 6, 0]} intensity={48} distance={34} color="#d7e6ee" /> : null}
      {quality === "high" ? <Stars radius={90} depth={28} count={1400} factor={2.8} fade speed={0.16} /> : null}
      <SkyDome zenith={theme.sky} horizon={theme.fog} nadir={theme.ground} accent={theme.pathEmissive} />
      <Suspense fallback={null}>
        <group position={[-20, 13, -34]} scale={0.72}>
          <PlanetGlobe id={mapId} radius={5.4} spin={0.015} />
        </group>
      </Suspense>
      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial color={theme.ground} roughness={0.94} metalness={0.06} vertexColors />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, 0]} receiveShadow>
        <circleGeometry args={[11.8, 48]} />
        <meshStandardMaterial color={theme.groundHi} roughness={0.86} metalness={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[11.4, 12.15, 64]} />
        <meshStandardMaterial
          color={theme.padEmi}
          emissive={theme.padEmi}
          emissiveIntensity={combat ? 0.55 : 0.28}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <torusGeometry args={[13.2, 0.035, 8, 80]} />
        <meshStandardMaterial color={theme.padEmi} emissive={theme.padEmi} emissiveIntensity={0.45} metalness={0.5} roughness={0.3} />
      </mesh>
      <HexField cols={map.cols} rows={map.rows} color={theme.pad} accent={theme.padEmi} skip={skip} />
      {glow ? (
        <mesh geometry={glow}>
          <meshBasicMaterial
            color={theme.pathEmissive}
            transparent
            opacity={combat ? 0.22 : 0.12}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ) : null}
      {tube ? (
        <mesh geometry={tube} receiveShadow>
          <meshStandardMaterial
            color={theme.path}
            metalness={mapId === "forge" ? 0.7 : 0.2}
            roughness={mapId === "forge" ? 0.28 : 0.45}
            emissive={theme.pathEmissive}
            emissiveIntensity={combat ? 0.38 : 0.22}
          />
        </mesh>
      ) : null}
      {rails ? (
        <PulseRail geometry={rails} color={theme.pathEmissive} hot={combat || mapId !== "mycelion"} />
      ) : null}
      <PathCourier points={engine.waypoints} color={theme.pathEmissive} />
      <group position={[end.x, 0, end.z]}>
        <NexusCore color={theme.core} health={health} />
      </group>
      <group position={[start.x, 0, start.z]}>
        <SpawnGate color={theme.pathEmissive} />
      </group>
      {mapId === "mycelion" ? <DecorOrganic seed={11} /> : mapId === "forge" ? <DecorMech seed={22} /> : <DecorHybrid seed={33} />}
      {quality === "high" ? <Motes color={theme.pathEmissive} count={mapId === "forge" ? 32 : 48} /> : null}
      {quality === "high" ? (
        <Sparkles count={36} scale={[28, 6, 22]} size={2.2} speed={0.28} color={theme.pathEmissive} opacity={0.45} />
      ) : null}
      {quality === "high" ? (
        <ContactShadows position={[0, 0.02, 0]} opacity={0.48} scale={36} blur={2.2} far={9} />
      ) : null}
    </>
  );
}

function SkyDome({
  zenith,
  horizon,
  nadir,
  accent,
}: {
  zenith: string;
  horizon: string;
  nadir: string;
  accent: string;
}) {
  const uniforms = useMemo(
    () => ({
      zenith: { value: new Color(zenith) },
      horizon: { value: new Color(horizon) },
      nadir: { value: new Color(nadir) },
      accent: { value: new Color(accent) },
    }),
    [zenith, horizon, nadir, accent],
  );
  return (
    <mesh>
      <sphereGeometry args={[64, 32, 20]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform vec3 zenith; uniform vec3 horizon; uniform vec3 nadir; uniform vec3 accent;
          varying vec3 vP;
          void main() {
            vec3 n = normalize(vP);
            float h = n.y;
            vec3 col = mix(nadir, horizon, smoothstep(-0.4, 0.04, h));
            col = mix(col, zenith, smoothstep(0.04, 0.78, h));
            float rim = pow(1.0 - abs(h), 4.0);
            col += accent * rim * 0.12;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function makeTerrain(w: number, d: number, low: string, high: string) {
  const g = new PlaneGeometry(w, d, 42, 30);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const a = new Color(low);
  const b = new Color(high);
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const dist = Math.hypot(x, z);
    const edge = Math.max(0, (dist - 8.2) / 11);
    const n =
      Math.sin(x * 0.16) * Math.cos(z * 0.13) * 0.7 +
      Math.sin(x * 0.41 + z * 0.28) * 0.28 +
      Math.sin(x * 0.07 + z * 0.09) * 1.15;
    pos.setY(i, n * edge * 1.55 + edge * 0.55 - 0.04);
    tmp.copy(a).lerp(b, Math.min(1, dist / 16));
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  g.setAttribute("color", new Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function PulseRail({ geometry, color, hot }: { geometry: TubeGeometry; color: string; hot: boolean }) {
  const mat = useRef<import("three").MeshStandardMaterial>(null);
  useFrame((s) => {
    if (!mat.current) return;
    mat.current.emissiveIntensity = (hot ? 0.62 : 0.3) + Math.sin(s.clock.elapsedTime * 2.4) * 0.16;
  });
  return (
    <mesh geometry={geometry} position={[0, 0.05, 0]}>
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={hot ? 0.62 : 0.3} />
    </mesh>
  );
}

function PathCourier({ points, color }: { points: { x: number; z: number }[]; color: string }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const pts = useMemo(() => points.map((w) => new Vector3(w.x, 0.22, w.z)), [points]);
  useFrame((s) => {
    if (pts.length < 2) return;
    for (let k = 0; k < 3; k++) {
      const mesh = refs.current[k];
      if (!mesh) continue;
      const t = (s.clock.elapsedTime * 0.14 + k / 3) % 1;
      const i = t * (pts.length - 1);
      const a = Math.floor(i);
      const b = Math.min(pts.length - 1, a + 1);
      mesh.position.lerpVectors(pts[a], pts[b], i - a);
    }
  });
  if (pts.length < 2) return null;
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <mesh
          key={k}
          ref={(el) => {
            refs.current[k] = el;
          }}
        >
          <sphereGeometry args={[0.1 - k * 0.018, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.9 - k * 0.18} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Pads() {
  const theme = PLANET_THEME[engine.map.id];
  const buildType = useGameStore((s) => s.buildType);
  const selected = useGameStore((s) => s.hud.selectedId);
  const hover = useGameStore((s) => s.hoverPad);
  const pads = engine.padWorld;
  return (
    <group>
      {pads.map((p, i) => {
        const occ = engine.occupied[i] !== -1;
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
            {!occ && buildType && hover === i ? (
              <group position={[0, 0.02, 0]} scale={1.2}>
                <TowerGhost type={buildType} />
              </group>
            ) : null}
            {!occ && buildType && hover === i ? (
              <RangeRing radius={towerStats(TOWERS[buildType], 1).range} color={TOWERS[buildType].color} />
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function TowerGhost({ type }: { type: TowerId }) {
  return (
    <group>
      <TowerModel type={type} level={1} />
    </group>
  );
}

function TowersLayer() {
  const selected = useGameStore((s) => s.hud.selectedId);
  const count = useGameStore((s) => s.hud.towers);
  const refs = useRef<(Group | null)[]>([]);
  const flashRefs = useRef<(Mesh | null)[]>([]);
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
  const links: { key: string; ax: number; az: number; bx: number; bz: number; color: string }[] = [];
  const r2 = SYN_RANGE * SYN_RANGE;
  for (let i = 0; i < engine.towers.length; i++) {
    for (let j = i + 1; j < engine.towers.length; j++) {
      const a = engine.towers[i];
      const b = engine.towers[j];
      if (a.type !== b.type) continue;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      if (dx * dx + dz * dz > r2) continue;
      links.push({ key: `${a.id}-${b.id}`, ax: a.x, az: a.z, bx: b.x, bz: b.z, color: TOWERS[a.type].color });
    }
  }
  void n;
  return (
    <group>
      {links.map((l) => {
        const mx = (l.ax + l.bx) / 2;
        const mz = (l.az + l.bz) / 2;
        const len = Math.hypot(l.bx - l.ax, l.bz - l.az) || 0.001;
        const yaw = Math.atan2(l.bx - l.ax, l.bz - l.az);
        return (
          <mesh key={l.key} position={[mx, 0.28, mz]} rotation={[0, yaw, 0]}>
            <boxGeometry args={[0.045, 0.035, len]} />
            <meshBasicMaterial color={l.color} transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} />
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
      g.scale.setScalar((1 + flash * 0.08) * slow);
      const shadow = g.children[1];
      if (shadow) shadow.position.y = -e.y + 0.03;
    }
  });
  void gen;
  return (
    <group>
      {engine.enemies.map((e) => (
        <group
          key={`${e.slot}-${e.type}`}
          ref={(el) => {
            groups.current[e.slot] = el;
          }}
          visible={false}
        >
          <EnemyModel type={e.type} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -e.y + 0.03, 0]}>
            <ringGeometry args={[0.22, 0.4, 16]} />
            <meshBasicMaterial
              color={FACTION_MARK[ENEMIES[e.type].faction]}
              transparent
              opacity={0.55}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <HpPip slot={e.slot} />
        </group>
      ))}
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
    root.current.position.y = e.flying ? 1.45 : e.boss ? 1.9 : 1.12;
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
        <planeGeometry args={[0.84, 0.09]} />
        <meshBasicMaterial color="#07080a" />
      </mesh>
      <mesh ref={fill} position={[0, 0, 0.01]}>
        <planeGeometry args={[0.76, 0.05]} />
        <meshBasicMaterial color="#8fb4c4" />
      </mesh>
    </group>
  );
}

function BoltLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_BOLTS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = engine.bolts[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = b.alive;
      if (!b.alive) continue;
      g.position.set(b.x, b.y, b.z);
      if (b.vx || b.vz || b.vy) g.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
      const mesh = g.children[0] as Mesh | undefined;
      const mat = mesh?.material as MeshBasicMaterial | undefined;
      if (mat?.color) mat.color.set(b.color);
      const trail = g.children[1] as Mesh | undefined;
      const tmat = trail?.material as MeshBasicMaterial | undefined;
      if (tmat?.color) tmat.color.set(b.color);
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

function BeamLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_BEAMS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_BEAMS; i++) {
      const b = engine.beams[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = b.alive;
      if (!b.alive) continue;
      const dx = b.x2 - b.x1;
      const dy = b.y2 - b.y1;
      const dz = b.z2 - b.z1;
      const len = Math.hypot(dx, dy, dz) || 0.001;
      g.position.set((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, (b.z1 + b.z2) / 2);
      g.lookAt(b.x2, b.y2, b.z2);
      g.scale.set(b.width, b.width, len);
      const fade = Math.max(0, b.ttl / b.maxTtl);
      const core = (g.children[0] as unknown as { material?: { opacity: number } })?.material;
      const glow = (g.children[1] as unknown as { material?: { opacity: number } })?.material;
      if (core) core.opacity = fade;
      if (glow) glow.opacity = fade * 0.45;
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
            <cylinderGeometry args={[0.22, 0.22, 1, 6]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 1, 6]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
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
      const sph = (g.children[0] as unknown as { material?: { opacity: number } })?.material;
      const ring = (g.children[1] as unknown as { material?: { opacity: number } })?.material;
      if (sph) sph.opacity = fade * 0.7;
      if (ring) ring.opacity = fade * 0.85;
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

function FloaterLayer() {
  const refs = useRef<(Group | null)[]>(Array(MAX_FLOATERS).fill(null));
  const labels = useRef<(HTMLSpanElement | null)[]>(Array(MAX_FLOATERS).fill(null));
  useFrame(() => {
    for (let i = 0; i < MAX_FLOATERS; i++) {
      const f = engine.floaters[i];
      const g = refs.current[i];
      if (!g) continue;
      g.visible = f.alive;
      if (!f.alive) continue;
      g.position.set(f.x, f.y + 0.15, f.z);
      const k = Math.max(0, Math.min(1, f.ttl / 0.7));
      g.scale.setScalar(0.75 + k * 0.35);
      const el = labels.current[i];
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
            >
              +0
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
}
