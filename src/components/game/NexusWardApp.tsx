import { lazy, Suspense, useEffect, useState } from "react";
import { useGameStore, applyQualityHint } from "@/game/store";
import { engine } from "@/game/engine";
import { audio } from "@/game/audio";
import { TOWER_ORDER } from "@/game/config";
import { Hud } from "./Hud";
import { Overlays } from "./Overlays";

const GameGL = lazy(() => import("./GameGL").then((m) => ({ default: m.GameGL })));

export function NexusWardApp() {
  const [glReady, setGlReady] = useState(false);

  useEffect(() => {
    applyQualityHint();
    audio.setVolumes(useGameStore.getState().settings);
    setGlReady(true);
    const w = window as unknown as {
      __engine?: typeof engine;
      __syncHud?: () => void;
      __store?: typeof useGameStore;
    };
    w.__engine = engine;
    w.__store = useGameStore;
    w.__syncHud = () => useGameStore.getState().syncHud();
    const onKey = (e: KeyboardEvent) => {
      const s = useGameStore.getState();
      if (e.code === "Escape") {
        if (s.screen === "playing") s.pause();
        else if (s.screen === "paused") s.resume();
        else if (s.screen === "help" || s.screen === "settings") s.closeOverlay();
        return;
      }
      if (s.screen !== "playing") return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.startWave();
        s.syncHud();
      }
      if (e.code === "KeyQ") {
        engine.castSurge();
        s.syncHud();
      }
      if (e.code === "KeyE") {
        engine.castOverclock();
        s.syncHud();
      }
      if (e.code === "KeyF") {
        engine.cycleSpeed();
        s.syncHud();
      }
      if (e.code === "KeyA" && !e.metaKey && !e.ctrlKey) {
        engine.toggleAutoWave();
        s.syncHud();
      }
      const num = e.code.match(/^Digit([1-5])$/);
      if (num) {
        const id = TOWER_ORDER[Number(num[1]) - 1];
        engine.buildType = id;
        engine.selectedTower = null;
        useGameStore.setState({ buildType: id });
        s.syncHud();
      }
      if (e.code === "KeyU") {
        engine.upgradeSelected();
        s.syncHud();
      }
      if (e.code === "KeyX") {
        engine.sellSelected();
        s.syncHud();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {glReady ? (
        <Suspense fallback={null}>
          <GameGL />
        </Suspense>
      ) : null}
      <Hud />
      <Overlays />
    </main>
  );
}
