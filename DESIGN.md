# Sentinel: Defend the Tower — Design Document

> An interactive "protect the building" game for Sangfor's international business:
> product introductions, presales conversations, and customer events.

Status: **Milestone 2 (3D living-building redesign)** · Last updated: 2026-10-13

> **Milestone 2 redesign note.** The experience was rebuilt from a 2D dashboard into a
> living **3D isometric cutaway** (Three.js, vendored locally): floors, rooms, desks,
> server racks, a Data Vault, and **people who move**. Detection/response are now visible
> *in the world* (clue markers, movement trails, containment cages, a reveal ring).
> Pacing is phased — a calm **SETUP** with no clock → **LIVE** incident → **REVIEW** with a
> **spatial replay** that animates the true route on the building. Product copy was
> corrected for accuracy; in particular **aStor** is framed as resilient storage with
> immutable snapshots (recovery needs prior preparation), *not* automatic full backup/restore.
> The product→metaphor research below still holds; the room/geometry specifics are
> superseded by `src/data/scenario.js` + `src/world/`.
>
> **Milestone 2.5 refinement (presentation).** The building and incident were polished for
> customer-facing clarity: articulated characters that walk/sit/work, recognizable room
> identities (reception, offices, meeting room, server room, Data Vault, Security Office,
> mailroom) through furniture + accent lighting, ACES tone-mapped lighting with better
> contrast, a glass-partition cutaway, a plaza/skyline backdrop, hover + selection rings,
> camera focus-on-clue, and legible product effects (EDR shield dome, NDR coverage beam,
> deploy pulse, XDR correlation lines). The inspect card now shows each room's purpose and a
> "Visibility here" coverage summary. A pre-existing pointer-events bug that blocked clicking
> the 3D scene and the language button was fixed. See `TASKS.md` → Milestone 2.5.

---

## 1. Goal

Help enterprise customers *feel* what Sangfor's cybersecurity, cloud, and AI products
do, which problems they solve, and how they work **together** — through a short,
replayable, strategy game rather than a slide deck.

Design pillars:

1. **Limited visibility is the hook.** Players do **not** see every attacker. Each
   product grants a *different* kind of visibility, evidence, and response. You
   discover the incident gradually, and only correlation (XDR) + people (MDR) turn
   scattered clues into a confident, correct response.
2. **Meaningful trade-offs.** A constrained budget means you cannot buy everything.
   Every product has a real strength *and* a real limitation and dependency, mirroring
   the actual portfolio.
3. **Operate while under attack.** The business must keep running. Over-reacting
   (isolating the wrong room) hurts uptime just like an undetected breach does.
4. **The replay teaches.** An end-of-session timeline reveals the true attacker path
   and annotates what each deployment caught, what was missed, and why.

## 2. Story & setting

**Meridian Tower** is the HQ of a growing enterprise. You are its new security
operator. Over one "business quarter" (a ~1-minute session at normal speed) threat
actors attempt to infiltrate, move laterally, steal the crown-jewel data in the Vault,
and disrupt operations with ransomware. You deploy Sangfor capabilities, read the clues
they surface, and act — while keeping the business online.

Two archetypes (expandable):
- **The Thief** — a stealthy data-theft actor (APT-style): infiltrate → recon →
  lateral movement → collect → **exfiltrate** the Vault's data.
- **The Robber** — disruption/ransomware: **locks rooms** (downtime) and demands recovery.

## 3. The building (Level 1)

A side-view cutaway. Attackers originate at the **Internet Perimeter** (top) and work
downward/inward toward the **Data Vault**.

```
            ┌─────────────────── INTERNET PERIMETER ───────────────────┐   [AF slot]
  Floor 4   │  Executive Office        │   DATA VAULT (crown jewels)    │
  Floor 3   │  Server Room (systems)   │   Dev / Build                  │
  Floor 2   │  Finance                 │   HR                           │
  Floor 1   │  Reception               │   Open Office                  │
            └───────────────── OUTBOUND GATEWAY / BRANCH ───────────────┘   [IAG / SASE slot]
                         [ Command Room: XDR ]   [ MDR roster ]
```

## 4. Product economy & roles (grounded in research — see `assets/brand/ASSETS.md`)

Visibility is keyed to **evidence type** and **location**:

| Product | Deploy where | Sees (evidence) | Can do | Key limitation (teachable) |
|---|---|---|---|---|
| **AF** (NGAF) | Perimeter | `exploit` (inbound) | Block/slow intrusion at the door | Blind once the attacker is *inside* |
| **EDR** (Endpoint Secure) | Per room | `endpoint` in that room | Isolate host; auto-stop ransomware (~3s honeypot) | Only sees rooms where it's installed |
| **STA/NDR** (Cyber Command) | Building-wide (1 buy) | `network` (lateral movement) everywhere | Trace movement, map the path | Can't see host actions or block on the host |
| **IAG** | Outbound gateway | `exfil` (data leaving) | DLP: block exfiltration | Watches the exit, not the intrusion |
| **XDR** (XDDR) | Command Room | — (consumes others' clues) | Correlate ≥2 clue types → *Confirmed* incident, reveal location, boost response | Needs sensors feeding it; useless alone |
| **MDR** (Cyber Guardian) | Roster | — | 24/7 analysts: recommendations + assisted containment | Costs the most; advises, you still decide |
| **aStor** | Vault/systems | — | Backup → recover locked rooms (restore uptime) | Recovery, not prevention |
| **SASE / ADC / HCI / AICP / Agent Builder** | Infra track (later milestones) | — | Business growth, availability, AI automation | Expand capacity *and* attack surface |

Budget: you start with limited credits and earn a small income over time. You cannot
afford full coverage — the game is about *where* you invest.

## 5. Core loop

1. **Deploy** products to eligible slots (spend budget).
2. **Observe** clues surfaced by your coverage (fog-of-war). Weak isolated clues vs.
   confident correlated incidents.
3. **Ask Sophia** when a clue/action/product is unclear (layered hints).
4. **Respond**: isolate a room, block the perimeter, or recover a locked room — ideally
   where you have confidence, because a wrong response costs uptime.
5. **Keep the business up** until the quarter review.

**Win:** contain the attacker and reach the quarter review with Vault data intact and
business uptime healthy. **Lose:** Vault data exfiltrated, or uptime collapses.

## 6. Sophia, the guide

An AI guide (framed as powered by Sangfor's **AICP / Security GPT**, tying the AI line
into the fiction). She appears as a friendly avatar in the corner, greets the player,
and offers **layered, event-triggered hints**: first a direction, then — only if asked
again — the reasoning, always preserving the player's decision. Milestone 1 uses
carefully authored hints; live LLM integration is a later option.

## 7. Visual & brand direction

- Dark "security operations command center" aesthetic with a **Sangfor-red** accent.
- Original game artwork (building, characters, Sophia, environments) is clearly ours.
- Official Sangfor logo and product branding are **placeholders with recorded sources**
  (`assets/brand/ASSETS.md`) to be swapped for official assets after review.
- Product icons are a consistent original set, each paired with the accurate name.

## 8. Technical approach

- **Static, no-build browser app** (HTML + CSS + ES modules). Deploys directly to
  GitHub Pages at a `github.io/<repo>/` subpath using **relative paths** only.
- Data-driven: levels, products, events, and Sophia's hints live in `src/data/` and are
  easy to edit without touching engine code.
- **EN / 中文** localization via a simple `t(key)` dictionary (`src/i18n.js`).
- Verified by running headless (Playwright) to catch console errors and capture
  screenshots — not judged from reading code alone.

See `TASKS.md` for the roadmap and `README.md` for how to run/deploy.
