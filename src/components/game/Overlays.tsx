import { useEffect } from "react";
import { ArrowLeft, Check, Settings2 } from "lucide-react";
import { MAPS, MAP_ORDER } from "@/game/maps";
import { useGameStore } from "@/game/store";
import { engine } from "@/game/engine";
import { audio } from "@/game/audio";
import { loadSave } from "@/game/save";
import type { MapId } from "@/game/types";
import { cn } from "@/lib/utils";

export function Overlays() {
  const screen = useGameStore((s) => s.screen);
  if (screen === "playing") return null;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto">
      {screen === "title" && <Title />}
      {screen === "select" && <Select />}
      {screen === "briefing" && <Briefing />}
      {screen === "paused" && <Paused />}
      {screen === "won" && <Result won />}
      {screen === "lost" && <Result won={false} />}
      {screen === "help" && <Help />}
      {screen === "settings" && <Settings />}
    </div>
  );
}

function Frame() {
  return (
    <div className="pointer-events-none absolute inset-3 sm:inset-5">
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />
    </div>
  );
}

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative flex min-h-full flex-col justify-end bg-gradient-to-t from-bg from-20% via-bg/55 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
      <Frame />
      <div className={cn("mx-auto w-full max-w-xl", className)}>{children}</div>
    </div>
  );
}

function Title() {
  return (
    <Shell>
      <div className="stagger-in">
        <p className="font-display text-2xs uppercase tracking-label text-accent">Orbital defense</p>
        <h1 className="mt-3 font-display text-5xl font-medium leading-[0.95] tracking-display text-fg sm:text-6xl">
          Nexus Ward
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
          Hold the planetary cores. Three worlds — living, forged, and fused — want them back. Build the grid. Spend the wreckage. Do not let the lattice in.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="h-12 rounded-xl bg-fg px-6 font-display text-sm text-bg transition-transform duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] active:scale-[0.96]"
            onClick={() => {
              audio.unlock();
              audio.ui();
              useGameStore.getState().setScreen("select");
            }}
          >
            Enter the grid
          </button>
          <button
            type="button"
            className="h-12 rounded-xl border border-border px-6 font-display text-sm text-fg transition-colors duration-[var(--motion-quick)] hover:border-border-strong"
            onClick={() => {
              audio.unlock();
              useGameStore.getState().openHelp();
            }}
          >
            How to hold
          </button>
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
            onClick={() => {
              audio.unlock();
              useGameStore.getState().openSettings();
            }}
            aria-label="Settings"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Select() {
  const preview = useGameStore((s) => s.preview);
  const completed = useGameStore((s) => s.completed);
  const best = loadSave().best;
  return (
    <Shell className="max-w-3xl">
      <button
        type="button"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
        onClick={() => useGameStore.getState().setScreen("title")}
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <p className="font-display text-2xs uppercase tracking-label text-accent">Select a world</p>
      <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">The three fronts</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {MAP_ORDER.map((id) => {
          const m = MAPS[id];
          const on = preview === id;
          const done = completed.includes(id);
          return (
            <button
              key={id}
              type="button"
              onMouseEnter={() => useGameStore.getState().setPreview(id)}
              onFocus={() => useGameStore.getState().setPreview(id)}
              onClick={() => useGameStore.getState().startBriefing(id)}
              className={cn(
                "overflow-hidden rounded-xl border text-left transition-colors duration-[var(--motion-fast)]",
                on ? "border-accent bg-surface" : "border-border bg-surface/70 hover:border-border-strong",
              )}
            >
              <PlanetSwatch id={id} />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg">{m.name}</p>
                  {done ? <Check className="size-4 text-ok" /> : null}
                </div>
                <p className="text-xs uppercase tracking-label text-muted">{m.subtitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{m.hint}</p>
                <p className="mt-3 font-mono text-2xs tabular-nums text-subtle">
                  {m.lives} core · {m.startGold} cr · {m.waves.length} waves
                </p>
                {best[id] ? (
                  <p className="mt-3 font-mono text-2xs tabular-nums text-subtle">
                    Best wave {best[id]!.wave} · cores {best[id]!.cores}
                  </p>
                ) : (
                  <p className="mt-3 font-mono text-2xs text-subtle">Uncharted</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function PlanetSwatch({ id }: { id: MapId }) {
  return (
    <div
      className="relative h-28 overflow-hidden"
      style={{
        backgroundImage: `url(/textures/${id}-planet.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
      <div
        className="absolute left-1/2 top-1/2 size-[4.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full outline outline-1 outline-fg/20"
        style={{
          backgroundImage: `url(/textures/${id}-planet.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}

function Briefing() {
  const id = useGameStore((s) => s.mapId) ?? "mycelion";
  const m = MAPS[id];
  return (
    <Shell>
      <button
        type="button"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
        onClick={() => useGameStore.getState().setScreen("select")}
      >
        <ArrowLeft className="size-4" />
        Worlds
      </button>
      <p className="font-display text-2xs uppercase tracking-label text-accent">{m.subtitle}</p>
      <h2 className="mt-2 font-display text-4xl tracking-display">{m.name}</h2>
      <p className="mt-4 text-base leading-relaxed text-muted">{m.lore}</p>
      <p className="mt-3 text-sm text-fg">{m.hint}</p>
      <p className="mt-4 font-mono text-xs tabular-nums text-subtle">
        {m.lives} core integrity · {m.startGold} credits · {m.waves.length} incursions
      </p>
      <button
        type="button"
        className="mt-8 h-12 w-full rounded-xl bg-fg font-display text-sm text-bg transition-transform duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] active:scale-[0.96] sm:w-auto sm:px-8"
        onClick={() => useGameStore.getState().dropIn()}
      >
        Drop in
      </button>
    </Shell>
  );
}

function Paused() {
  return (
    <div className="flex min-h-full items-center justify-center bg-bg/70 px-5 backdrop-blur-[2px]">
      <div className="overlay-in w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl tracking-[-0.03em]">Paused</h2>
        <p className="mt-2 text-sm text-muted">The grid holds. Resume when ready.</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="h-11 rounded-lg bg-fg text-sm text-bg transition-transform duration-[var(--motion-quick)] active:scale-[0.96]"
            onClick={() => useGameStore.getState().resume()}
          >
            Resume
          </button>
          <button
            type="button"
            className="h-11 rounded-lg border border-border text-sm text-fg"
            onClick={() => useGameStore.getState().openSettings()}
          >
            Settings
          </button>
          <button
            type="button"
            className="h-11 rounded-lg border border-border text-sm text-muted"
            onClick={() => useGameStore.getState().abortToSelect()}
          >
            Abandon world
          </button>
        </div>
      </div>
    </div>
  );
}

function Result({ won }: { won: boolean }) {
  useEffect(() => {
    useGameStore.getState().noteResult(won);
  }, [won]);
  const m = engine.map;
  return (
    <div className="flex min-h-full items-center justify-center bg-bg/75 px-5 backdrop-blur-[2px]">
      <div className="overlay-in w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <p className="font-display text-2xs uppercase tracking-label text-accent">{m.name}</p>
        <h2 className="mt-2 font-display text-3xl tracking-display">{won ? "The core holds" : "Core collapsed"}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {won
            ? "The last incursion broke on the grid. The nexus still sings."
            : "The lattice reached the heart. Salvage what you can and drop in again."}
        </p>
        <p className="mt-4 font-mono text-xs tabular-nums text-subtle">
          Wave {engine.wave}/{m.waves.length} · {engine.kills} kills · {engine.leaked} leaks · {engine.goldEarned} salvage
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="h-11 flex-1 rounded-lg bg-fg text-sm text-bg transition-transform duration-[var(--motion-quick)] active:scale-[0.96]"
            onClick={() => useGameStore.getState().dropIn()}
          >
            Redeploy
          </button>
          <button
            type="button"
            className="h-11 flex-1 rounded-lg border border-border text-sm text-fg"
            onClick={() => useGameStore.getState().abortToSelect()}
          >
            Other worlds
          </button>
        </div>
      </div>
    </div>
  );
}

function Help() {
  return (
    <div className="flex min-h-full items-center justify-center bg-bg/80 px-5 py-10">
      <div className="overlay-in w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl tracking-[-0.03em]">How to hold</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <span className="text-fg">1. Choose a battery</span> from the tray, then tap a hex platform beside the path.
          </li>
          <li>
            <span className="text-fg">2. Initialize the wave</span> when your line is ready. Starting fast pays an early-deploy bonus.
          </li>
          <li>
            <span className="text-fg">3. Air units</span> ignore pulse and frost. Lance, tesla, and rail cover the sky.
          </li>
          <li>
            <span className="text-fg">4. Linked batteries</span> of the same type within range deal more damage. Rank 3 unlocks a unique overdrive.
          </li>
          <li>
            <span className="text-fg">5. Surge (Q)</span> slams every host on the grid. <span className="text-fg">Overclock (E)</span> haste-fires the line.
          </li>
          <li>
            <span className="text-fg">6. Keys</span> 1–5 batteries · Space wave · F speed · A auto · U upgrade · Esc pause.
          </li>
        </ol>
        <button
          type="button"
          className="mt-6 h-11 w-full rounded-lg bg-fg text-sm text-bg transition-transform duration-[var(--motion-quick)] active:scale-[0.96]"
          onClick={() => useGameStore.getState().closeOverlay()}
        >
          Understood
        </button>
      </div>
    </div>
  );
}

function Settings() {
  const s = useGameStore((s) => s.settings);
  const patch = useGameStore((st) => st.patchSettings);
  return (
    <div className="flex min-h-full items-center justify-center bg-bg/80 px-5 py-10">
      <div className="overlay-in w-full max-w-md rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl tracking-[-0.03em]">Settings</h2>
        <div className="mt-5 space-y-4">
          <Slider label="Master" value={s.master} onChange={(v) => patch({ master: v })} />
          <Slider label="Effects" value={s.sfx} onChange={(v) => patch({ sfx: v })} />
          <Slider label="Drone" value={s.music} onChange={(v) => patch({ music: v })} />
          <Row
            label="Camera shake"
            on={s.shake}
            onClick={() => patch({ shake: !s.shake })}
          />
          <Row
            label="High fidelity"
            on={s.quality === "high"}
            onClick={() => patch({ quality: s.quality === "high" ? "low" : "high" })}
          />
        </div>
        <button
          type="button"
          className="mt-6 h-11 w-full rounded-lg bg-fg text-sm text-bg transition-transform duration-[var(--motion-quick)] active:scale-[0.96]"
          onClick={() => useGameStore.getState().closeOverlay()}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular-nums text-subtle">{Math.round(value * 100)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

function Row({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn("rounded-md px-2 py-1 text-2xs uppercase tracking-label", on ? "bg-accent text-accent-fg" : "border border-border text-subtle")}>
        {on ? "On" : "Off"}
      </span>
    </button>
  );
}
