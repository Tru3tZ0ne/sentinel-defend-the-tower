# Last Stand: security, cloud and AI balance

> Historical release. [The mech/performance release](STAND_MECH_PERFORMANCE.md)
> supersedes the preinstalled products, separate floor appliances, large XDR
> callout and measurements below. The original tag remains unchanged.

Review tag: `stand-enterprise-balance-v1`. Branch: `feat/stand-enterprise-balance`.
Base: `44e8cf3` / `stand-command-finale-v1`.

This release revises the earlier assisted campaign. The target is approximately
60-70% clears for reasonably mixed builds with ordinary active play. This is a
design target, not a measured human win rate. There is no random victory roll,
mandatory boss assistance, final-HP floor or guaranteed completion.

## Combat and player decisions

- Start with 10,000 HP and EDR/MDR/HCI level 1. Earn Cyber Command and XDR through
  normal upgrade choices. Cyber Command retains the existing `NDR` product ID.
- Ordinary operator, EDR and temporary-team projectiles need **both CC and XDR**
  for guidance. Guidance has a forward acquisition cone, limited range and a
  slower turn response (2.8/s). Players must still align fire with threats.
- MDR retains its existing damage, firing rate, CC-only tracking (8/s) and
  10% damage increase per CC level. The pair requirement does not nerf MDR.
- Projectiles retain speed, retarget killed/already-pierced targets and expire
  after 2.4 seconds. CC still fires two horizontal damage strips from the sides.
- XDR draws energy from all deployed devices, including AI and Agent Builder,
  before emitting its actual angled damage laser. Thin links do no damage.
  Correlation chains now branch to at most two targets with reduced per-hop
  damage, preventing a paired build from clearing every wave unattended.
- XDR's appliance has a larger official top mark and a camera-facing official
  mark/name plate, rendered after combat flashes. The plate adds no WebGL draws.
- Three bosses arrive at 25/60/95 seconds. Every four seconds a boss snapshots
  the player's column, displays a red warning lane, then strikes that location.
  Moving away avoids the hit. AI provides slightly longer warning time.
- Incident Response retains its normal-threat effect, healing and hit shield;
  boss damage is 20% of maximum HP rather than 60%. Time Q/E/R support and choose
  between security, compute and workload upgrades to finish the final boss.
- Normal/exfil breaches deal five times their base damage; boss strikes deal
  three times base damage. Unshielded damage also reduces business availability.
- Ordinary threat HP scales at `1 + 0.12 * elapsed`. Boss HP uses
  `0.76 * (8 + elapsed * (mega ? 0.036 : 0.024))`. Compact battlefields compensate
  for shorter reaction distance with at most 6% lower threat travel speed.
- The simulation ends at 120 active seconds. Zero HP or zero business
  availability can end it earlier. A clear requires all three real boss deaths.
  An uncleared boss at the deadline is a defeat. Terminal damage cannot be
  reversed by later work in the same update. Paused/finalized runs produce no work.

## Cloud, AI and scoring

HCI still improves squad firing rate and now provides business compute. AI
workloads require HCI; Agent Builder offers require HCI and AI. Cloud-only
investment leaves insufficient security to survive. Every normal offer contains
a security option and a cloud option while both categories remain available.

Per-second production is calculated by the pure `cloudRates` rules:

- Capacity = `60 + 32*HCI + 8*ASTOR`.
- Demand = `55 + 0.7*elapsed + 14*AI + 10*AGENT`.
- Served fraction = `min(1, capacity/demand)`; uptime = availability / 100.
- Business = `min(capacity,demand) * uptime * (1 + 0.06*automation)`.
- AI output = `AI * 10 * served * uptime * (1 + 0.1*automation)`.
- Agent output = `min(AI,AGENT) * 6 * served * uptime`.
- Automation = `min(HCI,AI,AGENT)` and accelerates support cooldowns by 4% per
  effective level. It does not fire weapons or make build choices for the player.
- Capacity shortage drains availability; adequate capacity restores it slowly.
  AI and agent output are zero without HCI. No AI means no agent output.

Each component is capped at 10,000. Remaining HP is its own component. Business,
AI and agent scores normalize integrated delivered work by 14,400 / 4,200 / 2,160
respectively. Total = **55% HP + 25% business + 12% AI + 8% Agent Builder**, rounded
down. Scores reflect served work over time, rather than purchased logo counts.

Only victories enter ranking; failures show their component scores and reason.
Tied totals share rank. New storage is `sentinel.stand.enterprise.scores.v1` and
`sentinel.stand.enterprise.best.v1`; earlier score/HP boards are preserved.
`window.__STAND_ENTERPRISE_API` is the optional separate backend endpoint.
The default GitHub Pages leaderboard is local to the browser, not global.

## Visual and performance scope

The existing cinematic stage, original equipment/creature models, official
marks, lighting, shadows, bloom, particles and native DPR up to 2 remain.
AI uses the existing official AICP mark on a compact compute blade. Agent
Builder uses a labeled workflow console, without inventing an official logo.
These are arcade product concepts, not verified commercial appliance replicas.

The four-component score strip sits above the action and is pointer-transparent. Its HUD
updates reuse DOM nodes. Phone equipment icons use two compact columns instead
of a ten-row rail. No new dependencies or runtime network assets were added.

Fixed maximum-load fixture: ten fully upgraded products, support teams,
64 threats, 256 bullets, CC strips, XDR links and main beam:

| Metric | Result |
| --- | ---: |
| Draw calls | 440 (previous eight-product fixture: 415) |
| Triangles | 526,724 |
| Geometries | 129 |
| Draw calls for all 256 bullets | 1 |
| Native high-DPI ratio | 2 |

Removing/reintroducing threats reuses resources. Bullet capacity grows to 1,024
without another geometry allocation. The ten-product inspection fixture is
317 draws / 129,028 triangles. Hardware FPS is not claimed from software WebGL;
an actual event laptop still needs a sustained hardware-GPU playtest.

## Validation and reproducibility

- Existing engine/rush/arcade suites: 65 groups pass.
- Enterprise combat suite: 17 groups, including 192 seeded production-combat
  runs at desktop 1440x942 and phone 390x786. Casual mixed builds react every
  1.15 seconds, sweep aim, respond to detected warning lanes and use conditional
  support; informed play reacts every 0.2 seconds and follows the leading threat.
  Both receive the same real randomized upgrade offers. Cloud-only buys cloud
  options exclusively; stationary play supplies no input.

| Policy | Desktop clears | Phone clears |
| --- | ---: | ---: |
| Casual mixed | 38/60 (63.3%) | 40/60 (66.7%) |
| Informed mixed | 11/12 (91.7%) | 11/12 (91.7%) |
| Cloud-only | 0/12 | 0/12 |
| Stationary | 0/12 | 0/12 |

Seeds are `101 + i*37`. Every successful run ends at 120 seconds with three
actual boss deaths. Cloud-only losses average 67.3s desktop / 64.3s phone.
A separate validation batch (`5001 + i*37`, 30 seeds per viewport) cleared
21/30 (70%) on each viewport without further tuning. Across both batches,
casual mixed clears total 59/90 (65.6%) desktop and 61/90 (67.8%) phone.
This is deterministic simulation evidence for the policy above, not a human
playtest or a guarantee about an arbitrary player's clear rate.

Browser coverage includes EN/ZH menus and instructions, real kill-to-upgrade
flow, all ten products, support, mobile movement/offers, actual XDR charge/fire,
real terminal failure with no ranking submission, a final boss kill and weighted
ranking, replay, old-board isolation and the existing eight-product showroom.
Screenshots with `FIXTURE` in the filename are staged visual inspection states,
not natural playthrough evidence. Selected images are in
`docs/screenshots/stand-enterprise/`.

Run `npm run test:stand-art` for combat, browser and full-quality stress checks.
The balance JSON and additional captures are generated under ignored `tools/shots/`.
The checked-in `stand-enterprise-validation.json` preserves the measured summary.
See `CLAUDE_STAND_VISUALS_HANDOFF.txt` for continuation instructions.
