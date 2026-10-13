# Asset sources & provenance

This game clearly separates **original game artwork** (ours, freely editable) from
**official Sangfor brand assets** (placeholders here, to be reviewed and swapped for
official files).

## Original game artwork (created for this project)
- Building cutaway, rooms, characters, Sophia avatar — original SVG/CSS.
- Product **game icons** (`src/ui/icons.js`) — original, consistent icon set. Each is
  always shown *with the accurate product name* so the metaphor never replaces the brand.
- UI, HUD, replay timeline — original.

## Official Sangfor brand assets — PLACEHOLDERS (verify & replace)
| Asset | Current state | Official source to pull from |
|---|---|---|
| Corporate logo / wordmark | Original placeholder wordmark (`logo.svg`), clearly marked | Sangfor Press & Media Kit 2026: https://hub.sangfor.com/press-media-kit-2026 |
| Brand primary color | Sangfor-red accent `--brand: #E60027` used as a **reasoned placeholder** | Confirm exact hex from official brand kit above |
| Product icons/imagery | Original game icons (placeholders) | Product pages / brochures (see links below) |

> ⚠️ The brand color and logo are reasoned placeholders. Before any customer-facing
> deployment, confirm the exact Sangfor red and drop in the official logo/icon files,
> then update this file.

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
