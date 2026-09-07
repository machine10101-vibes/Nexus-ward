import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Crosshair,
  FastForward,
  Minus,
  Pause,
  Play,
  Radio,
  Snowflake,
  Waves,
  Zap,
} from "lucide-react";
import { ENEMIES, OVERCLOCK_CD, PLANET_THEME, SURGE_CD, TOWERS, TOWER_ORDER, towerStats, upgradeCost } from "@/game/config";
import { engine } from "@/game/engine";
import { useGameStore } from "@/game/store";
import { audio } from "@/game/audio";
import type { Targeting, TowerId } from "@/game/types";
import { cn } from "@/lib/utils";

const ICONS: Record<TowerId, typeof Zap> = {
  pulse: Crosshair,
  arc: Zap,
  frost: Snowflake,
  tesla: Radio,
  rail: Minus,
};

const TARGET_SHORT: Record<Targeting, string> = {
  first: "1st",
  last: "Last",
  closest: "Near",
  strongest: "Max",
  weakest: "Min",
};

export function Hud() {
  const hud = useGameStore((s) => s.hud);
  const buildType = useGameStore((s) => s.buildType);
  const screen = useGameStore((s) => s.screen);
  if (screen !== "playing") return null;
  const selected = engine.getSelected();
  const canWave = hud.phase === "build" && hud.wave < hud.waveTotal;
  const corePct = hud.maxLives ? hud.lives / hud.maxLives : 1;
  const preview = engine.nextWaveGroups();
  const waveN = Math.min(hud.wave + (hud.phase === "build" ? 1 : 0), hud.waveTotal);
  const wavePct = hud.phase === "combat" && hud.waveSize > 0 ? 1 - hud.remaining / hud.waveSize : 0;
  const critical = corePct <= 0.25;
  const theme = PLANET_THEME[engine.map.id];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <HudFrame critical={critical} />

      <div className="flex items-start justify-between gap-3">
        <div className="hud-panel flex items-center gap-3 px-3 py-2">
          <CoreRing pct={corePct} lives={hud.lives} />
          <span className="h-9 w-px bg-border" />
          <StatBlock label="credits" value={hud.gold} />
          {hud.phase === "combat" ? (
            <>
              <span className="hidden h-9 w-px bg-border sm:block" />
              <div className="hidden min-w-10 flex-col sm:flex">
                <TickNum value={hud.kills} className="font-display text-lg leading-none" />
                <span className="hud-label mt-1.5">kills</span>
              </div>
            </>
          ) : null}
          {hud.combo >= 2 ? (
            <>
              <span className="hidden h-9 w-px bg-border sm:block" />
              <div className="hidden min-w-10 flex-col sm:flex">
                <span className="font-display text-lg tabular-nums leading-none text-accent">×{hud.combo}</span>
                <span className="hud-label mt-1.5">combo</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col items-center gap-2">
          <div className="hud-panel min-w-40 px-4 py-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="size-1.5 rounded-full" style={{ background: theme.core }} />
              <p className="hud-label">{engine.map.name}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-2">
              <span className={cn("phase-dot", hud.phase === "combat" && "phase-dot-hot")} />
              <p className="font-display text-2xs uppercase tracking-label text-muted">
                {hud.phase === "combat" ? "Incursion" : "Build"}
              </p>
              <p className="font-display text-sm tabular-nums leading-none tracking-display text-fg">
                {waveN}
                <span className="text-muted"> / {hud.waveTotal}</span>
              </p>
            </div>
            <span className="mx-auto mt-2 block h-1 w-32 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)]"
                style={{ width: `${Math.max(4, (hud.phase === "combat" ? wavePct : hud.wave / Math.max(1, hud.waveTotal)) * 100)}%` }}
              />
            </span>
          </div>
          <WaveChips groups={preview} combat={hud.phase === "combat"} remaining={hud.remaining} />
          {hud.overclockOn ? <StatusChip>Overclock</StatusChip> : null}
          {hud.event ? (
            <p className="max-w-[18rem] truncate text-center font-mono text-2xs text-muted">{hud.event}</p>
          ) : null}
        </div>

        <div className="pointer-events-auto hud-panel flex items-center p-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                engine.setSpeed(n);
                audio.ui();
                useGameStore.getState().syncHud();
              }}
              className={cn(
                "hidden h-11 min-w-11 items-center justify-center rounded-lg font-display text-xs tabular-nums transition-colors duration-[var(--motion-quick)] sm:inline-flex",
                hud.speed === n ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              {n}×
            </button>
          ))}
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-fg transition-colors duration-[var(--motion-quick)] hover:bg-surface-2"
            onClick={() => useGameStore.getState().pause()}
            aria-label="Pause"
          >
            <Pause className="size-4" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:inset-x-5 sm:bottom-5">
        {selected ? (
          <div className="pointer-events-auto ml-auto w-[min(100%,20rem)]">
            <TowerCard />
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-2">
          <div className="pointer-events-auto hud-panel flex gap-1 overflow-x-auto p-2">
            {TOWER_ORDER.map((id, i) => {
              const d = TOWERS[id];
              const Icon = ICONS[id];
              const on = buildType === id;
              const afford = hud.gold >= d.cost;
              return (
                <button
                  key={id}
                  type="button"
                  title={`${d.name} — ${d.desc} · ${i + 1}`}
                  onClick={() => {
                    engine.buildType = on ? null : id;
                    engine.selectedTower = null;
                    useGameStore.setState({ buildType: engine.buildType });
                    useGameStore.getState().syncHud();
                    audio.ui();
                  }}
                  className={cn(
                    "relative flex min-h-11 min-w-16 flex-col items-center gap-1 overflow-hidden rounded-lg px-2.5 py-2 transition-colors duration-[var(--motion-quick)]",
                    on ? "bg-accent text-accent-fg" : afford ? "text-fg hover:bg-surface-2" : "text-subtle",
                  )}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-0.5"
                    style={{ background: on ? "var(--color-accent-fg)" : d.color, opacity: afford || on ? 1 : 0.35 }}
                  />
                  <span className="relative mt-0.5">
                    <Icon className="size-4" />
                  </span>
                  <span className="font-display text-2xs uppercase tracking-label">{d.short}</span>
                  <span className="flex items-center gap-1.5 font-mono text-2xs tabular-nums">
                    {d.cost}
                    <span className={cn("text-subtle", on && "text-accent-fg/70")}>{i + 1}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pointer-events-auto hud-panel flex items-center gap-1 p-2">
            <AbilityIcon
              label="Surge"
              hint="Q"
              ready={hud.surgeCd <= 0}
              cd={hud.surgeCd}
              max={SURGE_CD}
              onClick={() => {
                engine.castSurge();
                useGameStore.getState().syncHud();
              }}
            >
              <Waves className="size-4" />
            </AbilityIcon>
            <AbilityIcon
              label="Overclock"
              hint="E"
              ready={hud.overclockCd <= 0}
              cd={hud.overclockCd}
              max={OVERCLOCK_CD}
              hot={hud.overclockOn}
              onClick={() => {
                engine.castOverclock();
                useGameStore.getState().syncHud();
              }}
            >
              <FastForward className="size-4" />
            </AbilityIcon>
            {canWave ? (
              <button
                type="button"
                onClick={() => {
                  engine.startWave();
                  audio.wave();
                  useGameStore.getState().syncHud();
                }}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-fg px-4 font-display text-sm text-bg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.96]"
              >
                <Play className="size-4 translate-x-px" />
                <span className="hidden sm:inline">{hud.wave === 0 ? "Deploy" : hud.bonus > 0 ? `Wave +${hud.bonus}` : "Wave"}</span>
                <span className="sm:hidden">{hud.bonus > 0 ? `+${hud.bonus}` : "Go"}</span>
              </button>
            ) : hud.phase === "combat" ? (
              <div className="flex h-11 min-w-16 flex-col items-center justify-center px-3">
                <span className="font-display text-sm tabular-nums leading-none">{hud.living}</span>
                <span className="hud-label mt-1">live</span>
              </div>
            ) : null}
            <button
              type="button"
              title="Auto-incursion"
              onClick={() => {
                engine.toggleAutoWave();
                audio.ui();
                useGameStore.getState().syncHud();
              }}
              className={cn(
                "hidden h-11 min-w-11 items-center justify-center rounded-lg font-display text-2xs uppercase tracking-label transition-colors duration-[var(--motion-quick)] sm:inline-flex",
                hud.autoWave ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              Auto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HudFrame({ critical }: { critical: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-2 sm:inset-3",
        critical && "outline outline-1 outline-danger/50",
      )}
    >
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-12 flex-col">
      <TickNum value={value} className="font-display text-lg leading-none" />
      <span className="hud-label mt-1.5">{label}</span>
    </div>
  );
}

function TickNum({ value, className }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPop(true);
    const t = window.setTimeout(() => setPop(false), 180);
    return () => window.clearTimeout(t);
  }, [value]);
  return <span className={cn("tabular-nums", pop && "hud-num-pop", className)}>{value}</span>;
}

function CoreRing({ pct, lives }: { pct: number; lives: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0.08, pct) * c;
  const critical = pct <= 0.25;
  return (
    <div className="flex items-center gap-2.5">
      <svg className="size-10 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={critical ? "var(--color-danger)" : "var(--color-ok)"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <circle cx="18" cy="18" r="5" fill="var(--color-surface-2)" />
        <circle
          cx="18"
          cy="18"
          r="3"
          fill={critical ? "var(--color-danger)" : "var(--color-ok)"}
          style={critical ? { animation: "core-warn 1.2s ease-in-out infinite" } : undefined}
        />
      </svg>
      <div className="flex flex-col">
        <TickNum
          value={lives}
          className={cn("font-display text-lg leading-none", critical ? "text-danger" : "text-fg")}
        />
        <span className="hud-label mt-1.5">core</span>
      </div>
    </div>
  );
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface/90 px-2.5 py-0.5 font-display text-2xs uppercase tracking-label text-accent">
      {children}
    </span>
  );
}

function AbilityIcon({
  label,
  hint,
  ready,
  cd,
  max,
  hot,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  ready: boolean;
  cd: number;
  max: number;
  hot?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const remain = Math.max(0, Math.min(1, 1 - cd / max));
  const r = 15;
  const circ = 2 * Math.PI * r;
  return (
    <button
      type="button"
      disabled={!ready && !hot}
      title={`${label} (${hint})`}
      aria-label={label}
      onClick={() => {
        onClick();
        audio.ui();
      }}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-lg transition-colors duration-[var(--motion-quick)]",
        hot ? "bg-accent text-accent-fg" : ready ? "text-fg hover:bg-surface-2" : "text-subtle",
      )}
    >
      {!ready && !hot ? (
        <svg className="pointer-events-none absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth="2"
            strokeDasharray={`${remain * circ} ${circ}`}
          />
        </svg>
      ) : null}
      {children}
      {!ready ? (
        <span className="absolute -bottom-0.5 font-mono text-2xs tabular-nums text-muted">{Math.ceil(cd)}</span>
      ) : (
        <span className="absolute -bottom-0.5 font-display text-2xs uppercase tracking-label text-subtle">{hint}</span>
      )}
    </button>
  );
}

function WaveChips({
  groups,
  combat,
  remaining,
}: {
  groups: { enemy: import("@/game/types").EnemyId; count: number }[];
  combat: boolean;
  remaining: number;
}) {
  if (!groups.length) return null;
  return (
    <div className="flex max-w-[min(100%,28rem)] items-center gap-1 overflow-x-auto">
      {groups.map((g, i) => {
        const d = ENEMIES[g.enemy];
        return (
          <span
            key={`${g.enemy}${i}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2 py-0.5 font-mono text-2xs tabular-nums",
              d.boss ? "text-danger" : d.flying ? "text-accent" : "text-muted",
            )}
          >
            <span
              className="size-1.5 rounded-full"
              style={{
                background: d.boss ? "var(--color-danger)" : d.flying ? "var(--color-accent)" : "var(--color-muted)",
              }}
            />
            {d.name} {g.count}
          </span>
        );
      })}
      {combat ? <span className="shrink-0 font-mono text-2xs tabular-nums text-subtle">{remaining} left</span> : null}
    </div>
  );
}

function TowerCard() {
  const t = engine.getSelected();
  const gold = useGameStore((s) => s.hud.gold);
  if (!t) return null;
  const def = TOWERS[t.type];
  const stats = towerStats(def, t.level);
  const up = t.level < 3 ? upgradeCost(def.cost, t.level) : null;
  const refund = Math.floor(t.invested * 0.6);
  const syn = engine.synergy(t);
  const dps = stats.damage * stats.fireRate * (syn ? 1.15 : 1);
  return (
    <div className="hud-panel p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: def.color }} />
          <p className="font-display text-sm text-fg">{def.name}</p>
        </div>
        <p className="hud-label">
          Rank {t.level}
          {syn ? " · linked" : ""}
        </p>
      </div>
      <p className="mt-1 font-mono text-2xs tabular-nums text-muted">
        {Math.round(dps)} dps · {t.kills} kills · {stats.range.toFixed(1)} rng
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, (t.level / 3) * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex gap-1">
        {(Object.keys(TARGET_SHORT) as Targeting[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              engine.setTargeting(p);
              useGameStore.getState().syncHud();
            }}
            className={cn(
              "h-10 flex-1 rounded-md text-2xs uppercase tracking-label transition-colors duration-[var(--motion-quick)]",
              t.targeting === p ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {TARGET_SHORT[p]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {up != null ? (
          <button
            type="button"
            disabled={gold < up}
            onClick={() => {
              engine.upgradeSelected();
              audio.place();
              useGameStore.getState().syncHud();
            }}
            className="h-11 flex-1 rounded-lg bg-fg text-xs font-medium text-bg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.96] disabled:opacity-40"
          >
            Upgrade {up}
          </button>
        ) : (
          <div className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-xs text-muted">
            Max
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            engine.sellSelected();
            audio.ui();
            useGameStore.getState().syncHud();
          }}
          className="h-11 rounded-lg border border-border px-3 text-xs text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
        >
          Salvage {refund}
        </button>
      </div>
    </div>
  );
}
