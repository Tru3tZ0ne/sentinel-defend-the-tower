# Task tracking — Sentinel: Defend the Tower

Legend: [x] done · [~] in progress · [ ] todo

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

## Milestone 3 — Depth & polish (next)
- [ ] Hover highlight / selection outline; camera focus-on-clue; click a marker to inspect
- [ ] Distinct ransomware-led "Robber" incident; branching second scenario
- [ ] Infra/business track woven into the world: HCI foundation, ADC vs DDoS, SASE remote branch, aStor snapshots prepared in SETUP
- [ ] AICP + Agent Builder: Sophia/automation framing; build-a-helper-agent moment
- [ ] Walk/idle character animation, ambient audio, accessibility (keyboard, contrast, reduced-motion already respected)
- [ ] Facilitator notes (what each beat demonstrates in a presales conversation)

## Milestone 4 — Demo-grade
- [ ] Swap in official Sangfor logo/product branding (pending client assets)
- [ ] Multiple levels / difficulty; event-friendly summary
- [ ] Offline demo build evaluation

## Open questions for the client
- [ ] Confirm official brand palette (exact Sangfor red hex) and provide logo/icon files
- [ ] Use current **Athena** product names, classic names (EDR/AF/NDR…), or show both?
- [ ] Target repo name / github.io URL for deployment
- [ ] Any products to prioritize or de-emphasize for the first customer events?
