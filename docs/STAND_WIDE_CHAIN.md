# Last Stand: guidance-only Cyber Command and wider XDR chains

Release: `stand-wide-chain-v1`; branch: `feat/stand-wide-chain`.
Base: `b24a0e2` / `stand-cc-guidance-v1`.

## Changes

Cyber Command no longer emits horizontal laser strips or deals their periodic
area damage. The four separate lane-edge laser emitters, timer/state, damage
loop and visual segments are removed. CC retains ordinary projectile guidance,
including already airborne rounds, threat reveal/marking and its MDR damage
bonus. MDR still tracks independently from level one. CC's head sensor remains
mounted on the mech, and the compact product descriptions remain visible.

XDR's pulse target budget increases from 2-5 to 4-7 distinct enemies. With at
least three sensor units, levels 1-2 can chain through five targets, levels
3-4 through six, and levels 5-6 through seven. Fewer sensor units remove one
bonus target. A pulse can hit fewer enemies when suitable neighbors are absent.
Jump range rises from `min(240,150+sensors*12)` to
`min(260,170+sensors*14)` in simulation coordinates.

The 0.65s visible module charge, 65ms per-hop delay, 0.62s pulse lifetime,
65% damage retained per next hop and first-hit damage formula are unchanged.
Each planned target is hit once; dead targets are skipped without free
replacement, visual lines do no collateral damage, and pulse kills cannot
recursively add correlation damage. The primary target still needs the forward
acquisition cone/range. No boss HP, spawn, campaign deadline or score changes
are bundled into this release. Both interface languages describe the new roles.

## Verification

- 25 production combat/runtime regression groups pass. Coverage replaces the
  old CC strip test with no-ambient-damage verification while retaining the
  ownership/airborne guidance checks. Chain tests exercise seven unique
  single-hit targets, unchanged falloff, lethal-hit containment, dead-target
  skips, pause, source movement and the extended jump range.
- The full browser suite passes in both languages and on desktop/phone,
  including real upgrades/results, replay, showroom and actual five-target
  XDR discharge. Separate desktop/phone inspection confirms all seven targets
  are actually hit at maximum XDR, and CC alone still guides ordinary bullets.
  Staged durable-enemy captures are marked `FIXTURE` in
  `screenshots/stand-wide/`; these are visual evidence, not natural-play results.
- All 35 arcade logic groups pass. Fixed stress, full FX retention, resource
  reuse, one-draw bullets, capacity growth and native DPR 2 checks pass with
  existing budgets unchanged.

| Fixed stress metric | Previous release | This release |
| --- | ---: | ---: |
| Draw calls | 333 | 329 |
| Triangles | 536,246 | 536,342 |
| Geometries | 110 | 109 |
| Bullet draws | 1 | 1 |

The fixture contains ten maxed products, support teams, 64 threats and 256
bullets; it now stages seven lightning targets and no removed CC strips.
Triangle count changes by less than 0.02%. Seven hops use 49 jagged segments;
with nine charging links, the maximum is 58 of the existing 64 slots. No new
draw layer, runtime dependency or effect reduction is used. The separate FX
fixture still retains 3,000 particles, 80 damage texts and 24 lightning effects.
Inspection scene: 229 draws / 141,488 triangles / 118 geometries. This is scene
cost evidence, not a hardware FPS improvement claim or a fresh active trace.

## Balance evidence

The same production-combat policy/seed batches were rerun. Main seeds are
`101+i*37`; held-out seeds are `5001+i*37`. Desktop/phone viewports are
1440x942 / 390x786. Casual policy reacts every 1.15 seconds; informed policy
reacts every 0.2 seconds. Both use actual randomized offers and support.

| Policy | Desktop | Phone |
| --- | ---: | ---: |
| Casual, main | 44/60 (73.3%) | 41/60 (68.3%) |
| Casual, held-out | 21/30 (70%) | 21/30 (70%) |
| Combined casual | 65/90 (72.2%) | 62/90 (68.9%) |
| Informed | 11/12 | 12/12 |
| Cloud only | 0/12 | 0/12 |
| No input | 0/12 | 0/12 |

Desktop remains slightly above the approximate 60-70% target; phone is near
its upper edge. No guaranteed wins were introduced. These scripts do not
measure human first-time clear rates. No further difficulty tuning was applied.
`stand-wide-validation.json` records summaries and scene measurements.

## Continue and publish

Run `npm run test:stand-art` and `node --test tools/arcade-logic.test.mjs`.
Use the production probe's `sampleBalance` API for the held-out batch.
The current English continuation prompt is `CLAUDE_STAND_VISUALS_HANDOFF.txt`.
Keep older release records and immutable tags. Publish main and the new tag,
then verify Pages and actual CC-only guidance/five-plus-target lightning.
Current entry/engine/model/style marker: `campaign=wide-chain-v1`.
