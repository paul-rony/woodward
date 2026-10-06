// The Woodward's server. Cube runs it with `node server.mjs` and sets $PORT; it keeps the wood ticking day and night,
// saves it under ~/.local/state/woodward, and streams every change to open pages over server-sent events.
import { createServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TICK_MS, build, clamp, gather, guessLocation, look, newState, relocate, snapshot, tick } from "./sim.mjs";

const port = Number(process.env.PORT);
if (!port) throw new Error("PORT is not set; Cube sets it when it starts the app.");

// For trying the night without waiting for it: WOODWARD_CLOCK_OFFSET_HOURS=10 node server.mjs
const clockOffset = Number(process.env.WOODWARD_CLOCK_OFFSET_HOURS || 0) * 3_600_000;
const clock = () => Date.now() + clockOffset;

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "public");
const stateDir = join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "woodward");
const statePath = join(stateDir, "wood.json");

function load() {
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    if (state.version === 1) return state;
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Could not read the saved wood, starting a new one:", err.message);
  }
  return newState(clock());
}

function save() {
  mkdirSync(stateDir, { recursive: true });
  const tmp = `${statePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, statePath);
}

const state = load();
const clients = new Set();

function broadcast() {
  const data = `data: ${JSON.stringify(snapshot(state, clock()))}\n\n`;
  for (const res of clients) res.write(data);
}

function advance() {
  tick(state, clock());
  save();
  broadcast();
}

advance();
setInterval(advance, TICK_MS);
setInterval(() => {
  for (const res of clients) res.write(": keepalive\n\n");
}, 15_000);

const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

function sendFile(res, rel) {
  // Only plain names inside public/, never a path that climbs out.
  if (!/^[a-z0-9-]+\.(html|mjs|js|css|svg)$/.test(rel)) return send(res, 404, { error: "Not found." });
  try {
    const body = readFileSync(join(publicDir, rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel)], "cache-control": "no-cache" }).end(body);
  } catch {
    send(res, 404, { error: "Not found." });
  }
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(body));
}

async function readJson(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 16_384) throw new Error("Request too large.");
  }
  return text ? JSON.parse(text) : {};
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false; // "Origin: null" and other non-URLs are a mismatch, never a crash
  }
}

/** Each action advances the wood to now first, so it acts on the present. */
const ACTIONS = {
  "/api/gather": (body, now) => gather(state, String(body.id), now),
  "/api/look": (body, now) => look(state, Number(body.id), now),
  "/api/build": (body, now) => build(state, String(body.id), now),
  "/api/hello": (body, now) => {
    // The first page to open tells the wood where in the world it is, roughly, from its timezone.
    if (state.location.guessed && !state.location.tz) relocate(state, guessLocation(String(body.tz || ""), Number(body.offsetMinutes) || 0), now);
    return { ok: true };
  },
  "/api/location": (body, now) => {
    const lat = Number(body.lat), lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: "Latitude and longitude must be numbers." };
    relocate(state, { lat: clamp(lat, -66, 66), lon: clamp(lon, -180, 180), tz: state.location.tz, guessed: false }, now);
    return { ok: true };
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  // Refuse a state-changing request from another origin: a page on any other site can make the browser send one.
  if (unsafe && !sameOrigin(req)) return send(res, 403, { error: "Cross-origin request refused." });

  if (req.method === "GET" && url.pathname === "/") return sendFile(res, "index.html");
  if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, snapshot(state, clock()));
  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write(`data: ${JSON.stringify(snapshot(state, clock()))}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (req.method === "POST" && ACTIONS[url.pathname]) {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: "The request body must be JSON." });
    }
    const now = clock();
    tick(state, now);
    const result = ACTIONS[url.pathname](body, now);
    tick(state, now); // settles what the action set in motion, such as a moved sky
    save();
    broadcast();
    return send(res, 200, result);
  }
  if (req.method === "GET") return sendFile(res, url.pathname.slice(1));
  send(res, 404, { error: "Not found." });
});

server.listen(port, "127.0.0.1", () => console.log(`The Woodward is keeping the wood on 127.0.0.1:${port}`));
