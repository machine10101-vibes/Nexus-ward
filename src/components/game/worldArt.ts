import { useLayoutEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { MapId } from "@/game/types";
import { asset } from "@/lib/asset";

export type WorldArt = {
  ground: Texture;
  sky: Texture;
};

function prepColor(tex: Texture) {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
}

function tiled(src: Texture, rx: number, ry: number) {
  const tex = src.clone();
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function useWorldArt(id: MapId): WorldArt {
  const [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky] = useTexture([
    asset("/textures/mycelion-ground.jpg"),
    asset("/textures/forge-ground.jpg"),
    asset("/textures/aegis-ground.jpg"),
    asset("/textures/mycelion-sky.jpg"),
    asset("/textures/forge-sky.jpg"),
    asset("/textures/aegis-sky.jpg"),
  ]) as Texture[];

  useLayoutEffect(() => {
    [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky].forEach(prepColor);
  }, [mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky]);

  return useMemo(() => {
    const groundSrc = id === "mycelion" ? mycelionGround : id === "forge" ? forgeGround : aegisGround;
    const sky = id === "mycelion" ? mycelionSky : id === "forge" ? forgeSky : aegisSky;
    return {
      ground: tiled(groundSrc, 1, 1),
      sky,
    };
  }, [id, mycelionGround, forgeGround, aegisGround, mycelionSky, forgeSky, aegisSky]);
}
