// Shared DOM/render helpers for the Sentinel quick-play arcade games. Pure string
// builders + tiny utilities; each game assembles its own screens from these so the
// whole suite looks and behaves consistently (brand lockup, leaderboard, footer).

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmt = n => Math.round(n).toLocaleString('en-US');

// Official Sangfor logo + the "Sentinel" game lockup, matching the rest of the suite.
export function brandHTML(sub) {
  return `<span class="brand">
    <img class="brand-logo" src="assets/brand/sangfor-logo-white.png" alt="Sangfor" />
    <span class="brand-divider"></span>
    <span class="brand-stack"><span class="brand-word">SENTINEL</span>
    <span class="brand-sub">${esc(sub)}</span></span></span>`;
}

// Inline speaker icons (emoji render as tofu next to the CJK stack — learned the hard way).
const SND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
export const soundIco = muted => (muted ? SND_OFF : SND_ON);

// Leaderboard rows. `meId` highlights the player's own freshly-submitted row.
export function boardListHTML(rows, { empty, meId } = {}) {
  if (!rows || !rows.length) return `<li class="lb-empty">${esc(empty || 'No scores yet.')}</li>`;
  return rows.slice(0, 8).map((r, i) => {
    const me = r.id && meId && r.id === meId ? ' me' : '';
    return `<li class="lb-row${me}"><span class="lb-rank">${i + 1}</span>` +
      `<span class="lb-name">${esc(r.name)}</span>` +
      `<span class="lb-score">${fmt(r.score)}</span></li>`;
  }).join('');
}

// Footer: language toggle, mute, and cross-links to the other arcade modes.
export function footerHTML(t, { muted, links } = {}) {
  const more = (links || []).map(l => `<a class="linklike" href="${l.href}">${esc(l.label)}</a>`).join('');
  return `<div class="ar-footer">
    <div class="ar-foot-left">${esc(t('ui.sangfor'))}</div>
    <div class="ar-foot-right">
      ${more ? `<span class="ar-more">${esc(t('ui.more'))}: ${more}</span>` : ''}
      <button class="iconbtn" data-act="mute" title="${esc(t('ui.mute'))}">${soundIco(muted)}</button>
      <button class="chip" data-act="lang">${esc(t('ui.lang'))}</button>
    </div>
  </div>`;
}

// Debounced paint cache: skip DOM writes when the HTML is unchanged (keeps 60fps HUDs cheap).
export function painter() {
  const last = new WeakMap();
  return (el, html) => { if (el && last.get(el) !== html) { last.set(el, html); el.innerHTML = html; } };
}
