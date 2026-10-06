# The Woodward

A Cube app. You are the woodward of a lord's wood in the year of Our Lord 1150 (today's date, 876 years ago), and the
wood runs on the real sun, moon and seasons where you live. The codex is the whole interface: the left page is the
picture, the right page is the text, and the ribbons are the tabs.

## Why it is a Cube app

The wood only lives while its server runs. On a Cube that never sleeps:

- **Wat, your apprentice**, gathers whatever is ready from Prime to Vespers, while you are away.
- **The night watch.** Once the tower lantern is lit, Wat records in the Bestiary whatever passes in the dark: owls,
  badgers, the wolf pack, a will-o'-the-wisp, the white hart at twilight.
- **Bran the hound** drives off poachers at night. Without him, they raid the store.
- When the computer is off, nothing grows and nobody keeps watch, and the Chronicle says so.

## How it plays

- **Time** is told in canonical hours (Prime, Terce, Sext, None, Vespers, Compline, Matins, Lauds). These are medieval
  unequal hours: daylight and darkness are each divided into twelve.
- **Things grow by the real light.** Hazel and the King's Oak grow in sunlight. The fairy ring rises only in the dark
  and withers at midday. Moonwort opens once a night in full darkness and closes at sunrise.
- **Night is dangerous.** Going down into the wood after dark risks wolves: you drop what you gathered, or you twist
  an ankle and rest for two real hours. Bran, a brazier and a bright moon lower the risk. Watching from the tower is
  always safe.
- **The Bestiary & Herbal** has 39 pages: beasts, birds, herbs, folk and marvels. What appears depends on the hour,
  the moon and the real month (south of the equator, the seasons are shifted), so filling the book takes a year.
- **Works** are raised from the store: the Apprentice's Cot, Straw Skep, Bran's Kennel, Tower Lantern, Brazier, and
  the Wayside Cross.

## Running it

```sh
PORT=4711 node server.mjs                                # what Cube does
WOODWARD_CLOCK_OFFSET_HOURS=10 PORT=4712 node server.mjs  # try another hour without waiting for it
node --test                                              # the rules
```

The server is plain Node with no dependencies. It saves the wood to `~/.local/state/woodward/wood.json` (or
`$XDG_STATE_HOME/woodward`), ticks every 20 seconds, and streams snapshots to open pages over server-sent events. The
first page to open tells it roughly where in the world it is, from the browser's timezone; set it exactly from the
Hour page.

## Files

- `sim.mjs`: the rules (sky, growth, danger, sightings, Wat, Bran, works). Pure functions over a JSON state.
- `server.mjs`: the Cube contract (listen on `$PORT`), persistence, and the API.
- `public/bestiary.mjs`: every Bestiary entry, with when and where it appears and how it is drawn.
- `public/ink.mjs`: the seeded wobble pen behind every hand-inked line.
- `public/figures.mjs`, `public/scenes.mjs`: the drawings, and the clearing and tower views.
- `public/index.html`: the codex.

The art is generated SVG. Any figure can later be swapped for a hand-drawn SVG made in Inkscape.
