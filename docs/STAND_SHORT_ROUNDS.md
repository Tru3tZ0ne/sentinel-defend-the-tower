# Last Stand: shorter sessions

Review tag: `stand-short-rounds-v1`.
Baseline: `29775de` on `main`, including the combined cinematic stage and updated EDR appliance.

The previous difficulty curve capped spawn density and speed while mature sensor
chains, recovery and support skills continued to clear threats. Four seeded
informed-policy probes all survived the complete 360-second observation window.
This change targets roughly two to three minutes per session while retaining
build choices, aiming and skill timing.

## Changes

- Keep the previous health, speed and boss curves throughout the first minute.
- After 60 seconds, increase normal-threat health by `1 + 2p²` and boss health by
  `1 + p²`, where `p = max(0, elapsed - 60) / 45`, on top of their previous health curves.
- Reduce maximum regular spawning from five threats every 250 ms to four every
  300 ms. Cap the entire active threat population at 64, including boss minions
  and worm splits. A boss delayed by capacity keeps its place in the rotation
  and enters when space opens; it is not silently skipped.
- Keep base integrity, weapon stats, XP, upgrades, recovery, skill cooldowns,
  scoring and the latest equipment/stage visuals.
- Explain the escalation in the existing start instructions in EN/ZH and announce
  it once at the minute boundary through the existing toast system.
- Version both entry scripts, the engine and rules imports so returning browsers
  receive the changed balance. Both `stand.html` and `stand-sangfor.html` use it.

There is no forced defeat or countdown at three minutes. Strong players can
survive longer, and poor play or an ineffective build can end earlier. Existing
leaderboard records are retained as historical scores from their original rules.

## Evidence and limits

`tools/stand-balance.mjs` executes the production engine's combat functions in
Node without loading WebGL. It extracts asserted source boundaries rather than
copying combat formulas. Rendering, sound and UI callbacks are stubbed; seeded
randomness covers combat and upgrade offers. Upgrade selection follows the real
three offers and product caps, and movement uses the actual input/speed rules.
No free upgrades, invulnerability or state-reset survival assists are used in
the session samples.

Twelve fixed seeds per policy and viewport, 48 new-curve sessions total:

| Viewport / policy | Mean active play | Active range | Estimated session with selection pauses |
| --- | ---: | ---: | ---: |
| Desktop / casual | 116.8 s | 74.2–133.9 s | 146.6 s |
| Desktop / informed | 139.8 s | 126.6–159.0 s | 174.2 s |
| Phone / casual | 121.8 s | 106.9–129.0 s | 153.0 s |
| Phone / informed | 146.8 s | 131.7–158.4 s | 182.7 s |

Every sample ended through base damage and stayed within the 64-threat cap.
The session column assumes **1.5 seconds per upgrade decision**, giving an
equally weighted mean of approximately **164 seconds (2:44)**. It is an estimate,
not observed human average session length. The game clock excludes upgrade and
manual pauses. Human decision time, device rendering, visual effects and player
skill can change wall time. The probes use 60 Hz simulation steps and do not
measure renderer FPS, reaction ergonomics or a representative player population.

The casual policy sweeps the lane, favors direct defenses and uses support under
crowd pressure; the informed policy tracks leading damaging threats, seeks sensor
coverage/marking, and times support more actively. These are regression policies,
not claims of optimal play. A small human playtest should confirm the event's
actual average before tuning again.

## Validation and continuation

- `node --test tools/engine.test.mjs tools/rush-logic.test.mjs tools/arcade-logic.test.mjs`: 65 existing checks.
- `npm run test:stand-balance`: five regression groups, including opening parity,
  seeded repeatability, all spawn paths, boss retry, escalation and skill advantage.
  Generates the complete sample report at ignored `tools/shots/stand-balance.json`.
- `npm run test:stand-art`: balance checks followed by browser integration. The
  browser also checks bilingual pacing instructions, the actual minute-boundary
  toast, stale-rule detection, defeat and replay, alongside product/art checks.
  The transition/defeat scenarios deliberately use fixtures and are not natural
  run or human session-duration evidence.

The balance suite is included in `npm test` and the existing stand-art CI job.
All 65 existing rule checks, the five balance regression groups and the expanded
Last Stand browser suite passed locally. Unrelated tower browser suites were not
rerun locally for this pacing change.
No new runtime dependencies, models, textures, HUD panels or rendering passes.
Do not weaken the capacity or timing checks to accommodate a visual change.
Keep the probe adapter aligned with the production combat closure when refactoring;
do not replace it with a second approximate combat implementation.
