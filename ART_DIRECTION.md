# Art Direction — Sentinel: Defend the Tower

## Direction (current): "Night-Ops Command"
A **Sangfor security-operations command centre at night**. The enterprise floor is a lit
scale model on a dark command table; you are the operator. Identity pillars:
- **Cinematic night mood** — dark void + a faint holographic grid base; the building is lit by
  its own interior lights and glowing screens (gold Data Room, cyan Server Room, warm
  reception), with a cool moonlight key and soft shadows. Premium, on-theme, and it makes
  fog-of-war feel natural (the floor is a live model you illuminate with sensors).
- **A dense, professional dark-ops UI** (the biggest "finished product" lever): a top status
  bar (business/data/budget/clock), a right column (live incident timeline · asset inspect
  card with endpoint/network status + actions · Sophia the security analyst), a bottom
  capability deck with live status + Defense/Cloud&AI/Operations/Replay tabs, and an event
  ticker. Structure inspired by the client's reference image's *qualities* (readable evidence,
  purposeful actions, integrated guidance) — original design, not a copy.
- **Sensor holograms** — deployed capabilities project cyan coverage/scan rings, an entrance
  arch, protected-endpoint auras, and the suspicious route appears only where observed.
- Accent discipline: cyan = sensing/visibility, **Sangfor red** = brand + danger/response,
  green = healthy/protected, amber/red = threat.

Explored alternatives: a full wireframe holographic command-table (bolder but riskier for
readability) and an abstract topological threat-map (loses the recognizable space). Night-Ops
Command keeps the space readable while giving a distinctive identity and strong presales feel.

---

## Earlier note: miniature-diorama bar (still the base geometry/craft standard)
Goal: an **attractive miniature corporate building** — a diorama you'd want to pick up and
turn around. This document sets the quality bar for the single-floor sample; once approved it
is applied to the rest of the building.

## References & the qualities we adopt
Researched polished stylized/miniature environments and readable strategy games. The look we
are targeting borrows these qualities:

- **Two Point Hospital / Two Point Campus** — instantly readable room identity through
  furniture and props; a clean dollhouse cutaway; warm, even interior lighting; characters
  with personality built from simple, consistent forms.
- **The Sims (build/"walls down" view)** — open-roof cutaway and low/glass walls so every
  room stays legible from one angle; room function read from layout and furniture.
- **Monument Valley / Townscaper** — matte, flat-shaded surfaces; soft ambient occlusion;
  calm, slightly desaturated palette; deliberate, soft lighting; toy-like rounded forms.
- **Mini Motorways / Mini Metro** — a restrained palette with **one** strong accent colour
  used purposefully (for us: Sangfor red, reserved for brand + security meaning).
- **Tilt-shift architectural diorama renders** — a model sitting on a base, grounded by
  **soft contact shadows**, with a crisp three-quarter near-orthographic view.

Sources (style reference only; no assets taken): tilt-shift/diorama and isometric low-poly
look surveyed via web search 2026-10 (AI prompt galleries at carat.im / krea.ai; isometric
definition at hitem3d.ai). Free CC0 asset ecosystems noted below.

## The target, concretely
- **Camera:** three-quarter, near-orthographic (perspective FOV ~26°, elevation ~36°),
  constrained orbit over the single floor; smooth zoom; focus-on-subject glide. The building
  is the visual focus and fills the frame; it sits on a rounded **diorama base**.
- **Proportions:** slightly toy/chibi — people ~1.45u with a larger head; rooms generous so
  furniture and people read; wall height ~1.4u (people's heads clear the walls).
- **Palette:** brighter, neutral interiors — warm **light-oak floors**, soft off-white walls,
  muted slate/teal furniture, greenery. Sangfor **red (#E60027 placeholder)** reserved for
  brand, signage accents and security equipment. Each room keeps a gentle signature tint
  (server = cool cyan, data room = warm gold, reception = warm).
- **Lighting:** one warm key **directional light that casts soft shadows** (PCFSoft), a cool
  sky/ground **hemisphere** fill, a low ambient, and emissive **ceiling light panels**.
  ACES tone-mapping. Bright enough to feel like daylight, not a dark SOC.
- **Materials:** matte, low-roughness-variation `MeshStandard`, flat-shaded; consistent token
  palette; no mirror/metal except intentional accents (glass partitions, server metal).
- **Character style:** rounded low-poly (sphere head, soft limbs), expressive silhouette,
  varied but harmonious colours; walk / sit-and-work / idle animation; everyone casts a
  shadow. The intruder is drawn from the same palette — never visually "the villain".
- **Level of detail:** intentional silhouettes over object count. Each prop earns its place
  (doors with frames, wall signage, ceiling lights, planters, occupied desks). No copy-paste
  filler.

## Asset approach & provenance
Evaluated CC0 packs (**Kenney** furniture/characters and **Quaternius** low-poly furniture &
animated characters — both CC0, commercial-use OK, no attribution required). Decision:
**author cohesive original stylized assets procedurally**, because (1) GitHub Pages must stay
self-contained with relative paths and load fast/offline, (2) a single authored style
guarantees cohesion, and (3) provenance stays clean (all game art is original). The quality
leap comes from **soft shadows + ambient-occlusion feel + a disciplined palette + deliberate
lighting + composition**, not from object count. CC0 packs remain a documented drop-in option
if the client later prefers them.

Official **Sangfor logo and exact brand red remain explicit placeholders** (clearly marked),
kept distinct from original game artwork, pending official assets from the client.
