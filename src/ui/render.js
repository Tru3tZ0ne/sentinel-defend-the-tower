// Presentational builders — pure functions returning HTML strings. The controller
// (main.js) wires events via delegation on data-* attributes. Keeping rendering here
// and logic in the engine keeps both easy to change.

import { t, loc } from '../i18n.js';
import { PRODUCTS, PRODUCT_ORDER } from '../data/products.js';
import { icon } from './icons.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- deploy panel ----
export function deployPanel(game, placingId) {
  const cards = PRODUCT_ORDER.map(id => {
    const p = PRODUCTS[id];
    const placing = placingId === id;
    const afford = game.budget >= p.cost;
    const count = id === 'EDR' ? game.edrRooms.size : (id === 'ASTOR' ? game.astorRooms.size : (game.bySlot.get(game._slotFor(id)) === id ? 1 : 0));
    const single = p.slotType !== 'room' && p.slotType !== 'vault';
    const done = single && count > 0;
    return `
      <button class="pcard ${placing ? 'placing' : ''} ${(!afford || done) ? 'dim' : ''}" data-product="${id}" ${done ? 'disabled' : ''}>
        <span class="pcard-icon" data-prod="${id}">${icon(p.icon)}</span>
        <span class="pcard-main">
          <span class="pcard-name">${esc(p.name)}</span>
          <span class="pcard-athena">${esc(p.athena)}</span>
          <span class="pcard-tag">${esc(loc(p.tagline))}</span>
        </span>
        <span class="pcard-cost">${done ? '✓' : p.cost + ' ' + t('hud.credits')}</span>
      </button>`;
  }).join('');
  const help = placingId
    ? `<div class="panel-note placing-note">${t('panel.place')}: <b>${esc(PRODUCTS[placingId].name)}</b> — ${t('panel.clickSlot')} · <button class="linklike" data-cancel="1">${t('panel.cancel')}</button></div>`
    : `<div class="panel-note">${t('panel.deployHint')}</div>`;
  return `<h2 class="panel-title">${t('panel.deploy')}</h2>${help}<div class="pcards">${cards}</div>`;
}

// ---- building ----
function roomCell(game, view, r) {
  const rv = view.roomView[r.id];
  const eligible = game._placingEligible && game._placingEligible.has(r.id);
  const attackerHere = view.attackerVisible === r.id;
  const badges = [];
  if (rv.hasEdr) badges.push(`<span class="rbadge edr" title="EDR">${icon('edr')}</span>`);
  if (rv.hasAstor) badges.push(`<span class="rbadge astor" title="aStor">${icon('astor')}</span>`);
  let state = '';
  if (rv.locked) state = `<span class="rstate locked">${icon('lock')} ${t('room.locked')}</span>`;
  else if (rv.confirmedHere) state = `<span class="rstate confirmed">${t('clue.confirmed')}</span>`;
  else if (rv.suspected) state = `<span class="rstate suspected">? ${t('clue.weak')}</span>`;
  return `
    <div class="room ${r.type} ${eligible ? 'eligible' : ''} ${rv.locked ? 'is-locked' : ''} ${rv.suspected ? 'is-suspected' : ''} ${rv.confirmedHere ? 'is-confirmed' : ''}"
         data-room="${r.id}" data-col="${r.col}">
      <div class="room-head"><span class="room-name">${esc(loc(r.name))}${r.type === 'vault' ? ' 🔒' : ''}</span><span class="room-badges">${badges.join('')}</span></div>
      ${attackerHere ? `<div class="attacker-mark" title="attacker">${icon('attacker')}</div>` : ''}
      ${state}
    </div>`;
}

function slotBand(game, slotId, productId, label) {
  const deployed = game.bySlot.get(slotId) === productId;
  const eligible = game._placingEligible && game._placingEligible.has(slotId);
  const p = PRODUCTS[productId];
  return `
    <div class="band" data-slot="${slotId}">
      <div class="band-label">${esc(label)}</div>
      <div class="band-slot ${deployed ? 'filled' : 'empty'} ${eligible ? 'eligible' : ''}" data-slot-target="${slotId}">
        ${deployed
          ? `<span class="slot-icon">${icon(p.icon)}</span><span class="slot-name">${esc(p.name)}</span>`
          : `<span class="slot-placeholder">${t('panel.deploy')}: ${esc(p.name)}</span>`}
      </div>
    </div>`;
}

export function building(game) {
  const view = game.getView();
  const L = game.level;
  const floors = [1, 2, 3, 4].reverse().map(row => {
    const inRow = L.rooms.filter(r => r.row === row).sort((a, b) => a.col - b.col);
    return `<div class="floor" data-floor="${inRow[0]?.floor ?? row}">
      <div class="floor-tag">F${inRow[0]?.floor ?? ''}</div>
      ${inRow.map(r => roomCell(game, view, r)).join('')}
    </div>`;
  }).join('');

  const facilities = ['network', 'command', 'roster'].map(sid => {
    const pid = { network: 'NDR', command: 'XDR', roster: 'MDR' }[sid];
    const slot = L.slots.find(s => s.id === sid);
    const deployed = game.bySlot.get(sid) === pid;
    const eligible = game._placingEligible && game._placingEligible.has(sid);
    const p = PRODUCTS[pid];
    return `<div class="facility ${deployed ? 'filled' : ''} ${eligible ? 'eligible' : ''}" data-slot-target="${sid}">
      <span class="facility-icon">${icon(p.icon)}</span>
      <span class="facility-text"><b>${esc(slot ? loc(slot.name) : pid)}</b><span>${esc(p.name)}</span></span>
      ${deployed ? `<span class="facility-on">●</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="building">
      ${slotBand(game, 'perimeter', 'AF', loc(L.slots.find(s => s.id === 'perimeter').name))}
      <div class="floors"><div class="spine" aria-hidden="true"></div>${floors}</div>
      ${slotBand(game, 'gateway', 'IAG', loc(L.slots.find(s => s.id === 'gateway').name))}
    </div>
    <div class="facilities">${facilities}</div>`;
}

// ---- signal feed ----
export function clueFeed(game) {
  if (game.clues.length === 0) return `<div class="feed-empty">${t('clue.none')}</div>`;
  const rooms = new Map(game.level.rooms.map(r => [r.id, loc(r.name)]));
  const locName = node => rooms.get(node) || (node === 'perimeter' ? loc(game.level.slots[0].name) : node);
  return [...game.clues].slice(-8).reverse().map(c => {
    const tag = c.blocked ? `<span class="tag good">${t('end.blocked')}</span>`
      : c.prevented ? `<span class="tag good">${t('resp.contained')}</span>`
      : c.confidence === 'confirmed' ? `<span class="tag confirmed">${t('clue.confirmed')}</span>`
      : `<span class="tag weak">${t('clue.weak')}</span>`;
    return `<div class="clue ${c.confidence} ${c.resolved ? 'resolved' : ''}">
      <span class="clue-icon ev-${c.type}">${icon(c.type)}</span>
      <span class="clue-body"><b>${t('clue.' + c.type)}</b><span class="clue-loc">${t('clue.at')} ${esc(locName(c.node))}</span></span>
      ${tag}
    </div>`;
  }).join('');
}

// ---- response actions ----
export function responses(game) {
  const rooms = new Map(game.level.rooms.map(r => [r.id, loc(r.name)]));
  const items = [];
  for (const roomId of game.edrRooms) {
    items.push(`<button class="resp-btn isolate" data-isolate="${roomId}">${icon('edr')} ${t('resp.isolate')} · <b>${esc(rooms.get(roomId))}</b></button>`);
  }
  for (const r of game.rooms.values()) {
    if (r.locked) items.push(`<button class="resp-btn recover ${game.astorRooms.size ? '' : 'dim'}" data-recover="${r.id}">${icon('astor')} ${t('resp.recover')} · <b>${esc(loc(r.name))}</b></button>`);
  }
  if (!items.length) return `<div class="feed-empty">${t('panel.deployHint')}</div>`;
  return items.join('');
}
