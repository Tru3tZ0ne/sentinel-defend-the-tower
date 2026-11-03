# Last Stand: matte chassis and continuous training arena

Release: `stand-matte-arena-v1`; branch: `feat/stand-matte-arena`.
Base: `04e9560` / `stand-agent-workflow-v1`.

## Visual problem and resulting design

Previously, armor, equipment housings, rails and joints shared a blue-gray,
strongly metallic appearance. Repeated riveted floor panels and full miniature
server racks made the character and arena resemble assembled sheet-metal parts.

The new design uses warm ivory/sage painted shells, deep-green composite insets,
dark flexible joints and small machined metal contacts. Large armor surfaces
have roughness 0.68 and metalness 0.06; white housings use 0.62/0.03. Actual metal
keeps 0.33/0.78, so the distinction is material response as well as color.
Environment response is set on the actual materials: 0.18 for painted/composite
surfaces and 0.7 for metal. The over-bright white-shell iteration was rejected
in visual review. Exposure and key/fill colors/intensities are calibrated for
the new surfaces; the final bloom parameters and render passes are unchanged.

The robot retains its recognizable mechanical frame and segmented silhouette.
Its curved visor replaces the intersecting flat face strip; forearm shells and
shoulder caps use paint/composite instead of broad exposed metal. Dark joints
and narrow pistons remain visible. Armor still grows at 0/3/7/14 purchased levels.

EDR, HCI, aStor and XDR now use integrated rounded pods, with inset device faces
and status lights. They no longer carry miniature rack cabinets/ears on the
robot. The MDR arm and AI/IAG housings use the same shell language. NGAF has a
proper shield face, and the AI pod has an inset compute face instead of a
protruding orb. Names and official marks sit on the module faces rather than
below them on hanging label boards. The compact branded XDR backpack remains
recognizable. Agent Builder still reveals its cached wrist console only while
the workflow runs. Original official mark files are unchanged.

The arena uses a continuous matte resin/composite surface with broad, quiet
zoning curves, fine aggregate and sparse guide marks. Dense tile seams, rivets,
repeated bollards and the row of base rack fronts are replaced by low curved
curbs and a designed command dock. The 1024px texture is generated once with
deterministic arithmetic; it consumes no combat randomness and adds no asset
download. Fog and backdrop use subdued green/neutral tones instead of the
previous saturated blue horizon. Threats retain their shapes and colors, with
less metallic shells/jaws to read as creatures rather than metal equipment.

HUD buttons, level badge and product chips use quiet matte surfaces with more
restrained UI glow. Positions, button sizes, phone dock and both languages are
preserved. All nine native-mesh WebP previews are re-rendered, and game/gallery
cache markers are updated. The optional gallery still inspects the earlier
standalone equipment concepts, not the assembled mech or every new mounted pod.

## Scope and performance

No gameplay numbers, upgrade rules, physics, targeting, damage, score formula,
Agent workflow stages/cooldown or ten-second offer rules changed. The combat
closure, model and runtime are compared with the base in the validation record.
The main seeded combat results remain desktop 47/60 and phone 39/60 for casual
mixed builds, 12/12 informed and 0/12 cloud/idle on both devices. Historical
combined main/held-out results and human-testing limits remain in the Agent
release record; no new human clear-rate claim is made.

No dependencies, imported models, HDR downloads, extra lighting passes or new
per-frame geometry builds are added. Lights remain present, main shadows remain
2048px PCF soft, antialiasing and native DPR up to 2 remain enabled, and bloom
strength/radius/threshold remain 0.55/0.6/0.72 in the main cinematic entry.
Instanced bullets/threats/lightning, caches, support teams and all live effects
are retained. Reduced geometry counts come from the new designed pods/arena,
not entity, effect or resolution caps. See `stand-matte-validation.json` for
fixed scene cost, retained FX, reuse checks and limitations. Fixed counters do
not establish a hardware FPS improvement.

## Reproduction and review

```sh
npm run test:stand-art
node tools/stand-matte-review.mjs before
node tools/stand-matte-review.mjs after
```

The review tool captures desktop/phone arena fixtures and bare/full mech close
views. `before` serves only the original rendering/CSS files from base commit
`04e9560` through local Playwright routing; it does not modify the checkout.
Both versions use the same fixture setup. Phone fixtures start afresh at phone
dimensions, rather than retaining desktop enemy coordinates. Close views use
the native meshes and a fixed separate inspection camera, not a new game camera.
Screenshots are marked `FIXTURE`; stationary durable targets and forced loadouts
are inspection evidence, not natural play or performance measurements.

Selected evidence is stored in `screenshots/stand-matte/`. Browser regression
also verifies EN/ZH, all four service controls, workflow delivery/cooldown,
ten-second recommendation, mobile bounds, actual failure/victory, score isolation,
replay, XDR charging/discharge, gallery interaction and zero page/resource errors.
Existing performance budgets and assertions are unchanged.

These remain original procedural arcade models. This release improves material
hierarchy and product integration; it does not introduce photorealistic imported
characters or environments. The continuation brief is
`CLAUDE_STAND_VISUALS_HANDOFF.txt`. Publish main and the new immutable tag together,
then verify actual Pages resources and controls. Current entry/import markers:
`campaign=matte-arena-v1`, `art=matte-arena-v1`, `mech=matte-v1`.
