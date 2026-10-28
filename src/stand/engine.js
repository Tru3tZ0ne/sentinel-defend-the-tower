// Last Stand — the machine. A real-time 3D base-defense shooter rendered with
// Three.js (vendored locally). The SIMULATION is unchanged and still runs in a
// 2D plane: threats pour straight DOWN the lane, the operator and every deployed
// Sangfor unit fire straight UP. The renderer maps that plane into a 3D world —
// a perspective camera looks down the lane, units are lit 3D meshes that carry
// their official Sangfor product marks, the base you defend wears the Sangfor
// logo, and a thin 2D overlay paints damage numbers, hit sparks and flashes.
// Pure numbers live in model.js.

import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import {
  START_BASE, OPERATOR, TURRET, ALLY, WEAPON_ORDER, deriveSquad, damageTo,
  xpToLevel, upgradeChoices, ENEMIES, threatPool, difficultyAt,
  comboMult, killScore, SURVIVE_PER_SEC, STEAL_PENALTY, ABILITIES, ABILITY_ORDER,
  bossFor, bossHpScale,
} from './model.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { sfx } from '../rush/audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

export const ACCENT = {
  EDR: '#ff8a5a', MDR: '#16ca78', AF: '#2ee6a0', NDR: '#58c8ff',
  IAG: '#ffd166', HCI: '#39c0ff', XDR: '#9be85a', ASTOR: '#a98bff',
};
const ACC = Object.fromEntries(Object.entries(ACCENT).map(([k, v]) => [k, parseInt(v.slice(1), 16)]));
const hexNum = h => parseInt(h.replace('#', ''), 16);
const hexToRGB = h => { const c = h.replace('#', ''); return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`; };
const BAR_OFFSET = 74;

// Temporary SERVICE teams summoned by the active skills. Red Team = many basic
// attackers; Pen Test = a smaller, sharper (piercing) crew.
const TEAM = {
  rt: { hex: '#ff5a6a', col: 0xff5a6a, label: 'RED TEAM', dmg: 20, rate: 3.0, speed: 960, pierce: 1 },
  pt: { hex: '#ffd166', col: 0xffd166, label: 'PEN TEST', dmg: 34, rate: 2.7, speed: 980, pierce: 2 },
};

// world mapping constants (sim stays in pixels; render maps to these world units)
const HALFW = 9, LEN = 34, RS = 0.06;
const fmtNum = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n)));

export function createStandGame(canvas, opts = {}) {
  const onHud = opts.onHud || (() => {});
  const onToast = opts.onToast || (() => {});
  const onLevelUp = opts.onLevelUp || (() => {});
  const onOver = opts.onOver || (() => {});

  // ---- 2D overlay (damage numbers, sparks, flashes) sits above the WebGL canvas ----
  const fx = document.createElement('canvas');
  fx.className = 'st-fx';
  const fctx = fx.getContext('2d');
  (canvas.parentNode || document.body).insertBefore(fx, canvas.nextSibling);

  // ---- textures: official Sangfor product marks + corporate logo ----
  const texLoader = new THREE.TextureLoader();
  const markTex = {};
  for (const id of WEAPON_ORDER) { const m = PRODUCT_MARKS[id]; if (m) { const tx = texLoader.load('assets/brand/products/sangfor-' + m[0]); tx.colorSpace = THREE.SRGBColorSpace; markTex[id] = tx; } }
  const brandTex = texLoader.load('assets/brand/sangfor-logo-white.png'); brandTex.colorSpace = THREE.SRGBColorSpace;

  // ---- renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070e);
  scene.fog = new THREE.Fog(0x05070e, LEN * 0.72, LEN * 1.5);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  const CAM_BASE = new THREE.Vector3(0, 12.5, -12.5);
  const CAM_LOOK = new THREE.Vector3(0, 2.1, 15);
  camera.position.copy(CAM_BASE); camera.lookAt(CAM_LOOK);

  // lights
  const hemi = new THREE.HemisphereLight(0x9fc0ff, 0x0a0e18, 0.75); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-8, 20, 2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 10; key.shadow.camera.bottom = -40; key.shadow.bias = -0.0008;
  scene.add(key); scene.add(key.target); key.target.position.set(0, 0, 16);
  const rim = new THREE.DirectionalLight(0x66ff9e, 0.4); rim.position.set(6, 6, 24); scene.add(rim);

  // bloom for the premium glow (bullets, beam, barrier, product accents)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.55, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- static world: floor, walls, base + Sangfor logo, lane edges ----
  const laneW = HALFW * 2;
  const floorMat = new THREE.MeshStandardMaterial({ map: makeFloorTex(), roughness: 0.92, metalness: 0.1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(laneW, LEN + 12), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, LEN / 2 - 3); floor.receiveShadow = true; scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 1, metalness: 0 });
  for (const s of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, LEN + 12), wallMat); wall.position.set(s * (HALFW + 1.25), 3, LEN / 2 - 3); wall.receiveShadow = true; scene.add(wall); }
  // glowing lane edges
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x72bb38 });
  for (const s of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, LEN + 12), edgeMat); edge.position.set(s * HALFW, 0.07, LEN / 2 - 3); scene.add(edge); }

  // base rampart behind the operator, carrying the SANGFOR corporate logo
  const base = new THREE.Group();
  const baseWall = new THREE.Mesh(new THREE.BoxGeometry(laneW, 2.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.7, metalness: 0.35 }));
  baseWall.position.set(0, 1.3, 0); baseWall.castShadow = true; baseWall.receiveShadow = true; base.add(baseWall);
  const baseTop = new THREE.Mesh(new THREE.BoxGeometry(laneW, 0.18, 1.8), new THREE.MeshBasicMaterial({ color: 0x72bb38 })); baseTop.position.set(0, 2.6, 0); base.add(baseTop);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.7), new THREE.MeshBasicMaterial({ map: brandTex, transparent: true }));
  logo.position.set(0, 1.95, -0.82); logo.rotation.y = Math.PI; base.add(logo);   // faces the camera (-Z)
  base.position.set(0, 0, -1.6); scene.add(base);

  // dynamic groups
  const unitsGroup = new THREE.Group(); scene.add(unitsGroup);
  const tempsGroup = new THREE.Group(); scene.add(tempsGroup);   // summoned service teams (survive unit rebuilds)
  const enemyGroup = new THREE.Group(); scene.add(enemyGroup);
  const bulletGroup = new THREE.Group(); scene.add(bulletGroup);
  let opMesh = null, allyMesh = null;
  const enemyMeshes = new Map();         // id -> { group, body, core, type }
  const tempMeshes = new Map();          // temp-team unit id -> mesh
  const bulletPool = [];                 // reusable glow bullets
  let barrierObj = null, bandObj = null, beamObj = null, shieldObj = null, coreObj = null, radarObj = null, radarSweep = null;

  // ---- geometry (pixel space for the sim) ----
  let W = 0, H = 0, dpr = 1, barH = 0, baseY = 0, opHome = 0, bandY = 0;
  let fieldL = 0, fieldR = 0, fieldW = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    // Keep the lane's HORIZONTAL field constant so it always fits, and let tall
    // phone screens simply reveal more lane length (widen the vertical FOV).
    camera.aspect = W / H;
    const asp = W / H, refAsp = 0.62, baseFov = 48;
    camera.fov = asp < refAsp
      ? Math.min(80, 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * (refAsp / asp)) * 180 / Math.PI)
      : baseFov;
    camera.updateProjectionMatrix();
    fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    barH = Math.max(52, H * 0.09); baseY = H - barH; opHome = baseY - 62; bandY = H * 0.44;
    fieldW = clamp(W * 0.92, 340, 440); fieldL = Math.round((W - fieldW) / 2); fieldR = fieldL + fieldW;
    if (S) { S.op.x = clamp(S.op.x, opMinX(), opMaxX()); S.op.y = clamp(S.op.y, opMinY(), opMaxY()); unitsDirty = true; }
  }
  const opMinX = () => fieldL + 26, opMaxX = () => fieldR - 26;
  const opMinY = () => baseY - 168, opMaxY = () => baseY - 40;
  const cx = () => fieldL + fieldW / 2;
  // The camera looks DOWN the lane from behind the operator (toward +Z), so world
  // +X renders on the LEFT. Negate so dragging/steering RIGHT moves the unit right.
  const wX = gx => -((gx - cx()) / (fieldW / 2)) * HALFW;
  const wZ = gy => ((baseY - gy) / baseY) * LEN;
  const wR = pr => pr * 0.055;    // pixel radius -> world radius

  let S = null, raf = 0, lastTS = 0, nextId = 1, unitsDirty = false;
  const keys = new Set();
  const drag = { on: false };

  function fresh() {
    return {
      phase: 'idle', base: START_BASE, baseMax: START_BASE, score: 0, best: 0,
      combo: 0, maxCombo: 0, elapsed: 0, kills: 0, level: 1, xp: 0, xpNeed: xpToLevel(1),
      levels: {}, squad: deriveSquad({}), shooters: [], shield: 0, pendingLevels: 0,
      afHp: 0, afMax: 0, afDown: false, afDownT: 0, radarAng: 0,
      op: { x: W / 2, y: opHome, muzzle: 0 },
      enemies: [], shots: [], parts: [], texts: [], fxr: [], beam: null, temps: [],
      spawnAcc: 0, beamAcc: 0, shieldAcc: 0, lastBoss: -28, bossCount: 0,
      shake: 0, flash: 0, flashCol: '255,90,106', hudAcc: 0,
      cd: { ir: 0, pt: 0, rt: 0 }, ptT: 0, rtT: 0,   // active-skill cooldowns + team-summon timers
      hitStop: 0, corrAnnounced: false,              // brief time-freeze for impact; correlation teach
    };
  }

  function recompute() {
    S.squad = deriveSquad(S.levels);
    const sq = S.squad;
    const list = [{ kind: 'op', off: 0, yoff: 0, dmg: OPERATOR.dmg, rate: OPERATOR.rate, speed: OPERATOR.bulletSpeed, pierce: OPERATOR.pierce, acc: 0 }];
    const n = sq.edrTurrets;
    for (let i = 0; i < n; i++) list.push({ kind: 'edr', fixed: true, frac: (i + 1) / (n + 1), dmg: sq.edrDmg, rate: TURRET.rate, speed: TURRET.bulletSpeed, pierce: TURRET.pierce, acc: 0 });
    if (sq.mdrAllies > 0) list.push({ kind: 'mdr', off: 54, yoff: 6, dmg: sq.mdrDmg, rate: sq.mdrRate, speed: ALLY.bulletSpeed, pierce: ALLY.pierce, acc: 0 });
    if (S.shooters) list.forEach((s, i) => { if (S.shooters[i]) s.acc = S.shooters[i].acc; });
    S.shooters = list;
    if (sq.afTier > 0) { const grew = sq.afHp - S.afMax; S.afMax = sq.afHp; if (grew > 0) S.afHp = Math.min(sq.afHp, S.afHp + grew); if (S.afHp <= 0 && !S.afDown) S.afHp = sq.afHp; }
    else { S.afMax = 0; S.afHp = 0; S.afDown = false; }
    if (correlationLinks() > 0 && !S.corrAnnounced) { S.corrAnnounced = true; onToast('corrOn', 'good'); }
    unitsDirty = true;
  }

  // ---- fx helpers (consumed by the 2D overlay) ----
  function burst(x, y, color, n = 12, spread = 180) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * spread; S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, r: 1.4 + Math.random() * 3 }); }
  }
  const ring = (x, y, color, max, w = 3) => S.fxr.push({ t: 'ring', x, y, color, r: 5, max, w, life: 1 });
  const shock = (x, y, color, max) => S.fxr.push({ t: 'ring', x, y, color, r: 5, max, w: 5, life: 1 });
  const zap = (x1, y1, x2, y2, color) => S.fxr.push({ t: 'zap', x1, y1, x2, y2, color, life: 1 });
  function dmgText(x, y, n, color, big) { S.texts.push({ x, y, text: fmtNum(n), color, life: 1, big: !!big, vy: -32 - Math.random() * 20, vx: rand(-14, 14) }); }

  // ---- enemies ----
  function spawnEnemy(type) {
    const d = difficultyAt(S.elapsed), spec = ENEMIES[type];
    const hp = Math.round(spec.hp * (spec.boss ? bossHpScale(S.elapsed, spec.mega) : d.hpMul));
    S.enemies.push({ id: nextId++, type, spec, x: rand(fieldL + spec.r + 4, fieldR - spec.r - 4), y: -spec.r - rand(2, 40), r: spec.r, hp, maxhp: hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false, spawnAcc: 0 });
  }
  // Bosses arrive on a rotation (model BOSS_ORDER). Each entrance is telegraphed.
  function spawnBoss() {
    const type = bossFor(S.bossCount++), mega = !!ENEMIES[type].mega;
    spawnEnemy(type);
    onToast('boss_' + type, 'bad');
    S.flash = mega ? 0.9 : 0.6; S.flashCol = hexToRGB(ENEMIES[type].color); S.shake = Math.min(1, mega ? 1 : 0.7);
    sfx.boss();
  }
  function killEnemy(e, viaBeam) {
    e.dead = true;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += killScore(e.type, comboMult(S.combo)); S.kills++;
    gainXp(e.spec.xp);
    burst(e.x, e.y, e.spec.color, e.spec.boss ? 40 : 12, e.spec.boss ? 300 : 170);
    ring(e.x, e.y, e.spec.color, e.r * (e.spec.boss ? 5 : 2.2));
    ring(e.x, e.y, '#ffffff', e.r * (e.spec.boss ? 3 : 1.7), 2);   // crisp white death pop
    if (e.spec.boss) {
      S.shake = 1; S.flash = e.spec.mega ? 1 : 0.85; S.flashCol = hexToRGB(e.spec.color);
      S.hitStop = Math.max(S.hitStop, e.spec.mega ? 0.24 : 0.14);
      if (e.spec.mega) { shock(e.x, e.y, '#ffffff', e.r * 10); for (let i = 0; i < 5; i++) ring(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), e.spec.color, e.r * (2.5 + i), 2); }
      sfx.boss();
    }
    else if (!viaBeam) sfx.hit(S.combo);
    if (e.spec.splits) for (let i = 0; i < e.spec.splits; i++) { const r2 = ENEMIES.recon; S.enemies.push({ id: nextId++, type: 'recon', spec: r2, x: e.x + rand(-14, 14), y: e.y, r: r2.r, hp: r2.hp, maxhp: r2.hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false }); }
    // XDR CORRELATION CHAINS (the signature): with 2+ sensors on the field, a kill
    // correlates across them and arcs lightning to nearby threats, which can cascade.
    const links = correlationLinks();
    if (links > 0) fireCorrelation(e.x, e.y, links, 0);
  }
  // XDR needs >=2 sensor UNITS to correlate (its real rule); chain reach grows with them
  const correlationLinks = () => (S.squad.sensors >= 2 ? Math.min(4, S.squad.sensors - 1) : 0);
  function fireCorrelation(x, y, links, depth) {
    if (links <= 0 || depth > 3) return;
    const R2 = (150 + S.squad.sensors * 12) ** 2;
    const near = S.enemies.filter(t => !t.dead && (t.x !== x || t.y !== y) && dist2(x, y, t.x, t.y) <= R2)
      .sort((a, b) => dist2(x, y, a.x, a.y) - dist2(x, y, b.x, b.y)).slice(0, links);
    if (!near.length) return;
    const dmg = 24 + S.squad.sensors * 13;
    S.shake = Math.min(1, S.shake + 0.12);
    for (const t of near) {
      zap(x, y, t.x, t.y, '#7dffd0'); zap(x, y, t.x, t.y, '#eafffb');
      ring(t.x, t.y, '#7dffd0', t.r * 2.6, 3);
      const dealt = dealDamage(t, dmg);
      dmgText(t.x, t.y - t.r, dealt, '#7dffd0', false);
      burst(t.x, t.y, '#7dffd0', 5, 100);
      if (t.hp <= 0 && !t.dead) {
        t.dead = true; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
        S.score += killScore(t.type, comboMult(S.combo)); S.kills++; gainXp(t.spec.xp);
        burst(t.x, t.y, t.spec.color, 12, 160); ring(t.x, t.y, '#ffffff', t.r * 1.7, 2);
        fireCorrelation(t.x, t.y, links - 1, depth + 1);   // cascade
      }
    }
    if (depth === 0) sfx.ability();
  }
  // cloaked APTs are only fully seen once NDR (network visibility) is deployed
  const revealed = () => S.squad.ndrReveal;
  // damage with the NDR mark bonus + stealth
  function dealDamage(e, raw) {
    const mark = e.spec.cloak && !revealed() ? 0.5 : 1;
    const bonus = S.squad.ndrMark ? 1 + S.squad.ndrMark : 1;
    const dealt = raw * mark * bonus;
    e.hp -= dealt; e.hit = 1;
    return dealt;
  }
  function hitEnemy(e, raw, color, big) {
    const dealt = dealDamage(e, raw);
    dmgText(e.x, e.y - e.r, dealt, color || '#fff', big);
  }

  // ---- firing (straight up only) ----
  function unitX(sh) { return sh.fixed ? fieldL + fieldW * sh.frac : clamp(S.op.x + (sh.off || 0), fieldL + 16, fieldR - 16); }
  function unitY(sh) { return sh.fixed ? baseY - 50 : S.op.y + (sh.yoff || 0); }
  function fireUp(x, y, dmg, speed, pierce, color) { S.shots.push({ x, y, vx: 0, vy: -speed, dmg, pierce, hit: new Set(), r: 4.5, color }); }
  function fireBeam() {
    const sq = S.squad; if (!sq.beamOn) return;
    S.beam = { x: S.op.x, life: 1, width: sq.beamWidth, dmg: sq.beamDmg };
    S.flash = 0.82; S.flashCol = '185,255,120'; S.shake = Math.min(1, 0.5 + sq.sensors * 0.07);
    shock(S.op.x, S.op.y - 10, '#eaffc0', 210); ring(S.op.x, S.op.y - 10, ACCENT.XDR, 170, 7);
    burst(S.op.x, S.op.y - 20, '#eaffc0', 24, 230);
    // correlation arcs to every sensor unit feeding the beam
    for (const sh of S.shooters) if (sh.kind === 'edr') zap(S.op.x, S.op.y - 16, unitX(sh), unitY(sh) - 6, ACCENT.EDR);
    if (sq.ndrRadars > 0) zap(S.op.x, S.op.y - 16, clamp(fieldR - 34, fieldL + 30, fieldR - 30), baseY - 30, ACCENT.NDR);
    if (sq.afTier > 0) zap(S.op.x, S.op.y - 16, S.op.x, S.op.y - BAR_OFFSET, ACCENT.AF);
    sfx.ability();
    if (sq.xdrIdle) onToast('xdrIdle', 'bad');
  }
  function dominant() { let b = null, bl = 0; for (const id of WEAPON_ORDER) { const l = S.levels[id] || 0; if (l > bl) { bl = l; b = id; } } return b; }
  function dominantColor() { const id = dominant(); return id ? (ACCENT[id] || '#9be85a') : '#9be85a'; }

  // ---- xp / level ----
  function gainXp(n) {
    S.xp += n;
    while (S.xp >= S.xpNeed) { S.xp -= S.xpNeed; S.level++; S.xpNeed = xpToLevel(S.level); S.pendingLevels++; }
    if (S.pendingLevels > 0 && S.phase === 'play') openLevelUp();
  }
  function openLevelUp() {
    const choices = upgradeChoices(S.levels);
    if (!choices.length) { S.pendingLevels = 0; return; }
    S.phase = 'levelup'; S.op.muzzle = 0; onLevelUp(choices, S.level); sfx.start();
  }
  function applyUpgrade(id) {
    S.levels[id] = Math.min((S.levels[id] || 0) + 1, 99);
    recompute();
    ring(S.op.x, S.op.y, ACCENT[id] || '#72bb38', 90, 5); burst(S.op.x, S.op.y - 16, ACCENT[id] || '#72bb38', 18, 150);
    S.pendingLevels--;
    if (S.pendingLevels > 0) openLevelUp(); else { S.phase = 'play'; lastTS = performance.now(); }
  }

  // ---- active operator skills (player-triggered, on cooldown) ----
  function useAbility(id) {
    if (!S || S.phase !== 'play') return false;
    const spec = ABILITIES[id]; if (!spec || S.cd[id] > 0) return false;
    S.cd[id] = spec.cd;
    if (id === 'ir') abilityIR();
    else if (id === 'pt') { S.ptT = spec.dur; summonTeam('pt', spec); onToast('ptOn', 'good'); }
    else if (id === 'rt') { S.rtT = spec.dur; summonTeam('rt', spec); onToast('rtOn', 'good'); S.flash = 0.4; S.flashCol = '255,90,106'; }
    pushHud();
    return true;
  }
  // Summon a temporary SERVICE team: `spec.team` operatives fan out beside the
  // operator and fire straight up for `spec.dur` seconds, then withdraw.
  function summonTeam(id, spec) {
    const cfg = TEAM[id], n = spec.team; if (!cfg || n <= 0) return;
    const spacing = Math.min(56, (fieldW * 0.82) / (n + 1));
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spacing;
      // anchor each operative to a FIXED spot on the field at summon time - they
      // hold their ground and do NOT follow the operator as it moves.
      const fx = clamp(S.op.x + off, fieldL + 16, fieldR - 16);
      const fy = clamp(S.op.y - (12 + (i % 2) * 24), 70, baseY - 20);
      S.temps.push({ id: nextId++, team: id, fx, fy, dmg: cfg.dmg, rate: cfg.rate, speed: cfg.speed, pierce: cfg.pierce, color: cfg.hex, acc: 0, muzzle: 0, life: spec.dur, dur: spec.dur, born: 0.35 });
      burst(fx, fy, cfg.hex, 10, 150); ring(fx, fy, cfg.hex, 70, 4);
    }
    ring(S.op.x, S.op.y, cfg.hex, 170, 6); shock(S.op.x, S.op.y, cfg.hex, 240); sfx.ability();
  }
  function abilityIR() {
    // Incident Response: contain the active breach - heavy damage to every threat,
    // restore base integrity, and absorb the next hit (a snapshot-style save).
    S.flash = 0.95; S.flashCol = '88,200,255'; S.shake = 1;
    shock(S.op.x, S.op.y, '#9fe8ff', Math.max(W, H));
    ring(S.op.x, baseY - 2, '#58c8ff', fieldW * 1.1, 9);
    for (const e of [...S.enemies]) {
      if (e.dead) continue;
      const dmg = Math.max(e.maxhp * 0.6, 150);
      e.hp -= dmg; e.hit = 1; dmgText(e.x, e.y - e.r, dmg, '#9fe8ff', true);
      burst(e.x, e.y, '#58c8ff', 9, 170); zap(S.op.x, S.op.y - 16, e.x, e.y, '#bfefff');
      if (e.hp <= 0) killEnemy(e, true);
    }
    S.base = Math.min(S.baseMax, S.base + 160);
    S.shield = Math.min((S.squad.shieldMax || 0) + 1, S.shield + 1);
    onToast('irOn', 'good'); sfx.ability();
  }

  // ---- base damage ----
  function hitBase(amount, color) {
    if (S.shield > 0) { S.shield--; S.flash = 0.6; S.flashCol = '169,139,255'; ring(S.op.x, baseY - 2, ACCENT.ASTOR, 120, 6); onToast('absorb', 'good'); sfx.ability(); return; }
    S.base = Math.max(0, S.base - amount);
    S.combo = 0; S.shake = Math.min(1, 0.5 + amount / 350); S.flash = 0.7; S.flashCol = color || '255,90,106'; sfx.breach();
    if (S.base <= 0) gameOver();
  }

  // ---- sim ----
  function update(dt) {
    S.elapsed += dt;
    const d = difficultyAt(S.elapsed), sq = S.squad, op = S.op;
    const mv = 380 * dt;
    if (keys.has('left')) op.x -= mv; if (keys.has('right')) op.x += mv;
    if (keys.has('up')) op.y -= mv; if (keys.has('down')) op.y += mv;
    if (drag.on) { op.x += (drag.x - op.x) * Math.min(1, dt * 16); op.y += (drag.y - op.y) * Math.min(1, dt * 16); }
    op.x = clamp(op.x, opMinX(), opMaxX()); op.y = clamp(op.y, opMinY(), opMaxY());
    op.muzzle = Math.max(0, op.muzzle - dt * 6);

    // active-skill cooldowns + summoned-team duration timers (drive the HUD glow)
    for (const k in S.cd) if (S.cd[k] > 0) S.cd[k] = Math.max(0, S.cd[k] - dt);
    if (S.ptT > 0) S.ptT = Math.max(0, S.ptT - dt);
    if (S.rtT > 0) S.rtT = Math.max(0, S.rtT - dt);

    S.spawnAcc += dt * 1000;
    if (S.spawnAcc >= d.spawnGap) { S.spawnAcc = 0; const pool = threatPool(S.elapsed); for (let i = 0; i < d.batch; i++) spawnEnemy(pool[Math.floor(Math.random() * pool.length)]); }
    if (S.elapsed - S.lastBoss > d.bossEvery) { S.lastBoss = S.elapsed; spawnBoss(); }

    for (const sh of S.shooters) {
      sh.acc += dt * 1000; const interval = 1000 / (sh.rate * sq.fireRateMul);
      while (sh.acc >= interval) { sh.acc -= interval; const x = unitX(sh), uy = unitY(sh); fireUp(x, uy - 16, sh.dmg, sh.speed, sh.pierce, sh.kind === 'op' ? dominantColor() : ACCENT[sh.kind === 'edr' ? 'EDR' : 'MDR']); if (sh.kind === 'op') op.muzzle = 1; sh.muzzle = 1; }
      if (sh.muzzle) sh.muzzle = Math.max(0, sh.muzzle - dt * 6);
    }
    // summoned service teams hold their fixed spot and fire straight up until they withdraw
    for (const u of S.temps) {
      if (u.born > 0) u.born = Math.max(0, u.born - dt);
      u.life -= dt; if (u.life <= 0) { u.dead = true; continue; }
      u.acc += dt * 1000; const interval = 1000 / (u.rate * sq.fireRateMul);
      while (u.acc >= interval) { u.acc -= interval; fireUp(u.fx, u.fy - 16, u.dmg, u.speed, u.pierce, u.color); u.muzzle = 1; }
      if (u.muzzle) u.muzzle = Math.max(0, u.muzzle - dt * 6);
    }
    if (sq.beamOn) { S.beamAcc += dt * 1000; if (S.beamAcc >= sq.beamEvery) { S.beamAcc = 0; fireBeam(); } }
    if (sq.shieldEvery) { S.shieldAcc += dt * 1000; if (S.shieldAcc >= sq.shieldEvery) { S.shieldAcc = 0; S.shield = Math.min(sq.shieldMax, S.shield + 1); } }
    if (sq.regen) S.base = Math.min(S.baseMax, S.base + sq.regen * dt);

    const barY = op.y - BAR_OFFSET, halfW = sq.afHalfWidth;
    if (sq.afTier > 0) { if (S.afDown) { S.afDownT -= dt; if (S.afDownT <= 0) { S.afDown = false; S.afHp = S.afMax * 0.5; } } else { S.afHp = Math.min(S.afMax, S.afHp + S.afMax * 0.08 * dt); } }
    const barActive = sq.afTier > 0 && !S.afDown;
    const afChip = 9 + sq.afTier * 5;

    for (const e of S.enemies) {
      if (e.dead) continue;
      if (sq.ndrReveal) e.marked = true;
      // boss abilities: controllers/siege engines keep spawning minions as they advance
      if (e.spec.spawn && e.y > 0) {
        e.spawnAcc += dt;
        if (e.spawnAcc >= e.spec.spawnEvery) {
          e.spawnAcc = 0; const m = ENEMIES[e.spec.spawn];
          for (let k = 0; k < (e.spec.spawnCount || 1); k++) S.enemies.push({ id: nextId++, type: e.spec.spawn, spec: m, x: clamp(e.x + rand(-30, 30), fieldL + m.r, fieldR - m.r), y: e.y + e.r * 0.5, r: m.r, hp: m.hp, maxhp: m.hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false, spawnAcc: 0 });
          ring(e.x, e.y, e.spec.color, e.r * 1.5, 4); burst(e.x, e.y + e.r * 0.4, e.spec.color, 8, 130);
        }
      }
      let slowK = e.slow > 0 ? 0.5 : 1; if (e.slow > 0) e.slow -= dt * 1000;
      if (sq.iagBand && e.y > bandY - 24 && e.y < bandY + 24) slowK *= sq.iagSlowMul;
      e.wob += dt * 3;
      const sp = e.spec.speed * d.speedMul * slowK;
      const nextY = e.y + sp * dt;
      const juke = e.spec.juke || 1;   // zero-day wraith strafes hard to dodge your fire
      const dx = op.x - e.x; e.x = clamp(e.x + clamp(dx * 0.15, -18, 18) * dt + Math.cos(e.wob) * 6 * juke * dt, fieldL + e.r, fieldR - e.r);
      e.hit = Math.max(0, e.hit - dt * 4);
      const underBar = Math.abs(e.x - op.x) <= halfW + e.r;
      if (barActive && underBar && nextY + e.r >= barY && e.y + e.r < barY + 4) {
        e.y = barY - e.r; e.held = true;
        S.afHp -= e.spec.dmg * dt * 0.7; e.hp -= afChip * dt;
        if (Math.random() < dt * 6) burst(e.x, barY, ACCENT.AF, 2, 50);
        if (S.afHp <= 0) { S.afDown = true; S.afDownT = 3.2 + sq.afTier * 0.3; ring(op.x, barY, ACCENT.AF, halfW * 2, 6); onToast('afDown', 'bad'); }
        if (e.hp <= 0) killEnemy(e, false);
        continue;
      }
      e.held = false;
      if (sq.afTier > 0 && underBar && !e.afWeakened && e.y + e.r < barY && nextY + e.r >= barY) { e.hp *= (1 - sq.afWeaken); e.slow = 1400; e.afWeakened = true; burst(e.x, barY, ACCENT.AF, 6, 90); dmgText(e.x, barY, (e.maxhp * sq.afWeaken), ACCENT.AF, false); }
      e.y = nextY;
      if (e.y + e.r >= baseY) {
        e.dead = true;
        if (e.spec.steals) { S.score = Math.max(0, S.score - STEAL_PENALTY); S.combo = 0; onToast('exfil', 'bad'); S.flash = 0.5; S.flashCol = '255,209,102'; burst(e.x, baseY, e.spec.color, 18); }
        else hitBase(e.spec.dmg, e.spec.boss ? '255,90,106' : null);
      }
    }

    if (S.beam) {
      const b = S.beam; b.life -= dt * 2.2;
      for (const e of S.enemies) { if (e.dead) continue; if (Math.abs(e.x - b.x) < b.width / 2 + e.r) { dealDamage(e, b.dmg * dt * 1.2); if (Math.random() < 0.08) dmgText(e.x, e.y - e.r, b.dmg, ACCENT.XDR, true); if (Math.random() < 0.5) burst(e.x, e.y, ACCENT.XDR, 3, 70); if (Math.random() < 0.18) shock(e.x, e.y, '#eaffc0', e.r * 3.2); if (e.hp <= 0) killEnemy(e, true); } }
      if (b.life <= 0) S.beam = null;
    }

    for (const p of S.shots) {
      if (p.dead) continue;
      p.y += p.vy * dt;
      if (p.y < -20) { p.dead = true; continue; }
      for (const e of S.enemies) {
        if (e.dead || p.hit.has(e.id)) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= (e.r + p.r) ** 2) {
          p.hit.add(e.id); hitEnemy(e, p.dmg, p.color, false); burst(p.x, p.y, p.color, 4, 70);
          if (e.hp <= 0) { killEnemy(e, false); if (e.spec.boss) shock(e.x, e.y, p.color, 180); }
          else if (p.dmg >= 36) shock(p.x, p.y, p.color, 20);
          if (p.pierce-- <= 0) { p.dead = true; break; }
        }
      }
    }

    for (const pt of S.parts) { pt.life -= dt * 1.7; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy = pt.vy * 0.94 + 40 * dt; }
    for (const tx of S.texts) { tx.life -= dt * 1.3; tx.y += tx.vy * dt; tx.x += tx.vx * dt; tx.vy *= 0.92; }
    for (const f of S.fxr) { f.life -= dt * (f.t === 'zap' ? 5 : 2.6); if (f.r !== undefined && f.max) f.r += (f.max - f.r) * Math.min(1, dt * 9); }
    S.radarAng += dt * 2.4;
    S.enemies = S.enemies.filter(e => !e.dead); S.shots = S.shots.filter(p => !p.dead); S.temps = S.temps.filter(u => !u.dead);
    S.parts = S.parts.filter(p => p.life > 0); S.texts = S.texts.filter(t => t.life > 0); S.fxr = S.fxr.filter(f => f.life > 0);
    S.shake = Math.max(0, S.shake - dt * 2.4); S.flash = Math.max(0, S.flash - dt * 2.2);
    S.score += SURVIVE_PER_SEC * dt;
    S.hudAcc += dt; if (S.hudAcc >= 0.1) { S.hudAcc = 0; pushHud(); }
  }

  // ================= 3D RENDER =================
  function billboard(obj) { obj.quaternion.copy(camera.quaternion); }
  function makeBadge(id, size) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0xaeb8c6 }));
    g.add(plate);
    if (markTex[id]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.82, size * 0.82), new THREE.MeshBasicMaterial({ map: markTex[id], transparent: true })); m.position.z = 0.02; g.add(m); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.62, size * 0.72, 24), new THREE.MeshBasicMaterial({ color: ACC[id] ?? 0x72bb38, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); ring.position.z = -0.01; g.add(ring);
    g.userData.badge = true; return g;
  }
  const std = (color, emissive, ei = 0.5, rough = 0.45, metal = 0.6) => new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: ei, roughness: rough, metalness: metal });

  function buildOperator() {
    const g = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.6), std(0x1c2436, 0x000000, 0, 0.8, 0.3)); legs.position.y = 0.35; legs.castShadow = true; g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.05, 0.62), std(0x334766, 0x0a1830, 0.25)); torso.position.y = 1.2; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), std(0xdcc39a, 0x000000, 0, 0.7, 0)); head.position.y = 1.95; head.castShadow = true; g.add(head);
    const col = hexNum(dominantColor());
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.1), std(col, col, 1.4, 0.3, 0.2)); visor.position.set(0, 1.98, 0.3); g.add(visor);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.15), std(col, col, 1.1, 0.4, 0.5)); gun.position.set(0.28, 1.35, 0.5); g.add(gun);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.set(0.28, 1.35, 1.15); flash.visible = false; g.add(flash);
    const dom = dominant(); if (dom) { const b = makeBadge(dom, 0.95); b.position.set(0, 1.2, -0.34); g.add(b); g.userData.badge = b; }
    const tag = makeTag('op'); tag.position.set(0, 2.62, 0); g.add(tag); g.userData.tag = tag;
    g.userData.flash = flash; return g;
  }
  function buildTurret() {
    const g = new THREE.Group();
    const col = ACC.EDR;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.55, 16), std(0x2c3650, 0x05070e, 0.1, 0.5, 0.7)); ped.position.y = 0.28; ped.castShadow = true; g.add(ped);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), std(col, col, 0.4, 0.4, 0.5)); dome.position.y = 0.85; dome.castShadow = true; g.add(dome);
    for (const s of [-1, 1]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.95), std(col, col, 1.2, 0.4, 0.5)); bar.position.set(s * 0.2, 0.95, 0.5); g.add(bar); }
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.set(0, 0.95, 1.05); flash.visible = false; g.add(flash);
    const b = makeBadge('EDR', 0.92); b.position.set(0, 1.62, 0); g.add(b); g.userData.badge = b; g.userData.flash = flash;
    const tag = makeTag('EDR'); tag.position.set(0, 2.35, 0); g.add(tag); g.userData.tag = tag;
    return g;
  }
  function buildAlly() {
    const g = new THREE.Group();
    const col = ACC.MDR;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.55), std(0x1f5a40, 0x08221a, 0.3)); torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), std(0xe7c9a0, 0x000000, 0, 0.7, 0)); head.position.y = 1.7; head.castShadow = true; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.1), std(col, col, 1.3, 0.3, 0.2)); visor.position.set(0, 1.73, 0.26); g.add(visor);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.0), std(col, col, 1.1, 0.4, 0.5)); gun.position.set(0.26, 1.2, 0.45); g.add(gun);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.set(0.26, 1.2, 1.05); flash.visible = false; g.add(flash);
    const b = makeBadge('MDR', 0.88); b.position.set(0, 1.1, -0.3); g.add(b); g.userData.badge = b; g.userData.flash = flash;
    const tag = makeTag('MDR'); tag.position.set(0, 2.3, 0); g.add(tag); g.userData.tag = tag;
    return g;
  }
  function buildOperative(team) {
    const cfg = TEAM[team], g = new THREE.Group(), col = cfg.col;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.5), std(0x141a28, col, 0.35, 0.6, 0.3)); torso.position.y = 1.0; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), std(0xe7c9a0, 0x000000, 0, 0.7, 0)); head.position.y = 1.6; head.castShadow = true; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.1), std(col, col, 1.4, 0.3, 0.2)); visor.position.set(0, 1.62, 0.23); g.add(visor);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.92), std(col, col, 1.2, 0.4, 0.5)); gun.position.set(0.24, 1.12, 0.42); g.add(gun);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flash.position.set(0.24, 1.12, 0.98); flash.visible = false; g.add(flash);
    const aura = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); aura.position.y = 0.03; g.add(aura);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.58), new THREE.MeshBasicMaterial({ map: tagTex(cfg.label, cfg.hex), transparent: true, depthWrite: false, depthTest: false })); tag.position.set(0, 2.05, 0); tag.renderOrder = 6; g.add(tag);
    g.userData = { flash, tag };
    return g;
  }
  function buildRadar() {
    const g = new THREE.Group(); const col = ACC.NDR;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5, 14), std(0x223246, 0x05070e, 0.1, 0.6, 0.6)); base2.position.y = 0.25; base2.castShadow = true; g.add(base2);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12, 0, TAU, 0, Math.PI / 2), std(col, col, 0.5, 0.4, 0.4)); dish.scale.set(1, 0.4, 1); dish.position.y = 0.85; dish.rotation.x = -0.5; g.add(dish);
    const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: col })); sweep.position.set(0, 0.9, 0); g.add(sweep); radarSweep = sweep;
    const b = makeBadge('NDR', 0.84); b.position.set(0, 1.5, 0); g.add(b); g.userData.badge = b;
    const tag = makeTag('NDR'); tag.position.set(0, 2.15, 0); g.add(tag); g.userData.tag = tag;
    return g;
  }
  function buildCore() {
    const g = new THREE.Group(); const col = ACC.HCI;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 20), std(0x12324a, col, 0.6, 0.3, 0.6)); body.position.y = 0.45; body.castShadow = true; g.add(body);
    for (let i = 0; i < 3; i++) { const ringm = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: col })); ringm.rotation.x = Math.PI / 2; ringm.position.y = 0.3 + i * 0.22; g.add(ringm); }
    const b = makeBadge('HCI', 0.8); b.position.set(0, 1.25, 0); g.add(b); g.userData.badge = b;
    const tag = makeTag('HCI'); tag.position.set(0, 1.95, 0); g.add(tag); g.userData.tag = tag;
    return g;
  }

  function rebuildUnits() {
    unitsDirty = false;
    while (unitsGroup.children.length) { const c = unitsGroup.children.pop(); disposeTree(c); }
    opMesh = null; allyMesh = null; coreObj = null; radarObj = null; radarSweep = null;
    if ((S.levels.HCI || 0) > 0) { coreObj = buildCore(); unitsGroup.add(coreObj); }
    if ((S.levels.NDR || 0) > 0) { radarObj = buildRadar(); unitsGroup.add(radarObj); }
    for (const sh of S.shooters) {
      if (sh.kind === 'op') { opMesh = buildOperator(); sh._mesh = opMesh; unitsGroup.add(opMesh); }
      else if (sh.kind === 'edr') { const t = buildTurret(); sh._mesh = t; unitsGroup.add(t); }
      else if (sh.kind === 'mdr') { allyMesh = buildAlly(); sh._mesh = allyMesh; unitsGroup.add(allyMesh); }
    }
    // barrier + band created lazily, toggled in sync
    if (!barrierObj) barrierObj = buildBarrier();
    if (!bandObj) bandObj = buildBand();
    if (!beamObj) beamObj = buildBeam();
    if (!shieldObj) shieldObj = buildShield();
  }

  function buildBarrier() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.2), new THREE.MeshBasicMaterial({ color: ACC.AF, transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    wall.position.y = 1.1; g.add(wall); g.userData.wall = wall;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x90ffbe })); top.position.y = 2.2; g.add(top); g.userData.top = top;
    const posts = []; for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.3, 10), std(0x1d4a38, ACC.AF, 0.4)); p.position.y = 1.15; const bd = makeBadge('AF', 0.62); bd.position.y = 1.4; const grp = new THREE.Group(); grp.add(p); grp.add(bd); g.add(grp); posts.push({ grp, side: s }); }
    g.userData.posts = posts; g.visible = false; scene.add(g); return g;
  }
  function buildBand() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(laneW, 2.6), new THREE.MeshBasicMaterial({ color: ACC.IAG, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.visible = false; scene.add(m); return m;
  }
  function buildBeam() {
    const g = new THREE.Group();
    const mk = (h, col, op) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, h, LEN + 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(m); return m; };
    const halo = mk(5.6, 0x7bff4a, 0.16);     // wide soft green halo
    const mid = mk(3.0, 0xbaff78, 0.4);       // inner green glow
    const core = mk(1.2, 0xffffff, 0.85);     // hot white core
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(muzzle);
    g.userData = { halo, mid, core, muzzle }; g.visible = false; scene.add(g); return g;
  }
  function buildShield() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: ACC.ASTOR, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; scene.add(m); return m;
  }

  function enemyGeo(e) {
    const r = wR(e.r);
    if (e.type === 'malware' || e.type === 'worm' || e.spec.boss) return new THREE.IcosahedronGeometry(r, 0);
    return new THREE.SphereGeometry(r, 18, 14);
  }
  function makeEnemyMesh(e) {
    const col = hexNum(e.spec.color), r = wR(e.r);
    const body = new THREE.Mesh(enemyGeo(e), std(col, col, 0.45, 0.35, 0.2)); body.castShadow = true;
    const glow = new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.45);
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 10, 8), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    const gs = r * (e.spec.boss ? 1.5 : 1.75);
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(gs, gs), new THREE.MeshBasicMaterial({ map: threatTex(e.type), transparent: true, depthWrite: false, depthTest: false }));
    glyph.renderOrder = 3;
    const g = new THREE.Group(); g.add(body); g.add(core); g.add(glyph);
    let shell = null, orbit = null, nodes = null;
    if (e.spec.boss) {
      // every boss wears a menacing plasma aura
      const aura = new THREE.Mesh(new THREE.SphereGeometry(r * 1.12, 16, 12), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
      g.add(aura);
      if (e.spec.mega) {                      // APT siege engine: caged armored core
        shell = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 1.32, 1), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.8, wireframe: true }));
        orbit = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * 0.09, 10, 36), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); orbit.rotation.x = Math.PI / 2.4;
        g.add(shell); g.add(orbit);
      } else if (e.spec.spawn) {              // botnet controller: a swarm of orbiting bot nodes
        nodes = new THREE.Group();
        for (let i = 0; i < 6; i++) { const nd = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 6), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); const a = (i / 6) * TAU; nd.position.set(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.5, Math.sin(a) * r * 1.5); nodes.add(nd); }
        g.add(nodes);
      }
    }
    enemyGroup.add(g);
    return { group: g, body, core, glyph, shell, orbit, nodes, bodyMat: body.material, baseEmissive: e.spec.boss ? 0.6 : 0.45 };
  }
  function makeBullet() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
    m.scale.set(1, 1, 2.6); m.visible = false; bulletGroup.add(m); return m;
  }

  function syncScene(dt) {
    if (unitsDirty) rebuildUnits();
    const sq = S.squad, op = S.op, t = S.elapsed;
    // movers + muzzle + badge billboarding
    for (const sh of S.shooters) {
      const m = sh._mesh; if (!m) continue;
      m.position.set(wX(unitX(sh)), 0, wZ(unitY(sh)));
      if (m.userData.flash) { const f = m.userData.flash; f.visible = sh.muzzle > 0.05; if (f.visible) { f.scale.setScalar(0.5 + sh.muzzle * 0.7); f.material.opacity = sh.muzzle * 0.85; } }
      if (m.userData.badge) billboard(m.userData.badge);
      if (m.userData.tag) billboard(m.userData.tag);
    }
    // summoned service teams (red team / pen test) - pop in, fire, withdraw
    const seenT = new Set();
    for (const u of S.temps) {
      seenT.add(u.id);
      let tm = tempMeshes.get(u.id); if (!tm) { tm = buildOperative(u.team); tempsGroup.add(tm); tempMeshes.set(u.id, tm); }
      const appear = u.born > 0 ? 1 - u.born / 0.35 : (u.life < 0.6 ? Math.max(0.12, u.life / 0.6) : 1);
      tm.position.set(wX(u.fx), 0, wZ(u.fy)); tm.scale.setScalar(0.82 * clamp(appear, 0.05, 1));
      if (tm.userData.flash) { const f = tm.userData.flash; f.visible = u.muzzle > 0.05; if (f.visible) { f.scale.setScalar(0.5 + u.muzzle * 0.6); f.material.opacity = u.muzzle * 0.85; } }
      billboard(tm.userData.tag);
    }
    for (const [id, tm] of tempMeshes) { if (!seenT.has(id)) { tempsGroup.remove(tm); disposeTree(tm); tempMeshes.delete(id); } }

    if (coreObj) { coreObj.position.set(wX(op.x), 0, wZ(op.y + 20)); coreObj.children.forEach(c => { if (c.geometry && c.geometry.type === 'TorusGeometry') c.rotation.z = t * 2; }); if (coreObj.userData.badge) billboard(coreObj.userData.badge); if (coreObj.userData.tag) billboard(coreObj.userData.tag); }
    if (radarObj) { radarObj.position.set(wX(clamp(fieldR - 34, fieldL + 30, fieldR - 30)), 0, wZ(baseY - 30)); if (radarSweep) radarSweep.rotation.y = -S.radarAng; if (radarObj.userData.badge) billboard(radarObj.userData.badge); if (radarObj.userData.tag) billboard(radarObj.userData.tag); }

    // barrier
    if (barrierObj) {
      const on = sq.afTier > 0; barrierObj.visible = on;
      if (on) {
        const barY = op.y - BAR_OFFSET, halfW = sq.afHalfWidth;
        const frac = S.afMax ? clamp(S.afHp / S.afMax, 0, 1) : 0;
        const wWorld = Math.abs(wX(op.x + halfW) - wX(op.x - halfW));
        barrierObj.position.set(wX(op.x), 0, wZ(barY));
        barrierObj.userData.wall.scale.x = wWorld; barrierObj.userData.top.scale.x = wWorld;
        barrierObj.userData.wall.material.opacity = S.afDown ? 0.12 + 0.08 * Math.sin(t * 20) : 0.3 + frac * 0.4;
        barrierObj.userData.posts.forEach(p => { p.grp.position.x = p.side * wWorld / 2; billboard(p.grp.children[1]); });
      }
    }
    // band
    if (bandObj) { bandObj.visible = sq.iagBand; if (sq.iagBand) bandObj.position.set(0, 0.04, wZ(bandY)); }
    // beam (the XDR correlation lance - layered electric column)
    if (beamObj) {
      if (S.beam) {
        const b = S.beam, life = Math.max(0, b.life), ud = beamObj.userData;
        const w = Math.max(0.5, Math.abs(wX(op.x + b.width / 2) - wX(op.x - b.width / 2)));
        const flick = 0.82 + 0.18 * Math.sin(t * 55);
        beamObj.visible = true; beamObj.position.set(wX(b.x), 1.75, wZ(op.y) + LEN / 2);
        ud.halo.scale.set(w * (1.6 + 0.3 * Math.sin(t * 7)), 1, 1); ud.halo.material.opacity = (0.1 + 0.12 * life) * flick;
        ud.mid.scale.set(w, 1, 1); ud.mid.material.opacity = (0.3 + 0.25 * life) * flick;
        ud.core.scale.set(Math.max(0.35, w * 0.45), 1, 1); ud.core.material.opacity = (0.65 + 0.3 * life) * flick;
        ud.muzzle.position.set(0, 0, -(LEN + 12) / 2 + 0.5); ud.muzzle.scale.setScalar((1 + 0.7 * life) * flick); ud.muzzle.material.opacity = 0.8 * life + 0.2;
      } else beamObj.visible = false;
    }
    // shield
    if (shieldObj) { shieldObj.visible = S.shield > 0; if (S.shield > 0) shieldObj.position.set(wX(op.x), 0.1, wZ(op.y)); }

    // enemies
    const seen = new Set();
    for (const e of S.enemies) {
      seen.add(e.id);
      let em = enemyMeshes.get(e.id); if (!em) { em = makeEnemyMesh(e); enemyMeshes.set(e.id, em); }
      const r = wR(e.r);
      em.group.position.set(wX(e.x), r + 0.35, wZ(e.y));
      em.body.rotation.y = e.wob * 0.6; em.body.rotation.x = e.wob * 0.3;
      const cloaked = e.spec.cloak && !revealed();
      em.body.material.opacity = cloaked ? 0.4 : 1; em.body.material.transparent = cloaked;
      em.body.material.emissiveIntensity = e.hit > 0 ? 1.5 : em.baseEmissive;
      if (e.hit > 0) em.body.material.emissive.setHex(0xffffff); else em.body.material.emissive.setHex(hexNum(e.spec.color));
      const pulse = 0.6 + 0.4 * Math.sin(t * 6 + e.wob); em.core.material.opacity = (cloaked ? 0.2 : 0.5) * pulse; em.core.scale.setScalar(0.7 + pulse * 0.2);
      if (em.shell) { em.shell.rotation.y = t * 0.8; em.shell.rotation.x = t * 0.5; em.orbit.rotation.z = t * 1.7; }
      if (em.nodes) em.nodes.rotation.y = t * 1.6;
      billboard(em.glyph); em.glyph.position.set(0, 0, -r * 0.7); em.glyph.material.opacity = cloaked ? 0.3 : (e.marked ? 1 : 0.92);
    }
    for (const [id, em] of enemyMeshes) { if (!seen.has(id)) { enemyGroup.remove(em.group); disposeTree(em.group); enemyMeshes.delete(id); } }

    // bullets
    for (let i = 0; i < S.shots.length; i++) {
      let m = bulletPool[i]; if (!m) { m = makeBullet(); bulletPool[i] = m; }
      const p = S.shots[i]; m.visible = true; m.position.set(wX(p.x), 0.9, wZ(p.y));
      const c = hexNum(p.color); m.material.color.setHex(c);
    }
    for (let i = S.shots.length; i < bulletPool.length; i++) bulletPool[i].visible = false;
  }

  // ---- 2D overlay FX ----
  const _v = new THREE.Vector3();
  function proj(gx, gy, hy) { _v.set(wX(gx), hy, wZ(gy)); _v.project(camera); return { x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H, vis: _v.z < 1, s: clamp(2.1 - (wZ(gy) / LEN) * 1.5, 0.35, 2.1) }; }
  function drawFx() {
    fctx.clearRect(0, 0, W, H);
    // enemy hp bars + mark ticks
    for (const e of S.enemies) {
      if (e.hp >= e.maxhp && !e.spec.boss) continue;
      const cloaked = e.spec.cloak && !S.squad.ndrReveal; if (cloaked) continue;
      const p = proj(e.x, e.y - e.r, wR(e.r) * 2 + 0.4); if (!p.vis) continue;
      const w = Math.max(14, 34 * p.s), hpx = p.x - w / 2, hpy = p.y;
      fctx.fillStyle = 'rgba(0,0,0,.55)'; fctx.fillRect(hpx, hpy, w, 4 * p.s);
      fctx.fillStyle = e.spec.boss ? '#ff5a6a' : '#2ee6a0'; fctx.fillRect(hpx, hpy, w * clamp(e.hp / e.maxhp, 0, 1), 4 * p.s);
    }
    // rings + zaps
    fctx.globalCompositeOperation = 'lighter';
    if (S.beam) drawBeam(S.beam);
    for (const f of S.fxr) {
      const a = Math.max(0, f.life);
      if (f.t === 'ring') { const p = proj(f.x, f.y, 0.3); fctx.strokeStyle = rgba(f.color, a); fctx.lineWidth = Math.max(1, f.w * p.s); fctx.beginPath(); fctx.ellipse(p.x, p.y, Math.max(0, f.r * p.s * 0.5), Math.max(0, f.r * p.s * 0.28), 0, 0, TAU); fctx.stroke(); }
      else if (f.t === 'zap') {
        const a1 = proj(f.x1, f.y1, 0.8), a2 = proj(f.x2, f.y2, 0.8), seg = 7, pts = [];
        for (let i = 0; i <= seg; i++) { const tt = i / seg, edge = i === 0 || i === seg; pts.push({ x: a1.x + (a2.x - a1.x) * tt + (edge ? 0 : rand(-8, 8)), y: a1.y + (a2.y - a1.y) * tt + (edge ? 0 : rand(-8, 8)) }); }
        const stroke = (col, w) => { fctx.strokeStyle = col; fctx.lineWidth = w; fctx.beginPath(); fctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) fctx.lineTo(pts[i].x, pts[i].y); fctx.stroke(); };
        stroke(rgba(f.color, a * 0.45), 5.5); stroke(rgba('#ffffff', a), 1.6);
      }
    }
    // particles
    for (const pt of S.parts) { const p = proj(pt.x, pt.y, 0.8); fctx.globalAlpha = Math.max(0, pt.life); fctx.fillStyle = pt.color; fctx.beginPath(); fctx.arc(p.x, p.y, Math.max(0.5, pt.r * p.s), 0, TAU); fctx.fill(); }
    fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
    // damage numbers
    fctx.textAlign = 'center';
    for (const tx of S.texts) { const p = proj(tx.x, tx.y, 1.4); const a = Math.max(0, Math.min(1, tx.life * 1.4)); const fs = (tx.big ? 23 : 14) * clamp(p.s, 0.6, 1.6); fctx.font = `800 ${fs}px ui-sans-serif,system-ui`; if (tx.big) { fctx.shadowColor = rgba(tx.color, a); fctx.shadowBlur = 10; } fctx.fillStyle = `rgba(0,0,0,${a * 0.6})`; fctx.fillText(tx.text, p.x + 1, p.y + 1); fctx.fillStyle = rgba(tx.color, a); fctx.fillText(tx.text, p.x, p.y); fctx.shadowBlur = 0; }
    fctx.textAlign = 'start';
    // full-screen flash
    if (S.flash > 0) { fctx.fillStyle = `rgba(${S.flashCol},${S.flash * 0.26})`; fctx.fillRect(0, 0, W, H); }
    // summoned-team auras: a red-team rally ring, a pen-test amber tint
    if (S.rtT > 0) { const p = proj(S.op.x, S.op.y, 0.35); const rr = (30 + 7 * Math.sin(S.elapsed * 13)) * p.s; fctx.globalCompositeOperation = 'lighter'; fctx.strokeStyle = rgba('#ff5a6a', 0.45 + 0.3 * Math.sin(S.elapsed * 13)); fctx.lineWidth = 3; fctx.beginPath(); fctx.ellipse(p.x, p.y, rr, rr * 0.5, 0, 0, TAU); fctx.stroke(); fctx.globalCompositeOperation = 'source-over'; }
    if (S.ptT > 0) { fctx.fillStyle = `rgba(255,209,102,${0.04 + 0.025 * Math.sin(S.elapsed * 8)})`; fctx.fillRect(0, 0, W, H); }
  }
  function rgba(hex, a) { const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`; }
  // XDR correlation lance: a flickering electric column drawn in screen space
  function drawBeam(b) {
    const a = Math.max(0, b.life);
    const p0 = proj(b.x, baseY - 8, 1.2), p1 = proj(b.x, -80, 1.2);
    const midx = (p0.x + p1.x) / 2, bw = Math.max(14, 30 * p0.s);
    const grad = fctx.createLinearGradient(midx, p1.y, midx, p0.y);
    grad.addColorStop(0, rgba('#9be85a', 0)); grad.addColorStop(0.5, rgba('#bfff7a', 0.18 * a + 0.12)); grad.addColorStop(1, rgba('#eaffc0', 0.28 * a + 0.16));
    fctx.fillStyle = grad; fctx.fillRect(midx - bw, p1.y, bw * 2, p0.y - p1.y);
    for (let k = 0; k < 3; k++) {
      const amp = (k === 0 ? 4 : 15) * p0.s;
      fctx.strokeStyle = rgba(k === 0 ? '#ffffff' : '#c8ff8a', (k === 0 ? 0.95 : 0.55) * (0.6 + 0.4 * Math.random()));
      fctx.lineWidth = k === 0 ? 4.5 : 2.2; fctx.beginPath();
      const seg = 16;
      for (let i = 0; i <= seg; i++) { const tt = i / seg, edge = i === 0 || i === seg; const x = p0.x + (p1.x - p0.x) * tt + (edge ? 0 : rand(-amp, amp)); const y = p0.y + (p1.y - p0.y) * tt; i === 0 ? fctx.moveTo(x, y) : fctx.lineTo(x, y); }
      fctx.stroke();
    }
    fctx.strokeStyle = rgba('#eaffc0', a); fctx.lineWidth = 3; fctx.beginPath(); fctx.ellipse(p0.x, p0.y, bw * 1.7, bw * 0.75, 0, 0, TAU); fctx.stroke();
  }

  function render() {
    if (S.shake > 0) camera.position.set(CAM_BASE.x + rand(-1, 1) * S.shake * 0.5, CAM_BASE.y + rand(-1, 1) * S.shake * 0.4, CAM_BASE.z);
    else camera.position.copy(CAM_BASE);
    composer.render();
    drawFx();
  }

  function disposeTree(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) { const m = Array.isArray(n.material) ? n.material : [n.material]; m.forEach(x => x.dispose()); } }); }

  // ---- floor texture (grid + columns) ----
  function makeFloorTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 1024); grd.addColorStop(0, '#0a0d16'); grd.addColorStop(1, '#161d2b'); g.fillStyle = grd; g.fillRect(0, 0, 256, 1024);
    g.strokeStyle = 'rgba(120,150,190,.12)'; g.lineWidth = 1;
    for (let i = 0; i <= 7; i++) { const x = i / 7 * 256; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
    for (let i = 0; i <= 40; i++) { const y = i / 40 * 1024; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }

  // ---- threat glyphs: each enemy wears a recognizable cyber-threat icon ----
  const threatTexCache = {};
  function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function threatTex(type) {
    if (threatTexCache[type]) return threatTexCache[type];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.translate(64, 64); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    if (type === 'recon') {            // scanning probe: eye + crosshair
      g.beginPath(); g.ellipse(0, 0, 40, 26, 0, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
    } else if (type === 'malware') {   // bug
      g.beginPath(); g.ellipse(0, 4, 20, 26, 0, 0, TAU); g.fill();
      for (const s of [-1, 1]) { for (const yy of [-10, 2, 14]) { g.beginPath(); g.moveTo(s * 18, yy); g.lineTo(s * 40, yy - 8); g.stroke(); } g.beginPath(); g.moveTo(s * 8, -22); g.lineTo(s * 22, -40); g.stroke(); }
    } else if (type === 'worm') {      // linked chain segments
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * 26, (i % 2 ? 12 : -12), 14, 0, TAU); g.stroke(); }
    } else if (type === 'apt') {       // stealth hood / mask
      g.beginPath(); g.moveTo(0, -42); g.quadraticCurveTo(38, -30, 30, 20); g.quadraticCurveTo(0, 40, -30, 20); g.quadraticCurveTo(-38, -30, 0, -42); g.stroke();
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 13, -2, 8, 5, 0, 0, TAU); g.fill(); }
    } else if (type === 'exfil') {     // data leaving: doc + out-arrow
      roundRectPath(g, -34, -26, 36, 52, 6); g.stroke();
      g.beginPath(); g.moveTo(-4, 0); g.lineTo(34, 0); g.moveTo(18, -16); g.lineTo(36, 0); g.lineTo(18, 16); g.stroke();
    } else if (type === 'ransom') {    // ransomware: padlock
      roundRectPath(g, -30, -6, 60, 46, 8); g.fill();
      g.lineWidth = 11; g.beginPath(); g.arc(0, -8, 20, Math.PI, 0); g.stroke();
      g.fillStyle = '#1a0608'; g.beginPath(); g.arc(0, 14, 7, 0, TAU); g.fill(); g.fillRect(-4, 14, 8, 16);
    } else if (type === 'botnet') {    // botnet C2: central node wired to satellite bots
      const sats = [[0, -38], [34, -14], [34, 22], [-34, -14], [-34, 22], [0, 40]];
      for (const [sx, sy] of sats) { g.beginPath(); g.moveTo(0, 0); g.lineTo(sx * 0.7, sy * 0.7); g.stroke(); }
      for (const [sx, sy] of sats) { g.beginPath(); g.arc(sx * 0.7, sy * 0.7, 7, 0, TAU); g.fill(); }
      g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
    } else if (type === 'wraith') {    // zero-day wraith: a ghost
      g.beginPath(); g.moveTo(-32, 42); g.lineTo(-32, -6); g.quadraticCurveTo(-32, -42, 0, -42); g.quadraticCurveTo(32, -42, 32, -6); g.lineTo(32, 42);
      g.lineTo(18, 30); g.lineTo(6, 42); g.lineTo(-6, 30); g.lineTo(-18, 42); g.closePath(); g.fill();
      g.fillStyle = '#140a24'; g.beginPath(); g.ellipse(-12, -8, 7, 11, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(12, -8, 7, 11, 0, 0, TAU); g.fill();
    } else if (type === 'siege') {     // APT siege engine (apex): a skull
      g.beginPath(); g.moveTo(-30, 10); g.quadraticCurveTo(-34, -40, 0, -40); g.quadraticCurveTo(34, -40, 30, 10); g.quadraticCurveTo(26, 24, 12, 24); g.lineTo(-12, 24); g.quadraticCurveTo(-26, 24, -30, 10); g.fill();
      g.fillStyle = '#1a0624'; g.beginPath(); g.ellipse(-13, -6, 9, 11, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(13, -6, 9, 11, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(0, 2); g.lineTo(-6, 16); g.lineTo(6, 16); g.closePath(); g.fill();
      g.fillStyle = '#1a0624'; for (let i = -2; i <= 2; i++) g.fillRect(i * 7 - 2, 24, 4, 10);
    }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; threatTexCache[type] = tx; return tx;
  }

  // ---- unit name tags: a crisp product code floats over each Sangfor unit ----
  const tagTexCache = {};
  const TAG_LABEL = { op: 'OPERATOR', edr: 'EDR', mdr: 'MDR', EDR: 'EDR', MDR: 'MDR', AF: 'NGAF', NDR: 'NDR', HCI: 'HCI', IAG: 'IAG', XDR: 'XDR', ASTOR: 'aStor' };
  function tagTex(text, hex) {
    const key = text + hex; if (tagTexCache[key]) return tagTexCache[key];
    const c = document.createElement('canvas'); c.width = 256; c.height = 72; const g = c.getContext('2d');
    g.fillStyle = 'rgba(6,10,18,.9)'; roundRectPath(g, 6, 6, 244, 60, 18); g.fill();
    g.lineWidth = 5; g.strokeStyle = hex; roundRectPath(g, 6, 6, 244, 60, 18); g.stroke();
    g.font = '800 40px ui-sans-serif,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText(text, 128, 38);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tagTexCache[key] = tx; return tx;
  }
  function makeTag(id) {
    const label = TAG_LABEL[id] || id; const hex = ACCENT[id] || ACCENT[(id || '').toUpperCase()] || '#72bb38';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.53), new THREE.MeshBasicMaterial({ map: tagTex(label, hex), transparent: true, depthWrite: false, depthTest: false }));
    m.renderOrder = 6; return m;
  }

  // ---- hud ----
  function pushHud() {
    const abilities = {};
    for (const id of ABILITY_ORDER) { const spec = ABILITIES[id]; abilities[id] = { cd: S.cd[id], cdMax: spec.cd, ready: S.cd[id] <= 0, active: id === 'pt' ? S.ptT > 0 : id === 'rt' ? S.rtT > 0 : false }; }
    let boss = null; for (const e of S.enemies) if (e.spec.boss && !e.dead && (!boss || e.y > boss.y)) boss = e;
    const bossHud = boss ? { type: boss.type, hp: Math.max(0, Math.round(boss.hp)), maxhp: boss.maxhp, frac: clamp(boss.hp / boss.maxhp, 0, 1), color: boss.spec.color, mega: !!boss.spec.mega } : null;
    onHud({ base: Math.round(S.base), baseMax: S.baseMax, score: S.score, best: Math.max(S.best, S.score), combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), level: S.level, xp: S.xp, xpNeed: S.xpNeed, tier: WEAPON_ORDER.reduce((a, id) => a + (S.levels[id] || 0), 0), levels: { ...S.levels }, dom: dominant(), sensors: S.squad.sensors, shield: S.shield, shieldMax: S.squad.shieldMax, corr: correlationLinks(), abilities, boss: bossHud });
  }

  // ---- lifecycle ----
  function frame(ts) { let dt = Math.min(0.05, Math.max(0, (ts - lastTS) / 1000 || 0)); lastTS = ts; if (S && S.hitStop > 0) { S.hitStop = Math.max(0, S.hitStop - dt); dt *= 0.2; } if (S.phase === 'play') update(dt); if (S) { syncScene(dt); render(); } raf = requestAnimationFrame(frame); }
  function gameOver() { if (S.phase === 'over') return; S.phase = 'over'; S.best = Math.max(S.best, S.score); sfx.over(); onOver({ score: Math.round(S.score), best: Math.round(S.best), kills: S.kills, elapsed: Math.floor(S.elapsed), maxCombo: S.maxCombo, level: S.level, levels: { ...S.levels } }); }

  // ---- input ----
  const toLocal = ev => { const r = canvas.getBoundingClientRect(); const p = ev.touches ? ev.touches[0] : ev; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  function onDown(ev) { if (S?.phase !== 'play') return; ev.preventDefault(); const p = toLocal(ev); drag.on = true; drag.x = clamp(p.x, opMinX(), opMaxX()); drag.y = clamp(p.y, opMinY(), opMaxY()); }
  function onMove(ev) { if (!drag.on) return; ev.preventDefault(); const p = toLocal(ev); drag.x = clamp(p.x, opMinX(), opMaxX()); drag.y = clamp(p.y, opMinY(), opMaxY()); }
  function onUp() { drag.on = false; }
  const KMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  function onKey(e, down) { const k = KMAP[e.key]; if (k) { if (down) keys.add(k); else keys.delete(k); e.preventDefault(); } }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  function bind() { canvas.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); canvas.addEventListener('touchstart', onDown, { passive: false }); canvas.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize); }
  function unbind() { canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); canvas.removeEventListener('touchstart', onDown); canvas.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); }

  resize(); bind();
  return {
    start(best = 0) { S = fresh(); resize(); S.best = best; S.op.x = W / 2; S.op.y = opHome; S.phase = 'play'; recompute(); rebuildUnits(); lastTS = performance.now(); sfx.start(); pushHud(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    applyUpgrade,
    useAbility,
    pause() { if (S && S.phase === 'play') S.phase = 'paused'; },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; lastTS = performance.now(); } },
    stop() { cancelAnimationFrame(raf); raf = 0; if (S) S.phase = 'idle'; },
    destroy() { cancelAnimationFrame(raf); unbind(); renderer.dispose(); fx.remove(); },
    resize,
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
  };
}
