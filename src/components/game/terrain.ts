import { CELL } from "@/game/config";
import type { MapId } from "@/game/types";
import { scarSigned } from "./PlanetCrust";

const RIM = 3.2;

export function arenaMetrics(cols: number, rows: number) {
  const arenaR = (cols * CELL) / 2 + RIM;
  const squash = ((rows * CELL) / 2 + RIM) / arenaR;
  return { arenaR, squash };
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Height outside the play ellipse. Pads and path stay on y=0. */
export function terrainElevation(x: number, z: number, arenaR: number, squash: number, style: MapId) {
  const inset = Math.hypot(x / arenaR, z / (arenaR * squash));
  const edge = smooth(clamp((inset - 1) / 0.62, 0, 1));
  if (edge <= 0) return 0;
  let n =
    Math.sin(x * 0.1) * Math.cos(z * 0.08) * 0.95 +
    Math.sin(x * 0.21 + z * 0.16) * 0.48 +
    Math.sin(x * 0.44 - z * 0.29) * 0.22 +
    Math.sin(x * 0.06 + z * 0.045) * 1.2 +
    Math.sin(x * 0.73) * Math.cos(z * 0.61) * 0.14;
  if (style === "forge") {
    n = Math.round(n * 1.7) / 1.7 + Math.sin(x * 0.31) * Math.sin(z * 0.27) * 0.16;
    n += Math.max(0, Math.sin(x * 0.09 + z * 0.07) - 0.35) * 0.7;
  } else if (style === "aegis") {
    const rift = Math.abs(scarSigned(x, z));
    const lip = Math.max(0, 1.15 - rift);
    const trench = Math.max(0, 0.42 - rift);
    n = Math.abs(n) * 0.7 + lip * 2.15 - trench * 2.4;
  } else {
    const canyon = Math.abs(Math.sin(x * 0.09 + z * 0.045));
    const cut = smooth(clamp((0.2 - canyon) / 0.2, 0, 1));
    n += Math.sin(x * 0.22) * Math.cos(z * 0.18) * 0.55 - cut * 1.85;
  }
  const far = smooth(clamp((inset - 1.35) / 0.7, 0, 1));
  const amp = style === "forge" ? 2.35 : style === "aegis" ? 3.05 : 2.65;
  return n * edge * amp + edge * 0.7 + far * 1.35;
}
