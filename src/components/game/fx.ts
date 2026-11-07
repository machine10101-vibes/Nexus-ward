import { CanvasTexture, SRGBColorSpace } from "three";

let soft: CanvasTexture | null = null;

/** White radial falloff. Tint it with the material color. */
export function softGlowTexture() {
  if (soft || typeof document === "undefined") return soft;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  soft = new CanvasTexture(c);
  soft.colorSpace = SRGBColorSpace;
  return soft;
}
