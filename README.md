# Nexus Ward

A 3D space tower defense game. Hold planetary cores on Mycelion, Kron Forge, and Aegis Rift against organic, mechanical, and hybrid incursions.

**Play:** https://machine10101-vibes.github.io/Nexus-ward/

## How to hold

1. Choose a battery, then tap a hex platform beside the path.
2. Press **Deploy** when the line is ready. Starting the next wave quickly pays an early-deploy bonus.
3. Air units ignore Pulse, Frost, Bore, and Lash. Lance, Tesla, Rail, and Flak cover the sky. Flak slows a flock and ignores the ground. Bore cracks ground armor and ignores the air. Lash snags a ground sprinter and ignores the sky. Lance, Tesla, and Rail can prefer the sky or the ground, and they still fire the other lane when that one is empty. A ring tightens under a host just before it calls, blinks, veils, rallies, jams, grafts, saps, or anchors.
4. Same-type batteries placed close together **link**. One neighbor is +15% damage, a second is +27%, and three or more cap at +36%. Rank 3 unlocks an overdrive.
5. **Surge (Q)** marks every hostile. **Overclock (E)** haste-fires the grid.
6. Clear the last incursion, then **Keep holding**. The same grid stays planted and that world's breach opens. It does not end. Best depth saves in the browser.

| Key | Action |
| --- | --- |
| 1–8 | Batteries (6 Flak, 7 Bore, 8 Lash) |
| Space | Start wave |
| Q / E | Surge / Overclock |
| F | Speed |
| A | Auto-incursion |
| U | Upgrade |
| X | Salvage |
| Esc | Pause |

## Worlds

- **Mycelion** — living planet. Ground packs first; bring a lance before spores take the air. Flak holds the flock. Blooms still prefer the lance.
- **Kron Forge** — mechanical foundry. Thick armor. Rails and Tesla cut steel. Bore cracks walkers. Flak opens razors and skiffs; gunships still prefer Tesla.
- **Aegis Rift** — hybrid scar. Mix slow control with air cover. Flak holds wraiths. Specters still prefer the lance.

Each world is twenty scripted incursions. Shade, Marrow, Howler, Skiff, Gnaw, and Herald each return once more in the second half. The breach after a clear rotates that world's hosts and sends the faction boss every fourth wave. A clean hold still arms the next wave.

## Stack

React, TanStack Start, Three.js (`@react-three/fiber`), Tailwind v4.

```bash
npm install
npm run dev
```
