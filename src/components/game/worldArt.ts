import { useLayoutEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { MapId } from "@/game/types";
import { asset } from "@/lib/asset";

export type WorldArt = {
  ground: Texture;
  sky: Texture;
  planet: Texture;
};

export type WorldLibrary = Record<MapId, WorldArt>;

export const WORLD_TEXTURE_URLS = [
  asset("/textures/mycelion-ground.jpg"),
  asset("/textures/forge-ground.jpg"),
  asset("/textures/aegis-ground.jpg"),
  asset("/textures/mycelion-sky.jpg"),
  asset("/textures/forge-sky.jpg"),
  asset("/textures/aegis-sky.jpg"),
  asset("/textures/mycelion-planet.jpg"),
  asset("/textures/forge-planet.jpg"),
  asset("/textures/aegis-planet.jpg"),
] as const;

if (typeof document !== "undefined") {
  useTexture.preload(WORLD_TEXTURE_URLS as unknown as string[]);
}

function prepGround(tex: Texture) {
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
}

function prepSky(tex: Texture) {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
}

/** Load every world map once. Hover must not clone or re-suspend these. */
export function useWorldLibrary(): WorldLibrary {
  const loaded = useTexture(WORLD_TEXTURE_URLS as unknown as string[]) as Texture[];
  const [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky, mycelionPlanet, forgePlanet, aegisPlanet] =
    loaded;

  useLayoutEffect(() => {
    prepGround(mycelionGround);
    prepGround(forgeGround);
    prepGround(aegisGround);
    prepGround(mycelionPlanet);
    prepGround(forgePlanet);
    prepGround(aegisPlanet);
    prepSky(mycelionSky);
    prepSky(forgeSky);
    prepSky(aegisSky);
  }, [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky, mycelionPlanet, forgePlanet, aegisPlanet]);

  return useMemo(
    () => ({
      mycelion: { ground: mycelionGround, sky: mycelionSky, planet: mycelionPlanet },
      forge: { ground: forgeGround, sky: forgeSky, planet: forgePlanet },
      aegis: { ground: aegisGround, sky: aegisSky, planet: aegisPlanet },
    }),
    [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky, mycelionPlanet, forgePlanet, aegisPlanet],
  );
}

export function useWorldArt(id: MapId): WorldArt {
  return useWorldLibrary()[id];
}
