# Claude Code continuation handoff

Start from `feat/architectural-command-gameplay` and read `docs/DEVELOPMENT_LOG.md`,
`ART_DIRECTION.md`, `DESIGN.md`, `TASKS.md` and `docs/FACILITATOR_GUIDE.md`.
The current reference-led command interface supersedes historical light-workspace and
stylized art notes. Keep both English and Chinese game localization. Public development
records, comments and continuation prompts use English.

## Current implementation

- Static Three.js r160 ES modules, vendored locally; no bundler or runtime external calls.
- Two selectable floors, stable navigation/picking and animated procedural staff.
- Quiet Morning, The Lockout and Under Pressure, each with three difficulty settings.
- Setup-only HCI/ADC/SASE/AICP operations; authored local helper rules, not external AI.
- Full-refund setup undo/reset for mixed products and operations, including visible props.
- A bounded decision branch: SASE rejection delays the schedule by 12 simulation seconds
  and changes the next foothold from `l2-finance#1` to `office#2`. Evidence uses the actual
  endpoint's sensor coverage. Per-session beat copies prevent source-template mutation.
- Exact-endpoint isolation and separate containment, blocked exit and partial outcomes.
- aStor snapshots must be prepared during setup. A restore costs 2 credits and takes 6s,
  or 4s with HCI. Only one job runs; encryption continues to damage uptime while restoring.
  Cancel refunds 1 credit and suppresses automatic restart until a manual restart.
- Mission objectives: containment, data safety and restoration (Lockout), 80% uptime
  (Under Pressure) or 70% uptime (Quiet Morning). Objectives are distinct from verdicts.
- Actual-event replay, actionable debrief and English JSON session reports.
- Dark command UI, camera-facing room placards, desktop/mobile controls and opt-in sound.
- Official marks for all 11 product cards (including AF/EDR/STA-NDR), corporate/Athena/Cloud
  logos and Solvia panda. `src/ui/product-marks.js` is the single product image mapping.
  Source URLs and MDR extraction details are in `assets/brand/ASSETS.md`. Internal `sophia` identifiers
  are legacy names; the visible guide is Solvia. Preserve original image proportions.
- Procedural tile/carpet/wood maps, glass mullions, rack details and instanced foliage.

## Architecture and invariants

| Area | Files | Contract |
| --- | --- | --- |
| Missions | `src/data/missions.js` | Shared layout, immutable source templates, session copies |
| Planning | `src/data/operations.js` | Setup-only operations and explicit limited effects |
| Engine | `src/game/engine.js` | Owns validation, spending, refund history, branch and restore jobs |
| UI | `src/ui/overlay.js`, `src/data/session-copy.js`, `src/i18n.js` | Bilingual, delegated actions and cached paint |
| World | `src/world/`, `src/main.js` | Preserve floor navigation, picking, coverage and prop removal |
| Style | `src/style/main.css`, `src/style/workspace.css` | Base geometry plus current command skin |
| Brand | `src/ui/product-marks.js`, `assets/brand/ASSETS.md` | Official product image mapping and source inventory; semantic pictograms stay separate |
| Verification | `tools/engine.test.mjs`, `tools/smoke.mjs`, `tools/ui.test.mjs` | Rules and real DOM/canvas interactions |

Keep `office#2`, `l2-finance#1`, `server#core` and `vault#core` stable. Do not expose
hidden attack truth through current objective/incident panels. Retain engine checks even
when buttons are disabled. Match pause/speed/deadline semantics to simulation time.
The UI paint cache preserves focused controls and horizontal scrolling; do not replace
live controls every frame. Navigation position must remain separate from animation offsets.

The GLB path is disabled and contains old CesiumMan-specific assumptions. Reviewed office
assets need normalization, independent navigation roots, clip selection, floor visibility,
picking targets and material/animation QA. Do not just flip `USE_GLB_CHARACTERS`.

## Validation and deployment status

Latest `npm test` passed all 15 engine groups, three smoke outcomes and the full
browser UI suite, including all 11 official product images. (The 2026-10-13 gameplay-polish
pass added two engine groups — demonstrated viable winning strategies for every
mission/difficulty, and infrastructure-operation relevance — and made the Playwright click
helper robust to software-WebGL.) Current English captures are in
`docs/screenshots/command-live-en.png`, `product-marks-en.png` and `product-cloud-en.png`.
PR #1 is the review location. GitHub Pages serves `main`, so the feature branch is not yet
the public live version.

## Next priorities

1. Human play-tests of all mission/difficulty combinations: response budget, restore timing,
   discoverability, partial outcomes and the actual alternate endpoint route.
2. More response-driven mission branches, explicit objective consequences and useful debrief
   recommendations. There is currently one SASE branch, not a branching campaign.
3. Accessibility: keyboard inspection/deployment, focus routing and touch-device testing.
4. Realistic office characters/furniture with coherent materials and proper animation once
   the separate asset-production brief resumes. Current assets are not photorealistic.
5. Performance: scene cost is measured (backend-independent) in `docs/DEVELOPMENT_LOG.md`
   (≈1,100 draw calls / ~130k triangles at the live mission camera). The next lever is merging
   static per-room detail into shared geometry/materials and trimming active lights to cut draw
   calls without changing the visual direction — validate before/after on hardware GL (not
   SwiftShader), and re-verify picking/coverage/floor-visibility. Keep browser suites sequential.

Paid asset generation is deferred; do not reconnect or spend service credits without a
new asset brief. Never commit credentials, signed URLs or account history. No live Solvia
service is integrated: the panda identifies the game guide with a local-simulation footer.

## Paste-ready English prompt

```text
Continue Sentinel: Defend the Tower from feat/architectural-command-gameplay in
Tru3tZ0ne/sentinel-defend-the-tower. Read docs/DEVELOPMENT_LOG.md,
docs/CLAUDE_HANDOFF.md, ART_DIRECTION.md, DESIGN.md, TASKS.md and
assets/brand/ASSETS.md before changing the game.

Preserve the current reference-led dark command layout: top business/data/budget
HUD, right incident/inspection/Solvia column, full-width bottom capability deck
and readable room placards. Use the unmodified official Sangfor, Athena, Cloud
and Solvia panda artwork. Preserve the official marks on all 11 product cards and
coverage badges through src/ui/product-marks.js. These include legacy official
community symbols; do not invent newer marks. Do not substitute a generic robot
or human portrait.
Do not describe the local hint/helper logic as a live Solvia or LLM integration.

Prioritize deeper gameplay and human play-testing while asset production is
paused. Keep three missions/difficulties, mixed setup undo/refunds, exact-device
isolation, the SASE alternate-endpoint branch, prepared snapshots, timed and
budgeted single-slot recovery, cancellation override, mission objectives and
honest partial outcomes. Replay and reports must reflect executed events only.
Keep mission templates immutable and all spending validation inside the engine.
Maintain English and Chinese game versions and English development records.

The target scene remains realistic corporate interiors and close-up business
characters. Procedural people/furniture are temporary and do not achieve the
reference image's fidelity. Do not resume paid modeling without a new brief.
Preserve stable endpoint IDs, floor-aware effects, navigation/picking, coverage,
focused controls, pause semantics and offline/local runtime behavior.

Run npm ci, npx playwright install chromium and npm test. Run browser suites
sequentially. Inspect desktop and mobile captures, exercise actual canvas
selection on both floors, complete a mission through review/report/replay, and
record changes, evidence and remaining limitations in docs/DEVELOPMENT_LOG.md.
Work on the feature branch and update the PR with accurate validation and
screenshots; leave merging for review. Never put credentials in source or docs.
```
