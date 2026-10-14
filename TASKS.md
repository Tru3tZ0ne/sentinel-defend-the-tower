# Task tracking — Sentinel: Defend the Tower

Legend: [x] done · [~] in progress · [ ] todo

## Current iteration — 2026-10-14

- [x] Three playable assignments and Guided/Standard/Expert difficulty
- [x] HCI, ADC and SASE operational effects, limited to setup preparation
- [x] AICP local helper rules with explicit XDR/aStor dependencies
- [x] Exact-endpoint isolation, valid endpoint checks and recovery after containment
- [x] EN/ZH mission selection, operation controls, helper rules and debrief
- [x] Actual-event replay, unfinished-recovery outcome and English JSON report export
- [x] Daylight scene, restrained workspace UI, close-view/overview controls
- [x] Floor-aware effects, visible-floor picking and transient-effect disposal
- [x] Keyboard controls, opt-in synthesized ambience and facilitator notes
- [x] English development record and Claude Code continuation prompt
- [ ] Realistic office models, rigging and close-up animation QA (asset work deferred)
- [ ] Human play-test, tuning and visual acceptance

The entries below are historical milestone records. Current visual direction and known
limitations are in `ART_DIRECTION.md` and `docs/CLAUDE_HANDOFF.md`.

## Milestone 0 — Research & setup
- [x] Research Sangfor products (EDR, AF, STA/NDR, IAG, SASE, XDR, MDR, HCI, aStor, ADC, AICP, Agent Builder) from official sources
- [x] Record product roles → game metaphors (`DESIGN.md`, `assets/brand/ASSETS.md`)
- [x] Choose tech stack (static ES-module site for GitHub Pages) and project structure
- [x] Write design doc + task tracking

## Milestone 1 — Playable core (CURRENT)
- [x] Project scaffold (index.html, src modules, assets)
- [x] i18n EN/中文 with language toggle
- [x] Product catalog data (roles, cost, visibility, effects)
- [x] Level 1 data: building layout + ground-truth incident timeline
- [x] Engine: tick loop, fog-of-war visibility, deploy/respond/recover, win/lose
- [x] Fog-of-war: evidence → clues keyed to deployed sensors; XDR correlation; MDR assist
- [x] Building render + HUD (budget, uptime, data integrity, time)
- [x] Sophia guide with layered, event-triggered hints
- [x] End-of-session replay timeline (ground truth vs. detections)
- [x] Original product icon set + placeholder brand assets with recorded sources
- [x] Verify headless (no console errors) + screenshots
- [ ] Human play-test pass & tuning review with client

## Milestone 2 — 3D living-building redesign (DONE, verified)
Rebuilt the core around a Three.js low-poly isometric cutaway (vendored locally, offline-ok).
- [x] 3D cutaway tower: floors, rooms, corridors, stairwell, entrance, desks, server racks, Data Vault; constrained orbit camera
- [x] People that move/wander a nav graph; an intruder that blends in
- [x] Products with world presence (entrance arch, endpoint rings, corridor sensors, command console, egress gate, storage, off-site beacon) — not interchangeable turrets
- [x] Fog-of-war in the world: clue markers + movement trails appear only where a sensor is deployed; XDR confirm reveals the actor (red ring)
- [x] Reworked pacing: calm SETUP phase (no clock) → LIVE incident → REVIEW. Pressure comes from the incident, not the controls
- [x] One complete incident (entry → foothold → recon → lateral → ransomware → vault → exfil) with contextual inspect + containment (isolate device / lock down area / restore)
- [x] Spatial replay: animates the true route on the building with per-step observed/missed/blocked/contained
- [x] Product copy corrected for accuracy — esp. aStor (resilient storage + immutable snapshots, NOT auto full backup/restore; recovery needs prior prep) and EDR (dual-layer recovery, honest zero-day caveat)
- [x] Verified headless (WebGL render, 3 scenarios, screenshots) + redeployed
- [ ] Human play-test & tuning review with client

## Milestone 2.5 — Refinement pass (presentation & understandability) — DONE, verified
Focus of the client's refinement brief: polish the existing building + incident before adding content.
- [x] Characters rebuilt: articulated low-poly people (knees, swinging arms, seated "working" pose, idle breathing/glances), varied clothing/skin/hair, desk-based daily routine. Intruder blends in (visitor lanyards worn by several staff, not a tell).
- [x] Room identity & environmental detail: reception counter + sofa + rug, conference table + chairs, office workstations with monitors, server racks, gold Data Vault on a plinth with railing, Security Office video wall, mailroom shelving + exit, plants/cabinets throughout.
- [x] Materials, lighting & contrast: ACES tone mapping + exposure, retuned key/fill/rim, per-signature-room accent point lights (reception warm, server cool, vault gold, SOC violet), ceiling light strips, solid readable floor finishes. Dark plaza + distant skyline backdrop so the tower sits in a place.
- [x] Cutaway clarity: open front face, low glass partitions with lit rails (don't hide people), stair core with treads + glass rail, front fascia beams framing each floor.
- [x] Selection & camera: hover ring on pickables, selection ring on inspect, smooth camera focus-on-clue (click a Signal-feed item → glide + select), Sophia's teaching beats gently focus the camera (first clue, ransomware lock).
- [x] Product effects legible: EDR shield dome + floor ring + guarded-screen tint, NDR coverage beam up the core with per-floor scan rings, deploy pulse, XDR correlation lines drawn console→clues on confirm. Inspect card shows room purpose + occupants + "Visibility here" coverage pills (which sensors watch this room) — fog-of-war made legible.
- [x] Interface readability: removed product-tagline truncation (2-line wrap), rebuilt Signal-feed rows (no more one-word-per-line), richer inspect cards, Sophia identity (avatar breathing ring + online dot, higher-contrast copy), friendlier prep-phase feed hint. EN/中文 maintained.
- [x] **Bugfix (pre-existing):** `#labels`/`#toasts` full-screen overlays were intercepting pointer events (`#overlay > *` beat `.labels` on specificity), which silently broke clicking rooms/people/desks on the canvas and the topbar language button. Fixed layering + gave the topbar an explicit z-index. (Was never caught because the smoke test drives the engine directly and never clicks the canvas.)
- [x] Verified: smoke (strong→win 9/9, none→breach, isolate→contain) + direct visual inspection of setup, deploy, coverage, confirm/correlation, inspect cards (EN+中文), end, spatial replay — screenshots in `tools/shots/`.
- [ ] Human play-test & tuning review with client (still recommended before a live event).

## Milestone 2.6 — Polished single-floor sample (art-direction benchmark) — DONE, verified
Client asked to establish a finished visual + interaction standard on **one** representative
floor before extending across the building. See `ART_DIRECTION.md`.
- [x] Art direction defined (references, camera, proportions, palette, lighting, materials, character style, LOD) — `ART_DIRECTION.md`
- [x] Re-staged the full incident onto a **single floor** (`src/data/scenario.js`): reception/entrance → open office → server room → data room → mailroom/exit, off a central corridor. Engine/mechanics unchanged (room/desk ids kept stable).
- [x] New single-floor generator (`src/world/building.js`): diorama base, oak floor, corridor spine, glass-fronted rooms, exterior walls (open front, dollhouse), **in-world canvas signage** (bilingual), per-room furniture that gives distinct identity, nav graph.
- [x] Rendering lift (`src/world/world.js`): **soft shadow mapping** (PCFSoft), warm daylight key + sky fill, ACES tone-mapping tuned so surfaces read (not blown out), studio gradient backdrop, near-ortho dollhouse camera framed on the floor.
- [x] Characters: rounded heads, **cast real shadows**, retained walk/sit-work/idle animation; furniture rebuilt (desks+monitors+office chairs, reception counter+logo wall+lounge, conference table, server racks, gold data core+railing, SOC video wall, mailroom shelves).
- [x] Product effects on the floor: EDR shield rings, **NDR corridor sensor line** + scan rings, AF entrance arch, deploy pulses, XDR correlation lines, coverage pills in inspect.
- [x] Interface fits the scene: dropped floating DOM room labels (in-world signage instead), inspect shows room purpose + coverage, feed/timeline readable, Sophia identity. EN/中文.
- [x] Verified: smoke (strong→win, none→ransomware uptime loss, isolate→contain) + canvas picking + direct visual review of setup, close-up, deploy, confirm, inspect (EN+中文), end, replay.
- [ ] Apply the approved standard to additional floors/incidents (next).
- [ ] Human play-test & tuning review with client.

## Milestone 3 — "Night-Ops Command" redesign (substantial creative leap) — DONE, verified
Client asked for a significant creative leap with its own identity (ref image `references/references.png`).
Explored 3 directions (night-ops command [chosen], full holographic table, topological threat map).
- [x] Night security-operations art direction (`ART_DIRECTION.md`): dark void + holographic grid base, building lit by its own interior lights + glowing screens, cool moonlight key, soft shadows.
- [x] Full AAA dark-ops **UI shell** (`overlay.js`+`main.css`): top HUD (business/data/budget/countdown), right column (live incident timeline · asset inspect card with endpoint/network status + Isolate/Restrict/Restore actions · Sophia the security analyst with Show-me), bottom capability deck with live status (ACTIVE / N DEVICES / AVAILABLE) + Defense/Cloud&AI/Operations/Replay tabs, event ticker.
- [x] **Honest outcomes** (engine): Contained / Exfiltration-blocked / **Delayed-not-contained** / Breach / Collapse — a delayed threat no longer reads as a clean win; scores differ. ("Detection is not containment.")
- [x] Sophia reframed as the security analyst; direction-first hint + "Show me" camera focus.
- [x] Cloud & AI / Operations tabs tease the broader accurate product scope (HCI, aStor, ADC, SASE, AICP; XDR, MDR, Security GPT) without forcing them into one mechanic.
- [x] Product accuracy re-verified against the June 2025 **Athena** rebrand (Foundation NGFW/EPP/SWG/NDR; Security Ops XDR/MDR w/ Security GPT; Cloud SASE). Recovery conditions kept explicit.
- [x] Verified: smoke (contain / delayed / breach distinct) + visual review of prep, deploy, confirm, honest end, EN/中文 UI, replay + live render.
- [ ] Human play-test & tuning with client.

## Milestone 5 — Second floor / multi-level (DONE, verified)
- [x] Building generator rebuilt to stack multiple LEVELS (L3 upper + L2 lower) each in its own group, with a shared nav graph linked by an internal stairwell.
- [x] Floor selector UI (left) — switch the shown level; camera moves; only one level renders at a time, so fog-of-war now has a spatial dimension (the intruder can slip to a floor you're not watching; the floor button pulses + the ticker flags it).
- [x] Incident re-staged to span both floors: enter L3 reception -> office foothold -> DOWN the stairwell to L2 Finance for credentials -> back UP to L3 server (ransomware) -> Data Room -> exfil. People populate both floors; inactive-floor people hidden.
- [x] Coverage/observed checks keyed to room ids (L2 rooms share types with L3's product rooms); honest outcomes verified across floors.
- [x] Verified: smoke green (A win/delayed, B collapse, C contained); floor-switch + cross-floor incident rendered.

## Milestone 4 — Depth & content
- [x] Distinct ransomware-led Lockout incident and service-pressure incident
- [x] Infra/business track: HCI, ADC, SASE, aStor preparation
- [x] AICP + Agent Builder local helper-rule workflow
- [x] Ambient audio, keyboard controls and facilitator notes

## Milestone 4 — Demo-grade
- [x] Official Sangfor logo images in the UI and reception signage
- [x] Multiple floors/difficulties, debrief and downloadable session report
- [x] Local-only browser loading tested; no build step or external runtime services

## Open questions for the client
- [ ] Confirm exact official palette values with a brand guideline; current accents are approximate
- [ ] Use current **Athena** product names, classic names (EDR/AF/NDR…), or show both?
- [x] Repository and GitHub Pages URL established
- [ ] Any products to prioritize or de-emphasize for the first customer events?
