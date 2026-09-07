/** Prefix a public-file path with Vite's base so GitHub Pages (`/Nexus-ward/`) and local `/` both resolve. */
export function asset(path: string) {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}${path.replace(/^\//, "")}`;
}
