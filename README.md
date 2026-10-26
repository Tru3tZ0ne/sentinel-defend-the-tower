# Sentinel — Defend the Tower

An interactive "protect the building" game for **Sangfor's** international business
(product intros, presales, customer events). Players deploy Sangfor cybersecurity,
cloud, and AI capabilities to defend Meridian Tower against a stealthy breach — and
only *see* what their tools let them see.

> Design & roadmap: [`DESIGN.md`](./DESIGN.md) · [`TASKS.md`](./TASKS.md) ·
> art direction: [`ART_DIRECTION.md`](./ART_DIRECTION.md) ·
> asset provenance: [`assets/brand/ASSETS.md`](./assets/brand/ASSETS.md)

Current development: three assignments, three difficulty levels, playable infrastructure
preparation, a local helper-rule workflow, a reference-led dark command interface, bilingual
session review and JSON report export. Response choices have consequences — isolate the exact
device, lock down the room the actor is in, or restrict an area ahead of them to slow their
advance. Static scene detail is batched per floor for performance. Textured, rigged Mixamo business characters now replace the temporary figures, with idle,
walking and seated work animation. Realistic furniture and interiors remain an art milestone.
Character provenance and usage notes: [office assets](assets/models/office/ASSETS.md).

Developer records: [development log](docs/DEVELOPMENT_LOG.md),
[Claude Code continuation prompt](docs/CLAUDE_HANDOFF.md),
[facilitator guide](docs/FACILITATOR_GUIDE.md).

## Game modes

Several self-contained experiences share the brand, i18n and assets:

| Page | Mode | Engine |
| --- | --- | --- |
| `index.html` | **Defend the Tower** — office floors, detect→correlate→contain | detection engine (`src/game/`) |
| `cyber.html` | **Cyber Fortress** — circular neon rendering, same gameplay | detection engine |
| `cyber2.html` | **Defense-in-Depth** — Sangfor architecture tower, levels = layers | detection engine |
| `td.html` | **Kill Chain** — tower defense on a neon kill-chain lane | TD engine (`src/td/`) |
| `rush.html` | **Breach Rush** — fast radial-triage arcade with a **world ranking** | arcade engine (`src/rush/`) |
| `stack.html` | **Defense Stack** — a 2048-style merge up the Sangfor product ladder | `src/stack/` (+ `src/arcade/`) |
| `sort.html` | **Packet Sort** — snap ALLOW/BLOCK triage against the clock | `src/sort/` (+ `src/arcade/`) |
| `panic.html` | **Patch Panic** — whack-a-mole endpoint response with an MDR Sweep | `src/panic/` (+ `src/arcade/`) |
| `soc.html` | **Incident Zero** — live SOC: **XDR correlation** + stage-correct containment | `src/soc/` (+ `src/arcade/`) |
| `vector.html` | **Threat Vector** — survivor shooter: monsters charge, product **drops** level you up | `src/vector/` (+ `src/arcade/`) |

The last three are **quick-play arcade games** — pick-up-and-play, instant score, and each maps
to real Sangfor products. They share a small common layer in `src/arcade/` (bilingual strings,
the leaderboard factory `board.js`, and UI helpers). Each has its own local-first world ranking,
upgradable to a global board with the same `tools/leaderboard-worker.js` by setting its
`window.__STACK_API` / `window.__SORT_API` / `window.__PANIC_API`. Pure logic is unit-tested in
`tools/arcade-logic.test.mjs` (`node --test`).

**Incident Zero** (`soc.html`) is the deep one: the mechanics *are* the products' real
functions. Sensors (AF/EDR/NDR/IAG) raise alerts; a lone alert is noise, so you must
**correlate** cross-sensor alerts that share an IOC to confirm a real incident (XDR). A
confirmed incident advances along the kill chain and you **contain** it with the one product
whose real role stops that stage — AF at the perimeter, EDR on the endpoint, NDR on lateral
movement, IAG at egress, aStor snapshot-restore at ransomware (scarce), MDR as the managed
assist. Each product's honest **limitation** (from `src/data/products.js`) is enforced as a
fail state, so the wrong tool is punished. It is deliberately hard: alert fatigue, decoy IOCs,
multiple incidents advancing at once. The in-game Field Manual teaches the whole model.

**Threat Vector** (`vector.html`) is the lively, pick-up-and-play one — a "survivor"-style
arena. Monsters charge you from every side; you only move (WASD / arrows / drag) while your
defenses auto-fire. Killing threats **drops Sangfor products** (gold caches are guaranteed) that
slot in and level up the instant you touch them, with an on-pickup callout so you *feel* what
each one does. Crucially, every item boosts exactly what its real function is: **HCI** (cloud
compute) raises fire rate, **XDR** multiplies damage *only over the sensors feeding it* (grab it
with no EDR/NDR/AF and it does nothing — its real limitation), **EDR** is a close-range endpoint
aura, **NDR** reveals cloaked APTs and chains shots, **NGAF** adds perimeter bolts, **IAG** locks
exfil drones from escaping, **aStor** restores hull from snapshots, **MDR** fields a wingman, and
**SASE** shrinks the attack surface. The in-game **Product Codex** pairs each product's real job
with its in-game boost and honest limitation. Pure logic (stat mapping, loot table, difficulty,
scoring) is unit-tested alongside the others in `tools/arcade-logic.test.mjs`.

**Breach Rush** is a score-chasing arcade: threats race inward toward your data core,
you tap hostiles before they land and spare the legitimate traffic, chain combos, and
spend Sangfor powers (XDR / EDR / NDR). Enter a call sign and climb the leaderboard.
It ships with a local (per-device) ranking that works on static hosting out of the box;
for a true global board, deploy [`tools/leaderboard-worker.js`](tools/leaderboard-worker.js)
(a free Cloudflare Worker — deploy notes are in the file) and set `window.__RUSH_API`
in `rush.html`. No API keys live in the client.

## Run it locally

No build step. Any static server works:

```bash
npm run serve         # http://localhost:8123
# Alternatively:
python3 -m http.server 8080
```

Then open the printed URL. (Opening `index.html` via `file://` won't work — ES modules
need `http`.)

## Project structure

```
index.html              entry: import map for three + canvas/overlay (relative paths → Pages ready)
src/
  main.js               orchestrator: world + engine + overlay, interaction, spatial replay
  i18n.js               EN / 中文 strings (t/loc helpers)
  data/
    products.js         product catalog (roles, cost, visibility, world presence) — edit freely
    scenario.js         two-floor layout, cast and baseline incident
    missions.js         three incident schedules and difficulty settings
    operations.js       HCI, ADC, SASE and AICP planning rules
    session-copy.js     EN/ZH mission, planning and debrief copy
  game/
    engine.js           phase-based simulation: fog-of-war, deploy/respond, win/lose, replay log
    sophia.js           Sophia's layered, building-pointing hints
  world/
    world.js            Three.js scene: camera, lights, orbit, picking
    building.js         generates both floors, signage, temporary furniture and the shared nav graph
    people.js           navigation and behavior with async character replacement
    character-visuals.js licensed business models, shared resources and animation
    fx.js               product props, clue markers, trails, containment visuals
  ui/
    overlay.js          DOM overlay: HUD, deploy tray, inspect card, feed, Sophia, end/replay
    icons.js            original SVG icon set
    audio.js            opt-in, locally synthesized office ambience
  style/main.css        core UI layout
  style/workspace.css   dark command-interface presentation skin
  vendor/three/         vendored Three.js r160 + OrbitControls (local, offline-friendly)
assets/brand/           official logo images and recorded sources
tools/                  static server, engine tests and browser tests
```

Rendering uses **Three.js r160**, batched procedural office geometry and locally bundled
animated GLB business characters.
The library is vendored locally (no CDN), so the app loads fast and works offline.

## Test (headless)

```bash
npm install            # installs Playwright
npx playwright install chromium
npm test               # engine rules + original smoke + actual UI/canvas interactions
npm run test:engine    # fast deterministic rule regressions
npm run test:ui        # mission selection, real canvas deployment, recovery, review and reports
```

## Deploy to GitHub Pages

Because everything is static with relative paths, deployment is just pushing the repo
and enabling Pages (branch `main`, root). The app then runs at
`https://<user>.github.io/<repo>/`. Feature branches should be reviewed before merging
into the configured Pages source branch.

## Controls

Drag to orbit, scroll to zoom, and use the floor buttons or **1 / 2** to switch floors.
**H** returns to the floor overview, **`[` / `]`** cycle room inspection on the active floor,
**Enter** begins the day in setup, **Escape** cancels placement (or clears the current
inspection), and **Space** pauses or resumes a live incident. Sound starts muted and can be
enabled in the top bar. Choose the assignment and difficulty before entering setup; setup has
no time limit.

## Localization

Toggle EN / 中文 anytime with the language button. UI strings live in `src/i18n.js`;
product blurbs and level text carry `{ en, zh }` fields in `src/data/`.

## Branding note

Official Sangfor logo images are recorded in `assets/brand/ASSETS.md` and used unchanged.
The green UI accents are approximate; confirm exact numeric palette values against
official brand guidelines before final brand approval.


### Current command interface

The reference-led dark interface uses official Sangfor/Athena/Cloud assets and the Solvia
panda guide. Setup supports full-refund undo/reset. SASE changes the next foothold route;
snapshot restoration costs 2 credits and takes 6 seconds (4 with HCI), with progress and
cancellation. Mission objectives and English reports expose actual outcomes.

See [the development record](docs/DEVELOPMENT_LOG.md) and
[Claude continuation prompt](docs/CLAUDE_HANDOFF.md). Procedural scene assets remain
intermediate placeholders; realistic character and furniture production is deferred.
