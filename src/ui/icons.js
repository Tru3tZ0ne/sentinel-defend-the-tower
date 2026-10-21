// Original, consistent SVG icon set (our artwork; see assets/brand/ASSETS.md).
// 24x24 viewBox, inherit `currentColor` so they tint via CSS. Each product icon is
// always rendered alongside the accurate product name elsewhere in the UI.

const svg = (body, vb = 24) =>
  `<svg viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  chart: svg('<path d="M4 20V14M9 20V10M14 20V6M19 20V2" stroke-width="3"/>'),
  // AF — perimeter firewall: a shield being screened by scan lines.
  af: svg('<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z"/><path d="M8 9h8M8 12h8M8 15h5"/>'),

  // EDR — in-room guard: a shield with a watchful eye.
  edr: svg('<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z"/><circle cx="12" cy="11" r="2.4"/><path d="M7.5 11c1.7-2.6 7.3-2.6 9 0-1.7 2.6-7.3 2.6-9 0Z"/>'),

  // NDR — network surveillance: a radar/camera with sweeping waves.
  ndr: svg('<circle cx="12" cy="12" r="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M6.5 6.5A7.5 7.5 0 0 1 17.5 6.5M6.5 17.5A7.5 7.5 0 0 0 17.5 17.5"/>'),

  // IAG — outbound checkpoint: a gateway with data leaving and a check.
  iag: svg('<rect x="3" y="4" width="8" height="16" rx="1"/><path d="M11 12h9M16 8l4 4-4 4"/>'),

  // XDR — command/correlation: a central hub linking nodes.
  xdr: svg('<circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/><path d="M6.3 6.3 10.3 10.3M17.7 6.3 13.7 10.3M6.3 17.7 10.3 13.7M17.7 17.7 13.7 13.7"/>'),

  // MDR — managed analysts: a person with a headset.
  mdr: svg('<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/><path d="M4 11a8 8 0 0 1 16 0"/><rect x="3" y="11" width="2.4" height="4" rx="1"/><rect x="18.6" y="11" width="2.4" height="4" rx="1"/>'),

  // aStor — resilient storage: stacked disks.
  astor: svg('<ellipse cx="12" cy="5.5" rx="7" ry="2.6"/><path d="M5 5.5v13c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-13"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>'),

  // Sophia — friendly AI guide.
  sophia: svg('<rect x="5" y="6" width="14" height="11" rx="3.5"/><circle cx="9.5" cy="11.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11.5" r="1.3" fill="currentColor" stroke="none"/><path d="M9.5 14.5c1.6 1.2 3.4 1.2 5 0"/><path d="M12 6V3M12 3h-1.6M12 3h1.6"/>'),

  // Attacker — masked intruder (shown only where visible / in replay).
  attacker: svg('<circle cx="12" cy="8" r="3.4"/><path d="M8.6 8h6.8"/><path d="M6 21c0-3.6 2.7-6 6-6s6 2.4 6 6"/>'),

  // Generic clue pip by evidence type.
  exploit: svg('<path d="M12 3v7M12 10l-3 4h6l-3 4v3"/>'),
  perimeter: svg('<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z"/><path d="M9 11.5 11 13.5 15 9"/>'),
  endpoint: svg('<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>'),
  network: svg('<circle cx="5" cy="12" r="1.8"/><circle cx="19" cy="6" r="1.8"/><circle cx="19" cy="18" r="1.8"/><path d="M6.6 11 17.4 6.6M6.6 13l10.8 4.4"/>'),
  exfil: svg('<path d="M4 12h12M12 8l4 4-4 4"/><path d="M19 4v16"/>'),

  // Help — circled question mark, for the beginner's guide button.
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.8-2.7 2.3-2.7 4"/><circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none"/>'),

  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: svg('<path d="M4 12.5 9 17.5 20 6.5"/>'),
};

export function icon(name) { return ICONS[name] || ''; }
