// The isometric style: a low-poly 3D wood lit by the real sun and moon, rendered small through an orthographic camera
// and squeezed into a 1990s palette with ordered dithering, so it reads like a pre-rendered game of the time.
// Climbing the tower pulls the camera back over the countryside, where the day's sightings stand.
import * as THREE from "./vendor/three.module.js";
import { ENTRY } from "./bestiary.mjs";
import { HOME, ITEMS, POS3, WAYPOINTS, ld, zonePoint } from "./world.mjs";

const PIXEL = 3; // screen pixels per rendered pixel
const LEVELS = 8; // per channel: a 512-colour cube, close to what a good 256-colour palette looked like

// Where things are lives in world.mjs, shared with the server.

// ---- Shared stuff, so rebuilding the dynamic parts allocates no GPU memory ------------------------------------

function noiseTexture(base, spots, size = 64, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (draw) draw(g, size, rnd);
  for (let i = 0; i < size * size * 0.35; i++) {
    g.fillStyle = spots[Math.floor(rnd() * spots.length)];
    g.fillRect(Math.floor(rnd() * size), Math.floor(rnd() * size), 1 + Math.floor(rnd() * 2), 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

let TEX, MAT, GEO;
function initShared() {
  if (TEX) return;
  TEX = {
    grass: noiseTexture("#6f8a3e", ["#5f7a34", "#7f9a48", "#68833a", "#8aa352", "#566f30"]),
    dirt: noiseTexture("#9a7b52", ["#8a6b44", "#a88a5e", "#7d6040", "#b0946a"]),
    stone: noiseTexture("#9a948a", ["#8a847a", "#aaa49a", "#7f7a70", "#b4ada2"], 64, (g, s) => {
      g.strokeStyle = "#6a655d";
      for (let y = 0; y < s; y += 8) {
        g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(s, y + 0.5); g.stroke();
        for (let x = (y / 8) % 2 ? 0 : 8; x < s; x += 16) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 8); g.stroke(); }
      }
    }),
    thatch: noiseTexture("#c9a24e", ["#b08a3e", "#d8b45a", "#a07a34", "#e0c070"], 64, (g, s, rnd) => {
      for (let i = 0; i < 90; i++) { g.strokeStyle = rnd() < 0.5 ? "#9a7432" : "#e2c47a"; g.beginPath(); const x = rnd() * s; g.moveTo(x, 0); g.lineTo(x + rnd() * 4 - 2, s); g.stroke(); }
    }),
    plaster: noiseTexture("#e6dcc4", ["#d9cfb6", "#efe6d0", "#d2c7ad"]),
    bark: noiseTexture("#5e4128", ["#4e3520", "#6e4d30", "#45301d"]),
    leaf: noiseTexture("#4f7a2e", ["#3f6a24", "#5f8a38", "#486f28", "#6a9440"]),
    pine: noiseTexture("#2f5a32", ["#244a28", "#3a6a3c", "#2a522c"]),
    field1: noiseTexture("#c9a855", ["#b8963f", "#d8b865", "#a88a3a"], 64, (g, s) => { g.fillStyle = "#a88a3a"; for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 1); }),
    field2: noiseTexture("#7f9a48", ["#6f8a3e", "#8faa58", "#5f7a34"], 64, (g, s) => { g.fillStyle = "#5f7a34"; for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 1); }),
    water: noiseTexture("#3e64a8", ["#355a98", "#4a72b8", "#5a82c4", "#2f528c"]),
  };
  TEX.grass.repeat.set(60, 60);
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  MAT = {
    grass: lam({ map: TEX.grass }), dirt: lam({ map: TEX.dirt }), stone: lam({ map: TEX.stone }), thatch: lam({ map: TEX.thatch }),
    plaster: lam({ map: TEX.plaster }), bark: lam({ map: TEX.bark }), leaf: lam({ map: TEX.leaf }), pine: lam({ map: TEX.pine }),
    field1: lam({ map: TEX.field1 }), field2: lam({ map: TEX.field2 }), water: lam({ map: TEX.water, emissive: 0x0a1a3a }),
    timber: lam({ color: 0x4a301c }), dark: lam({ color: 0x1e1712 }), skin: lam({ color: 0xe0b890 }),
    window: lam({ color: 0x2a2018, emissive: 0x000000 }),
    gold: new THREE.MeshBasicMaterial({ color: 0xf2c94c }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffa040 }),
    glowCold: new THREE.MeshBasicMaterial({ color: 0xc8ffe8 }),
    glowGold: new THREE.MeshBasicMaterial({ color: 0xfff0b0 }),
  };
  XRAY = new THREE.MeshBasicMaterial({ color: 0xf0c040, transparent: true, opacity: 0.55, depthFunc: THREE.GreaterDepth, depthWrite: false });
  GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.IcosahedronGeometry(1, 1),
    ball: new THREE.SphereGeometry(1, 10, 8),
    dome: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 8),
    rock: new THREE.DodecahedronGeometry(1, 0),
    octa: new THREE.OctahedronGeometry(1, 0),
    prism: (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 0.5); s.lineTo(-0.5, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      g.translate(0, 0, -0.5);
      return g;
    })(),
  };
}

let XRAY;
const colorMats = new Map();
function col(hex) {
  if (!colorMats.has(hex)) colorMats.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return colorMats.get(hex);
}

function mesh(geo, mat, [x, y, z], [sx, sy, sz] = [1, 1, 1], rot = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function group(x = 0, z = 0, data = null) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (data) g.userData = data;
  return g;
}

// ---- The land --------------------------------------------------------------------------------------------------

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function deciduous(g, x, z, h, rnd) {
  g.add(mesh(GEO.cyl, MAT.bark, [x, h * 0.3, z], [0.25 * h * 0.3, h * 0.6, 0.25 * h * 0.3]));
  for (let i = 0; i < 3; i++) g.add(mesh(GEO.sphere, MAT.leaf, [x + (rnd() - 0.5) * h * 0.4, h * (0.75 + rnd() * 0.2), z + (rnd() - 0.5) * h * 0.4], [h * 0.38, h * 0.32, h * 0.38]));
}

function conifer(g, x, z, h) {
  g.add(mesh(GEO.cyl, MAT.bark, [x, h * 0.15, z], [0.18, h * 0.3, 0.18]));
  for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, MAT.pine, [x, h * (0.4 + i * 0.22), z], [h * (0.32 - i * 0.07), h * 0.38, h * (0.32 - i * 0.07)]));
}

function cottage(g, x, z, w, d, h, roof = MAT.thatch, wall = MAT.plaster) {
  g.add(mesh(GEO.box, wall, [x, h / 2, z], [w, h, d]));
  g.add(mesh(GEO.prism, roof, [x, h, z], [w * 1.15, h * 1.4, d * 1.1]));
}

function buildLand() {
  const g = new THREE.Group();
  const ground = mesh(new THREE.PlaneGeometry(240, 240), MAT.grass, [0, 0, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  ground.castShadow = false;
  g.add(ground);
  // The path from the lodge door, south through the clearing.
  for (let i = 0; i < 9; i++) {
    const [x, z] = ld(-2.4 + i * 0.25 + Math.sin(i) * 0.5, -3.2 + i * 1.9);
    const p = mesh(GEO.box, MAT.dirt, [x, 0.02, z], [1.7, 0.04, 1.7], [0, Math.PI / 4 + Math.sin(i * 1.7) * 0.3, 0]);
    p.castShadow = false;
    g.add(p);
  }
  // The wood around the clearing; low scrub only on the side facing the camera, so nothing hides the clearing.
  const rnd = seeded(42);
  for (let i = 0; i < 140; i++) {
    const t = rnd() * Math.PI * 2;
    const r = 13 + rnd() * 16;
    const x = Math.cos(t) * r, z = Math.sin(t) * r;
    // Depth towards the camera is x + z: anything tall in front of the clearing would hide it.
    if (x + z > -9 && Math.abs(x - z) < 30) {
      if (rnd() < 0.4) g.add(mesh(GEO.sphere, MAT.leaf, [x, 0.4, z], [0.9, 0.6, 0.9]));
      continue;
    }
    if (z < -13 && z > -20.5) continue; // the river
    if (x > 10 && x < 33 && z < -14 && z > -33) continue; // the fields
    if (rnd() < 0.5) conifer(g, x, z, 3.5 + rnd() * 2.5);
    else deciduous(g, x, z, 3 + rnd() * 2, rnd);
  }
  // The river, running east to west north of the wood.
  const river = mesh(new THREE.PlaneGeometry(110, 3.4), MAT.water, [-6, 0.03, -18.4], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  river.castShadow = false;
  g.add(river);
  // Strip fields, alternating crops.
  for (let i = 0; i < 6; i++) {
    const f = mesh(GEO.box, i % 2 ? MAT.field1 : MAT.field2, [14 + i * 3.1, 0.03, -24], [3, 0.05, 16]);
    f.castShadow = false;
    g.add(f);
  }
  // The road from the village.
  for (let i = 0; i < 8; i++) {
    const p = mesh(GEO.box, MAT.dirt, [-26 + i * 2.4, 0.02, -24 + i * 1.6], [2.8, 0.04, 1.4], [0, -0.6, 0]);
    p.castShadow = false;
    g.add(p);
  }
  // The village: cottages, the church and its spire, the mill.
  const v = seeded(9);
  for (let i = 0; i < 7; i++) cottage(g, -36 + i * 2.2 + v() * 0.6, -28 - (i % 3) * 2.2, 1.6, 1.4, 1.1, i % 2 ? MAT.thatch : col(0x8a4a30));
  g.add(mesh(GEO.box, MAT.stone, [-28, 1.4, -33], [4, 2.8, 2.2]));
  g.add(mesh(GEO.prism, col(0x7a4a32), [-28, 2.8, -33], [4.4, 2.4, 2.4]));
  g.add(mesh(GEO.box, MAT.stone, [-25.6, 2.6, -33], [1.4, 5.2, 1.4]));
  g.add(mesh(GEO.cone, col(0x7a4a32), [-25.6, 6.4, -33], [1, 2.6, 1]));
  g.add(mesh(GEO.cyl, MAT.plaster, [-33, 1.4, -24], [0.8, 2.8, 0.8]));
  const sails = group(-33, -23.1);
  for (let i = 0; i < 4; i++) sails.add(mesh(GEO.box, MAT.timber, [0, 2.6, 0], [0.2, 3.2, 0.06], [0, 0, (i * Math.PI) / 2]));
  sails.position.y = 0;
  g.add(sails);
  // Hills on the horizon.
  for (let i = 0; i < 7; i++) g.add(mesh(GEO.sphere, col(0x6f8a5a), [-44 + i * 11, -2, -52 - (i % 2) * 4], [9, 6 + (i % 3) * 1.5, 6]));
  return g;
}

// ---- The lodge and the clearing --------------------------------------------------------------------------------

function buildLodge() {
  const g = new THREE.Group();
  const [tx, tz] = POS3.tower;
  const tower = group(tx, tz, { tower: "up" });
  tower.add(mesh(GEO.box, MAT.stone, [0, 5, 0], [3, 10, 3]));
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    tower.add(mesh(GEO.box, MAT.stone, [-1.1 + i * 0.73, 10.35, side * 1.3], [0.45, 0.7, 0.4]));
    tower.add(mesh(GEO.box, MAT.stone, [side * 1.3, 10.35, -1.1 + i * 0.73], [0.4, 0.7, 0.45]));
  }
  const slits = [];
  for (const y of [4, 7]) {
    const m = new THREE.Mesh(GEO.box, MAT.window.clone());
    m.position.set(1.52, y, 0);
    m.scale.set(0.06, 0.9, 0.3);
    tower.add(m);
    slits.push(m);
  }
  g.add(tower);
  const [hx, hz] = POS3.house;
  const house = group(hx, hz, { tower: "up" });
  house.add(mesh(GEO.box, MAT.plaster, [0, 1.3, 0], [3.6, 2.6, 3]));
  for (const x of [-1.8, -0.6, 0.6, 1.8]) house.add(mesh(GEO.box, MAT.timber, [x, 1.3, 1.52], [0.14, 2.6, 0.06]));
  house.add(mesh(GEO.box, MAT.timber, [0, 1.35, 1.52], [3.6, 0.14, 0.06]));
  house.add(mesh(GEO.prism, MAT.thatch, [0, 2.6, 0], [4.2, 3.2, 3.6], [0, Math.PI / 2, 0]));
  house.add(mesh(GEO.box, col(0x8a7a66), [1, 3.6, -0.6], [0.5, 1.6, 0.5]));
  house.add(mesh(GEO.box, MAT.dark, [-1.1, 0.75, 1.53], [0.7, 1.5, 0.04]));
  const win = new THREE.Mesh(GEO.box, MAT.window.clone());
  win.position.set(0.9, 1.7, 1.53);
  win.scale.set(0.7, 0.6, 0.04);
  house.add(win);
  g.add(house);
  const windowLight = new THREE.PointLight(0xffb060, 0, 9, 2);
  windowLight.position.set(hx + 0.9, 1.7, hz + 2.2);
  g.add(windowLight);
  return { g, lit: [win, ...slits], windowLight };
}

function ready(g, y) {
  const m = new THREE.Mesh(GEO.octa, MAT.gold);
  m.position.y = y;
  m.scale.set(0.28, 0.4, 0.28);
  m.userData.spin = true;
  g.add(m);
}

const NODE3 = {
  oak(n) {
    const g = new THREE.Group();
    const s = 0.55 + 0.45 * n.growth;
    g.add(mesh(GEO.cyl, MAT.bark, [0, 1.6, 0], [0.45, 3.2, 0.45]));
    for (const [x, y, z, r] of [[0, 4.6, 0, 2.2], [-1.4, 3.8, 0.6, 1.6], [1.3, 4, -0.5, 1.7], [0.3, 3.6, 1.3, 1.4]]) g.add(mesh(GEO.sphere, MAT.leaf, [x * s, 3.2 + (y - 3.2) * s, z * s], [r * s, r * s * 0.85, r * s]));
    if (n.ready) for (let i = 0; i < 6; i++) g.add(mesh(GEO.ball, col(0xb88a3a), [Math.cos(i) * 1.9, 3.4 + (i % 2) * 0.6, Math.sin(i) * 1.9], [0.12, 0.16, 0.12]));
    return [g, 6.4];
  },
  hazel(n) {
    const g = new THREE.Group();
    g.add(mesh(GEO.cyl, MAT.bark, [0, 0.1, 0], [0.6, 0.2, 0.6]));
    const stems = 2 + Math.round(n.growth * 6);
    for (let i = 0; i < stems; i++) {
      const a = (i / stems) * Math.PI * 2, h = 0.4 + n.growth * 2.6 * (0.8 + (i % 3) * 0.1);
      g.add(mesh(GEO.cyl, col(0x7a5a32), [Math.cos(a) * 0.25, h / 2, Math.sin(a) * 0.25], [0.05, h, 0.05], [Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15]));
      if (n.growth > 0.3) g.add(mesh(GEO.sphere, MAT.leaf, [Math.cos(a) * 0.45, h, Math.sin(a) * 0.45], [0.35, 0.28, 0.35]));
    }
    return [g, 3.6];
  },
  bramble(n) {
    const g = new THREE.Group();
    for (const [x, z, r] of [[0, 0, 1], [0.8, 0.3, 0.75], [-0.7, 0.4, 0.7], [0.1, -0.6, 0.7]]) g.add(mesh(GEO.rock, col(0x3a5a26), [x, r * 0.6, z], [r, r * 0.75, r]));
    const berries = Math.round(n.growth * 10);
    for (let i = 0; i < berries; i++) g.add(mesh(GEO.ball, col(n.ready ? 0x3a1a4a : 0xb04060), [Math.cos(i * 2.4) * 1.05, 0.5 + (i % 3) * 0.3, Math.sin(i * 2.4) * 1.05], [0.11, 0.11, 0.11]));
    return [g, 2.4];
  },
  ring(n) {
    const g = new THREE.Group();
    const count = Math.round(n.growth * 9);
    for (let i = 0; i < count; i++) {
      const a = (i / 9) * Math.PI * 2, x = Math.cos(a) * 1.6, z = Math.sin(a) * 1.1;
      g.add(mesh(GEO.cyl, col(0xf0e8d8), [x, 0.15, z], [0.07, 0.3, 0.07]));
      g.add(mesh(GEO.dome, col(0xc0301e), [x, 0.28, z], [0.22, 0.16, 0.22]));
    }
    return [g, 1.4];
  },
  moonwort(n) {
    const g = new THREE.Group();
    const open = n.stage === "bloom";
    const mat = open ? MAT.glowCold : col(0x8a9a6a);
    for (let i = 0; i < 4; i++) g.add(mesh(GEO.sphere, mat, [Math.cos(i * 1.6) * 0.25, 0.25 + i * 0.12, Math.sin(i * 1.6) * 0.25], [0.18, 0.08, 0.12]));
    if (open) {
      const l = new THREE.PointLight(0xa8f0d0, 6, 6, 2);
      l.position.y = 0.8;
      g.add(l);
    }
    return [g, 1.4];
  },
  skep(n) {
    const g = new THREE.Group();
    g.add(mesh(GEO.cyl, MAT.bark, [0, 0.3, 0], [0.7, 0.6, 0.7]));
    g.add(mesh(GEO.dome, MAT.thatch, [0, 0.6, 0], [0.75, 1.1, 0.75]));
    g.add(mesh(GEO.box, MAT.dark, [0, 0.75, 0.68], [0.2, 0.14, 0.1]));
    return [g, 2.4];
  },
};

function buildWorks(snap) {
  const g = new THREE.Group();
  const lights = [];
  const at = (id) => POS3[id];
  if (snap.built.cot) {
    const [x, z] = at("cot");
    cottage(g, x, z, 2.2, 1.8, 1.4);
  }
  if (snap.built.kennel) {
    const [x, z] = at("kennel");
    g.add(mesh(GEO.box, col(0x8a6a44), [x, 0.45, z], [1.1, 0.9, 1]));
    g.add(mesh(GEO.prism, col(0x5a3f26), [x, 0.9, z], [1.3, 1, 1.2]));
    g.add(quadFigure({ color: "#7a6a5a", size: 0.9, legs: snap.env.light < 0.4 ? "long" : "short", ears: "round", tail: "long" }, x + 1.3, z + 0.6, 0.6, -0.6));
  }
  if (snap.built.brazier) {
    const [x, z] = at("brazier");
    for (let i = 0; i < 3; i++) g.add(mesh(GEO.cyl, MAT.dark, [x + Math.cos(i * 2.1) * 0.3, 0.45, z + Math.sin(i * 2.1) * 0.3], [0.05, 0.9, 0.05]));
    g.add(mesh(GEO.dome, MAT.dark, [x, 1, z], [0.5, -0.35, 0.5]));
    const f = mesh(GEO.cone, MAT.flame, [x, 1.25, z], [0.3, 0.6, 0.3]);
    f.castShadow = false;
    f.userData.flicker = true;
    g.add(f);
    const l = new THREE.PointLight(0xff9a40, 18, 14, 1.6);
    l.position.set(x, 1.6, z);
    l.userData.flicker = true;
    g.add(l);
    lights.push(l);
  }
  if (snap.built.beacon) {
    const [x, z] = at("tower");
    const lit = snap.env.light < 0.6;
    g.add(mesh(GEO.box, lit ? MAT.glowGold : col(0xd9c49a), [x + 0.9, 11.2, z + 0.9], [0.4, 0.5, 0.4]));
    if (lit) {
      const l = new THREE.PointLight(0xffc060, 20, 20, 1.4);
      l.position.set(x + 0.9, 11.6, z + 0.9);
      l.userData.flicker = true;
      g.add(l);
    }
  }
  if (snap.built.cross) {
    const [x, z] = at("cross");
    g.add(mesh(GEO.box, MAT.stone, [x, 0.25, z], [1, 0.5, 1]));
    g.add(mesh(GEO.box, MAT.stone, [x, 1.6, z], [0.25, 2.4, 0.25]));
    g.add(mesh(GEO.box, MAT.stone, [x, 2.2, z], [1.2, 0.25, 0.25]));
  }
  return { g, lights };
}

// ---- Figures from the Bestiary's art parameters ----------------------------------------------------------------

function hex(c) {
  return Number.parseInt(c.slice(1), 16);
}

function quadFigure(a, x, z, s = 1, rotY = 0) {
  const g = group(x, z);
  g.rotation.y = rotY;
  g.scale.setScalar(s);
  const sz = a.size ?? 1;
  const L = (a.legs === "long" ? 0.9 : 0.4) * sz;
  const m = col(hex(a.color));
  const by = L + 0.3 * sz;
  g.add(mesh(GEO.ball, m, [0, by, 0], [0.75 * sz, 0.32 * sz, 0.3 * sz]));
  const legTop = L + 0.28 * sz; // legs run up into the body, so none hangs loose under its curve
  for (const [lx, lz] of [[-0.45, -0.15], [-0.45, 0.15], [0.45, -0.15], [0.45, 0.15]]) g.add(mesh(GEO.box, m, [lx * sz, legTop / 2, lz * sz], [0.09 * sz, legTop, 0.09 * sz]));
  const tall = a.legs === "long" && sz >= 1;
  const hx = 0.8 * sz, hy = tall ? by + 0.6 * sz : by + 0.15 * sz;
  if (tall) g.add(mesh(GEO.cyl, m, [0.65 * sz, by + 0.3 * sz, 0], [0.12 * sz, 0.6 * sz, 0.12 * sz], [0, 0, -0.5]));
  g.add(mesh(GEO.ball, m, [hx, hy, 0], [0.24 * sz, 0.2 * sz, 0.2 * sz]));
  g.add(mesh(GEO.cone, m, [hx + 0.28 * sz, hy - 0.03, 0], [0.1 * sz, 0.3 * sz, 0.1 * sz], [0, 0, -Math.PI / 2]));
  if (a.ears === "long") for (const ez of [-0.07, 0.07]) g.add(mesh(GEO.ball, m, [hx - 0.05, hy + 0.35 * sz, ez * sz], [0.05 * sz, 0.28 * sz, 0.05 * sz]));
  else if (a.ears) for (const ez of [-0.1, 0.1]) g.add(mesh(GEO.cone, m, [hx - 0.05, hy + 0.2 * sz, ez * sz], [0.06 * sz, 0.16 * sz, 0.06 * sz]));
  if (a.antlers) for (const ez of [-0.12, 0.12]) {
    g.add(mesh(GEO.cyl, col(0xd8c8a0), [hx - 0.1, hy + 0.45 * sz, ez * sz], [0.03, 0.6 * sz, 0.03], [ez * 3, 0, 0.3]));
    g.add(mesh(GEO.cyl, col(0xd8c8a0), [hx - 0.25, hy + 0.6 * sz, ez * 2.2 * sz], [0.025, 0.35 * sz, 0.025], [ez * 6, 0, -0.5]));
  }
  if (a.tail === "bushy") g.add(mesh(GEO.ball, m, [-0.95 * sz, by - 0.05, 0], [0.38 * sz, 0.13 * sz, 0.13 * sz], [0, 0, 0.4]));
  else if (a.tail === "long") g.add(mesh(GEO.cyl, m, [-0.95 * sz, by - 0.1, 0], [0.05 * sz, 0.6 * sz, 0.05 * sz], [0, 0, 1.2]));
  if (a.tusks) g.add(mesh(GEO.cone, col(0xf4eedc), [hx + 0.2 * sz, hy - 0.1, 0.1], [0.03, 0.15, 0.03]));
  if (a.stripe) g.add(mesh(GEO.ball, col(0xf4eedc), [hx + 0.05, hy + 0.05, 0], [0.26 * sz, 0.06 * sz, 0.1 * sz]));
  if (a.spines) g.add(mesh(GEO.rock, col(0x4a3a2a), [0, by + 0.08, 0], [0.7 * sz, 0.3 * sz, 0.32 * sz]));
  if (a.glow) {
    const l = new THREE.PointLight(0xfff4c0, 10, 8, 1.6);
    l.position.set(0, by + 0.6, 0);
    g.add(l);
  }
  return g;
}

function birdFigure(a, x, z, s) {
  const g = group(x, z);
  g.scale.setScalar(s);
  const sz = a.size ?? 1;
  const m = col(hex(a.color));
  const n = a.count ?? 1;
  for (let i = 0; i < n; i++) {
    const b = group(-i * 0.9 * sz, i * 0.4);
    if (a.pose === "fly") {
      b.position.y = 3 + i * 0.4;
      b.add(mesh(GEO.ball, m, [0, 0, 0], [0.35 * sz, 0.14 * sz, 0.14 * sz]));
      for (const side of [-1, 1]) {
        const w = mesh(GEO.box, m, [0, 0.05, side * 0.35 * sz], [0.3 * sz, 0.03, 0.6 * sz]);
        w.userData.flap = side;
        b.add(w);
      }
    } else {
      const L = (a.legs === "long" ? 0.8 : 0.15) * sz;
      for (const lz of [-0.05, 0.05]) b.add(mesh(GEO.cyl, MAT.dark, [0, L / 2, lz], [0.02, L, 0.02]));
      b.add(mesh(GEO.ball, m, [0, L + 0.2 * sz, 0], [0.4 * sz, 0.22 * sz, 0.2 * sz], a.pose === "perch" ? [0, 0, 1.2] : null));
      const hy = L + (a.neck === "long" ? 0.9 : 0.45) * sz;
      if (a.neck === "long") b.add(mesh(GEO.cyl, m, [0.3 * sz, L + 0.55 * sz, 0], [0.05 * sz, 0.6 * sz, 0.05 * sz], [0, 0, -0.3]));
      b.add(mesh(GEO.ball, a.face === "owl" ? col(0xe8d8b0) : m, [0.35 * sz, hy, 0], [0.13 * sz, 0.12 * sz, 0.12 * sz]));
      b.add(mesh(GEO.cone, col(0xc8963e), [0.55 * sz, hy, 0], [0.04, 0.3 * sz, 0.04], [0, 0, -Math.PI / 2]));
    }
    g.add(b);
  }
  return g;
}

function folkFigure(a, x, z, s, night) {
  const g = group(x, z);
  g.scale.setScalar(s);
  const n = a.count ?? 1;
  if (a.smoke) {
    g.add(mesh(GEO.dome, col(0x4a3a2a), [-1.2, 0, 0], [0.8, 0.6, 0.8]));
    for (let i = 0; i < 3; i++) {
      const p = mesh(GEO.sphere, col(0x9a948a), [-1.2 + i * 0.15, 1 + i * 0.6, 0], [0.25 + i * 0.1, 0.25 + i * 0.1, 0.25 + i * 0.1]);
      p.castShadow = false;
      g.add(p);
    }
  }
  if (a.horse) g.add(quadFigure({ color: "#7a5236", size: 1.15, legs: "long", ears: "point", tail: "short" }, 0, 0, 1));
  for (let i = 0; i < n; i++) {
    const p = group(-i * 0.6, i * 0.3);
    const lift = a.horse ? 1.25 : 0;
    p.add(mesh(GEO.cone, col(hex(a.color)), [0, lift + 0.55, 0], [0.32, 1.1, 0.32]));
    p.add(mesh(GEO.ball, MAT.skin, [0, lift + 1.2, 0], [0.16, 0.18, 0.16]));
    if (a.hood) p.add(mesh(GEO.cone, col(hex(a.hoodColor ?? a.color)), [0, lift + 1.35, 0], [0.2, 0.4, 0.2]));
    if (a.hat) {
      p.add(mesh(GEO.cyl, col(0x5a4026), [0, lift + 1.36, 0], [0.32, 0.04, 0.32]));
      p.add(mesh(GEO.cyl, col(0x5a4026), [0, lift + 1.46, 0], [0.15, 0.18, 0.15]));
    }
    if (a.pack) p.add(mesh(GEO.box, col(0xc8963e), [-0.25, lift + 0.8, 0], [0.25, 0.4, 0.3]));
    if (a.staff) p.add(mesh(GEO.cyl, MAT.bark, [0.3, 0.75, 0], [0.03, 1.6, 0.03]));
    if (a.torch || a.lantern) {
      p.add(mesh(a.torch ? GEO.cone : GEO.box, MAT.flame, [0.32, 1.3, 0], a.torch ? [0.08, 0.25, 0.08] : [0.15, 0.2, 0.15]));
      if (night) {
        const l = new THREE.PointLight(0xff9a40, 10, 8, 1.6);
        l.position.set(0.32, 1.5, 0);
        l.userData.flicker = true;
        p.add(l);
      }
    }
    g.add(p);
  }
  return g;
}

function herbFigure(a, x, z, s) {
  const g = group(x, z);
  g.scale.setScalar(s);
  const m = col(hex(a.color));
  const stem = col(0x3f5f2a);
  if (a.flower === "mushroom") {
    g.add(mesh(GEO.cyl, col(0xf0e8d8), [0, 0.35, 0], [0.14, 0.7, 0.14]));
    g.add(mesh(GEO.dome, m, [0, 0.62, 0], [0.5, 0.36, 0.5]));
    for (let i = 0; i < 6; i++) g.add(mesh(GEO.ball, col(0xf8f4ea), [Math.cos(i * 1.1) * 0.3, 0.86 - (i % 2) * 0.08, Math.sin(i * 1.1) * 0.3], [0.05, 0.03, 0.05]));
    return g;
  }
  if (a.flower === "acorn") {
    g.add(mesh(GEO.ball, col(0xb88a3a), [0, 0.35, 0], [0.22, 0.3, 0.22]));
    g.add(mesh(GEO.dome, col(0x6b4a2b), [0, 0.5, 0], [0.25, 0.16, 0.25]));
    g.add(mesh(GEO.cyl, col(0x6b4a2b), [0, 0.72, 0], [0.03, 0.15, 0.03]));
    g.add(mesh(GEO.ball, MAT.leaf, [0.35, 0.55, -0.1], [0.4, 0.06, 0.2], [0, 0.5, 0.4]));
    return g;
  }
  if (a.flower === "bee") {
    g.add(mesh(GEO.ball, m, [0, 0.5, 0], [0.42, 0.26, 0.26]));
    for (const bx of [-0.15, 0.12]) g.add(mesh(GEO.cyl, MAT.dark, [bx, 0.5, 0], [0.27, 0.07, 0.27], [0, 0, Math.PI / 2]));
    g.add(mesh(GEO.ball, MAT.dark, [0.42, 0.52, 0], [0.13, 0.13, 0.13]));
    for (const side of [-1, 1]) g.add(mesh(GEO.ball, col(0xeef4fa), [-0.05, 0.78, side * 0.18], [0.24, 0.04, 0.13], [side * 0.5, 0, 0]));
    return g;
  }
  for (let i = 0; i < 5; i++) {
    const px = Math.cos(i * 1.3) * 0.4, pz = Math.sin(i * 1.3) * 0.4, h = a.tall ? 0.8 : 0.45;
    g.add(mesh(GEO.cyl, stem, [px, h / 2, pz], [0.025, h, 0.025]));
    g.add(mesh(GEO.ball, MAT.leaf, [px + 0.08, h * 0.3, pz], [0.1, 0.03, 0.06]));
    if (a.flower === "fern") for (let j = 0; j < 3; j++) g.add(mesh(GEO.ball, m, [px + (j % 2 ? 0.08 : -0.08), h * (0.5 + j * 0.2), pz], [0.09, 0.03, 0.06]));
    else if (a.flower === "catkin") g.add(mesh(GEO.cyl, col(0xd8c050), [px + 0.06, h - 0.1, pz], [0.035, 0.22, 0.035]));
    else if (a.flower === "cluster") for (let j = 0; j < 3; j++) g.add(mesh(GEO.ball, m, [px + (j - 1) * 0.05, h + (j % 2) * 0.04, pz], [0.05, 0.05, 0.05]));
    else g.add(mesh(GEO.ball, m, [px, h, pz], [0.1, a.flower === "bell" ? 0.14 : 0.1, 0.1]));
  }
  return g;
}

function lightFigure(a, x, z, s, y) {
  const g = group(x, z);
  g.position.y = y;
  const color = hex(a.color);
  if (a.kind === "hunt") {
    for (let i = 0; i < 3; i++) g.add(quadFigure({ color: "#1d1a2a", size: 1.1, legs: "long", ears: "point", tail: "bushy" }, -i * 1.8, i * 0.6, 0.9));
    const l = new THREE.PointLight(0xc8b8ff, 12, 18, 1.4);
    g.add(l);
    return g;
  }
  const core = new THREE.Mesh(GEO.ball, new THREE.MeshBasicMaterial({ color }));
  core.scale.setScalar(a.kind === "star" ? 0.35 : 0.25);
  g.add(core);
  if (a.kind === "star") {
    const tail = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    tail.position.set(-1.6, 0.8, 0);
    tail.scale.set(3.4, 0.08, 0.08);
    tail.rotation.z = -0.45;
    g.add(tail);
  } else {
    g.position.y = 0.9;
    const l = new THREE.PointLight(color, 8, 7, 1.6);
    g.add(l);
    g.userData.hover = true;
  }
  g.scale.setScalar(s);
  return g;
}

function entryFigure(e, x, z, s, night, y) {
  const a = e.art;
  if (a.shape === "quad") return quadFigure(a, x, z, s);
  if (a.shape === "bird") return birdFigure(a, x, z, s);
  if (a.shape === "folk") return folkFigure(a, x, z, s, night);
  if (a.shape === "herb") return herbFigure(a, x, z, s);
  return lightFigure(a, x, z, s, y);
}

function woodwardFigure(you, night) {
  const g = group(0, 0);
  const eq = you.equip ?? {};
  const cloak = eq.torso === "cloak";
  g.add(mesh(GEO.cone, col(cloak ? 0x2f5a32 : eq.torso ? 0xc9b48a : 0xe0b890), [0, 0.6, 0], [cloak ? 0.4 : 0.33, 1.15, cloak ? 0.4 : 0.33]));
  if (eq.feet) for (const x of [-0.1, 0.1]) g.add(mesh(GEO.box, col(0x4a3020), [x, 0.05, 0.05], [0.12, 0.1, 0.22]));
  g.add(mesh(GEO.ball, MAT.skin, [0, 1.28, 0], [0.17, 0.19, 0.17]));
  if (eq.head === "hood") g.add(mesh(GEO.cone, col(0x3f6a3a), [0, 1.45, -0.02], [0.21, 0.42, 0.21]));
  if (eq.neck === "horn") g.add(mesh(GEO.ball, col(0xe8dcb8), [0.12, 0.95, 0.2], [0.08, 0.05, 0.05]));
  for (const [slot, x] of [["handL", -0.36], ["handR", 0.36]]) {
    const id = eq[slot];
    if (!id || !ITEM3[id]) continue;
    const held = ITEM3[id]();
    held.position.set(x, 0.55, 0.12);
    held.scale.setScalar(id === "staff" ? 0.95 : 0.6);
    g.add(held);
    if (ITEMS[id].light && night) {
      const l = new THREE.PointLight(0xffb060, id === "lantern" ? 26 : 18, id === "lantern" ? 16 : 12, 1.4);
      l.position.set(x, 1.3, 0.2);
      l.userData.flicker = id === "torch";
      g.add(l);
    }
  }
  return g;
}

function waypointStone(wp, found, night) {
  const g = group(...wp.at, { waypoint: wp.id });
  g.add(mesh(GEO.box, col(0x6a6660), [0, 1.3, 0], [0.9, 2.6, 0.6], [0, 0.4, 0.06]));
  g.add(mesh(GEO.box, col(0x5a5650), [0.9, 0.4, 0.3], [0.5, 0.8, 0.4], [0, 0.9, 0]));
  if (found) {
    g.add(mesh(GEO.box, MAT.gold, [0.18, 1.6, 0.26], [0.3, 0.5, 0.04], [0, 0.4, 0]));
    const l = new THREE.PointLight(0xffd070, night ? 10 : 4, 8, 1.6);
    l.position.set(0, 2.2, 0.8);
    g.add(l);
  }
  return g;
}

function watFigure(x, z, night) {
  return folkFigure({ color: "#4f7a3a", hood: true, hoodColor: "#c0392b", lantern: night }, x, z, 1, night);
}

// ---- Sky and light ---------------------------------------------------------------------------------------------

const SKY = [[-18, 0x0b1030], [-8, 0x2a2858], [-2, 0x6a4a6e], [3, 0xd09070], [12, 0x9fb8d8], [40, 0xbcd4ea]];
function skyColor(el) {
  const c = new THREE.Color(SKY[0][1]);
  if (el <= SKY[0][0]) return c;
  for (let i = 1; i < SKY.length; i++) {
    if (el <= SKY[i][0]) return c.set(SKY[i - 1][1]).lerp(new THREE.Color(SKY[i][1]), (el - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]));
  }
  return c.set(SKY.at(-1)[1]);
}

/** Direction towards a body in the sky, from azimuth (from north, eastwards) and elevation. */
function skyDir(pos) {
  const az = (pos.azimuth * Math.PI) / 180, el = (Math.max(pos.elevation, 2) * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// ---- The renderer ----------------------------------------------------------------------------------------------

const POST_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
  uniform sampler2D tScene; uniform vec2 res; uniform float levels; uniform float vignette; varying vec2 vUv;
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
    int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    return float(m[i]) / 16.0 - 0.5;
  }
  void main() {
    vec2 px = floor(vUv * res);
    vec4 c = linearToOutputTexel(texture2D(tScene, (px + 0.5) / res));
    vec3 v = c.rgb;
    v = mix(vec3(dot(v, vec3(.299, .587, .114))), v, 1.2);
    v = pow(v, vec3(0.88)); // lift the shadows a little, as CRTs did
    v = clamp((v - 0.5) * 1.12 + 0.5, 0.0, 1.0);
    v *= 1.0 - vignette * pow(length(vUv - 0.5) * 1.35, 2.4); // the vignette of a torch-lit screen
    v = floor(v * (levels - 1.0) + 0.5 + bayer(px) * 0.55) / (levels - 1.0);
    gl_FragColor = vec4(v, c.a < 0.5 ? 0.0 : 1.0); // sprites keep hard-edged transparency
  }`;

function postMaterial(vignette) {
  return new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null }, res: { value: new THREE.Vector2(1, 1) }, levels: { value: LEVELS }, vignette: { value: vignette } },
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, transparent: true,
  });
}

// ---- Sprites: the Bestiary and the store, pre-rendered from the same models -------------------------------------

let kit = null;
const sprites = new Map();

/** Things that are not Bestiary entries but need a picture: what the store holds. */
const GOODS = {
  timber: () => { const g = new THREE.Group(); for (const [y, z] of [[0.25, -0.28], [0.25, 0.28], [0.7, 0]]) g.add(mesh(GEO.cyl, MAT.bark, [0, y, z], [0.24, 1.4, 0.24], [0, 0, Math.PI / 2])); return g; },
  poles: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) g.add(mesh(GEO.cyl, col(0x8a6a3a), [(i - 2) * 0.12, 0.9, 0], [0.05, 1.8, 0.05], [0, 0, (i - 2) * 0.06])); g.add(mesh(GEO.cyl, col(0xc8a060), [0, 0.8, 0], [0.34, 0.1, 0.12])); return g; },
  berries: () => { const g = new THREE.Group(); for (let i = 0; i < 9; i++) g.add(mesh(GEO.ball, col(0x3a1a4a), [Math.cos(i * 2.4) * 0.25 * (i % 3), 0.2 + Math.floor(i / 3) * 0.17, Math.sin(i * 2.4) * 0.25 * (i % 3)], [0.15, 0.15, 0.15])); return g; },
  honey: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, col(0x9a6a3a), [0, 0.35, 0], [0.38, 0.7, 0.38])); g.add(mesh(GEO.dome, col(0xe0a020), [0, 0.7, 0], [0.4, 0.18, 0.4])); g.add(mesh(GEO.cyl, col(0xe0a020), [0.36, 0.55, 0], [0.06, 0.4, 0.06])); return g; },
  mushrooms: () => herbFigure({ color: "#c23a22", flower: "mushroom" }, 0, 0, 1),
  moonwort: () => herbFigure({ color: "#c8d0e8", flower: "fern" }, 0, 0, 1.4),
  blessings: () => { const g = new THREE.Group(); g.add(mesh(GEO.octa, MAT.gold, [0, 0.6, 0], [0.4, 0.6, 0.4])); return g; },
};

/** Gear, as carried or laid out in the pack. Each is built standing up, about one unit tall. */
const ITEM3 = {
  hood: () => { const g = new THREE.Group(); g.add(mesh(GEO.cone, col(0x3f6a3a), [0, 0.5, 0], [0.45, 1, 0.45])); g.add(mesh(GEO.ball, col(0x2e5230), [0, 0.15, 0.12], [0.42, 0.2, 0.3])); return g; },
  tunic: () => { const g = new THREE.Group(); g.add(mesh(GEO.cone, col(0xc9b48a), [0, 0.55, 0], [0.55, 1.1, 0.4])); for (const x of [-0.42, 0.42]) g.add(mesh(GEO.cyl, col(0xc9b48a), [x, 0.75, 0], [0.12, 0.6, 0.12], [0, 0, x > 0 ? -0.6 : 0.6])); return g; },
  hose: () => { const g = new THREE.Group(); for (const x of [-0.16, 0.16]) g.add(mesh(GEO.cyl, col(0x6a4a2a), [x, 0.5, 0], [0.12, 1, 0.12])); g.add(mesh(GEO.box, col(0x6a4a2a), [0, 0.95, 0], [0.5, 0.15, 0.25])); return g; },
  boots: () => { const g = new THREE.Group(); for (const x of [-0.2, 0.2]) { g.add(mesh(GEO.box, col(0x4a3020), [x, 0.3, 0], [0.22, 0.6, 0.24])); g.add(mesh(GEO.box, col(0x4a3020), [x, 0.08, 0.15], [0.22, 0.16, 0.45])); } return g; },
  hatchet: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, MAT.bark, [0, 0.5, 0], [0.05, 1, 0.05])); g.add(mesh(GEO.box, col(0x8a8a92), [0.14, 0.92, 0], [0.3, 0.2, 0.05])); return g; },
  torch: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, MAT.bark, [0, 0.45, 0], [0.05, 0.9, 0.05])); g.add(mesh(GEO.cyl, col(0x2a2018), [0, 0.92, 0], [0.09, 0.14, 0.09])); g.add(mesh(GEO.cone, MAT.flame, [0, 1.12, 0], [0.12, 0.3, 0.12])); return g; },
  lantern: () => { const g = new THREE.Group(); g.add(mesh(GEO.box, col(0xf0c860), [0, 0.45, 0], [0.32, 0.5, 0.32])); for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) g.add(mesh(GEO.box, MAT.dark, [x, 0.45, z], [0.04, 0.55, 0.04])); g.add(mesh(GEO.cone, MAT.dark, [0, 0.82, 0], [0.24, 0.2, 0.24])); g.add(mesh(GEO.box, MAT.dark, [0, 0.98, 0], [0.04, 0.16, 0.04])); return g; },
  horn: () => { const g = new THREE.Group(); g.add(mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 12, Math.PI * 1.1), col(0xe8dcb8), [0, 0.45, 0], [1, 1, 1])); g.add(mesh(GEO.cone, col(0xe8dcb8), [0.4, 0.38, 0], [0.12, 0.24, 0.12], [0, 0, Math.PI])); return g; },
  staff: () => { const g = new THREE.Group(); g.add(mesh(GEO.cyl, col(0x9a7a4a), [0, 0.9, 0], [0.05, 1.8, 0.05])); g.add(mesh(GEO.cyl, col(0x6a6a72), [0, 0.04, 0], [0.06, 0.08, 0.06])); return g; },
  cloak: () => { const g = new THREE.Group(); g.add(mesh(GEO.cone, col(0x2f5a32), [0, 0.6, 0], [0.62, 1.2, 0.5])); g.add(mesh(GEO.cone, col(0x2f5a32), [0, 1.25, -0.05], [0.25, 0.35, 0.25])); return g; },
};

/** A pre-rendered picture of a Bestiary entry (by id), a store good or an item of gear, as a PNG data URL. Cached. */
export function sprite(id, { px = 48, silhouette = false } = {}) {
  const key = `${id}:${px}:${silhouette}`;
  if (sprites.has(key)) return sprites.get(key);
  initShared();
  if (!kit) {
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const keyLight = new THREE.DirectionalLight(0xfff0d8, 3.2);
    keyLight.position.set(-3, 6, 4);
    const rim = new THREE.DirectionalLight(0x9fb4ff, 1.4);
    rim.position.set(4, 2, -4);
    scene.add(keyLight, rim, new THREE.HemisphereLight(0xdde6ff, 0x3a3020, 1));
    const post = postMaterial(0);
    const postScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
    quad.frustumCulled = false;
    postScene.add(quad);
    kit = { canvas, renderer, scene, post, postScene, postCam: new THREE.Camera(), camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200), rt: null,
      shadow: new THREE.MeshBasicMaterial({ color: 0x14100c }) };
  }
  const { renderer, scene, camera, post } = kit;
  const e = ENTRY[id];
  const obj = e ? entryFigure(e, 0, 0, 1, true, 0) : (GOODS[id] ?? ITEM3[id])();
  if (e?.art.shape === "light") obj.position.y = 0;
  scene.add(obj);
  scene.overrideMaterial = silhouette ? kit.shadow : null;
  // Frame the model from a three-quarter view, to its own extent.
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  camera.position.copy(center).add(new THREE.Vector3(1.1, 0.75, 1.5).normalize().multiplyScalar(60));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const view = camera.matrixWorldInverse;
  const c = center.clone().applyMatrix4(view);
  let half = 0.1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(view);
    half = Math.max(half, Math.abs(v.x - c.x), Math.abs(v.y - c.y));
  }
  half *= 1.08;
  Object.assign(camera, { left: -half, right: half, top: half, bottom: -half });
  camera.updateProjectionMatrix();
  renderer.setSize(px, px, false);
  if (!kit.rt || kit.rt.width !== px) {
    kit.rt?.dispose();
    kit.rt = new THREE.WebGLRenderTarget(px, px, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  }
  post.uniforms.tScene.value = kit.rt.texture;
  post.uniforms.res.value.set(px, px);
  renderer.setRenderTarget(kit.rt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(kit.postScene, kit.postCam);
  const url = kit.canvas.toDataURL("image/png");
  scene.remove(obj);
  sprites.set(key, url);
  return url;
}

export function createIso(canvas) {
  initShared();
  // preserveDrawingBuffer keeps the last frame readable, for screenshots and for the page's own captures.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power", preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 60, 160);
  scene.add(buildLand());
  const lodge = buildLodge();
  scene.add(lodge.g);

  const hemi = new THREE.HemisphereLight(0xbcd4ea, 0x3a4a2a, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
  scene.add(moon, moon.target);

  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
  const view = { target: new THREE.Vector3(-1, 2.5, -1), zoom: 9.5, goalTarget: new THREE.Vector3(-1, 2.5, -1), goalZoom: 9.5 };

  let rt = null;
  const post = postMaterial(0.55);
  const postScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  postScene.add(quad);
  const postCam = new THREE.Camera();

  let dynamic = new THREE.Group();
  scene.add(dynamic);
  let snap = null, mode = "wood", skew = 0, wat = null, you = null, hound = null, marker = null, raf = 0, last = 0;
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  /** Where you are right now, between the server's snapshots. */
  function youAt(now) {
    const w = snap.you.walk;
    if (!w) return snap.you.pos;
    const t = THREE.MathUtils.clamp((now - w.departedAt) / (w.arriveAt - w.departedAt), 0, 1);
    return [w.from[0] + (w.to[0] - w.from[0]) * t, w.from[1] + (w.to[1] - w.from[1]) * t];
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    const lw = Math.ceil(w / PIXEL), lh = Math.ceil(h / PIXEL);
    if (!rt || rt.width !== lw || rt.height !== lh) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(lw, lh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      post.uniforms.tScene.value = rt.texture;
      post.uniforms.res.value.set(lw, lh);
    }
  }

  function placeCamera() {
    const a = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.left = -view.zoom * a; camera.right = view.zoom * a; camera.top = view.zoom; camera.bottom = -view.zoom;
    camera.position.copy(view.target).add(new THREE.Vector3(40, 32.6, 40));
    camera.lookAt(view.target);
    camera.updateProjectionMatrix();
    const span = view.zoom * 2.2;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 200 });
    sun.shadow.camera.updateProjectionMatrix();
  }

  function light(env) {
    const sky = skyColor(env.sun.elevation);
    scene.background = sky.clone().multiplyScalar(0.6);
    scene.fog.color.copy(sky).multiplyScalar(0.6);
    const day = THREE.MathUtils.clamp(env.sun.elevation / 12, 0, 1);
    const low = 1 - THREE.MathUtils.clamp(env.sun.elevation / 25, 0, 1);
    sun.intensity = 3.4 * day;
    sun.color.set(0xfff4dc).lerp(new THREE.Color(0xff9a50), low * 0.8);
    sun.position.copy(view.target).add(skyDir(env.sun).multiplyScalar(80));
    sun.target.position.copy(view.target);
    const moonUp = env.moon.elevation > 0 && env.sun.elevation < 0;
    moon.intensity = moonUp ? 0.25 + 0.6 * env.moon.illumination : 0;
    moon.position.copy(view.target).add(skyDir(env.moon).multiplyScalar(80));
    moon.target.position.copy(view.target);
    hemi.color.copy(sky);
    hemi.intensity = 0.35 + 1.5 * env.light;
    const night = env.light < 0.55;
    for (const m of lodge.lit) m.material.emissive.set(night ? 0xffb050 : 0x000000);
    lodge.windowLight.intensity = night ? 14 : 0;
  }

  function rebuild() {
    scene.remove(dynamic);
    dynamic = new THREE.Group();
    const night = snap.env.sun.elevation < -6;
    for (const [id, n] of Object.entries(snap.nodes)) {
      const [obj, h] = NODE3[n.kind](n);
      const g = group(...POS3[id], { node: id });
      g.add(obj);
      if (n.ready) ready(g, h);
      dynamic.add(g);
    }
    const works = buildWorks(snap);
    dynamic.add(works.g);
    for (const wp of WAYPOINTS) dynamic.add(waypointStone(wp, snap.you.waypoints.includes(wp.id), night));
    you = woodwardFigure(snap.you, night);
    you.scale.setScalar(1.5);
    const ring = mesh(new THREE.RingGeometry(0.5, 0.62, 20), MAT.gold, [0, 0.04, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    ring.castShadow = false;
    you.add(ring);
    // Wherever something stands between you and the camera, your silhouette shows through, as in Diablo.
    const xray = [];
    you.traverse((o) => { if (o.isMesh) xray.push(o); });
    for (const o of xray) {
      const ghost = new THREE.Mesh(o.geometry, XRAY);
      ghost.position.copy(o.position); ghost.rotation.copy(o.rotation); ghost.scale.copy(o.scale);
      ghost.renderOrder = 10;
      o.parent.add(ghost);
    }
    dynamic.add(you);
    hound = null;
    if (snap.you.hound) {
      hound = quadFigure({ color: "#7a6a5a", size: 0.9, legs: "long", ears: "round", tail: "long" }, 0, 0, 0.6);
      dynamic.add(hound);
    }
    marker = null;
    if (snap.you.walk) {
      marker = mesh(new THREE.RingGeometry(0.35, 0.5, 16), MAT.gold, [snap.you.walk.to[0], 0.06, snap.you.walk.to[1]], [1, 1, 1], [-Math.PI / 2, 0, 0]);
      marker.castShadow = false;
      dynamic.add(marker);
    }
    {
      for (const s of snap.sightings) {
        const e = ENTRY[s.entry];
        const [x, y, z] = zonePoint(s);
        const scale = e.where === "sky" ? 2.2 : 2.4;
        const g = group(0, 0, { sighting: s.id });
        g.add(entryFigure(e, x, z, scale, night, y));
        if (s.flip) g.children[0].rotation.y += Math.PI;
        if (!snap.book[s.entry]) {
          const r = group(x, z);
          ready(r, y + 4.8);
          g.add(r);
        }
        dynamic.add(g);
      }
    }
    if (snap.env.sun.elevation < -6) {
      // Eyes at the wood's edge. Fewer with a hound about.
      const rnd = seeded(77);
      const eyes = new THREE.MeshBasicMaterial({ color: 0xffe36a });
      for (let i = 0; i < (snap.built.kennel ? 2 : 6); i++) {
        const t = (-170 + rnd() * 160) * (Math.PI / 180), r = 12.5 + rnd() * 2;
        const pair = group(Math.cos(t) * r, Math.sin(t) * r);
        for (const dx of [-0.13, 0.13]) {
          const e = new THREE.Mesh(GEO.ball, eyes);
          e.position.set(dx, 0.7, dx);
          e.scale.setScalar(0.07);
          pair.add(e);
        }
        pair.userData.blink = rnd() * 10;
        dynamic.add(pair);
      }
    }
    wat = null;
    if (snap.built.cot && (snap.wat.awake || snap.wat.onWatch)) {
      wat = watFigure(0, 0, night);
      wat.scale.setScalar(1.3);
      dynamic.add(wat);
    }
    scene.add(dynamic);
  }

  function watPosition(now) {
    const w = snap.wat;
    if (w.onWatch && w.state !== "walking") return [POS3.tower[0] + 0.6, 10.7, POS3.tower[1] + 0.6];
    const p = (id) => POS3[id] ?? POS3.cot;
    if (w.state !== "walking") {
      const [x, z] = p(w.at);
      return [x + 1, 0, z + 1];
    }
    const t = THREE.MathUtils.clamp((now - w.departedAt) / (w.arriveAt - w.departedAt), 0, 1);
    const [x0, z0] = p(w.from), [x1, z1] = p(w.target);
    return [x0 + (x1 - x0) * t + 1, 0, z0 + (z1 - z0) * t + 1];
  }

  function frame(ms) {
    raf = requestAnimationFrame(frame);
    if (ms - last < 50 || !snap) return; // about 20 frames a second is plenty for the period
    last = ms;
    const k = 0.12;
    view.target.lerp(view.goalTarget, k);
    view.zoom += (view.goalZoom - view.zoom) * k;
    placeCamera();
    light(snap.env);
    const t = ms / 1000;
    dynamic.traverse((o) => {
      if (o.userData.spin) { o.rotation.y = t * 2; o.position.y += Math.sin(t * 3) * 0.004; }
      if (o.userData.flap) o.rotation.x = Math.sin(t * 10) * 0.6 * o.userData.flap;
      if (o.userData.flicker && o.isLight) o.intensity *= 0.9 + Math.random() * 0.2 > 1 ? 1.02 : 0.98;
      if (o.userData.flicker && o.isMesh) o.scale.y = 0.6 * (0.85 + Math.random() * 0.3);
      if (o.userData.blink !== undefined) o.visible = (t + o.userData.blink) % 7 > 0.25;
      if (o.userData.hover) o.position.y = 0.9 + Math.sin(t * 2 + o.id) * 0.3;
    });
    if (you) {
      const [x, z] = youAt(Date.now() + skew);
      const moving = !!snap.you.walk && Date.now() + skew < snap.you.walk.arriveAt;
      you.position.set(x, moving ? Math.abs(Math.sin(t * 9)) * 0.1 : 0, z);
      if (moving) you.rotation.y = Math.atan2(snap.you.walk.to[0] - snap.you.walk.from[0], snap.you.walk.to[1] - snap.you.walk.from[1]);
      you.visible = mode !== "tower";
      if (hound) { hound.position.set(x - 0.9, 0, z + 0.6); hound.rotation.y = you.rotation.y - Math.PI / 2; hound.visible = you.visible; }
      if (mode !== "tower") view.goalTarget.set(x, 1, z);
    }
    if (marker) marker.rotation.z = t;
    if (wat) {
      const [x, y, z] = watPosition(Date.now() + skew);
      wat.position.set(x, y + (snap.wat.state === "walking" ? Math.abs(Math.sin(t * 8)) * 0.08 : 0), z);
    }
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  const ro = new ResizeObserver(() => { resize(); placeCamera(); });
  ro.observe(canvas);
  resize();

  return {
    update(next, nextMode) {
      snap = next;
      skew = next.now - Date.now();
      if (nextMode !== mode) {
        mode = nextMode;
        if (mode === "tower") view.goalTarget.set(-9, 0, -14);
        view.goalZoom = mode === "tower" ? 28 : 9.5;
      }
      rebuild();
      if (!raf) raf = requestAnimationFrame(frame);
    },
    /** What is under a point on the canvas, shaped like the ink scene's click targets. */
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      for (const hit of ray.intersectObjects([dynamic, lodge.g], true)) {
        for (let o = hit.object; o; o = o.parent) {
          const d = o.userData;
          if (d.node) return { dataset: { node: d.node } };
          if (d.sighting) return { dataset: { sighting: String(d.sighting) } };
          if (d.waypoint) return { dataset: { waypoint: d.waypoint } };
          if (d.tower) return { dataset: { tower: mode === "tower" ? "down" : "up" } };
        }
      }
      return null;
    },
    /** The spot on the ground under a point on the canvas: [x, z]. */
    groundAt(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      const p = ray.ray.intersectPlane(ground, new THREE.Vector3());
      return p ? [p.x, p.z] : null;
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
