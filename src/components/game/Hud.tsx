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
import {
  ENEMIES,
  OVERCLOCK_CD,
  PLANET_THEME,
  RANK_NOTES,
  SURGE_CD,
  TOWERS,
  TOWER_ORDER,
  towerStats,
  upgradeCost,
} from "@/game/config";
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

/** The platform hint is a one-shot teach, not a recurring nag. */
let padHintSpent = false;

export function Hud() {
  const hud = useGameStore((s) => s.hud);
  const buildType = useGameStore((s) => s.buildType);
  const hoverPad = useGameStore((s) => s.hoverPad);
  const screen = useGameStore((s) => s.screen);
  const leakPulse = usePulse(hud.leaked);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!buildType || padHintSpent) return;
    const t = window.setTimeout(() => setHint(true), 600);
    return () => window.clearTimeout(t);
  }, [buildType]);

  useEffect(() => {
    if (hoverPad == null && !hud.placeGen) return;
    if (!hint) return;
    padHintSpent = true;
    setHint(false);
  }, [hoverPad, hud.placeGen, hint]);

  if (screen !== "playing") return null;
  const selected = engine.getSelected();
  const canWave = hud.phase === "build" && hud.wave < hud.waveTotal;
  const corePct = hud.maxLives ? hud.lives / hud.maxLives : 1;
  const preview = engine.nextWaveGroups();
  const waveN = Math.min(hud.wave + (hud.phase === "build" ? 1 : 0), hud.waveTotal);
  const wavePct = hud.phase === "combat" && hud.waveSize > 0 ? 1 - hud.remaining / hud.waveSize : 0;
  const critical = corePct <= 0.25;
  const theme = PLANET_THEME[engine.map.id];
  const showHint = hint && !!buildType && hoverPad == null && !padHintSpent;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <HudFrame critical={critical} leak={leakPulse} />

      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="hud-panel flex shrink-0 items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3">
          <CoreRing pct={corePct} lives={hud.lives} leak={leakPulse} />
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

        <div className="flex min-w-0 flex-1 justify-center">
          <div className="hud-panel w-full max-w-44 px-2 py-2 text-center sm:min-w-40 sm:px-4">
            <div className="flex items-center justify-center gap-2">
              <span className="size-1.5 rounded-full" style={{ background: theme.core }} />
              <p className="hud-label">{engine.map.name}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap sm:gap-2">
              <span className={cn("phase-dot", hud.phase === "combat" && "phase-dot-hot")} />
              <p className="font-display text-2xs uppercase tracking-label text-muted">
                {hud.phase === "combat" ? "Incursion" : "Build"}
              </p>
              <p className="font-display text-sm tabular-nums leading-none tracking-display text-fg">
                {waveN}
                <span className="text-muted"> / {hud.waveTotal}</span>
              </p>
            </div>
            <span className="mx-auto mt-2 block h-1 w-full max-w-32 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-accent transition-[width] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)]"
                style={{ width: `${Math.max(4, (hud.phase === "combat" ? wavePct : hud.wave / Math.max(1, hud.waveTotal)) * 100)}%` }}
              />
            </span>
          </div>
        </div>

        <div className="pointer-events-auto hud-panel flex shrink-0 items-center p-1.5 sm:p-2">
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

      {/* Below the corner panels rather than between them, so narrow screens keep it legible. */}
      <div className="mt-2 flex flex-col items-center gap-2">
        <WaveChips groups={preview} combat={hud.phase === "combat"} remaining={hud.remaining} />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {hud.overclockOn ? <StatusChip>Overclock</StatusChip> : null}
          {hud.autoIn >= 0 ? <StatusChip muted>Auto in {hud.autoIn.toFixed(1)}s</StatusChip> : null}
        </div>
        {hud.event ? (
          <p className="max-w-full truncate text-center font-mono text-2xs text-muted">{hud.event}</p>
        ) : null}
      </div>

      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:inset-x-5 sm:bottom-5">
        {selected ? (
          <div className="pointer-events-auto ml-auto w-[min(100%,21rem)]">
            <TowerCard />
          </div>
        ) : null}
        {showHint ? (
          <p className="mx-auto rounded-full border border-border bg-surface/90 px-3 py-1 font-display text-2xs uppercase tracking-label text-muted">
            Tap a lit platform to place
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <Tray buildType={buildType} gold={hud.gold} denyGen={hud.denyGen} />

          <div className="pointer-events-auto hud-panel flex items-center gap-1 self-end p-2 sm:self-auto">
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
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-fg pl-3.5 pr-2.5 font-display text-sm text-bg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.96]"
              >
                <Play className="size-4 translate-x-px" />
                <span className="hidden sm:inline">{hud.wave === 0 ? "Deploy" : "Deploy wave"}</span>
                {hud.bonus > 0 ? (
                  <span className="rounded-md bg-bg/12 px-1.5 py-0.5 font-mono text-2xs tabular-nums">
                    +<TickNum value={hud.bonus} />
                  </span>
                ) : (
                  <span className="sm:hidden">Go</span>
                )}
              </button>
            ) : hud.phase === "combat" ? (
              <div className="flex h-11 min-w-16 flex-col items-center justify-center px-3">
                <span className="font-display text-sm tabular-nums leading-none">{hud.living}</span>
                <span className="hud-label mt-1">live</span>
              </div>
            ) : null}
            <button
              type="button"
              title="Auto-incursion (A)"
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

function Tray({ buildType, gold, denyGen }: { buildType: TowerId | null; gold: number; denyGen: number }) {
  const denied = useRef(0);
  const [flash, setFlash] = useState<TowerId | null>(null);
  useEffect(() => {
    if (denyGen === denied.current) return;
    denied.current = denyGen;
    setFlash(engine.denyType);
    const t = window.setTimeout(() => setFlash(null), 320);
    return () => window.clearTimeout(t);
  }, [denyGen]);

  return (
    <div className="pointer-events-auto hud-panel flex gap-1 overflow-x-auto p-2 sm:w-auto">
      {TOWER_ORDER.map((id, i) => {
        const d = TOWERS[id];
        const Icon = ICONS[id];
        const on = buildType === id;
        const afford = gold >= d.cost;
        return (
          <button
            key={id}
            type="button"
            title={`${d.name} — ${d.desc} · key ${i + 1}`}
            onClick={() => {
              const next = on ? null : id;
              engine.setBuildType(next);
              useGameStore.setState({ buildType: next });
              useGameStore.getState().syncHud();
              audio.ui();
            }}
            className={cn(
              "relative flex min-h-11 min-w-16 flex-1 flex-col items-center gap-1 overflow-hidden rounded-lg px-2.5 py-2 transition-colors duration-[var(--motion-quick)] sm:flex-none",
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
            <span
              className={cn(
                "flex items-center gap-1.5 font-mono text-2xs tabular-nums",
                flash === id && "hud-cost-deny",
              )}
            >
              {d.cost}
              <span className={cn("text-subtle", on && "text-accent-fg/70")}>{i + 1}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HudFrame({ critical, leak }: { critical: boolean; leak: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-2 sm:inset-3",
        critical && "hud-critical",
        leak && "hud-leak",
      )}
    >
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />
    </div>
  );
}

/** True for a short beat after `value` grows — used for one-shot HUD punches. */
function usePulse(value: number, ms = 420) {
  const prev = useRef(value);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (value <= prev.current) {
      prev.current = value;
      return;
    }
    prev.current = value;
    setOn(true);
    const t = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return on;
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

function CoreRing({ pct, lives, leak }: { pct: number; lives: number; leak: boolean }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0.08, pct) * c;
  const critical = pct <= 0.25;
  return (
    <div className="flex items-center gap-2.5">
      <svg className={cn("size-10 -rotate-90", leak && "hud-core-hit")} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={critical || leak ? "var(--color-danger)" : "var(--color-ok)"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <circle cx="18" cy="18" r="5" fill="var(--color-surface-2)" />
        <circle
          cx="18"
          cy="18"
          r="3"
          fill={critical || leak ? "var(--color-danger)" : "var(--color-ok)"}
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

function StatusChip({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border border-border bg-surface/90 px-2.5 py-0.5 font-display text-2xs uppercase tracking-label tabular-nums",
        muted ? "text-muted" : "text-accent",
      )}
    >
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
            {d.flying ? <span className="text-subtle">air</span> : null}
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
  const rankGen = useGameStore((s) => s.hud.rankGen);
  const denyGen = useGameStore((s) => s.hud.denyGen);
  const bumped = usePulse(rankGen, 460);
  const denied = usePulse(denyGen, 320);
  if (!t) return null;
  const def = TOWERS[t.type];
  const notes = RANK_NOTES[t.type];
  const stats = towerStats(def, t.level);
  const up = t.level < 3 ? upgradeCost(def.cost, t.level) : null;
  const refund = engine.refundFor(t);
  const syn = engine.synergy(t);
  const dps = stats.damage * stats.fireRate * (syn ? 1.15 : 1) * (t.level >= 3 ? 1.12 : 1);
  const short = up != null ? Math.max(0, up - gold) : 0;
  return (
    <div className="hud-panel p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: def.color }} />
          <p className="font-display text-sm text-fg">{def.name}</p>
        </div>
        <p className="hud-label">
          {def.hitsFlying ? "Ground + air" : "Ground only"}
        </p>
      </div>
      <p className="mt-1.5 font-mono text-2xs tabular-nums text-muted">
        {Math.round(dps)} dps · {stats.range.toFixed(1)} rng · {t.kills} kills
        {syn ? <span className="text-accent"> · linked +15%</span> : null}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 w-6 rounded-full",
                n <= t.level ? "bg-accent" : "bg-surface-2",
                bumped && n === t.level && "hud-pip-fill",
              )}
            />
          ))}
        </div>
        <span className="hud-label">
          Rank {t.level}
          {t.level >= 3 ? ` · ${notes.overdrive}` : ""}
        </span>
      </div>

      {up != null ? (
        <div className="mt-2 rounded-lg border border-border p-2">
          <p className="font-display text-2xs uppercase tracking-label text-fg">
            {t.level === 2 ? `Rank 3 · ${notes.overdrive}` : "Rank 2"}
          </p>
          <p className="mt-1 text-xs leading-snug text-muted">{t.level === 2 ? notes.r3 : notes.r2}</p>
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-border p-2">
          <p className="font-display text-2xs uppercase tracking-label text-accent">Overdrive active</p>
          <p className="mt-1 text-xs leading-snug text-muted">{notes.r3}</p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {(Object.keys(TARGET_SHORT) as Targeting[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              engine.setTargeting(p);
              audio.ui();
              useGameStore.getState().syncHud();
            }}
            className={cn(
              "h-11 min-w-[3.25rem] flex-1 rounded-md font-display text-2xs uppercase tracking-label transition-colors duration-[var(--motion-quick)]",
              t.targeting === p ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
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
              useGameStore.getState().syncHud();
            }}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-fg px-3 text-xs font-medium text-bg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45",
              denied && gold < up && "hud-cost-deny",
            )}
          >
            <span>Upgrade</span>
            <span className="font-mono tabular-nums">{up}</span>
            <span className="rounded bg-bg/12 px-1 font-display text-2xs uppercase tracking-label">U</span>
          </button>
        ) : (
          <div className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-xs text-muted">
            Rank maxed
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            engine.sellSelected();
            useGameStore.getState().syncHud();
          }}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted transition-colors duration-[var(--motion-quick)] hover:border-border-strong hover:text-fg"
        >
          <span className="font-mono tabular-nums text-fg">+{refund}</span>
          <span>Salvage</span>
          <span className="rounded border border-border px-1 font-display text-2xs uppercase tracking-label">X</span>
        </button>
      </div>
      {up != null && short > 0 ? (
        <p className="mt-1.5 text-right font-mono text-2xs tabular-nums text-subtle">Need {short} more</p>
      ) : null}
    </div>
  );
}
