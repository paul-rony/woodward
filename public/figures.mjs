// Ink drawings of every Bestiary entry, from the parameters in bestiary.mjs. Each figure is drawn facing right with
// its feet at (0, 0); the caller places, scales and flips it. Glows reference gradients defined by the scene (DEFS).
import { INK, PIGMENT, blob, line, shape, star } from "./ink.mjs";

export const DEFS = `
<radialGradient id="glowWarm"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".45" stop-color="#ff9a3c" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
<radialGradient id="glowCold"><stop offset="0" stop-color="#d8fff0" stop-opacity=".95"/><stop offset=".4" stop-color="#8ef0c0" stop-opacity=".35"/><stop offset="1" stop-color="#8ef0c0" stop-opacity="0"/></radialGradient>
<radialGradient id="glowGold"><stop offset="0" stop-color="#fff6d0" stop-opacity=".95"/><stop offset=".5" stop-color="#f0d47a" stop-opacity=".3"/><stop offset="1" stop-color="#f0d47a" stop-opacity="0"/></radialGradient>
<radialGradient id="glowHart"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff4c0" stop-opacity=".35"/><stop offset="1" stop-color="#fff4c0" stop-opacity="0"/></radialGradient>
<radialGradient id="lightHole"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
`;

const SKIN = "#e9c9a0";
const WHITE = "#f7f1e1";

export function glow(cx, cy, r, id = "glowWarm", cls = "") {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"${cls ? ` class="${cls}"` : ""}/>`;
}

/** Draws an entry's figure at (x, y), scale s. key keeps its wobble stable; night lights eyes and torches. */
export function drawEntry(e, x, y, s = 1, { flip = false, key = e.id, night = false } = {}) {
  const a = e.art;
  const body = { quad, bird, folk, herb, light }[a.shape](a, key, night);
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${body}</g>`;
}

function quad(a, key, night) {
  const sz = a.size ?? 1;
  const L = (a.legs === "long" ? 21 : 10) * sz;
  const bw = 22 * sz, bh = 9 * sz;
  const by = -L - bh * 0.55;
  let out = "";
  if (a.glow) out += glow(0, by - 6, 70 * sz, "glowHart", "pulse");
  // tail first, so the body covers its root
  if (a.tail === "bushy") out += shape(`${key}-tail`, [[-bw * 0.85, by - 3], [-bw - 16 * sz, by + 1], [-bw - 22 * sz, by + 9 * sz], [-bw - 8 * sz, by + 6]], a.color, { w: 1.3 }) + blob(`${key}-tip`, -bw - 20 * sz, by + 8 * sz, 3 * sz, 2.5 * sz, WHITE, { w: 1 });
  else if (a.tail === "long") out += line(`${key}-tail`, [[-bw * 0.9, by], [-bw - 12 * sz, by + 5], [-bw - 20 * sz, by + 3]], { w: 3 * sz, stroke: a.color }) + line(`${key}-tailo`, [[-bw * 0.9, by], [-bw - 12 * sz, by + 5], [-bw - 20 * sz, by + 3]], { w: 1 });
  else if (a.tail === "short") out += line(`${key}-tail`, [[-bw * 0.95, by - 3], [-bw - 5 * sz, by - 6]], { w: 1.4 });
  for (const [i, lx] of [-bw * 0.65, -bw * 0.42, bw * 0.42, bw * 0.65].entries()) {
    out += line(`${key}-leg${i}`, [[lx, by + bh * 0.5], [lx + (i % 2 ? 2 : -1) * sz, by + bh * 0.5 + L * 0.55], [lx + (i % 2 ? 1 : 0) * sz, 0]], { w: Math.max(1.4, 2.6 * sz), stroke: INK });
  }
  out += blob(`${key}-body`, 0, by, bw, bh, a.color, { w: 1.5 });
  if (a.spines) for (let i = -3; i <= 3; i++) out += line(`${key}-sp${i}`, [[i * 5 * sz, by - bh * 0.6], [i * 5 * sz - 3 * sz, by - bh - 5 * sz]], { w: 1 });
  // neck and head
  const tall = a.legs === "long" && sz >= 1;
  const hx = bw * 1.02, hy = tall ? by - bh * 2.3 : by - bh * 0.9;
  const hr = 6.5 * sz;
  if (tall) out += shape(`${key}-neck`, [[bw * 0.45, by - bh * 0.6], [hx - 2, hy + 2], [hx + 4, hy + 5], [bw * 0.85, by + 2]], a.color, { w: 1.3 });
  if (a.ears === "long") {
    out += blob(`${key}-ear1`, hx - 2, hy - hr - 8 * sz, 2.2 * sz, 9 * sz, a.color, { w: 1.1 });
    out += blob(`${key}-ear2`, hx + 2, hy - hr - 7 * sz, 2.2 * sz, 8.5 * sz, a.color, { w: 1.1 });
  } else if (a.ears === "point") {
    out += shape(`${key}-ear`, [[hx - 4 * sz, hy - hr + 2], [hx - 2 * sz, hy - hr - 6 * sz], [hx + 1 * sz, hy - hr + 1]], a.color, { w: 1.1, step: 30 });
  } else if (a.ears === "round") {
    out += blob(`${key}-ear`, hx - 3 * sz, hy - hr + 1, 2.6 * sz, 2.6 * sz, a.color, { w: 1 });
  }
  if (a.antlers) {
    const bx = hx - 1, byy = hy - hr + 1;
    out += line(`${key}-ant1`, [[bx, byy], [bx - 6 * sz, byy - 12 * sz], [bx - 12 * sz, byy - 22 * sz]], { w: 1.6 });
    out += line(`${key}-ant2`, [[bx - 6 * sz, byy - 12 * sz], [bx + 2 * sz, byy - 18 * sz]], { w: 1.3 });
    out += line(`${key}-ant3`, [[bx - 9 * sz, byy - 17 * sz], [bx - 16 * sz, byy - 15 * sz]], { w: 1.2 });
    out += line(`${key}-ant4`, [[bx + 3, byy], [bx + 6 * sz, byy - 13 * sz], [bx + 4 * sz, byy - 21 * sz]], { w: 1.4 });
  }
  out += blob(`${key}-head`, hx, hy, hr, hr * 0.85, a.color, { w: 1.4 });
  out += shape(`${key}-snout`, [[hx + hr * 0.5, hy - hr * 0.45], [hx + hr + 7 * sz, hy + 1], [hx + hr * 0.4, hy + hr * 0.6]], a.color, { w: 1.3, step: 40 });
  if (a.stripe) out += line(`${key}-stripe`, [[hx - hr * 0.6, hy - hr * 0.7], [hx + hr + 4 * sz, hy]], { w: 2.4 * sz, stroke: WHITE });
  if (a.tusks) out += line(`${key}-tusk`, [[hx + hr + 2 * sz, hy + 3], [hx + hr + 5 * sz, hy - 2 * sz]], { w: 1.6, stroke: WHITE });
  if (a.eyes && night) out += glow(hx + 2, hy - 2, 8, "glowGold") + `<circle cx="${hx + 2}" cy="${hy - 2}" r="1.8" fill="#ffe36a"/>`;
  else out += `<circle cx="${hx + 2}" cy="${hy - 1.5}" r="${Math.max(1, 1.2 * sz)}" fill="${INK}"/>`;
  return out;
}

function bird(a, key) {
  const sz = a.size ?? 1;
  const n = a.count ?? 1;
  let out = "";
  for (let i = 0; i < n; i++) {
    const k = `${key}-${i}`;
    const ox = -i * 20 * sz, oy = a.pose === "fly" ? -i * 9 * sz : 0;
    out += `<g transform="translate(${ox} ${oy})">`;
    if (a.pose === "fly") {
      const y = -30 * sz;
      out += line(`${k}-w1`, [[-14 * sz, y - 9 * sz], [-6 * sz, y - 2], [0, y]], { w: 2 * sz + 0.6, stroke: a.color });
      out += line(`${k}-w2`, [[0, y], [7 * sz, y - 3], [15 * sz, y - 10 * sz]], { w: 2 * sz + 0.6, stroke: a.color });
      out += blob(`${k}-b`, 0, y + 1, 5 * sz, 2.6 * sz, a.color, { w: 1.1 });
      out += line(`${k}-wo`, [[-14 * sz, y - 9 * sz], [-6 * sz, y - 2], [0, y], [7 * sz, y - 3], [15 * sz, y - 10 * sz]], { w: 1 });
      if (a.face === "owl") out += blob(`${k}-f`, 5 * sz, y - 1, 2.8 * sz, 2.8 * sz, WHITE, { w: 0.8 });
      if (a.bill === "long") out += line(`${k}-bill`, [[5 * sz, y + 1], [12 * sz, y + 3]], { w: 1 });
    } else if (a.pose === "perch") {
      out += line(`${k}-branch`, [[-14 * sz, 0], [14 * sz, -2]], { w: 2.4, stroke: PIGMENT.bark });
      out += blob(`${k}-b`, 0, -11 * sz, 6.5 * sz, 10 * sz, a.color, { w: 1.3 });
      if (a.face === "owl") {
        out += blob(`${k}-f`, 1, -15 * sz, 5 * sz, 4.5 * sz, mixFace(a.color), { w: 1 });
        out += `<circle cx="${-1 * sz}" cy="${-15.5 * sz}" r="${1.2 * sz}" fill="${INK}"/><circle cx="${3.2 * sz}" cy="${-15.5 * sz}" r="${1.2 * sz}" fill="${INK}"/>`;
      } else {
        out += blob(`${k}-h`, 4 * sz, -20 * sz, 3.6 * sz, 3.2 * sz, a.color, { w: 1.1 });
        out += line(`${k}-beak`, [[7 * sz, -20 * sz], [10 * sz, -19 * sz]], { w: 1 });
      }
      if (a.song) for (const [j, dx] of [12, 19].entries()) out += line(`${k}-n${j}`, [[dx * sz, -26 * sz - j * 5], [dx * sz + 3, -30 * sz - j * 5], [dx * sz + 6, -27 * sz - j * 5]], { w: 0.9, stroke: PIGMENT.vermilion });
    } else {
      const L = (a.legs === "long" ? 20 : 6) * sz;
      out += line(`${k}-l1`, [[-1, -L], [-2, 0]], { w: 1 });
      out += line(`${k}-l2`, [[3, -L], [4, 0]], { w: 1 });
      out += blob(`${k}-b`, 0, -L - 6 * sz, 11 * sz, 6 * sz, a.color, { w: 1.3 });
      const hx = 9 * sz, hy = a.neck === "long" ? -L - 26 * sz : -L - 12 * sz;
      if (a.neck === "long") out += line(`${k}-neck`, [[7 * sz, -L - 8 * sz], [12 * sz, -L - 16 * sz], [hx, hy]], { w: 2.2 * sz + 0.5, stroke: a.color }) + line(`${k}-necko`, [[7 * sz, -L - 8 * sz], [12 * sz, -L - 16 * sz], [hx, hy]], { w: 0.8 });
      out += blob(`${k}-h`, hx, hy, 3.4 * sz, 3 * sz, a.color, { w: 1.1 });
      out += line(`${k}-beak`, [[hx + 3 * sz, hy], [hx + 12 * sz, hy + 1.5 * sz]], { w: 1.2, stroke: PIGMENT.ochre });
      out += `<circle cx="${hx + 1}" cy="${hy - 0.8}" r="0.9" fill="${INK}"/>`;
    }
    out += "</g>";
  }
  return out;
}

function mixFace(c) {
  return c === "#e7d3a8" ? WHITE : "#d9b98a";
}

function folk(a, key, night) {
  const n = a.count ?? 1;
  let out = "";
  if (a.smoke) {
    out += shape(`${key}-clamp`, [[-38, 0], [-30, -12], [-14, -14], [-6, 0]], "#5a4a3a", { w: 1.3 });
    out += line(`${key}-smoke`, [[-22, -15], [-26, -30], [-18, -44], [-24, -60]], { w: 3, stroke: "#9a948a", cls: "drift", extra: 'opacity=".7"' });
  }
  if (a.horse) {
    out += quad({ color: "#7a5236", size: 1.15, legs: "long", ears: "point", tail: "short" }, `${key}-horse`, night);
  }
  for (let i = 0; i < n; i++) {
    const k = `${key}-${i}`;
    const ox = -i * 15;
    const oy = a.horse ? -34 : 0;
    out += `<g transform="translate(${ox} ${oy})">`;
    if (!a.horse) {
      out += line(`${k}-l1`, [[-3, -11], [-4, 0]], { w: 1.6 });
      out += line(`${k}-l2`, [[3, -11], [4, 0]], { w: 1.6 });
    }
    if (a.pack) out += shape(`${k}-pack`, [[-11, -26], [-4, -27], [-4, -13], [-12, -14]], PIGMENT.ochre, { w: 1.2, step: 30 });
    out += shape(`${k}-tunic`, [[-8, -9], [8, -9], [5, -26], [-5, -26]], a.color, { w: 1.3, step: 20 });
    out += blob(`${k}-head`, 0, -31, 4.6, 5, SKIN, { w: 1.2 });
    if (a.hood) out += shape(`${k}-hood`, [[-6, -28], [-5, -36], [0, -39], [5, -36], [6, -28], [3, -33], [-3, -33]], a.hoodColor ?? a.color, { w: 1.2, step: 30 });
    if (a.hat) {
      out += blob(`${k}-brim`, 0, -35, 9, 2.2, a.color === "#5a5f70" ? "#4a4030" : "#5a4026", { w: 1.1 });
      out += blob(`${k}-crown`, 0, -38, 4.5, 3.2, a.color === "#5a5f70" ? "#4a4030" : "#5a4026", { w: 1.1 });
      if (a.shell) out += blob(`${k}-shell`, 3, -38, 2.2, 2, WHITE, { w: 0.8 });
    }
    if (a.staff) out += line(`${k}-staff`, [[9, 0], [10, -22], [11, -42]], { w: 1.6, stroke: PIGMENT.bark });
    if (a.torch) {
      out += line(`${k}-torch`, [[7, -18], [11, -34]], { w: 1.8, stroke: PIGMENT.bark });
      if (night) out += glow(11, -38, 28, "glowWarm", "flicker");
      out += shape(`${k}-flame`, [[9, -35], [11.5, -44], [14, -35]], "#f2992e", { w: 0.8, step: 30 });
    }
    if (a.lantern) {
      if (night) out += glow(12, -16, 22, "glowWarm", "flicker");
      out += line(`${k}-lh`, [[8, -20], [12, -20]], { w: 1 });
      out += shape(`${k}-lantern`, [[10, -20], [14, -20], [14, -12], [10, -12]], "#f6d27a", { w: 1, step: 30 });
    }
    out += "</g>";
  }
  return out;
}

function herb(a, key) {
  let out = "";
  const stems = a.flower === "mushroom" || a.flower === "bee" || a.flower === "acorn" ? 1 : 3;
  for (let i = 0; i < stems; i++) {
    const k = `${key}-${i}`;
    const ox = (i - (stems - 1) / 2) * 8;
    const h = (a.tall ? 30 : 18) + (i % 2) * 5;
    const fl = a.flower;
    if (fl === "mushroom") {
      out += shape(`${k}-stalk`, [[-3, 0], [3, 0], [2.5, -12], [-2.5, -12]], WHITE, { w: 1.1, step: 30 });
      out += shape(`${k}-cap`, [[-11, -11], [0, -22], [11, -11]], a.color, { w: 1.3, step: 6 });
      for (const [dx, dy] of [[-5, -14], [2, -17], [5, -13]]) out += `<circle cx="${dx}" cy="${dy}" r="1.3" fill="${WHITE}"/>`;
      continue;
    }
    if (fl === "bee") {
      out += blob(`${k}-w1`, -2, -18, 5, 3, "#eef4fa", { w: 0.8, extra: 'opacity=".85"' });
      out += blob(`${k}-w2`, 3, -19, 5, 3, "#eef4fa", { w: 0.8, extra: 'opacity=".85"' });
      out += blob(`${k}-body`, 0, -12, 8, 4.5, a.color, { w: 1.2 });
      out += line(`${k}-s1`, [[-2, -16], [-2, -8]], { w: 1.4 }) + line(`${k}-s2`, [[2.5, -16], [2.5, -8]], { w: 1.4 });
      continue;
    }
    if (fl === "acorn") {
      out += shape(`${k}-leaf`, [[0, 0], [-8, -8], [-6, -14], [-10, -20], [-3, -24], [-4, -30], [0, -34], [4, -30], [3, -24], [10, -20], [6, -14], [8, -8]], PIGMENT.leaf, { w: 1.1, step: 40 });
      out += blob(`${k}-nut`, 10, -6, 3.5, 5, PIGMENT.ochre, { w: 1 }) + blob(`${k}-cup`, 10, -10, 4, 2.4, PIGMENT.bark, { w: 1 });
      continue;
    }
    out += line(`${k}-stem`, [[ox, 0], [ox + 2, -h * 0.5], [ox + (fl === "bell" ? 5 : 1), -h]], { w: 1.1, stroke: PIGMENT.leafDark });
    if (fl !== "catkin" && fl !== "fern") out += shape(`${k}-leaf`, [[ox, -4], [ox - 7, -9], [ox - 1, -8]], PIGMENT.leaf, { w: 0.9, step: 30 });
    if (fl === "bell") for (let j = 0; j < 3; j++) out += blob(`${k}-b${j}`, ox + 5 - j * 1.5, -h + 4 + j * 5, 2.2, 3.2, a.color, { w: 0.9 });
    else if (fl === "cluster") for (let j = 0; j < 5; j++) out += `<circle cx="${ox - 3 + (j % 3) * 3}" cy="${-h - 2 + Math.floor(j / 3) * 3}" r="2" fill="${a.color}" stroke="${INK}" stroke-width=".6"/>`;
    else if (fl === "berry") for (let j = 0; j < 3; j++) out += `<circle cx="${ox - 2 + j * 2.5}" cy="${-h + j * 2}" r="2.2" fill="${a.color}" stroke="${INK}" stroke-width=".7"/>`;
    else if (fl === "catkin") for (let j = 0; j < 2; j++) out += line(`${k}-c${j}`, [[ox + j * 4, -h], [ox + j * 4 + 1, -h + 9]], { w: 2.4, stroke: "#d8c050" });
    else if (fl === "fern") for (let j = 0; j < 4; j++) out += blob(`${k}-f${j}`, ox + (j % 2 ? 4 : -4), -h * 0.35 - j * 5, 3.4, 2.2, a.color, { w: 0.8 });
  }
  return out;
}

function light(a, key) {
  if (a.kind === "wisp") {
    return glow(0, -18, 30, "glowCold", "pulse") + line(`${key}-tail`, [[0, -18], [-8, -12], [-14, -16]], { w: 2, stroke: a.color, extra: 'opacity=".7"' }) + `<circle cx="0" cy="-18" r="3.5" fill="#f2fff8"/>`;
  }
  if (a.kind === "star") {
    return line(`${key}-streak`, [[-60, -22], [-30, -12], [0, 0]], { w: 2, stroke: a.color, extra: 'opacity=".8"' }) + glow(0, 0, 22, "glowGold", "pulse") + star(0, 0, 6, PIGMENT.goldLight, { points: 4 });
  }
  // The Wild Hunt: riders and hounds against the clouds.
  let out = glow(0, -10, 60, "glowCold", "pulse");
  for (let i = 0; i < 3; i++) out += `<g transform="translate(${-i * 26} ${-i * 6}) scale(.55)">${quad({ color: "#1d1a2a", size: 1.1, legs: "long", ears: "point", tail: "bushy" }, `${key}-h${i}`, true)}${blob(`${key}-r${i}`, 22, -44, 5, 9, "#1d1a2a", { w: 1 })}</g>`;
  for (let i = 0; i < 2; i++) out += `<g transform="translate(${30 + i * 16} ${4}) scale(.4)">${quad({ color: "#1d1a2a", size: 0.9, legs: "long", ears: "point", tail: "short", eyes: true }, `${key}-d${i}`, true)}</g>`;
  return out;
}
