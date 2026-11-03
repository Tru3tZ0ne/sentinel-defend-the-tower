// Last Stand — the machine. A real-time 3D base-defense shooter rendered with
// Three.js (vendored locally). Combat runs in a 2D plane, with Cyber Command
// guidance, horizontal strips and linked XDR chain lightning. The renderer maps that plane into a 3D world —
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
  START_BASE, MAX_ACTIVE_THREATS, OPERATOR, TURRET, ALLY, WEAPONS, WEAPON_ORDER, deriveSquad, damageTo,
  xpToLevel, upgradeChoices, ENEMIES, threatPool, difficultyAt,
  comboMult, killScore, SURVIVE_PER_SEC, STEAL_PENALTY, ABILITIES, ABILITY_ORDER,
  bossFor, bossHpScale,
  MISSION_SECONDS, BOSS_TIMES, UPGRADE_SECONDS, STARTER_LEVELS, openingChoices, integrityScore, recommendedUpgrade, cloudRates, campaignScores,
} from './model.js?campaign=cc-guidance-v1';
import { createCollisionIndex, compactLive } from './combat-runtime.js?perf=active-v1';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { sfx } from '../rush/audio.js';
import { createBulletInstances, createEnemyInstances, createEnergyInstances } from './instances.js?campaign=cc-guidance-v1';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

export const ACCENT = {
  EDR: '#ff8a5a', MDR: '#16ca78', AF: '#2ee6a0', NDR: '#58c8ff',
  IAG: '#ffd166', HCI: '#39c0ff', XDR: '#9be85a', ASTOR: '#a98bff', AI: '#c09aff', AGENT: '#6ce5d7',
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
  const sculpted = !!opts.artFactory;                // uses the Sangfor equipment/creature models
  const atmosphere = !!opts.atmosphere;              // cinematic stage: env sky, bloom, vignette, dramatic camera
  const showcase = sculpted && !atmosphere;          // the bloom-less equipment PREVIEW (kept byte-for-byte)
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
  for (const id of WEAPON_ORDER) { const m = PRODUCT_MARKS[id === 'AI' ? 'AICP' : id]; if (m) { const tx = texLoader.load('assets/brand/products/sangfor-' + m[0]); tx.colorSpace = THREE.SRGBColorSpace; markTex[id] = tx; } }
  const brandTex = texLoader.load('assets/brand/sangfor-logo-white.png'); brandTex.colorSpace = THREE.SRGBColorSpace;

  // ---- renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = showcase ? 1.18 : atmosphere ? 1.28 : 1.22;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(showcase ? 0x14232b : 0x070b14);
  scene.fog = new THREE.Fog(showcase ? 0x14232b : 0x0a1526, LEN * (showcase ? 1.1 : .82), LEN * (showcase ? 1.8 : 1.72));
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  const CAM_BASE = new THREE.Vector3(0, showcase ? 27 : 12.5, showcase ? -10 : -12.5);
  const CAM_LOOK = new THREE.Vector3(0, showcase ? 0 : 2.1, showcase ? 13 : 15);
  camera.position.copy(CAM_BASE); camera.lookAt(CAM_LOOK);

  // lights — showcase keeps the bright, bloom-less product lighting; every other
  // mode uses a cinematic warm key + cool rim + fill, with an env-map sky.
  const hemi = new THREE.HemisphereLight(showcase ? 0xb9d5e6 : 0x9fc0ff, showcase ? 0x26352d : 0x0a0e18, showcase ? 2.1 : atmosphere ? .95 : .55); scene.add(hemi);
  const key = new THREE.DirectionalLight(showcase ? 0xffffff : 0xfff0dc, showcase ? 3.2 : atmosphere ? 2.4 : 1.65); key.position.set(-8, 20, 2); key.castShadow = true;
  key.shadow.mapSize.set(showcase ? 1024 : 2048, showcase ? 1024 : 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 10; key.shadow.camera.bottom = -40;
  key.shadow.bias = showcase ? -0.0008 : -0.0006; if (!showcase) { key.shadow.radius = 3; key.shadow.normalBias = 0.02; }
  scene.add(key); scene.add(key.target); key.target.position.set(0, 0, 16);
  const rim = new THREE.DirectionalLight(showcase ? 0x66ff9e : 0x6fd0ff, showcase ? 0.4 : 0.95); rim.position.set(6, showcase ? 6 : 7, showcase ? 24 : 30); scene.add(rim);
  if (!showcase) { const fill = new THREE.DirectionalLight(0xbcd0ff, 0.3); fill.position.set(0, 9, -16); scene.add(fill); }
  // procedural environment map doubling as a graded sky backdrop — lights the
  // metallic chassis/barrels and forms depth behind the lane (offline, no HDRI).
  // Graded sky backdrop for every cinematic mode. The equipment factory installs
  // its own studio env for reflections (combined), so only pure-legacy needs ours.
  if (!showcase) { const envEq = makeEnvTex(); scene.background = envEq; if (!sculpted) { const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromEquirectangular(envEq).texture; } }

  // bloom for the premium glow (bullets, arc, barrier, product accents).
  // The equipment PREVIEW stays a single sharp pass with no full-screen bloom.
  const composer = showcase ? null : new EffectComposer(renderer);
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), atmosphere ? .55 : .6, atmosphere ? .6 : .55, atmosphere ? .72 : .78));
    composer.addPass(new OutputPass());
  }

  // ---- static world: floor, walls, base + Sangfor logo, lane edges ----
  // The floor/walls/edges live in a group whose X-scale narrows the whole lane on
  // portrait phones (set in resize) so the operator's range always stays on-screen.
  const laneW = HALFW * 2;
  const laneFrame = new THREE.Group(); scene.add(laneFrame);
  const floorMat = new THREE.MeshStandardMaterial({ map: opts.deckTexture ? opts.deckTexture() : makeFloorTex(), roughness: showcase ? 0.92 : 0.6, metalness: showcase ? 0.1 : 0.3, envMapIntensity: showcase ? .06 : 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(laneW, LEN + 12), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, LEN / 2 - 3); floor.receiveShadow = true; laneFrame.add(floor);

  if (!sculpted) {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 1, metalness: 0 });
  for (const s of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, LEN + 12), wallMat); wall.position.set(s * (HALFW + 1.25), 3, LEN / 2 - 3); wall.receiveShadow = true; laneFrame.add(wall); }
  // glowing lane edges
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x72bb38 });
  for (const s of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, LEN + 12), edgeMat); edge.position.set(s * HALFW, 0.07, LEN / 2 - 3); laneFrame.add(edge); }

  // base rampart behind the operator, carrying the SANGFOR corporate logo
  const base = new THREE.Group();
  const baseWall = new THREE.Mesh(new THREE.BoxGeometry(laneW, 2.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.7, metalness: 0.35 }));
  baseWall.position.set(0, 1.3, 0); baseWall.castShadow = true; baseWall.receiveShadow = true; base.add(baseWall);
  const baseTop = new THREE.Mesh(new THREE.BoxGeometry(laneW, 0.18, 1.8), new THREE.MeshBasicMaterial({ color: 0x72bb38 })); baseTop.position.set(0, 2.6, 0); base.add(baseTop);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.7), new THREE.MeshBasicMaterial({ map: brandTex, transparent: true }));
  logo.position.set(0, 1.95, -0.82); logo.rotation.y = Math.PI; base.add(logo);   // faces the camera (-Z)
  base.position.set(0, 0, -1.6); scene.add(base);
  }
  const art = opts.artFactory?.({ scene, laneFrame, renderer, camera, markTex, brandTex, laneW, length: LEN, integrated: true });
  const integrated = !!art?.integrated;

  // dynamic groups
  const unitsGroup = new THREE.Group(); scene.add(unitsGroup);
  const tempsGroup = new THREE.Group(); scene.add(tempsGroup);   // summoned service teams (survive unit rebuilds)
  const enemyGroup = new THREE.Group(); scene.add(enemyGroup);
  const bulletGroup = new THREE.Group(); scene.add(bulletGroup);
  let opMesh = null, allyMesh = null;
  const enemyMeshes = new Map();         // id -> { group, body, core, type }
  const unitModels = new Map(), freeTeams = {pt:[],rt:[]}; let modelBuilds=0;
  const tempMeshes = new Map();          // temp-team unit id -> mesh
  const bullets = createBulletInstances(bulletGroup);
  const enemies = art ? createEnemyInstances(art, enemyGroup, MAX_ACTIVE_THREATS) : null;
  const energy = createEnergyInstances(scene);
  const ccEmitters = new THREE.Group(); scene.add(ccEmitters);
  const emitterGeometry = new THREE.CylinderGeometry(.24, .38, .85, 12);
  const emitterMaterial = new THREE.MeshStandardMaterial({ color: 0x223c4a, roughness: .3, metalness: .7 });
  for (let i = 0; i < 4; i++) { const emitter = new THREE.Mesh(emitterGeometry, emitterMaterial); ccEmitters.add(emitter); }
  let barrierObj = null, bandObj = null, shieldObj = null, coreObj = null, radarObj = null, radarSweep = null;

  // ---- geometry (pixel space for the sim) ----
  let W = 0, H = 0, dpr = 1, barH = 0, baseY = 0, opHome = 0, bandY = 0;
  let fieldL = 0, fieldR = 0, fieldW = 0, laneHalf = HALFW;   // world half-width (narrows on portrait)
  let vignette = null;                                        // cached corner darkening (cinematic modes only)
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
    // Keep the lane's HORIZONTAL field constant so it always fits, and let tall
    // phone screens simply reveal more lane length (widen the vertical FOV).
    camera.aspect = W / H;
    const asp = W / H, refAsp = 0.62, baseFov = 48;
    camera.fov = asp < refAsp
      ? Math.min(80, 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * (refAsp / asp)) * 180 / Math.PI)
      : baseFov;
    camera.updateProjectionMatrix();
    fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!showcase) { vignette = fctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.28, W / 2, H * 0.52, Math.max(W, H) * 0.72); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(0.72, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(3,6,12,0.5)'); }
    barH = Math.max(52, H * 0.09); baseY = H - barH; opHome = baseY - 62; bandY = H * 0.44;
    fieldW = clamp(W * 0.92, 340, 440); fieldL = Math.round((W - fieldW) / 2); fieldR = fieldL + fieldW;
    // adaptive world lane half-width: narrow the whole lane on portrait phones so
    // the operator's full movement range always stays inside the camera frustum.
    const hHalf = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);   // horizontal half-FOV
    const fdx = CAM_LOOK.x - CAM_BASE.x, fdy = CAM_LOOK.y - CAM_BASE.y, fdz = CAM_LOOK.z - CAM_BASE.z;
    const fl = Math.hypot(fdx, fdy, fdz) || 1, fnx = fdx / fl, fny = fdy / fl, fnz = fdz / fl;
    const opZ = wZ(baseY - 40);                                 // nearest the operator ever gets (worst case)
    const fwd = (0 - CAM_BASE.x) * fnx + ((integrated ? 4.1 : .9) - CAM_BASE.y) * fny + (opZ - CAM_BASE.z) * fnz;
    const visHalf = Math.max(1.5, fwd * Math.tan(hHalf));       // visible world half-width at the operator
    const opFrac = Math.max(0.5, 1 - 52 / fieldW);             // fraction of laneHalf the operator reaches
    laneHalf = Math.min(HALFW, integrated ? Math.max(1.5, visHalf * .97 - 1.85) / opFrac : visHalf * .84 / opFrac);
    laneFrame.scale.x = laneHalf / HALFW;
    if (S) { S.op.x = clamp(S.op.x, opMinX(), opMaxX()); S.op.y = clamp(S.op.y, opMinY(), opMaxY()); unitsDirty = true; }
  }
  const opMinX = () => fieldL + 26, opMaxX = () => fieldR - 26;
  const opMinY = () => baseY - 168, opMaxY = () => baseY - 40;
  const cx = () => fieldL + fieldW / 2;
  // The camera looks DOWN the lane from behind the operator (toward +Z), so world
  // +X renders on the LEFT. Negate so dragging/steering RIGHT moves the unit right.
  const wX = gx => -((gx - cx()) / (fieldW / 2)) * laneHalf;
  const wZ = gy => ((baseY - gy) / baseY) * LEN;
  const wR = pr => pr * 0.055;    // pixel radius -> world radius

  let S = null, raf = 0, lastTS = 0, nextId = 1, unitsDirty = false;
  const keys = new Set();
  const drag = { on: false };

  function fresh() {
    return {
      phase: 'idle', base: START_BASE, baseMax: START_BASE, score: 0, best: 0,
      combo: 0, maxCombo: 0, elapsed: 0, kills: 0, level: 1, xp: 0, xpNeed: xpToLevel(1),
      levels: { ...STARTER_LEVELS }, squad: deriveSquad(STARTER_LEVELS), shooters: [], shield: 0, pendingLevels: 1, opening: true,
      afHp: 0, afMax: 0, afDown: false, afDownT: 0, radarAng: 0,
      op: { x: W / 2, y: opHome, muzzle: 0 },
      enemies: [], shots: [], parts: [], texts: [], fxr: [], arc: null, temps: [],
      pools: { shots: [], parts: [], texts: [], fxr: [] }, collision: createCollisionIndex(), targets: new Map(),
      spawnAcc: 0, xdrAcc: 0, shieldAcc: 0, lastBoss: 0, bossCount: 0, bossesKilled: 0,
      ccAcc: 0, cc: null, link: null, choices: [], offerLeft: 0, businessWork: 0, aiWork: 0, agentWork: 0, availability: 100, xpAcc: 0, dodged: 0, defeatReason: null,
      shake: 0, flash: 0, flashCol: '255,90,106', hudAcc: 0,
      cd: { ir: 0, pt: 0, rt: 0 }, ptT: 0, rtT: 0,   // active-skill cooldowns + team-summon timers
      corrAnnounced: false,
    };
  }

  function recompute() {
    S.squad = deriveSquad(S.levels);
    const sq = S.squad;
    const list = [{ kind: 'op', off: 0, yoff: 0, dmg: OPERATOR.dmg, rate: OPERATOR.rate, speed: OPERATOR.bulletSpeed, pierce: OPERATOR.pierce, acc: 0 }];
    const n = sq.edrTurrets;
    for (let i = 0; i < n; i++) list.push({ kind: 'edr', fixed: !integrated, off: (i-(n-1)/2)*18, yoff: -24, frac: (i + 1) / (n + 1), dmg: sq.edrDmg, rate: TURRET.rate, speed: TURRET.bulletSpeed, pierce: TURRET.pierce, acc: 0 });
    if (sq.mdrAllies > 0) list.push({ kind: 'mdr', off: integrated ? 30 : 54, yoff: integrated ? -4 : 6, dmg: sq.mdrDmg, rate: sq.mdrRate, speed: ALLY.bulletSpeed, pierce: ALLY.pierce, acc: 0 });
    if (S.shooters) list.forEach((s, i) => { if (S.shooters[i]) s.acc = S.shooters[i].acc; });
    S.shooters = list;
    if (sq.afTier > 0) { const grew = sq.afHp - S.afMax; S.afMax = sq.afHp; if (grew > 0) S.afHp = Math.min(sq.afHp, S.afHp + grew); if (S.afHp <= 0 && !S.afDown) S.afHp = sq.afHp; }
    else { S.afMax = 0; S.afHp = 0; S.afDown = false; }
    if (correlationLinks() > 0 && !S.corrAnnounced) { S.corrAnnounced = true; onToast('corrOn', 'good'); }
    unitsDirty = true;
  }

  // ---- fx helpers (consumed by the 2D overlay) ----
  function burst(x, y, color, n = 12, spread = 180) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * spread;
      const p = S.pools.parts.pop() || {};
      p.x=x; p.y=y; p.vx=Math.cos(a)*sp; p.vy=Math.sin(a)*sp;
      p.life=1; p.color=color; p.r=1.4+Math.random()*3; S.parts.push(p);
    }
  }
  function ring(x, y, color, max, w = 3) {
    const f=S.pools.fxr.pop() || {}; f.t='ring'; f.x=x; f.y=y; f.color=color;
    f.r=5; f.max=max; f.w=w; f.life=1; S.fxr.push(f);
  }
  const shock = (x,y,color,max) => ring(x,y,color,max,5);
  function zap(x1,y1,x2,y2,color) {
    const f=S.pools.fxr.pop() || {}; f.t='zap'; f.x1=x1; f.y1=y1; f.x2=x2; f.y2=y2;
    f.color=color; f.life=1; f.r=undefined; f.max=undefined; S.fxr.push(f);
  }
  function dmgText(x,y,n,color,big) {
    const t=S.pools.texts.pop() || {}; t.x=x; t.y=y; t.text=fmtNum(n); t.color=color;
    t.life=1; t.big=!!big; t.vy=-32-Math.random()*20; t.vx=rand(-14,14); S.texts.push(t);
  }

  // ---- enemies ----
  function spawnEnemy(type) {
    const d = difficultyAt(S.elapsed), spec = ENEMIES[type];
    if (!spec || S.enemies.length >= MAX_ACTIVE_THREATS - (spec.boss ? 0 : 3)) return false;
    const hp = Math.round(spec.hp * (spec.boss ? bossHpScale(S.elapsed, spec.mega) : d.hpMul));
    S.enemies.push({ id: nextId++, type, spec, x: spec.boss ? cx() : rand(fieldL + spec.r + 4, fieldR - spec.r - 4), y: -spec.r - rand(2, 40), r: spec.r, hp, maxhp: hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false, spawnAcc: 0, bornAt: S.elapsed, attackAcc: 0 });
    return true;
  }
  // Three scheduled entrances; each is telegraphed and counted only on death.
  function spawnBoss() {
    const type = bossFor(S.bossCount); if (!type) return false;
    const mega = !!ENEMIES[type].mega;
    if (!spawnEnemy(type)) return false;
    S.bossCount++;
    onToast('boss_' + type, 'bad');
    S.flash = mega ? 0.9 : 0.6; S.flashCol = hexToRGB(ENEMIES[type].color); S.shake = Math.min(1, mega ? 1 : 0.7);
    sfx.boss();
    return true;
  }
  function killEnemy(e, viaAbility, suppressCorrelation = false) {
    if (e.dead) return;
    e.dead = true;
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.score += killScore(e.type, comboMult(S.combo)); S.kills++;
    gainXp(e.spec.xp);
    burst(e.x, e.y, e.spec.color, e.spec.boss ? 40 : 12, e.spec.boss ? 300 : 170);
    ring(e.x, e.y, e.spec.color, e.r * (e.spec.boss ? 5 : 2.2));
    ring(e.x, e.y, '#ffffff', e.r * (e.spec.boss ? 3 : 1.7), 2);   // crisp white death pop
    if (e.spec.boss) {
      S.bossesKilled++;
      S.shake = 1; S.flash = e.spec.mega ? 1 : 0.85; S.flashCol = hexToRGB(e.spec.color);
      if (e.spec.mega) { shock(e.x, e.y, '#ffffff', e.r * 10); for (let i = 0; i < 5; i++) ring(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), e.spec.color, e.r * (2.5 + i), 2); }
      sfx.boss();
    }
    else if (!viaAbility) sfx.hit(S.combo);
    if (e.spec.splits) for (let i = 0; i < e.spec.splits && S.enemies.length < MAX_ACTIVE_THREATS - 3; i++) { const r2 = ENEMIES.recon; S.enemies.push({ id: nextId++, type: 'recon', spec: r2, x: e.x + rand(-14, 14), y: e.y, r: r2.r, hp: r2.hp, maxhp: r2.hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false }); }
    // XDR CORRELATION CHAINS (the signature): with 2+ sensors on the field, a kill
    // correlates across them and arcs lightning to nearby threats, which can cascade.
    const links = correlationLinks();
    if (links > 0 && !suppressCorrelation) fireCorrelation(e.x, e.y, links, 0);
  }
  // XDR needs >=2 sensor UNITS to correlate (its real rule); chain reach grows with them
  const correlationLinks = () => (S.squad.xdrOn && S.squad.sensors >= 2 ? Math.min(2, S.squad.sensors - 1) : 0);
  function fireCorrelation(x, y, links, depth) {
    if (links <= 0 || depth > 3) return;
    const R2 = (150 + S.squad.sensors * 12) ** 2;
    const near = S.enemies.filter(t => !t.dead && (t.x !== x || t.y !== y) && dist2(x, y, t.x, t.y) <= R2)
      .sort((a, b) => dist2(x, y, a.x, a.y) - dist2(x, y, b.x, b.y)).slice(0, links);
    if (!near.length) return;
    const dmg = 18 + S.squad.sensors * 7;
    S.shake = Math.min(1, S.shake + 0.12);
    for (const t of near) {
      zap(x, y, t.x, t.y, '#7dffd0'); zap(x, y, t.x, t.y, '#eafffb');
      ring(t.x, t.y, '#7dffd0', t.r * 2.6, 3);
      const dealt = dealDamage(t, dmg);
      dmgText(t.x, t.y - t.r, dealt, '#7dffd0', false);
      burst(t.x, t.y, '#7dffd0', 5, 100);
      if (t.hp <= 0 && !t.dead) {
        // Keep boss/XP accounting centralized and recursion bounded here.
        t.dead = true; if (t.spec.boss) S.bossesKilled++;
        S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
        S.score += killScore(t.type, comboMult(S.combo)); S.kills++; gainXp(t.spec.xp);
        burst(t.x, t.y, t.spec.color, 12, 160); ring(t.x, t.y, '#ffffff', t.r * 1.7, 2);
        fireCorrelation(t.x, t.y, links - 1, depth + 1);
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

  // ---- firing and Cyber Command target tracking ----
  function unitX(sh) { return sh.fixed ? fieldL + fieldW * sh.frac : clamp(S.op.x + (sh.off || 0), fieldL + 16, fieldR - 16); }
  function unitY(sh) { return sh.fixed ? baseY - 50 : S.op.y + (sh.yoff || 0); }
  function chooseTarget(x, y, excluded, guided = false) {
    let target = null, best = Infinity;
    for (const e of S.enemies) {
      if (e.dead || excluded?.has(e.id) || e.y >= y + e.r) continue;
      const distance = dist2(x, y, e.x, e.y) * (e.spec.boss ? .7 : 1);
      if (guided && (distance > 700 ** 2 || Math.abs(e.x - x) > Math.max(35, (y - e.y) * .65))) continue;
      if (distance < best) { best = distance; target = e; }
    }
    return target;
  }
  function fireUp(x, y, dmg, speed, pierce, color, owner = 'op') {
    const homing = owner === 'mdr' || S.squad.tracking;
    const target = homing ? chooseTarget(x, y, null, owner !== 'mdr') : null;
    const p = S.pools.shots.pop() || { hit: new Set() };
    p.hit.clear(); p.dead=false; p.x=x; p.y=y; p.vx=0; p.vy=-speed; p.speed=speed;
    p.owner=owner; p.homing=homing; p.targetId=target?.id; p.life=2.4; p.dmg=dmg;
    p.pierce=pierce; p.height=integrated?(owner==='edr'?2.65:owner==='mdr'?1.55:1.3):.9; p.r=4.5; p.color=color; S.shots.push(p);
  }
  function devicePositions() {
    const sq = S.squad, op = S.op, devices = [];
    if(integrated) {
      const offsets={EDR:[-24,-24],MDR:[30,-4],NDR:[0,-20],AF:[28,0],HCI:[18,5],XDR:[0,10],ASTOR:[-16,16],IAG:[12,20],AI:[-18,-6],AGENT:[-27,4]};
      for(const id of WEAPON_ORDER) if(S.levels[id]) {const [dx,dy]=offsets[id];devices.push({id,x:op.x+dx,y:op.y+dy});}
      return devices;
    }
    for (const sh of S.shooters) if (sh.kind !== 'op') devices.push({ id: sh.kind === 'edr' ? 'EDR' : 'MDR', x: unitX(sh), y: unitY(sh) });
    if (sq.ndrReveal) devices.push({ id: 'NDR', x: fieldR - 34, y: baseY - 30 });
    if (sq.afTier) for (const side of [-1, 1]) devices.push({ id: 'AF', x: op.x + side * sq.afHalfWidth, y: op.y - BAR_OFFSET });
    if (S.levels.HCI) devices.push({ id: 'HCI', x: fieldL + 65, y: baseY - 113 });
    if (S.levels.IAG) devices.push({ id: 'IAG', x: fieldL + 23, y: bandY });
    if (S.levels.AI) devices.push({ id: 'AI', x: fieldL + 23, y: baseY - 184 });
    if (S.levels.AGENT) devices.push({ id: 'AGENT', x: fieldL + 23, y: baseY - 258 });
    if (S.levels.ASTOR) devices.push({ id: 'ASTOR', x: fieldL + 23, y: baseY - 17 });
    if (sq.xdrOn) devices.push({ id: 'XDR', x: fieldR - 23, y: baseY - 78 });
    return devices;
  }
  function beginCorrelation() {
    const devices = devicePositions(), hub = devices.find(d => d.id === 'XDR');
    if (!hub) return;
    S.link = { age: 0, charge: .65, duration: 1.1, devices, hub, fired: false };
    onToast('xdrLink', 'good');
    pushHud();
  }
  function fireXdrChain() {
    const sq = S.squad; if (!sq.xdrOn) return;
    const hub = devicePositions().find(d => d.id === 'XDR');
    let target = chooseTarget(hub.x, hub.y, null, true);
    if (!target) return;
    const nodes = [], selected = new Set();
    while (target && nodes.length < sq.xdrTargets) {
      selected.add(target.id);
      nodes.push({id:target.id,x:target.x,y:target.y,height:wRForArc(target.r),hit:false,skipped:false});
      let next = null, nearest = sq.xdrJumpRange ** 2;
      for (const e of S.enemies) if (!e.dead && !selected.has(e.id) && e.y > -e.r && e.y < baseY) {
        const d = dist2(target.x,target.y,e.x,e.y); if (d < nearest) { nearest=d; next=e; }
      }
      target = next;
    }
    S.arc = {x:hub.x,y:hub.y,age:0,life:.62,dmg:sq.xdrDmg*.62,nodes};
    S.flash = .2; S.flashCol = '185,255,210'; S.shake = Math.max(S.shake,.12);
    ring(hub.x, hub.y, ACCENT.XDR, 55, 2);
    burst(hub.x, hub.y, '#c8ffe3', 8, 100);
    sfx.ability();
    if (sq.xdrIdle) onToast('xdrIdle', 'bad');
    pushHud();
  }
  const wRForArc = radius => radius * .055 + .35;
  function dominant() { let b = null, bl = 0; for (const id of WEAPON_ORDER) { const l = S.levels[id] || 0; if (l > bl) { bl = l; b = id; } } return b; }
  function dominantColor() { const id = dominant(); return id ? (ACCENT[id] || '#9be85a') : '#9be85a'; }

  // ---- xp / level ----
  function gainXp(n) {
    S.xp += n;
    while (S.xp >= S.xpNeed) { S.xp -= S.xpNeed; S.level++; S.xpNeed = xpToLevel(S.level); S.pendingLevels++; }
    if (S.pendingLevels > 0 && !S.choices.length && S.phase === 'play') openLevelUp();
  }
  function openLevelUp() {
    const choices = S.opening ? openingChoices() : upgradeChoices(S.levels);
    S.opening = false;
    if (!choices.length) { S.pendingLevels = 0; return; }
    S.choices = choices; S.offerLeft = UPGRADE_SECONDS; onLevelUp(choices, S.level); sfx.start();
  }
  function applyUpgrade(id) {
    if (!S || !['play', 'paused'].includes(S.phase) || !WEAPON_ORDER.includes(id) || (S.levels[id] || 0) >= WEAPONS[id].max) return false;
    // External inspection fixtures may deploy directly; UI choices are checked by chooseUpgrade.
    S.levels[id] = Math.min((S.levels[id] || 0) + 1, WEAPONS[id].max);
    recompute();
    ring(S.op.x, S.op.y, ACCENT[id] || '#72bb38', 90, 5); burst(S.op.x, S.op.y - 16, ACCENT[id] || '#72bb38', 18, 150);
    S.choices = []; S.offerLeft = 0; S.pendingLevels = Math.max(0, S.pendingLevels - 1);
    onLevelUp([], S.level);
    if (S.pendingLevels > 0 && S.phase === 'play') openLevelUp();
    return true;
  }
  function chooseUpgrade(id) {
    return S.phase === 'play' && S.choices.some(choice => choice.id === id) ? applyUpgrade(id) : false;
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
  // operator and fire for `spec.dur` seconds, then withdraw.
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
      const dmg = Math.max(e.maxhp * (e.spec.boss ? .2 : .6), 150);
      e.hp -= dmg; e.hit = 1; dmgText(e.x, e.y - e.r, dmg, '#9fe8ff', true);
      burst(e.x, e.y, '#58c8ff', 9, 170); zap(S.op.x, S.op.y - 16, e.x, e.y, '#bfefff');
      if (e.hp <= 0) killEnemy(e, true);
    }
    S.base = Math.min(S.baseMax, S.base + 160);
    S.shield = Math.min((S.squad.shieldMax || 0) + 1, S.shield + 1);
    onToast('irOn', 'good'); sfx.ability();
  }

  // ---- base damage ----
  function hitBase(amount, color, boss = false) {
    amount *= boss ? 3 : 5;
    if (S.shield > 0) { S.shield--; S.flash = 0.6; S.flashCol = '169,139,255'; ring(S.op.x, baseY - 2, ACCENT.ASTOR, 120, 6); onToast('absorb', 'good'); sfx.ability(); return; }
    S.base = Math.max(0, S.base - amount);
    S.availability = Math.max(0, S.availability - amount / 180);
    if (S.base <= 0) S.defeatReason = 'integrity';
    S.combo = 0; S.shake = Math.min(1, 0.5 + amount / 350); S.flash = 0.7; S.flashCol = color || '255,90,106'; sfx.breach();
  }

  // ---- sim ----
  function update(dt) {
    dt = Math.min(dt, Math.max(0, MISSION_SECONDS - S.elapsed));
    S.elapsed = Math.min(MISSION_SECONDS, S.elapsed + dt);
    const d = difficultyAt(S.elapsed), sq = S.squad, op = S.op;
    const cloud = cloudRates(S.levels, S.elapsed, S.availability);
    S.businessWork += cloud.business * dt; S.aiWork += cloud.ai * dt; S.agentWork += cloud.agent * dt;
    S.availability = clamp(S.availability + (cloud.capacity >= cloud.demand ? 1.2 : -(1 - cloud.served) * 3.5) * dt, 0, 100);
    if (S.availability <= 0) { S.defeatReason = 'service'; gameOver(); return; }
    S.xpAcc += dt; if (S.xpAcc >= 2) { S.xpAcc -= 2; gainXp(1); }
    if (S.choices.length) {
      S.offerLeft -= dt;
      if (S.offerLeft <= 0) chooseUpgrade(recommendedUpgrade(S.choices, S.levels));
    }
    const mv = 380 * dt;
    if (keys.has('left')) op.x -= mv; if (keys.has('right')) op.x += mv;
    if (keys.has('up')) op.y -= mv; if (keys.has('down')) op.y += mv;
    if (drag.on) { op.x += (drag.x - op.x) * Math.min(1, dt * 16); op.y += (drag.y - op.y) * Math.min(1, dt * 16); }
    op.x = clamp(op.x, opMinX(), opMaxX()); op.y = clamp(op.y, opMinY(), opMaxY());
    op.muzzle = Math.max(0, op.muzzle - dt * 6);

    // active-skill cooldowns + summoned-team duration timers (drive the HUD glow)
    for (const k in S.cd) if (S.cd[k] > 0) S.cd[k] = Math.max(0, S.cd[k] - dt * cloud.cooldown);
    if (S.ptT > 0) S.ptT = Math.max(0, S.ptT - dt);
    if (S.rtT > 0) S.rtT = Math.max(0, S.rtT - dt);

    if (S.bossCount < BOSS_TIMES.length && S.elapsed >= BOSS_TIMES[S.bossCount]) spawnBoss();
    S.spawnAcc += dt * 1000;
    if (S.elapsed < 114 && S.spawnAcc >= d.spawnGap) { S.spawnAcc = 0; const pool = threatPool(S.elapsed); for (let i = 0; i < d.batch; i++) spawnEnemy(pool[Math.floor(Math.random() * pool.length)]); }

    for (const sh of S.shooters) {
      sh.acc += dt * 1000; const interval = 1000 / (sh.rate * sq.fireRateMul);
      while (sh.acc >= interval) { sh.acc -= interval; const x = unitX(sh), uy = unitY(sh); fireUp(x, uy - 16, sh.dmg, sh.speed, sh.pierce, sh.kind === 'op' ? dominantColor() : ACCENT[sh.kind === 'edr' ? 'EDR' : 'MDR'], sh.kind); if (sh.kind === 'op') op.muzzle = 1; sh.muzzle = 1; }
      if (sh.muzzle) sh.muzzle = Math.max(0, sh.muzzle - dt * 6);
    }
    // Temporary teams use the same CC guidance as other ordinary weapons.
    for (const u of S.temps) {
      if (u.born > 0) u.born = Math.max(0, u.born - dt);
      u.life -= dt; if (u.life <= 0) { u.dead = true; continue; }
      u.acc += dt * 1000; const interval = 1000 / (u.rate * sq.fireRateMul);
      while (u.acc >= interval) { u.acc -= interval; fireUp(u.fx, u.fy - 16, u.dmg, u.speed, u.pierce, u.color, 'service'); u.muzzle = 1; }
      if (u.muzzle) u.muzzle = Math.max(0, u.muzzle - dt * 6);
    }
    if (sq.xdrOn) { S.xdrAcc += dt * 1000; if (!S.link && S.xdrAcc >= sq.xdrEvery) { S.xdrAcc = 0; beginCorrelation(); } }
    if (S.link) {
      S.link.age += dt;
      S.link.devices = devicePositions(); S.link.hub = S.link.devices.find(device => device.id === 'XDR');
      if (!S.link.fired && S.link.age >= S.link.charge) { S.link.fired = true; fireXdrChain(); }
      if (S.link.age >= S.link.duration) S.link = null;
    }
    if (sq.ccEvery) {
      S.ccAcc += dt;
      if (S.ccAcc >= sq.ccEvery) { S.ccAcc = 0; S.cc = { life: .55, bands: [H * .34, H * .55], width: sq.ccWidth, dmg: sq.ccDamage }; }
    }
    if (S.cc) {
      S.cc.life -= dt;
      for (const e of S.enemies) if (!e.dead && S.cc.bands.some(y => Math.abs(e.y - y) < S.cc.width / 2 + e.r)) {
        dealDamage(e, S.cc.dmg * dt); if (e.hp <= 0) killEnemy(e, true);
      }
      if (S.cc.life <= 0) S.cc = null;
    }
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
          for (let k = 0; k < (e.spec.spawnCount || 1) && S.enemies.length < MAX_ACTIVE_THREATS - 3; k++) S.enemies.push({ id: nextId++, type: e.spec.spawn, spec: m, x: clamp(e.x + rand(-30, 30), fieldL + m.r, fieldR - m.r), y: e.y + e.r * 0.5, r: m.r, hp: m.hp, maxhp: m.hp, slow: 0, hit: 0, wob: Math.random() * TAU, marked: false, afWeakened: false, spawnAcc: 0 });
          ring(e.x, e.y, e.spec.color, e.r * 1.5, 4); burst(e.x, e.y + e.r * 0.4, e.spec.color, 8, 130);
        }
      }
      let slowK = e.slow > 0 ? 0.5 : 1; if (e.slow > 0) e.slow -= dt * 1000;
      if (sq.iagBand && e.y > bandY - 24 && e.y < bandY + 24) slowK *= sq.iagSlowMul;
      e.wob += dt * 3;
      // A compact field gives less reaction distance; compensate by at most 6%.
      const sp = e.spec.speed * d.speedMul * slowK * clamp(H / 942, .94, 1);
      const nextY = e.spec.boss ? Math.min(H * .24, e.y + sp * dt) : e.y + sp * dt;
      if (e.spec.boss) {
        e.attackAcc = (e.attackAcc || 0) + dt;
        if (!e.attack && e.attackAcc >= 4) {
          e.attackAcc = 0; e.attack = { x: op.x, left: .95 + (S.levels.AI || 0) * .06, width: e.spec.mega ? 110 : 84 };
          onToast('bossAim', 'bad');
        }
        if (e.attack) {
          e.attack.left -= dt;
          if (e.attack.left <= 0) {
            if (Math.abs(op.x - e.attack.x) < e.attack.width / 2) { hitBase(e.spec.dmg, '255,90,106', true); zap(e.x, e.y, e.attack.x, baseY, e.spec.color); }
            else { S.dodged++; ring(e.attack.x, baseY - 10, '#58c8ff', 60, 3); }
            e.attack = null;
            if (S.defeatReason || S.availability <= 0) { S.defeatReason ||= 'service'; gameOver(); return; }
          }
        }
      }
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
        if (e.spec.steals) { hitBase(e.spec.steals, '255,209,102'); S.combo = 0; onToast('exfil', 'bad'); S.flash = 0.5; S.flashCol = '255,209,102'; burst(e.x, baseY, e.spec.color, 18); }
        else hitBase(e.spec.dmg, e.spec.boss ? '255,90,106' : null);
        if (S.defeatReason || S.availability <= 0) { S.defeatReason ||= 'service'; gameOver(); return; }
      }
    }

    if (S.arc) {
      const b = S.arc; b.life -= dt; b.age += dt;
      if (integrated) { b.x = S.op.x; b.y = S.op.y + 10; }
      for (let i=0;i<b.nodes.length;i++) {
        const node=b.nodes[i], e=S.enemies.find(e=>e.id===node.id && !e.dead);
        if(e) {node.x=e.x;node.y=e.y;}
        if(node.hit || b.age<i*.065) continue;
        node.hit=true;node.skipped=!e;
        if(!e)continue;
        const dealt=dealDamage(e,b.dmg*Math.pow(.65,i));
        dmgText(e.x,e.y-e.r,dealt,'#bdffe1',i===0);
        burst(e.x,e.y,'#a5ffd5',6,95);ring(e.x,e.y,ACCENT.XDR,e.r*1.6,2);
        if(e.hp<=0)killEnemy(e,true,true);
      }
      if (b.life <= 0) S.arc = null;
    }

    const targets = S.targets; targets.clear();
    for (const e of S.enemies) if (!e.dead) targets.set(e.id, e);
    S.collision.reset(S.enemies);
    for (const p of S.shots) {
      if (p.dead) continue;
      // Homing rounds must not orbit an already-hit target indefinitely.
      p.life = (p.life ?? 2.4) - dt;
      if (p.life <= 0) { p.dead = true; continue; }
      p.homing = p.owner === 'mdr' || sq.tracking;
      if (p.homing) {
        const guided = p.owner !== 'mdr';
        const locked = targets.get(p.targetId);
        const target = locked && !locked.dead && !p.hit.has(locked.id) && (!guided || (dist2(p.x, p.y, locked.x, locked.y) < 700 ** 2 && Math.abs(locked.x - p.x) <= Math.max(35, (p.y - locked.y) * .65))) ? locked : chooseTarget(p.x, p.y, p.hit, guided);
        if (target) {
          p.targetId = target.id; const dx = target.x - p.x, dy = target.y - p.y, len = Math.hypot(dx, dy) || 1;
          const speed = p.speed || Math.hypot(p.vx, p.vy), turn = Math.min(1, dt * (p.owner === 'mdr' ? 8 : 2.8));
          p.vx += (dx / len * speed - p.vx) * turn; p.vy += (dy / len * speed - p.vy) * turn;
          const currentSpeed = Math.hypot(p.vx, p.vy) || 1; p.vx *= speed / currentSpeed; p.vy *= speed / currentSpeed;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < -40 || p.y > baseY + 40 || p.x < fieldL - 40 || p.x > fieldR + 40) { p.dead = true; continue; }
      const candidates = S.collision.query(S.enemies, p.x, p.y, p.r);
      for (let candidate = 0; candidate < candidates.length; candidate++) {
        const e = S.enemies[candidates[candidate]];
        if (e.dead || p.hit.has(e.id)) continue;
        if (dist2(p.x, p.y, e.x, e.y) <= (e.r + p.r) ** 2) {
          p.hit.add(e.id); hitEnemy(e, p.dmg, p.color, false); burst(p.x, p.y, p.color, 4, 70);
          if (e.hp <= 0) { killEnemy(e, false); if (e.spec.boss) shock(e.x, e.y, p.color, 180); }
          else if (p.dmg >= 36) shock(p.x, p.y, p.color, 20);
          S.collision.appendSpawned(S.enemies, p.x, p.y, p.r);
          if (p.pierce-- <= 0) { p.dead = true; break; }
        }
      }
    }

    for (const pt of S.parts) { pt.life -= dt * 1.7; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy = pt.vy * 0.94 + 40 * dt; }
    for (const tx of S.texts) { tx.life -= dt * 1.3; tx.y += tx.vy * dt; tx.x += tx.vx * dt; tx.vy *= 0.92; }
    for (const f of S.fxr) { f.life -= dt * (f.t === 'zap' ? 5 : 2.6); if (f.r !== undefined && f.max) f.r += (f.max - f.r) * Math.min(1, dt * 9); }
    S.radarAng += dt * 2.4;
    compactLive(S.enemies); compactLive(S.shots, S.pools.shots, 512); compactLive(S.temps);
    compactLive(S.parts, S.pools.parts, 2048, true); compactLive(S.texts, S.pools.texts, 512, true); compactLive(S.fxr, S.pools.fxr, 512, true);
    S.shake = Math.max(0, S.shake - dt * 2.4); S.flash = Math.max(0, S.flash - dt * 2.2);
    S.score += SURVIVE_PER_SEC * dt;
    S.hudAcc += dt; if (S.hudAcc >= 0.1) { S.hudAcc = 0; pushHud(); }
    if (S.defeatReason || S.elapsed >= MISSION_SECONDS) gameOver();
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
    if (art) return art.operator();
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
    if (art) return art.turret();
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
    if (art) return art.ally();
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
    if (art) return art.operative(team);
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
    if (art) return art.radar();
    const g = new THREE.Group(); const col = ACC.NDR;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5, 14), std(0x223246, 0x05070e, 0.1, 0.6, 0.6)); base2.position.y = 0.25; base2.castShadow = true; g.add(base2);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12, 0, TAU, 0, Math.PI / 2), std(col, col, 0.5, 0.4, 0.4)); dish.scale.set(1, 0.4, 1); dish.position.y = 0.85; dish.rotation.x = -0.5; g.add(dish);
    const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), new THREE.MeshBasicMaterial({ color: col })); sweep.position.set(0, 0.9, 0); g.add(sweep); g.userData.sweep = sweep;
    const b = makeBadge('NDR', 0.84); b.position.set(0, 1.5, 0); g.add(b); g.userData.badge = b;
    const tag = makeTag('NDR'); tag.position.set(0, 2.15, 0); g.add(tag); g.userData.tag = tag;
    return g;
  }
  function buildCore() {
    if (art) return art.core();
    const g = new THREE.Group(); const col = ACC.HCI;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 20), std(0x12324a, col, 0.6, 0.3, 0.6)); body.position.y = 0.45; body.castShadow = true; g.add(body);
    for (let i = 0; i < 3; i++) { const ringm = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: col })); ringm.rotation.x = Math.PI / 2; ringm.position.y = 0.3 + i * 0.22; g.add(ringm); }
    const b = makeBadge('HCI', 0.8); b.position.set(0, 1.25, 0); g.add(b); g.userData.badge = b;
    const tag = makeTag('HCI'); tag.position.set(0, 1.95, 0); g.add(tag); g.userData.tag = tag;
    return g;
  }

  function retainUnit(key, build) {
    if (!unitModels.has(key)) { const model=build(); unitModels.set(key,model); unitsGroup.add(model); modelBuilds++; }
    const model=unitModels.get(key); model.visible=true; return model;
  }
  function rebuildUnits() {
    unitsDirty=false;
    for(const model of unitModels.values()) model.visible=false;
    opMesh=null; allyMesh=null; coreObj=null; radarObj=null; radarSweep=null;
    if(!integrated && S.levels.HCI) coreObj=retainUnit('HCI',buildCore);
    if(!integrated && S.levels.NDR) { radarObj=retainUnit('NDR',buildRadar); radarSweep=radarObj.userData.sweep || null; }
    let turret=0;
    for(const sh of S.shooters) {
      sh._mesh=null;
      if(sh.kind==='op') { opMesh=retainUnit(art?'op':'op:'+dominant(),buildOperator); sh._mesh=opMesh; }
      else if(sh.kind==='edr' && !integrated) sh._mesh=retainUnit('EDR:'+turret++,buildTurret);
      else if(sh.kind==='mdr' && !integrated) { allyMesh=retainUnit('MDR',buildAlly); sh._mesh=allyMesh; }
    }
    if(!barrierObj) barrierObj=buildBarrier();
    if(!bandObj) bandObj=buildBand();
    if(!shieldObj) shieldObj=buildShield();
  }

  function buildBarrier() {
    if (art) return art.barrier();
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
    if (art) { const mesh = art.enemy(e, wR(e.r)); enemyGroup.add(mesh.group); return mesh; }
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
  function syncScene(dt) {
    if (unitsDirty) rebuildUnits();
    const sq = S.squad, op = S.op, t = S.elapsed;
    art?.sync(S, { wX, wZ, fieldL, fieldR, baseY, bandY });
    ccEmitters.visible = sq.ndrReveal;
    const segments = [];
    for (let i = 0; i < 4; i++) {
      const y = H * (i < 2 ? .34 : .55), x = i % 2 ? fieldR - 5 : fieldL + 5;
      ccEmitters.children[i].position.set(wX(x), .43, wZ(y));
    }
    if (S.cc) for (const y of S.cc.bands) {
      segments.push({ x: fieldL + 5, y, tx: fieldR - 5, ty: y, width: .065, color: ACCENT.NDR, flow: false });
      for (const x of [fieldL + 5, fieldR - 5]) segments.push({ x: integrated ? op.x : fieldR - 34, y: integrated ? op.y - 20 : baseY - 30, tx: x, ty: y, width: .012, color: ACCENT.NDR, flow: true });
    }
    if (S.link?.hub) for (const device of S.link.devices) if (device.id !== 'XDR') {
      segments.push({ x: device.x, y: device.y, tx: S.link.hub.x, ty: S.link.hub.y, width: .028, height: integrated ? 2.2 : 1.15, color: S.link.fired ? ACCENT.XDR : ACCENT[device.id], flow: true });
    }
    if(S.arc) {
      const arc=S.arc;let x=arc.x,y=arc.y,height=integrated?2.7:1.75;
      for(let i=0;i<arc.nodes.length;i++) {
        const node=arc.nodes[i];if(!node.hit || node.skipped)continue;
        let px=x,py=y,ph=height;
        for(let j=1;j<=7;j++) {
          const f=j/7, jitter=Math.sin(f*Math.PI)*Math.sin(j*17.3+i*9.1+t*39)*5;
          const nx=x+(node.x-x)*f+jitter,ny=y+(node.y-y)*f-jitter*.5,nh=height+(node.height-height)*f;
          segments.push({x:px,y:py,tx:nx,ty:ny,height:ph,targetHeight:nh,width:.035*Math.sqrt(Math.max(.02,arc.life/.62))*Math.pow(.9,i),color:i?'#a6ffd2':'#defff0',flow:false});
          px=nx;py=ny;ph=nh;
        }
        x=node.x;y=node.y;height=node.height;
      }
    }
    energy.sync(segments, t, wX, wZ);
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
      let tm=tempMeshes.get(u.id); if(!tm) { tm=freeTeams[u.team].pop(); if(!tm) {tm=buildOperative(u.team);tempsGroup.add(tm);modelBuilds++;} tm.userData.team=u.team; tm.visible=true; tempMeshes.set(u.id,tm); }
      const appear = u.born > 0 ? 1 - u.born / 0.35 : (u.life < 0.6 ? Math.max(0.12, u.life / 0.6) : 1);
      tm.position.set(wX(u.fx), 0, wZ(u.fy)); tm.scale.setScalar(0.82 * clamp(appear, 0.05, 1));
      if (tm.userData.flash) { const f = tm.userData.flash; f.visible = u.muzzle > 0.05; if (f.visible) { f.scale.setScalar(0.5 + u.muzzle * 0.6); f.material.opacity = u.muzzle * 0.85; } }
      billboard(tm.userData.tag);
    }
    for(const [id,tm] of tempMeshes) if(!seenT.has(id)) {tm.visible=false;freeTeams[tm.userData.team].push(tm);tempMeshes.delete(id);}

    if (coreObj) { coreObj.position.set(wX(art ? fieldL + 65 : op.x), 0, wZ(art ? baseY - 113 : op.y + 20)); coreObj.children.forEach(c => { if (c.geometry && c.geometry.type === 'TorusGeometry') c.rotation.z = t * 2; }); if (coreObj.userData.badge) billboard(coreObj.userData.badge); if (coreObj.userData.tag) billboard(coreObj.userData.tag); }
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
        barrierObj.userData.wall.material.opacity = S.afDown ? 0.12 + 0.08 * Math.sin(t * 20) : (art ? .07 + frac * .07 : .3 + frac * .4);
        barrierObj.userData.posts.forEach(p => { p.grp.position.x = p.side * wWorld / 2; if (!art) billboard(p.grp.children[1]); });
      }
    }
    // band
    if (bandObj) { bandObj.visible = sq.iagBand; if (sq.iagBand) bandObj.position.set(0, 0.04, wZ(bandY)); }
    // shield
    if (shieldObj) { shieldObj.visible = S.shield > 0; if (S.shield > 0) shieldObj.position.set(wX(op.x), 0.1, wZ(op.y)); }

    // enemies
    if (enemies) enemies.sync(S.enemies, t, revealed(), wX, wZ, wR);
    else {
    const seen = new Set();
    for (const e of S.enemies) {
      seen.add(e.id);
      let em = enemyMeshes.get(e.id); if (!em) { em = makeEnemyMesh(e); enemyMeshes.set(e.id, em); }
      const r = wR(e.r);
      em.group.position.set(wX(e.x), r + 0.35, wZ(e.y));
      if (em.custom) { art.animateEnemy(em, e, t, revealed()); continue; }
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
    }

    // bullets
    bullets.sync(S.shots, wX, wZ);
  }

  // ---- 2D overlay FX ----
  const _v = new THREE.Vector3(), projectedPoints = []; let projectedCount = 0;
  const lightningX = new Float64Array(8), lightningY = new Float64Array(8);
  function proj(gx,gy,hy) {
    _v.set(wX(gx),hy,wZ(gy)); _v.project(camera);
    const p=projectedPoints[projectedCount] || (projectedPoints[projectedCount]={}); projectedCount++;
    p.x=(_v.x*.5+.5)*W; p.y=(-_v.y*.5+.5)*H; p.vis=_v.z<1;
    p.s=clamp(2.1-(wZ(gy)/LEN)*1.5,.35,2.1); return p;
  }
  function drawFx() {
    projectedCount=0;
    fctx.clearRect(0,0,W,H);
    if (!showcase && vignette) { fctx.fillStyle = vignette; fctx.fillRect(0, 0, W, H); }   // cinematic corner darkening, under all fx
    // enemy hp bars + mark ticks
    for (const e of S.enemies) {
      if (e.attack) {
        const a = e.attack, points = [proj(a.x-a.width/2, e.y, .1), proj(a.x+a.width/2, e.y, .1), proj(a.x+a.width/2, baseY, .1), proj(a.x-a.width/2, baseY, .1)];
        fctx.fillStyle = 'rgba(255,55,77,.18)'; fctx.strokeStyle = '#ff697c'; fctx.lineWidth = 2;
        fctx.beginPath(); points.forEach((p,i)=>i ? fctx.lineTo(p.x,p.y) : fctx.moveTo(p.x,p.y)); fctx.closePath(); fctx.fill(); fctx.stroke();
        const end = proj(a.x, baseY-22, .2); fctx.font = 'bold 22px sans-serif'; fctx.textAlign = 'center'; fctx.fillStyle = '#ff9caa'; fctx.fillText('!', end.x, end.y);
      }
      if (e.hp >= e.maxhp && !e.spec.boss) continue;
      const cloaked = e.spec.cloak && !S.squad.ndrReveal; if (cloaked) continue;
      const p = proj(e.x, e.y - e.r, wR(e.r) * 2 + 0.4); if (!p.vis) continue;
      const w = Math.max(14, 34 * p.s), hpx = p.x - w / 2, hpy = p.y;
      fctx.fillStyle = 'rgba(0,0,0,.55)'; fctx.fillRect(hpx, hpy, w, 4 * p.s);
      fctx.fillStyle = e.spec.boss ? '#ff5a6a' : '#2ee6a0'; fctx.fillRect(hpx, hpy, w * clamp(e.hp / e.maxhp, 0, 1), 4 * p.s);
    }
    // rings + zaps
    fctx.globalCompositeOperation = 'lighter';
    for (const f of S.fxr) {
      const a = Math.max(0, f.life) * (art ? .55 : 1);
      if (f.t === 'ring') { const p = proj(f.x, f.y, 0.3), radius = art ? Math.min(100, f.r) : f.r; fctx.strokeStyle = rgba(f.color, a); fctx.lineWidth = art ? Math.min(2.5, f.w * p.s) : Math.max(1, f.w * p.s); fctx.beginPath(); fctx.ellipse(p.x, p.y, Math.max(0, radius * p.s * 0.5), Math.max(0, radius * p.s * 0.28), 0, 0, TAU); fctx.stroke(); }
      else if (f.t === 'zap') {
        const a1=proj(f.x1,f.y1,.8), a2=proj(f.x2,f.y2,.8), seg=7;
        for(let i=0;i<=seg;i++) {
          const tt=i/seg, edge=i===0 || i===seg;
          lightningX[i]=a1.x+(a2.x-a1.x)*tt+(edge?0:rand(-8,8));
          lightningY[i]=a1.y+(a2.y-a1.y)*tt+(edge?0:rand(-8,8));
        }
        for(let layer=0;layer<2;layer++) {
          fctx.strokeStyle=rgba(layer?'#ffffff':f.color,layer?a:a*.45);
          fctx.lineWidth=layer?1.6:5.5; fctx.beginPath(); fctx.moveTo(lightningX[0],lightningY[0]);
          for(let i=1;i<=seg;i++) fctx.lineTo(lightningX[i],lightningY[i]); fctx.stroke();
        }
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
    if (S.flash > 0) { fctx.fillStyle = `rgba(${S.flashCol},${S.flash * (art ? .08 : .26)})`; fctx.fillRect(0, 0, W, H); }
    // summoned-team auras: a red-team rally ring, a pen-test amber tint
    if (S.rtT > 0) { const p = proj(S.op.x, S.op.y, 0.35); const rr = (30 + 7 * Math.sin(S.elapsed * 13)) * p.s; fctx.globalCompositeOperation = 'lighter'; fctx.strokeStyle = rgba('#ff5a6a', 0.45 + 0.3 * Math.sin(S.elapsed * 13)); fctx.lineWidth = 3; fctx.beginPath(); fctx.ellipse(p.x, p.y, rr, rr * 0.5, 0, 0, TAU); fctx.stroke(); fctx.globalCompositeOperation = 'source-over'; }
    if (S.ptT > 0) { fctx.fillStyle = `rgba(255,209,102,${0.04 + 0.025 * Math.sin(S.elapsed * 8)})`; fctx.fillRect(0, 0, W, H); }
    // A camera-facing official mark and name remain readable at the XDR source.
    if (S.levels.XDR && !integrated) {
      const p = proj(fieldR - 23, baseY - 78, 3.05), x = clamp(p.x, 59, W - 59), y = p.y - 18;
      fctx.fillStyle = '#07151fee'; fctx.strokeStyle = S.link ? '#bdff84' : '#7fa4ae'; fctx.lineWidth = 1.5;
      roundRectPath(fctx, x-54, y-22, 108, 44, 8); fctx.fill(); fctx.stroke();
      const logo = markTex.XDR?.image;
      if (logo?.width) { fctx.fillStyle = '#fff'; fctx.fillRect(x-47,y-15,30,30); const r=Math.min(30/logo.width,30/logo.height); fctx.drawImage(logo,x-32-logo.width*r/2,y-logo.height*r/2,logo.width*r,logo.height*r); }
      fctx.textAlign = 'left'; fctx.fillStyle = '#d9f8c4'; fctx.font = '700 8px sans-serif'; fctx.fillText('SANGFOR',x-8,y-6);
      fctx.font = '900 23px sans-serif'; fctx.fillStyle = '#fff'; fctx.fillText('XDR',x-8,y+14);
    }

  }
  function rgba(hex, a) { const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`; }
  function render() {
    renderer.info.reset();
    if (S.shake > 0) camera.position.set(CAM_BASE.x + rand(-1, 1) * S.shake * 0.5, CAM_BASE.y + rand(-1, 1) * S.shake * 0.4, CAM_BASE.z);
    else camera.position.copy(CAM_BASE);
    if (composer) composer.render(); else renderer.render(scene, camera);
    drawFx();
  }

  function disposeTree(o) { o.traverse(n => { if (n.geometry && !n.userData.sharedStandGeometry) n.geometry.dispose(); if (n.material) { const m = Array.isArray(n.material) ? n.material : [n.material]; m.forEach(x => x.dispose()); } }); }

  // ---- floor texture (grid + columns) ----
  function makeFloorTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 1024); grd.addColorStop(0, '#0a0d16'); grd.addColorStop(1, '#161d2b'); g.fillStyle = grd; g.fillRect(0, 0, 256, 1024);
    g.strokeStyle = 'rgba(120,150,190,.12)'; g.lineWidth = 1;
    for (let i = 0; i <= 7; i++) { const x = i / 7 * 256; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
    for (let i = 0; i <= 40; i++) { const y = i / 40 * 1024; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }
  // graded equirectangular sky: lights metals (via PMREM) and sits behind the lane.
  function makeEnvTex() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#16233e'); grd.addColorStop(0.42, '#0a1322'); grd.addColorStop(0.5, '#0d2340'); grd.addColorStop(0.58, '#070f1e'); grd.addColorStop(1, '#03060c');
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
    const hg = g.createLinearGradient(0, 236, 0, 276); hg.addColorStop(0, 'rgba(90,160,255,0)'); hg.addColorStop(0.5, 'rgba(120,190,255,0.55)'); hg.addColorStop(1, 'rgba(90,160,255,0)');
    g.fillStyle = hg; g.fillRect(0, 236, 1024, 40);
    g.fillStyle = 'rgba(200,220,255,0.5)';
    for (let i = 0; i < 60; i++) { const x = Math.random() * 1024, y = Math.random() * 190; g.fillRect(x, y, 1.5, 1.5); }
    const tx = new THREE.CanvasTexture(c); tx.mapping = THREE.EquirectangularReflectionMapping; tx.colorSpace = THREE.SRGBColorSpace; return tx;
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
    const scores=campaignScores(S), cloud=cloudRates(S.levels,S.elapsed);
    onHud({ base: integrityScore(S.base), baseMax: S.baseMax, score: scores.total, scores, availability: Math.floor(S.availability), demand: Math.round(cloud.demand), capacity: cloud.capacity, best: S.best, combo: S.combo, mult: comboMult(S.combo), elapsed: Math.floor(S.elapsed), level: S.level, xp: S.xp, xpNeed: S.xpNeed, tier: WEAPON_ORDER.reduce((a, id) => a + (S.levels[id] || 0), 0), levels: { ...S.levels }, dom: dominant(), sensors: S.squad.sensors, shield: S.shield, shieldMax: S.squad.shieldMax, corr: correlationLinks(), abilities, boss: bossHud, bossesKilled: S.bossesKilled, offerLeft: S.offerLeft, hasChoices: S.choices.length > 0, mechanized: integrated, rigStage: art?.rigDiagnostics?.stage || 0, tracking: S.squad.tracking, linkPhase: !S.levels.XDR ? 'offline' : S.arc ? 'firing' : S.link ? 'charging' : 'ready' });
  }

  // ---- lifecycle ----
  function frame(ts) {
    const dt = Math.min(.25, Math.max(0, (ts - lastTS) / 1000 || 0)); lastTS = ts;
    // Keep the campaign clock at real pace on slower frames without tunneling.
    // Bound catch-up after a long stall or a background-tab suspension.
    let remaining = dt;
    while (S.phase === 'play' && remaining > 1e-8) {
      const step = Math.min(1 / 60, remaining); update(step); remaining -= step;
    }
    if (S) { syncScene(dt); render(); }
    raf = requestAnimationFrame(frame);
  }
  function gameOver() { if (S.phase === 'over') return; S.phase = 'over'; const scores = campaignScores(S), health = scores.health, outcome = !S.defeatReason && S.bossesKilled === BOSS_TIMES.length ? 'victory' : 'defeat'; if (outcome === 'victory') S.best = Math.max(S.best, scores.total); pushHud(); sfx.over(); onOver({ outcome, reason: S.defeatReason || (outcome === 'defeat' ? 'bosses' : null), health, scores, score: scores.total, best: S.best, bossesKilled: S.bossesKilled, availability: Math.floor(S.availability), dodged: S.dodged, kills: S.kills, elapsed: Math.round(S.elapsed), maxCombo: S.maxCombo, level: S.level, levels: { ...S.levels } }); }

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
    start(best = 0) { S = fresh(); resize(); S.best = best; S.op.x = W / 2; S.op.y = opHome; S.phase = 'play'; onLevelUp([], S.level); recompute(); rebuildUnits(); openLevelUp(); lastTS = performance.now(); sfx.start(); pushHud(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    applyUpgrade,
    chooseUpgrade,
    useAbility,
    pause() { if (S && S.phase === 'play') S.phase = 'paused'; },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; lastTS = performance.now(); } },
    stop() { cancelAnimationFrame(raf); raf = 0; if (S) S.phase = 'idle'; },
    destroy() { cancelAnimationFrame(raf); unbind(); enemies?.dispose(); bullets.dispose(); energy.dispose(); disposeTree(scene); art?.dispose(); Object.values(markTex).forEach(t => t.dispose()); brandTex.dispose(); floorMat.map.dispose(); composer?.dispose(); renderer.dispose(); fx.remove(); },
    resize,
    get diagnostics() { return { art: atmosphere ? 'combined' : sculpted ? 'sangfor' : 'legacy', calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      enemies: S?.enemies.length || 0, shots: S?.shots.length || 0, bulletCapacity: bullets.capacity,
      enemyBatches: enemies?.activeBatches || 0, cachedEnemyBatches: enemies?.cachedBatches || 0,
      rig:art?.rigDiagnostics, modelBuilds, particleCount:S?.parts.length || 0, textCount:S?.texts.length || 0, effectCount:S?.fxr.length || 0, collision:S?.collision.stats,
      programs: renderer.info.programs.length, pixelRatio: renderer.getPixelRatio() }; },
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
  };
}
