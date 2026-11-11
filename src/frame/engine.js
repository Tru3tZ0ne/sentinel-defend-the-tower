// Sentinel Frame - the 3D view and game shell for the mecha shooter in sim.js.
// The fight happens on a flat plane (world X = sim x, world Z = -sim y) above a
// scrolling city of data towers. The star is the SF-01 frame: a procedural mecha
// whose hardpoints fill up with Sangfor products as you dock them. Between runs
// (and on pause) the camera drops into a hangar orbit to show the build off.
// Rules stay in sim.js.

import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import { createSim, FIELD, COLOR, ENEMY, STAGES, PARTS, SLOT, MAXLV, totalLv, tierOf } from './sim.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { sfx } from '../rush/audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const PALETTE = [
  { bg: 0x040d11, fog: 0x06161b, grid: 0x38d6b0, tower: 0x66e0c0, cloud: 0 },
  { bg: 0x070a16, fog: 0x0c1026, grid: 0x5aa0ff, tower: 0xffc070, cloud: 0 },
  { bg: 0x0d0718, fog: 0x1a0e2c, grid: 0xc08aff, tower: 0x8fe0ff, cloud: 0 },
];

export function createFrameGame(canvas, opts = {}) {
  const label = opts.label || (k => k);
  const sim = createSim({ onHud: opts.onHud, onToast: opts.onToast, onOver: opts.onOver, onSfx: (n, a) => sfx[n]?.(a) });
  let S = null;

  const fx2 = document.createElement('canvas'); fx2.className = 'st-fx'; const g2 = fx2.getContext('2d');
  (canvas.parentNode || document.body).insertBefore(fx2, canvas.nextSibling);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.info.autoReset = false; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(PALETTE[0].bg); scene.fog = new THREE.Fog(PALETTE[0].fog, 30, 95);
  const camera = new THREE.PerspectiveCamera(40, 1, .5, 400);
  scene.add(new THREE.HemisphereLight(0xdfeee6, 0x1a2a30, .9));
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.1); sun.position.set(-8, 20, 6); scene.add(sun);
  const rimL = new THREE.DirectionalLight(0x7fe0d0, .8); rimL.position.set(10, 6, -14); scene.add(rimL);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera)); const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .75, .6, .7); composer.addPass(bloom); composer.addPass(new OutputPass());

  // ---------- helpers ----------
  const add = (p, m) => { p.add(m); return m; };
  const glow = (color, opacity = 1, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side });
  const solid = (color, rough = .55, metal = .25, emissive = 0, ei = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color();
  // place a primitive: position, rotation, scale -> baked geometry
  const P = (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  function merge(parts) {
    const flat = parts.map(g => (g.index ? g.toNonIndexed() : g)); let n = 0; for (const g of flat) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const g of flat) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    parts.forEach(g => g.dispose()); flat.forEach(g => g.dispose()); return out;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s), cyl = (a, b, h, s = 10, hs = 1, open = false) => new THREE.CylinderGeometry(a, b, h, s, hs, open), ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
  const H = Math.PI / 2;
  function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

  // ---------- the world below ----------
  const gridTex = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#05090c'; g.fillRect(0, 0, w, w);
    let seed = 5; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${.03 + r01() * .07})`; g.fillRect((r01() * 8 | 0) * 32 + 3, (r01() * 8 | 0) * 32 + 3, 26, 26); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, w); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(126, 0, 4, w); g.fillRect(0, 62, w, 2);
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect((r01() * 8 | 0) * 32 - 2, (r01() * 8 | 0) * 32 - 2, 5, 5); }
  }, true);
  gridTex.repeat.set(14, 26); gridTex.anisotropy = 2;
  const groundMat = new THREE.MeshBasicMaterial({ map: gridTex, color: PALETTE[0].grid });
  const ground = add(scene, new THREE.Mesh(new THREE.PlaneGeometry(190, 340), groundMat)); ground.rotation.x = -H; ground.position.set(0, -17, -90);
  const roofTex = canvasTex(64, 64, (g, w) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, w - 4);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(12, 12, 14, 8); g.fillRect(36, 30, 16, 6); g.fillRect(14, 44, 8, 8); g.fillStyle = '#fff'; g.fillRect(44, 12, 6, 6);
  });
  const TOWERS = 230, LOOP = 150;
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x0d181d, roughness: .7, metalness: .3, emissiveMap: roofTex, emissive: PALETTE[0].tower, emissiveIntensity: .42 });
  const towers = add(scene, new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), towerMat, TOWERS)); towers.frustumCulled = false;
  const tw = [];
  { let seed = 21; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < TOWERS; i++) { const x = (r01() * 2 - 1) * 46, far = Math.abs(x) > 11.5; tw.push({ x, slot: r01() * LOOP, w: 2.5 + r01() * 5, d: 2.5 + r01() * 6, h: far ? 4 + r01() * r01() * 13 : 2 + r01() * 6.5 }); } }
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: PALETTE[0].cloud, depthWrite: false });
  const CLOUDS = 34, clouds = add(scene, new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), cloudMat, CLOUDS)); clouds.frustumCulled = false; clouds.renderOrder = 1;
  const cl = []; for (let i = 0; i < CLOUDS; i++) cl.push({ x: rnd(-34, 34), slot: Math.random() * LOOP, y: rnd(-9, -3.2), s: rnd(5, 13) });
  // faint lane rails mark the edge of the airspace
  for (const s of [-1, 1]) { const rail = add(scene, new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 60), glow(0x9be85a, .22))); rail.position.set(s * (FIELD.w + .15), 0, -11); }

  // ---------- product marks ----------
  const loader = new THREE.TextureLoader(), markTex = {};
  for (const id of ['EDR', 'AF', 'XDR', 'NDR', 'HCI', 'IAG', 'ASTOR', 'MDR']) { const t = loader.load('assets/brand/products/sangfor-' + PRODUCT_MARKS[id][0]); t.colorSpace = THREE.SRGBColorSpace; markTex[id] = t; }
  const brandTex = loader.load('assets/brand/sangfor-logo-white.png'); brandTex.colorSpace = THREE.SRGBColorSpace;

  // ---------- the SF-01 frame ----------
  // Local space: Y up, the frame faces -Z, its right hand is +X. In flight it leans
  // forward so the top-down camera looks straight at its back - where the gear is.
  const UB = new THREE.BoxGeometry(1, 1, 1), LEAN = .87;
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const gm = (g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const bx = (g, mat, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = gm(g, UB, mat, x, y, z, rx, ry, rz); m.scale.set(w, h, d); return m; };
  function bake(g) {            // merge a group's loose boxes into one mesh per material
    const by = new Map();
    for (const c of [...g.children]) { if (!c.isMesh || c.userData.keep) continue; c.updateMatrix(); const geo = c.geometry.clone().applyMatrix4(c.matrix); if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(geo); g.remove(c); }
    for (const [mat, geos] of by) g.add(new THREE.Mesh(merge(geos), mat));
  }
  const M = { white: solid(0xc9d1c8, .5, .2), dark: solid(0x1b2a2f, .55, .4), green: solid(0x12b868, .42, .3, 0x0a6a3c, .45), metal: solid(0x7d8f8c, .3, .8), gold: solid(0xffc94a, .35, .6, 0xa06a08, .5), red: solid(0xd8463a, .45, .3), line: solid(0x0e3a2a, .4, .3, 0x35ffa0, .15) };
  const PM = {}; for (const id of PARTS) PM[id] = solid(COLOR[id], .4, .3, COLOR[id], .5);
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xa4ada7 }), markMat = {};
  for (const id of PARTS) markMat[id] = new THREE.MeshBasicMaterial({ map: markTex[id], transparent: true, depthWrite: false });
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  function decal(g, id, size, x, y, z, rx = 0, ry = 0, rz = 0) {
    const d = grp(g, x, y, z); d.rotation.set(rx, ry, rz);
    const a = gm(d, unitPlane, plateMat); a.scale.set(size * 1.25, size * 1.25, 1); const b = gm(d, unitPlane, markMat[id], 0, 0, .004); b.scale.set(size, size, 1); a.userData.keep = b.userData.keep = true; return d;
  }
  const rig = new THREE.Group(); scene.add(rig);
  const body = grp(rig);
  // torso, hips, shoulders, backpack
  const torso = grp(body);
  bx(torso, M.white, .78, .46, .5, 0, .52, 0); bx(torso, M.green, .5, .3, .12, 0, .56, -.27); bx(torso, M.red, .2, .14, .1, 0, .38, -.27);
  bx(torso, M.gold, .16, .1, .06, -.25, .64, -.26); bx(torso, M.gold, .16, .1, .06, .25, .64, -.26);
  bx(torso, M.dark, .42, .3, .34, 0, .2, 0); bx(torso, M.white, .56, .22, .4, 0, -.02, 0); bx(torso, M.red, .18, .26, .1, 0, -.12, -.22);
  bx(torso, M.white, .2, .3, .08, -.21, -.14, -.22, .15); bx(torso, M.white, .2, .3, .08, .21, -.14, -.22, .15); bx(torso, M.white, .52, .3, .08, 0, -.14, .22, -.15);
  bx(torso, M.dark, .5, .46, .26, 0, .52, .36); bx(torso, M.metal, .12, .2, .12, -.13, .24, .44, -.7); bx(torso, M.metal, .12, .2, .12, .13, .24, .44, -.7);
  for (const s of [-1, 1]) { bx(torso, M.white, .4, .36, .46, s * .66, .7, 0); bx(torso, M.dark, .1, .2, .3, s * .44, .66, 0); bx(torso, M.line, .3, .03, .36, s * .66, .885, 0); bx(torso, M.line, .04, .36, .02, s * .2, .52, .495); }
  bake(torso);
  const head = grp(body, 0, .93, 0);
  bx(head, M.white, .28, .26, .3, 0, .1, 0); bx(head, M.dark, .22, .1, .06, 0, .1, -.15); bx(head, M.red, .08, .1, .1, 0, 0, -.14); bx(head, M.red, .06, .08, .3, 0, .26, 0);
  bx(head, M.gold, .3, .04, .04, -.13, .3, -.14, 0, 0, -.5); bx(head, M.gold, .3, .04, .04, .13, .3, -.14, 0, 0, .5); bx(head, M.dark, .2, .12, .2, 0, -.08, 0);
  bake(head);
  const eyes = bx(head, new THREE.MeshBasicMaterial({ color: 0x7dffb0 }), .2, .04, .02, 0, .12, -.185);
  function limb(side, armNotLeg) {
    const l = armNotLeg ? grp(body, side * .66, .6, 0) : grp(body, side * .2, -.12, 0);
    if (armNotLeg) { bx(l, M.dark, .2, .36, .22, 0, -.22, 0); bx(l, M.white, .26, .42, .3, 0, -.58, 0); bx(l, M.green, .27, .08, .31, 0, -.42, 0); bx(l, M.dark, .16, .14, .18, 0, -.86, 0); }
    else {
      bx(l, M.dark, .24, .46, .28, 0, -.28, 0); bx(l, M.white, .3, .28, .34, 0, -.3, -.03); bx(l, M.white, .32, .62, .38, 0, -.86, 0); bx(l, M.green, .2, .18, .08, 0, -.6, -.2);
      bx(l, M.line, .04, .5, .02, -.09, -.86, .195); bx(l, M.line, .04, .5, .02, .09, -.86, .195); bx(l, M.dark, .26, .1, .3, 0, -1.2, 0); bx(l, M.red, .32, .16, .56, 0, -1.32, -.08);
    }
    bake(l); return l;
  }
  const armR = limb(1, true), armL = limb(-1, true), legR = limb(1, false), legL = limb(-1, false); legR.scale.y = legL.scale.y = 1.22;

  // product parts: PV[id].lv[k] = the groups that level k+1 adds (or swaps in)
  const PV = {}; for (const id of PARTS) PV[id] = { lv: [[], [], []], swap: id === 'EDR' || id === 'AF', shown: 0, pop: 0, anchor: null };
  const pg = (id, k, parent, x, y, z) => { const g = grp(parent, x, y, z); g.visible = false; PV[id].lv[k].push(g); if (!PV[id].anchor) PV[id].anchor = g; return g; };
  let g;
  // Endpoint Secure - right arm beam rifle
  const vulcan = grp(armR, 0, -.8, -.19); bx(vulcan, M.metal, .09, .36, .09); bx(vulcan, PM.EDR, .1, .05, .1, 0, -.19, 0); bake(vulcan);
  g = pg('EDR', 0, armR, 0, -1, -.2); bx(g, M.dark, .15, .52, .2); bx(g, M.white, .17, .2, .1, 0, .05, -.1); bx(g, M.metal, .08, .8, .08, 0, -.62, 0); bx(g, PM.EDR, .11, .1, .11, 0, -1.04, 0); decal(g, 'EDR', .14, 0, .05, -.156, 0, Math.PI);
  g = pg('EDR', 1, armR, 0, -1, -.2); bx(g, M.dark, .19, .62, .22); bx(g, M.white, .21, .24, .1, 0, .08, -.12); bx(g, M.metal, .09, 1, .09, 0, -.78, 0); bx(g, M.metal, .06, .6, .06, .1, -.6, .02); bx(g, PM.EDR, .04, .5, .12, -.11, -.1, 0); bx(g, PM.EDR, .13, .12, .13, 0, -1.3, 0); decal(g, 'EDR', .17, 0, .08, -.176, 0, Math.PI);
  g = pg('EDR', 2, armR, 0, -1, -.2); bx(g, M.dark, .32, .72, .26); bx(g, M.white, .34, .3, .1, 0, .1, -.14); bx(g, M.gold, .12, .1, .12, 0, -.3, -.12);
  for (const sx of [-.09, .09]) { bx(g, M.metal, .11, 1.2, .11, sx, -.92, 0); bx(g, PM.EDR, .14, .14, .14, sx, -1.55, 0); bx(g, PM.EDR, .05, .66, .16, sx * 2, -.05, 0); }
  decal(g, 'EDR', .22, 0, .1, -.196, 0, Math.PI);
  // NGAF - left arm firewall shield
  g = pg('AF', 0, armL, -.1, -.72, -.26); bx(g, M.white, .5, .9, .07); bx(g, PM.AF, .06, .8, .08, -.2, 0, 0); bx(g, PM.AF, .06, .8, .08, .2, 0, 0); bx(g, M.green, .5, .1, .08, 0, .4, 0); decal(g, 'AF', .24, 0, .05, -.042, 0, Math.PI);
  g = pg('AF', 1, armL, -.1, -.72, -.26); bx(g, M.white, .64, 1.2, .08); bx(g, PM.AF, .06, 1.1, .1, -.3, 0, 0); bx(g, PM.AF, .06, 1.1, .1, .3, 0, 0); bx(g, M.white, .34, .34, .08, 0, -.62, 0, 0, 0, Math.PI / 4); bx(g, M.green, .34, .12, .1, 0, .52, 0); decal(g, 'AF', .3, 0, .05, -.046, 0, Math.PI);
  g = pg('AF', 2, armL, -.1, -.72, -.26); bx(g, M.white, .8, 1.45, .09); bx(g, PM.AF, .07, 1.4, .11, -.38, 0, 0); bx(g, PM.AF, .07, 1.4, .11, .38, 0, 0); bx(g, PM.AF, .34, .06, .1, 0, -.4, 0); bx(g, M.gold, .2, .2, .1, 0, .52, 0, 0, 0, Math.PI / 4);
  for (const sx of [-.26, .26]) { bx(g, M.white, .16, .6, .09, sx, -.95, 0); bx(g, PM.AF, .06, .5, .1, sx, -1, 0); }
  decal(g, 'AF', .36, 0, .05, -.05, 0, Math.PI);
  // Cyber Command - head sensor fins, leg missile pods
  g = pg('NDR', 0, head, 0, .3, -.1); bx(g, PM.NDR, .5, .05, .05, -.22, .15, 0, 0, 0, -.6); bx(g, PM.NDR, .5, .05, .05, .22, .15, 0, 0, 0, .6);
  g = pg('NDR', 0, head, 0, .12, .17); gm(g, cyl(.12, .12, .04, 16), M.dark, 0, 0, 0, H); decal(g, 'NDR', .13, 0, 0, .024);
  g = pg('NDR', 1, head, 0, .3, -.06); bx(g, M.white, .72, .04, .04, -.34, .3, 0, 0, 0, -.72); bx(g, M.white, .72, .04, .04, .34, .3, 0, 0, 0, .72); bx(g, PM.NDR, .06, .14, .14, -.17, -.2, 0); bx(g, PM.NDR, .06, .14, .14, .17, -.2, 0);
  g = pg('NDR', 2, head, 0, .5, .05); bx(g, M.white, .04, .6, .04); bx(g, PM.NDR, .08, .1, .08, 0, .3, 0);
  for (const [leg, s] of [[legR, 1], [legL, -1]]) {
    g = pg('NDR', 0, leg, s * .24, -.86, .02); bx(g, M.dark, .14, .42, .28); bx(g, PM.NDR, .12, .05, .24, 0, .22, 0);
    g = pg('NDR', 1, leg, s * .22, -.3, .04); bx(g, M.dark, .12, .34, .26); bx(g, PM.NDR, .1, .05, .22, 0, .18, 0);
    g = pg('NDR', 2, leg, 0, -.9, .26); bx(g, M.dark, .26, .4, .14); bx(g, PM.NDR, .2, .05, .1, 0, .2, 0);
  }
  // HCI - backpack reactor and boosters
  g = pg('HCI', 0, body, 0, .52, .5); bx(g, M.white, .44, .4, .1); gm(g, cyl(.11, .11, .56, 12), M.metal, 0, .3, -.04, 0, 0, H); bx(g, PM.HCI, .08, .24, .24, -.26, .3, -.04); bx(g, PM.HCI, .08, .24, .24, .26, .3, -.04);
  gm(g, cyl(.06, .12, .24, 10), M.metal, -.13, -.3, .02, -.7); gm(g, cyl(.06, .12, .24, 10), M.metal, .13, -.3, .02, -.7); decal(g, 'HCI', .24, 0, 0, .052);
  g = pg('HCI', 1, body, 0, .5, .44); for (const s of [-1, 1]) { bx(g, M.white, .2, .62, .26, s * .4, 0, 0); bx(g, PM.HCI, .21, .06, .27, s * .4, .16, 0); gm(g, cyl(.06, .11, .2, 10), M.metal, s * .4, -.38, .06, -.7); }
  g = pg('HCI', 2, body, 0, 1.02, .5); for (const s of [-1, 1]) { bx(g, M.white, .2, .9, .22, s * .42, 0, .04, .3); bx(g, PM.HCI, .22, .1, .24, s * .42, .4, .16, .3); bx(g, M.dark, .12, .3, .12, s * .42, -.46, -.1); }
  // XDR - wing funnel racks (one pair per level)
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    g = pg('XDR', k, body, s * .24, .66, .52); g.rotation.set(.35, 0, -s * (.5 + k * .5));
    bx(g, M.white, .12, 1.15, .3, 0, .7, 0); bx(g, PM.XDR, .03, 1.05, .32, s * .065, .7, 0); bx(g, PM.XDR, .14, .1, .32, 0, 1.25, 0); bx(g, M.dark, .16, .2, .2, 0, .12, 0);
    if (k === 0) decal(g, 'XDR', .18, 0, .55, .154);
  }
  // IAG - shoulder traffic emitters
  for (const s of [-1, 1]) {
    g = pg('IAG', 0, body, s * .68, .72, .25); gm(g, new THREE.TorusGeometry(.17, .03, 6, 20), PM.IAG); decal(g, 'IAG', .2, 0, 0, 0);
    g = pg('IAG', 1, body, s * .68, .72, .25); gm(g, new THREE.TorusGeometry(.25, .025, 6, 24), PM.IAG); for (let i = 0; i < 4; i++) bx(g, PM.IAG, .05, .12, .05, Math.cos(i * H + H / 2) * .29, Math.sin(i * H + H / 2) * .29, 0, 0, 0, i * H + H / 2 - H);
    g = pg('IAG', 2, body, s * .92, .74, 0); bx(g, M.white, .08, .3, .4); gm(g, cyl(.2, .06, .12, 12), M.dark, s * .08, 0, 0, 0, 0, -s * H); bx(g, PM.IAG, .08, .08, .08, s * .18, 0, 0);
  }
  // aStor - snapshot armor plating
  g = pg('ASTOR', 0, body, 0, -.2, .3); g.rotation.x = -.2; bx(g, M.white, .62, .4, .1); bx(g, PM.ASTOR, .62, .05, .11, 0, -.16, 0); decal(g, 'ASTOR', .2, 0, .03, .052);
  g = pg('ASTOR', 0, body, 0, .7, -.3); bx(g, M.white, .62, .2, .1); bx(g, PM.ASTOR, .3, .05, .11, 0, -.06, 0);
  for (const [leg, s] of [[legR, 1], [legL, -1]]) {
    g = pg('ASTOR', 1, body, s * .7, .93, 0); bx(g, M.white, .5, .1, .54, 0, 0, 0, 0, 0, -s * .2); bx(g, PM.ASTOR, .5, .04, .06, 0, 0, .28, 0, 0, -s * .2);
    g = pg('ASTOR', 1, leg, s * .17, -.3, 0); bx(g, M.white, .08, .42, .36); bx(g, PM.ASTOR, .09, .05, .36, 0, -.18, 0);
    g = pg('ASTOR', 2, leg, 0, -.8, -.22); bx(g, M.white, .36, .56, .08); bx(g, PM.ASTOR, .36, .05, .09, 0, .2, 0);
    g = pg('ASTOR', 2, body, s * .36, -.2, 0); bx(g, M.white, .1, .44, .44, 0, 0, 0, 0, 0, s * .25); bx(g, PM.ASTOR, .11, .05, .44, s * .03, -.16, 0, 0, 0, s * .25);
  }
  for (const id of PARTS) for (const lvl of PV[id].lv) lvl.forEach(bake);

  // thrusters, light wings (Full Armor), field effects
  const flameGeo = new THREE.ConeGeometry(.5, 1, 8); flameGeo.translate(0, .5, 0);
  const FDIR = new THREE.Vector3(0, -1, .3).normalize(), FQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), FDIR);
  const flames = [[-.13, .16, .52, 0], [.13, .16, .52, 0], [-.4, .1, .52, 2], [.4, .1, .52, 2], [-.42, .5, .44, 3], [.42, .5, .44, 3]].map(([x, y, z, need]) => { const f = gm(body, flameGeo, glow(0x7dffd0, .9), x, y, z); f.quaternion.copy(FQ); f.userData.need = need; return f; });
  const wingTex = canvasTex(256, 128, (c, w, h) => {      // feathered light blades fanning out from the root
    for (let i = 0; i < 6; i++) {
      const a = -.42 + i * .17, len = w * (.98 - Math.abs(i - 2.5) * .09), ex = Math.cos(a) * len, ey = h * .5 + Math.sin(a) * len, gr = c.createLinearGradient(0, h * .5, ex, ey);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, 'rgba(170,255,200,.6)'); gr.addColorStop(1, 'rgba(60,255,160,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, h * .5 - 3); c.lineTo(ex, ey); c.lineTo(0, h * .5 + 3); c.fill();
      c.strokeStyle = gr; c.lineWidth = 5; c.beginPath(); c.moveTo(0, h * .5); c.lineTo(ex * .92, h * .5 + (ey - h * .5) * .92); c.stroke();
    }
  });
  const wingGeo = new THREE.PlaneGeometry(2.6, 1.3); wingGeo.translate(1.3, 0, 0);
  const lightWings = [-1, 1].map(s => { const m = gm(body, wingGeo, new THREE.MeshBasicMaterial({ map: wingTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), s * .2, .8, .62); m.scale.x = s; m.rotation.z = s * .45; m.visible = false; return m; });
  const muzzle = gm(armR, ball(.2, 1), glow(0xffa066, 0), 0, -2.1, -.2);
  const shieldMesh = add(rig, new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 14), glow(0xa98bff, .06, THREE.DoubleSide)));
  const shieldRing = add(rig, new THREE.Mesh(new THREE.TorusGeometry(1.55, .035, 6, 48), glow(0xc9b5ff, .9))); shieldRing.rotation.x = H;
  const iagRing = add(scene, new THREE.Mesh(new THREE.RingGeometry(.97, 1, 64), glow(0xffd166, .5, THREE.DoubleSide))); iagRing.rotation.x = -H;
  const iagDisc = add(scene, new THREE.Mesh(new THREE.CircleGeometry(1, 48), glow(0xffd166, .05, THREE.DoubleSide))); iagDisc.rotation.x = -H;
  // the firewall: a wall across the frame's front, and only its front
  const fwGroup = new THREE.Group(); scene.add(fwGroup);
  const fwWall = add(fwGroup, new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, .7, 28, 1, true, Math.PI - .77, 1.54), glow(0x2ee6a0, .3, THREE.DoubleSide)));
  const fwEdge = add(fwGroup, new THREE.Mesh(new THREE.RingGeometry(2.26, 2.38, 28, 1, H - .77, 1.54), glow(0x8dffd0, .9, THREE.DoubleSide))); fwEdge.rotation.x = -H;
  const coreDot = add(scene, new THREE.Mesh(ball(.13, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }))); coreDot.renderOrder = 20;
  const coreRing = add(scene, new THREE.Mesh(new THREE.RingGeometry(.2, .26, 20), new THREE.MeshBasicMaterial({ color: 0x35ffa0, depthTest: false, transparent: true, opacity: .9, side: THREE.DoubleSide }))); coreRing.rotation.x = -H; coreRing.renderOrder = 20;
  // XDR funnels: free-flying, they are where the chain beams start
  const funnelGeo = merge([P(new THREE.OctahedronGeometry(.3), 0, 0, 0, 0, 0, 0, .6, .45, 1.9), P(box(.5, .04, .3), 0, 0, .3)]);
  const FSLOT = [[-2.3, .3], [2.3, .3], [-3.2, -.9], [3.2, -.9], [-1.7, -2.4], [1.7, -2.4]];
  const funnels = FSLOT.map(() => { const f = new THREE.Group(); add(f, new THREE.Mesh(funnelGeo, solid(0xe6ece4, .4, .3, 0x9be85a, .7))); add(f, new THREE.Mesh(ball(.12), glow(0xc8ff9a, .95))).position.z = -.5; f.visible = false; scene.add(f); return f; });
  // hangar pad for the showroom orbit
  const pad = new THREE.Group(); scene.add(pad);
  add(pad, new THREE.Mesh(cyl(2.3, 2.6, .16, 6), solid(0x132329, .5, .6))).position.y = -1.66;
  const padRing = add(pad, new THREE.Mesh(new THREE.TorusGeometry(2.05, .04, 6, 6), glow(0x35ffa0, .8))); padRing.rotation.x = H; padRing.position.y = -1.56;
  const demo = { lv: Object.fromEntries(PARTS.map(id => [id, 0])), step: 0, t: .6 };
  const DEMO_ORDER = ['EDR', 'AF', 'HCI', 'XDR', 'NDR', 'IAG', 'ASTOR'];
  let callout = null, hang = 1, flyPose = 0, tierSm = 0, fwFlash = 0, slowT = 0, rtime = 0, lastTier = 0;

  // ---------- hostile craft (instanced per type; noses point at the player) ----------
  const DESIGN = {
    recon: () => merge([P(cone(.34, 1.25, 8), 0, 0, .25, H), P(box(1.25, .07, .4), 0, 0, -.2), P(box(.08, .34, .45), 0, .14, -.4)]),
    malware: null,
    worm: () => merge([P(ball(.5, 1), 0, 0, 0, 0, 0, 0, 1, .7, 1), P(new THREE.TorusGeometry(.56, .09, 6, 16), 0, 0, 0, H), P(cone(.14, .5, 6), 0, .45, 0)]),
    apt: () => merge([P(cone(.95, 1.5, 3), 0, 0, 0, H, 0, 0, 1, 1, .22), P(box(.2, .16, .9), 0, .12, -.1)]),
    exfil: () => merge([P(box(.95, .34, .7), 0, 0, 0), P(box(.5, .5, .5), 0, .38, 0, 0, .78), P(box(1.7, .06, .3), 0, .05, .1)]),
    turret: () => merge([P(cyl(.9, 1.05, .45, 6), 0, 0, 0), P(ball(.55, 1), 0, .4, 0), P(cyl(.13, .13, 1.0, 8), 0, .5, .55, H)]),
    carrier: () => merge([P(new THREE.CapsuleGeometry(.42, 1.0, 4, 10), 0, 0, 0, 0, 0, H), P(box(.5, .5, .5), 0, 0, 0), P(new THREE.TorusGeometry(.62, .07, 6, 20), 0, 0, 0, 0, H)]),
  };
  // virus-style gunship: a spiked ball
  DESIGN.malware = () => { const parts = [ball(.62, 1)]; for (let i = 0; i < 8; i++) { const a = i * TAU / 8, s = cone(.15, .62, 6); s.rotateZ(-H); s.translate(.88, 0, 0); s.rotateY(a); parts.push(s); } parts.push(P(cone(.16, .55, 6), 0, .72, 0)); return merge(parts); };
  const CAP = 56, types = Object.keys(DESIGN), craft = {};
  for (const t of types) {
    const m = add(scene, new THREE.InstancedMesh(DESIGN[t](), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .45, metalness: .35, emissive: ENEMY[t].color, emissiveIntensity: .32 }), CAP));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, _c.set(0xffffff)); m.frustumCulled = false; m.count = 0; craft[t] = m;
  }
  const ghost = add(scene, new THREE.InstancedMesh(DESIGN.apt(), new THREE.MeshBasicMaterial({ color: 0xa98bff, transparent: true, opacity: .1, depthWrite: false }), 12)); ghost.frustumCulled = false; ghost.count = 0;
  const cores = add(scene, new THREE.InstancedMesh(ball(.2, 1), glow(0xffffff, .9), CAP * 2)); cores.frustumCulled = false; cores.setColorAt(0, _c); cores.count = 0;

  // bosses
  function bossModel(type) {
    const g = new THREE.Group(), col = new THREE.Color(ENEMY[type].color), body = solid(0x1a2630, .4, .6, col, .35), bright = new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(0xffffff), .35) });
    g.userData = { body, parts: [] };
    if (type === 'botnet') {
      add(g, new THREE.Mesh(ball(1.9, 1), body)); add(g, new THREE.Mesh(ball(1.0, 2), bright));
      const orbit = add(g, new THREE.Group()); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const n = add(orbit, new THREE.Mesh(ball(.5, 1), body)); n.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3); const l = add(orbit, new THREE.Mesh(P(cyl(.06, .06, 3, 5), 0, 0, 0, 0, 0, H), bright)); l.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5); l.rotation.y = -a; }
      g.userData.parts.push([orbit, 0, .9, 0]);
    } else if (type === 'ransom') {
      add(g, new THREE.Mesh(merge([P(cyl(2.5, 2.8, 1.1, 8)), P(box(2.3, 1.0, 1.9), 0, .9, .2), P(box(.6, .6, 2.2), -2.0, .2, 1.4), P(box(.6, .6, 2.2), 2.0, .2, 1.4), P(cyl(.35, .35, 2.2, 8), 0, .3, 2.2, H)]), body));
      const sh = add(g, new THREE.Mesh(P(new THREE.TorusGeometry(.85, .22, 8, 20, Math.PI), 0, 1.45, .2), bright)); const key = add(g, new THREE.Mesh(P(ball(.3), 0, 1.0, 1.2), bright));
      const ring = add(g, new THREE.Mesh(P(new THREE.TorusGeometry(3.1, .08, 6, 40), 0, 0, 0, H), bright)); g.userData.parts.push([ring, 0, 1.4, 0]); void sh; void key;
    } else {
      add(g, new THREE.Mesh(ball(1.6, 1), body)); add(g, new THREE.Mesh(ball(.9, 2), bright));
      const shell = add(g, new THREE.Mesh(ball(2.5, 1), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: .7 })));
      const spikes = add(g, new THREE.Mesh((() => { const parts = []; for (let i = 0; i < 10; i++) { const a = i * TAU / 10, s = cone(.3, 1.6, 6); s.rotateZ(-H); s.translate(2.6, 0, 0); s.rotateY(a); parts.push(s); } return merge(parts); })(), body));
      g.userData.parts.push([shell, .5, .8, .3], [spikes, 0, -.6, 0]);
    }
    const aura = add(g, new THREE.Mesh(new THREE.RingGeometry(3.3, 3.6, 48), glow(col, .5, THREE.DoubleSide))); aura.rotation.x = -H; aura.position.y = -.4;
    g.visible = false; scene.add(g); return g;
  }
  const bosses = { botnet: bossModel('botnet'), ransom: bossModel('ransom'), siege: bossModel('siege') };
  const bossLight = new THREE.PointLight(0xff5a6a, 0, 30, 1.5); scene.add(bossLight);

  // ---------- projectiles ----------
  const shotMesh = add(scene, new THREE.InstancedMesh(P(new THREE.CapsuleGeometry(.5, 1, 3, 6), 0, 0, 0, H), glow(0xffffff, .95), 400)); shotMesh.frustumCulled = false; shotMesh.setColorAt(0, _c); shotMesh.count = 0;
  const missMesh = add(scene, new THREE.InstancedMesh(P(cone(.16, .7, 6), 0, 0, 0, -H), new THREE.MeshBasicMaterial({ color: 0xbfe8ff }), 48)); missMesh.frustumCulled = false; missMesh.count = 0;
  const ebOuter = add(scene, new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 440)); ebOuter.frustumCulled = false; ebOuter.setColorAt(0, _c); ebOuter.count = 0;
  const ebCore = add(scene, new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 440)); ebCore.frustumCulled = false; ebCore.count = 0;
  const EB_COL = [new THREE.Color(0xff2a7a), new THREE.Color(0xff8a1e), new THREE.Color(0xa07a2a)];

  // ---------- pickups: product coins ----------
  const coinGeo = cyl(.72, .72, .16, 6), plateGeo = new THREE.CircleGeometry(.6, 24), markGeo = new THREE.PlaneGeometry(.84, .84), haloGeo = new THREE.TorusGeometry(.92, .06, 6, 32);
  const coins = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    add(g, new THREE.Mesh(coinGeo, solid(0xd9e3d2, .4, .4)));
    const plate = add(g, new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ color: 0xc9d2cc }))); plate.rotation.x = -H; plate.position.y = .09;
    const mark = add(g, new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ transparent: true }))); mark.rotation.x = -H; mark.position.y = .1;
    const halo = add(g, new THREE.Mesh(haloGeo, glow(0xffffff, .95))); halo.rotation.x = H;
    const beam = add(g, new THREE.Mesh(cyl(.5, .9, 7, 12, 1), glow(0xffffff, .045, THREE.DoubleSide))); beam.position.y = -3.6;
    coins.push({ g, mark, halo, beam, id: '' });
  }

  // ---------- effects ----------
  const PMAX = 2400, pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 4), pSize = new Float32Array(PMAX), pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pDecay = new Float32Array(PMAX), pDrag = new Float32Array(PMAX);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage)); pGeo.setAttribute('pcolor', new THREE.BufferAttribute(pCol, 4).setUsage(THREE.DynamicDrawUsage)); pGeo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute vec4 pcolor; attribute float psize; varying vec4 vC; uniform float uScale; void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.06, d); gl_FragColor = vec4(vC.rgb * vC.a * a, vC.a * a); }' });
  const points = add(scene, new THREE.Points(pGeo, pMat)); points.frustumCulled = false;
  let pCur = 0;
  function spark(x, y, z, vx, vy, vz, color, size, life = .6, drag = 2) {
    const i = pCur = (pCur + 1) % PMAX; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    _c.set(color); pCol[i * 4] = _c.r; pCol[i * 4 + 1] = _c.g; pCol[i * 4 + 2] = _c.b; pCol[i * 4 + 3] = 1; pSize[i] = size; pLife[i] = 1; pDecay[i] = 1 / life; pDrag[i] = drag;
  }
  function burst(x, z, color, n, speed, size = .22, y = 0) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = (Math.random() - .5) * Math.PI, sp = speed * (.2 + Math.random() * .8); spark(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * .8, Math.sin(a) * Math.cos(e) * sp, color, size * (.5 + Math.random()), .3 + Math.random() * .55); } }
  const ringGeo = new THREE.RingGeometry(.9, 1, 56), rings = []; let ringCur = 0;
  for (let i = 0; i < 40; i++) { const m = add(scene, new THREE.Mesh(ringGeo, glow(0xffffff, 0, THREE.DoubleSide))); m.rotation.x = -H; m.visible = false; rings.push({ m, life: 0, r: 0, max: 1, sp: 8 }); }
  function ringFx(x, z, color, max, sp = 8, y = 0) { const r = rings[ringCur = (ringCur + 1) % rings.length]; r.life = 1; r.r = .2; r.max = max; r.sp = sp; r.m.visible = true; r.m.position.set(x, y, z); r.m.material.color.set(color); }
  const flashGeo = ball(1, 2), flashes = []; let flashCur = 0;
  for (let i = 0; i < 24; i++) { const m = add(scene, new THREE.Mesh(flashGeo, glow(0xffffff, 0))); m.visible = false; flashes.push({ m, life: 0, size: 1 }); }
  function fireball(x, z, color, size, y = 0) { const f = flashes[flashCur = (flashCur + 1) % flashes.length]; f.life = 1; f.size = size; f.m.visible = true; f.m.position.set(x, y, z); f.m.material.color.set(color); }
  // lightning segments for the XDR chain
  const boltGeo = cyl(1, 1, 1, 5, 1), BOLTS = 220;
  const boltLayers = [[3.4, .2], [1, 1]].map(([wide, op]) => { const m = add(scene, new THREE.InstancedMesh(boltGeo, glow(0xffffff, op), BOLTS)); m.frustumCulled = false; m.setColorAt(0, _c); m.count = 0; return { m, wide }; });
  const bA = new THREE.Vector3(), bB = new THREE.Vector3(), bD = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0); let boltN = 0;
  function bolt(ax, az, bx, bz, width, color, jitter, seed) {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.3)); let px = ax, pz = az, py = 0;
    for (let i = 1; i <= n && boltN < BOLTS; i++) {
      const f = i / n, env = Math.sin(f * Math.PI) * jitter, nx = ax + (bx - ax) * f + Math.sin(i * 12.9 + seed * 7) * env, nz = az + (bz - az) * f + Math.cos(i * 9.1 + seed * 5) * env, ny = Math.sin(i * 5.3 + seed * 3) * env * .6;
      bA.set(px, py, pz); bB.set(nx, ny, nz); bD.subVectors(bB, bA); const len = bD.length(); _q.setFromUnitVectors(UP, bD.multiplyScalar(1 / (len || 1))); _p.addVectors(bA, bB).multiplyScalar(.5); _c.set(color);
      for (const L of boltLayers) { L.m.setMatrixAt(boltN, _m.compose(_p, _q, _s.set(width * L.wide, len, width * L.wide))); L.m.setColorAt(boltN, _c); }
      boltN++; px = nx; pz = nz; py = ny;
    }
  }
  const texts = [];
  let banner = null, shake = 0, flashA = 0, flashRGB = '255,255,255', bombWave = 0, bombX = 0, bombZ = 0;
  const bombRing = add(scene, new THREE.Mesh(new THREE.RingGeometry(.86, 1, 96), glow(0x9fe8ff, 0, THREE.DoubleSide))); bombRing.rotation.x = -H; bombRing.visible = false;
  const bombDome = add(scene, new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), glow(0x58c8ff, 0, THREE.BackSide))); bombDome.visible = false;

  function drainFx() {
    const q = sim.fxq;
    for (let i = 0; i < q.length; i++) {
      const f = q[i], x = f.x || 0, z = -(f.y || 0);
      switch (f.t) {
        case 'hit': burst(x, z, f.color, f.big ? 9 : 3, f.big ? 7 : 4, f.big ? .24 : .15); break;
        case 'spark': burst(x, z, f.color, 3, 3, .16); break;
        case 'boom': {
          const y = f.ground ? -1.2 : 0;
          burst(x, z, f.color, f.boss ? 220 : 16 + f.size * 8, f.boss ? 20 : 7 + f.size * 2, f.boss ? .5 : .26, y); burst(x, z, '#fff3c4', f.boss ? 80 : 7, f.boss ? 12 : 5, .2, y);
          fireball(x, z, '#ffd9a0', f.size * 1.1, y); ringFx(x, z, f.color, f.size * (f.boss ? 4 : 2.2), f.boss ? 4 : 9, y);
          if (f.boss) { shake = 1; flashA = .9; flashRGB = '255,240,210'; for (let k = 0; k < 6; k++) { fireball(x + rnd(-2.5, 2.5), z + rnd(-2.5, 2.5), k % 2 ? '#ffffff' : f.color, rnd(2, 4)); ringFx(x + rnd(-2, 2), z + rnd(-2, 2), f.color, 6 + k * 3, 3 + k); } }
          else shake = Math.max(shake, Math.min(.5, f.size * .14));
          break;
        }
        case 'text': texts.push({ x, z, str: f.str, color: f.color, life: 1 }); if (texts.length > 40) texts.shift(); break;
        case 'pick': ringFx(x, z, f.color, 3.2, 10); burst(x, z, f.color, 26, 8, .26); flashA = Math.max(flashA, .18); flashRGB = hexRGB(f.color); if (f.id !== 'MDR' && !f.maxed) callout = { id: f.id, lv: f.lv, life: 1.9 }; break;
        case 'lost': burst(x, z, COLOR[f.id], 40, 11, .3); callout = { id: f.id, lv: -1, life: 1.9 }; break;
        case 'block': burst(x, z, '#8dffd0', 4, 5, .18); fwFlash = 1; break;
        case 'fwBreak': ringFx(x, z, '#ff5a6a', 3.4, 9); burst(x, z - 1.5, '#ff9aa6', 30, 9, .24); shake = Math.max(shake, .5); break;
        case 'fwUp': if (S) ringFx(S.ship.x, -S.ship.y, '#2ee6a0', 2.4, 9); break;
        case 'evolve': banner = { kind: 'evolve', str: label('tier.' + f.tier), sub: label('st.evolved'), life: 3, dur: 3 }; slowT = .9; shake = .8; flashA = .85; flashRGB = '255,240,190';
          for (let k = 0; k < 4; k++) ringFx(x, z, k % 2 ? '#ffe9a8' : '#35ffa0', 6 + k * 5, 4 + k * 1.5); burst(x, z, '#ffe9a8', 160, 18, .4); burst(x, z, '#35ffa0', 90, 12, .3); fireball(x, z, '#ffffff', 4); break;
        case 'bomb': bombWave = 1; bombX = x; bombZ = z; shake = 1; flashA = .7; flashRGB = '160,225,255'; burst(x, z, '#bfefff', 120, 22, .34); break;
        case 'shield': ringFx(x, z, '#c9b5ff', 5, 10); burst(x, z, '#c9b5ff', 50, 10, .28); flashA = .4; flashRGB = '169,139,255'; shake = .6; break;
        case 'shieldUp': if (S) ringFx(S.ship.x, -S.ship.y, '#a98bff', 2.6, 8); break;
        case 'death': burst(x, z, '#ffd9a0', 150, 15, .4); burst(x, z, '#9be85a', 60, 9, .3); fireball(x, z, '#ffffff', 3.4); ringFx(x, z, '#ff5a6a', 8, 5); shake = 1; flashA = .8; flashRGB = '255,90,106'; break;
        case 'warn': banner = { kind: 'warn', str: label('boss.' + f.boss), life: 2.6, dur: 2.6 }; break;
        case 'stage': banner = { kind: 'stage', str: label('stage.' + STAGES[f.stage].id), sub: label('st.stage') + ' ' + (f.stage + 1), life: 3, dur: 3 }; break;
        case 'clear': banner = { kind: 'clear', str: label('st.cleared'), sub: '+' + f.bonus.toLocaleString('en-US'), life: 3.4, dur: 3.4 }; break;
        case 'leak': flashA = Math.max(flashA, .35); flashRGB = '255,209,102'; break;
      }
    }
    q.length = 0;
  }
  function hexRGB(h) { return `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`; }

  // ---------- camera fit ----------
  let W = 1, Hh = 1, dpr = 1, camD = 30;
  const PITCH = 61 * Math.PI / 180, CENTER = new THREE.Vector3(0, 0, -10.2), probe = new THREE.Vector3();
  const lookV = new THREE.Vector3(), hT = new THREE.Vector3(), hP = new THREE.Vector3();
  function placeCamera(d, sx = 0, roll = 0) { camera.position.set(sx * .12, Math.sin(PITCH) * d, CENTER.z + Math.cos(PITCH) * d); camera.up.set(Math.sin(roll), Math.cos(roll), 0); lookV.set(sx * .2, 0, CENTER.z); camera.lookAt(lookV); }
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); Hh = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, Hh, false); composer.setPixelRatio(dpr); composer.setSize(W, Hh);
    if (camera.view) camera.clearViewOffset();
    camera.aspect = W / Hh; camera.fov = W / Hh < .8 ? 46 : 40; camera.updateProjectionMatrix();
    // pull back until the whole airspace (with HUD margins) is on screen
    const topPad = 1 - 2 * 62 / Hh, botPad = 1 - 2 * 30 / Hh;
    for (camD = 18; camD < 90; camD += .5) {
      placeCamera(camD); camera.updateMatrixWorld(); let ok = true;
      for (const [x, z] of [[FIELD.w + .3, .4], [-FIELD.w - .3, .4], [FIELD.w + .3, -FIELD.h], [-FIELD.w - .3, -FIELD.h]]) { probe.set(x, 0, z).project(camera); if (Math.abs(probe.x) > .985 || probe.y > topPad || probe.y < -botPad) ok = false; }
      if (ok) break;
    }
    pMat.uniforms.uScale.value = Hh * dpr * .95;
    fx2.width = Math.round(W * dpr); fx2.height = Math.round(Hh * dpr); g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- input ----------
  const keys = new Set(), ptr = { mode: 'keys', x: 0, y: 0, id: null, sx: 0, sy: 0, px: 0, py: 0, tx: 0, ty: 3 };
  let bombQ = 0;
  const input = { mx: 0, my: 0, tx: null, ty: null, bomb: false, slow: false };
  const KMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', Shift: 'slow', ' ': 'bomb', b: 'bomb', B: 'bomb', x: 'bomb', X: 'bomb' };
  function onKey(e, down) { const k = KMAP[e.key]; if (!k || e.target?.tagName === 'INPUT') return; if (down) { keys.add(k); if (k.length === 1) ptr.mode = 'keys'; } else keys.delete(k); if (S?.phase === 'play') e.preventDefault(); }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function toField(ev) { const r = canvas.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / W * 2 - 1, -((ev.clientY - r.top) / Hh) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: -hit.z } : null; }
  function pDown(ev) {
    if (S?.phase !== 'play') return; const f = toField(ev); if (!f) return;
    if (ev.pointerType === 'mouse') { if (ev.button === 2) { bombQ = 2; return; } ptr.mode = 'mouse'; ptr.tx = f.x; ptr.ty = f.y; return; }
    ev.preventDefault(); if (ptr.id !== null) return;
    ptr.mode = 'touch'; ptr.id = ev.pointerId; ptr.sx = S.ship.x; ptr.sy = S.ship.y; ptr.px = f.x; ptr.py = f.y; ptr.tx = S.ship.x; ptr.ty = S.ship.y;
  }
  function pMove(ev) {
    if (S?.phase !== 'play') return; const f = toField(ev); if (!f) return;
    if (ev.pointerType === 'mouse') { if (ev.target !== canvas && ptr.mode !== 'mouse') return; ptr.mode = 'mouse'; ptr.tx = f.x; ptr.ty = f.y; }
    else if (ev.pointerId === ptr.id) { ptr.tx = ptr.sx + (f.x - ptr.px) * 1.25; ptr.ty = ptr.sy + (f.y - ptr.py) * 1.25; }
  }
  function pUp(ev) { if (ev.pointerId === ptr.id) { ptr.id = null; ptr.mode = 'keys'; } }
  const noMenu = e => e.preventDefault(), clearKeys = () => { keys.clear(); ptr.id = null; };
  canvas.addEventListener('pointerdown', pDown); window.addEventListener('pointermove', pMove); window.addEventListener('pointerup', pUp); window.addEventListener('pointercancel', pUp);
  canvas.addEventListener('contextmenu', noMenu); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize); window.addEventListener('blur', clearKeys);
  function readInput() {
    input.mx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0); input.my = (keys.has('u') ? 1 : 0) - (keys.has('d') ? 1 : 0); input.slow = keys.has('slow');
    if (ptr.mode === 'keys') input.tx = input.ty = null; else { input.tx = ptr.tx; input.ty = ptr.ty; }
    input.bomb = keys.has('bomb') || bombQ > 0; if (bombQ > 0) bombQ--;
  }

  // ---------- frame sync ----------
  let time = 0, scroll = 0, bank = 0;
  const palBg = new THREE.Color(PALETTE[0].bg), palFog = new THREE.Color(PALETTE[0].fog), palGrid = new THREE.Color(PALETTE[0].grid), palTower = new THREE.Color(PALETTE[0].tower);
  function setInst(mesh, i, x, y, z, rx, ry, rz, sx, sy, sz) { _e.set(rx, ry, rz); _q.setFromEuler(_e); mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz))); }
  function sync(dt, rdt) {
    time += dt; rtime += rdt; drainFx();
    const live = !!S && S.phase !== 'over', warp = live ? S.warp : 0;
    scroll += dt * (6 + warp * 30);
    // stage palette
    const pal = PALETTE[live ? S.stage : 0], k = Math.min(1, dt * 1.2);
    palBg.lerp(_c.set(pal.bg), k); palFog.lerp(_c.set(pal.fog), k); palGrid.lerp(_c.set(pal.grid), k); palTower.lerp(_c.set(pal.tower), k);
    scene.background.copy(palBg); scene.fog.color.copy(palFog); groundMat.color.copy(palGrid).multiplyScalar(.3 + warp * .5); towerMat.emissive.copy(palTower);
    cloudMat.opacity += (pal.cloud - cloudMat.opacity) * k;
    gridTex.offset.y = (scroll / (340 / 26)) % 1;
    for (let i = 0; i < TOWERS; i++) { const t = tw[i], z = ((t.slot + scroll) % LOOP) - 125; setInst(towers, i, t.x, -17 + t.h / 2, z, 0, 0, 0, t.w, t.h, t.d); }
    towers.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < CLOUDS; i++) { const c = cl[i], z = ((c.slot + scroll * 1.7) % LOOP) - 120; setInst(clouds, i, c.x, c.y, z, 0, 0, 0, c.s, c.s * .16, c.s * .75); }
    clouds.instanceMatrix.needsUpdate = true; clouds.visible = cloudMat.opacity > .01;
    if (warp > .05) for (let i = 0; i < 4; i++) spark(rnd(-12, 12), rnd(-2, 1), -24, 0, 0, 55 + warp * 60, '#bfffe6', .12, .5, 0);

// the frame: build, pose, hardpoints
    const p = live ? S.ship : null, playing = live && S.phase === 'play';
    if (!S) { demo.t -= rdt; if (demo.t <= 0) { if (demo.step >= 21) { demo.step = 0; for (const id of PARTS) demo.lv[id] = 0; demo.t = 1.2; } else { const id = DEMO_ORDER[demo.step % 7]; demo.lv[id]++; demo.step++; callout = { id, lv: demo.lv[id], life: 1.5 }; demo.t = demo.step >= 21 ? 5 : 1.05; } } }
    const build = S ? S.lv : demo.lv, tier = tierOf(totalLv(build));
    hang += ((playing ? 0 : 1) - hang) * Math.min(1, rdt * (playing ? 6 : 3)); flyPose += ((live ? 1 : 0) - flyPose) * Math.min(1, rdt * 5); tierSm += (tier - tierSm) * Math.min(1, rdt * 4);
    if (live) { rig.position.set(p.x, 0, -p.y); rig.visible = p.dead <= 0 && S.lives > 0 && (p.inv <= 0 || S.mode === 'clear' || !playing || Math.floor(time * 16) % 2 === 0); bank += (clamp(p.vx / 12, -1, 1) - bank) * Math.min(1, dt * 10); }
    else { rig.visible = true; rig.position.lerp(_p.set(0, 0, CENTER.z), Math.min(1, rdt * 6)); bank *= 1 - Math.min(1, rdt * 5); }
    if (!S && tier > lastTier) { ringFx(rig.position.x, rig.position.z, '#ffe9a8', 5, 6, -1.5); burst(rig.position.x, rig.position.z, '#ffe9a8', 60, 9, .3); }
    lastTier = tier;
    const sway = Math.sin(rtime * 2.2);
    body.scale.setScalar(1 + tierSm * .07); rig.scale.setScalar(1 + .45 * flyPose); bloom.strength = .75 - .4 * hang; body.rotation.x = -LEAN * flyPose + (live ? clamp(-p.vy / 40, -.15, .15) : 0); body.position.set(0, sway * .04, .42 * flyPose);
    rig.rotation.z = -bank * .55; head.rotation.x = .62 * flyPose;
    const kick = live ? p.muzzle * .03 : 0;
    armR.rotation.x = .3 + (LEAN + H - .3) * flyPose - kick; armR.rotation.z = (1 - flyPose) * .12 - flyPose * .14; armL.rotation.x = .5 + (LEAN + H - .62) * flyPose; armL.rotation.z = -(1 - flyPose) * .14 - flyPose * .12;
    legR.rotation.x = flyPose * (-.2 + sway * .05) - bank * .1; legL.rotation.x = flyPose * (-.3 - sway * .05) + bank * .1;
    M.line.emissiveIntensity = .15 + tierSm * .55 + (tier >= 3 ? .25 * Math.sin(rtime * 5) : 0); eyes.material.color.set(tier >= 3 ? 0xffe9a8 : 0x7dffb0);
    for (const id of PARTS) {
      const v = PV[id], lv = build[id] || 0;
      if (lv > v.shown) { v.pop = 1; if (v.anchor) { v.anchor.getWorldPosition(pv); burst(pv.x, pv.z, COLOR[id], 22, 6, .22, pv.y); } }
      v.shown = lv; v.pop = Math.max(0, v.pop - rdt * 2.6);
      for (let k = 0; k < 3; k++) { const on = v.swap ? lv === k + 1 : lv >= k + 1, sc = k + 1 === lv ? 1 + Math.sin(v.pop * Math.PI) * .55 : 1; for (const gr of v.lv[k]) { gr.visible = on; if (on) gr.scale.setScalar(sc); } }
    }
    vulcan.visible = !build.EDR;
    flames.forEach(f => { f.visible = build.HCI >= f.userData.need; const s = (.5 + Math.random() * .35 + warp * 1.6 + (live ? Math.max(0, p.vy) * .03 : 0)) * (f.userData.need ? 1.25 : 1 + (build.HCI ? .5 : 0)) * (.45 + .55 * flyPose); f.scale.set(.16 + (f.userData.need ? .05 : 0), s, .16 + (f.userData.need ? .05 : 0)); f.material.opacity = .4 + Math.random() * .2; });
    lightWings.forEach((w, i) => { w.visible = tierSm > 2.05; if (w.visible) { w.material.opacity = Math.min(.7, (tierSm - 2.05) * 1.4) * (.75 + .25 * Math.sin(rtime * 7 + i)); w.rotation.z = (i ? 1 : -1) * (.4 + .08 * Math.sin(rtime * 3 + i)); w.scale.y = 1 + .1 * Math.sin(rtime * 9 + i * 2); } });
    muzzle.material.opacity = live ? p.muzzle * .8 : 0;
    if (rig.visible && live && Math.random() < .8) spark(rig.position.x + rnd(-.45, .45), -.2, rig.position.z + 1.6, rnd(-.4, .4), 0, 9 + warp * 20, build.HCI ? '#7dd8ff' : '#7dffd0', .16 + build.HCI * .03, .35, 0);
    const sh = live ? S.shield : 0; shieldMesh.visible = shieldRing.visible = sh > 0 && rig.visible;
    if (sh > 0) { shieldMesh.material.opacity = .03 + .015 * Math.sin(time * 5) + sh * .02; shieldRing.rotation.z = time * 2; shieldRing.scale.setScalar(1 + .03 * Math.sin(time * 6)); }
    const iag = live ? S.lv.IAG : 0; iagRing.visible = iagDisc.visible = iag > 0 && p.dead <= 0;
    if (iag > 0) { const r = 3 + iag * .5; iagRing.position.set(p.x, -.05, -p.y); iagDisc.position.copy(iagRing.position); iagRing.scale.setScalar(r); iagDisc.scale.setScalar(r); iagRing.material.opacity = .32 + .14 * Math.sin(time * 4); }
    fwFlash = Math.max(0, fwFlash - dt * 5);
    fwGroup.visible = live && S.lv.AF > 0 && p.dead <= 0 && S.lives > 0;
    if (fwGroup.visible) {
      const frac = S.fw / (S.lv.AF === 1 ? 5 : S.lv.AF === 2 ? 8 : 12), down = S.fwDown;
      fwGroup.position.set(p.x, 0, -p.y); fwGroup.scale.setScalar(1 + fwFlash * .06);
      fwWall.material.color.set(down ? 0xff5a6a : 0x2ee6a0); fwEdge.material.color.set(down ? 0xff7a8a : 0x8dffd0);
      fwWall.material.opacity = down ? .05 + .05 * Math.sin(time * 18) : .06 + frac * .24 + fwFlash * .4; fwEdge.material.opacity = down ? .2 + .15 * Math.sin(time * 18) : .25 + frac * .65 + fwFlash * .3;
    }
    coreDot.visible = coreRing.visible = playing && p.dead <= 0 && rig.visible;
    if (coreDot.visible) { coreDot.position.set(p.x, 0, -p.y); coreRing.position.copy(coreDot.position); coreRing.rotation.z = time * 3; }
    const nFun = live && p.dead <= 0 ? S.lv.XDR * 2 : 0;
    funnels.forEach((f, i) => {
      const on = i < nFun; if (on && !f.visible) f.position.set(p.x, 0, -p.y); f.visible = on; if (!on) return;
      const tx = p.x + FSLOT[i][0] + Math.sin(time * 2 + i * 1.7) * .25, tz = -(p.y + FSLOT[i][1]) + Math.cos(time * 1.6 + i) * .2, k = Math.min(1, dt * (7 - i * .6));
      f.position.x += (tx - f.position.x) * k; f.position.z += (tz - f.position.z) * k; f.position.y = Math.sin(time * 3 + i) * .15; f.rotation.z = (f.position.x - tx) * .6; f.rotation.y = Math.sin(time * 1.3 + i) * .2;
    });
    pad.visible = !live && hang > .02; if (pad.visible) { pad.position.copy(rig.position); pad.position.y -= 1.83 * (1 + tierSm * .07) - 1.56; pad.scale.setScalar(.6 + .4 * hang); padRing.rotation.z = rtime * .4; }
    if (callout) { callout.life -= rdt; if (callout.life <= 0) callout = null; }

        // hostile craft
    const count = {}; for (const t of types) count[t] = 0; let nGhost = 0, nCore = 0, bossSeen = null;
    if (live) for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.spec.boss) { bossSeen = e; continue; }
      const z = -e.y, y = e.spec.ground ? -1.3 : 0, born = clamp(e.age / .35, .2, 1);
      if (e.cloaked) { if (nGhost < 12) setInst(ghost, nGhost++, e.x, 0, z, 0, 0, 0, 1, 1, 1); continue; }
      const m = craft[e.type], i = count[e.type]; if (i >= CAP) continue;
      let rx = 0, ry = 0, rz = 0;
      if (e.type === 'malware') { ry = e.rot * 1.4; rx = .25; } else if (e.type === 'worm') { ry = e.rot * 3; } else if (e.type === 'turret') ry = Math.atan2(S.ship.x - e.x, e.y - S.ship.y);
      else if (e.type === 'exfil') { ry = Math.PI; rz = Math.sin(e.rot * 5) * .2; } else if (e.type === 'carrier') { rz = Math.sin(e.rot * 2) * .15; } else { ry = Math.atan2(e.vx, -e.vy) * .8; rz = -clamp(e.vx / 7, -1, 1) * .7; }
      setInst(m, i, e.x, y, z, rx, ry, rz, born, born, born);
      m.setColorAt(i, e.hit > 0 ? _c.setRGB(2.4, 2.4, 2.4) : _c.set(e.spec.color).lerp(_c2.set(0xffffff), .28)); count[e.type] = i + 1;
      if (nCore < CAP * 2) { setInst(cores, nCore, e.x, y + (e.type === 'turret' ? .55 : .12), z, 0, 0, 0, e.r * 1.5, e.r * 1.5, e.r * 1.5); cores.setColorAt(nCore++, _c.set(e.spec.color)); }
    }
    for (const t of types) { const m = craft[t]; m.count = count[t]; m.visible = count[t] > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    ghost.count = nGhost; ghost.visible = nGhost > 0; ghost.instanceMatrix.needsUpdate = true;
    cores.count = nCore; cores.visible = nCore > 0; cores.instanceMatrix.needsUpdate = true; if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    for (const [type, g] of Object.entries(bosses)) {
      const on = bossSeen && bossSeen.type === type; g.visible = !!on; if (!on) continue;
      g.position.set(bossSeen.x, 0, -bossSeen.y); g.rotation.z = Math.sin(time * 1.3) * .05;
      const u = g.userData; u.body.emissiveIntensity = bossSeen.hit > 0 ? 2.2 : .35 + (bossSeen.hp < bossSeen.maxhp * .4 ? .35 + .3 * Math.sin(time * 12) : 0);
      for (const [part, rx, ry, rz] of u.parts) { part.rotation.x += rx * dt; part.rotation.y += ry * dt; part.rotation.z += rz * dt; }
      const ghosted = bossSeen.cloaked; g.traverse(o => { if (o.isMesh) { o.material.transparent = o.material.transparent || ghosted; if (ghosted) o.material.opacity = .14; else if (o.material.blending !== THREE.AdditiveBlending && !o.material.wireframe) o.material.opacity = 1; } });
      bossLight.color.set(bossSeen.spec.color); bossLight.position.set(bossSeen.x, 3, -bossSeen.y); bossLight.intensity = 60;
      if (bossSeen.hp < bossSeen.maxhp * .4 && Math.random() < dt * 20) burst(bossSeen.x + rnd(-2, 2), -bossSeen.y + rnd(-2, 2), '#ffb070', 5, 5, .22);
    }
    if (!bossSeen) bossLight.intensity = 0;

    // shots, missiles, hostile bullets
    let n = 0;
    if (live) for (const s of S.shots) { if (n >= 400) break; const af = s.kind === 'AF'; setInst(shotMesh, n, s.x, 0, -s.y, 0, Math.atan2(s.vx, -s.vy), 0, af ? .2 : .11, af ? .2 : .11, af ? 1.5 : .62); shotMesh.setColorAt(n++, _c.set(af ? 0x45ffb4 : 0xffa066)); }
    shotMesh.count = n; shotMesh.visible = n > 0; shotMesh.instanceMatrix.needsUpdate = true; if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;
    n = 0;
    if (live) for (const m of S.missiles) { if (n >= 48) break; setInst(missMesh, n++, m.x, 0, -m.y, 0, -Math.atan2(m.vx, m.vy), 0, 1, 1, 1); if (Math.random() < .8) spark(m.x, 0, -m.y, rnd(-.6, .6), rnd(-.3, .3), rnd(-.6, .6), '#58c8ff', .17, .3, 1); }
    missMesh.count = n; missMesh.visible = n > 0; missMesh.instanceMatrix.needsUpdate = true;
    n = 0;
    if (live) for (const b of S.eb) { if (n >= 440) break; const pulse = 1 + .16 * Math.sin(time * 14 + b.age * 9), r = b.r * 1.45 * pulse; setInst(ebOuter, n, b.x, 0, -b.y, 0, 0, 0, r, r, r); ebOuter.setColorAt(n, EB_COL[b.slow ? 2 : b.kind]); setInst(ebCore, n, b.x, .35, -b.y, 0, 0, 0, b.r * .7, b.r * .7, b.r * .7); n++; }
    ebOuter.count = ebCore.count = n; ebOuter.visible = ebCore.visible = n > 0; ebOuter.instanceMatrix.needsUpdate = ebCore.instanceMatrix.needsUpdate = true; if (ebOuter.instanceColor) ebOuter.instanceColor.needsUpdate = true;

    // pickups
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i], it = live ? S.items[i] : null; c.g.visible = !!it; if (!it) continue;
      const id = sim.itemId(it);
      if (c.id !== id) { c.id = id; c.mark.material.map = markTex[id]; c.mark.material.needsUpdate = true; c.halo.material.color.set(COLOR[id]); c.beam.material.color.set(COLOR[id]); if (it.age > .1) ringFx(it.x, -it.y, COLOR[id], 1.6, 12); }
      const flip = it.cands.length > 1 && it.cyc > 1.35 ? Math.abs(Math.cos((it.cyc - 1.35) / .25 * Math.PI)) : 1;
      c.g.position.set(it.x, .1 + Math.sin(time * 4 + i) * .12, -it.y); c.g.scale.set(1.25 * flip + .05, 1.25, 1.25); c.halo.rotation.z = time * 3; c.halo.scale.setScalar(1 + .08 * Math.sin(time * 7));
    }

    // XDR chain
    boltN = 0;
    if (live) for (const a of S.arcs) { const w = .07 * Math.sqrt(Math.max(.05, a.life / .16)); for (let i = 1; i < a.pts.length; i++) { const fn = i === 1 && nFun ? funnels[a.n % nFun] : null; bolt(fn ? fn.position.x : a.pts[i - 1].x, fn ? fn.position.z : -a.pts[i - 1].y, a.pts[i].x, -a.pts[i].y, w, i === 1 ? '#eaffd0' : '#9be85a', .45, time * 30 + i); if (Math.random() < .5) spark(a.pts[i].x, 0, -a.pts[i].y, rnd(-3, 3), rnd(-1, 1), rnd(-3, 3), '#c8ff9a', .2, .25); } }
    for (const L of boltLayers) { L.m.count = boltN; L.m.visible = boltN > 0; L.m.instanceMatrix.needsUpdate = true; if (L.m.instanceColor) L.m.instanceColor.needsUpdate = true; }

    // effects
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) continue; pLife[i] -= dt * pDecay[i]; if (pLife[i] <= 0) { pCol[i * 4 + 3] = 0; pSize[i] = 0; continue; }
      const dk = 1 - Math.min(1, dt * pDrag[i]); pVel[i * 3] *= dk; pVel[i * 3 + 1] *= dk; pVel[i * 3 + 2] = pVel[i * 3 + 2] * dk + dt * 6 * (pDrag[i] > 0 ? 1 : 0);
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; pCol[i * 4 + 3] = Math.min(1, pLife[i] * 1.8);
    }
    pGeo.attributes.position.needsUpdate = pGeo.attributes.pcolor.needsUpdate = pGeo.attributes.psize.needsUpdate = true;
    for (const r of rings) { if (r.life <= 0) continue; r.life -= dt * 2.4; if (r.life <= 0) { r.m.visible = false; continue; } r.r += (r.max - r.r) * Math.min(1, dt * r.sp); r.m.scale.setScalar(r.r); r.m.material.opacity = r.life * .8; }
    for (const f of flashes) { if (f.life <= 0) continue; f.life -= dt * 4.5; if (f.life <= 0) { f.m.visible = false; continue; } f.m.scale.setScalar(f.size * (1.25 - f.life * .7)); f.m.material.opacity = f.life * .9; }
    if (bombWave > 0) { bombWave -= dt / 1.1; const r = (1 - bombWave) * 30 + 1; bombRing.visible = bombDome.visible = bombWave > 0; bombRing.position.set(bombX, .05, bombZ); bombRing.scale.setScalar(r); bombRing.material.opacity = bombWave * .9; bombDome.position.set(bombX, 0, bombZ); bombDome.scale.setScalar(r); bombDome.material.opacity = bombWave * .22; }
    for (let i = texts.length - 1; i >= 0; i--) { texts[i].life -= dt * 1.2; texts[i].z -= dt * 1.5; if (texts[i].life <= 0) texts.splice(i, 1); }
    if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
    shake = Math.max(0, shake - dt * 2.6); flashA = Math.max(0, flashA - dt * 2.4);
    const sx = live ? S.ship.x : 0;
    placeCamera(camD, sx, -bank * .02); camera.position.x += rnd(-1, 1) * shake * .35; camera.position.y += rnd(-1, 1) * shake * .3;
    if (hang > .003) {            // hangar orbit: start screen, pause, result
      const e = hang * hang * (3 - 2 * hang), a = Math.PI + .75 + rtime * .32, wide = camera.aspect >= 1, D = (wide ? 7.2 : 12) * (1 + tierSm * .05) * (live ? 1.7 : 1);
      hT.copy(rig.position); hT.y += live ? 0 : .05; hP.set(hT.x + Math.sin(a) * D, hT.y + (live ? 5 : 1.2), hT.z + Math.cos(a) * D);
      camera.position.lerp(hP, e); lookV.lerp(hT, e); camera.up.set(0, 1, 0); camera.lookAt(lookV);
      const off = live ? 0 : e; camera.setViewOffset(W, Hh, wide ? W * .2 * off : 0, wide ? 0 : Hh * .27 * off, W, Hh);
    } else if (camera.view) camera.clearViewOffset();
  }

  // ---------- overlay ----------
  const pv = new THREE.Vector3();
  const proj = (x, z) => { pv.set(x, 0, z).project(camera); return [(pv.x * .5 + .5) * W, (-pv.y * .5 + .5) * Hh]; };
  function overlay() {
    g2.clearRect(0, 0, W, Hh);
    const vg = g2.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * .35, W / 2, Hh / 2, Math.max(W, Hh) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,4,8,.5)'); g2.fillStyle = vg; g2.fillRect(0, 0, W, Hh);
    g2.textAlign = 'center';
    for (const t of texts) { const [x, y] = proj(t.x, t.z); g2.font = '800 13px ui-sans-serif,system-ui,sans-serif'; g2.fillStyle = `rgba(0,0,0,${t.life * .6})`; g2.fillText(t.str, x + 1, y + 1); g2.fillStyle = `rgba(${hexRGB(t.color)},${Math.min(1, t.life * 1.5)})`; g2.fillText(t.str, x, y); }
    if (S && S.phase === 'play') for (const it of S.items) { const [x, y] = proj(it.x, -it.y - 1.3); const id = sim.itemId(it); g2.font = '800 11px ui-sans-serif,system-ui,sans-serif'; g2.fillStyle = 'rgba(0,0,0,.6)'; g2.fillText(label('code.' + id), x + 1, y + 1); g2.fillStyle = COLOR[id]; g2.fillText(label('code.' + id), x, y); }
    if (banner && S && S.phase === 'play') {
      const a = Math.min(1, banner.life * 2, (banner.dur - banner.life) * 4), cy = Hh * .36, big = Math.min(54, W * .085);
      if (banner.kind === 'warn') {
        const blink = .55 + .45 * Math.sin(time * 14); g2.fillStyle = `rgba(255,40,70,${a * .16 * blink})`; g2.fillRect(0, cy - big * 1.5, W, big * 3);
        g2.fillStyle = `rgba(255,70,95,${a * blink})`; for (const yy of [cy - big * 1.5, cy + big * 1.5 - 6]) for (let x = -40 + (time * 60) % 40; x < W; x += 40) { g2.beginPath(); g2.moveTo(x, yy); g2.lineTo(x + 20, yy); g2.lineTo(x + 10, yy + 6); g2.lineTo(x - 10, yy + 6); g2.fill(); }
        g2.font = `900 ${big}px ui-sans-serif,system-ui,sans-serif`; g2.fillStyle = `rgba(255,90,110,${a})`; g2.fillText('WARNING', W / 2, cy); g2.font = `700 ${big * .34}px ui-sans-serif,system-ui,sans-serif`; g2.fillStyle = `rgba(255,220,225,${a})`; g2.fillText(banner.str, W / 2, cy + big * .7);
      } else {
        g2.font = `600 ${big * .3}px ui-sans-serif,system-ui,sans-serif`; g2.fillStyle = `rgba(155,232,90,${a})`; g2.fillText((banner.sub || '').toUpperCase(), W / 2, cy - big * .75);
        g2.font = `900 ${big * .8}px ui-sans-serif,system-ui,sans-serif`; g2.shadowColor = 'rgba(155,232,90,.8)'; g2.shadowBlur = 18; g2.fillStyle = `rgba(240,255,235,${a})`; g2.fillText(banner.str, W / 2, cy); g2.shadowBlur = 0;
      }
    }
    if (callout && PV[callout.id]?.anchor && rig.visible) {     // a part just docked (or was torn off): name the hardpoint
      PV[callout.id].anchor.getWorldPosition(pv); pv.project(camera); const ax = (pv.x * .5 + .5) * W, ay = (-pv.y * .5 + .5) * Hh, a = Math.min(1, callout.life * 3), lost = callout.lv < 0;
      const right = ax < W * .5 && S ? 1 : (S ? -1 : (ax > W * .32 ? 1 : -1)), lx = clamp(ax + right * 64, 96, W - 96), ly = Math.max(70, ay - 46), col = lost ? '#ff7a8a' : COLOR[callout.id];
      g2.strokeStyle = `rgba(${hexRGB(col)},${a})`; g2.lineWidth = 1.5; g2.beginPath(); g2.moveTo(ax, ay); g2.lineTo(lx, ly + 6); g2.lineTo(lx + right * 26, ly + 6); g2.stroke(); g2.fillStyle = `rgba(${hexRGB(col)},${a})`; g2.beginPath(); g2.arc(ax, ay, 3.5, 0, TAU); g2.fill();
      g2.textAlign = right > 0 ? 'left' : 'right'; const tx = lx + right * 2;
      g2.font = '700 10px ui-sans-serif,system-ui,sans-serif'; g2.fillStyle = `rgba(0,0,0,${a * .7})`; g2.fillText(label('slot.' + SLOT[callout.id]).toUpperCase(), tx + 1, ly - 13); g2.fillStyle = `rgba(215,235,225,${a})`; g2.fillText(label('slot.' + SLOT[callout.id]).toUpperCase(), tx, ly - 14);
      const line = label('name.' + callout.id) + (lost ? ' - ' + label('st.lost') : '  Lv ' + callout.lv + (callout.lv >= MAXLV ? ' MAX' : ''));
      g2.font = '800 14px ui-sans-serif,system-ui,sans-serif'; g2.fillStyle = `rgba(0,0,0,${a * .7})`; g2.fillText(line, tx + 1, ly + 1); g2.fillStyle = `rgba(${hexRGB(col)},${a})`; g2.fillText(line, tx, ly); g2.textAlign = 'center';
    }
    if (flashA > 0) { g2.fillStyle = `rgba(${flashRGB},${flashA * .28})`; g2.fillRect(0, 0, W, Hh); }
  }

  // ---------- loop ----------
  let raf = 0, last = performance.now(), frames = 0;
  function frame(ts) {
    const dt = Math.min(.25, Math.max(0, (ts - last) / 1000 || 0)); last = ts; frames++;
    slowT = Math.max(0, slowT - dt); const sdt = dt * (slowT > 0 ? .3 : 1);
    if (S && S.phase === 'play') { readInput(); let left = sdt; while (S.phase === 'play' && left > 1e-8) { const st = Math.min(1 / 60, left); sim.step(st, input); left -= st; } }
    sync(S && (S.phase === 'paused' || S.phase === 'over') ? 0 : sdt, dt);
    renderer.info.reset(); composer.render(); overlay();
    raf = requestAnimationFrame(frame);
  }
  resize(); raf = requestAnimationFrame(frame);

  return {
    start() { S = sim.start(); resize(); texts.length = 0; banner = null; callout = null; slowT = 0; for (const id of PARTS) PV[id].shown = 0; ptr.mode = 'keys'; ptr.id = null; keys.clear(); last = performance.now(); return S; },
    bomb() { bombQ = 2; },
    grant: id => sim.grant(id),
    pause() { if (S && S.phase === 'play') S.phase = 'paused'; },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; last = performance.now(); } },
    stop() { S = null; },
    resize,
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('pointermove', pMove); window.removeEventListener('pointerup', pUp); window.removeEventListener('pointercancel', pUp); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('blur', clearKeys); composer.dispose(); renderer.dispose(); fx2.remove(); },
    get diagnostics() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, camD, hang, tier: S ? S.tier : tierOf(totalLv(demo.lv)), enemies: S?.enemies.length || 0, bullets: S?.eb.length || 0, shots: S?.shots.length || 0 }; },
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
    sim, demo,
  };
}
