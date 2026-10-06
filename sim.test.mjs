import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_STEP_MS, poachers, build, canonicalHour, environment, gather, look, moonPhase, newState, nextSunCrossing, sunPosition, tick } from "./sim.mjs";

const LONDON = { lat: 51.5, lon: -0.1, tz: "Europe/London", guessed: false };
const at = (iso) => Date.parse(iso);
const dice = (...values) => { let i = 0; return () => values[i++ % values.length]; };

function wood(iso, location = LONDON) {
  const s = newState(at(iso));
  s.location = location;
  return s;
}

test("the sun is high at a London noon in June and below the horizon at midnight", () => {
  assert.ok(sunPosition(new Date(at("2026-06-21T12:00Z")), 51.5, -0.1).elevation > 60);
  assert.ok(sunPosition(new Date(at("2026-06-21T00:00Z")), 51.5, -0.1).elevation < -10);
});

test("sunrise in London on the equinox is close to 06:00 UTC", () => {
  const rise = nextSunCrossing(at("2026-03-20T00:00Z"), 51.5, -0.1, true);
  assert.ok(Math.abs(rise - at("2026-03-20T06:03Z")) < 15 * 60_000);
});

test("the moon was full on 2026-03-03", () => {
  assert.ok(moonPhase(new Date(at("2026-03-03T12:00Z"))).illumination > 0.97);
});

test("canonical hours split daylight into twelve", () => {
  const c = canonicalHour(at("2026-06-21T12:10Z"), 51.5, -0.1);
  assert.equal(c.of, "day");
  assert.equal(c.office, "Sext");
});

test("hazel regrows only in sunlight", () => {
  const s = wood("2026-06-21T22:00Z");
  s.nodes.hazel1.growth = 0;
  for (let t = at("2026-06-21T22:00Z"); t <= at("2026-06-22T02:00Z"); t += 20_000) tick(s, t, () => 1);
  assert.equal(s.nodes.hazel1.growth, 0);
  for (let t = at("2026-06-22T08:00Z"); t <= at("2026-06-22T11:00Z"); t += 20_000) tick(s, t, () => 1);
  assert.ok(s.nodes.hazel1.growth > 0);
});

test("going out at night can go wrong; by day it cannot", () => {
  const night = wood("2026-06-22T00:00Z");
  assert.ok(environment(night, at("2026-06-22T00:00Z")).risk > 0);
  const r = gather(night, "hazel1", at("2026-06-22T00:00Z"), dice(0, 0.9));
  assert.equal(r.outcome, "hurt");
  assert.equal(gather(night, "hazel2", at("2026-06-22T00:30Z")).outcome, "resting");

  const day = wood("2026-06-22T12:00Z");
  assert.equal(gather(day, "hazel1", at("2026-06-22T12:00Z"), () => 0).outcome, "gathered");
  assert.equal(day.inv.poles, 3);
  assert.ok(day.book.hazel, "gathering records the herbal page");
});

test("a gap while the computer was off is logged and not caught up", () => {
  const s = wood("2026-06-22T08:00Z");
  s.nodes.hazel1.growth = 0;
  tick(s, at("2026-06-22T08:00Z") + MAX_STEP_MS + 3 * 3_600_000, () => 1);
  assert.equal(s.nodes.hazel1.growth, 0);
  assert.equal(s.journal.at(-1).kind, "gap");
});

test("looking at a sighting writes its page once and counts later sightings", () => {
  const t = at("2026-06-22T12:00Z");
  const s = wood("2026-06-22T12:00Z");
  s.sightings.push({ id: 99, entry: "heron", appearedAt: t, until: t + 60_000, x: 0, y: 0, seenBy: [] });
  assert.equal(look(s, 99, t).isNew, true);
  assert.equal(s.book.heron.count, 1);
  assert.equal(look(s, 99, t).isNew, false);
});

test("Wat keeps the night watch once the tower lantern is lit", () => {
  const t0 = at("2026-06-21T23:00Z");
  const s = wood("2026-06-21T23:00Z");
  Object.assign(s.inv, { poles: 20, berries: 20, timber: 20, honey: 20 });
  assert.ok(build(s, "cot", t0).ok);
  assert.ok(build(s, "beacon", t0).ok);
  s.sightings.push({ id: 7, entry: "tawny", appearedAt: t0, until: t0 + 3_600_000, x: 0, y: 0, seenBy: [] });
  for (let t = t0; t <= t0 + 2 * 60_000; t += 20_000) tick(s, t, () => 1);
  assert.equal(s.book.tawny.by, "wat");
});

test("without Bran, poachers take half the largest store; with him they flee", () => {
  const t0 = at("2026-06-22T00:00Z");
  const s = wood("2026-06-22T00:00Z");
  s.inv.timber = 8;
  poachers(s, t0, () => 0.5);
  assert.equal(s.inv.timber, 4);
  s.built.kennel = t0;
  poachers(s, t0 + 1, () => 0.5);
  assert.equal(s.inv.timber, 4);
  assert.equal(s.stats.raidsDriven, 1);
});
