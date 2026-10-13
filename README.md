# Sentinel — Defend the Tower

An interactive "protect the building" game for **Sangfor's** international business
(product intros, presales, customer events). Players deploy Sangfor cybersecurity,
cloud, and AI capabilities to defend Meridian Tower against a stealthy breach — and
only *see* what their tools let them see.

> Design & roadmap: [`DESIGN.md`](./DESIGN.md) · [`TASKS.md`](./TASKS.md) ·
> art direction: [`ART_DIRECTION.md`](./ART_DIRECTION.md) ·
> asset provenance: [`assets/brand/ASSETS.md`](./assets/brand/ASSETS.md)

## Run it locally

No build step. Any static server works:

```bash
npx serve .            # or:
python3 -m http.server 8080
```

Then open the printed URL. (Opening `index.html` via `file://` won't work — ES modules
need `http`.)

## Project structure (Milestone 2 — 3D)

```
index.html              entry: import map for three + canvas/overlay (relative paths → Pages ready)
src/
  main.js               orchestrator: world + engine + overlay, interaction, spatial replay
  i18n.js               EN / 中文 strings (t/loc helpers)
  data/
    products.js         product catalog (roles, cost, visibility, world presence) — edit freely
    scenario.js         single-floor layout (room footprints) + cast + ground-truth incident
  game/
    engine.js           phase-based simulation: fog-of-war, deploy/respond, win/lose, replay log
    sophia.js           Sophia's layered, building-pointing hints
  world/
    world.js            Three.js scene: camera, lights, orbit, picking
    building.js         generates the single-floor diorama (rooms, corridor, signage, furniture) + nav graph
    people.js           low-poly figures that walk the nav graph
    fx.js               product props, clue markers, trails, containment visuals
  ui/
    overlay.js          DOM overlay: HUD, deploy tray, inspect card, feed, Sophia, end/replay
    icons.js            original SVG icon set
  style/main.css        command-center theme over the canvas
  vendor/three/         vendored Three.js r160 + OrbitControls (local, offline-friendly)
assets/brand/           logo placeholder + asset sources
tools/                  static server + headless smoke test
```

Rendering is **Three.js (WebGL 2)**, low-poly stylized for performance on laptops/tablets.
The library is vendored locally (no CDN), so the app loads fast and works offline.

## Test (headless)

```bash
npm install            # installs Playwright
npx playwright install chromium
npm test               # runs tools/smoke.mjs: loads the game, plays a scenario,
                       # fails on console errors, writes screenshots to tools/shots/
```

## Deploy to GitHub Pages

Because everything is static with relative paths, deployment is just pushing the repo
and enabling Pages (branch `main`, root). The app then runs at
`https://<user>.github.io/<repo>/`. (Not yet pushed — see `TASKS.md`.)

## Localization

Toggle EN / 中文 anytime with the language button. UI strings live in `src/i18n.js`;
product blurbs and level text carry `{ en, zh }` fields in `src/data/`.

## Branding note

The logo and Sangfor-red accent are **reasoned placeholders**. Confirm the exact brand
color and drop in official logo/product assets before any customer-facing use.
