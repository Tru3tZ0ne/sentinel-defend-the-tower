# Claude Code continuation handoff

Read `docs/DEVELOPMENT_LOG.md`, `ART_DIRECTION.md`, `DESIGN.md`, `TASKS.md`,
`docs/FACILITATOR_GUIDE.md` and `assets/brand/ASSETS.md` before changing the game.
For character work also read `assets/models/office/ASSETS.md` and the paste-ready
English prompt in `docs/CHARACTER_HANDOFF.txt`.

## Current implementation

- Static Three.js r160 ES modules, locally vendored; no build or external runtime API.
- Whole-tower cutaway with both floors visible; floor controls scope camera and picking.
- Quiet Morning, The Lockout and Under Pressure, each with three difficulty settings.
- Setup-only HCI/ADC/SASE/AICP operations, mixed purchase undo/reset and explicit feedback.
- Local helper rules, exact-device isolation, room containment and restriction ahead of
  the actor. Restriction delays entry; it is distinct from containment.
- SASE rejection delays the schedule and redirects the next foothold from `l2-finance#1`
  to `office#2`. Evidence follows the actual endpoint and its sensor coverage.
- Setup-prepared aStor snapshots; budgeted single-slot restoration, HCI acceleration,
  cancellation with a partial refund, and manual override after helper cancellation.
- Mission objectives, honest partial outcomes, actual-event replay and English JSON reports.
- Reference-led dark command UI, bilingual game text, keyboard room targeting and mobile UI.
- Official product marks for all 11 cards and inspector badges, plus the corporate,
  Athena, Cloud and Solvia panda artwork. Preserve original artwork and proportions.
- Per-floor static scene batching and whole-tower context. All 11 purchases now create
  persistent scene representatives: cabinets/storage/cluster, software-agent badges and
  service consoles. These are illustrative, not official hardware model replicas.
- Existing active product/operation cards locate their devices; the existing inspector
  shows status and location. EDR's small locate action cycles installed endpoints while
  its card still places additional agents. No extra inventory strip or floating labels.
- Deployment geometry is merged by material; undo/reset removes picking targets and
  devices. Preserve this compact UI and avoid adding parallel lists or new panels.
- Two reviewed Mixamo business characters with independent idle, in-place walk and seated
  typing clips. Materials, geometry and textures are shared; skeletons/mixers are individual.
  Async loading preserves navigation groups, purchases, mission state and FX references.
  Partial loading uses the available rig; complete failure retains procedural fallback figures.

## Architecture and invariants

| Area | Files | Contract |
| --- | --- | --- |
| Missions | `src/data/missions.js` | Immutable source templates, copied per session |
| Planning | `src/data/operations.js` | Explicit setup-only operations and relevance feedback |
| Engine | `src/game/engine.js` | Validation, spending/refunds, branching, restriction and recovery |
| UI | `src/ui/overlay.js`, `src/data/session-copy.js`, `src/i18n.js` | EN/ZH, delegated actions, cached paint |
| Navigation | `src/world/people.js`, `src/world/building.js` | Stable entity roots, graph coordinates and floor-aware picking |
| Deployment art | `src/world/deployment-assets.js`, `src/data/deployment-visuals.js` | Paid scene entities, compact locate/inspect and disposal |
| Character art | `src/world/character-visuals.js` | Local asset loading, normalization, shared resources, clips and disposal |
| Brand | `src/ui/product-marks.js`, `assets/brand/ASSETS.md` | Official product image mapping and provenance |
| Asset build | `tools/convert-mixamo.py` | Authorized local FBX inputs to optimized self-contained GLBs |
| Verification | `tools/*.test.mjs`, `tools/smoke.mjs` | Rules, real UI/canvas interactions and asset lifecycle |

Keep `office#2`, `l2-finance#1`, `server#core` and `vault#core` stable. Do not expose
hidden attack truth through objective or incident panels. Retain engine validation even
when a button is disabled. Pause/speed/deadlines use simulation time. Preserve focused
controls and scrolling; do not rebuild live controls every frame.

Animation must never feed offsets back into navigation. The outer person group and
`personId` remain stable when its child visual changes. Do not dispose shared character
geometry, material or texture assets during mission restart; dispose each old mixer's
bindings and cloned skeleton bone textures separately. Keep authored skin/clothing colors.
The old CesiumMan-specific character path has been removed.

## Next priorities

1. A coherent realistic office sample: furniture, scale, finishes and lighting, inspected
   close up in the actual game before propagation. Current furniture is still procedural.
2. Further character variety, clothing detail and authored chair-entry transitions if
   needed. The two stock rigs are an improvement, not photorealistic digital humans.
3. Human play-tests across mission/difficulty combinations and response timing.
4. Additional response-driven branches and accessibility/touch-device polish.
5. Preserve static batching and character resource sharing; report FPS only with an
   identified hardware renderer and a controlled camera/viewport/DPR.

## Validation and publishing

Run `npm ci` and `npm test` sequentially. The full command includes engine, smoke,
UI and character tests. The character suite covers delayed assets without lost purchases,
idle/walk/work, grounding, cross-floor navigation, pause, restart, EN/ZH and asset failure.
Inspect actual desktop/mobile views and complete a mission through report/replay.
Record exact validation and deployment evidence in `docs/DEVELOPMENT_LOG.md`.

GitHub Pages serves `main`; a feature-branch preview does not change the public site.
Check the actual deployed commit and asset URLs when reporting a release. The mainline
baseline for this character work is `f87b4a5`, which already includes PR #1 and the
whole-tower cutaway. Do not revert that work or reopen the old feature branch as a baseline.

All development records, comments and continuation prompts use English; preserve both
game localizations. Never commit credentials, account history, browser auth state,
original stock FBX downloads or temporary signed URLs. No live Solvia/LLM service is
integrated; the panda identifies local simulation guidance. Exact brand color specifications
remain subject to the official brand guide. Paid generation requires an applicable brief.
