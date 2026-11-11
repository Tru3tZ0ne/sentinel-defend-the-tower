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
| `line.html` | **Breach Line** — a Plants-vs-Zombies lane defense; deploy product **defenders** in a grid | `src/line/` (+ `src/arcade/`) |
| `stand.html` | **Last Stand** — a vertical survivor shooter; products mount on **one evolving mech** | `src/stand/` (+ `src/arcade/`) |
| `stand3d.html` | **Sentinel Strike** — a Raiden-style 3D vertical shooter; every power-up is a Sangfor product | `src/strike/` (+ `src/arcade/`) |
| `frame.html` | **Sentinel Frame** — a 3D mecha shooter; each Sangfor product bolts onto a hardpoint and the frame evolves to Full Armor | `src/frame/` (+ `src/arcade/`) |
| `counter.html` | **Sentinel Counter-Breach** — a round-based first-person site defense with a competitive-shooter HUD; buy Sangfor products between rounds, stop the Ransomware carrier planting an encryptor | `src/counter/` (+ `src/arcade/`) |
| `counter-v2.html` | **Sentinel Counter-Breach v2** — jump, crouch, cover, round incidents, contracts and persistent career progression | `src/counter/` (+ `src/arcade/`) |

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

**Breach Line** (`line.html`) is a Plants-vs-Zombies-style lane defense. Threats march
right-to-left down five straight lanes; you spend **compute** to deploy Sangfor defenders in
the grid from a 3D-style seed bar carrying each product's logo, and every defender fights the
way its product really works: **HCI** generates the compute economy (cloud capacity), **NGAF**
is a lane firewall, **IAG** slows traffic it hits, **Cyber Command (NDR)** fires across three
lanes at once (network-wide sight), **EDR** devours whatever gets close (endpoint response),
**aStor** is a self-healing wall (snapshot resilience), and **XDR** calls an instant correlation
strike whose blast scales with how many sensors (NGAF/NDR/EDR) are on the board. Stealthed
**APTs** are only half-seen by the perimeter firewall but hit in full by NDR/EDR, and **MDR** is
your managed last line that saves each lane once. Exaggerated per-product FX (firewall tracers,
frost slows, tri-lane beams, endpoint shockwaves, an XDR lightning web, an MDR sweep) make each
capability legible at a glance. The in-game Product Codex pairs every product's real job with its
on-board role and honest limitation. Pure logic is unit-tested in `tools/arcade-logic.test.mjs`.

**Last Stand** (`stand.html`) is a real-time 3D, **120-second event campaign**.
Start with **10,000 HP**, a basic robot and a first-module choice against three bosses at
25, 60 and 95 seconds. **Cyber Command alone** guides ordinary bullets;
MDR tracks independently from level one; CC still boosts its damage. Products become shoulder
cannons, a managed gun arm, a shield and server pods on the robot. Armor grows
through four stages. Modules visibly charge **XDR**, whose compact branded
backpack discharges a thin chain of lightning through up to seven nearby targets.
CC focuses on guided fire and marking; its former horizontal laser strips are removed.
Warm matte armor, deep-green insets, metal joints and integrated product pods
give the mech a consistent material design. A continuous composite arena replaces
the repeated riveted metal deck; restrained HUD surfaces match the scene.
No permanent product appliances accumulate on the floor.
Dodge red boss lanes and time Q/E/R support. Press **F** or tap **Agent Builder**
beside the services to run **Detect → Analyze → Contain → Recover**. Its compact
trace appears during execution, and its wrist controller is cached. HCI/AI improve
the workflow; completion delivers work/recovery, with compute cost and cooldown.
Agent Builder is an active ability, removed from passive product upgrades.
A clear requires three real boss
deaths by 120 seconds and surviving HP/business availability.

Balance security with **HCI business capacity, AI and Agent Builder**. Compute
shortages reduce availability and output; cloud-only investment is vulnerable.
Rank completed defenses by **55% HP + 25% business + 12% AI + 8% Agent Builder**.
The new enterprise board preserves previous scores and is local by default.
Nonblocking upgrade choices now last **10 active seconds**, then automatically
deploy the highlighted recommendation. Pause freezes the countdown.
Bilingual interfaces and full-quality 3D remain.
The combined seeded casual mixed-build samples clear 75.6% desktop / 71.1% phone; this is
simulation evidence, not a measured human win rate or guaranteed completion.
Desktop remains above the approximate 60–70% goal; human testing is recommended.

These are fictional arcade mechanics and equipment concepts inspired by product
roles. `stand-sangfor.html` offers the equipment preview; `stand-showroom.html`
provides optional close inspection of the original eight equipment concepts.
Owned-product icons show their name, level and a short effect description in both languages.
See the [matte chassis and arena record](docs/STAND_MATTE_ARENA.md),
[active workflow rules](docs/STAND_AGENT_WORKFLOW.md)
and [English continuation brief](docs/CLAUDE_STAND_VISUALS_HANDOFF.txt), review tag
`stand-matte-arena-v1`. Checks run through `npm run test:stand-art`.

**Sentinel Strike** (`stand3d.html`) is a Raiden-style vertical shooter rendered in real 3D:
the fight is on a flat plane, with a city of data towers streaming past far below. You fly a
Sangfor interceptor through three zones (Perimeter, Data Center, Cloud Core), each ending in a
boss (Botnet Controller, Ransomware Brute, APT Siege Engine). Supply carriers drop product
coins that cycle between products every two seconds, Raiden style, so the pilot chooses a
build. Each product fights the way it really works: **Endpoint Secure** is a wide vulcan
spread, **NGAF** a narrow piercing firewall beam, **XDR** chain plasma that is weak alone and
scales with every support product feeding it, **Cyber Command** homing missiles that also
reveal cloaked APTs (which otherwise take half damage), **HCI** scale-out wingmen and fire
rate, **IAG** a ring that slows hostile bullets, **aStor** a snapshot shield that absorbs a hit
and keeps the build, and **MDR** the Incident Response bomb. Mouse, keyboard or touch drag;
auto-fire; three lives; local ranking (`sentinel.strike.scores.v1`, optional
`window.__STRIKE_API`). `src/strike/sim.js` is the pure simulation, `engine.js` the Three.js
view, `main-strike.js` the HUD. Checks: `npm run test:strike`; `node tools/strike-balance.mjs`
flies scripted pilots (casual 24/30 clears, sharp 30/30, idle 0/6). Those bots dodge better
than people do, so they are not human win rates, and it has only been run under software
WebGL here, so no hardware frame rate is claimed.

**Sentinel Frame** (`frame.html`) is the mecha version of the shooter. The SF-01 frame launches
bare; every product docks onto a fixed hardpoint, has three levels, and all of them stack:
Endpoint Secure = right-arm beam rifle, NGAF = left-arm firewall shield (blocks fire from the
front only, overloads, reflects at level 3), Cyber Command = head sensor fins + leg missile pods
(homing, decloaks APTs), XDR = wing funnels (chain beams scaled by how many other products are
installed), HCI = reactor backpack (fire rate), IAG = shoulder emitters (bullet slow field),
aStor = snapshot armor, MDR = bomb. At 3 / 8 / 15 installed levels the frame evolves
(Mk-II, Mk-III, Full Armor). A hit costs a life and one level of the best part. Start, pause
and result screens use a hangar orbit of the live model. `src/frame/sim.js` is the pure
simulation, `engine.js` the Three.js view (procedural mecha), `main-frame.js` the HUD. Checks:
`npm run test:frame`; `node tools/frame-balance.mjs` flies scripted pilots (bots, not human rates).

**Sentinel Counter-Breach** (`counter.html`) is a round-based first-person shooter, first to
four rounds. Threats breach from the Internet strip through three gates and a Ransomware
carrier tries to plant an encryptor on Site A or B; kill it, or defuse the encryptor. Each
round opens with a buy phase: Endpoint Secure = the rifle, NGAF = firewalls on gates you pick
(worms start inside, a Zero-Day walks through), Cyber Command = radar / uncloaks APTs / x-ray,
XDR = chain response scaled by products owned, HCI = armor and failover, IAG = Access Denied
grenade (APTs barely slowed), aStor = one snapshot that restores an encrypted site, MDR = one
remote defuse or sweep. The HUD follows competitive-shooter conventions: rotating radar, kill
feed naming the product, vitals, ammo, buy grid, per-product scoreboard, plus damage numbers,
multi-kill callouts and on-screen objective pointers. Movement has jump, crouch and aim down
sights: waist-high crates are cover (crouch behind one to break an APT's line, jump onto one and
worms cannot bite, jump a Trojan shot to dodge it). From round 2 each round is a different
incident (worm outbreak, spear-phishing, insider threat, DDoS flood, fast encryptor) that the
buy menu announces along with the product that answers it; every round also offers one paid
contract (headshots, airborne kill, triple kill, ...). Three difficulties scale damage, threat
health and score; a Daily Op uses a date seed; XP, rank and eight medals persist in
localStorage. `src/counter/sim.js`
is the pure simulation (grid map, path fields, hitscan), `engine.js` the Three.js view and
input (pointer lock, touch sticks with aim assist), `main-counter.js` the HUD. Checks:
`npm run test:counter`; `node tools/counter-balance.mjs` plays scripted bots (not human rates).

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


### Counter-Breach v2 release

The dedicated public entry is [counter-v2.html](counter-v2.html), based on upstream
commit `91f7051`. It adds jump, crouch, aiming, cover, round incidents, paid contracts,
three difficulties, daily seeds, pickups, kill streaks and local career progression.
Existing HTML entry points remain available; both Counter-Breach entries share the
current `src/counter/` runtime. This is a new launch URL, not an archived runtime snapshot.

Release validation: `COUNTER_ENTRY=/counter-v2.html npm run test:counter` runs the
rule suite and desktop/mobile browser flow against the new entry. Career and score
storage remain local unless a leaderboard API is explicitly configured.
