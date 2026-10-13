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

## Milestone 2 — Depth & polish (next)
- [ ] Second attacker archetype fully distinct (ransomware-led "Robber" path)
- [ ] Infra/business track: HCI foundation unlocks floors; ADC vs DDoS; aStor backups; SASE remote branch risk
- [ ] AICP + Agent Builder: AI automation (auto-triage, build a helper agent)
- [ ] Richer animations (attacker movement, clue pulses, containment effects)
- [ ] Tutorial level that introduces one product at a time
- [ ] Sound/feedback, accessibility pass (keyboard, contrast, reduced-motion)

## Milestone 3 — Demo-grade & deploy
- [ ] Swap in official Sangfor logo/product branding (pending client assets)
- [ ] Multiple levels / difficulty; scoring & leaderboard-style summary for events
- [ ] Deploy to GitHub Pages (github.io) + offline demo build evaluation
- [ ] Presales facilitator notes (what each moment demonstrates)

## Open questions for the client
- [ ] Confirm official brand palette (exact Sangfor red hex) and provide logo/icon files
- [ ] Use current **Athena** product names, classic names (EDR/AF/NDR…), or show both?
- [ ] Target repo name / github.io URL for deployment
- [ ] Any products to prioritize or de-emphasize for the first customer events?
