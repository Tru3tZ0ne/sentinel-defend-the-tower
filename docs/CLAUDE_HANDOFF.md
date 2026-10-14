# Claude Code continuation handoff

Start from `feat/architectural-command-gameplay`. Read
[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md), [ART_DIRECTION.md](../ART_DIRECTION.md),
[DESIGN.md](../DESIGN.md) and [TASKS.md](../TASKS.md). Current sections supersede
historical descriptions of the stylized/night-operations direction.

## What is already implemented

- Two selectable floors with an existing navigation graph and moving staff.
- Three assignments and Guided/Standard/Expert difficulty selection.
- Playable setup-only HCI, ADC, SASE and AICP operations.
- Explicit local helper rules: notification after XDR confirmation or recovery of prepared snapshots.
- Exact-endpoint isolation and separate containment/recovery outcomes.
- English and Chinese game localization, daylight workspace UI and close-view controls.
- Actual-event replay, contextual debrief, JSON reports, keyboard controls and opt-in ambience.
- Deterministic engine regressions, original smoke coverage and actual DOM/canvas browser tests.

## Architecture and invariants

| Area | Files | Contract |
| --- | --- | --- |
| Missions | `src/data/missions.js` | Shared layout; immutable source schedules; per-session timing/damage |
| Planning | `src/data/operations.js` | Setup-only purchases; explicit costs and limitations |
| Simulation | `src/game/engine.js` | No renderer dependency; emits events; all spending validated here |
| UI | `src/ui/overlay.js`, `src/data/session-copy.js`, `src/i18n.js` | Bilingual presentation and delegated actions |
| Rendering | `src/world/`, `src/main.js` | Preserve endpoint IDs, selection, navigation and floor visibility |
| Styling | `src/style/main.css`, `src/style/workspace.css` | Core layout plus the current daylight presentation layer |
| Verification | `tools/engine.test.mjs`, `tools/smoke.mjs`, `tools/ui.test.mjs` | Rules plus actual controls/canvas interaction |

Keep `office#2`, `l2-finance#1`, `server#core` and `vault#core` stable when replacing meshes.
GLB adoption must not break inspection, coverage highlights, floor selection or navigation.
The current character loader is disabled and still contains CesiumMan-specific assumptions.
Do not simply flip `USE_GLB_CHARACTERS`; implement normalization and proper clip selection first.

## Next priorities

1. Human play-test all missions, especially post-containment recovery and budget tradeoffs.
2. Improve close-view composition and tune the responsive scene/inspector/deck balance.
3. When reviewed assets are available, add a data-driven GLB asset manifest with dimensions,
   forward axis, origin, material and animation metadata. Load failure must retain the fallback.
4. Validate standing/walking/working office characters with idle, walk, sit and typing clips.
   Support varied staff appearances without identifying the intruder through a unique model.
5. Replace reception, workstations, chairs, racks, conference furniture and plants with
   coherent realistic materials. Apply official logo textures locally, unchanged.
6. Add asset provenance and actual file-size/triangle/draw-call measurements. Test on target
   hardware before setting a production performance budget or claiming visual completion.

Asset production is deferred. Do not reconnect to paid model tools or consume external
credits as part of this gameplay handoff without a new asset-production brief.

## Paste-ready English prompt

```text
Continue development of Sentinel: Defend the Tower from branch
feat/architectural-command-gameplay in Tru3tZ0ne/sentinel-defend-the-tower.

Read docs/DEVELOPMENT_LOG.md, docs/CLAUDE_HANDOFF.md, ART_DIRECTION.md,
DESIGN.md, TASKS.md and docs/FACILITATOR_GUIDE.md first. Treat the current
2026-10-14 direction as authoritative over older stylized/night-ops notes.

The target is realistic corporate interiors and close-up business-attired
characters. The current daylight workspace is an intermediate improvement;
procedural people and furniture remain placeholders. Do not call the current
art photorealistic or finished. Asset production is deferred for now, so
prioritize gameplay clarity, camera composition, responsive interaction and
human play-test tuning while preserving a clean path to reviewed GLB assets.

Preserve the three missions, three difficulties, setup-only operational
purchases, exact-endpoint isolation, snapshot preparation requirements,
post-containment recovery, floor-aware effects, actual-event replay and
downloadable session reports. Maintain both English and Chinese game versions.
Keep public development documentation, comments and handoff records in English.
Use official Sangfor logo images unchanged and apply them locally to assets.

HCI reduces service impact; ADC mitigates the scripted load surge; SASE
rejects a remote session and forces a slower route. AICP is an authored local
helper with explicit XDR/aStor dependencies. Preserve these bounded metaphors.
Do not imply live AI calls, unlimited DDoS protection, guaranteed zero-day
prevention or automatic full backup/restore. Never add account credentials,
access tokens, signed download URLs or vendor authentication to the repository.

Run npm ci, npx playwright install chromium and npm test. Inspect actual
browser screenshots at desktop and mobile sizes, exercise canvas selection
on both floors, and test at least one complete mission through review/replay.
Record what changed, why, verification results and remaining limitations in
docs/DEVELOPMENT_LOG.md. Work on a feature branch and provide a concrete PR
description with validation and screenshots. Do not merge until reviewed.
```
