// The two illustrations on the left page: the clearing around the lodge, and the countryside from the top of the
// tower. Both are 800 x 600 SVG, redrawn from each snapshot; night is an indigo wash with holes where light falls.
import { ENTRY } from "./bestiary.mjs";
import { DEFS, drawEntry, glow } from "./figures.mjs";
import { INK, PIGMENT, blob, hatch, line, mix, pen, shape, star } from "./ink.mjs";

const W = 800, H = 600;

export const POS = {
  oak: [640, 372], hazel1: [470, 410], hazel2: [545, 462], bramble: [700, 490], ring: [420, 530], moonwort: [735, 560],
  skep: [345, 452], cot: [88, 470], kennel: [265, 470], brazier: [395, 452], cross: [590, 560], tower: [205, 380], house: [295, 395],
};

// ---- Sky -------------------------------------------------------------------------------------------------------

const SKY = [
  [-18, "#0b1030", "#1a2150"], [-10, "#1f2357", "#4b3b6e"], [-3, "#3b3f7e", "#d9805e"],
  [3, "#6d8fc8", "#f2c68c"], [12, "#7fa6d8", "#eadcb6"], [40, "#6f9fd6", "#efe3c0"],
];

function skyColors(el) {
  if (el <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++) {
    if (el <= SKY[i][0]) {
      const [e0, t0, b0] = SKY[i - 1], [e1, t1, b1] = SKY[i];
      const t = (el - e0) / (e1 - e0);
      return [mix(t0, t1, t), mix(b0, b1, t)];
    }
  }
  return [SKY.at(-1)[1], SKY.at(-1)[2]];
}

/** Where a sun or moon sits on the page: facing the equator, so east is left in the north and right in the south. */
function bodyXY(pos, horizon, south) {
  const dAz = south ? ((pos.azimuth + 180) % 360) - 180 : pos.azimuth - 180;
  return [400 + (dAz / 110) * 380, horizon - (pos.elevation / 75) * (horizon - 40)];
}

const STARS = (() => {
  const p = pen("stars", true);
  return Array.from({ length: 60 }, () => [p.r() * W, p.r() * 300, 1 + p.r() * 2.2, p.r() * 4]);
})();

function sky(env, horizon, south) {
  const [top, bottom] = skyColors(env.sun.elevation);
  let out = `<defs><linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`;
  out += `<rect x="0" y="0" width="${W}" height="${horizon + 60}" fill="url(#skyGrad)"/>`;
  const starAlpha = Math.max(0, Math.min(1, (-env.sun.elevation - 4) / 10));
  if (starAlpha > 0) {
    out += `<g opacity="${starAlpha.toFixed(2)}">`;
    for (const [x, y, r, d] of STARS) if (y < horizon - 10) out += `<g class="twinkle" style="animation-delay:-${d.toFixed(1)}s">${star(x, y, r + 1, PIGMENT.goldLight, { points: 4, w: 0.4 })}</g>`;
    out += "</g>";
  }
  // The moon, with its real phase.
  if (env.moon.elevation > -5) {
    const [mx, my] = bodyXY(env.moon, horizon, south);
    out += moonDisc(mx, my, 20, env.moon.phase, south);
  }
  if (env.sun.elevation > -6) {
    const [sx, sy] = bodyXY(env.sun, horizon, south);
    out += sunDisc(sx, sy, 26);
  }
  return out;
}

function sunDisc(x, y, r) {
  let out = glow(x, y, r * 3.2, "glowGold");
  const p = pen("sunrays", true);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const r2 = r + 12 + p.r() * 6;
    out += shape(`ray${i}`, [[x + Math.cos(t - 0.12) * (r - 2), y + Math.sin(t - 0.12) * (r - 2)], [x + Math.cos(t) * r2, y + Math.sin(t) * r2], [x + Math.cos(t + 0.12) * (r - 2), y + Math.sin(t + 0.12) * (r - 2)]], PIGMENT.gold, { w: 1, step: 40 });
  }
  out += blob("sun", x, y, r, r, PIGMENT.gold, { w: 1.6 });
  out += `<circle cx="${x - 5}" cy="${y - 7}" r="${r * 0.55}" fill="${PIGMENT.goldLight}" opacity=".5"/>`;
  // A face, as manuscript suns have.
  out += `<circle cx="${x - 8}" cy="${y - 4}" r="1.8" fill="${INK}"/><circle cx="${x + 8}" cy="${y - 4}" r="1.8" fill="${INK}"/>`;
  out += line("sunsmile", [[x - 8, y + 7], [x, y + 11], [x + 8, y + 7]], { w: 1.3 });
  return out;
}

function moonDisc(x, y, r, phase, south) {
  const waxing = phase < 0.5;
  const k = Math.cos(2 * Math.PI * phase);
  // In the south the moon is seen upside down: the lit side swaps.
  const litRight = south ? !waxing : waxing;
  const sweepLit = litRight ? 1 : 0;
  const rx = Math.abs(k) * r;
  const termSweep = (litRight ? k > 0 : k < 0) ? 0 : 1;
  let out = glow(x, y, r * 2.6, "glowCold");
  out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#3a4170" opacity=".55"/>`;
  out += `<path d="M${x},${y - r} A${r},${r} 0 0 ${sweepLit} ${x},${y + r} A${rx.toFixed(2)},${r} 0 0 ${termSweep} ${x},${y - r}Z" fill="${PIGMENT.silver}"/>`;
  out += blob("moonrim", x, y, r, r, "none", { w: 1.2, still: true });
  return out;
}

// ---- Night -----------------------------------------------------------------------------------------------------

/** The dark wash over the page, with holes where light falls. lights: [x, y, r]. */
function night(env, lights) {
  const dark = 1 - env.light;
  if (dark < 0.05) return "";
  let mask = `<mask id="nightMask"><rect width="${W}" height="${H}" fill="#fff"/>`;
  for (const [x, y, r] of lights) mask += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#lightHole)"/>`;
  mask += "</mask>";
  return `<defs>${mask}</defs><rect width="${W}" height="${H}" fill="#0d1240" opacity="${(0.62 * dark).toFixed(2)}" mask="url(#nightMask)"/>`;
}

// ---- The clearing ----------------------------------------------------------------------------------------------

function hills(y, color, key, amp, step) {
  const p = pen(key, true);
  const pts = [[-20, H]];
  for (let x = -20; x <= W + 20; x += step) pts.push([x, y - Math.sin(x / 140 + p.r()) * amp - p.r() * amp * 0.4]);
  pts.push([W + 20, H]);
  return shape(key, pts, color, { w: 1.4, step: 40, still: true });
}

function treeRow(y, n, key, color, scale = 1) {
  let out = "";
  const p = pen(key, true);
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (W / n) + p.j(12);
    const h = (26 + p.r() * 14) * scale;
    out += line(`${key}t${i}`, [[x, y], [x, y - h * 0.5]], { w: 2 * scale, stroke: PIGMENT.bark, still: true });
    out += blob(`${key}c${i}`, x, y - h * 0.75, h * 0.42, h * 0.5, color, { w: 1.2, still: true });
  }
  return out;
}

function tower(snap) {
  let out = "";
  const x0 = 168, x1 = 242, top = 120, base = 382;
  out += shape("tower", [[x0, base], [x0 + 3, top], [x1 - 3, top], [x1, base]], "#b7ad9c", { sharp: true, w: 1.8, step: 26 });
  for (let i = 0; i < 4; i++) out += shape(`merlon${i}`, [[x0 - 4 + i * 21, top], [x0 - 4 + i * 21, top - 16], [x0 + 10 + i * 21, top - 16], [x0 + 10 + i * 21, top]], "#b7ad9c", { sharp: true, w: 1.6, step: 30 });
  const p = pen("towerstones", true);
  for (let i = 0; i < 26; i++) out += blob(`stone${i}`, x0 + 8 + p.r() * (x1 - x0 - 16), top + 12 + p.r() * (base - top - 30), 5 + p.r() * 3, 3, "none", { w: 0.7, still: true, extra: 'opacity=".5"' });
  for (const y of [170, 245]) out += shape(`slit${y}`, [[203, y], [203, y + 22], [208, y + 22], [208, y]], snap.env.light < 0.4 ? "#ffcf6e" : "#2a2420", { sharp: true, w: 1, step: 30 });
  out += hatch("towershade", x1 - 22, top + 10, 18, base - top - 14, { gap: 5, opacity: 0.25 });
  if (snap.built.beacon) {
    out += line("beaconpost", [[226, top - 16], [226, top - 32]], { w: 1.6 });
    out += shape("beacon", [[220, top - 44], [232, top - 44], [232, top - 32], [220, top - 32]], snap.env.light < 0.6 ? "#ffd36e" : "#d9c49a", { sharp: true, w: 1.2, step: 30 });
  }
  if (snap.wat.onWatch) out += `<g transform="translate(192 ${top}) scale(.7)">${watFigure("watch")}</g>`;
  return out;
}

function house(snap) {
  let out = "";
  out += shape("housewall", [[240, 382], [242, 304], [350, 304], [352, 382]], "#efe4c9", { sharp: true, w: 1.7, step: 24 });
  for (const x of [262, 300, 330]) out += line(`beam${x}`, [[x, 306], [x, 380]], { w: 3, stroke: PIGMENT.bark });
  out += line("beamh", [[242, 340], [350, 340]], { w: 3, stroke: PIGMENT.bark });
  out += line("brace", [[262, 340], [300, 306]], { w: 2.4, stroke: PIGMENT.bark });
  out += shape("door", [[281, 382], [281, 352], [291, 346], [299, 352], [299, 382]], "#5b3c22", { w: 1.4, step: 20 });
  const lit = snap.env.light < 0.55;
  out += shape("window", [[312, 316], [326, 316], [326, 332], [312, 332]], lit ? "#ffcf6e" : "#3a3028", { sharp: true, w: 1.3, step: 30 });
  out += line("windowx", [[319, 316], [319, 332]], { w: 1 });
  out += shape("chimney", [[322, 262], [322, 240], [336, 240], [336, 276]], "#a8977f", { sharp: true, w: 1.4, step: 30 });
  out += shape("thatch", [[230, 310], [252, 266], [292, 236], [336, 262], [362, 310]], PIGMENT.straw, { w: 1.8, step: 18 });
  out += hatch("thatchlines", 244, 250, 106, 56, { gap: 7, opacity: 0.35, slant: -0.2 });
  if (snap.env.sun.elevation > -3) out += line("smoke", [[329, 236], [324, 218], [334, 200], [326, 180]], { w: 3, stroke: "#a39d94", cls: "drift", extra: 'opacity=".6"' });
  return out;
}

function oak(n) {
  const [x, y] = POS.oak;
  const g = n.growth;
  let out = shape("oaktrunk", [[x - 14, y], [x - 9, y - 70], [x - 22, y - 96], [x - 4, y - 80], [x + 2, y - 104], [x + 8, y - 78], [x + 22, y - 92], [x + 10, y - 66], [x + 14, y]], PIGMENT.bark, { w: 1.6, step: 18 });
  const r = 34 + 40 * g;
  const c = g >= 1 ? PIGMENT.leaf : mix("#9aae6a", PIGMENT.leaf, g);
  for (const [i, [dx, dy, s]] of [[-34, -100, 0.8], [30, -104, 0.85], [0, -128, 1], [-14, -86, 0.7], [20, -84, 0.7]].entries()) {
    out += blob(`oakc${i}`, x + dx * (0.5 + g / 2), y + dy * (0.75 + g / 4), r * s * 0.62, r * s * 0.5, c, { w: 1.4 });
  }
  if (g >= 1) for (let i = 0; i < 6; i++) out += blob(`acorn${i}`, x - 40 + i * 16, y - 92 - (i % 2) * 22, 2.4, 3.2, PIGMENT.ochre, { w: 0.8 });
  return out;
}

function hazel(id, n) {
  const [x, y] = POS[id];
  const g = n.growth;
  let out = blob(`${id}stool`, x, y, 18, 5, PIGMENT.bark, { w: 1.3 });
  const stems = 2 + Math.round(g * 6);
  for (let i = 0; i < stems; i++) {
    const dx = (i - (stems - 1) / 2) * 5;
    const h = 14 + g * 58 * (0.8 + ((i * 37) % 10) / 40);
    out += line(`${id}s${i}`, [[x + dx * 0.6, y - 2], [x + dx * 1.4, y - h]], { w: 1.6, stroke: "#7a5a32" });
    if (g > 0.3) out += blob(`${id}l${i}`, x + dx * 1.5, y - h, 5 + g * 4, 4 + g * 3, PIGMENT.leaf, { w: 1 });
  }
  return out;
}

function bramble(n) {
  const [x, y] = POS.bramble;
  let out = "";
  for (let i = 0; i < 5; i++) out += line(`brm${i}`, [[x - 26 + i * 12, y], [x - 30 + i * 14, y - 24 - (i % 2) * 8], [x - 20 + i * 12, y - 30]], { w: 1.8, stroke: "#5a3a3a" });
  out += blob("bramblebush", x, y - 16, 32, 16, PIGMENT.leafDark, { w: 1.4 });
  const berries = Math.round(n.growth * 9);
  for (let i = 0; i < berries; i++) out += `<circle cx="${x - 24 + ((i * 19) % 48)}" cy="${y - 22 + ((i * 7) % 14)}" r="2.8" fill="${n.ready ? "#3a1f4a" : "#b8486a"}" stroke="${INK}" stroke-width=".7"/>`;
  return out;
}

function ring(n) {
  const [x, y] = POS.ring;
  let out = blob("ringgrass", x, y, 46, 12, "none", { w: 1, extra: 'stroke-dasharray="3 5" opacity=".5"' });
  const count = Math.round(n.growth * 9);
  for (let i = 0; i < count; i++) {
    const t = (i / 9) * Math.PI * 2;
    const mx = x + Math.cos(t) * 42, my = y + Math.sin(t) * 11;
    out += `<g transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) scale(.55)">${drawEntry(ENTRY.flyagaric, 0, 0, 1, { key: `ring${i}` })}</g>`;
  }
  return out;
}

function moonwort(n) {
  const [x, y] = POS.moonwort;
  const e = ENTRY.moonwort;
  const open = n.stage === "bloom";
  return (open ? glow(x, y - 12, 34, "glowCold", "pulse") : "") + `<g transform="translate(${x} ${y}) scale(${open ? 1.2 : 0.8})"${open ? "" : ' opacity=".7"'}>${drawEntry({ ...e, art: { ...e.art, color: open ? "#e8f0ff" : "#9aa58a" } }, 0, 0, 1)}</g>`;
}

function skep(n) {
  const [x, y] = POS.skep;
  let out = blob("skepstand", x, y, 20, 4, PIGMENT.bark, { w: 1.2 });
  out += shape("skep", [[x - 18, y - 2], [x - 16, y - 22], [x, y - 34], [x + 16, y - 22], [x + 18, y - 2]], PIGMENT.straw, { w: 1.5, step: 10 });
  for (let i = 1; i < 4; i++) out += line(`skepband${i}`, [[x - 17 + i, y - i * 8], [x + 17 - i, y - i * 8]], { w: 1, extra: 'opacity=".6"' });
  out += blob("skepdoor", x, y - 5, 4, 3, "#2a1d12", { w: 0.8 });
  if (n.growth >= 1) out += line("honey", [[x + 12, y - 12], [x + 13, y - 4]], { w: 3, stroke: PIGMENT.gold });
  return out;
}

function cot() {
  const [x, y] = POS.cot;
  return shape("cotwall", [[x - 30, y], [x - 28, y - 30], [x + 28, y - 30], [x + 30, y]], "#e2d4b2", { sharp: true, w: 1.5, step: 20 })
    + shape("cotroof", [[x - 38, y - 26], [x, y - 58], [x + 38, y - 26]], PIGMENT.straw, { w: 1.6, step: 14 })
    + shape("cotdoor", [[x - 6, y], [x - 6, y - 18], [x + 6, y - 18], [x + 6, y]], "#5b3c22", { sharp: true, w: 1.2, step: 30 });
}

function kennel(snap) {
  const [x, y] = POS.kennel;
  let out = shape("kennel", [[x - 16, y], [x - 16, y - 16], [x, y - 28], [x + 16, y - 16], [x + 16, y]], "#8a6a44", { w: 1.4, step: 20 });
  out += blob("kenneldoor", x, y - 7, 6, 7, "#2a1d12", { w: 1 });
  // Bran: lies by the kennel by day, stands guard at night.
  const alert = snap.env.light < 0.4;
  out += `<g transform="translate(${x + 30} ${y + 4}) scale(${alert ? 0.75 : 0.7})">${drawEntry({ art: { shape: "quad", color: "#7a6a5a", size: 0.9, legs: alert ? "long" : "short", ears: "round", tail: "long" } }, 0, 0, 1, { key: "bran" })}</g>`;
  return out;
}

function brazier(snap) {
  const [x, y] = POS.brazier;
  let out = line("brazl1", [[x - 10, y], [x - 6, y - 16]], { w: 1.6 }) + line("brazl2", [[x + 10, y], [x + 6, y - 16]], { w: 1.6 });
  out += shape("brazbowl", [[x - 14, y - 18], [x + 14, y - 18], [x + 8, y - 26], [x - 8, y - 26]], "#3a3430", { w: 1.4, step: 20 });
  out += shape("brazfire", [[x - 8, y - 24], [x - 4, y - 38], [x, y - 30], [x + 4, y - 42], [x + 8, y - 24]], snap.env.light < 0.7 ? "#f2992e" : "#d97a2e", { w: 1, step: 20, cls: "flicker" });
  return out;
}

function cross() {
  const [x, y] = POS.cross;
  return shape("crossbase", [[x - 14, y], [x - 10, y - 10], [x + 10, y - 10], [x + 14, y]], PIGMENT.stone, { sharp: true, w: 1.4, step: 20 })
    + shape("crossv", [[x - 4, y - 10], [x - 4, y - 60], [x + 4, y - 60], [x + 4, y - 10]], "#c9c0ae", { sharp: true, w: 1.4, step: 20 })
    + shape("crossh", [[x - 16, y - 46], [x - 16, y - 40], [x + 16, y - 40], [x + 16, y - 46]], "#c9c0ae", { sharp: true, w: 1.4, step: 20 })
    + star(x, y - 70, 5, PIGMENT.gold, { points: 6 });
}

/** Wat: a small figure in a green tunic and a red hood. */
export function watFigure(key = "wat") {
  return drawEntry({ art: { shape: "folk", color: "#4f7a3a", hood: true, hoodColor: PIGMENT.vermilion } }, 0, 0, 1, { key });
}

function watPos(snap, now) {
  const wat = snap.wat;
  const at = (id) => POS[id] ?? POS.cot;
  if (wat.state !== "walking") return [...at(wat.at)];
  const t = Math.max(0, Math.min(1, (now - wat.departedAt) / (wat.arriveAt - wat.departedAt)));
  const [x0, y0] = at(wat.from), [x1, y1] = at(wat.target);
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 6];
}

function readyMark(x, y) {
  return `<g class="bob">${star(x, y, 7, PIGMENT.gold, { points: 6, w: 0.8 })}</g>`;
}

/** The clearing. now: the server's clock, for Wat's walk. */
export function woodScene(snap, now) {
  const env = snap.env;
  const south = snap.location.lat < 0;
  let out = `<defs>${DEFS}</defs>` + sky(env, 300, south);
  const dim = (c) => mix(c, "#1c2340", (1 - env.light) * 0.25);
  out += hills(300, dim("#9fb08a"), "farhills", 18, 60);
  out += treeRow(330, 18, "backtrees", dim("#5f7f45"), 1);
  out += shape("ground", [[-20, 336], [200, 326], [420, 332], [820, 324], [820, 620], [-20, 620]], dim("#c3c98f"), { w: 1.4, step: 50, still: true });
  out += hatch("groundhatch", 0, 520, W, 70, { gap: 9, opacity: 0.2, slant: 0.2 });
  out += line("path", [[290, 384], [320, 430], [380, 480], [400, 540], [440, 600]], { w: 16, stroke: dim("#d9c79a"), still: true });

  const items = [];
  const add = (y, svg, hit) => items.push({ y, svg, hit });
  add(POS.tower[1], tower(snap) + house(snap));
  for (const [id, n] of Object.entries(snap.nodes)) {
    const draw = { oak: () => oak(n), hazel: () => hazel(id, n), bramble: () => bramble(n), ring: () => ring(n), moonwort: () => moonwort(n), skep: () => skep(n) }[n.kind];
    add(POS[id][1], draw());
  }
  if (snap.built.cot) add(POS.cot[1], cot());
  if (snap.built.kennel) add(POS.kennel[1], kennel(snap));
  if (snap.built.brazier) add(POS.brazier[1], brazier(snap));
  if (snap.built.cross) add(POS.cross[1], cross());
  if (snap.built.cot && snap.wat.awake && !(snap.wat.onWatch && snap.wat.state !== "walking")) {
    const [wx, wy] = watPos(snap, now);
    add(wy, `<g transform="translate(${wx.toFixed(1)} ${wy.toFixed(1)}) scale(.8)">${watFigure()}</g>`);
  }
  items.sort((a, b) => a.y - b.y);
  out += items.map((i) => i.svg).join("");

  // Night: the wash, then the lights and what glows in the dark on top of it.
  const lit = env.light < 0.55;
  const lights = [];
  if (lit) lights.push([319, 324, 60]);
  if (snap.built.beacon && lit) lights.push([226, 82, 90]);
  if (snap.built.brazier) lights.push([POS.brazier[0], POS.brazier[1] - 30, 130]);
  if (snap.nodes.moonwort?.stage === "bloom") lights.push([POS.moonwort[0], POS.moonwort[1] - 12, 50]);
  out += night(env, lights);
  if (lit) out += glow(319, 324, 40, "glowWarm", "flicker");
  if (snap.built.beacon && lit) out += glow(226, 82, 60, "glowWarm", "flicker");
  if (snap.built.brazier && lit) out += glow(POS.brazier[0], POS.brazier[1] - 30, 70, "glowWarm", "flicker");
  if (env.sun.elevation < -6) {
    // Eyes at the wood's edge. Fewer with a hound about.
    const pairs = snap.built.kennel ? 2 : 5;
    const p = pen("wolfeyes", true);
    for (let i = 0; i < pairs; i++) {
      const ex = 40 + p.r() * 720, ey = 318 + p.r() * 18;
      out += `<g class="blink" style="animation-delay:-${(p.r() * 6).toFixed(1)}s"><circle cx="${ex.toFixed(0)}" cy="${ey.toFixed(0)}" r="1.8" fill="#ffe36a"/><circle cx="${(ex + 6).toFixed(0)}" cy="${ey.toFixed(0)}" r="1.8" fill="#ffe36a"/></g>`;
    }
  }
  if (snap.poachers) {
    const p = pen("torches", true);
    for (let i = 0; i < 2; i++) {
      const tx = 520 + p.r() * 220, ty = 318 + p.r() * 10;
      out += glow(tx, ty, 26, "glowWarm", "flicker") + `<circle cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" r="2.5" fill="#ffb347"/>`;
    }
  }

  // Ready marks and click targets, above everything.
  for (const [id, n] of Object.entries(snap.nodes)) if (n.ready) out += readyMark(POS[id][0], POS[id][1] - ({ oak: 190, hazel: 86, bramble: 56, ring: 30, moonwort: 40, skep: 46 }[n.kind] ?? 50));
  for (const [id] of Object.entries(snap.nodes)) {
    const [x, y] = POS[id];
    const r = { oak: 70, bramble: 36, ring: 50 }[snap.nodes[id].kind] ?? 30;
    const cy = snap.nodes[id].kind === "oak" ? y - 90 : y - 18;
    out += `<circle class="hit" data-node="${id}" cx="${x}" cy="${cy}" r="${r}" fill="transparent"/>`;
  }
  out += `<rect class="hit" data-tower="up" x="160" y="96" width="90" height="286" fill="transparent"/>`;
  return out;
}

// ---- From the tower --------------------------------------------------------------------------------------------

function village(env) {
  let out = "";
  const p = pen("village", true);
  for (let i = 0; i < 7; i++) {
    const x = 70 + i * 26 + p.j(5), y = 282 - (i % 3) * 7;
    out += shape(`vh${i}`, [[x - 9, y], [x - 9, y - 11], [x + 9, y - 11], [x + 9, y]], "#e2d4b2", { sharp: true, w: 1, step: 30, still: true });
    out += shape(`vr${i}`, [[x - 12, y - 9], [x, y - 20], [x + 12, y - 9]], i % 2 ? PIGMENT.straw : "#a0583a", { w: 1, step: 30, still: true });
    if (env.light < 0.5 && i % 2 === 0) out += `<rect x="${x - 2}" y="${y - 8}" width="4" height="4" fill="#ffcf6e"/>`;
  }
  // The church, with its spire, and the mill.
  out += shape("church", [[150, 290], [150, 262], [196, 262], [196, 290]], "#d8cfbd", { sharp: true, w: 1.3, step: 20, still: true });
  out += shape("churchroof", [[146, 264], [173, 248], [200, 264]], "#8a5a3a", { w: 1.2, step: 30, still: true });
  out += shape("spire", [[196, 290], [196, 244], [208, 244], [208, 290]], "#d8cfbd", { sharp: true, w: 1.3, step: 20, still: true });
  out += shape("spiretop", [[194, 246], [202, 214], [210, 246]], "#8a5a3a", { w: 1.2, step: 30, still: true });
  out += line("churchcross", [[202, 214], [202, 204]], { w: 1.2, still: true }) + line("churchcrossh", [[198, 208], [206, 208]], { w: 1.2, still: true });
  out += shape("mill", [[226, 294], [229, 266], [241, 266], [244, 294]], "#cbb894", { sharp: true, w: 1.2, step: 30, still: true });
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI * 2 + 0.4;
    out += line(`sail${i}`, [[235, 268], [235 + Math.cos(t) * 20, 268 + Math.sin(t) * 20]], { w: 2.2, still: true });
  }
  return out;
}

function fields(dim) {
  let out = "";
  const colors = ["#d8c27a", "#b6c27a", "#cdb46a", "#a9b872"];
  for (let i = 0; i < 6; i++) {
    const x0 = 420 + i * 64, x1 = x0 + 64;
    out += shape(`field${i}`, [[x0, 296], [x1, 292], [x1 + 18, 348], [x0 + 18, 350]], dim(colors[i % 4]), { sharp: true, w: 1, step: 40, still: true });
    out += hatch(`furrow${i}`, x0 + 6, 300, 60, 44, { gap: 8, opacity: 0.25, slant: 0.15 });
  }
  return out;
}

function river() {
  const top = [[-20, 352], [120, 358], [260, 348], [420, 360], [580, 350], [820, 358]];
  const bottom = [[820, 388], [580, 380], [420, 392], [260, 380], [120, 390], [-20, 384]];
  let out = shape("river", [...top, ...bottom], "#5a7cb8", { w: 1.4, step: 50, still: true });
  for (let i = 0; i < 9; i++) out += line(`wave${i}`, [[40 + i * 85, 370 + (i % 2) * 6], [52 + i * 85, 366 + (i % 2) * 6], [64 + i * 85, 370 + (i % 2) * 6]], { w: 1, stroke: "#e6eefa" });
  return out;
}

function parapet(snap) {
  let out = shape("parapet", [[-20, 520], [820, 520], [820, 620], [-20, 620]], "#b0a593", { sharp: true, w: 1.8, step: 40, still: true });
  for (let i = 0; i < 4; i++) out += shape(`pm${i}`, [[i * 230 - 10, 520], [i * 230 - 10, 470], [i * 230 + 110, 470], [i * 230 + 110, 520]], "#b7ad9c", { sharp: true, w: 1.8, step: 30, still: true });
  const p = pen("parapetstones", true);
  for (let i = 0; i < 30; i++) out += blob(`ps${i}`, p.r() * W, 488 + p.r() * 100, 12 + p.r() * 8, 6, "none", { w: 0.8, still: true, extra: 'opacity=".45"' });
  if (snap.built.beacon) {
    out += shape("tlantern", [[680, 470], [700, 470], [700, 446], [680, 446]], snap.env.light < 0.6 ? "#ffd36e" : "#d9c49a", { sharp: true, w: 1.3, step: 30 });
    out += shape("tlanternroof", [[676, 448], [690, 436], [704, 448]], "#3a3430", { w: 1.2, step: 30 });
  }
  if (snap.wat.onWatch) out += `<g transform="translate(150 470)">${watFigure("watchview")}</g>`;
  return out;
}

/** The countryside from the top of the tower, with whatever is out there right now. */
export function towerScene(snap) {
  const env = snap.env;
  const south = snap.location.lat < 0;
  const dim = (c) => mix(c, "#1c2340", (1 - env.light) * 0.25);
  let out = `<defs>${DEFS}</defs>` + sky(env, 230, south);
  out += hills(232, dim("#8ea092"), "farrange", 22, 70);
  out += hills(262, dim("#a9b98d"), "nearhills", 10, 90);
  out += village(env);
  out += line("road", [[250, 292], [300, 310], [360, 330], [420, 346], [470, 360]], { w: 9, stroke: dim("#dccb9c"), still: true });
  out += fields(dim);
  out += river();
  out += shape("meadow", [[-20, 392], [820, 384], [820, 620], [-20, 620]], dim("#bfc68b"), { w: 1.2, step: 60, still: true });
  out += treeRow(440, 16, "woodedge", dim("#56783f"), 1.5);

  const lights = [];
  const sightings = [...snap.sightings].sort((a, b) => a.y - b.y);
  const isNight = env.sun.elevation < -6;
  let figs = "", marks = "", hits = "";
  for (const s of sightings) {
    const e = ENTRY[s.entry];
    const sc = e.where === "sky" ? 1.3 : 0.9 + ((s.y - 220) / 240) * 0.9;
    figs += drawEntry(e, s.x, s.y, sc, { flip: s.flip, key: `s${s.id}`, night: isNight });
    if (e.art.shape === "light" || e.art.torch || e.art.lantern || e.art.glow) lights.push([s.x, s.y - 20 * sc, 60 * sc]);
    if (!snap.book[s.entry]) marks += readyMark(s.x, s.y - 60 * sc);
    hits += `<circle class="hit" data-sighting="${s.id}" cx="${s.x}" cy="${s.y - 18 * sc}" r="${Math.max(18, 30 * sc)}" fill="transparent"/>`;
  }
  out += figs;
  if (env.light < 0.5) lights.push([110, 276, 30], [162, 276, 24]);
  if (snap.built.beacon && env.light < 0.6) lights.push([690, 458, 140]);
  out += parapet(snap);
  out += night(env, lights);
  if (snap.built.beacon && env.light < 0.6) out += glow(690, 458, 80, "glowWarm", "flicker");
  // Lights in the dark show through the wash: marvels whole, torches as glows, wolves as eyes.
  if (isNight) {
    for (const s of sightings) {
      const e = ENTRY[s.entry];
      const sc = e.where === "sky" ? 1.3 : 0.9 + ((s.y - 220) / 240) * 0.9;
      const dir = s.flip ? -1 : 1;
      if (e.art.shape === "light") out += drawEntry(e, s.x, s.y, sc, { flip: s.flip, key: `s${s.id}`, night: true });
      else if (e.art.torch || e.art.lantern) out += glow(s.x + dir * 12 * sc, s.y - 34 * sc, 34 * sc, "glowWarm", "flicker");
      else if (e.art.eyes) out += `<g class="blink"><circle cx="${(s.x + dir * 27 * sc).toFixed(1)}" cy="${(s.y - 52 * sc).toFixed(1)}" r="${(2.2 * sc + 0.6).toFixed(1)}" fill="#ffe36a"/></g>`;
    }
  }
  out += marks + hits;
  out += `<rect class="hit" data-tower="down" x="0" y="470" width="${W}" height="130" fill="transparent"/>`;
  return out;
}
