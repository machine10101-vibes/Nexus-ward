import { useMemo } from "react";
import { BoxGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const cache = new Map<string, BoxGeometry>();

/** One shared rounded box per size, so every edge catches light without extra memory per mesh. */
export function bevelBox(w: number, h: number, d: number): BoxGeometry {
  const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  let g = cache.get(key);
  if (!g) {
    const min = Math.min(Math.abs(w), Math.abs(h), Math.abs(d));
    const r = Math.min(0.045, min * 0.3);
    g = min < 0.012 ? new BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r);
    cache.set(key, g);
  }
  return g;
}

export function BevelBox({ args }: { args: [number, number, number] }) {
  const [w, h, d] = args;
  const geo = useMemo(() => bevelBox(w, h, d), [w, h, d]);
  return <primitive object={geo} attach="geometry" dispose={null} />;
}
