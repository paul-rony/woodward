// The ink pen: every line in the codex is drawn through a seeded wobble, so it looks hand-inked yet stays the same
// drawing on every load. `boil` shifts the seed between a few variants for the gentle line-boil of hand animation.
// Returns SVG markup strings; the page assembles them.

export const INK = "#2a1d12";
export const PIGMENT = {
  vermilion: "#c0392b", lapis: "#2f4f9e", verdigris: "#4f8a6b", ochre: "#c8963e", gold: "#d4a537",
  goldLight: "#f0d47a", leaf: "#6f8f3a", leafDark: "#3f5f2a", bark: "#6b4a2b", stone: "#a69f92", straw: "#d8b45a",
  parchment: "#efe2c2", silver: "#dfe3ea",
};

let boil = 0;
export function setBoil(n) {
  boil = n;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A seeded random source for one drawn thing. `still` ignores the boil, for things that should not shimmer. */
export function pen(key, still = false) {
  const r = mulberry(hash(key) + (still ? 0 : boil * 7919));
  return { r, j: (a = 1) => (r() - 0.5) * 2 * a };
}

const f = (n) => Math.round(n * 10) / 10;

/** Catmull-Rom through points, as cubic Béziers. */
export function smooth(pts, closed) {
  if (pts.length < 2) return "";
  const P = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f(P[1][0])},${f(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

/** Splits each edge so a straight side still wobbles. */
function subdivide(pts, closed, step) {
  const out = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(len / step));
    for (let s = 0; s < k; s++) out.push([a[0] + ((b[0] - a[0]) * s) / k, a[1] + ((b[1] - a[1]) * s) / k]);
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}

function stroke(opts) {
  const s = opts.stroke ?? INK;
  const w = opts.w ?? 1.6;
  const extra = opts.extra ?? "";
  const cls = opts.cls ? ` class="${opts.cls}"` : "";
  return `stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${cls} ${extra}`;
}

/** A wobbly closed shape through `pts`. */
export function shape(key, pts, fill, opts = {}) {
  const p = pen(key, opts.still);
  const a = opts.wobble ?? 1.1;
  if (opts.sharp) {
    // Corners stay corners: jittered straight strokes, for masonry and timber.
    const w = subdivide(pts, true, opts.step ?? 40).map(([x, y]) => [x + p.j(a * 0.8), y + p.j(a * 0.8)]);
    return `<path d="M${w.map(([x, y]) => `${f(x)},${f(y)}`).join("L")}Z" fill="${fill ?? "none"}" ${stroke(opts)}/>`;
  }
  const w = subdivide(pts, true, opts.step ?? 14).map(([x, y]) => [x + p.j(a), y + p.j(a)]);
  return `<path d="${smooth(w, true)}" fill="${fill ?? "none"}" ${stroke(opts)}/>`;
}

/** A wobbly open line through `pts`. */
export function line(key, pts, opts = {}) {
  const p = pen(key, opts.still);
  const a = opts.wobble ?? 0.9;
  const w = subdivide(pts, false, opts.step ?? 12).map(([x, y], i, arr) => (i === 0 || i === arr.length - 1 ? [x + p.j(a * 0.4), y + p.j(a * 0.4)] : [x + p.j(a), y + p.j(a)]));
  return `<path d="${smooth(w, false)}" fill="none" ${stroke(opts)}/>`;
}

/** A wobbly ellipse. */
export function blob(key, cx, cy, rx, ry, fill, opts = {}) {
  const p = pen(key, opts.still);
  const n = opts.n ?? Math.max(8, Math.round((rx + ry) / 4));
  const a = opts.wobble ?? Math.min(1.4, 0.06 * (rx + ry) + 0.4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(t) * rx + p.j(a), cy + Math.sin(t) * ry + p.j(a)]);
  }
  return `<path d="${smooth(pts, true)}" fill="${fill ?? "none"}" ${stroke(opts)}/>`;
}

/** Parallel hatching strokes inside a box, for shade and texture. */
export function hatch(key, x, y, w, h, opts = {}) {
  const p = pen(key, true);
  const gap = opts.gap ?? 6;
  const slant = opts.slant ?? 0.6;
  let out = "";
  for (let i = 0; i * gap < w; i++) {
    const x0 = x + i * gap + p.j(1.5);
    const len = h * (0.5 + p.r() * 0.5);
    out += line(`${key}-${i}`, [[x0, y + h], [x0 + len * slant * 0.3, y + h - len]], { w: opts.w ?? 0.8, stroke: opts.stroke ?? INK, still: true, extra: `opacity="${opts.opacity ?? 0.45}"` });
  }
  return out;
}

/** A small star of `points` points. */
export function star(cx, cy, r, fill, opts = {}) {
  const k = opts.points ?? 5;
  const pts = [];
  for (let i = 0; i < k * 2; i++) {
    const rr = i % 2 ? r * 0.42 : r;
    const t = (i / (k * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
  }
  return `<path d="M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join("L")}Z" fill="${fill}" ${stroke({ w: 0.6, ...opts })}/>`;
}

export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
