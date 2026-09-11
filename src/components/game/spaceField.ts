/** Shared star / nebula helpers for menu and battle sky shells. GLSL1. */

export const SPACE_VERT = /* glsl */ `
varying vec3 vP;
varying vec2 vUv;
void main() {
  vP = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const STAR_GLSL = /* glsl */ `
float shash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
float snoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(shash(i), shash(i + vec3(1,0,0)), f.x),
        mix(shash(i + vec3(0,1,0)), shash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(shash(i + vec3(0,0,1)), shash(i + vec3(1,0,1)), f.x),
        mix(shash(i + vec3(0,1,1)), shash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float sfbm(vec3 p) {
  return snoise(p) * 0.52 + snoise(p * 2.13) * 0.27 + snoise(p * 4.27) * 0.14 + snoise(p * 8.1) * 0.07;
}
vec3 starLayer(vec3 dir, float scale, float thresh, float size) {
  vec3 p = dir * scale;
  vec3 cell = floor(p);
  vec3 f = fract(p) - 0.5;
  float h = shash(cell);
  float keep = step(thresh, h);
  float d = length(f + (vec3(shash(cell + 3.1), shash(cell + 7.7), shash(cell + 11.4)) - 0.5) * 0.35);
  float m = smoothstep(size, 0.0, d);
  float temp = shash(cell + 19.2);
  vec3 tint = mix(vec3(0.62, 0.76, 1.0), vec3(1.0, 0.86, 0.7), temp);
  tint = mix(tint, vec3(1.0, 0.96, 0.92), smoothstep(0.85, 1.0, h));
  float mag = pow(max(h - thresh, 0.0) / max(1.0 - thresh, 1e-4), 2.2);
  float core = pow(m, 3.4);
  return tint * (m * 0.85 + core * 2.6) * (0.45 + mag * 4.2) * keep;
}
vec3 starField(vec3 dir, float time) {
  vec3 s = starLayer(dir, 28.0, 0.958, 0.32)
         + starLayer(dir, 52.0, 0.974, 0.2)
         + starLayer(dir, 96.0, 0.986, 0.12)
         + starLayer(dir, 170.0, 0.993, 0.07)
         + starLayer(dir, 260.0, 0.9965, 0.045);
  float tw = 0.82 + 0.18 * sin(time * 1.7 + shash(floor(dir * 80.0)) * 40.0);
  return s * tw;
}
vec3 milkyLane(vec3 dir, vec3 dustCol) {
  float lane = exp(-pow(dir.y * 2.15 + 0.16 * sin(dir.x * 3.4 + dir.z * 2.1), 2.0) * 3.8);
  float mott = sfbm(dir * 3.6 + 2.0);
  float wisps = pow(max(mott, 0.0), 1.6);
  return dustCol * lane * (0.12 + wisps * 0.55);
}
`;
