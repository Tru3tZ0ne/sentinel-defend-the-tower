# Development record - 2026-10-14

Branch: `feat/architectural-command-gameplay`

Starting revision: `65ac7c4` (second floor and cross-floor incident)

## Result

The existing two-floor prototype now has a playable mission and operations layer.
Cloud and AI cards perform bounded game actions instead of showing future-feature copy.
The interface has moved to a restrained daylight workspace. Realistic models are still
pending; procedural staff and most furniture remain temporary.

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
- The missions are authored schedules with a SASE alternate-route delay, not a general
  procedural adversary system or a fully branching campaign.
- Recovery is a simplified instantaneous snapshot operation. There is no backup server,
  production security integration or live LLM service.
- Desktop rendering and mobile selection/layout have automated coverage; a human touch-device
  and event-hardware play-test is still needed for visual and difficulty acceptance.
- No service worker or installable offline package is included. A local static server works
  without external runtime HTTP requests after the repository is available locally.

See [the continuation prompt](CLAUDE_HANDOFF.md) for the next implementation pass.
