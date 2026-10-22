// "Sentinel — Kill Chain" tower-defense entry. Wires the neon world + board + TD engine
// + HUD, renders towers / threats / shots from engine state, and handles place/upgrade.
import { createWorld } from '../world/world.js';
import { buildBoard } from './board-td.js';
import { createTD, TD_TOWERS, TD_ENEMIES } from './engine-td.js';
import { PRODUCTS, PRODUCT_ORDER } from '../data/products.js';
import { createTDOverlay } from './overlay-td.js';
import { setLang, getLang } from '../i18n.js';

const canvas = document.getElementById('scene');
const root = document.getElementById('overlay');
const world = createWorld(canvas, 'cyber');
const THREE = world.THREE;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const board = buildBoard(THREE);
world.scene.add(board.group);
const engine = createTD({ path: board.path, slots: board.slots, products: PRODUCTS });
world.setView(V(-6, 36, 31), V(-5.5, 0, 2.2));

// ---- visual pools ----
const towerMeshes = new Map();   // towerId -> mesh
const slotTower = new Map();      // slotId  -> towerId
const enemyMeshes = new Map();    // enemyId -> { g, core, bar, halo }
const projMeshes = new Map();     // projId  -> mesh
let placing = null, selected = null, started = false;
const padBase = new Map();        // slotId -> {int,color} to restore highlight
let rangeRing = null;

const emis = (c, i = 1, r = 0.45, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: r, metalness: m });

// ---------- tower visuals ----------
function makeTurret(productId) {
  const spec = TD_TOWERS[productId], col = spec.color;
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.5, 8), emis(col, 0.35, 0.4, 0.5)); base.position.y = 0.45; g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x0b1a30, roughness: 0.5, metalness: 0.6 })); post.position.y = 0.95; g.add(post);
  const headY = 1.45;
  let head;
  if (spec.kind === 'sensor') { head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), emis(col, 1.3)); head.position.y = headY; }
  else if (spec.kind === 'support') { head = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 12, 24), emis(col, 1.6)); head.position.y = headY + 0.1; }
  else if (spec.kind === 'core') { head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), emis(col, 1.4)); head.position.y = headY; }
  else if (spec.kind === 'managed') { head = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), emis(col, 1.4)); head.position.y = headY; }
  else { head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.1), emis(col, 1.1)); head.position.y = headY; }     // damage dealer: a barrel
  g.add(head); g.userData.head = head; g.userData.spec = spec;
  const light = new THREE.PointLight(col, 3, 6, 2); light.position.y = headY; g.add(light);
  return g;
}

// ---------- threat visuals ----------
function makeEnemy(type) {
  const spec = TD_ENEMIES[type], col = spec.color, sz = spec.boss ? 1.5 : 0.78;
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42 * sz, 0), emis(col, 1.5)); g.add(core);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.6 * sz, 0.05, 8, 20), emis(col, 1.2)); halo.rotation.x = Math.PI / 2; g.add(halo);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * sz, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.5 })); g.add(shell);
  // hp bar (two planes, billboarded)
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * sz, 0.14), new THREE.MeshBasicMaterial({ color: 0x08121f, transparent: true, opacity: 0.8, depthWrite: false }));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * sz, 0.14), new THREE.MeshBasicMaterial({ color: 0x39e08a, depthWrite: false }));
  bar.position.z = 0.001; const barG = new THREE.Group(); barG.add(barBg, bar); barG.position.y = 1.1 * sz; g.add(barG);
  const light = new THREE.PointLight(col, 2.4, 4.5, 2); g.add(light);
  g.userData = { core, halo, shell, bar, barG, sz, col };
  return g;
}

function makeProjectile(color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), emis(color, 2));
  const light = new THREE.PointLight(color, 3, 4, 2); m.add(light); return m;
}

// ---------- pad highlight while placing ----------
function highlightPads(on) {
  for (const [id, pad] of board.padBySlot) {
    const rim = pad.children[1]?.material; if (!rim) continue;
    if (on && !slotTower.has(id)) { if (!padBase.has(id)) padBase.set(id, rim.emissiveIntensity); rim.emissiveIntensity = 2.6; pad.children[0].scale.setScalar(1); }
    else if (padBase.has(id)) { rim.emissiveIntensity = padBase.get(id); padBase.delete(id); }
  }
}

function showRange(tw) {
  if (rangeRing) { world.scene.remove(rangeRing); rangeRing.geometry.dispose(); rangeRing = null; }
  if (!tw) return;
  const st = engine.towerStats(tw); if (!st.range || st.range > 50) return;
  rangeRing = new THREE.Mesh(new THREE.RingGeometry(st.range - 0.12, st.range, 48), new THREE.MeshBasicMaterial({ color: TD_TOWERS[tw.productId].color, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  rangeRing.rotation.x = -Math.PI / 2; rangeRing.position.set(tw.x, 0.2, tw.z); world.scene.add(rangeRing);
}

// ---------- interaction ----------
function reticleSvg(ready) {
  const g = ready ? '#6cffb9' : '#39e08a', halo = ready ? 'rgba(108,255,185,.5)' : 'rgba(57,224,138,.34)';
  const lines = 'M27 2v12 M27 40v12 M2 27h12 M40 27h12', ring = '<circle cx="27" cy="27" r="13"/>';
  const fill = ready ? '<circle cx="27" cy="27" r="12.5" fill="rgba(57,224,138,.2)"/>' : '';
  const br = ready ? `<g fill="none" stroke="${g}" stroke-width="3" stroke-linecap="round"><path d="M14 10h-4v4M40 10h4v4M14 44h-4v-4M40 44h4v-4"/></g>` : '';
  return `<svg xmlns='http://www.w3.org/2000/svg' width='54' height='54' viewBox='0 0 54 54'><g fill='none' stroke='#05070e' stroke-width='6' stroke-linecap='round'>${ring}<path d='${lines}'/></g><g fill='none' stroke='${halo}' stroke-width='5.5' stroke-linecap='round'>${ring}<path d='${lines}'/></g>${fill}<g fill='none' stroke='${g}' stroke-width='2.6' stroke-linecap='round'>${ring}<path d='${lines}'/></g>${br}<circle cx='27' cy='27' r='2.6' fill='${g}'/></svg>`;
}
const CUR_PLACE = `url("data:image/svg+xml,${encodeURIComponent(reticleSvg(false))}") 27 27, crosshair`;
const CUR_READY = `url("data:image/svg+xml,${encodeURIComponent(reticleSvg(true))}") 27 27, crosshair`;
let _cur = '';
function setCursor(s) { if (s === _cur) return; _cur = s; canvas.style.cursor = s === 'place' ? CUR_PLACE : s === 'ready' ? CUR_READY : s === 'pointer' ? 'pointer' : 'grab'; }

function onMove(ev) {
  const hit = world.pick(ev.clientX, ev.clientY, board.pickables);
  if (placing) setCursor(hit && hit.entity.kind === 'slot' && !slotTower.has(hit.entity.slotId) ? 'ready' : 'place');
  else setCursor(hit ? 'pointer' : 'grab');
}
function onClick(ev) {
  const hit = world.pick(ev.clientX, ev.clientY, board.pickables);
  const slotId = hit?.entity?.kind === 'slot' ? hit.entity.slotId : null;
  if (placing) {
    if (!slotId) return overlay.toast('td.noPad', 'warn');
    const res = placeTower(slotId, placing);
    if (!res.ok) return overlay.toast(res.reason === 'tooPoor' ? 'td.tooPoor' : 'td.noPad', 'warn');
    placing = null; highlightPads(false); selectTower(res.tower.id); syncHud();
    return;
  }
  if (slotId && slotTower.has(slotId)) selectTower(slotTower.get(slotId));
  else selectTower(null);
}
// Build a tower on a pad and spawn its mesh. Returns the engine result.
function placeTower(slotId, productId) {
  const res = engine.build(slotId, productId);
  if (!res.ok) return res;
  const m = makeTurret(productId); const sl = board.slots.find(s => s.id === slotId); m.position.set(sl.x, 0, sl.z);
  world.scene.add(m); towerMeshes.set(res.tower.id, m); slotTower.set(slotId, res.tower.id);
  return res;
}
function selectTower(id) {
  selected = id;
  const tw = id ? engine.state.towers.find(t => t.id === id) : null;
  showRange(tw);
  overlay.showTower(tw);
}

// ---------- handlers for overlay ----------
const handlers = {
  onStart() { started = true; overlay.hideStart(); overlay.setPhase('play'); syncHud(); },
  onPick(id) {
    placing = (placing === id) ? null : id; selectTower(null);
    highlightPads(!!placing); setCursor(placing ? 'place' : 'grab'); overlay.renderDeck(engine, placing);
  },
  onLaunch() { const r = engine.startWave(); if (r.ok) { placing = null; highlightPads(false); } syncHud(); },
  onUpgrade() { if (!selected) return; const r = engine.upgrade(selected); if (r.ok) { bumpTower(selected); const tw = engine.state.towers.find(t => t.id === selected); showRange(tw); overlay.showTower(tw); } syncHud(); },
  onSell() { if (!selected) return; const tw = engine.state.towers.find(t => t.id === selected); if (!tw) return; engine.sell(selected); const m = towerMeshes.get(selected); if (m) { world.scene.remove(m); towerMeshes.delete(selected); } slotTower.delete(tw.slotId); selectTower(null); syncHud(); },
  onSpeed(s) { speed = s; syncHud(); },
  onPause() { paused = !paused; engine.state._paused = paused; syncHud(); },
  onLang() { setLang(getLang() === 'en' ? 'zh' : 'en'); if (!started) overlay.showStart(); else { syncHud(); selectTower(selected); } },
  onRestart() { location.reload(); },
};
let speed = 1, paused = false;

function bumpTower(id) { const m = towerMeshes.get(id); if (!m?.userData.head) return; m.userData.head.scale.multiplyScalar(1.12); m.userData.head.material.emissiveIntensity += 0.25; }

const overlay = createTDOverlay(root, handlers);
overlay.showStart();

function syncHud() { engine.state._paused = paused; overlay.renderHud(engine, speed); overlay.renderDeck(engine, placing); if (!selected) overlay.showTower(null); }

canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('click', onClick);
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') { if (placing) { placing = null; highlightPads(false); setCursor('grab'); overlay.renderDeck(engine, placing); } else selectTower(null); }
  if (e.code === 'Space' && started) { e.preventDefault(); if (engine.phase === 'build') handlers.onLaunch(); else handlers.onPause(); }
});

// ---------- render loop ----------
const clock = new THREE.Clock();
let lastPhase = 'build';
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.05);
  if (started && !paused) for (let i = 0; i < speed; i++) engine.tick(dt);
  syncEnemies(dt); syncProjectiles(); animateTowers(dt);
  board.update(world.camera);
  if (engine.phase !== lastPhase) { lastPhase = engine.phase; onPhase(engine.phase); }
  overlay.renderHud(engine, speed);
  world.render();
}
function onPhase(p) {
  if (p === 'won' || p === 'lost') overlay.showEnd(p, engine);
  else if (p === 'build') { syncHud(); }
}

const _t = { v: 0 };
function syncEnemies(dt) {
  _t.v += dt;
  const live = new Set();
  for (const e of engine.state.enemies) {
    live.add(e.id);
    let vis = enemyMeshes.get(e.id);
    if (!vis) { const g = makeEnemy(e.type); world.scene.add(g); vis = { g }; enemyMeshes.set(e.id, vis); }
    const g = vis.g, ud = g.userData;
    g.position.set(e.x, 0.9 + Math.sin(_t.v * 3 + e.id) * 0.12, e.z);
    ud.core.rotation.y += dt * 2.4; ud.core.rotation.x += dt * 1.6; ud.shell.rotation.y -= dt * 1.4;
    // stealth: faint & translucent until revealed
    const hidden = !e.revealed;
    ud.core.material.opacity = hidden ? 0.28 : 1; ud.core.material.transparent = hidden;
    ud.shell.material.opacity = hidden ? 0.12 : 0.5;
    ud.barG.visible = !hidden && e.hp < e.maxHp;
    const frac = Math.max(0, e.hp / e.maxHp); ud.bar.scale.x = frac; ud.bar.position.x = -(1 - frac) * 0.6 * ud.sz;
    ud.bar.material.color.setHex(frac > 0.5 ? 0x39e08a : frac > 0.25 ? 0xffba45 : 0xff5a6a);
    ud.barG.quaternion.copy(world.camera.quaternion);
    const hitFlash = (engine.state.time - (e._hit ?? -9)) < 0.1;
    ud.core.material.emissiveIntensity = hitFlash ? 3 : 1.5;
  }
  for (const [id, vis] of enemyMeshes) if (!live.has(id)) { world.scene.remove(vis.g); disposeDeep(vis.g); enemyMeshes.delete(id); }
}
function syncProjectiles() {
  const live = new Set();
  for (const p of engine.state.projectiles) {
    live.add(p.id);
    let m = projMeshes.get(p.id);
    if (!m) { m = makeProjectile(p.color); world.scene.add(m); projMeshes.set(p.id, m); }
    m.position.set(p.x, 1.0, p.z);
  }
  for (const [id, m] of projMeshes) if (!live.has(id)) { world.scene.remove(m); disposeDeep(m); projMeshes.delete(id); }
}
function animateTowers(dt) {
  for (const tw of engine.state.towers) {
    const m = towerMeshes.get(tw.id); if (!m) continue;
    const head = m.userData.head, spec = m.userData.spec;
    if (spec.kind === 'sensor' || spec.kind === 'support' || spec.kind === 'managed') head.rotation.y += dt * (spec.kind === 'sensor' ? 1.6 : 0.8);
    // recoil/flash on fire
    const since = engine.state.time - (tw.firedAt ?? -9);
    if (since < 0.12) { head.material.emissiveIntensity = 2.4; }
    else head.material.emissiveIntensity = Math.max(1.0, head.material.emissiveIntensity - dt * 4);
  }
}
function disposeDeep(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(mm => mm.dispose()); }); }

frame();

// expose for headless checks
window.__td = { get engine() { return engine; }, world, board, handlers, placeTower, syncHud, get placing() { return placing; }, get selected() { return selected; } };
