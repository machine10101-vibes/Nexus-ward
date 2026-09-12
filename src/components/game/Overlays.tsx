import { useEffect, useState } from "react";
import { ArrowLeft, Check, Crosshair, Settings2, Sparkles, Sword } from "lucide-react";
import { MAPS, MAP_ORDER } from "@/game/maps";
import { ENEMIES, inflateSpawnCount, PLANET_THEME } from "@/game/config";
import { HEROES, HERO_ORDER, ITEMS, heroStats, itemsForHero } from "@/game/heroes";
import { useGameStore } from "@/game/store";
import { engine } from "@/game/engine";
import { audio } from "@/game/audio";
import { DEFAULT_KEYS, RESERVED_CODES, formatKey, loadSave, type ArtBind } from "@/game/save";
import type { HeroId, ItemSlot, MapId } from "@/game/types";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { STUDIO_CATALOG, studioEntry } from "./studioCatalog";

export function Overlays() {
  const screen = useGameStore((s) => s.screen);
  if (screen === "playing") return null;
  if (screen === "studio") return <StudioOverlay />;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto">
      {screen === "title" && <Title />}
      {screen === "select" && <Select />}
      {screen === "hero" && <HeroSelect />}
      {screen === "briefing" && <Briefing />}
      {screen === "loadout" && <Loadout />}
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
            className="h-12 rounded-xl border border-border px-6 font-display text-sm text-fg transition-colors duration-[var(--motion-quick)] hover:border-border-strong"
            onClick={() => {
              audio.unlock();
              useGameStore.getState().openStudio();
            }}
          >
            Model studio
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
              onClick={() => useGameStore.getState().startHeroSelect(id)}
              className={cn(
                "group overflow-hidden rounded-xl border p-2 text-left transition-colors duration-[var(--motion-fast)]",
                on ? "border-accent bg-surface" : "border-border bg-surface/70 hover:border-border-strong",
              )}
            >
              <PlanetSwatch id={id} active={on} />
              <div className="px-2 pb-1 pt-3">
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
                  <p className="mt-1 font-mono text-2xs tabular-nums text-subtle">
                    Best wave {best[id]!.wave} · cores {best[id]!.cores}
                  </p>
                ) : (
                  <p className="mt-1 font-mono text-2xs text-subtle">Uncharted</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/**
 * Same crust the 3D globe uses. The cinematic planet stills are pre-lit portraits;
 * cropping those next to the live globe made every card look half old, half new.
 */
function PlanetSwatch({ id, active }: { id: MapId; active: boolean }) {
  const src = `url(${asset(`/textures/${id}-ground.jpg`)})`;
  const rim = PLANET_THEME[id].padEmi;
  return (
    <div className="relative h-28 overflow-hidden rounded-lg bg-bg">
      <div
        className="absolute inset-0 opacity-35"
        style={{ backgroundImage: src, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(20px)" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_28%,var(--color-bg)_78%)]" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[6.15rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
        style={{ background: `radial-gradient(circle, ${rim}55, transparent 68%)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 size-[5.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-[var(--motion-slow)] ease-[var(--ease-smooth-out)] group-hover:scale-105"
        style={{
          backgroundImage: src,
          backgroundRepeat: "no-repeat",
          backgroundSize: "190%",
          backgroundPosition: "42% 36%",
          filter: "brightness(1.12) contrast(1.08) saturate(1.1)",
          boxShadow: `inset -16px -10px 22px rgba(0,0,0,0.55), inset 8px 6px 14px rgba(255,255,255,0.1), 0 0 0 1px ${rim}33, 0 0 22px -4px ${rim}`,
        }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.2), transparent 38%), radial-gradient(circle at 72% 70%, rgba(0,0,0,0.42), transparent 48%)",
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 50%, transparent 58%, rgba(0,0,0,0.45) 100%)",
          }}
        />
        <span
          className={cn(
            "absolute inset-0 rounded-full outline outline-1 -outline-offset-1",
            active ? "outline-accent/45" : "outline-fg/15",
          )}
        />
      </div>
    </div>
  );
}

const HERO_ICON = {
  fighter: Sword,
  ranger: Crosshair,
  mage: Sparkles,
} as const;

function HeroSelect() {
  const preview = useGameStore((s) => s.previewHero);
  const heroSave = useGameStore((s) => s.heroSave);
  const owned = heroSave.owned;
  return (
    <Shell className="max-w-3xl">
      <button
        type="button"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
        onClick={() => useGameStore.getState().setScreen("select")}
      >
        <ArrowLeft className="size-4" />
        Worlds
      </button>
      <p className="font-display text-2xs uppercase tracking-label text-accent">Select a warden</p>
      <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">Three who hold</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {HERO_ORDER.map((id) => {
          const h = HEROES[id];
          const on = preview === id;
          const Icon = HERO_ICON[id];
          const gear = heroSave.loadouts[id];
          const stats = heroStats(id, gear);
          return (
            <button
              key={id}
              type="button"
              onMouseEnter={() => useGameStore.getState().setPreviewHero(id)}
              onFocus={() => useGameStore.getState().setPreviewHero(id)}
              onClick={() => useGameStore.getState().confirmHero(id)}
              className={cn(
                "group overflow-hidden rounded-xl border p-2 text-left transition-colors duration-[var(--motion-fast)]",
                on ? "border-accent bg-surface" : "border-border bg-surface/70 hover:border-border-strong",
              )}
            >
              <div className="relative h-28 overflow-hidden rounded-lg bg-bg">
                <div
                  className="absolute inset-0 opacity-50"
                  style={{
                    background: `radial-gradient(circle at 50% 40%, ${h.accent}55, transparent 62%)`,
                  }}
                />
                <Icon className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-fg/80" style={{ color: h.accent }} />
                {on ? <span className="absolute inset-0 outline outline-1 -outline-offset-1 outline-accent/45 rounded-lg" /> : null}
              </div>
              <div className="px-2 pb-1 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg">{h.name}</p>
                  <span className="font-display text-2xs uppercase tracking-label text-muted">{h.title}</span>
                </div>
                <p className="text-xs uppercase tracking-label text-muted">{h.role}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{h.blurb}</p>
                <p className="mt-3 font-mono text-2xs tabular-nums text-subtle">
                  {Math.round(stats.damage)} dmg · {stats.range.toFixed(1)} rng · {h.arts.map((a) => a.name).join(" / ")}
                </p>
                <p className="mt-1 font-mono text-2xs text-subtle">
                  {owned.filter((item) => ITEMS[item].hero === id).length} pieces owned
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function Briefing() {
  const id = useGameStore((s) => s.mapId) ?? "mycelion";
  const heroId = useGameStore((s) => s.heroId) ?? useGameStore((s) => s.heroSave.last);
  const loadout = useGameStore((s) => s.heroSave.loadouts[heroId]);
  const h = HEROES[heroId];
  const m = MAPS[id];
  const first = m.waves[0].groups
    .map((g) => `${ENEMIES[g.enemy].name} ×${inflateSpawnCount(g.enemy, g.count, 0)}`)
    .join(", ");
  return (
    <Shell>
      <button
        type="button"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted transition-colors duration-[var(--motion-quick)] hover:text-fg"
        onClick={() => useGameStore.getState().setScreen("hero")}
      >
        <ArrowLeft className="size-4" />
        Wardens
      </button>
      <p className="font-display text-2xs uppercase tracking-label text-accent">{m.subtitle}</p>
      <h2 className="mt-2 font-display text-4xl tracking-display">{m.name}</h2>
      <p className="mt-4 text-base leading-relaxed text-muted">{m.lore}</p>
      <div className="mt-5 rounded-xl border border-border p-2">
        <div className="rounded-lg bg-surface/60 p-3">
          <p className="font-display text-2xs uppercase tracking-label text-muted">Drop prep</p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg">{m.hint}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs tabular-nums text-subtle">
            <span>{m.lives} core integrity</span>
            <span>{m.startGold} opening credits</span>
            <span>{m.waves.length} incursions</span>
            <span>first contact · {first}</span>
          </div>
          <p className="mt-3 text-sm text-fg">
            Warden · {h.name} ({h.title}) · {ITEMS[loadout.weapon ?? h.starterWeapon]?.name ?? "unarmed"} /{" "}
            {ITEMS[loadout.armor ?? h.starterArmor]?.name ?? "unarmored"}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="h-12 rounded-xl bg-fg px-8 font-display text-sm text-bg transition-transform duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)] active:scale-[0.96]"
          onClick={() => useGameStore.getState().dropIn()}
        >
          Drop in
        </button>
        <button
          type="button"
          className="h-12 rounded-xl border border-border px-6 font-display text-sm text-fg"
          onClick={() => useGameStore.getState().openLoadout()}
        >
          Loadout
        </button>
      </div>
    </Shell>
  );
}

function Loadout() {
  const previewHero = useGameStore((s) => s.previewHero);
  const heroId = useGameStore((s) => s.heroId) ?? previewHero;
  const heroSave = useGameStore((s) => s.heroSave);
  const who = heroSave.loadouts[heroId] ? heroId : previewHero;
  const h = HEROES[who];
  const loadout = heroSave.loadouts[who];
  const stats = heroStats(who, loadout);
  const slots: ItemSlot[] = ["weapon", "armor"];
  return (
    <div className="flex min-h-full items-end justify-center bg-gradient-to-t from-bg from-25% via-bg/60 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
      <div className="overlay-in mx-auto w-full max-w-3xl rounded-xl border border-border bg-surface/95 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xs uppercase tracking-label text-accent">Loadout</p>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.03em]">
              {h.name} · {h.title}
            </h2>
            <ul className="mt-1 space-y-0.5 text-sm text-muted">
              {h.arts.map((art) => (
                <li key={art.name}>
                  <span className="text-fg">{art.name}</span> — {art.hint}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="h-10 rounded-lg border border-border px-4 text-sm text-fg"
            onClick={() => useGameStore.getState().closeOverlay()}
          >
            Close
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["damage", Math.round(stats.damage)],
              ["range", stats.range.toFixed(1)],
              ["rate", stats.fireRate.toFixed(2)],
              ["armor", Math.round(stats.armor)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border px-2 py-2">
              <dd className="font-display text-base tabular-nums leading-none">{v}</dd>
              <dt className="hud-label mt-1.5">{k}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => {
            const equipped = loadout[slot];
            const item = equipped ? ITEMS[equipped] : null;
            return (
              <div key={slot} className="rounded-xl border border-border p-3">
                <p className="font-display text-2xs uppercase tracking-label text-muted">{slot}</p>
                <p className="mt-1 font-display text-lg">{item?.name ?? "Empty"}</p>
                <p className="mt-1 text-sm text-muted">{item?.blurb ?? "Nothing slotted. Stats fall back to the warden's kit."}</p>
                {item ? (
                  <button
                    type="button"
                    className="mt-3 h-9 rounded-lg border border-border px-3 text-xs text-fg"
                    onClick={() => useGameStore.getState().unequipSlot(slot)}
                  >
                    Unequip
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-5 font-display text-2xs uppercase tracking-label text-muted">Inventory</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {itemsForHero(who).map((id) => {
            const item = ITEMS[id];
            const have = heroSave.owned.includes(id);
            const on = loadout[item.slot] === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!have}
                onClick={() => useGameStore.getState().equipItem(id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors duration-[var(--motion-quick)]",
                  on ? "border-accent bg-accent/10" : "border-border bg-surface/60",
                  have ? "hover:border-border-strong" : "opacity-45",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm">{item.name}</p>
                  <span className="font-display text-2xs uppercase tracking-label text-muted">
                    {have ? item.slot : "locked"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.blurb}</p>
                <p className="mt-2 font-mono text-2xs tabular-nums text-subtle">
                  {item.damage ? `+${item.damage} dmg ` : ""}
                  {item.range ? `+${item.range.toFixed(1)} rng ` : ""}
                  {item.armor ? `+${item.armor} arm ` : ""}
                  {item.fireRate ? `${item.fireRate > 0 ? "+" : ""}${item.fireRate.toFixed(2)} rate ` : ""}
                  {item.abilityCd ? `${item.abilityCd}s art` : ""}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-bg/45 via-bg/65 to-bg/45 px-5 py-10 backdrop-blur-[1.5px]">
      <div className="overlay-in w-full max-w-md rounded-xl border border-border bg-surface/95 p-2">
        <div className="rounded-lg p-4">{children}</div>
      </div>
    </div>
  );
}

function Paused() {
  return (
    <div className="flex min-h-full items-center justify-center bg-bg/55 px-5 backdrop-blur-[1.5px]">
      <div className="overlay-in w-full max-w-sm rounded-xl border border-border bg-surface/95 p-6">
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
            onClick={() => useGameStore.getState().openLoadout()}
          >
            Loadout
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
            className="h-11 rounded-lg border border-border text-sm text-fg"
            onClick={() => useGameStore.getState().openStudio()}
          >
            Model studio
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
  const stats: [string, string][] = [
    ["wave", `${engine.wave} / ${m.waves.length}`],
    ["kills", `${engine.kills}`],
    ["leaks", `${engine.leaked}`],
    ["salvage", `${engine.goldEarned}`],
  ];
  return (
    <Modal>
      <p className="font-display text-2xs uppercase tracking-label text-accent">{m.name}</p>
      <h2 className="mt-2 font-display text-3xl tracking-display">{won ? "The core holds" : "Core collapsed"}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {won
          ? "The last incursion broke on the grid. The nexus still sings."
          : "The lattice reached the heart. Salvage what you can and drop in again."}
      </p>
      <dl className="mt-5 grid grid-cols-4 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border px-2 py-2">
            <dd className="font-display text-base tabular-nums leading-none text-fg">{v}</dd>
            <dt className="hud-label mt-1.5">{k}</dt>
          </div>
        ))}
      </dl>
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
          className="h-11 flex-1 rounded-lg border border-border text-sm text-fg transition-colors duration-[var(--motion-quick)] hover:border-border-strong"
          onClick={() => useGameStore.getState().abortToSelect()}
        >
          Other worlds
        </button>
      </div>
    </Modal>
  );
}

const KEYS: [string, string][] = [
  ["1 – 5", "Select battery"],
  ["Space", "Deploy wave"],
  ["Q / E", "Surge / Overclock"],
  ["R / T / Y", "Warden arts (rebind in Settings)"],
  ["U / X", "Upgrade / Salvage"],
  ["F / A", "Speed / Auto"],
  ["Esc", "Cancel build, else pause"],
];

function Help() {
  return (
    <Modal>
      <h2 className="font-display text-2xl tracking-[-0.03em]">How to hold</h2>
      <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
        <li>
          <span className="text-fg">1. Choose a world, then a warden</span> — fighter, ranger, or mage. Open Loadout to
          equip and unequip their weapons and armor. Clear a world to unlock heavier kits.
        </li>
        <li>
          <span className="text-fg">2. Choose a battery</span> from the tray, then tap lit hex platforms beside the path. The
          battery stays armed, so you can lay a whole line without re-picking it.
        </li>
        <li>
          <span className="text-fg">3. Deploy the wave</span> when your line is ready. Deploying early pays a credit bonus
          that shrinks the longer you build.
        </li>
        <li>
          <span className="text-fg">4. Air units</span> ignore pulse and frost. Lance, tesla, and rail cover the sky.
          Each host also has its own plate — some resist a battery, some fold to it, and some regenerate, sprint, split,
          or shrug frost.
        </li>
        <li>
          <span className="text-fg">5. Linked batteries</span> of the same type within range deal 15% more damage. Each
          rank changes that battery's silhouette. Rank 3 unlocks a unique overdrive.
        </li>
        <li>
          <span className="text-fg">6. Surge (Q)</span> slams every host on the grid.{" "}
          <span className="text-fg">Overclock (E)</span> haste-fires the line.{" "}
          <span className="text-fg">Warden arts (R / T / Y)</span> are the hero's three specials. Rebind them in Settings.
        </li>
        <li>
          <span className="text-fg">7. Extra gates</span> open every 10 incursions, each with a new path into the core.
        </li>
      </ol>
      <div className="mt-5 rounded-lg border border-border p-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <dt className="font-mono text-2xs text-fg">{k}</dt>
              <dd className="text-2xs text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <button
        type="button"
        className="mt-6 h-11 w-full rounded-lg bg-fg text-sm text-bg transition-transform duration-[var(--motion-quick)] active:scale-[0.96]"
        onClick={() => useGameStore.getState().closeOverlay()}
      >
        Understood
      </button>
    </Modal>
  );
}

function Settings() {
  const s = useGameStore((s) => s.settings);
  const patch = useGameStore((st) => st.patchSettings);
  const heroId = useGameStore((st) => st.heroId) ?? useGameStore((st) => st.previewHero);
  const arts = HEROES[heroId].arts;
  const [listen, setListen] = useState<ArtBind | null>(null);
  useEffect(() => {
    if (!listen) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListen(null);
        return;
      }
      if (RESERVED_CODES.has(e.code)) return;
      const next = { ...s.keys, [listen]: e.code };
      for (const id of ["art1", "art2", "art3"] as const) {
        if (id !== listen && next[id] === e.code) next[id] = s.keys[listen];
      }
      patch({ keys: next });
      setListen(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listen, patch, s.keys]);
  return (
    <Modal>
      <h2 className="font-display text-2xl tracking-[-0.03em]">Settings</h2>
      <div className="mt-5 space-y-4">
        <Slider label="Master" value={s.master} onChange={(v) => patch({ master: v })} />
        <Slider label="Effects" value={s.sfx} onChange={(v) => patch({ sfx: v })} />
        <Slider label="Drone" value={s.music} onChange={(v) => patch({ music: v })} />
        <Row label="Camera shake" on={s.shake} onClick={() => patch({ shake: !s.shake })} />
        <Row
          label="High fidelity"
          on={s.quality === "high"}
          onClick={() => patch({ quality: s.quality === "high" ? "low" : "high" })}
        />
        <div>
          <p className="font-display text-2xs uppercase tracking-label text-muted">Warden arts</p>
          <p className="mt-1 text-xs text-subtle">Click a bind, then press a key. Esc cancels.</p>
          <div className="mt-2 space-y-1.5">
            {(["art1", "art2", "art3"] as const).map((id, i) => (
              <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm text-fg">{arts[i].name}</p>
                  <p className="font-mono text-2xs text-subtle">{arts[i].hint}</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    "h-9 min-w-12 rounded-md border px-3 font-mono text-sm",
                    listen === id ? "border-accent bg-accent/15 text-accent" : "border-border text-fg",
                  )}
                  onClick={() => setListen(listen === id ? null : id)}
                >
                  {listen === id ? "…" : formatKey(s.keys[id])}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            onClick={() => patch({ keys: { ...DEFAULT_KEYS } })}
          >
            Reset art binds
          </button>
        </div>
      </div>
      <button
        type="button"
        className="mt-5 h-11 w-full rounded-lg border border-border text-sm text-fg"
        onClick={() => useGameStore.getState().openStudio()}
      >
        Open model studio
      </button>
      <button
        type="button"
        className="mt-6 h-11 w-full rounded-lg bg-fg text-sm text-bg transition-transform duration-[var(--motion-quick)] active:scale-[0.96]"
        onClick={() => useGameStore.getState().closeOverlay()}
      >
        Close
      </button>
    </Modal>
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

function StudioOverlay() {
  const id = useGameStore((s) => s.studioId);
  const variant = useGameStore((s) => s.studioVariant);
  const spin = useGameStore((s) => s.studioSpin);
  const entry = studioEntry(id);
  let lastGroup = "";
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-bg from-40% to-transparent px-4 py-3 pl-[13.5rem] sm:pl-[15.5rem]">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xs uppercase tracking-label text-accent">Inspect</p>
          <p className="truncate font-display text-lg leading-tight">{entry.name}</p>
          <p className="mt-0.5 hidden text-xs text-muted sm:block">{entry.blurb}</p>
        </div>
        <p className="hidden text-2xs text-subtle lg:block">
          Drag to orbit · Scroll to zoom · Esc to close · V to toggle
        </p>
        <button
          type="button"
          className="h-9 rounded-lg border border-border px-3 text-sm text-fg"
          onClick={() => useGameStore.getState().closeOverlay()}
        >
          Close
        </button>
      </div>
      <aside className="pointer-events-auto absolute bottom-3 left-3 top-3 w-48 overflow-y-auto rounded-xl border border-border bg-surface/92 p-2 sm:w-56">
        <p className="px-2 pb-2 font-display text-2xs uppercase tracking-label text-muted">Models</p>
        {STUDIO_CATALOG.map((item) => {
          const head = item.group !== lastGroup;
          lastGroup = item.group;
          return (
            <div key={item.id}>
              {head ? (
                <p className="mt-2 px-2 pb-1 font-display text-2xs uppercase tracking-label text-subtle first:mt-0">
                  {item.group}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => useGameStore.getState().setStudioId(item.id)}
                className={cn(
                  "mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-[var(--motion-quick)]",
                  item.id === id ? "bg-accent text-accent-fg" : "text-fg hover:bg-surface-2",
                )}
              >
                {item.name}
              </button>
            </div>
          );
        })}
      </aside>
      <div className="pointer-events-auto absolute bottom-3 left-52 right-3 flex flex-wrap items-center justify-between gap-2 sm:left-60">
        <div className="flex flex-wrap gap-1.5">
          {entry.variants?.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => useGameStore.getState().setStudioVariant(i + 1)}
              className={cn(
                "h-9 rounded-lg border px-3 text-xs",
                variant === i + 1 ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface/80 text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => useGameStore.getState().toggleStudioSpin()}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs",
              spin ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface/80 text-fg",
            )}
          >
            Spin
          </button>
          <button
            type="button"
            onClick={() => useGameStore.getState().fitStudio()}
            className="h-9 rounded-lg border border-border bg-surface/80 px-3 text-xs text-fg"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
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
