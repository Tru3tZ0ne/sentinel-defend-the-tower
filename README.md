# Sentinel — Defend the Tower

An interactive "protect the building" game for **Sangfor's** international business
(product intros, presales, customer events). Players deploy Sangfor cybersecurity,
cloud, and AI capabilities to defend Meridian Tower against a stealthy breach — and
only *see* what their tools let them see.

> Design & roadmap: [`DESIGN.md`](./DESIGN.md) · [`TASKS.md`](./TASKS.md) ·
> asset provenance: [`assets/brand/ASSETS.md`](./assets/brand/ASSETS.md)

## Run it locally

No build step. Any static server works:

```bash
npx serve .            # or:
python3 -m http.server 8080
```

Then open the printed URL. (Opening `index.html` via `file://` won't work — ES modules
need `http`.)

## Project structure

```
index.html              entry (relative paths → GitHub Pages ready)
src/
  main.js               app controller: screens, timer, event wiring
  i18n.js               EN / 中文 strings (t/loc helpers)
  data/
    products.js         product catalog (roles, cost, visibility) — edit freely
    level1.js           building layout + ground-truth incident timeline
  game/
    engine.js           simulation: fog-of-war, deploy/respond, win/lose, replay log
    sophia.js           Sophia's layered, event-triggered hints
  ui/
    render.js           presentational builders (HTML strings)
    icons.js            original SVG icon set
  style/main.css        command-center theme
assets/brand/           logo placeholder + asset sources
tools/                  static server + headless smoke test
```

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
