/** A pick that lasts the drop. Offered at the opening build and whenever a new gate is about to open. */

export type CharterId = "reserve" | "battery" | "sight" | "cycle" | "bounty" | "integrity" | "sky" | "ground";

export type CharterDef = {
  id: CharterId;
  name: string;
  blurb: string;
};

export const CHARTERS: Record<CharterId, CharterDef> = {
  reserve: { id: "reserve", name: "Reserve", blurb: "+60 credits now" },
  battery: { id: "battery", name: "Battery", blurb: "The ward hits 8% harder" },
  sight: { id: "sight", name: "Sight", blurb: "Batteries reach 8% farther" },
  cycle: { id: "cycle", name: "Cycle", blurb: "Batteries fire 8% faster" },
  bounty: { id: "bounty", name: "Bounty", blurb: "Kills pay 18% more" },
  integrity: { id: "integrity", name: "Integrity", blurb: "+3 base integrity now" },
  sky: { id: "sky", name: "Sky watch", blurb: "Hits on flyers deal 12% more" },
  ground: { id: "ground", name: "Ground crew", blurb: "Hits on ground hosts deal 12% more" },
};

export const CHARTER_ORDER: CharterId[] = [
  "reserve",
  "battery",
  "sight",
  "cycle",
  "bounty",
  "integrity",
  "sky",
  "ground",
];

export const RESERVE_GOLD = 60;
export const INTEGRITY_LIVES = 3;
