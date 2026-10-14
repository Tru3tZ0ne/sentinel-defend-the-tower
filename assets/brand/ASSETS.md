# Current brand assets — 2026-10-14

These files are official artwork, displayed without recoloring, redrawing, distortion or
trimming any part of a mark. Their presence does not imply an integration with a live Sangfor service.

| File | Source | Use |
| --- | --- | --- |
| `sangfor-logo-white.png` | [Official media kit](https://hub.sangfor.com/press-media-kit-2026) | Corporate header and reception |
| `sangfor-logo-color.png` | Same media kit | Retained full-color corporate variant |
| `sangfor-athena-white.png` | [Official Logo PPT](https://hub.sangfor.com/hubfs/HQ-Headquarters/HQ%20Files/Sangfor%20Logo%20PPT.pptx), `ppt/media/image14.png` | Security portfolio tab |
| `sangfor-cloud-white.png` | Same PPT, `ppt/media/image6.png` | Cloud portfolio tab |
| `solvia.png` | [Official community image](https://community.sangfor.com/webapp/common/page/image/new_online.png) | Solvia panda game guide |

The [official technical support page](https://www.sangfor.com/support/technical-support)
links to Solvia. The assistant in this game runs local authored hints and helper rules;
it is not connected to the official support assistant. Internal `sophia` identifiers remain
for compatibility; all displayed assistant naming is Solvia. The previous human portrait
is no longer used. Functional SVG pictograms in `src/ui/icons.js` are original game UI,
not official product marks. Portfolio names follow the official Athena product pages.

## Individual product marks

All seven defense cards and all four infrastructure cards now render local official
product artwork through `src/ui/product-marks.js`. The inspector's product coverage
badges use the same mapping. Room/action/evidence pictograms remain semantic game UI.
These are official product/community symbols, including legacy symbols still used in
Sangfor's current community; this is not a claim that they are a new Athena logo suite.
STA is the sensor role in the NDR card, which uses the official NDR/Cyber Command mark.
The AICP card uses the official AI Application Innovation Platform forum symbol; Agent
Builder has no separately verified mark in this asset set.

| Product in game | Local file under `products/` | Official source |
| --- | --- | --- |
| AF / NGFW | `sangfor-ngfw.png` | [NGFW forum symbol](https://community.sangfor.com/data/attachment/common/d3d/common_10_icon.png) |
| EDR / EPP | `sangfor-epp.png` | [EPP forum symbol](https://community.sangfor.com/data/attachment/common/764/common_89_icon.png) |
| STA / NDR | `sangfor-ndr.png` | [NDR forum symbol](https://community.sangfor.com/data/attachment/common/92c/common_92_icon.png) |
| IAG / SWG | `sangfor-swg.png` | [SWG forum symbol](https://community.sangfor.com/data/attachment/common/45c/common_9_icon.png) |
| XDR | `sangfor-xdr.jpg` | [XDR forum symbol](https://community.sangfor.com/data/attachment/common/013/common_138_icon.jpg) |
| MDR | `sangfor-mdr.png` | [Official SecOps solution diagram](https://www.sangfor.com/sites/default/files/inline-images/Sangfor-Simplified-Security-Operations-Solution-2_0.png) |
| aStor | `sangfor-astor.png` | [aStor forum symbol](https://community.sangfor.com/data/attachment/common/42a/common_136_icon.png) |
| HCI | `sangfor-hci.png` | [HCI forum symbol](https://community.sangfor.com/data/attachment/common/67c/common_47_icon.png) |
| ADC | `sangfor-adc.png` | [Application Delivery forum symbol](https://bbs.sangfor.com.cn/data/attachment/common/64/common_48_icon.png) |
| SASE | `sangfor-sase.png` | [Access Secure / SASE forum symbol](https://community.sangfor.com/data/attachment/common/903/common_143_icon.png) |
| AICP | `sangfor-aicp.png` | [AI platform forum symbol](https://bbs.sangfor.com.cn/data/attachment/common/ef/common_351_icon.png) |

Product-to-symbol associations were checked against the named sections of the
[global community index](https://community.sangfor.com/forum.php) and the
[regional community index](https://bbs.sangfor.com.cn/forum.php) on 2026-10-14.
Ten files are byte-for-byte downloads. MDR is a lossless rectangular extraction of
the complete shield symbol, retaining its original blue background, from the official
1939×870 diagram: pixel rectangle `(1265,205)-(1425,355)`. No symbol was redrawn,
recolored, stretched or generated. CSS uses `object-fit: contain` with no image filters.
Original artwork remains the property of its respective owner; these files are not
relicensed as original game artwork. Do not hotlink runtime assets.

The historical research below remains useful for source links. Current render costs and
art direction must be measured again; earlier performance numbers are not current budgets.

---

# Asset sources & provenance

This game clearly separates **original game artwork** (ours, freely editable) from
**official Sangfor brand assets**. The inventory above supersedes historical
placeholder notes below.

## Historical art research (superseded by the current inventory)

### Original game artwork (created for this project)
- **3D miniature floor, rooms, furniture, characters — original**, authored
  procedurally in Three.js (`src/world/*`). Art direction: `ART_DIRECTION.md`.
- Original **semantic pictograms** (`src/ui/icons.js`) serve room types, actions and
  evidence. Official product artwork is rendered separately by `product-marks.js`.
- In-world room **signage** is rendered to canvas textures from the localized room names.
- UI, HUD, replay timeline — original.

### 3D asset approach (evaluated, decided)
Evaluated CC0 asset ecosystems for finished models:
- **Kenney** (https://kenney.nl) — furniture & character kits, CC0, commercial use OK, no attribution required.
- **Quaternius** (https://quaternius.com) — low-poly furniture and rigged/animated characters, CC0.
- OpenGameArt listings confirm both as CC0.

**Decision: author cohesive original stylized assets** (no third-party models imported),
because GitHub Pages must stay self-contained with relative paths and load fast/offline, a
single authored style guarantees cohesion, and provenance stays clean. The finished look comes
from soft shadows + a disciplined palette + deliberate lighting + composition, not object
count. CC0 packs above remain a documented drop-in option if the client later prefers them.
All original game art is kept clearly distinct from official Sangfor product logos.

## Official Sangfor brand assets — RESOLVED from the official media kit
Source: **Sangfor Press & Media Kit 2026** — https://hub.sangfor.com/press-media-kit-2026
(retrieved 2026-10-13). Usage terms from that page: *"It is not allowed to change the
trademarks, including but not limited to logo graphics, fonts, kerning"*; the colour logo is
preferred; monochrome (white/black) allowed only under limited conditions. We display the
**unaltered official logo** and keep all game artwork clearly separate.

| Asset | State | Source |
|---|---|---|
| **Corporate logo (white)** — in-app HUD/start/end + reception wall | ✅ Official, in repo: `assets/brand/sangfor-logo-white.png` | https://hub.sangfor.com/hs-fs/hubfs/logo%20white%20sangfor-1.png |
| **Corporate logo (full colour)** — kept for light backgrounds | ✅ Official, in repo: `assets/brand/sangfor-logo-color.png` | https://hub.sangfor.com/hs-fs/hubfs/Sangfor%20Original%20Logo.png |
| Logo PPT kit (reference) | not vendored | https://hub.sangfor.com/hubfs/HQ-Headquarters/HQ%20Files/Sangfor%20Logo%20PPT.pptx |
| Product icons/imagery | Original game icons (ours, each shown with the accurate product name) | Product pages (links below) |

### Brand colours — the media kit publishes NO numeric values
The media kit does not list any hex/RGB/Pantone/CMYK. We therefore **sampled the official
logo PNGs** and distinguish *verified-from-asset* corporate colours from a *provisional UI
accent*:

| Token | Value | Status |
|---|---|---|
| `--brand` (Sangfor green, logo globe) | **#72bb38** | Verified by sampling the official logo PNG |
| `--brand-2` (Sangfor Athena teal) | **#16ca78** | Verified by sampling the official Athena shield |
| `--athena-blue` | **#1e91ed** | Verified by sampling the official Athena shield |
| Deep brand blue / navy | #263c92 / #2a355a | Sampled from the official globe |
| `--cyan` (sensor/UI accent) | #39c0ff | **Provisional interface accent** (not a published brand colour) |
| `--danger` (threat/response) | #ff4d5e | Semantic, not a brand colour |

All colour tokens live centrally in `src/style/main.css` `:root` (and `P.brand` in
`src/world/building.js`) — change two tokens to re-skin.

> ⚠️ **Precise remaining question for the client:** Sangfor's public media kit does not
> publish numeric brand-colour values. Please confirm the **exact corporate hex / Pantone /
> CMYK** for Sangfor green and the Sangfor Athena palette from your internal brand guidelines,
> so we can replace the sampled approximations (currently #72bb38 / #16ca78 / #1e91ed) with
> the authoritative values. This remains an outstanding branding item; it does not block
> development.

### Performance (measured)
Measured in the headless **software-GL (SwiftShader, CPU)** test environment: **~5,810
triangles, 185 draw calls, 1 shadow map**; frame rate there is ~0.6 FPS purely because it is
CPU rasterisation. The geometry/draw-call budget is very small, but **real-GPU frame rate on
customer laptops/tablets is not yet independently verified** (no GPU hardware available in the
build environment) — to be confirmed on target devices.

## Research sources (product positioning — official Sangfor materials)
- Cybersecurity portfolio / Athena brand: https://www.sangfor.com/cybersecurity
- Endpoint Secure (EDR / Athena EPP): https://new.sangfor.com/en/products/cyber-security/endpoint-secure
- Network Secure / NGAF (AF / Athena NGFW): https://new.sangfor.com/en/products/cyber-security/ngaf-next-generation-firewall
- Cyber Command (NDR / Athena NDR) + STA sensor: https://www.sangfor.com/cybersecurity/sangfor-athena-foundation/network-detection-and-response-ndr
- Athena NDR datasheet (STA = Stealth Threat Analytics): https://www.sangfor.com/sites/default/files/2025-06/sangfor-br-p-athena-ndr-datasheet-20250616.pdf
- IAG (Internet Access Gateway / SWG, incl. DLP): https://www.sangfor.com/cybersecurity/sangfor-athena-foundation/secure-web-gateway-swg
- SASE / Access Secure / Zero Trust: https://www.sangfor.com/cybersecurity
- XDR (XDDR): https://www.sangfor.com/blog/cybersecurity/what-is-extended-detection-and-response-xdr
- MDR (Cyber Guardian / Athena MDR): https://www.sangfor.com/blog/cybersecurity/what-is-mdr-managed-detection-and-response
- HCI + components (aSV/aNET/aSAN/SKE/AICP): https://www.sangfor.com/cloud-and-infrastructure/solutions/enterprise-application-platform
- aStor distributed storage: https://www.sangfor.com/cloud-and-infrastructure/products/astor-enterprise-data-storage-solution
- Application Delivery (ADC/AD series): https://www.sangfor.com/cybersecurity/products/application-delivery-ad
- AICP / AI infrastructure: https://www.sangfor.com/events-and-webinars/sangfor-spotlights-ai-infrastructure-dcci-summit-2025-hanoi
- Security GPT (AI engine behind XDR/MDR): https://www.sangfor.com/videos/meet-sangfor-security-gpt-your-intelligent-ai-powered-assistant

> Product names changed recently (Network Secure → Athena NGFW, Cyber Command → Athena
> NDR, Endpoint Secure → Athena EPP, Cyber Guardian → Athena MDR). The game currently
> uses the internationally recognized classic names with an Athena note; confirm the
> preferred naming with the client.
