// The Bestiary & Herbal: every beast, bird, herb, person and marvel the woodward can record. Shared by the server
// (when things appear) and the page (how they are drawn). Pure data, no imports.
//
// times:  any of "day" (sun up), "dusk", "dawn" (sun just below the horizon), "night" (full dark).
// months: northern-hemisphere months it can be seen (1-12); shifted six months south of the equator. Absent: all year.
// moon:   "dark" needs a thin moon, "bright" a full one.
// rate:   expected sightings per hour while all conditions hold. stay: minutes it lingers.
// where:  the part of the tower's view it appears in (ZONES). source "gather": recorded by gathering, not by looking.
// art:    parameters for the page's ink drawings (see draw.js on the page).

export const GROUPS = {
  beast: "Beasts",
  bird: "Birds",
  herb: "Herbs & Trees",
  folk: "Folk",
  marvel: "Marvels",
};

/** Where things appear in the tower's view, in its 800 x 600 drawing: [x0, x1, y0, y1] of a figure's feet. */
export const ZONES = {
  sky: [80, 720, 50, 150],
  hills: [380, 760, 222, 246],
  village: [70, 250, 262, 286],
  road: [250, 420, 300, 345],
  river: [90, 700, 352, 380],
  field: [430, 760, 300, 345],
  wood: [60, 740, 420, 452],
};

export const ENTRIES = [
  // ---- Beasts
  { id: "reddeer", group: "beast", name: "Red Deer", latin: "Cervus elaphus", times: ["day", "dusk", "dawn"], rate: 0.5, stay: 30, where: "wood",
    art: { shape: "quad", color: "#9a5a2e", size: 1.35, legs: "long", ears: "point", tail: "short", antlers: true },
    text: "When the hart grows old, says the bestiary, it draws serpents from their holes with its breath, eats them, and is made young again. Ours mostly eats the hazel." },
  { id: "roedeer", group: "beast", name: "Roe Deer", latin: "Capreolus capreolus", times: ["dusk", "dawn"], rate: 0.6, stay: 25, where: "field",
    art: { shape: "quad", color: "#b0703c", size: 1.0, legs: "long", ears: "round", tail: "none" },
    text: "Small, quick and shy. It sees far, they say, and knows from a great way off whether a man comes as hunter or as friend." },
  { id: "boar", group: "beast", name: "Wild Boar", latin: "Sus scrofa", times: ["dusk", "night"], rate: 0.25, stay: 30, where: "wood",
    art: { shape: "quad", color: "#4a3a30", size: 1.1, legs: "short", ears: "point", tail: "short", tusks: true },
    text: "The lord hunts it in winter, with spears and many dogs. A woodward hunts it never, and gives it the path." },
  { id: "fox", group: "beast", name: "Red Fox", latin: "Vulpes vulpes", times: ["dusk", "night", "dawn"], rate: 0.5, stay: 20, where: "field",
    art: { shape: "quad", color: "#c4561e", size: 0.85, legs: "short", ears: "point", tail: "bushy" },
    text: "The fox rolls in red earth and lies as if dead, so the birds think it bleeding. When they come down to peck at it, it springs up and has them." },
  { id: "badger", group: "beast", name: "Badger", latin: "Meles meles", times: ["night"], months: [3, 4, 5, 6, 7, 8, 9, 10], rate: 0.35, stay: 25, where: "wood",
    art: { shape: "quad", color: "#6d6a66", size: 0.8, legs: "short", ears: "round", tail: "short", stripe: true },
    text: "It keeps a clean house and digs out its old bedding on a fine night. Wat says it will tidy around a fox that lodges with it." },
  { id: "hare", group: "beast", name: "Hare", latin: "Lepus europaeus", times: ["day", "dawn", "dusk"], rate: 0.6, stay: 20, where: "field",
    art: { shape: "quad", color: "#a98352", size: 0.65, legs: "long", ears: "long", tail: "short" },
    text: "It runs faster uphill than down, for its forelegs are short. In March the hares stand up and box in the open field, and nobody knows why." },
  { id: "wolf", group: "beast", name: "Wolf", latin: "Canis lupus", times: ["night"], rate: 0.15, stay: 15, where: "hills",
    art: { shape: "quad", color: "#5d5850", size: 1.05, legs: "long", ears: "point", tail: "bushy", eyes: true },
    text: "If a wolf sees a man before the man sees it, the man is struck dumb. So look first, from the tower, and say nothing of going down." },
  { id: "otter", group: "beast", name: "Otter", latin: "Lutra lutra", times: ["dawn", "dusk"], rate: 0.3, stay: 20, where: "river",
    art: { shape: "quad", color: "#5b4632", size: 0.7, legs: "short", ears: "round", tail: "long" },
    text: "The water-dog. The abbey's fishponds lose a carp a night to it, and the cellarer has words for it that are not in any bestiary." },
  { id: "hedgehog", group: "beast", name: "Hedgehog", latin: "Erinaceus europaeus", times: ["night"], months: [4, 5, 6, 7, 8, 9, 10], rate: 0.4, stay: 20, where: "field",
    art: { shape: "quad", color: "#7a6046", size: 0.45, legs: "short", ears: "round", tail: "none", spines: true },
    text: "At vintage time it climbs the vine, shakes down the grapes and rolls on them, and carries them home on its spines for its young." },

  // ---- Birds
  { id: "heron", group: "bird", name: "Grey Heron", latin: "Ardea cinerea", times: ["day"], rate: 0.5, stay: 40, where: "river",
    art: { shape: "bird", color: "#8d9298", size: 1.2, pose: "stand", neck: "long", legs: "long" },
    text: "It stands so long and still in the shallows that the fish forget it. When storms come it flies high above the clouds to escape them." },
  { id: "barnowl", group: "bird", name: "Barn Owl", latin: "Tyto alba", times: ["dusk", "night"], rate: 0.45, stay: 15, where: "field",
    art: { shape: "bird", color: "#e7d3a8", size: 0.8, pose: "fly", face: "owl" },
    text: "The bestiary calls the owl a bird of darkness that loves no light. Wat says it eats the mice in the tithe barn, which is more than the bestiary does." },
  { id: "tawny", group: "bird", name: "Tawny Owl", latin: "Strix aluco", times: ["night"], rate: 0.4, stay: 20, where: "wood",
    art: { shape: "bird", color: "#8b5e34", size: 0.8, pose: "perch", face: "owl" },
    text: "Two of them call to each other across the clearing: one says 'kewick', the other answers 'hoo'. The village takes it for one owl, and a bad omen." },
  { id: "nightjar", group: "bird", name: "Nightjar", latin: "Caprimulgus europaeus", times: ["dusk", "night"], months: [5, 6, 7, 8], rate: 0.35, stay: 15, where: "field",
    art: { shape: "bird", color: "#6b5a44", size: 0.7, pose: "fly" },
    text: "The goatsucker, the herdsmen call it, for they say it milks their goats by night. It churrs like a spinning wheel in the dark." },
  { id: "swallow", group: "bird", name: "Swallows", latin: "Hirundo rustica", times: ["day"], months: [4, 5, 6, 7, 8, 9], rate: 0.8, stay: 30, where: "village",
    art: { shape: "bird", color: "#2c3a5a", size: 0.5, pose: "fly", count: 3 },
    text: "They come at the feast of the Annunciation and go at Michaelmas. Some say they winter in the mud at the bottom of the pond." },
  { id: "crane", group: "bird", name: "Cranes", latin: "Grus grus", times: ["day", "dusk"], months: [3, 4, 10, 11], rate: 0.3, stay: 30, where: "river",
    art: { shape: "bird", color: "#9aa0a4", size: 1.3, pose: "stand", neck: "long", legs: "long", count: 2 },
    text: "Cranes keep a watch by night. The watcher holds a stone in one raised claw, and if it dozes the stone falls and wakes it. A good custom for any watch." },
  { id: "raven", group: "bird", name: "Raven", latin: "Corvus corax", times: ["day"], rate: 0.4, stay: 25, where: "hills",
    art: { shape: "bird", color: "#1f1c22", size: 0.9, pose: "fly" },
    text: "Noah sent it out from the ark, and it never came back. It is still out there, over the hills, croaking about it." },
  { id: "nightingale", group: "bird", name: "Nightingale", latin: "Luscinia megarhynchos", times: ["night", "dawn"], months: [4, 5, 6], rate: 0.5, stay: 20, where: "wood",
    art: { shape: "bird", color: "#8a6a4a", size: 0.5, pose: "perch", song: true },
    text: "It sings all night to ease its labour over the eggs, the bestiary says, as a poor woman sings over her spinning to make the night pass." },
  { id: "woodcock", group: "bird", name: "Woodcock", latin: "Scolopax rusticola", times: ["dusk", "dawn"], months: [10, 11, 12, 1, 2, 3], rate: 0.3, stay: 15, where: "wood",
    art: { shape: "bird", color: "#8a6844", size: 0.7, pose: "fly", bill: "long" },
    text: "It comes with the first full moon of October, flying in over the sea in a single night, and goes again in spring." },

  // ---- Herbs & trees (seen from the tower, or recorded by gathering)
  { id: "cowslip", group: "herb", name: "Cowslip", latin: "Primula veris", times: ["day"], months: [3, 4, 5], rate: 0.5, stay: 120, where: "field",
    art: { shape: "herb", color: "#e8c040", flower: "bell" },
    text: "Keys of Saint Peter, the women call it. A cordial of the flowers is good against palsy and bad dreams." },
  { id: "foxglove", group: "herb", name: "Foxglove", latin: "Digitalis purpurea", times: ["day"], months: [6, 7, 8], rate: 0.5, stay: 120, where: "wood",
    art: { shape: "herb", color: "#b04a8a", flower: "bell", tall: true },
    text: "Folk's gloves: the little people wear the flowers on their hands. Do not let the goats at it, or anyone else." },
  { id: "meadowsweet", group: "herb", name: "Meadowsweet", latin: "Filipendula ulmaria", times: ["day"], months: [6, 7, 8], rate: 0.5, stay: 120, where: "river",
    art: { shape: "herb", color: "#f2ead2", flower: "cluster", tall: true },
    text: "Strewn on the floor of the hall it makes the whole house smell of summer. The brewer puts it in the mead." },
  { id: "mistletoe", group: "herb", name: "Mistletoe", latin: "Viscum album", times: ["day"], months: [11, 12, 1, 2], rate: 0.4, stay: 180, where: "wood",
    art: { shape: "herb", color: "#e9edd8", flower: "berry" },
    text: "It grows on no ground, only high on the apple and, rarely, the oak. The priest will not have it in church." },
  { id: "oak", group: "herb", name: "Oak", latin: "Quercus robur", source: "gather", node: "oak",
    art: { shape: "herb", color: "#6f7a2e", flower: "acorn" },
    text: "The King's Oak was old when the Conqueror came. Its timber is the lord's; its acorns are the pigs' by the right of pannage." },
  { id: "hazel", group: "herb", name: "Hazel", latin: "Corylus avellana", source: "gather", node: "hazel",
    art: { shape: "herb", color: "#9a7a3a", flower: "catkin" },
    text: "Cut it to the stool and it comes again, straighter, every seven years. Hurdles, wattle, rods, and a forked twig for finding water." },
  { id: "bramble", group: "herb", name: "Bramble", latin: "Rubus fruticosus", source: "gather", node: "bramble",
    art: { shape: "herb", color: "#3a2a4a", flower: "berry" },
    text: "Pick none after Michaelmas: on that day the Devil was cast out of Heaven into a bramble bush, and he spits on them every year since." },
  { id: "flyagaric", group: "herb", name: "Fly Agaric", latin: "Amanita muscaria", source: "gather", node: "ring",
    art: { shape: "herb", color: "#c23a22", flower: "mushroom" },
    text: "Crumbled in milk it kills flies. It comes up in a ring overnight where the little people danced; step inside it at your peril." },
  { id: "moonwort", group: "herb", name: "Moonwort", latin: "Botrychium lunaria", source: "gather", node: "moonwort",
    art: { shape: "herb", color: "#c8d0e8", flower: "fern" },
    text: "Its leaves are little half-moons. A horse that treads on it casts its shoes, and a lock it touches springs open." },
  { id: "bees", group: "herb", name: "Honey Bees", latin: "Apis mellifera", source: "build", build: "skep",
    art: { shape: "herb", color: "#d9a520", flower: "bee" },
    text: "The bees choose a king and live under his law, and none of them is idle. The bestiary holds them up as a lesson. Wat holds them at a distance." },

  // ---- Folk
  { id: "pedlar", group: "folk", name: "Pedlar", latin: "mercator pedester", times: ["day"], rate: 0.3, stay: 40, where: "road",
    art: { shape: "folk", color: "#7a5a2a", pack: true, hat: true, staff: true },
    text: "Needles, ribbons, salt, a saint's tooth of doubtful saint. He walks between the fairs and carries the news of three shires." },
  { id: "pilgrims", group: "folk", name: "Pilgrims", latin: "peregrini", times: ["day"], rate: 0.35, stay: 40, where: "road",
    art: { shape: "folk", color: "#5a5f70", hat: true, staff: true, count: 2, shell: true },
    text: "Bound for the shrine with scallop shells on their hats. They ask the way, and pray for the woodward, and ask the way again." },
  { id: "charcoal", group: "folk", name: "Charcoal Burner", latin: "carbonarius", times: ["day", "dusk"], rate: 0.3, stay: 90, where: "wood",
    art: { shape: "folk", color: "#3a3430", smoke: true },
    text: "He lives in the wood for weeks beside his smoking clamp and sleeps beside it, for if it flares the whole burn is lost." },
  { id: "monk", group: "folk", name: "White Monk", latin: "monachus albus", times: ["day"], rate: 0.25, stay: 40, where: "road",
    art: { shape: "folk", color: "#ece6d6", hood: true },
    text: "A Cistercian of the new abbey down the valley, in undyed wool. They clear the waste and keep sheep, and cast an eye on the lord's wood." },
  { id: "verderer", group: "folk", name: "The Verderer", latin: "viridarius", times: ["day"], rate: 0.08, stay: 30, where: "road",
    art: { shape: "folk", color: "#3e6b3a", hat: true, horse: true },
    text: "The officer of the forest court, who answers to the King for every felled oak and every lost deer. Have your tallies ready." },
  { id: "poachers", group: "folk", name: "Poachers", latin: "fures venationis", times: ["night"], rate: 0.12, stay: 15, where: "wood",
    art: { shape: "folk", color: "#2a2620", torch: true, count: 2, hood: true },
    text: "Torchlight where no torch should be. Under the forest law a man may lose his hand for a deer. They come anyway, when nobody watches." },
  { id: "traveller", group: "folk", name: "Lost Traveller", latin: "viator errans", times: ["dusk", "night"], rate: 0.12, stay: 20, where: "road",
    art: { shape: "folk", color: "#6a4a3a", staff: true, lantern: true },
    text: "Every road leads into the wood and only one leads out. The tower's light has brought more than one of them to the door." },

  // ---- Marvels
  { id: "hart", group: "marvel", name: "The White Hart", latin: "cervus albus", times: ["dusk", "dawn"], rate: 0.5, stay: 5, where: "wood", blessing: true,
    art: { shape: "quad", color: "#f6f2e6", size: 1.35, legs: "long", ears: "point", tail: "short", antlers: true, glow: "#fff4c0" },
    text: "It shows itself only at the turning of day and night, and only for a moment. Whoever sees it, the wood is blessed. Whoever hunts it, is not." },
  { id: "wisp", group: "marvel", name: "Will-o'-the-Wisp", latin: "ignis fatuus", times: ["night"], moon: "dark", rate: 0.3, stay: 10, where: "river",
    art: { shape: "light", color: "#a8f0c8", kind: "wisp" },
    text: "A pale flame over the marsh that goes before you and will not be caught. Follow it and you are in the bog to your waist." },
  { id: "star", group: "marvel", name: "Falling Star", latin: "stella cadens", times: ["night"], rate: 0.4, stay: 3, where: "sky",
    art: { shape: "light", color: "#ffe9a0", kind: "star" },
    text: "A spark struck from the firmament. The priest says it is a soul going up; the pedlar says it is a soul coming down, and sells charms against it." },
  { id: "wildhunt", group: "marvel", name: "The Wild Hunt", latin: "familia Herlechini", times: ["night"], months: [12, 1], rate: 0.05, stay: 5, where: "sky",
    art: { shape: "light", color: "#c8b8ff", kind: "hunt" },
    text: "Horns in the sky on a winter night, hounds and riders black against the clouds. The monks of Peterborough saw it in the year of Our Lord 1127. Do not go out." },
];

export const ENTRY = Object.fromEntries(ENTRIES.map((e) => [e.id, e]));

/** "day" | "dusk" | "dawn" | "night" for a sun elevation and whether it is rising. */
export function timeBucket(elevation, rising) {
  if (elevation > 0) return "day";
  if (elevation > -12) return rising ? "dawn" : "dusk";
  return "night";
}

/** A short hint for an entry not yet recorded: when and where to look. */
export function entryHint(e, south = false) {
  if (e.source === "gather") return "Gather it in the wood to record it.";
  if (e.source === "build") return "Raise a skep to record it.";
  const when = e.times.map((t) => ({ day: "by day", dusk: "at dusk", dawn: "at dawn", night: "at night" })[t]).join(", ");
  const where = { sky: "in the sky", hills: "on the hills", village: "by the village", road: "on the road", river: "by the river", field: "in the fields", wood: "at the wood's edge" }[e.where];
  const months = e.months ? `, ${seasonWords(south ? e.months.map(shiftMonth) : e.months)}` : "";
  const moon = e.moon === "dark" ? ", when the moon is thin" : "";
  return `Seen ${when}${months}${moon}, ${where}.`;
}

/** A northern-hemisphere month moved to the matching southern one. */
export function shiftMonth(m) {
  return ((m + 5) % 12) + 1;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function seasonWords(months) {
  return `${MONTHS[months[0] - 1]} to ${MONTHS[months[months.length - 1] - 1]}`;
}
