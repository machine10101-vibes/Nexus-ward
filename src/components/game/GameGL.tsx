import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace } from "three";
import { useGameStore } from "@/game/store";
import { engine } from "@/game/engine";
import { MenuScene } from "./MenuScene";
import { BattleScene } from "./BattleScene";
import { StudioScene } from "./StudioScene";

export function GameGL() {
  const screen = useGameStore((s) => s.screen);
  const quality = useGameStore((s) => s.settings.quality);
  const phase = useGameStore((s) => s.hud.phase);
  const overclock = useGameStore((s) => s.hud.overclockOn);
  const inStudio = screen === "studio";
  const inBattle =
    phase !== "idle" &&
    screen !== "title" &&
    screen !== "select" &&
    screen !== "briefing" &&
    screen !== "studio";
  const mode = inStudio ? "studio" : inBattle ? "battle" : "menu";

  return (
    <Canvas
      key={`${mode}-${quality}`}
      className="h-full w-full touch-none"
      shadows={quality === "high"}
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      camera={
        inStudio
          ? { position: [3.1, 2.15, 4.05], fov: 42, near: 0.08, far: 80 }
          : inBattle
            ? { position: [0, 15.5, 17.5], fov: 40, near: 0.1, far: 140 }
            : { position: [0, 0.35, 8.2], fov: 40, near: 0.1, far: 90 }
      }
      gl={{
        antialias: quality === "high",
        toneMapping: ACESFilmicToneMapping,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.shadowMap.type = PCFShadowMap;
      }}
      onPointerMissed={() => {
        if (useGameStore.getState().screen !== "playing") return;
        engine.selectedTower = null;
        useGameStore.getState().syncHud();
      }}
    >
      {inStudio ? <StudioScene /> : inBattle ? <BattleScene /> : <MenuScene />}
      {quality === "high" ? (
        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={inStudio ? 0.48 : inBattle ? (overclock ? 0.78 : 0.58) : 0.82}
            luminanceThreshold={0.62}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.16} darkness={0.68} />
        </EffectComposer>
      ) : null}
      {inBattle ? <AdaptiveDpr /> : null}
      <AdaptiveEvents />
    </Canvas>
  );
}
