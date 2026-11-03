# Last Stand: Cyber Command guidance and readable loadout

Release: `stand-cc-guidance-v1`; branch: `fix/stand-cc-guidance`.
Base: `a6b49ec` / `stand-chain-mech-v1`.

## Changes

Cyber Command previously required XDR to guide ordinary rounds. CC now enables
ordinary operator, EDR and temporary-support projectile guidance by itself.
Already airborne rounds acquire guidance on the next simulation step after
deployment. XDR alone does not guide those weapons. MDR retains independent
tracking from level one and its existing CC damage bonus.

The forward acquisition cone, range, slower ordinary turning, finite projectile
lifetime, retargeting and pierced-target exclusions remain. XDR retains its
bounded chain lightning. Bosses, deadline, cloud workloads and score rules
are unchanged. This change does not promise automatic clears.

Owned products in the right loadout rail now show an official icon, short
product name, numeric level and a short localized effect. Examples are CC /
Guided fire, MDR / Auto tracking, XDR / Chain lightning and HCI / Compute + rate.
The numeric level replaces the old dot cluster. The same compact descriptions
appear in the final build strip. Phone entries use a 104px single column;
the score panel contracts on narrow screens to keep the two areas apart.
No new floating panel, runtime dependency, 3D asset or rendering effect was added.

`model.js` controls CC-only eligibility; `engine.js` reevaluates eligibility for
live shots. `main-stand.js` and `stand.css` provide the bilingual labels/layout.
Entry, engine, model and stylesheet use `campaign=cc-guidance-v1`.

## Validation

- 25 production combat/runtime regression groups pass, including the ownership
  matrix (none/CC/XDR/both), airborne unlock, independent MDR, cone/range,
  lifetime/retargeting, bounded XDR chains and spatial/exhaustive equivalence.
- Existing full stand browser integration passes: both languages, phone input,
  real upgrades, charge/discharge, failures/victories, replay and showroom.
- Additional browser inspection verifies actual ordinary-shot curvature with
  CC and no XDR, all ten product labels, and no label clipping, horizontal
  overflow or score/rail overlap at 1440x1000, 390x844 and 320x640 in both languages.
- Fixed stress, FX retention, resource reuse and native DPR checks use the
  existing unchanged budgets: 333 draws, 536,246 triangles, 110 geometries,
  one bullet draw, DPR 2; all 3,000 particles / 80 texts / 24 lightning effects
  are retained in the separate FX fixture. This release makes no new FPS claim.

Selected English inspection captures are in `screenshots/stand-cc/`, marked
`FIXTURE`. They show staged loadouts and are not natural-play balance evidence.

Balance results are in `stand-cc-validation.json`. Main seeds remain
`101+i*37` (60 casual / 12 each control policy per viewport); held-out seeds
remain `5001+i*37` (30 casual per viewport). Desktop/phone are 1440x942/390x786.

| Policy | Desktop | Phone |
| --- | ---: | ---: |
| Casual, main | 45/60 (75%) | 35/60 (58.3%) |
| Casual, held-out | 22/30 (73.3%) | 22/30 (73.3%) |
| Combined casual | 67/90 (74.4%) | 57/90 (63.3%) |
| Informed | 11/12 | 12/12 |
| Cloud only | 0/12 | 0/12 |
| No input | 0/12 | 0/12 |

Earlier CC access changes kill order, XP and subsequent random offers. Desktop
casual clears are above the approximate 60-70% target; this is recorded openly.
No unrelated difficulty retuning was bundled into this requested correction.
These are scripted policy results, not measured human clear rates. Human
playtests should guide a later balance pass if this easier desktop trend persists.

Reproduce with `npm run test:stand-art` and the production probe's `sampleBalance`
API for the documented held-out seeds. Historical chain/mech records retain
their original measurements and rules. The current English continuation prompt
is `CLAUDE_STAND_VISUALS_HANDOFF.txt`. Publish main/new immutable tag and check
the actual Pages marker and behavior before reporting delivery.
