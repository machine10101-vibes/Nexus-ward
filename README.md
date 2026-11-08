# Nexus Ward

A 3D space tower defense game. Hold a base on Mycelion, Kron Forge, and Aegis Rift against organic, mechanical, and hybrid incursions.

**Play:** https://machine10101-vibes.github.io/Nexus-ward/

## How to hold

1. Choose a planet, then a stratum. Strata I and II are open. Holding a stratum opens the next one on that planet, and each one is a harder stretch of the same ground. Then pick a warden and a Biological, Mechanical, or Hybrid base. The keep sits in the center of a larger field. Each drop-in rolls four lanes in from the rim, all of them ending at that keep. A new gate opens every five incursions on strata I and II, every four on III, and every three on IV. During build, a charter offers three lasting picks at the opening and again before each new gate. Take one, or deploy and let it lapse. During build, spend credits to rank Plate, Snare, Spire, and Mantle up to 3. Plate stacks integrity. Snare slows the last stretch and bites at rank 3. Spire fires harder as it ranks. Mantle catches part of the first breach each wave. Biological snares harder and the spire thorns. Mechanical spire hits harder and splashes at rank 3. Hybrid plate starts ahead and the spire paints.
2. Press **Deploy** when the line is ready. Starting the next wave inside the 16 second window pays an early-deploy bonus, and the planted line fires faster for 3 seconds.
3. Air units ignore Pulse, Frost, Bore, Lash, Pylon, and Mark. Lance, Tesla, Rail, and Flak cover the sky. Flak slows a flock and ignores the ground. Bore cracks ground armor and ignores the air. Lash snags one ground sprinter. A pylon slows every ground host in its field. A mark paints one ground host so the rest of the line hits it 10% harder for 2.4 seconds. Rank 3 holds that paint longer. The HUD reads Painted while a host wears it. It ignores the sky. Lance, Tesla, and Rail can prefer the sky or the ground, and they still fire the other lane when that one is empty. A battery committed to one lane hits 12% harder while the other lane is also inside its reach. A neighbor inside link range that is committed to the other lane adds another 6%. Setting Air or Ground on a mixed battery is that commitment. First, Last, Near, Max, and Min do not take it. A ring and a column tighten under a host just before it calls, blinks, veils, rallies, jams, grafts, saps, or anchors. The base flashes Base contact when a host is four steps from the keep.
4. Same-type batteries placed close together **link**. One neighbor is +15% damage and +6% cycle, a second is +27% and +10%, and three or more cap at +36% and +14%. A different battery in that same reach adds range instead: +6%, +10%, or +14%. The board draws the damage lattice in the battery color and a paler line for that range pair. The keep throws a class-colored beacon that brightens while the mantle is armed. Flying hosts drop a tether to the lane. Rank 3 unlocks an overdrive.
5. **Surge (Q)** marks every hostile. **Overclock (E)** haste-fires the grid.
6. Clear the last incursion, then **Keep holding**. The same grid stays planted and that world's breach opens. It does not end. Best depth saves in the browser.

| Key | Action |
| --- | --- |
| 1–9, 0 | Batteries (6 Flak, 7 Bore, 8 Lash, 9 Pylon, 0 Mark) |
| Space | Start wave. An open charter lapses if you deploy without taking one |
| Q / E | Surge / Overclock |
| F | Speed |
| A | Auto-incursion |
| U | Upgrade |
| X | Salvage |
| Esc | Pause |

## Worlds

- **Mycelion** — living planet. Fungal crowns fill the field, damp pools sit in the open ground, and the hills carry shelf outcrops. Spore motes drift over the lanes. Ground packs first; bring a lance before spores take the air. Flak holds the flock. Blooms still prefer the lance.
- **Kron Forge** — mechanical foundry. Plate yards, slag heaps, and cooler banks sit off the lanes. The hills are terraced, with stacks and grate insets, and embers rise off the floor. Thick armor. Rails and Tesla cut steel. Bore cracks walkers. Flak opens razors and skiffs; gunships still prefer Tesla.
- **Aegis Rift** — hybrid scar. Welds join torn steel to living tissue, and the rift runs as a broken trench. The hills and the floor split the same way: flesh on one side, steel on the other. Mix slow control with air cover. Flak holds wraiths. Specters still prefer the lance.

Each world is twenty scripted incursions. A few early waves hold the other lane back until the first pack is committed: husks after spores on Mycelion, siege after gunships on Kron Forge, wraiths after the ground pack on Aegis Rift, and the reverse a wave later. Incursion 8 on each world then holds its heavy armor until that opening pack has finished spawning. Incursion 9 holds the sky until that ground pack has finished spawning: spores on Mycelion, gunships on Kron Forge, wraiths on Aegis Rift. Incursion 12 does it again with three gates open, and this time the sky was the opening pack: blooms and spores, razors, specters and wraiths. The wave chips mark that sky held, and the HUD reads Sky held until the pack starts. Shade, Marrow, Howler, Skiff, Gnaw, and Herald each return once more in the second half. The breach after a clear rotates that world's hosts and sends the faction boss every fourth wave. A clean hold still arms the next wave.

## Stack

React, TanStack Start, Three.js (`@react-three/fiber`), Tailwind v4.

```bash
npm install
npm run dev
```
