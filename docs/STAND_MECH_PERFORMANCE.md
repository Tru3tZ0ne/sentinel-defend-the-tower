# Last Stand: modular mech and active-combat performance

Review tag: `stand-mech-performance-v1`.
Development branch: `perf/stand-active-combat`.
Previous release: `0b886d6` / `stand-enterprise-balance-v1`.

## Result

Last Stand now starts with one basic robot, 10,000 HP and no preinstalled
products. The opening EDR/MDR/HCI choice mounts the first product. Further
upgrades add physical product modules and progressively armored mech stages,
instead of filling the floor with separate appliances. The same campaign runs
in `stand.html` and `stand-sangfor.html`; the existing eight-product showroom
continues to inspect the earlier individual equipment concepts.

| Upgrade | Visible module |
| --- | --- |
| EDR | Endpoint chassis and twin shoulder cannons |
| MDR | Managed gun arm |
| NGAF | Arm shield and projected forward barrier |
| Cyber Command (`NDR`) | Head-mounted sensor and horizontal side laser strips |
| HCI | Server compute pod |
| XDR | Central backpack with official mark and compact XDR nameplate |
| aStor | Hip-mounted storage pod |
| IAG | Leg-mounted gateway module and slowing field |
| AI | Compute module using the official AICP mark |
| Agent Builder | Wrist workflow console with a functional label |

These are original arcade sculptures inspired by Sangfor product roles and
hardware details, not official commercial robot/appliance specifications. The
Agent Builder console does not claim a new official logo. Existing official
brand artwork is reused; no new downloaded or generated bitmap assets are needed.

Armor stages begin at 0, 3, 7 and 14 total purchased product levels. Modules
also grow modestly with upgrades. XDR's previous 108x44 floating callout is
removed in the mech entries. Its beam starts at the moving backpack; its
target remains committed during the short firing window. Every owned product
still contributes a visible charging link. No extra passive damage was added.

The phone upgrade dock moves to a compact bottom-right row, leaving the
left support column, HP strip and forward enemy view available. Choice keys,
tap input and the three-second recommendation remain. Toasts move above an
open choice row. Portrait framing reserves room for the full armored silhouette.
Both languages describe mounted products and the empty opening accurately.

## Combat and score contract

- Three real bosses at 25/60/95 seconds; the deadline remains 120 active seconds.
- Real defeat on zero HP, zero service availability or an uncleared boss.
- Ordinary projectiles need both CC and XDR for limited forward-cone guidance.
  MDR retains CC-only tracking and its existing damage/rate bonuses.
- HCI, business availability, AI work and Agent Builder remain real workloads.
  Total score remains 55% HP / 25% business / 12% AI / 8% agents.
- Only victories rank; existing storage keys and earlier boards remain intact.
  Ranking is browser-local unless a separate backend is configured.
- Removing starter equipment required ordinary/boss HP retuning; it did not
  introduce guaranteed clears, automatic boss damage or a health floor.

## Performance implementation

`combat-runtime.js` replaces exhaustive projectile collision candidates with a
reusable spatial index. Candidates retain original enemy order, including worm
children born during the same piercing hit. Four seeds at each viewport match
the exhaustive production-combat adapter exactly. The randomized boundary test
also compares 4,000 queries against exhaustive circle hits.

Projectile objects and hit Sets, particles, rings, lightning and damage text are
recycled. Stable in-place compaction avoids six new filtered arrays per update.
Pool retention bounds limit idle memory only: they never trim live effects.
The overlay reuses projected result objects and lightning coordinate buffers.
HUD score/workload calculations are shared within each push.

The operator, armor and product modules survive upgrades/replays; support-team
models return to team pools. Existing instanced threats and one-draw bullets
remain. Antialiasing, mesh detail, shadows, bloom, lights, animation, particles,
lightning, damage numbers and native DPR up to 2 are retained. No runtime
dependencies, resolution fallback or additional entity/effect caps were added.

### Fixed-load evidence

Same counts: ten maxed products, support teams, 64 threats, 256 projectiles,
CC strips, charging links and XDR beam. The old appliance layout becomes the
new mech layout, so this is a scene-cost comparison, not identical geometry.

| Metric | Previous release | Mech release |
| --- | ---: | ---: |
| Draw calls | 440 | 333 |
| Triangles | 526,724 | 491,226 |
| Geometries | 129 | 112 |
| Bullet draw calls | 1 | 1 |
| Verified native DPR | 2 | 2 |

Draw calls fall by 24.3%. This is not an FPS percentage. The base fixture clears
transient overlay effects for reproducible scene counts. A separate FX fixture
retains all 3,000 particles, 80 damage texts and 24 lightning effects; assertions
verify none are dropped. Reintroducing threats and replaying reuse geometry;
growing bullet capacity to 1,024 retains its shared geometry.

### Active combat and balance

The active runner plays actual production combat with movement, normal random
upgrade offers and support. It does not modify HP, time, enemies or FX arrays.
It records renderer identity, frame intervals, callback CPU, long tasks, heap,
collision candidates, model builds and live effect counts at one-second samples.
Use `node tools/stand-active-performance.mjs mech` and inspect the JSON trace.
Timing is machine-specific, especially under software WebGL, and does not
establish performance on the event laptop or an arbitrary phone.

Two actual browser runs reached the full 120-second deadline without clearing
effects or changing HP/time. One cleared three bosses with 5,750 HP; the other
cleared two with 10,000 HP and correctly failed the boss deadline. Random
offers, frame scheduling and input delivery affect these natural runs; neither
is an identical-workload comparison with the previous release.

The preserved final trace uses ANGLE/SwiftShader (software Vulkan), with frame
interval p50/p95 of 266.7/333.3ms and callback CPU p95 of 10.6ms. It is visibly
slow under software rasterization and cannot certify event-hardware smoothness.
Its sampled peaks include 36 threats, 61 projectiles, 699 particles, 94 damage
texts and 144 ring/lightning effects, with zero page errors. By 119s, collision
candidates are 97,886 versus 1,352,444 exhaustive candidates (92.8% fewer in
that trace). Operator/support model builds stay at ten from 30s onward while
additional purchased modules are cached individually. Heap readings exposed
by this browser are coarse and are not used to claim memory stability.

Validation results and selected traces are stored alongside this record in
`stand-mech-validation.json`. Staged screenshots are labeled `FIXTURE`; natural
combat traces are explicitly separate. The ordinary mixed-build target remains
roughly 60-70% in the scripted policy, not a promised human win rate. Actual
first-time-player and hardware-GPU checks remain useful release follow-ups.

Production-combat regression coverage passes 23 groups (18 campaign and five
runtime groups). The established engine/rush/arcade suites pass 65 groups.
Browser checks cover both languages, actual kill-to-upgrade flow, all modules,
support, phone controls/choices, XDR charging/firing, failure and real victory
callbacks, score isolation, replay and the eight-model showroom.

| Scripted policy | Desktop clears | Phone clears |
| --- | ---: | ---: |
| Casual mixed, 60 seeds | 39/60 (65%) | 40/60 (66.7%) |
| Informed mixed | 12/12 | 12/12 |
| Cloud only | 0/12 | 0/12 |
| No input | 0/12 | 0/12 |
| Casual held-out, 30 seeds | 22/30 (73.3%) | 23/30 (76.7%) |
| Combined casual samples | 61/90 (67.8%) | 63/90 (70%) |

Main seeds are `101 + i*37`; held-out seeds are `5001 + i*37`. Viewports are
1440x942 and 390x786. Casual input reacts every 1.15s with sweep aim, warned
lane evasion and conditional support; informed input reacts every 0.2s and
aims at the leading threat. All use real randomized offers. Cloud-only and
no-input builds can fail before the deadline. The higher held-out clear rates
are reported rather than tuned away. These deterministic policies do not
measure how first-time human players choose, aim or use support.

## Reproduce and continue

- `npm run test:stand-art`: production balance/runtime, browser, full scene,
  FX retention, resource reuse and DPR checks.
- `node tools/stand-active-performance.mjs mech`: actual two-minute combat trace.
- `node tools/stand-balance.mjs`: policies extracted from production combat.
- Read `CLAUDE_STAND_VISUALS_HANDOFF.txt` for the English continuation prompt.

Keep previous tags intact. Review the deployed Pages cache marker as well as
the Git commit: a feature branch alone does not update the public game. This
release's entry/engine/model/style marker is `campaign=active-combat-v1` and
its art import is `art=mech-v1`.
