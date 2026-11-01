# Last Stand: Sangfor equipment art preview

- Review tag: `stand-sangfor-visuals-v1.1`
- Branch: `feat/stand-sangfor-visuals`
- Baseline: `abb6797` on `main`
- Preview: [stand-sangfor.html](../stand-sangfor.html)
- Comparison: [stand.html](../stand.html)

## Result

The preview replaces the floating product badges, block-shaped operator and glowing threat spheres with original, lit 3D equipment and creatures. Existing official Sangfor logos remain attached to the equipment and visible in the HUD and product cards.

| Deployment | Preview appearance |
| --- | --- |
| Command avatar | Tracked mobile chassis, dual barrels, vents, corporate decal |
| EDR | White/graphite turret, paired metal barrels, green status strips |
| NGAF | Two appliance emitters and a restrained translucent barrier |
| MDR / temporary teams | Armored operatives, helmet visors, team accents |
| NDR | Antenna mast and radar dish |
| IAG | Low network appliance, ports, status LEDs and antennas |
| HCI | Three-bay compute appliance, placed separately from the command avatar |
| XDR | Relay appliance with a ring emitter |
| aStor | Five-bay storage vault |

All five normal threats and four bosses have modeled silhouettes: thorned mites, segmented worms, winged exfiltrators, cloaked mantas, armored ransomware claws, botnet tendrils and a larger siege creature. These are stylized arcade sculptures, not photorealistic scanned assets.

The deck has panel seams, mechanical borders and a segmented base. A steeper camera shows more of the firing lane. Neutral lighting exposes chassis details. Upgrade cards show renders of the equipment they deploy, alongside the official product mark. Preview-only styling simplifies the HUD and shortens the bilingual start instructions. Impact rings and screen flashes are reduced to preserve readability.

## Isolation and implementation

- `stand.html` keeps the original art. The opt-in `stand-sangfor.html` entry uses the same orchestrator, simulation, input, scoring, leaderboard and product codex.
- The v1.1 preview versions its orchestrator and engine URLs so cached scripts from an earlier visit to the original game cannot silently select the old renderer. The initial v1 tag remains an immutable source snapshot.
- `model.js` is unchanged. No balancing changes, new abilities, monetization or external services were introduced.
- `engine.js` accepts an optional art factory and delegates model creation/animation. Legacy camera, lights and bloom remain the defaults.
- `sangfor-art.js` builds native Three.js geometry, merges parts by material and caches model templates. Instances share geometry and own their materials. Removed units release instance materials; shared geometry is released when the game is destroyed.
- Unit rebuilding now removes children using the scene graph API instead of directly popping the children array.
- The preview uses a direct scene pass and disables preserved drawing buffers. No bloom render targets or additional runtime libraries are required.
- Equipment card images are small WebP renders of these same meshes. They load in menus/cards, not as a new game scene or additional WebGL renderer during play.
- Both interfaces remain available. All newly added explanatory strings have English and Chinese versions.

## Validation

Executed locally:

```text
node --test tools/engine.test.mjs tools/rush-logic.test.mjs tools/arcade-logic.test.mjs
65 passed

npm run render:stand-art
9 WebP previews rendered from the game meshes

npm run test:stand-art
Last Stand equipment preview checks passed
```

The browser integration check covers language switching; actual bullet damage leading to XP, an upgrade offer and a selected deployment; all eight product renderers; all nine threat renderers; pause; repeated unit rebuilds; support-team counts and cooldown rejection; restart; a 390 x 844 phone viewport; movement to the right boundary; and the legacy entry. It checks console errors, page errors and failed HTTP responses.

The inspection screenshot deliberately places all products and all threat types in one paused fixture. It is not evidence of a natural run, balance, or victory. The upgrade screenshot uses a one-hit target fixture followed by the normal firing/XP/choice path. Service-team screenshots also use a fixture.

Observed inspection cost: approximately 137 draws and 58,218 triangles. Geometry count stayed at 103 before/after six warmed unit rebuilds. These are renderer counters, not FPS claims or a benchmark on every GPU. The browser test enforces an inspection budget of fewer than 300 draws and 150,000 triangles. No full tower-game browser rerun is claimed for this isolated Last Stand visual change.

## Review images

Original battlefield:

![Original Last Stand](screenshots/stand-sangfor/before.png)

New equipment and all threats, paused inspection fixture:

![Equipment and threat inspection fixture](screenshots/stand-sangfor/after-fixture.png)

New equipment cards:

![Equipment upgrade cards](screenshots/stand-sangfor/upgrades.png)

Phone movement boundary after restart:

![Phone battlefield](screenshots/stand-sangfor/mobile.png)

## Asset provenance and rebuilding

New geometry, floor texture, labels and preview renders are original procedural artwork in this repository. Brand decals reuse the existing official artwork documented in `assets/brand/ASSETS.md`. Product marks retain their source image aspect ratios; they are not recolored or redrawn. The equipment is fictional arcade concept art and does not depict commercial appliance specifications.

Run `npm ci`, then `npm run render:stand-art` to regenerate the images, and `npm run test:stand-art` to validate the preview. `npm run serve` exposes both entries. The optional `HEADED=1` environment setting makes the standalone browser check visible.

The tag records a reviewable source version. GitHub Pages previews require publishing the files on the configured Pages branch; creating a tag alone does not deploy a website.
