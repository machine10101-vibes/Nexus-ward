import { useLayoutEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { MapId } from "@/game/types";
import { asset } from "@/lib/asset";

export type WorldArt = {
  ground: Texture;
  sky: Texture;
};

export type WorldLibrary = Record<MapId, WorldArt>;

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

/** Load every world map once. Do not clone on hover — that remounts the menu. */
export function useWorldLibrary(): WorldLibrary {
  const [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky] = useTexture([
    asset("/textures/mycelion-ground.jpg"),
    asset("/textures/forge-ground.jpg"),
    asset("/textures/aegis-ground.jpg"),
    asset("/textures/mycelion-sky.jpg"),
    asset("/textures/forge-sky.jpg"),
    asset("/textures/aegis-sky.jpg"),
  ]) as Texture[];

  useLayoutEffect(() => {
    prepGround(mycelionGround);
    prepGround(forgeGround);
    prepGround(aegisGround);
    prepSky(mycelionSky);
    prepSky(forgeSky);
    prepSky(aegisSky);
  }, [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky]);

  return useMemo(
    () => ({
      mycelion: { ground: mycelionGround, sky: mycelionSky },
      forge: { ground: forgeGround, sky: forgeSky },
      aegis: { ground: aegisGround, sky: aegisSky },
    }),
    [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky],
  );
}

export function useWorldArt(id: MapId): WorldArt {
  return useWorldLibrary()[id];
}
