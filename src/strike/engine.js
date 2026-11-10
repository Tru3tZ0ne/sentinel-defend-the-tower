// Sentinel Strike - the 3D view and game shell for the vertical shooter in sim.js.
// The fight happens on a flat plane (world X = sim x, world Z = -sim y); everything
// around it is real depth: a city of data towers streaming past far below, cloud
// decks, banking ships, 3D explosions. Rules stay in sim.js.

import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import { createSim, FIELD, COLOR, ENEMY, STAGES } from './sim.js';
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

export function createStrikeGame(canvas, opts = {}) {
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
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .75, .6, .7)); composer.addPass(new OutputPass());

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
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s), cyl = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s), ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
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

  // ---------- the interceptor ----------
  const ship = new THREE.Group(); scene.add(ship);
  const hull = new THREE.Group(); hull.scale.setScalar(1.2); ship.add(hull);
  const IV = solid(0xd9e3d2, .5, .15), DK = solid(0x163d37, .55, .3), MT = solid(0x6f8581, .35, .75);
  add(hull, new THREE.Mesh(merge([P(cone(.34, 1.7, 12), 0, .05, -1.0, -H), P(box(.62, .34, 1.5), 0, 0, .25), P(box(.4, .2, .5), 0, .22, .5), P(box(.08, .5, .7), 0, .34, .8, .25)]), IV));
  add(hull, new THREE.Mesh(merge([P(box(1.5, .09, .85), -.95, -.02, .45, 0, .42), P(box(1.5, .09, .85), .95, -.02, .45, 0, -.42), P(box(.7, .07, .45), -.55, .05, 1.0, 0, .3), P(box(.7, .07, .45), .55, .05, 1.0, 0, -.3)]), DK));
  add(hull, new THREE.Mesh(merge([P(cyl(.17, .2, .8, 10), -.36, -.04, .85, H), P(cyl(.17, .2, .8, 10), .36, -.04, .85, H), P(cyl(.06, .06, 1.0, 6), -1.45, .02, .1, H), P(cyl(.06, .06, 1.0, 6), 1.45, .02, .1, H)]), MT));
  add(hull, new THREE.Mesh(P(ball(.26, 2), 0, .2, -.35, 0, 0, 0, .8, .7, 1.7), new THREE.MeshBasicMaterial({ color: 0x8dffc8 })));
  for (const s of [-1, 1]) { const tip = add(hull, new THREE.Mesh(box(.5, .04, .08), new THREE.MeshBasicMaterial({ color: 0x9be85a }))); tip.position.set(s * 1.3, .05, .2); tip.rotation.y = -s * .42; }
  const logo = add(hull, new THREE.Mesh(new THREE.PlaneGeometry(.58, .15), new THREE.MeshBasicMaterial({ map: brandTex, transparent: true, depthWrite: false }))); logo.rotation.x = -H; logo.rotation.z = H; logo.position.set(0, .18, .32);
  const flames = [-.36, .36].map(x => { const f = add(hull, new THREE.Mesh(P(cone(.16, 1.3, 8), 0, 0, 0, H), glow(0x7dffd0, .9))); f.position.set(x, -.04, 1.85); return f; });
  const muzzle = add(hull, new THREE.Mesh(ball(.3, 1), glow(0xffffff, 0))); muzzle.position.set(0, .05, -1.9);
  const shieldMesh = add(ship, new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 14), glow(0xa98bff, .18, THREE.DoubleSide)));
  const shieldRing = add(ship, new THREE.Mesh(new THREE.TorusGeometry(1.8, .05, 6, 48), glow(0xc9b5ff, .9))); shieldRing.rotation.x = H;
  const iagRing = add(scene, new THREE.Mesh(new THREE.RingGeometry(.97, 1, 64), glow(0xffd166, .5, THREE.DoubleSide))); iagRing.rotation.x = -H;
  const iagDisc = add(scene, new THREE.Mesh(new THREE.CircleGeometry(1, 48), glow(0xffd166, .05, THREE.DoubleSide))); iagDisc.rotation.x = -H;
  const optionGeo = merge([P(new THREE.OctahedronGeometry(.34), 0, 0, 0, 0, 0, 0, 1, .6, 1.5), P(new THREE.TorusGeometry(.42, .05, 6, 20), 0, 0, 0, H)]);
  const options = [0, 1].map(() => { const g = new THREE.Group(); add(g, new THREE.Mesh(optionGeo, solid(0xd9e3d2, .4, .3, 0x39c0ff, .8))); add(g, new THREE.Mesh(ball(.16), glow(0x39c0ff, .9))); scene.add(g); return g; });

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
    const beam = add(g, new THREE.Mesh(cyl(.5, .9, 7, 12, 1), glow(0xffffff, .09, THREE.DoubleSide))); beam.position.y = -3.6;
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
        case 'pick': ringFx(x, z, f.color, 3.2, 10); burst(x, z, f.color, 26, 8, .26); flashA = Math.max(flashA, .18); flashRGB = hexRGB(f.color); break;
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
  function placeCamera(d, sx = 0, roll = 0) { camera.position.set(sx * .12, Math.sin(PITCH) * d, CENTER.z + Math.cos(PITCH) * d); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(sx * .2, 0, CENTER.z); }
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); Hh = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, Hh, false); composer.setPixelRatio(dpr); composer.setSize(W, Hh);
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
  let time = 0, scroll = 0, bank = 0, attractX = 0;
  const palBg = new THREE.Color(PALETTE[0].bg), palFog = new THREE.Color(PALETTE[0].fog), palGrid = new THREE.Color(PALETTE[0].grid), palTower = new THREE.Color(PALETTE[0].tower);
  function setInst(mesh, i, x, y, z, rx, ry, rz, sx, sy, sz) { _e.set(rx, ry, rz); _q.setFromEuler(_e); mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz))); }
  function sync(dt) {
    time += dt; drainFx();
    const live = S && S.phase !== 'idle', warp = live ? S.warp : 0;
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

    // ship
    const p = live ? S.ship : null;
    if (!live) { attractX = Math.sin(time * .6) * 3.5; ship.visible = true; ship.position.set(attractX, 0, -4 - Math.sin(time * .9) * .8); bank += (Math.cos(time * .6) * .5 - bank) * Math.min(1, dt * 4); }
    else { ship.visible = p.dead <= 0 && S.lives > 0 && (p.inv <= 0 || S.mode === 'clear' || Math.floor(time * 16) % 2 === 0); ship.position.set(p.x, 0, -p.y); bank += (clamp(p.vx / 12, -1, 1) - bank) * Math.min(1, dt * 10); }
    hull.rotation.z = -bank * .75; hull.rotation.x = live ? clamp(-p.vy / 26, -.25, .25) : 0; hull.position.y = Math.sin(time * 3) * .05;
    flames.forEach((f, i) => { const s = .8 + Math.random() * .5 + warp * 2 + (live ? Math.max(0, p.vy) * .05 : 0); f.scale.set(1, 1, s); f.position.z = 1.25 + .65 * s; f.material.opacity = .7 + Math.random() * .3; void i; });
    muzzle.material.opacity = live ? p.muzzle * .8 : 0; muzzle.material.color.set(live ? COLOR[S.main] : '#fff');
    if (ship.visible && Math.random() < .7) spark(ship.position.x + rnd(-.4, .4), -.05, ship.position.z + 2, rnd(-.4, .4), 0, 9 + warp * 20, '#7dffd0', .16, .35, 0);
    const sh = live ? S.shield : 0; shieldMesh.visible = shieldRing.visible = sh > 0 && ship.visible;
    if (sh > 0) { shieldMesh.material.opacity = .1 + .05 * Math.sin(time * 5) + sh * .05; shieldRing.rotation.z = time * 2; shieldRing.scale.setScalar(1 + .03 * Math.sin(time * 6)); }
    const iag = live ? S.lv.IAG : 0; iagRing.visible = iagDisc.visible = iag > 0 && p.dead <= 0;
    if (iag > 0) { const r = 3 + iag * .5; iagRing.position.set(p.x, -.05, -p.y); iagDisc.position.copy(iagRing.position); iagRing.scale.setScalar(r); iagDisc.scale.setScalar(r); iagRing.material.opacity = .32 + .14 * Math.sin(time * 4); }
    const nOpt = live ? Math.min(2, S.lv.HCI) : 0;
    options.forEach((o, i) => { o.visible = i < nOpt && p.dead <= 0; if (o.visible) { o.position.set(p.x + (i ? 1.5 : -1.5), Math.sin(time * 4 + i * 2) * .12, -(p.y - .5)); o.rotation.y = time * 2.5; o.rotation.z = -bank * .5; } });

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
      const flip = it.kind !== 'bomb' && it.cyc > 1.55 ? Math.abs(Math.cos((it.cyc - 1.55) / .25 * Math.PI)) : 1;
      c.g.position.set(it.x, .1 + Math.sin(time * 4 + i) * .12, -it.y); c.g.scale.set(1.25 * flip + .05, 1.25, 1.25); c.halo.rotation.z = time * 3; c.halo.scale.setScalar(1 + .08 * Math.sin(time * 7));
    }

    // XDR chain
    boltN = 0;
    if (live) for (const a of S.arcs) { const w = .07 * Math.sqrt(Math.max(.05, a.life / .16)); for (let i = 1; i < a.pts.length; i++) { bolt(a.pts[i - 1].x, -a.pts[i - 1].y, a.pts[i].x, -a.pts[i].y, w, i === 1 ? '#eaffd0' : '#9be85a', .45, time * 30 + i); if (Math.random() < .5) spark(a.pts[i].x, 0, -a.pts[i].y, rnd(-3, 3), rnd(-1, 1), rnd(-3, 3), '#c8ff9a', .2, .25); } }
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
    const sx = live ? S.ship.x : attractX;
    placeCamera(camD, sx, -bank * .02); camera.position.x += rnd(-1, 1) * shake * .35; camera.position.y += rnd(-1, 1) * shake * .3;
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
    if (banner) {
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
    if (flashA > 0) { g2.fillStyle = `rgba(${flashRGB},${flashA * .28})`; g2.fillRect(0, 0, W, Hh); }
  }

  // ---------- loop ----------
  let raf = 0, last = performance.now(), frames = 0;
  function frame(ts) {
    const dt = Math.min(.25, Math.max(0, (ts - last) / 1000 || 0)); last = ts; frames++;
    if (S && S.phase === 'play') { readInput(); let left = dt; while (S.phase === 'play' && left > 1e-8) { const st = Math.min(1 / 60, left); sim.step(st, input); left -= st; } }
    sync(S && S.phase === 'paused' ? 0 : dt);
    renderer.info.reset(); composer.render(); overlay();
    raf = requestAnimationFrame(frame);
  }
  resize(); raf = requestAnimationFrame(frame);

  return {
    start() { S = sim.start(); resize(); texts.length = 0; banner = null; ptr.mode = 'keys'; ptr.id = null; keys.clear(); last = performance.now(); return S; },
    bomb() { bombQ = 2; },
    grant: id => sim.grant(id),
    pause() { if (S && S.phase === 'play') S.phase = 'paused'; },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; last = performance.now(); } },
    stop() { S = null; },
    resize,
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('pointermove', pMove); window.removeEventListener('pointerup', pUp); window.removeEventListener('pointercancel', pUp); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('blur', clearKeys); composer.dispose(); renderer.dispose(); fx2.remove(); },
    get diagnostics() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, frames, camD, enemies: S?.enemies.length || 0, bullets: S?.eb.length || 0, shots: S?.shots.length || 0 }; },
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S; },
    sim,
  };
}
