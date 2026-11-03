# Last Stand: active Agent Builder workflow and ten-second choices

Gameplay remains current. The subsequent material/arena refinement is recorded
in [STAND_MATTE_ARENA.md](STAND_MATTE_ARENA.md).

Release: `stand-agent-workflow-v1`; branch: `feat/stand-agent-workflow`.
Base: `fb0fa7d` / `stand-wide-chain-v1`.

## Player-facing behavior

Agent Builder is now a manual ability in the existing service column, alongside
Incident Response, Penetration Testing and Red Team Assessment. Press **F** or
tap **AGENT / Workflow**. It is available from the beginning; no random product
purchase is required. An empty field produces a short explanation and consumes
no cooldown. It cannot run during pause, after the outcome, or while cooling down.

The ability commits to the nearest-to-base visible threats at activation and
executes one small response workflow:

| Stage | Active time | Actual action |
| --- | --- | --- |
| Detect | 0s | Commit and visibly mark 2–4 targets. |
| Analyze | 1.1s | Slow surviving committed targets for 2.5s and draw pooled links. |
| Contain | 2.2s | Damage each surviving committed target once. |
| Recover | 3.3s | Restore a small amount of HP and availability; deliver workflow/business work once. |

The trace closes at 4.4s. Targets killed by another weapon are skipped, with no
free replacement. Workflow kills do not trigger recursive correlation damage.
Recovery is useful even when another weapon finished a committed target. No
workflow points accrue passively or before Recover. An interrupted workflow at
the campaign endpoint receives no delayed credit. Completed-run count appears
in the result; replay resets the count, trace and cooldown.

HCI and AI improve the plan captured on activation. With `h=HCI`, `a=AI`, and
`c=min(h,a)`:

- Cooldown: `28-c` seconds, starting on activation.
- Targets: `min(4,2+floor(a/2))`.
- Per-target damage: `30+a*6+h*2`, before normal damage rules.
- HP recovery: `30+c*20`, capped at the original 10,000 HP.
- Workflow work: `(100+c*70) * served * availability/100` at recovery.
- Business work: two seconds of the actual business delivery rate at recovery.
- Availability recovery: 2 points, capped at 100.
- Running a workflow adds 18 compute demand. Insufficient capacity and damaged
  service reduce delivered work; cloud capacity remains a real constraint.

These are fictional arcade mappings, not claims about real product response or
healing capabilities. Modest response/recovery numbers avoid a second global
emergency-clear button. Existing boss, deadline, projectile guidance, XDR chain
rules and score weights/denominators are unchanged.

Agent Builder is removed from passive upgrades, prerequisites and owned-product
rail: there are nine purchasable products. Its existing wrist controller appears
only during execution, is cached after its first build, and can visually charge
XDR while present. Armor stages still depend on purchased levels. The compact
four-step trace is transient and moves above phone choices. No new permanent
panel, external asset, dependency or per-frame mesh construction is introduced.

Both opening and subsequent product choices now remain for **10 active seconds**.
The displayed countdown starts at 10s, and the highlighted recommendation is
automatically purchased only on expiry. Number keys/tap still choose immediately.
Combat continues during choices; explicit pause freezes the countdown and all
workflow simulation. This is not ten seconds of wall time while paused.

## Source and verification

- `model.js`: workflow specification, active-skill catalog, nine-product upgrade
  pool, workload demand, ten-second offer constant.
- `engine.js`: committed-target stage execution, guards, single completion credit,
  HUD/result state and transient device link.
- `main-stand.js`, `stand.css`: bilingual instructions/codex, F/tap control,
  transient trace, cooldown/stage feedback, result count and countdown.
  Score labels also refresh on language-changing replays rather than retaining
  their previous-language cached headings.
- `mech-art.js`: cached active wrist controller. Entry/import markers invalidate
  the previous cached build: `campaign=agent-workflow-v1`, `art=mech-v3`, `mech=v3`.
- Probe and browser/stress fixtures follow nine purchases plus the active
  controller. Inspection fixtures add an EDR level to retain armor stage 3.

Reproduce from the repository root:

```sh
node --test tools/stand-balance.test.mjs tools/stand-runtime.test.mjs
node tools/stand-art.test.mjs
node tools/stand-performance.test.mjs agent-workflow
node --test tools/arcade-logic.test.mjs
```

The combat regression checks cover the ordered stages, no early/repeated credit,
dead targets, empty activation, pause, terminal states, compute demand, HCI/AI
scaling and the full ten-second recommendation. Browser checks use actual F/tap
handlers, stage transitions, cooldown, localized replay, mobile dock bounds and
the existing actual fail/win/score flow. Screenshots bearing `FIXTURE` stage
durable stationary targets for inspection; they are not natural-play evidence.

See `stand-agent-validation.json` for final counts, seeded results and rendering
measurements. The seeded casual policy reacts with Agent Builder below 9,000 HP
or 85% availability; the informed policy activates proactively with three or more
enemies. Other movement/upgrade/support decisions are retained. Historical
passive-Agent results are not directly comparable to this added manual input.
Seeded simulation cannot establish a first-time human clear rate. Event hardware
and human testing remain necessary for timing/perceived difficulty claims.

Fixed worst-case stress retains nine maxed products plus the executing controller,
support teams, 64 threats, 256 shots and seven XDR nodes. It is the same geometry
load as the preceding ten-module fixture: 329 draws / 536,342 triangles / 109
geometries. Bullet rendering remains one draw; capacity growth reuses geometry;
replay retains model/module caches. All 3,000 particles, 80 texts and 24 lightning
effects are retained in the separate FX fixture. Native DPR 2 remains verified.
These counters do not certify a hardware FPS improvement.

## Delivery

Publish the feature branch, main and the immutable release tag together, then
verify the actual Pages marker and F/tap/ten-second behavior. The release entry
is `https://tru3tz0ne.github.io/sentinel-defend-the-tower/stand.html`.
The English continuation brief is `CLAUDE_STAND_VISUALS_HANDOFF.txt`.
