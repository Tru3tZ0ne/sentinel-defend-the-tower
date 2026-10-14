# Development record - 2026-10-14

Branch: `feat/architectural-command-gameplay`

Starting revision: `65ac7c4` (second floor and cross-floor incident)

## Result

The existing two-floor prototype now has a playable mission and operations layer.
Cloud and AI cards perform bounded game actions instead of showing future-feature copy.
The current interface is a dark command workspace with official individual product
marks and the Solvia panda. See the dated follow-up below for the latest gameplay and
visual changes; earlier daylight screenshots are retained as development history.
Realistic models remain pending; procedural staff and furniture are temporary.

## Gameplay

| Assignment | Pressure | Decisions |
| --- | --- | --- |
| The Quiet Morning | Discreet intrusion across both floors | Place sensors, correlate with XDR, isolate the correct endpoint |
| The Lockout | Stolen remote identity and two encryption targets | Scope remote access, prepare snapshots, restore separate rooms |
| Under Pressure | Application traffic, host failure and intrusion | Reserve capacity, distribute load, retain detection and response budget |

Guided starts with 22 credits, stretches event timing by 1.2 and applies 0.8 disruption
damage. Standard uses 15 credits and baseline timing/damage. Expert starts with 12,
uses 0.8 timing and 1.15 disruption damage. These values are game tuning, not product metrics.

Operational preparation is available only during setup:

- **HCI (4):** reduces host-failure impact and the ongoing downtime of encrypted rooms.
- **ADC (3):** reduces the scripted application traffic surge; it is not unlimited DDoS protection.
- **SASE (4):** rejects the unauthorized remote session; the actor uses a slower local route.
- **AICP + Agent Builder (3):** runs an authored local rule. Notify needs XDR correlation;
  recovery needs aStor snapshots prepared before the incident. No external AI is called.

aStor remains in Defense. Buying it during an incident does not prepare snapshots.
EDR only observes/protects its specific endpoint. Detection and containment remain separate.

## Correctness and interaction changes

- Reject invalid endpoints, duplicate preparations and unavailable-phase actions without spending credits.
- Isolating another device in the same room no longer contains the actor.
- Preserve encryption after containment; let the operator recover already affected rooms.
- Distinguish contained-but-unrecovered services from a clean containment outcome.
- Record unauthorized remote sessions even when SASE is absent.
- Retain event truth in the log, including repeated ransomware events.
- Replay executed attacks only, including the first beat; switch floors as the replay crosses levels.
- Hide inactive-floor pick targets and effects. Correct lower-floor scan, veil, lock and cage heights.
- Place network sensor effects on both floors and hide the inactive set.
- Dispose stage resources on restart and dispose expired pulses, trails and correlation objects.
- Cancel camera focus tweens when the player begins an orbit interaction.
- Separate navigation positions from animation offsets to prevent walking-character height drift.
- Accelerate replay routes to the review cadence and wait for each route to finish before advancing.
- Restore visible room-placement highlights and expose endpoint IDs in the inspector.
- Skip unchanged HUD, feed and deck markup; preserve focus and deck scroll position when
  changes are needed. This fixes live buttons being detached while an operator clicks them.
- Keep English/Chinese switching available throughout selection, setup, play and review.
- Add keyboard pause, floor switching, overview and placement cancellation.
- Add opt-in, locally synthesized ventilation/hum. Playback starts muted.
- Export `sentinel-session.json`, containing English event truth and actual deployment/response history.
- Fix the development server's direct entry point on Windows and support ephemeral test ports.

## Presentation

- Daylight, neutral city context, warm key light and readable natural materials.
- Light panels, quieter green accents, consistent spacing and visible focus outlines.
- Assignment cards with clear resource and timing information.
- Playable infrastructure cards, helper dependency indicators and a response checklist.
- Close view and overview controls, plus floor-aware inspection.
- Storage cabinets replace the rotating gold polyhedron in the Data Room.
- Official Sangfor logo image variants remain unchanged; no branding is generated into meshes.
- Added contextual debrief, report export and a facilitator guide.

## Validation

Final local run: **`npm test` passed on Windows, 2026-10-14**. All nine engine
regression groups passed. The original smoke produced delayed survival for the strong
loadout (8 detected / 9 executed attacks), collapse without defenses, and containment
for precise endpoint isolation. The complete UI suite passed, including mobile live
pause controls and a regression against walking-character height drift. No page/console
errors or external HTTP requests were reported by the UI suite.

`npm test` runs three layers:

1. `tools/engine.test.mjs`: nine deterministic regression groups covering all nine
   mission/difficulty combinations, endpoint precision, invalid actions, infrastructure
   effects, remote policy, snapshots, helper dependencies, post-containment recovery,
   and simulation step ordering.
2. `tools/smoke.mjs`: original strong-loadout, undefended and targeted-containment scenarios,
   WebGL startup, runtime errors and screenshots.
3. `tools/ui.test.mjs`: actual mission/difficulty selection and language controls,
   operational preparation, helper rule selection, canvas deployment on both floors,
   keyboard pause, automatic recovery, debrief/report export, executed-event replay,
   mobile selection layout and absence of external HTTP dependencies.

Screenshots are generated under ignored `tools/shots/`. Selected English review captures
are included in `docs/screenshots/`. Visual review of the browser render is required
in addition to engine tests.

GitHub Actions runs the same test command for pull requests and the development/main
branches, and retains browser screenshots as a short-lived workflow artifact.

### Review captures

![Assignment selection](screenshots/start-en.png)

![Setup floor view](screenshots/prep-en.png)

![Playable infrastructure preparation](screenshots/cloud-en.png)

![Actual-event debrief](screenshots/review-en.png)

## Remaining limitations

- This is a complete playable prototype expansion, not a completed realistic-art release.
- Current office figures, furniture and distant city geometry are procedural stand-ins.
- The GLB character path is disabled. Its old CesiumMan-specific scale and single-animation
  assumptions must be replaced before adopting production office characters.
- No external model-service assets have been approved or added to the runtime in this iteration.
- Missions retain authored schedules. SASE now selects a different foothold route; this is
  one bounded decision branch, not a general adversary system or a branching campaign.
- Recovery now takes 6 seconds (4 with HCI) and 2 credits. There is no backup server,
  production security integration or live LLM service.
- Desktop rendering and mobile selection/layout have automated coverage; a human touch-device
  and event-hardware play-test is still needed for visual and difficulty acceptance.
- No service worker or installable offline package is included. A local static server works
  without external runtime HTTP requests after the repository is available locally.

See [the continuation prompt](CLAUDE_HANDOFF.md) for the next implementation pass.


## Command interface and gameplay depth — 2026-10-14 follow-up

### Presentation and brand identity

Replaced the light workspace skin with a reference-led command interface. The new layout
uses a dark navy HUD, cyan sensor indicators, teal/green readiness states, red response
controls, a right incident/inspection column, full-width product cards and a compact ticker.
The actual 3D building remains interactive; no flat reference image replaces the scene.
Room placards face the camera and hide in close views. Mobile keeps a horizontally
scrollable product deck and accessible pause/language/floor controls.

Added unmodified official Sangfor Athena and Sangfor Cloud lockups from the official logo
PPT kit, and enlarged the existing corporate logo. Cards show portfolio product names
rather than only metaphors. The assistant is now **Solvia**, using the official community's
panda image. The temporary reference-derived human portrait was removed before publication.
Solvia's hint behavior is still local game logic; its visible footer states this clearly.
Original room/action/evidence pictograms remain functional UI artwork. All 11 product
cards now use independently sourced official product symbols instead of original SVGs;
the inspector coverage badges share the same mapping. Ten images are unchanged official
community downloads; MDR preserves the complete shield from an official solution diagram.
The source inventory records legacy/current product associations and extraction details.
Source URLs are recorded in `assets/brand/ASSETS.md`.

Improved procedural surfaces with deterministic local tile/carpet/wood textures, glass
mullions, warm perimeter lighting, rack faceplates/LEDs, desk accessories, muted business
clothing and instanced foliage. This improves readability and coherence but does not
complete realistic characters, furniture, animation, reflections or production art.

### Rules and operator choices

- Setup purchases enter a mixed product/infrastructure history. Undo removes the latest
  purchase and refunds its full cost. Reset repeats undo. Both are rejected after start.
  Visible props, endpoint screen state, coverage and snapshot readiness follow the refund.
- SASE rejects a remote session and delays the schedule by 12 simulation seconds. The next
  foothold switches from `l2-finance#1` to `office#2`, with new bilingual event truth.
  Evidence uses the actual endpoint's coverage; branch choice is logged in the JSON report.
  Only per-session beat copies change. Other missions and source templates stay immutable.
- Snapshot restore requires setup-prepared aStor, 2 credits and an exclusive restore slot.
  It takes 6 simulation seconds, or 4 with HCI. Existing encryption keeps costing uptime
  until completion; pause freezes the job. The inspector shows progress and cancellation.
- Cancel returns 1 credit; the other credit is the spent setup effort. A cancelled helper
  restore stays suppressed until a manual restart, preventing repeated automatic spending.
- The helper schedules one affordable restore at a time. Containment preserves encryption
  and keeps the incident playable until recovery completes or the deadline is reached.
- Objectives distinguish containment and data preservation plus the mission's restoration
  or uptime target (Quiet Morning 70%, Under Pressure 80%). Reports include objective state;
  debrief guidance explains alternate endpoint coverage and response-resource planning.

### Verification

The engine suite now contains 13 regression groups, including mixed refunds, immutable
route branching, restore duration/cost/cancellation, helper cancellation and objective rules.
The real-browser suite covers Solvia/official logo asset loading, actual undo/reset buttons,
both-floor canvas deployment, EN/ZH, timed helper recovery, reports, replay and mobile HUD.
Browser suites run sequentially to avoid software-WebGL resource contention.

### Next work

Human play-testing, further response-driven branches, persistence/accessibility review,
and production office models/animation remain open. Asset-service automation is deferred.

### Individual product mark correction

The initial portfolio-logo pass did not replace the individual card SVGs. Corrected
that path explicitly: AF/NGFW, EDR/EPP, STA/NDR, IAG/SWG, XDR, MDR, aStor, HCI,
ADC, SASE and AICP now use official image files. `productMark()` is shared by both
card decks and inspector coverage badges. Artwork retains color/aspect ratio, uses
neutral plates for legibility, loads from the local server and survives EN/ZH switching.
AICP uses the official AI platform symbol; no separate Agent Builder mark is claimed.

![Official individual product marks in setup](screenshots/product-marks-en.png)

### Final local validation and review status

`npm test` passed after the product-mark integration: 13 engine regression groups,
three browser smoke outcomes (strong defense: delayed; no defense: collapse; exact
isolation: contained), and the full UI suite. UI checks include all seven defense
images and all four infrastructure images loading, Solvia, EN/ZH, undo/reset,
two-floor canvas deployment, timed recovery, reports, replay and mobile controls.
No external runtime requests or browser errors were reported. `git diff --check` passed.

![Current command interface](screenshots/command-live-en.png)

![Official infrastructure product marks](screenshots/product-cloud-en.png)

Development remains on `feat/architectural-command-gameplay`, PR #1. The public
GitHub Pages site serves `main`; this feature version will not appear there until
the PR is merged and Pages finishes deployment. Local preview: `npm run serve`.
