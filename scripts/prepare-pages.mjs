#!/usr/bin/env node
/**
 * Finish a GitHub Pages folder after `vite build` in SPA mode:
 * rewrite Start's `/./assets` script URLs to relative `./assets`, then
 * copy the shell to 404.html so unknown paths still load the game.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "dist", "client");
const index = join(root, "index.html");
if (!existsSync(index)) {
  console.error("[pages] dist/client/index.html is missing");
  process.exit(1);
}
const html = readFileSync(index, "utf8").replaceAll("/./", "./").replaceAll("\0", "");
writeFileSync(index, html);
copyFileSync(index, join(root, "404.html"));
console.log("[pages] rewrote asset URLs and wrote dist/client/404.html");
