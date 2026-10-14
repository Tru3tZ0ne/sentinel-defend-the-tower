// Orchestrator: wires the 3D world, the engine, the DOM overlay, interaction, and the
// spatial replay. Runs one render loop; the engine only advances during the 'incident'
// phase, so the setup phase has no time pressure.
import * as THREE from 'three';
import { setLang, getLang, loc, t } from './i18n.js';
import { LAYOUT, EMPLOYEES } from './data/scenario.js';
import { PRODUCTS } from './data/products.js';
import { productMark } from './ui/product-marks.js';
import { missionFor } from './data/missions.js';
import { createWorld } from './world/world.js';
import { createAmbience } from './world/audio.js';
import { buildBuilding } from './world/building.js';
import { createFx } from './world/fx.js';
import { createPeople } from './world/people.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

// Procedural characters remain a temporary fallback until realistic office assets pass QA.
// Keep the GLB pipeline available for reviewed, licensed and animated characters.
const USE_GLB_CHARACTERS = false;
const CHAR_MODEL = 'assets/models/CesiumMan.glb';
let charGltf = null;
if (USE_GLB_CHARACTERS) new GLTFLoader().load(CHAR_MODEL, g => { charGltf = g; }, undefined, () => { charGltf = null; });
import { Engine } from './game/engine.js';
import { getHint } from './game/sophia.js';
import { icon } from './ui/icons.js';
import { createOverlay } from './ui/overlay.js';

const canvas = document.getElementById('scene');
const overlayRoot = document.getElementById('overlay');
const world = createWorld(canvas);
const ambience = createAmbience();

let stage, building, fx, people, engine, overlay;
let placing = null, dirty = false, inspectTarget = null;
let sophiaState = { id: null, expanded: false };
const highlighted = [];
const labelEls = new Map();
let replay = null;
let lastEvent = '';
let activeLevel = LAYOUT.defaultLevel;
let selectedMission = 'quiet', selectedDifficulty = 'standard';
const roomLevel = new Map(LAYOUT.rooms.map(r => [r.id, r.level]));
const publicByLevel = {};
for (const lv of LAYOUT.levels) publicByLevel[lv.id] = LAYOUT.rooms.filter(r => r.level === lv.id && !['server', 'vault'].includes(r.type)).map(r => 'room:' + r.id);

function setTicker(text, kind) { lastEvent = text; if (engine && engine.phase === 'incident') overlay.setEvent(text, false, kind); }

// ---------- floor selector ----------
function personLevel(p) {
  return LAYOUT.levels.reduce((a, b) => Math.abs(a.y - p.pos.y) < Math.abs(b.y - p.pos.y) ? a : b).id;
}
// All floors render at once, so clicks/hover are scoped to the focused floor by world height
// (prevents a ray to a lower-floor room from catching an upper floor's pickable).
const _wp = new THREE.Vector3();
function levelOfY(y) { return LAYOUT.levels.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b).id; }
function activePickables() {
  if (!building) return [];
  return building.pickables.filter(m => { m.getWorldPosition(_wp); return levelOfY(_wp.y) === activeLevel; });
}
// The whole tower is always visible (a cutaway dollhouse). The "active" level is just which
// floor the camera is focused on and which floor keyboard room-cycling / the floor buttons target.
function setActiveLevel(id, moveCamera = true) {
  if (!building || !building.floors.some(f => f.id === id)) return;
  activeLevel = id;
  for (const f of building.floors) f.group.visible = true;   // keep every floor on screen
  const lvl = LAYOUT.levels.find(l => l.id === id);
  if (moveCamera && world.focusOn) world.focusOn(new THREE.Vector3(-0.5, (lvl?.y || 0) + 0.7, -2.2), 26);
  if (overlay) overlay.renderFloors(building.floors, activeLevel);
}
// Frame the entire stacked tower at once (default view) from a front-3/4 angle.
function overviewAll() {
  if (!building) return;
  for (const f of building.floors) f.group.visible = true;
  const ys = LAYOUT.levels.map(l => l.y);
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2 + 0.2;
  world.camera.position.set(2, 5.5, 40);   // low, front-on angle so both floors' open fronts are seen
  world.controls.target.set(-0.5, midY, -2.2);
  world.controls.update();
  if (overlay) overlay.renderFloors(building.floors, activeLevel);
}
function updatePeopleFloorVis() {
  if (!people) return;
  for (const p of people.list) {
    if (p.role === 'intruder') p.group.visible = !!p._entered && !replayHidden();
    else p.group.visible = true;   // staff on every floor stay visible
  }
}
function replayHidden() { return false; }

// ---------- world (re)build ----------
function initStage() {
  if (stage) {
    clearHighlight();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    stage.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
        materials.add(m);
        for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      }
      o.shadow?.map?.dispose();
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    world.scene.remove(stage);
  }
  stage = new THREE.Group(); world.scene.add(stage);
  building = buildBuilding(THREE, LAYOUT); stage.add(building.group);
  for (const floor of building.floors) floor.group.visible = true;   // whole-tower cutaway: all floors on screen
  fx = createFx(stage, building);
  people = createPeople(stage, building, publicByLevel[LAYOUT.defaultLevel], charGltf);
  // Visitor lanyards are worn by a couple of staff too, so the badge never gives the intruder away.
  const lanyard = new Set(['e1', 'e4']);
  for (const e of EMPLOYEES) people.add({ id: e.id, startNode: 'room:' + e.home, role: 'employee', home: e.home, visitor: lanyard.has(e.id), allowed: publicByLevel[roomLevel.get(e.home)] });
  const intr = people.add({ id: 'intruder', startNode: 'entrance', role: 'intruder', visitor: true });
  intr.group.visible = false; intr.wander = false; intr._entered = false;
  // Screen-facing architectural placards stay readable at the command-view distance.
  labelEls.clear(); if (overlay?.els?.labels) overlay.els.labels.innerHTML = '';
  for (const r of LAYOUT.rooms) {
    const el = document.createElement('div'); el.className = 'room-placard';
    el.innerHTML = `${icon(roomIcon(r.type))}<span><b>${esc(loc(r.name))}</b><small>${t('placard.' + r.type)}</small></span>`;
    overlay.els.labels.appendChild(el); labelEls.set(r.id, el);
  }
}

// ---------- helpers ----------
function personRoom(p) {
  const n = p.currentNode || '';
  if (n.startsWith('room:')) return n.slice(5);
  if (n.startsWith('desk:')) return n.slice(5).split('#')[0];
  return null;
}
function roomOccupants(roomId) { return people.list.filter(p => p.id !== 'intruder' && personRoom(p) === roomId); }

function clearHighlight() { for (const h of highlighted) { h.mesh.material.emissive.setHex(h.e); h.mesh.material.emissiveIntensity = h.i; h.mesh.material.opacity = h.opacity; } highlighted.length = 0; }
function hl(mesh, color = 0x39e08a, inten = 0.5) {
  if (!mesh?.material?.emissive) return;
  highlighted.push({ mesh, e: mesh.material.emissive.getHex(), i: mesh.material.emissiveIntensity, opacity: mesh.material.opacity, setInten: inten });
  if (mesh.material.opacity === 0) mesh.material.opacity = .4;
  mesh.material.emissive.setHex(color); mesh.material.emissiveIntensity = inten;
}
function highlightPlacement(prod) {
  clearHighlight();
  if (prod === 'EDR') {
    for (const d of building.desks.values()) { if (roomLevel.get(d.roomId) !== activeLevel) continue; const m = d.deskMesh || d.coreMesh; if (m && !engine.edrDesks.has(d.id)) hl(m, 0x39e08a, 1.0); }
  } else {
    const elig = engine.eligible(prod);
    // Valid deploy targets glow brand-green ("place here") — red is reserved for threats.
    if (elig.room) { const r = building.rooms.get(elig.room); if (r) hl(r.pad, 0x39e08a, 1.1); }
    else { for (const r of building.rooms.values()) { if (roomLevel.get(r.id) !== activeLevel) continue; hl(r.pad, 0x39c0ff, 0.55); } } // network / offsite: any room on this floor
  }
}

// ---------- interaction ----------
function worldClick(ev) {
  const hit = world.pick(ev.clientX, ev.clientY, activePickables());
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

function ensureLevelFor(roomId) { const lv = roomLevel.get(roomId); if (lv && lv !== activeLevel) setActiveLevel(lv, false); }
function focusClue(clueId) {
  const c = engine.clues.find(x => x.id == clueId); if (!c) return;
  inspectTarget = { kind: 'clue', clueId: c.id };
  renderInspect();
  ensureLevelFor(c.room);
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
  const hit = world.pick(ev.clientX, ev.clientY, activePickables());
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
  if (engine.hasAF && roomId === 'reception') out.push('af');
  if (engine.hasNDR) out.push('ndr');
  if ([...engine.edrDesks].some(d => d.split('#')[0] === roomId)) out.push('edr');
  if (engine.hasIAG && roomId === 'egress') out.push('iag');
  if (engine.hasXDR && roomId === 'soc') out.push('xdr');
  if (engine.astorReady && roomId === 'server') out.push('astor');
  return out;
}
// ---- literal fog-of-war: which rooms your deployed sensors can actually see ----
function roomObserved(roomId) {
  if (engine.hasNDR) return true;                                        // building-wide movement visibility
  if ([...engine.edrDesks].some(d => d.split('#')[0] === roomId)) return true;
  if (engine.hasAF && roomId === 'reception') return true;
  if (engine.hasIAG && roomId === 'egress') return true;
  if (engine.hasXDR && roomId === 'soc') return true;
  return false;
}
function coveredRooms(product, target) {
  if (product === 'NDR') return LAYOUT.rooms.map(r => r.id);
  if (product === 'EDR' && target) return [target.split('#')[0]];
  if (product === 'AF') return ['reception'];
  if (product === 'IAG') return ['egress'];
  if (product === 'XDR') return ['soc'];
  return [];
}
function applyCoverage(sweep) {
  if (!engine || !building || !fx) return;
  const incident = engine.phase === 'incident';
  for (const r of LAYOUT.rooms) {
    const room = building.rooms.get(r.id); if (!room || !room.light) continue;
    const obs = roomObserved(r.id);
    fx.setScan(r.id, obs);
    fx.setBlind(r.id, incident && !obs);
    room.light.userData.target = (!incident || obs) ? room.light.userData.base : room.light.userData.base * 0.3;
  }
  if (sweep) for (const id of sweep) fx.scanWave(id);
}

function coverageHtml(cover) {
  if (!cover.length) return `<div class="cover none">${icon('attacker')} ${t('inspect.noCoverage')}</div>`;
  return `<div class="cover-list">${cover.map(c => `<span class="cover-pill ${c}">${productMark(c.toUpperCase())} ${t('cover.' + c)}</span>`).join('')}</div>`;
}
function inspectRoom(roomId) {
  const r = LAYOUT.rooms.find(x => x.id === roomId); if (!r) return '';
  const level = LAYOUT.levels.find(l => l.id === r.level);
  const occ = roomOccupants(roomId).length;
  const locked = engine.lockedRooms.has(roomId);
  const restricted = engine.restrictedRooms && engine.restrictedRooms.has(roomId);
  const inc = engine.phase === 'incident';
  const deskCount = [...building.desks.values()].filter(d => d.roomId === roomId && d.deskMesh).length;
  const actions = [];
  const recovery = engine.recoveryJobs.get(roomId);
  if (inc && locked && !recovery) actions.push(`<button class="actbtn good" data-act="recover" data-room="${roomId}" ${!engine.astorReady || engine.budget < 2 || engine.recoveryJobs.size ? 'disabled' : ''}>${icon('astor')}<span>${t('recovery.offer', { seconds: engine.operations.has('HCI') ? 4 : 6 })}</span></button>`);
  if (recovery) actions.push(`<div class="recovery-status"><span>${t('recovery.progress', { seconds: Math.ceil(recovery.duration - recovery.elapsed) })}</span><progress max="${recovery.duration}" value="${recovery.elapsed}"></progress><button class="linklike" data-act="cancelRecovery" data-room="${roomId}">${t('recovery.cancel')}</button></div>`);
  if (inc && !locked && !restricted) actions.push(`<button class="actbtn" data-act="lockdown" data-room="${roomId}">${icon('lock')}<span>${t('act.restrict')}</span></button>`);
  return `
    <div class="ins-head"><h3>${icon(roomIcon(r.type))} ${loc(r.name)}</h3><span class="ins-sub">${loc(level?.name)}</span></div>
    <div class="ins-purpose">${t('room.' + r.type) || ''}</div>
    ${locked ? `<div class="locked-row">${icon('lock')} ${t('inspect.locked')}</div>` : ''}
    ${restricted ? `<div class="locked-row restricted">${icon('lock')} ${t('inspect.restricted')}</div>` : ''}
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
    <div class="ins-head"><h3>${icon('endpoint')} ${t('inspect.workstation')}</h3><span class="ins-sub">${roomName(roomId)} · ${esc(deskId)}</span></div>
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
  const name = id === 'intruder' ? loc(engine.inc.intruder.name) : (emp ? loc(emp.name) : t('inspect.person'));
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
  if (id === 'firstClue' && engine.clues[0]) { ensureLevelFor(engine.clues[0].room); return entityFloorPoint({ kind: 'clue', clueId: engine.clues[0].id }); }
  if (id === 'ransomLock') { const rm = [...engine.lockedRooms][0]; if (rm) ensureLevelFor(rm); return rm ? building.rooms.get(rm)?.center.clone() : null; }
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
    const vis = r.level === activeLevel && engine && !engine.ended && _v.z < 1 && _v.x > -1 && _v.x < 1 && _v.y > -1 && _v.y < 1 && world.camera.position.distanceTo(world.controls.target) > 20;
    if (!vis) { el.style.display = 'none'; continue; }
    el.style.display = 'flex';
    el.style.left = ((_v.x * 0.5 + 0.5) * canvas.clientWidth) + 'px';
    el.style.top = ((-_v.y * 0.5 + 0.5) * canvas.clientHeight) + 'px';
    const locked = engine && engine.lockedRooms.has(id);
    el.classList.toggle('locked', !!locked);
  }
}

// ---------- game flow ----------
function newGame(missionId = selectedMission, difficulty = selectedDifficulty) {
  const incident = missionFor(missionId, difficulty);
  selectedMission = missionId; selectedDifficulty = difficulty;
  initStage();
  engine = new Engine({ LAYOUT, EMPLOYEES, INCIDENT: incident });
  engine.speed = 1; engine._paused = false;
  placing = null; inspectTarget = null; replay = null; _firstDeployed = false;
  engine
    .on('change', () => { dirty = true; })
    .on('deploy', ({ product, target }) => { fx.addProp(product, target); applyCoverage(coveredRooms(product, target)); dirty = true; firstDeploy(); })
    .on('undo', ({ product, target }) => { if (product) fx.removeProp(product, target); applyCoverage(); dirty = true; })
    .on('operation', ({ product, room }) => {
      fx.scanWave(room); overlay.toast({ kind: 'good', key: 'toast.deployed', product }); dirty = true;
    })
    .on('clue', c => { fx.addClue(c); if (c.type === 'network' && c.fromRoom) fx.addTrail(c.fromRoom, c.room); setTicker(`${t('clue.' + c.type)} · ${roomName(c.room)}`); dirty = true; })
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
    .on('intruder-goto', ({ room, desk }) => {
      const it = people.get('intruder'); if (!it) return;
      it._entered = true; people.setRoute(it, desk ? 'desk:' + desk : 'room:' + room);
      const lv = roomLevel.get(room);
      if (lv && lv !== activeLevel) { overlay.pulseFloor(lv); setTicker(t('ticker.otherFloor') + ' · ' + loc(LAYOUT.levels.find(l => l.id === lv)?.name || ''), 'warn'); }
    })
    .on('lock', ({ room, locked }) => { fx.lockRoom(room, locked); if (locked) setTicker(t('ticker.ransom'), 'bad'); })
    .on('cage-room', ({ room }) => fx.restrictRoom(room))
    .on('contained', ({ desk }) => { const it = people.get('intruder'); if (it) it.halted = true; if (desk) fx.cageDesk(desk); fx.resolveAllClues(); fx.clearCorrelation(); setTicker(t('resp.contained'), 'good'); dirty = true; })
    .on('sophia', ({ id }) => showSophia(id))
    .on('toast', p => overlay.toast(p))
    .on('phase', ({ phase }) => { overlay.setPhase(phase); if (phase === 'incident') { overlay.setEvent(lastEvent, false); applyCoverage(); } dirty = true; })
    .on('end', () => endGame());

  lastEvent = '';
  overlay.hideStart(); overlay.hideEnd();
  overlay.clearInspect();
  overlay.setPhase('prep');
  activeLevel = LAYOUT.defaultLevel; overviewAll();
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
  stopReplay();
  overlay.els.end.classList.add('replaying');
  const it = people.get('intruder');
  if (it) { it._normalSpeed = it.speed; it.halted = false; it._entered = true; it.group.visible = true; const start = building.nav.nodes.get('entrance'); it.pos.copy(start.pos); it.group.position.copy(start.pos); it.currentNode = 'entrance'; it.path = null; fx.setReveal(it.group); }
  // Replay only events that actually happened, including the first event.
  replay = { index: -1, timer: 1.8, beats: engine.log.filter(l => l.kind === 'attack') };
  stepReplay(0);
}
function stopReplay() {
  const it = people?.get('intruder');
  if (it?._normalSpeed != null) { it.speed = it._normalSpeed; delete it._normalSpeed; it.halted = true; }
  replay = null;
}
function stepReplay(dt) {
  if (!replay) return;
  const it = people.get('intruder'); if (!it) return;
  replay.timer += dt;
  if (replay.timer >= 1.8 && !it.path) {
    replay.timer = 0; replay.index++;
    if (replay.index >= replay.beats.length) { stopReplay(); return; }
    const b = replay.beats[replay.index];
    ensureLevelFor(b.room);
    people.setRoute(it, b.desk ? 'desk:' + b.desk : 'room:' + b.room);
    if (it.path) {
      let distance = it.pos.distanceTo(it.path[it.wpIndex]);
      for (let i = it.wpIndex + 1; i < it.path.length; i++) distance += it.path[i - 1].distanceTo(it.path[i]);
      it.speed = Math.max(it._normalSpeed, distance / 1.3);
    }
    const point = building.rooms.get(b.room)?.center;
    if (point) world.focusOn(point.clone().setY(point.y + 1), 20);
    overlay.highlightStep(replay.index);
  }
}

// ---------- overlay handlers ----------
overlay = createOverlay(overlayRoot, {
  isAudioOn: () => ambience.enabled,
  onAudioToggle: async () => { await ambience.toggle(); if (engine) overlay.renderHud(engine); },
  onStart: newGame,
  onBeginDay: beginDay,
  onPickProduct: id => {
    placing = (placing === id) ? null : id;
    if (placing) {
      // Jump to the floor where this capability belongs so its target is on screen and clickable.
      const elig = engine.eligible(placing);
      if (elig.room) { const lv = roomLevel.get(elig.room); if (lv && lv !== activeLevel) setActiveLevel(lv, true); }
      highlightPlacement(id);
    } else clearHighlight();
    overlay.renderTray(engine, placing);
  },
  onCancelPlacing: () => { placing = null; clearHighlight(); overlay.renderTray(engine, placing); },
  onPauseToggle: () => { engine._paused = !engine._paused; overlay.renderHud(engine); },
  onSpeed: s => { engine.speed = s; overlay.renderHud(engine); },
  onLang: () => { setLang(getLang() === 'en' ? 'zh' : 'en'); refreshAll(); },
  onIsolate: desk => { engine.isolateDevice(desk); renderInspect(); },
  onLockdown: room => { engine.lockdownRoom(room); renderInspect(); },
  onRecover: room => { engine.recover(room); renderInspect(); },
  onCancelRecovery: room => { engine.cancelRecovery(room); renderInspect(); },
  onUndoSetup: () => { engine.undoSetup(); placing = null; clearHighlight(); },
  onResetSetup: () => { while (engine.phase === 'prep' && engine.planHistory.length) engine.undoSetup(); placing = null; clearHighlight(); },
  onSophiaMore: () => { sophiaState.expanded = true; reflowSophia(); },
  onSophiaShow: () => { const f = sophiaFocusPoint(sophiaState.id); if (f) { world.focusOn(f.clone().setY(f.y + 1), 14); fx.setSelection(f); } sophiaState.expanded = true; reflowSophia(); },
  onFocusClue: id => focusClue(id),
  onInvestigate: () => { const c = engine.clues[engine.clues.length - 1]; if (c) focusClue(c.id); },
  onTab: () => { overlay.renderTray(engine, placing); },
  onOperation: id => engine.deployOperation(id),
  onHelperRule: rule => engine.setHelperRule(rule),
  onLocation: room => {
    ensureLevelFor(room); inspectTarget = { kind: 'room', roomId: room }; renderInspect();
    const point = entityFloorPoint(inspectTarget); if (point) { world.focusOn(point.clone().setY(point.y + 1), 11); fx.setSelection(point); }
  },
  onOverview: () => overviewAll(),
  onCloseView: () => {
    const point = entityFloorPoint(inspectTarget) || building.rooms.get(activeLevel === 'L2' ? 'l2-work' : 'office').center;
    world.focusOn(point.clone().setY(point.y + 1), 9);
  },
  onChangeAssignment: () => {
    stopReplay(); placing = null; clearHighlight(); clearTimeout(prepTimer);
    engine = null; inspectTarget = null; overlay.hideEnd(); overlay.clearInspect(); overlay.setPhase('start'); overlay.showStart();
  },
  onExportReport: () => {
    const report = { schemaVersion: 1, mission: engine.inc.name.en, difficulty: engine.inc.difficulty,
      outcome: engine.outcome.kind, score: engine.score, uptime: Math.round(engine.uptime), dataIntegrity: engine.data,
      remainingCredits: engine.budget, operations: [...engine.operations], helperRule: engine.helperRule,
      lockedRooms: [...engine.lockedRooms], deployed: engine.deployed, objectives: engine.objectives(),
      events: engine.log.map(event => ({ ...event, ...(event.truth ? { truth: event.truth.en } : {}) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'sentinel-session.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  onFloor: id => setActiveLevel(id, true),
  onCloseInspect: () => { inspectTarget = null; overlay.clearInspect(); if (fx) fx.clearSelection(); },
  onAgain: () => newGame(),
  onReplayPlay: () => startReplay(),
  onBackToGame: () => { overlay.els.end.classList.remove('replaying'); stopReplay(); overlay.showEnd(engine); },
});

function refreshAll() {
  if (building?.refreshSigns) building.refreshSigns();   // re-draw in-world signage in the new language
  for (const r of LAYOUT.rooms) {
    const el = labelEls.get(r.id); if (el) el.innerHTML = `${icon(roomIcon(r.type))}<span><b>${esc(loc(r.name))}</b><small>${t('placard.' + r.type)}</small></span>`;
  }
  if (!engine) { overlay.showStart(); return; }
  if (engine.phase === 'review') { overlay.showEnd(engine); return; }
  overlay.setPhase(engine.phase);
  overlay.renderFloors(building.floors, activeLevel);
  overlay.renderHud(engine); overlay.renderTray(engine, placing); overlay.renderFeed(engine); reflowSophia(); renderInspect();
  if (engine.phase === 'prep') overlay.setEvent(null, true); else overlay.setEvent(lastEvent, false);
}

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  // The opaque assignment screen needs no continuous 3D work behind it.
  if (!engine) { requestAnimationFrame(frame); return; }
  const incidentRunning = engine && engine.phase === 'incident' && !engine._paused;
  if (people) people.update(engine?.phase === 'incident' && engine._paused ? 0 : incidentRunning ? dt * engine.speed : dt);
  if (incidentRunning) engine.tick(dt * engine.speed);
  if (replay) stepReplay(dt);
  if (fx) fx.update(dt);
  // Pulse the "place here" highlight so valid deploy targets are obvious.
  if (placing && highlighted.length) { const p = 0.55 + (Math.sin(now * 0.006) + 1) * 0.4; for (const h of highlighted) h.mesh.material.emissiveIntensity = h.setInten * p; }
  if (people && building) updatePeopleFloorVis();
  world.render();
  updateLabels();
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
// Keyboard inspection: cycle rooms on the active floor without the mouse.
let kbRoomIdx = -1;
function kbCycleRoom(dir) {
  if (!engine || !['prep', 'incident'].includes(engine.phase)) return;
  const rs = LAYOUT.rooms.filter(r => r.level === activeLevel);
  if (!rs.length) return;
  kbRoomIdx = (kbRoomIdx + dir + rs.length) % rs.length;
  inspectTarget = { kind: 'room', roomId: rs[kbRoomIdx].id }; renderInspect();
  const pt = entityFloorPoint(inspectTarget); if (pt) { world.focusOn(pt.clone().setY(pt.y + 1), 14); fx.setSelection(pt); }
}
window.addEventListener('keydown', ev => {
  if (ev.target.closest('input, textarea, select, button, [contenteditable=true]') || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.code === 'Escape') { if (placing) { placing = null; clearHighlight(); overlay.renderTray(engine, placing); } else if (inspectTarget) { inspectTarget = null; overlay.clearInspect(); fx.clearSelection(); } }
  if (ev.code === 'Space' && engine?.phase === 'incident') { ev.preventDefault(); engine._paused = !engine._paused; overlay.renderHud(engine); }
  if (ev.code === 'Enter' && engine?.phase === 'prep') { ev.preventDefault(); beginDay(); }
  if (engine && ['prep', 'incident'].includes(engine.phase)) {
    if (ev.code === 'Digit1') setActiveLevel('L3');
    if (ev.code === 'Digit2') setActiveLevel('L2');
    if (ev.code === 'KeyH') overviewAll();
    if (ev.code === 'BracketLeft') { ev.preventDefault(); kbCycleRoom(-1); }
    if (ev.code === 'BracketRight') { ev.preventDefault(); kbCycleRoom(1); }
  }
});

// boot
initStage();
overlay.showStart();
overlay.setPhase('start');
requestAnimationFrame(frame);

// expose for headless testing
window.__sentinel = { get engine() { return engine; }, get building() { return building; }, get people() { return people; }, newGame, beginDay, world,
  inspect(e) { inspectTarget = e; renderInspect(); const p = entityFloorPoint(e); if (p) fx.setSelection(p); },
  focusClue };
