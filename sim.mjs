// The wood's rules: sky, growth, night danger, the tower's sightings, Wat the apprentice, Bran the hound and builds. Pure functions over a
// plain state object, so the server can persist it as JSON and the tests can drive it with a fake clock and dice.
// Time only moves while the server runs: a gap longer than MAX_STEP_MS (the computer was off) is logged and
// skipped, never caught up. That is the point of the game: a computer that never sleeps keeps the wood alive.

import { ENTRIES, ENTRY, ZONES, shiftMonth, timeBucket } from "./public/bestiary.mjs";
import { HOME, ITEMS, POS3, STARTING_GEAR, WAYPOINTS, WORLD_RADIUS, dist, isHome, zonePoint } from "./public/world.mjs";

export const TICK_MS = 20_000;
export const MAX_STEP_MS = 5 * 60_000;
export const WAT_WALK_MS = 45_000;
export const REST_MS = 2 * 3_600_000;
export const YEAR_OFFSET = 876; // 2026 -> 1150
const JOURNAL_MAX = 200;
const HOUR = 3_600_000;
const RAD = Math.PI / 180;

// ---- Sky -------------------------------------------------------------------------------------------------------

/** Sun elevation and azimuth (degrees, azimuth from north towards east). Low-precision formula, good to ~0.1°. */
export function sunPosition(date, lat, lon) {
  return skyPosition(date, lat, lon, 0, true);
}

/** Rough moon position: the sun's right ascension shifted by the phase, on the celestial equator. Good enough for a sky. */
export function moonPosition(date, lat, lon) {
  return skyPosition(date, lat, lon, moonPhase(date).phase * 360, false);
}

function skyPosition(date, lat, lon, raOffsetDeg, useDeclination) {
  const d = date.getTime() / 86_400_000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) + raOffsetDeg * RAD;
  const dec = useDeclination ? Math.asin(Math.sin(e) * Math.sin(L)) : 0;
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  const ha = (gmst * 15 + lon) * RAD - ra;
  const la = lat * RAD;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const azFromSouth = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la));
  return { elevation: el / RAD, azimuth: (azFromSouth / RAD + 180 + 360) % 360 };
}

const SYNODIC_DAYS = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
const PHASE_NAMES = [
  [0.0339, "New moon"], [0.216, "Waxing crescent"], [0.284, "First quarter"], [0.466, "Waxing gibbous"],
  [0.534, "Full moon"], [0.716, "Waning gibbous"], [0.784, "Last quarter"], [0.966, "Waning crescent"], [1, "New moon"],
];

/** phase: 0 new, 0.5 full. illumination: lit fraction of the disc. */
export function moonPhase(date) {
  const days = (date.getTime() - NEW_MOON_REF) / 86_400_000;
  const phase = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const name = PHASE_NAMES.find(([limit]) => phase < limit)[1];
  return { phase, illumination, name };
}

/** Next time the sun crosses `threshold` degrees going up (rising) or down, within 48h; null near the poles. */
export function nextSunCrossing(fromMs, lat, lon, rising, threshold = -0.833) {
  const step = 5 * 60_000;
  const el = (t) => sunPosition(new Date(t), lat, lon).elevation - threshold;
  let t0 = fromMs;
  let v0 = el(t0);
  for (let t = fromMs + step; t <= fromMs + 48 * HOUR; t += step) {
    const v = el(t);
    if (rising ? v0 < 0 && v >= 0 : v0 >= 0 && v < 0) {
      let a = t0, b = t;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2;
        const vm = el(m);
        if (rising ? vm < 0 : vm >= 0) a = m; else b = m;
      }
      return Math.round(b);
    }
    t0 = t;
    v0 = v;
  }
  return null;
}

const DAY_OFFICES = ["Prime", "Prime", "Terce", "Terce", "Terce", "Sext", "Sext", "Sext", "None", "None", "None", "Vespers"];
const NIGHT_OFFICES = ["Compline", "Compline", "Matins", "Matins", "Matins", "Matins", "Matins", "Matins", "Matins", "Lauds", "Lauds", "Lauds"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];

/** Medieval unequal hours: daylight and darkness are each split into twelve hours, so a summer day-hour is long. */
export function canonicalHour(now, lat, lon) {
  const up = sunPosition(new Date(now), lat, lon).elevation > -0.833;
  const start = nextSunCrossing(now - 24 * HOUR, lat, lon, up);
  const end = nextSunCrossing(now, lat, lon, !up);
  if (start === null || end === null || start > now) return { office: up ? "Sext" : "Matins", hour: null, of: up ? "day" : "night" };
  const index = Math.min(11, Math.max(0, Math.floor(((now - start) / (end - start)) * 12)));
  return { office: (up ? DAY_OFFICES : NIGHT_OFFICES)[index], hour: index + 1, ordinal: ORDINALS[index], of: up ? "day" : "night" };
}

export function skyPhase(elevation, rising) {
  if (elevation > 6) return "Day";
  if (elevation > 0) return rising ? "Morning" : "Evening";
  if (elevation > -12) return rising ? "Dawn" : "Dusk";
  return "Night";
}

export function environment(state, now) {
  const { lat, lon } = state.location;
  const date = new Date(now);
  const sun = sunPosition(date, lat, lon);
  const rising = sunPosition(new Date(now + 60_000), lat, lon).elevation > sun.elevation;
  const moon = { ...moonPhase(date), ...moonPosition(date, lat, lon) };
  const env = {
    sun,
    moon,
    phase: skyPhase(sun.elevation, rising),
    light: clamp((sun.elevation + 12) / 18, 0, 1),
    sunrise: nextSunCrossing(now, lat, lon, true),
    sunset: nextSunCrossing(now, lat, lon, false),
    canonical: canonicalHour(now, lat, lon),
  };
  env.risk = nightRisk(state, env);
  return env;
}

const isDay = (env) => env.sun.elevation > 0;
const isDark = (env) => env.sun.elevation < -12;
const isNight = (env) => env.sun.elevation < -6;
const isTwilight = (env) => env.sun.elevation < 0 && env.sun.elevation > -12;

/** Chance that going out right now ends badly, with what you carry. Zero by day. In the clearing the brazier and
 *  Bran's kennel help; out in the wild only a light, Bran at your side (the horn) and a cloak do. Moonlight helps both. */
export function riskFor(state, env, wild = false) {
  if (!isNight(env)) return 0;
  let risk = wild ? 0.5 : 0.4;
  if (!wild && state.built.brazier) risk *= 0.5;
  if (wild ? houndWithYou(state) : state.built.kennel) risk *= 0.5;
  const light = lightIn(state);
  if (light) risk *= ITEMS[light].light;
  for (const id of Object.values(state.you?.equip ?? {})) if (ITEMS[id]?.guard) risk *= ITEMS[id].guard;
  if (env.moon.elevation > 0) risk *= 1 - 0.4 * env.moon.illumination;
  return risk;
}

/** The danger of the clearing after dark, as the Hour page reports it. */
export function nightRisk(state, env) {
  return riskFor(state, env, false);
}

/** The light in either hand, if any. */
export function lightIn(state) {
  const eq = state.you?.equip ?? {};
  return [eq.handL, eq.handR].find((id) => ITEMS[id]?.light) ?? null;
}

export function houndWithYou(state) {
  return !!state.built.kennel && Object.values(state.you?.equip ?? {}).some((id) => ITEMS[id]?.hound);
}

// ---- What grows ------------------------------------------------------------------------------------------------

/** hours: time to full growth at rate 1. rate(env): growth multiplier right now. */
export const KINDS = {
  oak: { yield: { timber: 2 }, hours: 18, rule: "Puts on wood only in sunlight, and slowly.", rate: (env) => (isDay(env) ? 1 : 0) },
  hazel: { yield: { poles: 3 }, hours: 6, rule: "Coppiced hazel sends up new poles in sunlight.", rate: (env) => (isDay(env) ? 1 : 0) },
  bramble: { yield: { berries: 4 }, hours: 10, rule: "Ripens day and night, twice as fast in sunlight.", rate: (env) => (isDay(env) ? 1 : 0.5) },
  ring: {
    yield: { mushrooms: 3 }, hours: 6, nocturnal: true,
    rule: "Mushrooms rise only in the dark and wither in the midday sun.",
    rate: (env) => (isNight(env) ? 1 : 0),
  },
  skep: { yield: { honey: 2 }, hours: 4, rule: "The bees make honey while the sun is up.", rate: (env) => (isDay(env) ? 1 : 0) },
  moonwort: { yield: { moonwort: 1 }, nocturnal: true, rule: "Opens once each night in full darkness and closes at sunrise." },
};

export const NODES = {
  oak: { kind: "oak", name: "King's Oak" },
  hazel1: { kind: "hazel", name: "Hazel Coppice" },
  hazel2: { kind: "hazel", name: "Hazel Stool" },
  bramble: { kind: "bramble", name: "Bramble" },
  ring: { kind: "ring", name: "Fairy Ring" },
  moonwort: { kind: "moonwort", name: "Moonwort" },
  skep: { kind: "skep", name: "Straw Skep", requires: "skep" },
};

export const RESOURCES = ["timber", "poles", "berries", "honey", "mushrooms", "moonwort", "blessings"];

export const BUILDS = [
  { id: "cot", name: "Apprentice's Cot", cost: { poles: 6, berries: 4 }, desc: "Wat, your apprentice, gathers whatever is ready from Prime to Vespers, even while you are away." },
  { id: "skep", name: "Straw Skep", cost: { poles: 4, berries: 4 }, desc: "A hive of woven straw. The bees make honey through the daylight hours." },
  { id: "kennel", name: "Bran's Kennel", cost: { timber: 2, poles: 4, mushrooms: 2 }, desc: "Bran the hound guards the wood at night, keeps poachers off and halves the danger of going out." },
  { id: "beacon", name: "Tower Lantern", cost: { timber: 2, poles: 2, honey: 3 }, needs: "cot", desc: "A beeswax lantern at the top of the tower. Wat keeps the night watch and records in the Bestiary whatever passes in the dark." },
  { id: "brazier", name: "Brazier", cost: { timber: 3, poles: 2, mushrooms: 2 }, desc: "Firelight in the clearing halves the danger of the dark. With Bran at his side, Wat will gather by night." },
  { id: "cross", name: "Wayside Cross", cost: { timber: 10, honey: 6, moonwort: 3, blessings: 3 }, desc: "A cross where the paths meet, raised by a woodward whose wood never slept." },
];

const MAX_SIGHTINGS = 7;
/** Scales every entry's rate, so the Bestiary takes seasons to fill rather than days. */
const SIGHTING_PACE = 0.5;

// ---- State -----------------------------------------------------------------------------------------------------

export function newState(now) {
  const growth = { oak: 0.6, hazel1: 1, hazel2: 1, bramble: 1, ring: 0.3, skep: 0 };
  const nodes = {};
  for (const id of Object.keys(NODES)) {
    nodes[id] = NODES[id].kind === "moonwort" ? { stage: "bud" } : { growth: growth[id] ?? 0 };
  }
  const state = {
    version: 1,
    createdAt: now,
    lastTick: now,
    location: { lat: 48, lon: 0, tz: null, guessed: true },
    inv: Object.fromEntries(RESOURCES.map((r) => [r, 0])),
    nodes,
    built: {},
    you: freshYou(),
    wat: { state: "idle", at: "cot", target: null, arriveAt: null },
    sightings: [],
    nextSightingId: 1,
    book: {},
    poachers: null,
    journal: [],
    nextJournalId: 1,
    stats: { awakeSince: now, nightsWatched: 0, watchingNight: false, wasDark: false, raidsDriven: 0, raidsSuffered: 0 },
  };
  log(state, now, "The lord's steward hands you the keys to the lodge and its tower. The hazel is ready for cutting. Mind the wood after dark.", "info");
  return state;
}

export function log(state, now, text, kind = "info", extra = {}) {
  state.journal.push({ id: state.nextJournalId++, t: now, text, kind, ...extra });
  if (state.journal.length > JOURNAL_MAX) state.journal.splice(0, state.journal.length - JOURNAL_MAX);
}

function exists(state, id) {
  const req = NODES[id].requires;
  return !req || !!state.built[req];
}

export function isReady(state, id) {
  if (!NODES[id] || !exists(state, id)) return false;
  const node = state.nodes[id];
  return NODES[id].kind === "moonwort" ? node.stage === "bloom" : node.growth >= 1;
}

function addYield(state, y) {
  for (const [r, n] of Object.entries(y)) state.inv[r] = (state.inv[r] ?? 0) + n;
}

function yieldText(y) {
  return Object.entries(y).map(([r, n]) => `${n} ${r}`).join(", ");
}

/** Writes an entry into the Bestiary. Returns true the first time. */
export function record(state, entryId, now, by) {
  const page = state.book[entryId];
  if (page) {
    page.count += 1;
    page.last = now;
    return false;
  }
  state.book[entryId] = { first: now, last: now, by, count: 1 };
  const e = ENTRY[entryId];
  log(state, now, by === "wat" ? `Wat wrote a new page in the Bestiary while you slept: ${e.name}.` : `A new page in the Bestiary: ${e.name}.`, "book", { entry: entryId });
  return true;
}

const NODE_ENTRY = Object.fromEntries(ENTRIES.filter((e) => e.node).map((e) => [e.node, e.id]));

function take(state, id, now, by) {
  const def = NODES[id];
  if (def.kind === "moonwort") state.nodes[id].stage = "picked";
  else state.nodes[id].growth = 0;
  const y = KINDS[def.kind].yield;
  addYield(state, y);
  if (NODE_ENTRY[def.kind]) record(state, NODE_ENTRY[def.kind], now, by);
  return y;
}

const REACH = 2.6;
const SIGHT = 7;
const WOOD = new Set(["oak", "hazel"]);

/** You go to gather: walk there first if need be, and the deed is done on arrival. */
export function gather(state, id, now, rng = Math.random) {
  const refused = cannotAct(state, now);
  if (refused) return refused;
  if (!isReady(state, id)) return { ok: false, outcome: "nothing", message: "Nothing to gather there yet." };
  if (WOOD.has(NODES[id].kind) && !inHands(state, "hatchet")) return { ok: false, outcome: "tool", message: "You need the hatchet in hand to cut wood." };
  if (dist(currentPos(state, now), POS3[id]) > REACH) return walk(state, approach(currentPos(state, now), POS3[id], REACH - 0.6), now, { gather: id });
  return gatherHere(state, id, now, rng);
}

function gatherHere(state, id, now, rng) {
  if (!isReady(state, id)) return { ok: false, outcome: "nothing", message: "Nothing to gather there yet." };
  const env = environment(state, now);
  const mishap = danger(state, now, riskFor(state, env, !isHome(state.you.pos)), `near the ${NODES[id].name}`, rng);
  if (mishap) return mishap;
  const y = take(state, id, now, "you");
  log(state, now, `${isNight(env) ? "By the light in your hand you" : "You"} gathered ${yieldText(y)} from the ${NODES[id].name}.`, "you", { gain: y });
  return { ok: true, outcome: "gathered", yield: y };
}

/** Rolls the night's dice. On a bad roll you end up home: having run for it, or hurt. */
function danger(state, now, risk, where, rng) {
  if (!(rng() < risk)) return null;
  Object.assign(state.you, { pos: [...HOME], walk: null, exploring: false });
  if (rng() < 0.5) {
    log(state, now, `Wolves came out of the dark ${where}. You dropped everything and ran for the lodge.`, "danger");
    return { ok: false, outcome: "fled", message: "Wolves! You dropped everything and ran home." };
  }
  state.you.restUntil = now + REST_MS;
  log(state, now, `You stumbled on a root in the dark ${where} and twisted your ankle. Wat helped you home. You must rest for two hours.`, "danger");
  return { ok: false, outcome: "hurt", message: "You fell in the dark and must rest for two hours.", restUntil: state.you.restUntil };
}

function cannotAct(state, now) {
  if (state.you.restUntil && now < state.you.restUntil) return { ok: false, outcome: "resting", message: "You are still nursing your ankle by the fire." };
  const env = environment(state, now);
  if (isNight(env) && !lightIn(state)) return { ok: false, outcome: "dark", message: "It is pitch dark outside. Take a light in your hand first." };
  return null;
}

function inHands(state, item) {
  return state.you.equip.handL === item || state.you.equip.handR === item;
}

/** A point `gap` short of `to`, on the way from `from`. */
function approach(from, to, gap) {
  const d = dist(from, to);
  if (d <= gap) return [...from];
  const k = (d - gap) / d;
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
}

// ---- Walking the land ------------------------------------------------------------------------------------------

export function freshYou() {
  return { restUntil: null, pos: [...HOME], walk: null, exploring: false, waypoints: [], items: [...STARTING_GEAR.items], equip: { ...STARTING_GEAR.equip } };
}

/** Fills in what an older save lacks. */
export function migrate(state) {
  state.you = { ...freshYou(), ...state.you };
  return state;
}

export function speed(state) {
  let v = 2.6;
  for (const id of Object.values(state.you.equip)) if (ITEMS[id]?.speed) v *= ITEMS[id].speed;
  return v;
}

export function currentPos(state, now) {
  const w = state.you.walk;
  if (!w) return state.you.pos;
  const t = Math.max(0, Math.min(1, (now - w.departedAt) / (w.arriveAt - w.departedAt)));
  return [w.from[0] + (w.to[0] - w.from[0]) * t, w.from[1] + (w.to[1] - w.from[1]) * t];
}

/** Sets off towards `to`. `then` is what to do on arrival: { gather: nodeId } or { look: sightingId }. */
export function walk(state, to, now, then = null) {
  const refused = cannotAct(state, now);
  if (refused) return refused;
  let [x, z] = to.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { ok: false, message: "That is nowhere." };
  const r = Math.hypot(x, z);
  if (r > WORLD_RADIUS) [x, z] = [(x / r) * WORLD_RADIUS, (z / r) * WORLD_RADIUS];
  const from = currentPos(state, now);
  const ms = Math.max(300, (dist(from, [x, z]) / speed(state)) * 1000);
  state.you.pos = from;
  state.you.walk = { from, to: [x, z], departedAt: now, arriveAt: now + ms, then };
  return { ok: true, outcome: "walking", arriveAt: now + ms };
}

/** Finishes a walk whose time has come: where you are now, what you found, and whatever you set out to do. */
export function arrive(state, now, rng = Math.random) {
  const w = state.you.walk;
  if (!w || now < w.arriveAt) return null;
  state.you.pos = [...w.to];
  state.you.walk = null;
  const env = environment(state, now);
  const wild = !isHome(w.to) || !isHome(w.from);
  if (wild && isNight(env)) {
    const mishap = danger(state, now, riskFor(state, env, true) * Math.min(1, dist(w.from, w.to) / 25), "out in the dark", rng);
    if (mishap) return mishap;
  }
  const home = isHome(state.you.pos);
  if (!home && !state.you.exploring) {
    state.you.exploring = true;
    log(state, now, "You left the clearing. The tower is out of reach until you find a waypoint, or walk home.", "you");
  } else if (home && state.you.exploring) {
    state.you.exploring = false;
    log(state, now, "You are back in the clearing, under the tower.", "you");
  }
  for (const wp of WAYPOINTS) {
    if (dist(state.you.pos, wp.at) <= REACH && !state.you.waypoints.includes(wp.id)) {
      state.you.waypoints.push(wp.id);
      log(state, now, `You found the ${wp.name}. Laying a hand on any waypoint you have found takes you back to the tower.`, "book");
    }
  }
  if (w.then?.gather) return gatherHere(state, w.then.gather, now, rng);
  if (w.then?.look) return lookHere(state, w.then.look, now);
  return { ok: true, outcome: "arrived" };
}

/** At a waypoint you have found: back to the foot of the tower. */
export function recall(state, now) {
  if (state.you.walk) return { ok: false, message: "Stop walking first." };
  const wp = WAYPOINTS.find((x) => state.you.waypoints.includes(x.id) && dist(state.you.pos, x.at) <= REACH);
  if (!wp) return { ok: false, message: "You must stand at a waypoint you have found." };
  Object.assign(state.you, { pos: [...HOME], exploring: false });
  log(state, now, `You laid your hand on the ${wp.name}, and stood at the foot of the tower.`, "you");
  return { ok: true };
}

export function equip(state, item, slot) {
  const you = state.you;
  if (!you.items.includes(item)) return { ok: false, message: "You do not have that." };
  for (const [k, v] of Object.entries(you.equip)) if (v === item) delete you.equip[k];
  if (slot == null) return { ok: true };
  if (!ITEMS[item].fits.includes(slot)) return { ok: false, message: `The ${ITEMS[item].name} does not go there.` };
  you.equip[slot] = item;
  return { ok: true };
}

export const GEAR = [
  { id: "lantern", cost: { honey: 2, timber: 1 } },
  { id: "horn", cost: { timber: 1, poles: 2, honey: 1 } },
  { id: "staff", cost: { poles: 2 } },
  { id: "cloak", cost: { berries: 8, honey: 2 } },
];

export function craft(state, id, now) {
  const g = GEAR.find((x) => x.id === id);
  if (!g) return { ok: false, error: "Unknown gear." };
  if (state.you.items.includes(id)) return { ok: false, error: "You have one already." };
  if (!canAfford(state, g.cost)) return { ok: false, error: "Not enough in the store." };
  for (const [r, n] of Object.entries(g.cost)) state.inv[r] -= n;
  state.you.items.push(id);
  log(state, now, `You made a ${ITEMS[id].name}. It is in your pack.`, "build");
  return { ok: true };
}

/** Looking from the tower is always safe, but only from home. On the ground you walk up close first. */
export function look(state, sightingId, now, by = "you", from = "tower") {
  if (by === "you" && from === "ground") {
    const s = state.sightings.find((x) => x.id === sightingId);
    if (!s || now > s.until) return { ok: false, message: "Whatever it was has gone." };
    const [x, , z] = zonePoint(s);
    const here = currentPos(state, now);
    if (dist(here, [x, z]) > SIGHT) {
      const refused = cannotAct(state, now);
      if (refused) return refused;
      return walk(state, approach(here, [x, z], SIGHT - 1.5), now, { look: sightingId });
    }
  } else if (by === "you" && state.you.exploring) {
    return { ok: false, message: "You are out in the land, far from the tower." };
  }
  return lookHere(state, sightingId, now, by);
}

function lookHere(state, sightingId, now, by = "you") {
  const s = state.sightings.find((x) => x.id === sightingId);
  if (!s || now > s.until) return { ok: false, message: "Whatever it was has gone." };
  if (s.seenBy?.includes(by)) return { ok: true, isNew: false, entry: s.entry };
  s.seenBy = [...(s.seenBy ?? []), by];
  const isNew = record(state, s.entry, now, by);
  const e = ENTRY[s.entry];
  if (e.blessing) {
    state.inv.blessings += 1;
    log(state, now, by === "wat" ? "Wat saw the white hart from the tower. A blessing on the wood." : "You saw the white hart. A blessing on the wood.", by === "wat" ? "wat" : "you", { gain: { blessings: 1 } });
  }
  return { ok: true, isNew, entry: s.entry };
}

/** Moves the wood. Whatever the old sky had set in motion is put right for the new one, without fuss in the Chronicle. */
export function relocate(state, location, now) {
  state.location = location;
  const env = environment(state, now);
  if (state.nodes.moonwort.stage === "bloom" && !isDark(env)) state.nodes.moonwort.stage = "bud";
  state.stats.wasDark = isDark(env);
  state.stats.watchingNight = false;
  state.sightings = [];
}

export function canAfford(state, cost) {
  return Object.entries(cost).every(([r, n]) => (state.inv[r] ?? 0) >= n);
}

export function build(state, id, now) {
  const b = BUILDS.find((x) => x.id === id);
  if (!b) return { ok: false, error: "Unknown build." };
  if (state.built[id]) return { ok: false, error: "Already built." };
  if (b.needs && !state.built[b.needs]) return { ok: false, error: `Needs the ${BUILDS.find((x) => x.id === b.needs).name} first.` };
  if (!canAfford(state, b.cost)) return { ok: false, error: "Not enough in the store." };
  for (const [r, n] of Object.entries(b.cost)) state.inv[r] -= n;
  state.built[id] = now;
  const lines = {
    cot: "Wat, the miller's youngest, moved into the cot. He will gather whatever is ready by day.",
    skep: "A swarm settled in the new skep. Honey comes with the sun.",
    kennel: "Bran the hound took to the kennel at once. The wood will be watched at night.",
    beacon: "The lantern burns at the top of the tower. From tonight Wat keeps the watch, slate in hand.",
    brazier: "The brazier is lit in the clearing. The dark is a little less dangerous.",
    cross: "The Wayside Cross is raised where the paths meet. Travellers will remember this wood, and the woodward whose wood never slept.",
  };
  log(state, now, lines[id], "build");
  for (const e of ENTRIES) if (e.build === id) record(state, e.id, now, "you");
  return { ok: true };
}

// ---- Time ------------------------------------------------------------------------------------------------------

export function watAwake(state, env) {
  return !!state.built.cot && (!isNight(env) || (!!state.built.brazier && !!state.built.kennel));
}

/** Wat keeps the tower watch from dusk to dawn once the lantern is lit. */
export function watOnWatch(state, env) {
  return !!state.built.cot && !!state.built.beacon && env.sun.elevation < 0;
}

function watNextTarget(state) {
  const order = ["moonwort", "ring", ...Object.keys(NODES).filter((id) => id !== "moonwort" && id !== "ring")];
  return order.find((id) => isReady(state, id)) ?? null;
}

function entryVisible(e, env, month, south) {
  if (e.source) return false;
  const rising = env.phase === "Dawn" || env.phase === "Morning";
  if (!e.times.includes(timeBucket(env.sun.elevation, rising))) return false;
  if (e.months && !e.months.includes(south ? shiftMonth(month) : month)) return false;
  if (e.moon === "dark" && env.moon.illumination > 0.35) return false;
  if (e.moon === "bright" && env.moon.illumination < 0.75) return false;
  return true;
}

/** The month as the player would name it: in their timezone when known, else by longitude. */
function localMonth(state, now) {
  if (state.location.tz) {
    try {
      return Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: state.location.tz }).format(now));
    } catch {}
  }
  return new Date(now + (state.location.lon / 15) * HOUR).getUTCMonth() + 1;
}

function spawnSighting(state, entryId, now, rng) {
  const e = ENTRY[entryId];
  const [x0, x1, y0, y1] = ZONES[e.where];
  const s = {
    id: state.nextSightingId++, entry: entryId, appearedAt: now, until: now + e.stay * 60_000,
    x: Math.round(x0 + rng() * (x1 - x0)), y: Math.round(y0 + rng() * (y1 - y0)), flip: rng() < 0.5, seenBy: [],
  };
  state.sightings.push(s);
  return s;
}

/** Advances the wood to `now`. rng is injectable for tests. */
export function tick(state, now, rng = Math.random) {
  let dt = now - state.lastTick;
  if (dt < 0) dt = 0;
  if (dt > MAX_STEP_MS) {
    log(state, now, `The wood lay still for ${formatDuration(dt)} while the computer was off. Nothing grew, and nobody kept watch.`, "gap");
    dt = 0;
    state.stats.awakeSince = now;
    state.stats.watchingNight = false;
    if (state.wat.state === "walking") Object.assign(state.wat, { state: "idle", target: null, arriveAt: null });
    if (state.you.walk) Object.assign(state.you, { pos: [...state.you.walk.to], walk: null });
  }
  state.lastTick = now;
  const env = environment(state, now);
  const hours = dt / HOUR;
  arrive(state, now, rng);

  if (state.you.restUntil && now >= state.you.restUntil) {
    state.you.restUntil = null;
    log(state, now, "Your ankle has mended. You can go out again.", "you");
  }

  for (const [id, def] of Object.entries(NODES)) {
    if (!exists(state, id)) continue;
    const kind = KINDS[def.kind];
    const node = state.nodes[id];
    if (def.kind === "moonwort") {
      if (node.stage === "bud" && isDark(env)) {
        node.stage = "bloom";
        log(state, now, "The moonwort opened in the dark glade.", "night");
      } else if (node.stage === "bloom" && isDay(env)) {
        node.stage = "bud";
        log(state, now, "The moonwort closed at sunrise, unpicked.", "miss");
      } else if (node.stage === "picked" && isDay(env)) {
        node.stage = "bud";
      }
      continue;
    }
    if (def.kind === "ring" && node.growth >= 1 && env.sun.elevation > 20) {
      node.growth = 0;
      log(state, now, "The mushrooms in the fairy ring withered in the midday sun.", "miss");
      continue;
    }
    if (node.growth < 1) {
      node.growth = Math.min(1, node.growth + (hours * kind.rate(env)) / kind.hours);
      if (node.growth >= 1 && kind.nocturnal) log(state, now, `The ${def.name} is ready, out in the dark.`, "night");
    }
  }

  // What can be seen from the tower comes and goes with the hour, the moon and the month.
  const gone = state.sightings.filter((s) => now > s.until);
  for (const s of gone) if (ENTRY[s.entry].blessing && !s.seenBy.length) log(state, now, "The white hart slipped back into the trees, unseen.", "miss");
  state.sightings = state.sightings.filter((s) => now <= s.until);
  const month = localMonth(state, now);
  const south = state.location.lat < 0;
  // An empty view (a new wood, or after the computer was off) starts with what would plausibly be about already.
  const priming = state.sightings.length === 0;
  for (const e of ENTRIES) {
    if (state.sightings.length >= MAX_SIGHTINGS) break;
    if (state.sightings.some((s) => s.entry === e.id)) continue;
    const chance = priming ? Math.min(0.6, e.rate) : hours * e.rate * SIGHTING_PACE;
    if (entryVisible(e, env, month, south) && rng() < chance) {
      const s = spawnSighting(state, e.id, now, rng);
      if (priming) s.until = now + rng() * e.stay * 60_000;
    }
  }

  // Poachers: about one attempt per four dark hours. Bran drives them off; without him they take from the store.
  if (isDark(env) && rng() < hours / 4) poachers(state, now, rng);
  else if (state.poachers && now > state.poachers.until) state.poachers = null;

  // The night watch: Wat records whatever has been in view for a minute.
  if (watOnWatch(state, env)) {
    for (const s of state.sightings) if (now - s.appearedAt >= 60_000 && !s.seenBy.includes("wat")) lookHere(state, s.id, now, "wat");
  }

  // Nights watched: a full stretch of darkness through to sunrise without the computer stopping.
  const dark = isDark(env);
  if (dark && !state.stats.wasDark) state.stats.watchingNight = dt > 0;
  if (isDay(env) && state.stats.watchingNight) {
    state.stats.watchingNight = false;
    state.stats.nightsWatched += 1;
    log(state, now, `Prime. The bell rings at sunrise; your computer kept watch through the night (${state.stats.nightsWatched} so far).`, "dawn");
  }
  state.stats.wasDark = dark;

  stepWat(state, now, env);
  return env;
}

export function poachers(state, now, rng = Math.random) {
  state.poachers = { at: now, until: now + 15 * 60_000, driven: !!state.built.kennel };
  if (!state.sightings.some((s) => s.entry === "poachers")) spawnSighting(state, "poachers", now, rng);
  if (state.built.kennel) {
    state.stats.raidsDriven += 1;
    log(state, now, "Bran bayed at torchlight in the trees. The poachers fled.", "guard");
    return;
  }
  state.stats.raidsSuffered += 1;
  const goods = ["timber", "poles", "honey", "berries"].filter((r) => state.inv[r] > 0).sort((a, b) => state.inv[b] - state.inv[a]);
  if (goods.length) {
    const r = goods[0];
    const lost = Math.ceil(state.inv[r] / 2);
    state.inv[r] -= lost;
    log(state, now, `Poachers crept into the wood by night and carried off ${lost} ${r}. A hound would have heard them.`, "danger", { loss: { [r]: lost } });
  } else {
    state.nodes.hazel1.growth = 0;
    log(state, now, "Poachers cut the hazel coppice in the night. A hound would have heard them.", "danger");
  }
}

function stepWat(state, now, env) {
  const wat = state.wat;
  if (!state.built.cot) return;
  if (!watAwake(state, env)) {
    if (wat.state !== "sleeping") {
      Object.assign(wat, { state: "sleeping", at: "cot", target: null, arriveAt: null });
      const line = state.built.beacon
        ? "Vespers. Wat climbed the tower with his slate to keep the watch."
        : "Vespers. Wat barred the cot door; no lad goes into the wood after dark without a hound and a light.";
      log(state, now, line, "wat");
    }
    return;
  }
  if (wat.state === "sleeping") {
    Object.assign(wat, { state: "idle", at: "cot" });
    log(state, now, isNight(env) ? "Wat lit a lantern, whistled for Bran, and set out." : "Wat rose at first light.", "wat");
  }
  if (wat.state === "walking" && now >= wat.arriveAt) {
    if (isReady(state, wat.target)) {
      const y = take(state, wat.target, now, "wat");
      log(state, now, `Wat brought in ${yieldText(y)} from the ${NODES[wat.target].name}.`, "wat", { gain: y });
    }
    Object.assign(wat, { state: "idle", at: wat.target, target: null, arriveAt: null });
  }
  if (wat.state === "idle") {
    const target = watNextTarget(state);
    if (target) Object.assign(wat, { state: "walking", from: wat.at, target, departedAt: now, arriveAt: now + WAT_WALK_MS });
  }
}

// ---- Helpers ---------------------------------------------------------------------------------------------------

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function formatDuration(ms) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** A rough first location from the browser's timezone, until the player sets one. */
export function guessLocation(tz, offsetMinutes) {
  const lon = clamp(-offsetMinutes / 4, -180, 180);
  const region = String(tz ?? "").split("/")[0];
  const south = /^(Australia|Antarctica)$/.test(region) || /Auckland|Sao_Paulo|Buenos_Aires|Santiago|Johannesburg|Lima|Montevideo/.test(tz ?? "");
  const lat = south ? -33 : { Europe: 48, America: 40, Asia: 30, Africa: 8, Pacific: 20 }[region] ?? 40;
  return { lat, lon, tz: tz ?? null, guessed: true };
}

/** What a client needs to draw the wood and its UI. */
export function snapshot(state, now, env = environment(state, now)) {
  const nodes = {};
  for (const [id, def] of Object.entries(NODES)) {
    if (!exists(state, id)) continue;
    const kind = KINDS[def.kind];
    const node = state.nodes[id];
    const rate = kind.rate ? kind.rate(env) : null;
    nodes[id] = {
      ...node, kind: def.kind, name: def.name, rule: kind.rule, yield: kind.yield, ready: isReady(state, id),
      etaHours: rate ? ((1 - node.growth) * kind.hours) / rate : null,
    };
  }
  return {
    now,
    year: new Date(now).getUTCFullYear() - YEAR_OFFSET,
    location: state.location,
    inv: state.inv,
    nodes,
    built: state.built,
    builds: BUILDS.map((b) => ({ ...b, built: !!state.built[b.id], affordable: canAfford(state, b.cost) && (!b.needs || !!state.built[b.needs]) })),
    you: {
      ...state.you, pos: currentPos(state, now), light: lightIn(state), hound: houndWithYou(state), speed: speed(state),
      wildRisk: riskFor(state, env, true), atWaypoint: WAYPOINTS.find((w) => state.you.waypoints.includes(w.id) && !state.you.walk && dist(state.you.pos, w.at) <= REACH)?.id ?? null,
    },
    gear: GEAR.map((g) => ({ ...g, owned: state.you.items.includes(g.id), affordable: canAfford(state, g.cost) })),
    wat: { ...state.wat, awake: watAwake(state, env), onWatch: watOnWatch(state, env) },
    sightings: state.sightings.filter((s) => now <= s.until),
    book: state.book,
    poachers: state.poachers && now <= state.poachers.until ? state.poachers : null,
    journal: state.journal.slice(-80),
    stats: state.stats,
    env,
  };
}
