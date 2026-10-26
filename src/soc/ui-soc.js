// Incident Zero — live DOM reconcilers (alert queue + active incidents) and the Field
// Manual. Keyed node maps keep each timer bar animating smoothly via CSS instead of
// re-rendering the lists every frame. Text/lang is passed in from main-soc.js.

import { PRODUCTS } from '../data/products.js';

export const SENSOR_CLASS = { AF: 's-af', EDR: 's-edr', NDR: 's-ndr', IAG: 's-iag' };

function sevDots(n) { return '<span class="soc-sev">' + '●'.repeat(Math.max(1, n)) + '</span>'; }

function startDrain(bar, remaining, ttl) {
  if (!bar) return;
  const pct = Math.max(0, Math.min(100, (remaining / ttl) * 100));
  bar.style.transition = 'none';
  bar.style.width = pct + '%';
  requestAnimationFrame(() => {
    bar.style.transition = `width ${Math.max(60, remaining)}ms linear`;
    bar.style.width = '0%';
  });
}

// ---- alert queue ----
function alertNode(a, t) {
  const li = document.createElement('li');
  li.className = `soc-alert soc-${SENSOR_CLASS[a.sensor]}${a.noise ? ' noise' : ''}`;
  li.dataset.id = a.id;
  li.innerHTML =
    `<span class="soc-sensor">${a.sensor}</span>` +
    `<span class="soc-asset">${a.asset}</span>` +
    `<span class="soc-ioc">${a.ioc}</span>` +
    sevDots(a.sev) +
    `<i class="soc-life"></i>`;
  return li;
}

export function reconcileAlerts(listEl, alerts, selected, map) {
  const seen = new Set();
  for (const a of alerts) {
    seen.add(a.id);
    let node = map.get(a.id);
    if (!node) {
      node = alertNode(a);
      listEl.appendChild(node);
      map.set(a.id, node);
      startDrain(node.querySelector('.soc-life'), a.remaining, a.ttl);
    }
    node.classList.toggle('sel', selected.has(a.id));
  }
  for (const [id, node] of map) {
    if (!seen.has(id)) { map.delete(id); node.classList.add('gone'); setTimeout(() => node.remove(), 150); }
  }
}

// ---- active incidents ----
function incidentNode(a, t) {
  const li = document.createElement('li');
  li.dataset.id = a.id;
  li.innerHTML =
    `<div class="soc-inc-top"><span class="soc-stage"></span><span class="soc-actor">${a.actor}</span></div>` +
    `<div class="soc-inc-mid"><span class="soc-asset">${a.asset}</span><span class="soc-ioc">${a.ioc}</span></div>` +
    `<i class="soc-stagebar"></i>`;
  return li;
}

export function reconcileIncidents(listEl, incidents, focusedId, map, t) {
  const seen = new Set();
  // only CONFIRMED (active) incidents are visible; latent ones must be found via the queue
  const vis = incidents.filter(i => i.status === 'active' || (i.status === 'done' && i.leave));
  for (const a of vis) {
    seen.add(a.id);
    let node = map.get(a.id);
    if (!node) { node = incidentNode(a, t); listEl.appendChild(node); map.set(a.id, node); }
    const stageChanged = node.dataset.stage !== String(a.stage);
    node.dataset.stage = a.stage;
    node.className = `soc-inc soc-st-${a.stageId}${a.atRansom ? ' ransom' : ''}${a.id === focusedId ? ' foc' : ''}` +
      (a.status === 'done' ? ` done ${a.leave}` : '');
    node.querySelector('.soc-stage').textContent = t('stage.' + a.stageId);
    if (stageChanged && a.status === 'active') startDrain(node.querySelector('.soc-stagebar'), a.remaining, a.ttl);
  }
  for (const [id, node] of map) {
    if (!seen.has(id)) { map.delete(id); node.remove(); }
  }
  return vis.filter(v => v.status === 'active').length;
}

// ---- Field Manual ----
export function manualHTML(t, lang) {
  const loc = k => (typeof k === 'object' ? (k[lang] || k.en) : k);
  const row = (id, roleKey) => {
    const p = PRODUCTS[id] || PRODUCTS[id === 'ASTOR' ? 'ASTOR' : id];
    return `<div class="fm-prod">
      <div class="fm-prod-h"><span class="fm-tag soc-${SENSOR_CLASS[id] || 'tool'}">${id === 'ASTOR' ? 'aStor' : id}</span>
        <span class="fm-role">${t(roleKey)}</span></div>
      <p class="fm-cap">${loc(p.capability)}</p>
      <p class="fm-lim"><b>${t('fm.limit')}:</b> ${loc(p.limitation)}</p>
    </div>`;
  };
  return `<div class="fm-tabs">
      <button class="fm-tab on" data-tab="play">${t('fm.t1')}</button>
      <button class="fm-tab" data-tab="prod">${t('fm.t2')}</button>
      <button class="fm-tab" data-tab="score">${t('fm.t3')}</button>
    </div>
    <div class="fm-body" data-tab="play">
      <p class="fm-lead">${t('fm.lead')}</p>
      <ol class="ar-how">
        <li><span class="n">1</span><span>${t('fm.p1')}</span></li>
        <li><span class="n">2</span><span>${t('fm.p2')}</span></li>
        <li><span class="n">3</span><span>${t('fm.p3')}</span></li>
        <li><span class="n">4</span><span>${t('fm.p4')}</span></li>
      </ol>
      <p class="fm-note">${t('fm.note')}</p>
    </div>
    <div class="fm-body hide" data-tab="prod">
      <p class="fm-lead">${t('fm.prodlead')}</p>
      ${row('AF', 'role.AF')}${row('EDR', 'role.EDR')}${row('NDR', 'role.NDR')}
      ${row('IAG', 'role.IAG')}${row('ASTOR', 'role.ASTOR')}${row('MDR', 'role.MDR')}
    </div>
    <div class="fm-body hide" data-tab="score">
      <p class="fm-lead">${t('fm.scorelead')}</p>
      <ul class="fm-score">
        <li>${t('fm.s1')}</li><li>${t('fm.s2')}</li><li>${t('fm.s3')}</li><li>${t('fm.s4')}</li>
      </ul>
    </div>`;
}
