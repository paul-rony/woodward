// The lay of the land, shared by the server (where you are, what is near) and the page (what to draw). Ground
// coordinates are [x, z]: x east, z south. The lodge's clearing is at the origin; the north-west is "far" in the view.
import { ENTRY, ZONES } from "./bestiary.mjs";

/** Placed in screen terms: L runs left to right across the picture, D from far to near. */
export const ld = (L, D) => [(D + L) / 2, (D - L) / 2];

export const POS3 = {
  tower: ld(-8, -5), house: ld(-3.6, -5.6), oak: ld(7, -6), hazel1: ld(2, -1.5), hazel2: ld(5.5, 2), bramble: ld(9.5, 4),
  ring: ld(0.5, 6), moonwort: ld(8.5, 9), skep: ld(-3.5, 1.5), cot: ld(-10.5, 4), kennel: ld(-7, 3.5), brazier: ld(-1.5, -1),
  cross: ld(3.5, 9.5),
};

/** The lodge door, where you stand when at home. */
export const HOME = ld(-2.6, -2.6);
/** Within this distance of the origin you are home, in the clearing. */
export const CLEARING_RADIUS = 11;
/** How far the land goes. */
export const WORLD_RADIUS = 56;

export const WAYPOINTS = [
  { id: "ford", name: "Stone at the Ford", at: [-12, -15] },
  { id: "village", name: "Village Cross", at: [-23, -30] },
  { id: "fields", name: "Field Shrine", at: [24, -11] },
  { id: "hill", name: "Hilltop Stone", at: [-6, -42] },
  { id: "hermit", name: "Hermit's Oak", at: [-34, 8] },
];

/** The tower view's zones, laid out on the land around the clearing. */
const WORLD = {
  sky: { x: [-34, 14], z: [-34, -12], y: 16 },
  hills: { x: [-40, 20], z: [-50, -44] },
  village: { x: [-36, -24], z: [-34, -26] },
  road: { x: [-22, -12], z: [-20, -12] },
  river: { x: [-44, 28], z: [-17.2, -16.4] },
  field: { x: [12, 30], z: [-32, -16] },
  wood: { arc: [-172, -8], r: 12.6 },
};

/** Where a sighting stands on the land: [x, y, z]. */
export function zonePoint(s) {
  const e = ENTRY[s.entry];
  const [x0, x1, y0, y1] = ZONES[e.where];
  const u = (s.x - x0) / Math.max(1, x1 - x0), v = (s.y - y0) / Math.max(1, y1 - y0);
  const w = WORLD[e.where];
  if (w.arc) {
    const t = ((w.arc[0] + (w.arc[1] - w.arc[0]) * u) * Math.PI) / 180;
    return [Math.cos(t) * (w.r + v * 1.5), 0, Math.sin(t) * (w.r + v * 1.5)];
  }
  return [w.x[0] + (w.x[1] - w.x[0]) * u, w.y ?? 0, w.z[0] + (w.z[1] - w.z[0]) * v];
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const isHome = (p) => Math.hypot(p[0], p[1]) <= CLEARING_RADIUS;

// ---- Gear ------------------------------------------------------------------------------------------------------

export const SLOTS = ["head", "neck", "torso", "legs", "feet", "handL", "handR"];
export const SLOT_NAMES = { head: "Head", neck: "Neck", torso: "Body", legs: "Legs", feet: "Feet", handL: "Left hand", handR: "Right hand" };

/** fits: the slots it can go in. light: lets you out after dark, and how much it cuts the danger. */
export const ITEMS = {
  hood: { name: "Woodward's Hood", fits: ["head"], desc: "Green wool, the mark of your office." },
  tunic: { name: "Tunic", fits: ["torso"], desc: "Undyed wool, patched at the elbows." },
  hose: { name: "Hose", fits: ["legs"], desc: "Woollen hose, gartered below the knee." },
  boots: { name: "Turnshoes", fits: ["feet"], desc: "Soft leather. You walk a little faster in them.", speed: 1.1 },
  hatchet: { name: "Hatchet", fits: ["handL", "handR"], desc: "For hazel and oak. No wood is cut without it in hand." },
  torch: { name: "Rush Torch", fits: ["handL", "handR"], desc: "Pitch on a rush stalk. A light to go out by after dark.", light: 0.6 },
  lantern: { name: "Horn Lantern", fits: ["handL", "handR"], desc: "A beeswax candle behind panes of horn. A steadier light than a torch.", light: 0.45 },
  horn: { name: "Hunting Horn", fits: ["neck"], desc: "Wind it and Bran comes to walk at your side, if he has a kennel.", hound: true },
  staff: { name: "Walking Staff", fits: ["handL", "handR"], desc: "Ash, shod with iron. You cover ground faster with it.", speed: 1.2 },
  cloak: { name: "Green Cloak", fits: ["torso"], desc: "Thick and hooded. Thorns and teeth get less of you.", guard: 0.85 },
};

export const STARTING_GEAR = {
  items: ["hood", "tunic", "hose", "boots", "hatchet", "torch"],
  equip: { head: "hood", torso: "tunic", legs: "hose", feet: "boots", handR: "hatchet" },
};
