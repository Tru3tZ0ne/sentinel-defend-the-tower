# Last Stand: XDR chain lightning and mechanical refinement

Release tag: `stand-chain-mech-v1`. Branch: `feat/stand-chain-mech`.
Base: `8debe88` / `stand-mech-performance-v1`.

## Delivered behavior

- MDR fires autonomous tracking rounds from level one, without CC or XDR.
  CC retains its existing MDR damage bonus. Ordinary operator, EDR and support
  rounds still need **both CC and XDR** for limited forward-cone guidance.
- XDR's thick laser column is replaced by white-green, animated 3D lightning.
  Owned modules visibly charge the backpack for 0.65 seconds before discharge.
  The primary target uses the existing forward cone and range. Lightning then
  hops to the nearest unselected neighbor within the sensor-scaled jump range.
- A pulse can hit up to 2-5 distinct targets, depending on XDR level and sensor count.
  Each hop starts 65ms after the preceding one, hits once and retains 65% of
  the preceding damage. The pulse lasts 0.62 seconds. The source follows the
  backpack, and endpoints follow the selected targets. Dead targets are skipped;
  they do not grant a free replacement. Visual segments cause no incidental
  line damage. Pulse kills cannot recursively trigger extra correlation damage.
  The older bounded on-kill correlation for other weapons remains.
- Rounded helmet, segmented armor, metal shoulder/elbow/knee joints, pistons,
  collar, waist and boots replace the blockier bare robot details. Smoother
  geometry is scoped to the mech. Product modules, official marks, progressive
  armor, pooling and compact phone choices remain. No new external assets,
  libraries, panels or permanent floor devices were added.

Damage and cooldown scaling remain sensor dependent. The pulse uses 0.62 of
the former nominal beam damage for its first hit, then decays; it is a new
combat shape, not an assertion of identical DPS. Aim, positioning, boss-lane
evasion, mixed upgrades and timed support remain necessary.

Campaign/scoring rules remain: 10,000 starting HP, empty product loadout,
bosses at 25/60/95 seconds, all three actually defeated by 120 seconds, real
HP/service failure, and victory-only ranking weighted 55/25/12/8 across
HP/business/AI/Agent Builder. Ranking remains browser-local by default.

## Code and regression evidence

`engine.js` owns `S.arc`, `S.xdrAcc`, target planning and per-node impacts;
`model.js` exposes `xdrOn`, `xdrDmg`, `xdrEvery`, `xdrTargets` and
`xdrJumpRange`. Old beam properties and segment-distance collision were removed.
`instances.js` supports separate endpoint heights. Lightning reuses the existing
energy instances: at most 35 hop segments + nine module links + six CC segments,
within the existing capacity of 64. `mech-art.js` and the smooth kit in
`sangfor-art.js` contain the mechanical refinement. `main-stand.js` updates
both language interfaces and the MDR/XDR instructions.

- Production combat/runtime: **24 groups** (19 campaign + five runtime).
  Covers autonomous MDR, the guidance ownership matrix, unique bounded hops,
  falloff, single impact, bystander safety, dead-target skips, jump range,
  moving source, pause and the existing exhaustive/spatial equivalence checks.
- Existing engine/rush/arcade: **65 groups**.
- Browser integration: both languages, desktop/phone, real kill-to-upgrade,
  charging/three-target discharge, results, replay and showroom. Screenshots
  marked `FIXTURE` use staged durable enemies, not natural-play evidence.
  The phone lightning fixture starts at phone dimensions, rather than reusing
  off-screen desktop target coordinates.
- Fixed stress and FX-retention checks pass without lowering their budgets.

## Scene cost and limits

| Fixed stress metric | Previous mech tag | This tag |
| --- | ---: | ---: |
| Draw calls | 333 | 333 |
| Triangles | 491,226 | 536,246 |
| Geometries | 112 | 110 |
| Bullet draw calls | 1 | 1 |
| Verified DPR | 2 | 2 |

The stress fixture contains ten maxed products, support, 64 threats, 256 bullets,
CC strips and five-node lightning. Smoother mech geometry raises triangles by
9.2%; this release does **not** claim an FPS improvement. Geometry reuse,
1,024-bullet capacity growth and all 3,000 particles / 80 damage texts /
24 lightning effects in the separate FX fixture remain verified. Inspection
scene: 233 draws, 141,680 triangles, 119 geometries, within unchanged budgets.

An actual production-combat trace with effects untouched is recorded in
`stand-chain-validation.json`, along with renderer identity and timing. Software
WebGL measurements cannot certify smoothness on event hardware. Validate a
full late-game run on the actual laptop and phone before making FPS claims.

This trace reached 120 seconds with three bosses defeated and 8,200 HP, zero
page errors, and sampled peaks of 26 enemies, 59 shots, 692 particles, 112 damage
texts and 124 ring/lightning effects. ANGLE/SwiftShader frame-interval p50/p95
was 299.9/333.4ms; callback CPU p95 was 11ms. The software-rendered run is slow,
and these timings are not a controlled comparison against the earlier release.

## Balance evidence

No additional boss/HP tuning was applied after these changes. The production
combat probe uses real randomized upgrade offers and 1/60-second steps.
Casual policy reacts every 1.15s, sweeps aim, evades warned lanes and uses
conditional support. Informed policy reacts every 0.2s and aims at leading threats.

| Policy/sample | Desktop | Phone |
| --- | ---: | ---: |
| Casual, main 60 seeds | 38/60 (63.3%) | 32/60 (53.3%) |
| Casual, held-out 30 seeds | 18/30 (60%) | 22/30 (73.3%) |
| Combined casual | 56/90 (62.2%) | 54/90 (60%) |
| Informed, 12 seeds | 12/12 | 12/12 |
| Cloud only, 12 seeds | 0/12 | 0/12 |
| No input, 12 seeds | 0/12 | 0/12 |

Main seeds: `101 + i*37`; held-out: `5001 + i*37`. Viewports:
1440x942 / 390x786. The low main-phone batch and higher held-out batch are
both reported. Combined evidence is near the intended 60-70% casual target;
it does not measure first-time human clear rates or promise individual wins.

## Reproduce and hand off

```sh
node --test tools/stand-balance.test.mjs tools/stand-runtime.test.mjs
node --test tools/engine.test.mjs tools/rush-logic.test.mjs tools/arcade-logic.test.mjs
node tools/stand-art.test.mjs
node tools/stand-performance.test.mjs chain
node tools/stand-active-performance.mjs chain
```

Use the production probe's `sampleBalance` API for the documented seed batches.
Do not run heavy browser fixtures alongside the active timing trace.
Selected screenshots are in `screenshots/stand-chain/`; older release records
and images remain intact. The English continuation prompt is
`CLAUDE_STAND_VISUALS_HANDOFF.txt`.

Entry/engine/model/style cache marker: `campaign=chain-mech-v1`.
Art marker: `art=mech-v2`; mech dependency: `mech=v2`.
Publish main and the new immutable tag, then verify the Pages deployment and
actual entry marker. A pushed feature branch alone does not update the game.
