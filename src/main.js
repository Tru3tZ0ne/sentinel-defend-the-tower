// Orchestrator: wires the 3D world, the engine, the DOM overlay, interaction, and the
// spatial replay. Runs one render loop; the engine only advances during the 'incident'
// phase, so the setup phase has no time pressure.
import * as THREE from 'three';
import { setLang, getLang, loc, t } from './i18n.js';
import { LAYOUT, EMPLOYEES, INCIDENT } from './data/scenario.js';
import { PRODUCTS } from './data/products.js';
import { createWorld } from './world/world.js';
import { buildBuilding } from './world/building.js';
import { createFx } from './world/fx.js';
import { createPeople } from './world/people.js';
import { Engine } from './game/engine.js';
import { getHint } from './game/sophia.js';
import { icon } from './ui/icons.js';
import { createOverlay } from './ui/overlay.js';

const canvas = document.getElementById('scene');
const overlayRoot = document.getElementById('overlay');
const world = createWorld(canvas);

let stage, building, fx, people, engine, overlay;
let placing = null, dirty = false, inspectTarget = null;
let sophiaState = { id: null, expanded: false };
const highlighted = [];
const labelEls = new Map();
let replay = null;
let lastEvent = '';
const publicNodes = LAYOUT.rooms.filter(r => !['server', 'vault'].includes(r.type)).map(r => 'room:' + r.id);

function setTicker(text, kind) { lastEvent = text; if (engine && engine.phase === 'incident') overlay.setEvent(text, false, kind); }

// ---------- world (re)build ----------
function initStage() {
  if (stage) world.scene.remove(stage);
  stage = new THREE.Group(); world.scene.add(stage);
  building = buildBuilding(THREE, LAYOUT); stage.add(building.group);
  fx = createFx(stage, building);
  people = createPeople(stage, building, publicNodes);
  // Visitor lanyards are worn by a couple of staff too, so the badge never gives the intruder away.
  const lanyard = new Set(['e1', 'e4']);
  for (const e of EMPLOYEES) people.add({ id: e.id, startNode: 'room:' + e.home, role: 'employee', home: e.home, visitor: lanyard.has(e.id) });
  const intr = people.add({ id: 'intruder', startNode: 'entrance', role: 'intruder', visitor: true });
  intr.group.visible = false; intr.wander = false;
  // Room identity now comes from in-world signage + furniture (no floating DOM labels).
  labelEls.clear(); if (overlay?.els?.labels) overlay.els.labels.innerHTML = '';
}

// ---------- helpers ----------
function personRoom(p) {
  const n = p.currentNode || '';
  if (n.startsWith('room:')) return n.slice(5);
  if (n.startsWith('desk:')) return n.slice(5).split('#')[0];
  return null;
}
function roomOccupants(roomId) { return people.list.filter(p => p.id !== 'intruder' && personRoom(p) === roomId); }

function clearHighlight() { for (const h of highlighted) { h.mesh.material.emissive.setHex(h.e); h.mesh.material.emissiveIntensity = h.i; } highlighted.length = 0; }
function hl(mesh, color = 0xE60027, inten = 0.5) {
  if (!mesh?.material?.emissive) return;
  highlighted.push({ mesh, e: mesh.material.emissive.getHex(), i: mesh.material.emissiveIntensity });
  mesh.material.emissive.setHex(color); mesh.material.emissiveIntensity = inten;
}
function highlightPlacement(prod) {
  clearHighlight();
  if (prod === 'EDR') {
    for (const d of building.desks.values()) { const m = d.deskMesh || d.coreMesh; if (m && !engine.edrDesks.has(d.id)) hl(m, 0x39e08a, 0.55); }
  } else {
    const elig = engine.eligible(prod);
    if (elig.room) { const r = building.rooms.get(elig.room); if (r) hl(r.pad, 0xE60027, 0.6); }
    else { for (const r of building.rooms.values()) hl(r.pad, 0x39c0ff, 0.28); } // network / offsite: anywhere
  }
}

// ---------- interaction ----------
function worldClick(ev) {
  const hit = world.pick(ev.clientX, ev.clientY, building.pickables);
  const entity = hit?.entity || null;
  if (placing) return tryDeploy(entity);
  inspectTarget = entity; renderInspect();
  const pt = entityFloorPoint(entity);
  if (pt) fx.setSelection(pt); else fx.clearSelection();
}

// Floor-level point for selection rings / camera focus, derived from an inspectable entity.
function entityFloorPoint(e) {
  if (!e) return null;
  if (e.kind === 'room') { const r = building.rooms.get(e.roomId); return r ? r.center.clone() : null; }
  if (e.kind === 'desk') { const d = building.desks.get(e.deskId); const r = building.rooms.get(e.roomId); if (!d) return null; const p = d.pos.clone(); if (r) p.y = r.center.y; return p; }
  if (e.kind === 'person') { const p = people.get(e.personId); return p ? p.group.position.clone() : null; }
  if (e.kind === 'clue') { const c = engine.clues.find(x => x.id == e.clueId); if (!c) return null; const r = building.rooms.get(c.room); const d = c.desk && building.desks.get(c.desk); const p = (d ? d.pos.clone() : r?.center.clone()) || null; if (p && r) p.y = r.center.y; return p; }
  return null;
}

function focusClue(clueId) {
  const c = engine.clues.find(x => x.id == clueId); if (!c) return;
  inspectTarget = { kind: 'clue', clueId: c.id };
  renderInspect();
  const pt = entityFloorPoint(inspectTarget);
  if (pt) { world.focusOn(pt.clone().setY(pt.y + 1), 14); fx.setSelection(pt); }
}
function tryDeploy(entity) {
  const prod = placing; const elig = engine.eligible(prod);
  let ok = false, target = null;
  if (prod === 'EDR') { if (entity?.kind === 'desk') { target = entity.deskId; ok = true; } }
  else if (elig.room) { if (entity && (entity.roomId === elig.room || (entity.kind === 'room' && entity.roomId === elig.room))) ok = true; }
  else { if (entity) ok = true; }  // network / offsite — any click inside the building confirms
  if (!ok) { overlay.toast({ kind: 'warn', key: 'tray.clickWorld' }); return; }
  const res = engine.deploy(prod, target);
  if (res.ok) { placing = null; clearHighlight(); overlay.renderTray(engine, placing); }
}

function onPointerMove(ev) {
  const hit = world.pick(ev.clientX, ev.clientY, building.pickables);
  canvas.style.cursor = hit ? 'pointer' : (placing ? 'crosshair' : 'grab');
  if (fx) {
    const pt = hit ? entityFloorPoint(hit.entity) : null;
    fx.setHover(pt && !placing ? pt : null);
  }
}

// ---------- inspect card ----------
function renderInspect() {
  if (!inspectTarget) return overlay.clearInspect();
  const e = inspectTarget;
  let html = '';
  if (e.kind === 'room') html = inspectRoom(e.roomId);
  else if (e.kind === 'desk') html = inspectDesk(e.deskId, e.roomId);
  else if (e.kind === 'person') html = inspectPerson(e.personId);
  else if (e.kind === 'clue') html = inspectClue(e.clueId);
  overlay.showInspect({ html });
}
function roomName(id) { const r = LAYOUT.rooms.find(x => x.id === id); return r ? loc(r.name) : id; }

// Which deployed sensors give visibility into this room (fog-of-war made legible).
function roomCoverage(roomId) {
  const r = LAYOUT.rooms.find(x => x.id === roomId); if (!r) return [];
  const out = [];
  if (engine.hasAF && r.type === 'lobby') out.push('af');
  if (engine.hasNDR) out.push('ndr');
  if ([...engine.edrDesks].some(d => d.split('#')[0] === roomId)) out.push('edr');
  if (engine.hasIAG && r.type === 'egress') out.push('iag');
  if (engine.hasXDR && r.type === 'command') out.push('xdr');
  if (engine.astorReady && r.type === 'server') out.push('astor');
  return out;
}
function coverageHtml(cover) {
  if (!cover.length) return `<div class="cover none">${icon('attacker')} ${t('inspect.noCoverage')}</div>`;
  return `<div class="cover-list">${cover.map(c => `<span class="cover-pill ${c}">${icon(c === 'af' ? 'af' : c === 'ndr' ? 'ndr' : c === 'edr' ? 'edr' : c === 'iag' ? 'iag' : c === 'xdr' ? 'xdr' : 'astor')} ${t('cover.' + c)}</span>`).join('')}</div>`;
}
function inspectRoom(roomId) {
  const r = LAYOUT.rooms.find(x => x.id === roomId); if (!r) return '';
  const occ = roomOccupants(roomId).length;
  const locked = engine.lockedRooms.has(roomId);
  const inc = engine.phase === 'incident';
  const deskCount = [...building.desks.values()].filter(d => d.roomId === roomId && d.deskMesh).length;
  const actions = [];
  if (inc && locked) actions.push(`<button class="actbtn good" data-act="recover" data-room="${roomId}">${icon('astor')}<span>${t('act.restore')}</span></button>`);
  if (inc && !locked) actions.push(`<button class="actbtn" data-act="lockdown" data-room="${roomId}">${icon('lock')}<span>${t('act.restrict')}</span></button>`);
  return `
    <div class="ins-head"><h3>${icon(roomIcon(r.type))} ${loc(r.name)}</h3><span class="ins-sub">${t('inspect.level')}</span></div>
    <div class="ins-purpose">${t('room.' + r.type) || ''}</div>
    ${locked ? `<div class="locked-row">${icon('lock')} ${t('inspect.locked')}</div>` : ''}
    <div class="ins-rows">
      <div><span>${t('inspect.occupants')}</span><b>${occ}</b></div>
      ${deskCount ? `<div><span>${t('inspect.deskCount')}</span><b>${deskCount}</b></div>` : ''}
    </div>
    <div class="ins-cover"><div class="ins-cover-h">${t('inspect.coverage')}</div>${coverageHtml(roomCoverage(roomId))}</div>
    ${actions.length ? `<div class="ins-actions">${actions.join('')}</div>` : ''}`;
}
function roomIcon(type) { return { lobby: 'af', command: 'xdr', egress: 'iag', server: 'astor', vault: 'check', office: 'edr', meeting: 'mdr' }[type] || 'edr'; }
function statusRow(label, ok, okText, noText) {
  return `<div class="st-row"><span class="st-k">${label}</span><span class="st-v ${ok ? 'ok' : 'no'}">${ok ? '●' : '○'} ${ok ? okText : noText}</span></div>`;
}
function inspectDesk(deskId, roomId) {
  const edr = engine.edrDesks.has(deskId);
  const observed = engine.hasNDR;
  const inc = engine.phase === 'incident';
  const acts = [];
  if (inc && edr) acts.push(`<button class="actbtn danger" data-act="isolate" data-desk="${deskId}">${icon('edr')}<span>${t('act.isolate')}</span></button>`);
  if (inc) acts.push(`<button class="actbtn" data-act="lockdown" data-room="${roomId}">${icon('lock')}<span>${t('act.restrict')}</span></button>`);
  return `
    <div class="ins-head"><h3>${icon('endpoint')} ${t('inspect.workstation')}</h3><span class="ins-sub">${roomName(roomId)}</span></div>
    <div class="st-rows">
      ${statusRow(t('st.endpoint'), edr, t('st.protected'), t('st.unprotected'))}
      ${statusRow(t('st.network'), observed, t('st.observed'), t('st.unobserved'))}
    </div>
    ${acts.length ? `<div class="ins-actions">${acts.join('')}</div>` : ''}`;
}
function _unusedDesk(deskId, roomId) {
  const edr = engine.edrDesks.has(deskId);
  const inc = engine.phase === 'incident';
  const action = '';
  return `
    <div class="ins-head"><h3>${icon('edr')} ${t('inspect.workstation')}</h3><span class="ins-sub">${roomName(roomId)}</span></div>
    <div class="ins-cover"><div class="cover-list"><span class="cover-pill ${edr ? 'edr' : 'none'}">${icon(edr ? 'edr' : 'attacker')} ${edr ? t('inspect.protected') : t('inspect.unprotected')}</span></div></div>
    ${action}`;
}
function inspectPerson(id) {
  const emp = EMPLOYEES.find(e => e.id === id);
  const name = id === 'intruder' ? loc(INCIDENT.intruder.name) : (emp ? loc(emp.name) : t('inspect.person'));
  return `<div class="ins-head"><h3>${icon('mdr')} ${esc(name)}</h3><span class="ins-sub">${t('inspect.person')}</span></div>
    <div class="ins-note">${t('inspect.personNote')}</div>`;
}
function inspectClue(id) {
  const c = engine.clues.find(x => x.id === id); if (!c) return '';
  return `<div class="ins-head"><h3 class="ev-${c.type}">${icon(c.type)} ${t('clue.' + c.type)}</h3><span class="ins-sub">${roomName(c.room)}</span></div>
    <div class="ins-note">${c.confidence === 'confirmed' ? t('clue.confirmed') : t('clue.weak')}</div>
    ${c.confidence !== 'confirmed' && !engine.hasXDR ? `<div class="ins-hint">${icon('xdr')} ${t('cover.xdr')}</div>` : ''}`;
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ---------- Sophia ----------
function showSophia(id) {
  const hint = getHint(id); if (!hint) return;
  sophiaState = { id, expanded: false };
  overlay.renderSophia(hint, false, null); overlay.pulseSophia();
  // guidance connects to the scene: gently focus the camera on what Sophia is pointing at
  const focus = sophiaFocusPoint(id);
  if (focus) { world.focusOn(focus.clone().setY(focus.y + 1), 15); fx.setSelection(focus); }
}
function sophiaFocusPoint(id) {
  if (!engine) return null;
  if (id === 'firstClue' && engine.clues[0]) return entityFloorPoint({ kind: 'clue', clueId: engine.clues[0].id });
  if (id === 'ransomLock') { const rm = [...engine.lockedRooms][0]; return rm ? building.rooms.get(rm)?.center.clone() : null; }
  return null;
}
function reflowSophia() {
  const hint = sophiaState.id ? getHint(sophiaState.id) : null;
  overlay.renderSophia(hint, sophiaState.expanded, sophiaState.id ? null : t('sophia.greet'));
}

// ---------- labels ----------
const _v = new THREE.Vector3();
function updateLabels() {
  for (const [id, el] of labelEls) {
    const r = building.rooms.get(id); if (!r) continue;
    _v.copy(r.center); _v.y += 1.7; _v.project(world.camera);
    const vis = _v.z < 1 && _v.x > -1 && _v.x < 1 && _v.y > -1 && _v.y < 1;
    if (!vis) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    el.style.left = ((_v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
    el.style.top = ((-_v.y * 0.5 + 0.5) * canvas.clientHeight) + 'px';
    const locked = engine && engine.lockedRooms.has(id);
    el.classList.toggle('locked', !!locked);
  }
}

// ---------- game flow ----------
function newGame() {
  initStage();
  engine = new Engine({ LAYOUT, EMPLOYEES, INCIDENT });
  engine.speed = 1; engine._paused = false;
  placing = null; inspectTarget = null; replay = null;
  engine
    .on('change', () => { dirty = true; })
    .on('deploy', ({ product, target }) => { fx.addProp(product, target); dirty = true; firstDeploy(); })
    .on('clue', c => { if (c.type === 'network') fx.addTrail(c.fromRoom, c.room); else fx.addClue(c); setTicker(`${t('clue.' + c.type)} · ${roomName(c.room)}`); dirty = true; })
    .on('confirm', () => {
      engine.clues.forEach(c => fx.setClueConfirmed(c.id));
      const it = people.get('intruder'); if (it) fx.setReveal(it.group);
      // visualise correlation: lines from the XDR console to each active clue
      const console3 = building.anchors.XDR.clone(); console3.y += 1.2;
      const pts = engine.clues.filter(c => !c.resolved).map(c => {
        const d = c.desk && building.desks.get(c.desk); const r = building.rooms.get(c.room);
        const p = (d ? d.pos.clone() : r?.center.clone()); if (p) p.y += 1.2; return p;
      }).filter(Boolean);
      if (pts.length) fx.drawCorrelation(console3, pts);
      setTicker(t('toast.confirmed'), 'warn');
    })
    .on('intruder-goto', ({ room, desk }) => { const it = people.get('intruder'); if (it) { it.group.visible = true; people.setRoute(it, desk ? 'desk:' + desk : 'room:' + room); } })
    .on('lock', ({ room, locked }) => { fx.lockRoom(room, locked); if (locked) setTicker(t('ticker.ransom'), 'bad'); })
    .on('cage-room', ({ room }) => fx.restrictRoom(room))
    .on('contained', ({ desk }) => { const it = people.get('intruder'); if (it) it.halted = true; if (desk) fx.cageDesk(desk); fx.resolveAllClues(); fx.clearCorrelation(); setTicker(t('resp.contained'), 'good'); dirty = true; })
    .on('sophia', ({ id }) => showSophia(id))
    .on('toast', p => overlay.toast(p))
    .on('phase', ({ phase }) => { overlay.setPhase(phase); if (phase === 'incident') overlay.setEvent(lastEvent, false); dirty = true; })
    .on('end', () => endGame());

  lastEvent = '';
  overlay.hideStart(); overlay.hideEnd();
  overlay.setPhase('prep');
  overlay.renderHud(engine); overlay.renderTray(engine, placing); overlay.renderFeed(engine);
  overlay.setEvent(null, true);
  showSophia('welcome');
  clearInterval(prepTimer);
  prepTimer = setTimeout(() => { if (engine && engine.phase === 'prep' && engine.deployed.length === 0) showSophia('deployFirst'); }, 5000);
}
let prepTimer = null, _firstDeployed = false;
function firstDeploy() { if (!_firstDeployed) { _firstDeployed = true; setTimeout(() => { if (engine.phase === 'prep') showSophia('readyToBegin'); }, 800); } }

function beginDay() { if (engine) engine.beginDay(); }
function endGame() { clearHighlight(); placing = null; overlay.clearInspect(); overlay.setPhase('review'); overlay.showEnd(engine); }

// ---------- spatial replay ----------
function startReplay() {
  overlay.els.end.classList.add('replaying');
  const it = people.get('intruder');
  if (it) { it.halted = false; it.group.visible = true; const start = building.nav.nodes.get('entrance'); it.group.position.copy(start.pos); it.currentNode = 'entrance'; it.path = null; fx.setReveal(it.group); }
  replay = { index: 0, timer: 0, beats: engine.inc.beats };
  overlay.highlightStep(0);
}
function stepReplay(dt) {
  if (!replay) return;
  const it = people.get('intruder'); if (!it) return;
  people.update(dt * 1.2);
  replay.timer += dt;
  if (replay.timer >= 1.8) {
    replay.timer = 0; replay.index++;
    if (replay.index >= replay.beats.length) { replay = null; return; }
    const b = replay.beats[replay.index];
    people.setRoute(it, b.desk ? 'desk:' + b.desk : 'room:' + b.room);
    overlay.highlightStep(replay.index);
  }
}

// ---------- overlay handlers ----------
overlay = createOverlay(overlayRoot, {
  onStart: newGame,
  onBeginDay: beginDay,
  onPickProduct: id => { placing = (placing === id) ? null : id; if (placing) highlightPlacement(id); else clearHighlight(); overlay.renderTray(engine, placing); },
  onCancelPlacing: () => { placing = null; clearHighlight(); overlay.renderTray(engine, placing); },
  onPauseToggle: () => { engine._paused = !engine._paused; overlay.renderHud(engine); },
  onSpeed: s => { engine.speed = s; overlay.renderHud(engine); },
  onLang: () => { setLang(getLang() === 'en' ? 'zh' : 'en'); refreshAll(); },
  onIsolate: desk => { engine.isolateDevice(desk); renderInspect(); },
  onLockdown: room => { engine.lockdownRoom(room); renderInspect(); },
  onRecover: room => { engine.recover(room); renderInspect(); },
  onSophiaMore: () => { sophiaState.expanded = true; reflowSophia(); },
  onSophiaShow: () => { const f = sophiaFocusPoint(sophiaState.id); if (f) { world.focusOn(f.clone().setY(f.y + 1), 14); fx.setSelection(f); } sophiaState.expanded = true; reflowSophia(); },
  onFocusClue: id => focusClue(id),
  onInvestigate: () => { const c = engine.clues[engine.clues.length - 1]; if (c) focusClue(c.id); },
  onTab: () => { overlay.renderTray(engine, placing); },
  onCloseInspect: () => { inspectTarget = null; overlay.clearInspect(); if (fx) fx.clearSelection(); },
  onAgain: () => newGame(),
  onReplayPlay: () => startReplay(),
  onBackToGame: () => { overlay.els.end.classList.remove('replaying'); replay = null; overlay.showEnd(engine); },
});

function refreshAll() {
  if (building?.refreshSigns) building.refreshSigns();   // re-draw in-world signage in the new language
  if (!engine) { overlay.showStart(); return; }
  if (engine.phase === 'review') { overlay.showEnd(engine); return; }
  overlay.renderHud(engine); overlay.renderTray(engine, placing); overlay.renderFeed(engine); reflowSophia(); renderInspect();
  if (engine.phase === 'prep') overlay.setEvent(null, true); else overlay.setEvent(lastEvent, false);
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const incidentRunning = engine && engine.phase === 'incident' && !engine._paused;
  const simDt = incidentRunning ? dt * engine.speed : dt;
  if (people) people.update(incidentRunning ? dt * engine.speed : dt);
  if (incidentRunning) engine.tick(dt * engine.speed);
  if (replay) stepReplay(dt);
  if (fx) fx.update(dt);
  if (engine) updateLabels();
  world.render();
  requestAnimationFrame(frame);
}

// UI flush (throttled) so per-tick state changes don't thrash the DOM.
setInterval(() => {
  if (!dirty || !engine) return; dirty = false;
  if (engine.phase === 'review') return;
  overlay.renderHud(engine); overlay.renderTray(engine, placing); overlay.renderFeed(engine);
  if (inspectTarget) renderInspect();
}, 140);

canvas.addEventListener('click', worldClick);
canvas.addEventListener('pointermove', onPointerMove);

// boot
initStage();
overlay.showStart();
overlay.setPhase('start');
requestAnimationFrame(frame);

// expose for headless testing
window.__sentinel = { get engine() { return engine; }, newGame, beginDay, world,
  inspect(e) { inspectTarget = e; renderInspect(); const p = entityFloorPoint(e); if (p) fx.setSelection(p); },
  focusClue };
