// Last Stand 3D: Citadel - the renderer and game shell.
// A true 3D arena: the Sentinel mech circles a Data Core on a sky-high deck while
// threats pour out of six perimeter gates. A chase camera orbits the citadel with
// the mech, so the whole world turns as you circle-strafe. Combat rules live in
// sim.js (pure); this file draws them with Three.js and feeds input back.

import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import { createSim, ARENA, ACCENT, gateAngle } from './sim.js';
import { createSangforArt } from '../stand/sangfor-art.js?art=matte-arena-v1';
import { createBulletInstances } from '../stand/instances.js?campaign=agent-workflow-v1';
import { WEAPON_ORDER, MAX_ACTIVE_THREATS } from '../stand/model.js?campaign=agent-workflow-v1';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { sfx } from '../rush/audio.js';

export { ACCENT };
const TAU = Math.PI * 2, K = 0.055;                       // world units per sim unit
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = a => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
const wX = x => x * K, wZ = y => y * K, wR = r => r * 0.055;
const fmtNum = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(Math.round(n)));
const FLY = { exfil: 1.5, apt: .55 };                       // hover heights (world units)
// Module mounts on the mech (mirrors mech-art.js) - sources of the XDR charging links.
const ANCHOR = { EDR: [.94, 2.35, .18], MDR: [-.85, 1.42, .3], AF: [-1.08, 1.58, -.05], NDR: [0, 3.03, 0], HCI: [-.6, 1.94, -.53],
  XDR: [0, 2.4, -.72], ASTOR: [.54, 1.07, -.45], IAG: [-.48, .62, -.3], AI: [.58, 2.33, -.47], AGENT: [.85, 1.32, -.12] };

export function createStandGame(canvas, opts = {}) {
  const onHud = opts.onHud || (() => {}), onOver = opts.onOver || (() => {});
  const sim = createSim({
    onHud: h => onHud(h), onToast: opts.onToast, onLevelUp: opts.onLevelUp,
    onOver: summary => onOver(summary), onSfx: (name, arg) => sfx[name]?.(arg),
  });
  let S = null;

  // ---------- 2D overlay: damage numbers, health bars, radar, edge arrows ----------
  const fx = document.createElement('canvas'); fx.className = 'st-fx';
  const g2 = fx.getContext('2d');
  (canvas.parentNode || document.body).insertBefore(fx, canvas.nextSibling);

  // ---------- renderer ----------
  const texLoader = new THREE.TextureLoader(), markTex = {};
  for (const id of WEAPON_ORDER) { const m = PRODUCT_MARKS[id === 'AI' ? 'AICP' : id]; if (m) { const tx = texLoader.load('assets/brand/products/sangfor-' + m[0]); tx.colorSpace = THREE.SRGBColorSpace; markTex[id] = tx; } }
  const brandTex = texLoader.load('assets/brand/sangfor-logo-white.png'); brandTex.colorSpace = THREE.SRGBColorSpace;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = makeSkyTex();
  scene.fog = new THREE.Fog(0x0a1c21, 60, 300);
  const camera = new THREE.PerspectiveCamera(52, 1, .2, 600);

  scene.add(new THREE.HemisphereLight(0xd4e3cf, 0x182f2c, .6));
  const key = new THREE.DirectionalLight(0xfff1db, 1.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 120;
  key.shadow.camera.left = -30; key.shadow.camera.right = 30; key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
  key.shadow.bias = -.0006; key.shadow.normalBias = .03; key.shadow.radius = 3;
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x9ad6c3, .7); rim.position.set(30, 14, -40); scene.add(rim);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .62, .65, .74));
  composer.addPass(new OutputPass());

  const add = (parent, mesh) => { parent.add(mesh); return mesh; };
  const glow = (color, opacity = 1, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side });
  const solid = (color, rough = .7, metal = .1, emissive = 0, ei = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, envMapIntensity: .3 });

  // ---------- art: the shared Sangfor mech / creature factory ----------
  const spareFrame = new THREE.Group();                    // the lane deck the factory builds is not used here
  const art = createSangforArt({ scene, laneFrame: spareFrame, renderer, markTex, brandTex, laneW: 18, length: 34, integrated: true });

  // ---------- the world ----------
  const world = new THREE.Group(); scene.add(world);
  const RW = ARENA.R * K;
  const deckTex = makeDeckTextures();
  const deck = add(world, new THREE.Mesh(new THREE.CircleGeometry(RW, 128),
    new THREE.MeshStandardMaterial({ map: deckTex.color, emissiveMap: deckTex.glow, emissive: 0xffffff, emissiveIntensity: .85, roughness: .82, metalness: .12, envMapIntensity: .28 })));
  deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true;
  const rimMat = solid(0x1c312d, .6, .3, 0x83be4b, .12);
  const rimRing = add(world, new THREE.Mesh(new THREE.TorusGeometry(RW, .55, 10, 128), rimMat)); rimRing.rotation.x = Math.PI / 2; rimRing.position.y = .1;
  const rimGlow = add(world, new THREE.Mesh(new THREE.TorusGeometry(RW + .1, .09, 6, 128), new THREE.MeshBasicMaterial({ color: 0x9be85a }))); rimGlow.rotation.x = Math.PI / 2; rimGlow.position.y = .68;
  const skirtTex = makeStripeTex();
  const skirt = add(world, new THREE.Mesh(new THREE.CylinderGeometry(RW, RW * .82, 46, 96, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x15262a, roughness: .7, metalness: .35, emissiveMap: skirtTex, emissive: 0x6fd6b0, emissiveIntensity: .7, envMapIntensity: .3 })));
  skirt.position.y = -23.2;
  const stem = add(world, new THREE.Mesh(new THREE.CylinderGeometry(RW * .42, RW * .5, 160, 40, 1, true), solid(0x0e1b1f, .8, .3))); stem.position.y = -126;

  // distant city: one merged mesh of towers far below and around the deck
  const cityTex = makeWindowTex();
  { const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), bp = box.attributes.position.array, bn = box.attributes.normal.array, bu = box.attributes.uv.array;
    const N = 300, pos = new Float32Array(N * 108), nor = new Float32Array(N * 108), uv = new Float32Array(N * 72);
    let seed = 7; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < N; i++) {
      const a = r01() * TAU, rad = 96 + r01() * r01() * 230, top = -46 + (rad - 96) / 230 * 80 * r01() + r01() * 14, h = top + 150, w = 9 + r01() * 15, d = 9 + r01() * 15, yaw = r01() * TAU, cs = Math.cos(yaw), sn = Math.sin(yaw);
      const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad, cy = top - h / 2;
      for (let v = 0; v < 36; v++) {
        const x = bp[v * 3] * w, y = bp[v * 3 + 1] * h, z = bp[v * 3 + 2] * d, nx = bn[v * 3], ny = bn[v * 3 + 1], nz = bn[v * 3 + 2], o = (i * 36 + v) * 3, u = (i * 36 + v) * 2;
        pos[o] = cx + x * cs + z * sn; pos[o + 1] = cy + y; pos[o + 2] = cz - x * sn + z * cs;
        nor[o] = nx * cs + nz * sn; nor[o + 1] = ny; nor[o + 2] = -nx * sn + nz * cs;
        if (Math.abs(ny) > .5) { uv[u] = .004; uv[u + 1] = .004; } else { uv[u] = bu[v * 2] * Math.max(1, Math.round((Math.abs(nx) > .5 ? d : w) / 16)); uv[u + 1] = bu[v * 2 + 1] * Math.max(1, Math.round(h / 44)); }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); box.dispose();
    const city = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0c171b, roughness: .8, metalness: .25, emissiveMap: cityTex, emissive: 0xffffff, emissiveIntensity: .95, envMapIntensity: .2 }));
    city.frustumCulled = false; world.add(city); }
  // sky traffic: slow light beams rising between the towers
  const beacons = [];
  for (let i = 0; i < 9; i++) { const a = i * 2.39996, rad = 95 + (i % 4) * 34; const b = add(world, new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 260, 6, 1, true), glow(i % 3 ? 0x4fd6c0 : 0x9be85a, .1))); b.position.set(Math.cos(a) * rad, 20, Math.sin(a) * rad); beacons.push(b); }

  // gates: six portal arches on the rim; active attack vectors burn red
  const gates = [];
  const portalTex = makePortalTex();
  for (let i = 0; i < ARENA.gates; i++) {
    const a = gateAngle(i), g = new THREE.Group(); g.position.set(Math.cos(a) * ARENA.spawnR * K, 0, Math.sin(a) * ARENA.spawnR * K); g.rotation.y = Math.PI / 2 - a;
    const frameMat = solid(0x1d3530, .55, .35), stripMat = new THREE.MeshBasicMaterial({ color: 0x4fd6c0 });
    for (const s of [-1, 1]) {
      const py = add(g, new THREE.Mesh(new THREE.BoxGeometry(1.5, 10.5, 2.2), frameMat)); py.position.set(s * 4.6, 5.25, 0); py.castShadow = true; py.rotation.z = -s * .07;
      const st = add(g, new THREE.Mesh(new THREE.BoxGeometry(.14, 8.6, .14), stripMat)); st.position.set(s * 3.82, 5, -1.05); st.rotation.z = -s * .07;
      const foot = add(g, new THREE.Mesh(new THREE.BoxGeometry(2.6, .7, 3.4), frameMat)); foot.position.set(s * 4.7, .35, 0);
    }
    const top = add(g, new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.5, 2.4), frameMat)); top.position.y = 10.9; top.castShadow = true;
    const topStrip = add(g, new THREE.Mesh(new THREE.BoxGeometry(7.6, .14, .14), stripMat)); topStrip.position.set(0, 10.25, -1.15);
    const portalMat = new THREE.MeshBasicMaterial({ map: portalTex, color: 0x4fd6c0, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const portal = add(g, new THREE.Mesh(new THREE.PlaneGeometry(8, 10), portalMat)); portal.position.y = 5.1;
    const beam = add(g, new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 90, 8, 1, true), glow(0xff4d5e, 0))); beam.position.set(0, 56, 0);
    const light = new THREE.PointLight(0xff4d5e, 0, 34, 1.6); light.position.set(0, 4.5, -3); g.add(light);
    world.add(g); gates.push({ g, stripMat, portalMat, beam, light, heat: 0, col: new THREE.Color(0x4fd6c0) });
  }

  // the Data Core: a low reactor (never hides the mech) under a holographic spire
  const core = new THREE.Group(); world.add(core);
  { const plinth = add(core, new THREE.Mesh(new THREE.CylinderGeometry(4.3, 5, .7, 48), solid(0x14272a, .6, .4))); plinth.position.y = .35; plinth.receiveShadow = true;
    const drum = add(core, new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 1.7, 6), solid(0xb8ceb9, .68, .06))); drum.position.y = 1.5; drum.castShadow = true;
    const collar = add(core, new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, .22, 6), solid(0x163d37, .7, .1))); collar.position.y = 2.42;
    for (let i = 0; i < 3; i++) { const lg = add(core, new THREE.Mesh(new THREE.PlaneGeometry(2.5, .66), new THREE.MeshBasicMaterial({ map: brandTex, transparent: true, depthWrite: false }))); const a = i * TAU / 3; lg.position.set(Math.cos(a) * 2.45, 1.5, Math.sin(a) * 2.45); lg.rotation.y = Math.PI / 2 - a; } }
  const coreLens = add(core, new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, .1, 6), new THREE.MeshBasicMaterial({ color: 0x9be85a }))); coreLens.position.y = 2.58;
  const coreOrb = add(core, new THREE.Mesh(new THREE.IcosahedronGeometry(.95, 3), new THREE.MeshBasicMaterial({ color: 0xcfffa8 }))); coreOrb.position.y = 4.5;
  const coreCage = add(core, new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), new THREE.MeshBasicMaterial({ color: 0x9be85a, wireframe: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }))); coreCage.position.y = 4.5;
  const coreRings = [2.3, 2.95, 3.6].map((r, i) => { const m = add(core, new THREE.Mesh(new THREE.TorusGeometry(r, .045, 6, 72), glow(0x9be85a, .8))); m.position.y = 4.5; m.rotation.x = Math.PI / 2 + (i - 1) * .5; return m; });
  const coreBeam = add(core, new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 120, 8, 1, true), glow(0x9be85a, .34))); coreBeam.position.y = 64;
  const coreHalo = add(core, new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.4, 120, 16, 1, true), glow(0x9be85a, .045, THREE.DoubleSide))); coreHalo.position.y = 64;
  const coreLight = new THREE.PointLight(0x9be85a, 30, 46, 1.7); coreLight.position.y = 5; core.add(coreLight);
  const coreShield = add(core, new THREE.Mesh(new THREE.SphereGeometry(5.6, 32, 16, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: makeHexTex(), color: 0xa98bff, transparent: true, opacity: .0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); coreShield.visible = false;
  const coreColor = new THREE.Color(0x9be85a), coreTint = new THREE.Color();
  let coreHurt = 0;

  // NGAF firewall arc + IAG checkpoint ring
  const hexTex = makeHexTex();
  const afMat = new THREE.MeshBasicMaterial({ map: hexTex, color: 0x2ee6a0, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const afTopMat = new THREE.MeshBasicMaterial({ color: 0x9dffd0, transparent: true, opacity: .95 });
  const afGroup = new THREE.Group(); afGroup.visible = false; world.add(afGroup);
  let afBuilt = -1, afWall = null, afTop = null, afFoot = null;
  function buildAf(half) {
    for (const m of [afWall, afTop, afFoot]) if (m) { afGroup.remove(m); m.geometry.dispose(); }
    const r = ARENA.afR * K, seg = Math.max(12, Math.round(half * 30));
    afWall = add(afGroup, new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.8, seg, 1, true, -half, half * 2), afMat)); afWall.position.y = 1.4;
    afTop = add(afGroup, new THREE.Mesh(new THREE.CylinderGeometry(r + .03, r + .03, .07, seg, 1, true, -half, half * 2), afTopMat)); afTop.position.y = 2.82;
    afFoot = add(afGroup, new THREE.Mesh(new THREE.CylinderGeometry(r + .03, r + .03, .07, seg, 1, true, -half, half * 2), afTopMat)); afFoot.position.y = .06;
    hexTex.repeat.set(Math.max(2, Math.round(half * 9)), 2); afBuilt = half;
  }
  const iagMat = glow(0xffd166, .13, THREE.DoubleSide);
  const iagRing = add(world, new THREE.Mesh(new THREE.RingGeometry((ARENA.iagR - ARENA.iagHalf) * K, (ARENA.iagR + ARENA.iagHalf) * K, 128), iagMat)); iagRing.rotation.x = -Math.PI / 2; iagRing.position.y = .05; iagRing.visible = false;
  const iagEdges = [-1, 1].map(s => { const m = add(world, new THREE.Mesh(new THREE.TorusGeometry((ARENA.iagR + s * ARENA.iagHalf) * K, .04, 5, 128), new THREE.MeshBasicMaterial({ color: 0xffd166 }))); m.rotation.x = Math.PI / 2; m.position.y = .07; m.visible = false; return m; });

  // ---------- actors ----------
  const mech = new THREE.Group(); scene.add(mech);
  const mechRoot = art.operator(); mech.add(mechRoot);
  const jets = [-1, 1].map(s => { const j = add(mech, new THREE.Mesh(new THREE.ConeGeometry(.2, 1.1, 10, 1, true), glow(0x7dffd0, .0, THREE.DoubleSide))); j.position.set(s * .34, .5, -.55); j.rotation.x = -Math.PI / 2 - .5; return j; });
  const mechRing = add(scene, new THREE.Mesh(new THREE.RingGeometry(1.25, 1.4, 48), glow(0x9be85a, .5, THREE.DoubleSide))); mechRing.rotation.x = -Math.PI / 2;
  const aimLine = add(scene, new THREE.Mesh(new THREE.PlaneGeometry(.07, 1), glow(0x9be85a, .22, THREE.DoubleSide)));
  const dashGhosts = [];
  const teamGroup = new THREE.Group(); scene.add(teamGroup);
  const teamMeshes = new Map(), freeTeams = { pt: [], rt: [] };
  const bulletGroup = new THREE.Group(); scene.add(bulletGroup);
  const bullets = createBulletInstances(bulletGroup);
  const threats = createThreatInstances(scene);
  const bolts = createBolts(scene, 320);
  const bossLight = new THREE.PointLight(0xff5a6a, 0, 40, 1.6); scene.add(bossLight);

  // boss strike telegraphs (ground circles) and impact pillars
  const marks = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.visible = false; g.rotation.x = -Math.PI / 2; g.position.y = .09; scene.add(g);
    const fill = add(g, new THREE.Mesh(new THREE.CircleGeometry(1, 48), glow(0xff3048, .16, THREE.DoubleSide)));
    const edge = add(g, new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), glow(0xff5a6a, .95, THREE.DoubleSide)));
    const grow = add(g, new THREE.Mesh(new THREE.CircleGeometry(1, 48), glow(0xff3048, .3, THREE.DoubleSide))); grow.position.z = .01;
    marks.push({ g, fill, edge, grow });
  }
  const pillars = [];
  for (let i = 0; i < 6; i++) { const m = add(scene, new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 60, 16, 1, true), glow(0xffffff, 0, THREE.DoubleSide))); m.visible = false; m.position.y = 30; pillars.push({ m, life: 0 }); }

  // ground shock rings (pooled)
  const ringGeo = new THREE.RingGeometry(.93, 1, 64), rings = [];
  for (let i = 0; i < 56; i++) { const m = add(scene, new THREE.Mesh(ringGeo, glow(0xffffff, 0, THREE.DoubleSide))); m.rotation.x = -Math.PI / 2; m.visible = false; rings.push({ m, life: 0, r: 0, max: 1, speed: 9 }); }
  let ringCursor = 0;
  function ringFx(x, z, color, maxWorld, y = .08, speed = 9) {
    const r = rings[ringCursor = (ringCursor + 1) % rings.length];
    r.life = 1; r.r = .2; r.max = Math.max(.4, maxWorld); r.speed = speed; r.m.visible = true; r.m.position.set(x, y + ringCursor * .0006, z); r.m.material.color.set(color);
  }

  // GPU particles: real 3D sparks with gravity and ground bounce
  const PMAX = 2600;
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 4), pSize = new Float32Array(PMAX);
  const pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pDecay = new Float32Array(PMAX), pGrav = new Float32Array(PMAX);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('pcolor', new THREE.BufferAttribute(pCol, 4).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute vec4 pcolor; attribute float psize; varying vec4 vC; uniform float uScale; void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.08, d); gl_FragColor = vec4(vC.rgb * vC.a * a, vC.a * a); }' });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
  let pCursor = 0, pFloor = 0; const tmpC = new THREE.Color();
  function spark(x, y, z, vx, vy, vz, color, size, life = 1, grav = 9) {
    const i = pCursor = pCursor + 1 >= PMAX ? pFloor : pCursor + 1;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz;
    tmpC.set(color); pCol[i * 4] = tmpC.r; pCol[i * 4 + 1] = tmpC.g; pCol[i * 4 + 2] = tmpC.b; pCol[i * 4 + 3] = 1;
    pSize[i] = size; pLife[i] = 1; pDecay[i] = 1 / life; pGrav[i] = grav;
  }
  function burst3(x, y, z, color, n, speed, size = .2, up = .6) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = Math.random() * Math.PI * .5, sp = speed * (.25 + Math.random() * .75); spark(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * (.6 + up) + 1, Math.sin(a) * Math.cos(e) * sp, color, size * (.5 + Math.random()), .45 + Math.random() * .6); }
  }
  // ambient motes drifting up around the deck
  for (let i = 0; i < 140; i++) { const a = Math.random() * TAU, r = Math.random() * RW; spark(Math.cos(a) * r, Math.random() * 14, Math.sin(a) * r, 0, .25 + Math.random() * .4, 0, i % 4 ? '#5fd6b8' : '#bfff9a', .09 + Math.random() * .1, 1e9, 0); pCol[pCursor * 4 + 3] = .5; }
  const MOTES = pCursor + 1; pFloor = MOTES;

  // floating damage numbers (world-anchored, drawn on the overlay)
  const texts = [];
  let zaps = [], flashA = 0, flashCol = '255,90,106', shakeA = 0, healGlow = 0;

  // ---------- camera rig ----------
  let W = 1, H = 1, dpr = 1, camYaw = 0, camDist = 14, camHigh = 12, fovBase = 52, fovKick = 0, attract = 0, introT = 0;
  const camPos = new THREE.Vector3(30, 18, 0), camAim = new THREE.Vector3(0, 3, 0), wantPos = new THREE.Vector3(), wantAim = new THREE.Vector3();
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); composer.setPixelRatio(dpr); composer.setSize(W, H);
    const asp = W / H; camera.aspect = asp;
    // keep a useful horizontal field on portrait phones by opening the vertical FOV
    fovBase = asp >= 1.05 ? 52 : Math.min(84, 2 * Math.atan(Math.tan(26 * Math.PI / 180) * Math.min(1.9, 1.05 / asp)) * 180 / Math.PI);
    camDist = asp >= 1.05 ? 14 : 14.5; camHigh = asp >= 1.05 ? 12 : 14;
    camera.fov = fovBase; camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = H * dpr * .9;
    fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- input ----------
  const keys = new Set(), mouse = { on: false, x: 0, y: 0 }, stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let dashQueued = 0;
  const input = { mx: 0, my: 0, aimX: null, aimY: null, dash: false };
  const KMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'dash', Shift: 'dash' };
  function onKey(e, down) { const k = KMAP[e.key]; if (!k || e.target?.tagName === 'INPUT') return; if (down) keys.add(k); else keys.delete(k); if (S?.phase === 'play') e.preventDefault(); }
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  const local = ev => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  function pDown(ev) {
    if (S?.phase !== 'play') return;
    const p = local(ev);
    if (ev.pointerType === 'mouse') { mouse.on = true; mouse.x = p.x; mouse.y = p.y; if (ev.button === 2) dashQueued = 2; return; }
    ev.preventDefault(); mouse.on = false;
    if (stick.id === null) { stick.id = ev.pointerId; stick.ox = stick.x = p.x; stick.oy = stick.y = p.y; }
  }
  function pMove(ev) {
    const p = local(ev);
    if (ev.pointerType === 'mouse') { mouse.on = true; mouse.x = p.x; mouse.y = p.y; return; }
    if (ev.pointerId === stick.id) { stick.x = p.x; stick.y = p.y; }
  }
  function pUp(ev) { if (ev.pointerId === stick.id) stick.id = null; }
  const noMenu = e => e.preventDefault();
  function bind() { canvas.addEventListener('pointerdown', pDown); window.addEventListener('pointermove', pMove); window.addEventListener('pointerup', pUp); window.addEventListener('pointercancel', pUp); canvas.addEventListener('contextmenu', noMenu); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize); window.addEventListener('blur', clearKeys); }
  function unbind() { canvas.removeEventListener('pointerdown', pDown); window.removeEventListener('pointermove', pMove); window.removeEventListener('pointerup', pUp); window.removeEventListener('pointercancel', pUp); canvas.removeEventListener('contextmenu', noMenu); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); window.removeEventListener('blur', clearKeys); }
  function clearKeys() { keys.clear(); stick.id = null; }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2), hitPt = new THREE.Vector3();
  function readInput() {
    // camera-relative steering: forward = away from the core, right = clockwise around it
    const fxv = Math.cos(camYaw), fyv = Math.sin(camYaw), rxv = -fyv, ryv = fxv;
    let f = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0), r = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    if (stick.id !== null) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, l = Math.hypot(dx, dy), k = Math.min(1, l / 46) / (l || 1); r = dx * k; f = -dy * k; }
    input.mx = fxv * f + rxv * r; input.my = fyv * f + ryv * r;
    input.dash = keys.has('dash') || dashQueued > 0; if (dashQueued > 0) dashQueued--;
    input.aimX = input.aimY = null;
    if (mouse.on) {
      ndc.set(mouse.x / W * 2 - 1, -(mouse.y / H) * 2 + 1); ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(aimPlane, hitPt)) { input.aimX = hitPt.x / K; input.aimY = hitPt.z / K; }
    }
  }

  // ---------- sim events -> 3D effects ----------
  function pushText(x, h, z, n, color, big) {
    if (texts.length > 110) texts.shift();
    texts.push({ x, y: h, z, vy: 2.2 + Math.random(), vx: rnd(-.6, .6), text: fmtNum(n), color, big, life: 1 });
  }
  function drainFx() {
    const q = sim.fxq;
    for (let i = 0; i < q.length; i++) {
      const f = q[i];
      switch (f.t) {
        case 'spark': burst3(wX(f.x), f.h || 1.3, wZ(f.y), f.color, 4, 5, .16); break;
        case 'burst': burst3(wX(f.x), 1.1, wZ(f.y), f.color, Math.min(26, f.n), f.spread * .05, .2); break;
        case 'ring': ringFx(wX(f.x), wZ(f.y), f.color, f.max * K * 1.1); break;
        case 'zap': zaps.push({ ax: wX(f.x1), ay: 2, az: wZ(f.y1), bx: wX(f.x2), by: 1.1, bz: wZ(f.y2), color: f.color, life: 1 }); break;
        case 'text': pushText(wX(f.x), 2.3, wZ(f.y), f.n, f.color, f.big); break;
        case 'flash': flashA = Math.max(flashA, f.a); flashCol = hexRGB(f.col); break;
        case 'shake': shakeA = Math.min(1, Math.max(shakeA, f.a)); break;
        case 'death': {
          const x = wX(f.x), z = wZ(f.y), r = wR(f.r);
          burst3(x, r + .4, z, f.color, f.boss ? 150 : 18, f.boss ? 17 : 8, f.boss ? .42 : .24);
          burst3(x, r + .4, z, '#ffffff', f.boss ? 40 : 5, f.boss ? 10 : 5, .16);
          ringFx(x, z, f.color, r * (f.boss ? 9 : 2.8)); ringFx(x, z, '#ffffff', r * (f.boss ? 5 : 1.8), .1, 14);
          if (f.boss) { pillar(x, z, r * 1.4, f.color, .7); for (let k = 0; k < (f.mega ? 6 : 3); k++) ringFx(x + rnd(-r, r), z + rnd(-r, r), f.color, r * (4 + k * 2.2), .1, 5 + k); shakeA = 1; }
          break;
        }
        case 'strike': {
          const x = wX(f.x), z = wZ(f.y), r = f.r * K;
          pillar(x, z, r * .55, f.hit ? '#ff5a6a' : f.color, .45);
          ringFx(x, z, '#ff7a88', r * 2.3, .1, 12); ringFx(x, z, '#ffffff', r * 1.3, .1, 16);
          burst3(x, .3, z, f.color, 46, 13, .3, 1.2); burst3(x, .3, z, '#ffd0a0', 18, 8, .2, 1.4);
          zaps.push({ ax: wX(f.fromX), ay: 3.4, az: wZ(f.fromY), bx: x, by: 16, bz: z, color: f.color, life: 1 });
          shakeA = Math.max(shakeA, f.hit ? 1 : .45); if (!f.hit) pushText(x, 2.6, z, 0, '#58c8ff', false), texts[texts.length - 1].text = 'DODGE';
          break;
        }
        case 'breach': { const x = wX(f.x), z = wZ(f.y); burst3(x, 1.4, z, f.color, 22, 9, .26); zaps.push({ ax: x, ay: 1.2, az: z, bx: 0, by: 4.5, bz: 0, color: '#ff5a6a', life: 1 }); break; }
        case 'coreHit': coreHurt = 1; ringFx(0, 0, '#ff5a6a', 9, .75, 10); burst3(0, 3.2, 0, '#ff7a6a', 30, 10, .28); break;
        case 'absorb': ringFx(0, 0, '#a98bff', 9, .75, 9); burst3(0, 4, 0, '#c9b5ff', 26, 9, .24); break;
        case 'heal': healGlow = 1; for (let k = 0; k < 26; k++) { const a = Math.random() * TAU; spark(Math.cos(a) * 3, .4, Math.sin(a) * 3, 0, 4 + Math.random() * 4, 0, '#8dffb0', .22, 1.1, -1); } break;
        case 'nova': for (let k = 0; k < 3; k++) ringFx(0, 0, f.color, f.max * K * (1 - k * .22), .2 + k * .04, 3.2 - k * .5); pillar(0, 0, 3.2, '#9fe8ff', .8); burst3(0, 4, 0, '#bfefff', 80, 20, .3); break;
        case 'upgrade': { const x = wX(f.x), z = wZ(f.y); ringFx(x, z, f.color, 5, .1, 8); for (let k = 0; k < 34; k++) { const a = k / 34 * TAU; spark(x + Math.cos(a) * 1.5, .2, z + Math.sin(a) * 1.5, 0, 5 + Math.random() * 3, 0, f.color, .22, .9, -2); } break; }
        case 'dash': { const x = wX(f.x), z = wZ(f.y); ringFx(x, z, '#7dffd0', 3.2, .1, 14); burst3(x, .5, z, '#7dffd0', 16, 7, .2); fovKick = 1; dashGhosts.push({ x, z, yaw: mech.rotation.y, life: 1 }); break; }
        case 'afDown': { const a = S.afAng; for (let k = 0; k < 40; k++) { const t = a + rnd(-1, 1) * sim.afHalfAngle(); spark(Math.cos(t) * ARENA.afR * K, rnd(.2, 2.6), Math.sin(t) * ARENA.afR * K, rnd(-2, 2), rnd(1, 5), rnd(-2, 2), '#2ee6a0', .26, .9); } break; }
        case 'bossIn': { const gate = gates[f.gate]; if (gate) { gate.heat = 2.4; const p = gate.g.position; pillar(p.x, p.z, 3, '#ff5a6a', 1); for (let k = 0; k < 4; k++) ringFx(p.x, p.z, '#ff5a6a', 10 + k * 5, .1, 6 + k * 2); burst3(p.x, 4, p.z, '#ff7a88', 90, 18, .36); } break; }
      }
    }
    q.length = 0;
  }
  function pillar(x, z, r, color, life) {
    let p = pillars[0]; for (const c of pillars) if (c.life < p.life) p = c;
    p.life = 1; p.dur = life; p.r = r; p.m.visible = true; p.m.position.set(x, 30, z); p.m.material.color.set(color);
  }
  function hexRGB(h) { if (!h || h[0] !== '#') return h || '255,90,106'; return `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`; }
  const rgba = (hex, a) => `rgba(${hexRGB(hex)},${clamp(a, 0, 1)})`;

  // ---------- per-frame scene sync ----------
  const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
  let time = 0, lastStage = -1;
  function syncScene(dt) {
    time += dt;
    drainFx();
    const playing = S && S.phase !== 'idle';
    const op = S ? S.op : null;
    const ox = op ? wX(op.x) : 0, oz = op ? wZ(op.y) : 0;

    // world dressing
    const hpFrac = S ? clamp(S.base / S.baseMax, 0, 1) : 1;
    coreColor.set(hpFrac > .5 ? 0x9be85a : hpFrac > .25 ? 0xffc04d : 0xff5a6a);
    coreHurt = Math.max(0, coreHurt - dt * 2.2); healGlow = Math.max(0, healGlow - dt * 1.4);
    coreTint.copy(coreColor).lerp(v3c.set(0xff3040), coreHurt * .9);
    const pulse = .75 + .25 * Math.sin(time * (hpFrac < .25 ? 9 : 3));
    coreLens.material.color.copy(coreTint).multiplyScalar(.6 + pulse * .5);
    coreOrb.material.color.copy(coreTint).lerp(v3c.set(0xffffff), .45); coreOrb.scale.setScalar(.92 + pulse * .14 + coreHurt * .3); coreOrb.position.y = 4.5 + Math.sin(time * 1.6) * .16;
    coreCage.material.color.copy(coreTint); coreCage.rotation.y = time * .5; coreCage.rotation.x = time * .31; coreCage.position.y = coreOrb.position.y;
    coreRings.forEach((m, i) => { m.material.color.copy(coreTint); m.rotation.z = time * (.6 + i * .25) * (i % 2 ? -1 : 1); m.rotation.x = Math.PI / 2 + Math.sin(time * .5 + i * 2) * .5; m.position.y = coreOrb.position.y; });
    coreLight.color.copy(coreTint); coreLight.intensity = 22 + pulse * 14 + coreHurt * 60 + healGlow * 40;
    coreBeam.material.color.copy(coreTint); coreHalo.material.color.copy(coreTint);
    // the spire fades when the camera sits behind the core, so it never hides the mech
    const camCore = Math.hypot(camPos.x, camPos.z), seeThrough = clamp((camCore - 3) / 9, .12, 1);
    coreBeam.material.opacity = .34 * seeThrough; coreHalo.material.opacity = .05 * seeThrough;
    coreCage.material.opacity = .55 * seeThrough; coreRings.forEach(m => { m.material.opacity = .8 * seeThrough; }); coreOrb.visible = seeThrough > .3;
    rimGlow.material.color.copy(coreTint);
    const shieldOn = S && S.shield > 0; coreShield.visible = !!shieldOn;
    if (shieldOn) { coreShield.material.opacity = .2 + .08 * Math.sin(time * 4) + Math.min(.2, S.shield * .05); coreShield.rotation.y = time * .3; }
    beacons.forEach((b, i) => { b.material.opacity = .06 + .06 * Math.sin(time * .7 + i * 1.7); });

    // gates
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i], on = playing && S.phase !== 'over' && S.gates.active.includes(i);
      gate.heat += ((on ? 1 : 0) - Math.min(1, gate.heat)) * Math.min(1, dt * 3); if (gate.heat > 1) gate.heat -= dt;
      const h = clamp(gate.heat, 0, 1), flick = .82 + .18 * Math.sin(time * 9 + i * 2.1);
      gate.col.setRGB(.31 + h * .69, .84 - h * .54, .75 - h * .38); gate.stripMat.color.copy(gate.col);
      gate.portalMat.color.copy(gate.col); gate.portalMat.opacity = .13 + h * .62 * flick; gate.portalMat.map.offset.y = -time * (.15 + h * .5);
      gate.beam.material.opacity = h * .2 * flick; gate.light.intensity = h * 110 * flick;
      if (on && Math.random() < dt * 14) { const p = gate.g.position; spark(p.x + rnd(-3.5, 3.5), rnd(.3, 9), p.z + rnd(-3.5, 3.5), -p.x * .06, rnd(0, 1.5), -p.z * .06, '#ff5a6a', .22, 1.1, 0); }
    }

    if (!S) { bullets.sync([], wX, wZ); threats.sync([], time, false); bolts.begin(); bolts.end(); mech.visible = false; mechRing.visible = false; aimLine.visible = false; updateParticles(dt); updateRings(dt); return; }
    const sq = S.squad;
    art.sync(S, { wX, wZ, fieldL: 0, fieldR: 0, baseY: 0, bandY: 0 });
    const stage = art.rigDiagnostics?.stage || 0;
    if (stage !== lastStage) { if (lastStage >= 0 && stage > lastStage) { ringFx(ox, oz, '#ffffff', 7, .1, 7); burst3(ox, 2, oz, '#ffffff', 50, 10, .24); } lastStage = stage; }

    // mech: faces its aim, leans into movement, hovers on dash
    mech.visible = true;
    const aimX = Math.cos(op.aim), aimZ = Math.sin(op.aim);
    mech.rotation.y = Math.atan2(aimX, aimZ);
    const sp = clamp(op.speed / 380, 0, 3), dashing = op.dashT > 0;
    const fwd = (op.vx * aimX + op.vy * aimZ) / 380, side = (op.vx * -aimZ + op.vy * aimX) / 380;
    mechRoot.rotation.x = clamp(fwd, -1.5, 1.5) * .13; mechRoot.rotation.z = clamp(-side, -1.5, 1.5) * .11;
    mech.position.set(ox, Math.abs(Math.sin(time * 11)) * .07 * Math.min(1, sp) + (dashing ? .35 : 0), oz);
    jets.forEach(j => { j.material.opacity = Math.min(.85, sp * .5 + (dashing ? .6 : 0)) * (.7 + .3 * Math.sin(time * 40)); j.scale.set(1, 1 + sp * .8, 1); });
    if (sp > .4 && Math.random() < dt * 30) spark(ox + rnd(-.4, .4), .15, oz + rnd(-.4, .4), -op.vx * K * .2, rnd(.4, 1.6), -op.vy * K * .2, '#8fb9a6', .16, .5, 0);
    mechRing.visible = true; mechRing.position.set(ox, .07, oz); mechRing.material.opacity = .28 + .2 * (op.dashCd <= 0 ? 1 : 0); mechRing.scale.setScalar(1 + .04 * Math.sin(time * 5));
    mechRing.material.color.set(op.dashCd <= 0 ? 0x9be85a : 0x4f7f72);
    aimLine.visible = S.phase === 'play'; aimLine.position.set(ox + aimX * 5.4, .08, oz + aimZ * 5.4); aimLine.rotation.set(-Math.PI / 2, 0, Math.atan2(-aimX, -aimZ)); aimLine.scale.set(1, 8, 1);
    for (let i = dashGhosts.length - 1; i >= 0; i--) { const d = dashGhosts[i]; d.life -= dt * 3; if (d.life <= 0) { dashGhosts.splice(i, 1); continue; } if (Math.random() < .8) spark(d.x + rnd(-.5, .5), rnd(.4, 3), d.z + rnd(-.5, .5), 0, .5, 0, '#7dffd0', .2, .35, 0); }

    // service teams
    const seen = new Set();
    for (const u of S.temps) {
      seen.add(u.id);
      let tm = teamMeshes.get(u.id);
      if (!tm) { tm = freeTeams[u.team].pop() || add(teamGroup, art.operative(u.team)); tm.userData.team = u.team; tm.visible = true; teamMeshes.set(u.id, tm); }
      const appear = u.born > 0 ? 1 - u.born / .35 : (u.life < .6 ? Math.max(.12, u.life / .6) : 1);
      tm.position.set(wX(u.fx), 0, wZ(u.fy)); tm.rotation.y = Math.atan2(Math.cos(u.aim), Math.sin(u.aim)); tm.scale.setScalar(.86 * clamp(appear, .05, 1));
      const fl = tm.userData.flash; if (fl) { fl.visible = u.muzzle > .05; if (fl.visible) fl.material.opacity = u.muzzle * .85; }
    }
    for (const [id, tm] of teamMeshes) if (!seen.has(id)) { tm.visible = false; freeTeams[tm.userData.team].push(tm); teamMeshes.delete(id); }

    // NGAF arc + IAG ring
    const half = sim.afHalfAngle(); afGroup.visible = half > 0;
    if (half > 0) {
      if (Math.abs(half - afBuilt) > 1e-4) buildAf(half);
      afGroup.rotation.y = Math.PI / 2 - S.afAng;
      const frac = S.afMax ? clamp(S.afHp / S.afMax, 0, 1) : 0;
      afMat.opacity = S.afDown ? .05 + .05 * Math.sin(time * 22) : .16 + frac * .34; afMat.color.set(S.afDown ? 0xff5a6a : 0x2ee6a0);
      afTopMat.opacity = S.afDown ? .25 : .5 + frac * .45; hexTex.offset.y = time * .12;
    }
    iagRing.visible = sq.iagBand; iagEdges.forEach(m => { m.visible = sq.iagBand; });
    if (sq.iagBand) iagMat.opacity = .1 + .04 * Math.sin(time * 3);

    // threats, bullets
    threats.sync(S.enemies, time, sq.ndrReveal);
    bullets.sync(S.shots, wX, wZ);

    // boss telegraphs + boss light
    let mi = 0, boss = null;
    for (const e of S.enemies) {
      if (e.spec.boss && !e.dead && !boss) boss = e;
      if (e.attack && mi < marks.length) {
        const a = e.attack, m = marks[mi++], prog = 1 - clamp(a.left / a.total, 0, 1), r = a.r * K;
        m.g.visible = true; m.g.position.set(wX(a.x), .09, wZ(a.y)); m.g.scale.setScalar(r); m.grow.scale.setScalar(Math.max(.02, prog));
        m.edge.material.opacity = .6 + .4 * Math.sin(time * 26); m.fill.material.opacity = .12 + prog * .14;
        if (Math.random() < dt * 30) { const t = Math.random() * TAU; spark(wX(a.x) + Math.cos(t) * r, .1, wZ(a.y) + Math.sin(t) * r, 0, rnd(2, 6), 0, '#ff5a6a', .18, .5, 0); }
      }
    }
    for (; mi < marks.length; mi++) marks[mi].g.visible = false;
    if (boss) { bossLight.color.set(boss.spec.color); bossLight.intensity = 90 + 40 * Math.sin(time * 5); bossLight.position.set(wX(boss.x), wR(boss.r) * 2 + 2, wZ(boss.y)); } else bossLight.intensity = 0;

    // lightning: XDR module links, the XDR chain, and transient zaps
    bolts.begin();
    if (S.link && S.levels.XDR) {
      mechRoot.updateWorldMatrix(true, false);
      const hub = v3.set(...ANCHOR.XDR); mechRoot.localToWorld(hub);
      for (const id of [...WEAPON_ORDER, 'AGENT']) {
        if (id === 'XDR' || !(id === 'AGENT' ? S.workflow : S.levels[id])) continue;
        const p = v3b.set(...ANCHOR[id]); mechRoot.localToWorld(p);
        bolts.jag(p.x, p.y, p.z, hub.x, hub.y, hub.z, .03, S.link.fired ? ACCENT.XDR : ACCENT[id], 3, .12, time);
      }
      if (!S.link.fired && Math.random() < dt * 40) spark(hub.x + rnd(-.4, .4), hub.y + rnd(-.3, .3), hub.z + rnd(-.4, .4), 0, 1.5, 0, '#c8ffe3', .16, .4, 0);
    }
    if (S.arc) {
      mechRoot.updateWorldMatrix(true, false);
      const hub = v3.set(...ANCHOR.XDR); mechRoot.localToWorld(hub);
      let px = hub.x, py = hub.y, pz = hub.z; const fade = Math.sqrt(Math.max(.02, S.arc.life / .62));
      for (let i = 0; i < S.arc.nodes.length; i++) {
        const n = S.arc.nodes[i]; if (!n.hit || n.skipped) continue;
        const nx = wX(n.x), ny = wR(n.r) + .5, nz = wZ(n.y);
        bolts.jag(px, py, pz, nx, ny, nz, .075 * fade * Math.pow(.92, i), i ? '#a6ffd2' : '#e6fff2', 7, .55, time * 3 + i);
        bolts.jag(px, py, pz, nx, ny, nz, .03 * fade, '#ffffff', 5, .9, time * 5 + i * 3);
        px = nx; py = ny; pz = nz;
      }
    }
    for (let i = zaps.length - 1; i >= 0; i--) { const z = zaps[i]; z.life -= dt * 4.2; if (z.life <= 0) { zaps.splice(i, 1); continue; } bolts.jag(z.ax, z.ay, z.az, z.bx, z.by, z.bz, .06 * z.life, z.color, 6, .5, time * 4 + i); }
    if (zaps.length > 40) zaps.splice(0, zaps.length - 40);
    bolts.end();

    updateParticles(dt); updateRings(dt);
    for (const p of pillars) { if (p.life <= 0) continue; p.life -= dt / p.dur; if (p.life <= 0) { p.m.visible = false; continue; } p.m.scale.set(p.r * (.4 + p.life * .8), 1, p.r * (.4 + p.life * .8)); p.m.material.opacity = p.life * .6; }
    for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt * 1.25; if (t.life <= 0) { texts.splice(i, 1); continue; } t.y += t.vy * dt; t.x += t.vx * dt; t.vy *= .94; }
  }
  const v3c = new THREE.Color();
  function updateParticles(dt) {
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) continue;
      if (i < MOTES) { pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; if (pPos[i * 3 + 1] > 16) pPos[i * 3 + 1] = 0; continue; }
      pLife[i] -= dt * pDecay[i];
      if (pLife[i] <= 0) { pCol[i * 4 + 3] = 0; pSize[i] = 0; continue; }
      pVel[i * 3 + 1] -= pGrav[i] * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      if (pPos[i * 3 + 1] < .05 && pGrav[i] > 0) { pPos[i * 3 + 1] = .05; pVel[i * 3 + 1] *= -.42; pVel[i * 3] *= .7; pVel[i * 3 + 2] *= .7; }
      pCol[i * 4 + 3] = Math.min(1, pLife[i] * 1.6);
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.pcolor.needsUpdate = true; pGeo.attributes.psize.needsUpdate = true;
  }
  function updateRings(dt) {
    for (const r of rings) { if (r.life <= 0) continue; r.life -= dt * 2.3; if (r.life <= 0) { r.m.visible = false; continue; } r.r += (r.max - r.r) * Math.min(1, dt * r.speed); r.m.scale.setScalar(r.r); r.m.material.opacity = r.life * .7; }
  }

  // ---------- camera ----------
  function updateCamera(dt) {
    const playing = S && (S.phase === 'play' || S.phase === 'paused');
    if (playing) {
      const op = S.op, want = Math.atan2(op.y, op.x);
      camYaw = wrap(camYaw + clamp(wrap(want - camYaw) * Math.min(1, dt * 4.5), -2.8 * dt, 2.8 * dt));
      const fxv = Math.cos(camYaw), fzv = Math.sin(camYaw), ox = wX(op.x), oz = wZ(op.y);
      const lookX = Math.cos(op.aim) * 1.6, lookZ = Math.sin(op.aim) * 1.6;
      wantPos.set(ox - fxv * camDist, camHigh, oz - fzv * camDist);
      wantAim.set(ox + fxv * 5.5 + lookX * 1.6, 1.4, oz + fzv * 5.5 + lookZ * 1.6);
      introT = Math.min(1, introT + dt * .7);
      const k = 1 - Math.exp(-dt * (2 + introT * 7));
      camPos.lerp(wantPos, k); camAim.lerp(wantAim, k);
    } else {
      // attract / aftermath: a slow orbit around the citadel
      attract += dt * .11;
      const over = S && S.phase === 'over', cxw = over ? wX(S.op.x) * .4 : 0, czw = over ? wZ(S.op.y) * .4 : 0;
      wantPos.set(cxw + Math.cos(attract) * 31, 13 + Math.sin(attract * .7) * 3, czw + Math.sin(attract) * 31); wantAim.set(cxw, 3.4, czw);
      const k = 1 - Math.exp(-dt * 1.6); camPos.lerp(wantPos, k); camAim.lerp(wantAim, k); introT = 0;
      camYaw = Math.atan2(-camPos.z, -camPos.x);
    }
    shakeA = Math.max(0, shakeA - dt * 2.4); flashA = Math.max(0, flashA - dt * 2.2); fovKick = Math.max(0, fovKick - dt * 3.5);
    camera.position.set(camPos.x + rnd(-1, 1) * shakeA * .45, camPos.y + rnd(-1, 1) * shakeA * .35, camPos.z + rnd(-1, 1) * shakeA * .45);
    camera.lookAt(camAim);
    const fov = fovBase + fovKick * 7; if (Math.abs(fov - camera.fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // the sun rides with the action so shadows stay crisp anywhere on the deck
    key.position.set(camAim.x - 16, 34, camAim.z + 10); key.target.position.set(camAim.x, 0, camAim.z);
  }

  // ---------- 2D overlay ----------
  const pv = new THREE.Vector3();
  function project(x, y, z) { pv.set(x, y, z).project(camera); return { x: (pv.x * .5 + .5) * W, y: (-pv.y * .5 + .5) * H, vis: pv.z < 1 && pv.z > -1, d: pv.z }; }
  function edgeArrow(x, z, color, label, pulse) {
    // points to something off-screen, in camera space, clamped to an inset frame
    pv.set(x, 2, z).applyMatrix4(camera.matrixWorldInverse);
    let dx = pv.x, dy = pv.y; const behind = pv.z > 0;
    const p = project(x, 2, z);
    if (!behind && p.x > 40 && p.x < W - 40 && p.y > 70 && p.y < H - 60) return;
    if (behind) { dy = -Math.abs(dy) - Math.abs(pv.z); }
    const a = Math.atan2(-dy, dx), cxs = W / 2, cys = H / 2, hw = W / 2 - 34, hh = H / 2 - 74;
    const t = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
    const px = cxs + Math.cos(a) * t, py = cys + Math.sin(a) * t + 8;
    g2.save(); g2.translate(px, py); g2.rotate(a);
    g2.globalAlpha = .65 + .35 * Math.sin(time * 8) * (pulse ? 1 : 0);
    g2.fillStyle = color; g2.beginPath(); g2.moveTo(14, 0); g2.lineTo(-8, -10); g2.lineTo(-3, 0); g2.lineTo(-8, 10); g2.closePath(); g2.fill();
    g2.restore(); g2.globalAlpha = 1;
    if (label) { g2.font = '800 9px ui-sans-serif,system-ui,sans-serif'; g2.textAlign = 'center'; g2.fillStyle = color; g2.fillText(label, clamp(px - Math.cos(a) * 24, 30, W - 30), py - Math.sin(a) * 24 + 3); }
  }
  let vignette = null, vigW = 0, vigH = 0;
  function drawOverlay() {
    g2.clearRect(0, 0, W, H);
    if (vigW !== W || vigH !== H) { vigW = W; vigH = H; vignette = g2.createRadialGradient(W / 2, H * .5, Math.min(W, H) * .3, W / 2, H * .52, Math.max(W, H) * .74); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(.7, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(2,8,10,.55)'); }
    g2.fillStyle = vignette; g2.fillRect(0, 0, W, H);
    if (!S || S.phase === 'idle') return;
    // health bars
    for (const e of S.enemies) {
      if (e.hp >= e.maxhp || e.spec.boss || (e.spec.cloak && !S.squad.ndrReveal)) continue;
      const p = project(wX(e.x), wR(e.r) * 2 + .7 + (FLY[e.type] || 0), wZ(e.y)); if (!p.vis) continue;
      const s = clamp(16 / Math.max(6, camera.position.distanceTo(v3.set(wX(e.x), 1, wZ(e.y)))), .45, 1.5), w = 30 * s;
      g2.fillStyle = 'rgba(0,0,0,.55)'; g2.fillRect(p.x - w / 2, p.y, w, 3.5 * s);
      g2.fillStyle = '#2ee6a0'; g2.fillRect(p.x - w / 2, p.y, w * clamp(e.hp / e.maxhp, 0, 1), 3.5 * s);
    }
    // damage numbers
    g2.textAlign = 'center';
    for (const t of texts) {
      const p = project(t.x, t.y, t.z); if (!p.vis) continue;
      const a = clamp(t.life * 1.5, 0, 1), s = clamp(15 / Math.max(5, camera.position.distanceTo(v3.set(t.x, t.y, t.z))), .55, 1.5), fs = (t.big ? 24 : 14) * s;
      g2.font = `800 ${fs}px ui-sans-serif,system-ui,sans-serif`;
      g2.fillStyle = `rgba(0,0,0,${a * .6})`; g2.fillText(t.text, p.x + 1, p.y + 1); g2.fillStyle = rgba(t.color, a); g2.fillText(t.text, p.x, p.y);
    }
    if (S.phase === 'play') {
      // off-screen threats: gates that are open, bosses, and anything gnawing at the core
      for (const i of S.gates.active) { const p = gates[i].g.position; edgeArrow(p.x, p.z, '#ff6a78', 'GATE', S.gates.pulse > 0); }
      let nearCore = false;
      for (const e of S.enemies) { if (e.spec.boss) edgeArrow(wX(e.x), wZ(e.y), e.spec.color, 'BOSS', true); else if (e.x * e.x + e.y * e.y < 240 * 240) nearCore = true; }
      if (nearCore) edgeArrow(0, 0, '#ffc04d', 'CORE', true);
      drawRadar();
      if (stick.id !== null) {
        g2.strokeStyle = 'rgba(190,255,220,.5)'; g2.lineWidth = 2; g2.beginPath(); g2.arc(stick.ox, stick.oy, 46, 0, TAU); g2.stroke();
        const dx = stick.x - stick.ox, dy = stick.y - stick.oy, l = Math.hypot(dx, dy) || 1, k = Math.min(46, l) / l;
        g2.fillStyle = 'rgba(155,232,90,.75)'; g2.beginPath(); g2.arc(stick.ox + dx * k, stick.oy + dy * k, 18, 0, TAU); g2.fill();
      }
    }
    if (flashA > 0) { g2.fillStyle = `rgba(${flashCol},${flashA * .2})`; g2.fillRect(0, 0, W, H); }
    if (S.base / S.baseMax < .25 && S.phase === 'play') { g2.fillStyle = `rgba(255,60,80,${.05 + .04 * Math.sin(time * 8)})`; g2.fillRect(0, 0, W, H); }
  }
  function drawRadar() {
    const small = W < 620, R = small ? 38 : 58, cx = small ? R + 10 : W - R - 18, cy = small ? 150 + R : H - R - 76, sc = R / (ARENA.R + 10);
    const f0 = Math.cos(camYaw), f1 = Math.sin(camYaw);
    const map = (x, y) => [cx + (x * -f1 + y * f0) * sc, cy - (x * f0 + y * f1) * sc];
    g2.save();
    g2.fillStyle = 'rgba(6,20,22,.72)'; g2.strokeStyle = 'rgba(140,200,170,.55)'; g2.lineWidth = 1.2;
    g2.beginPath(); g2.arc(cx, cy, R, 0, TAU); g2.fill(); g2.stroke();
    g2.strokeStyle = 'rgba(140,200,170,.16)'; for (const r of [ARENA.opMax, ARENA.afR]) { g2.beginPath(); g2.arc(cx, cy, r * sc, 0, TAU); g2.stroke(); }
    for (let i = 0; i < ARENA.gates; i++) {
      const a = gateAngle(i), on = S.gates.active.includes(i), [gx, gy] = map(Math.cos(a) * ARENA.spawnR, Math.sin(a) * ARENA.spawnR);
      g2.fillStyle = on ? `rgba(255,90,106,${.75 + .25 * Math.sin(time * 9)})` : 'rgba(110,170,160,.5)'; g2.beginPath(); g2.arc(gx, gy, on ? 4 : 2.2, 0, TAU); g2.fill();
    }
    if (S.squad.afTier > 0) {
      const half = sim.afHalfAngle(), base = Math.atan2(-(Math.cos(S.afAng) * f0 + Math.sin(S.afAng) * f1), Math.cos(S.afAng) * -f1 + Math.sin(S.afAng) * f0);
      g2.strokeStyle = S.afDown ? 'rgba(255,90,106,.6)' : 'rgba(46,230,160,.9)'; g2.lineWidth = 2; g2.beginPath(); g2.arc(cx, cy, ARENA.afR * sc, base - half, base + half); g2.stroke();
    }
    for (const e of S.enemies) {
      if (e.spec.cloak && !S.squad.ndrReveal) continue;
      const [ex, ey] = map(e.x, e.y); g2.fillStyle = e.spec.boss ? e.spec.color : '#ff8a6a';
      g2.beginPath(); g2.arc(ex, ey, e.spec.boss ? 4.2 : 1.7, 0, TAU); g2.fill();
    }
    for (const u of S.temps) { const [ux, uy] = map(u.fx, u.fy); g2.fillStyle = u.color; g2.fillRect(ux - 1.5, uy - 1.5, 3, 3); }
    g2.fillStyle = hpColor(); g2.beginPath(); g2.arc(cx, cy, 4, 0, TAU); g2.fill();
    const [px, py] = map(S.op.x, S.op.y), aim = Math.atan2(-(Math.cos(S.op.aim) * f0 + Math.sin(S.op.aim) * f1), Math.cos(S.op.aim) * -f1 + Math.sin(S.op.aim) * f0);
    g2.translate(px, py); g2.rotate(aim); g2.fillStyle = '#ffffff'; g2.beginPath(); g2.moveTo(6, 0); g2.lineTo(-4, -4); g2.lineTo(-2, 0); g2.lineTo(-4, 4); g2.closePath(); g2.fill();
    g2.restore();
  }
  const hpColor = () => { const f = S.base / S.baseMax; return f > .5 ? '#9be85a' : f > .25 ? '#ffc04d' : '#ff5a6a'; };

  // ---------- instanced threats (creatures face where they are heading) ----------
  function createThreatInstances(parent) {
    const batches = new Map(); let active = 0;
    function getBatch(e, radius, revealed) {
      const k = `${e.type}:${!!(e.spec.cloak && !revealed)}:${e.hit > 0}`;
      if (batches.has(k)) return batches.get(k);
      const source = art.enemy(e, radius); source.group.removeFromParent();
      const parts = [];
      source.group.traverse(part => {
        if (!part.isMesh) return;
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, MAX_ACTIVE_THREATS);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
        mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; mesh.userData.sharedStandGeometry = true; parent.add(mesh);
        parts.push({ mesh, source: part });
      });
      const batch = { source, parts, count: 0 }; batches.set(k, batch); return batch;
    }
    return {
      sync(list, t, revealed) {
        for (const b of batches.values()) b.count = 0;
        for (const e of list) {
          if (e.dead) continue;
          const radius = wR(e.r), batch = getBatch(e, radius, revealed), src = batch.source;
          const born = S ? clamp((S.elapsed - e.bornAt) / .5, .15, 1) : 1;
          src.group.scale.setScalar(radius * .79 * born);
          src.group.position.set(wX(e.x), radius + .35 + (FLY[e.type] || 0), wZ(e.y));
          art.animateEnemy(src, e, t, revealed);
          src.group.rotation.y += Math.atan2(-Math.cos(e.heading), -Math.sin(e.heading));
          if (e.held) src.group.rotation.x = Math.sin(t * 30 + e.id) * .08; else src.group.rotation.x = FLY[e.type] ? .18 : 0;
          src.group.updateMatrixWorld(true);
          for (const part of batch.parts) part.mesh.setMatrixAt(batch.count, part.source.matrixWorld);
          batch.count++;
        }
        active = 0;
        for (const b of batches.values()) { if (b.count) active++; for (const { mesh } of b.parts) { mesh.count = b.count; mesh.visible = b.count > 0; if (b.count) mesh.instanceMatrix.needsUpdate = true; } }
      },
      get active() { return active; },
      dispose() { const mats = new Set(); for (const b of batches.values()) for (const { mesh } of b.parts) { parent.remove(mesh); mesh.dispose(); mats.add(mesh.material); } mats.forEach(m => m.dispose()); batches.clear(); },
    };
  }

  // ---------- instanced lightning segments ----------
  function createBolts(parent, capacity) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    const layers = [[3.2, .16], [1, .95]].map(([wide, opacity]) => { const m = new THREE.InstancedMesh(geo, glow(0xffffff, opacity), capacity); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color()); m.count = 0; parent.add(m); return { m, wide }; });
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), mid = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), sc = new THREE.Vector3(), mat = new THREE.Matrix4(), col = new THREE.Color();
    let n = 0;
    function seg(ax, ay, az, bx, by, bz, width, color) {
      if (n >= capacity) return;
      a.set(ax, ay, az); b.set(bx, by, bz); d.subVectors(b, a); const len = d.length(); if (len < 1e-4) return;
      q.setFromUnitVectors(up, d.multiplyScalar(1 / len)); mid.addVectors(a, b).multiplyScalar(.5); col.set(color);
      for (const L of layers) { sc.set(width * L.wide, len, width * L.wide); L.m.setMatrixAt(n, mat.compose(mid, q, sc)); L.m.setColorAt(n, col); }
      n++;
    }
    return {
      begin() { n = 0; },
      jag(ax, ay, az, bx, by, bz, width, color, parts, amp, phase) {
        let px = ax, py = ay, pz = az; const len = Math.hypot(bx - ax, by - ay, bz - az), j = amp * Math.min(1, len / 4);
        for (let i = 1; i <= parts; i++) {
          const f = i / parts, env = Math.sin(f * Math.PI) * j;
          const nx = ax + (bx - ax) * f + Math.sin(i * 12.9 + phase * 7.1) * env, ny = ay + (by - ay) * f + Math.sin(i * 7.3 + phase * 9.7) * env * .7, nz = az + (bz - az) * f + Math.cos(i * 9.1 + phase * 8.3) * env;
          seg(px, py, pz, nx, ny, nz, width, color); px = nx; py = ny; pz = nz;
        }
      },
      end() { for (const L of layers) { L.m.count = n; L.m.visible = n > 0; L.m.instanceMatrix.needsUpdate = true; if (L.m.instanceColor) L.m.instanceColor.needsUpdate = true; } },
      get count() { return n; },
      dispose() { for (const L of layers) { parent.remove(L.m); L.m.dispose(); L.m.material.dispose(); } geo.dispose(); },
    };
  }

  // ---------- procedural textures ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  }
  function makeSkyTex() {
    const t = canvasTex(2048, 1024, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      [[0, '#03070d'], [.3, '#071821'], [.46, '#0f3238'], [.5, '#1d5a55'], [.535, '#0d2a2c'], [.7, '#061214'], [1, '#020607']].forEach(([s, c]) => grd.addColorStop(s, c));
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      let seed = 11; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 900; i++) { const y = r01() * h * .46, a = .25 + r01() * .7; g.fillStyle = `rgba(${200 + r01() * 55 | 0},${225 + r01() * 30 | 0},255,${a * (1 - y / (h * .5))})`; const s = r01() < .06 ? 2.4 : 1.2; g.fillRect(r01() * w, y, s, s); }
      for (let i = 0; i < 7; i++) { const x = r01() * w, y = h * (.2 + r01() * .22), rad = 120 + r01() * 220, ng = g.createRadialGradient(x, y, 0, x, y, rad); ng.addColorStop(0, i % 2 ? 'rgba(60,200,170,.10)' : 'rgba(130,220,90,.07)'); ng.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ng; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      const hz = g.createLinearGradient(0, h * .47, 0, h * .53); hz.addColorStop(0, 'rgba(120,255,210,0)'); hz.addColorStop(.5, 'rgba(120,255,210,.22)'); hz.addColorStop(1, 'rgba(120,255,210,0)'); g.fillStyle = hz; g.fillRect(0, h * .47, w, h * .06);
    });
    t.mapping = THREE.EquirectangularReflectionMapping; return t;
  }
  function makeDeckTextures() {
    const SZ = 2048, c = SZ / 2, s = c / (ARENA.R + 4);
    const lanes = (g, style, wide) => { for (let i = 0; i < ARENA.gates; i++) { const a = gateAngle(i); g.save(); g.translate(c, c); g.rotate(a); style(g, wide); g.restore(); } };
    const color = canvasTex(SZ, SZ, g => {
      const grd = g.createRadialGradient(c, c, 40, c, c, c); grd.addColorStop(0, '#31473f'); grd.addColorStop(.45, '#263a35'); grd.addColorStop(1, '#16262a'); g.fillStyle = grd; g.fillRect(0, 0, SZ, SZ);
      for (let i = 0; i < 52000; i++) { const x = (i * 73 + Math.floor(i / 97) * 31) % SZ, y = (i * 151 + Math.floor(i / 43) * 19) % SZ; g.fillStyle = i % 2 ? 'rgba(235,243,221,.022)' : 'rgba(4,20,18,.035)'; g.fillRect(x, y, 2, 2); }
      // radial plating
      g.strokeStyle = 'rgba(8,24,22,.5)'; g.lineWidth = 3;
      for (const r of [ARENA.opMin - 30, 250, ARENA.opMax + 26, 600, 700]) { g.beginPath(); g.arc(c, c, r * s, 0, TAU); g.stroke(); }
      for (let i = 0; i < 36; i++) { const a = i * TAU / 36 + TAU / 72; g.beginPath(); g.moveTo(c + Math.cos(a) * 120 * s, c + Math.sin(a) * 120 * s); g.lineTo(c + Math.cos(a) * ARENA.R * s, c + Math.sin(a) * ARENA.R * s); g.stroke(); }
      g.strokeStyle = 'rgba(190,215,180,.07)'; g.lineWidth = 1;
      for (const r of [ARENA.opMin - 27, 253, ARENA.opMax + 29, 603, 703]) { g.beginPath(); g.arc(c, c, r * s, 0, TAU); g.stroke(); }
      // approach lanes from each gate
      lanes(g, gg => { const lg = gg.createLinearGradient(80 * s, 0, ARENA.spawnR * s, 0); lg.addColorStop(0, 'rgba(180,215,170,0)'); lg.addColorStop(1, 'rgba(180,215,170,.1)'); gg.fillStyle = lg; gg.beginPath(); gg.moveTo(90 * s, -14 * s); gg.lineTo(ARENA.spawnR * s, -70 * s); gg.lineTo(ARENA.spawnR * s, 70 * s); gg.lineTo(90 * s, 14 * s); gg.closePath(); gg.fill(); });
      // core apron
      const ap = g.createRadialGradient(c, c, 0, c, c, 110 * s); ap.addColorStop(0, '#0f1d1f'); ap.addColorStop(.8, '#15272a'); ap.addColorStop(1, 'rgba(21,39,42,0)'); g.fillStyle = ap; g.beginPath(); g.arc(c, c, 110 * s, 0, TAU); g.fill();
      g.strokeStyle = '#0b1718'; g.lineWidth = 16; g.beginPath(); g.arc(c, c, (ARENA.R - 14) * s, 0, TAU); g.stroke();
    });
    const glowT = canvasTex(SZ, SZ, g => {
      g.fillStyle = '#000'; g.fillRect(0, 0, SZ, SZ);
      const ringLine = (r, col, w, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.arc(c, c, r * s, 0, TAU); g.stroke(); g.setLineDash([]); };
      ringLine(ARENA.R - 26, 'rgba(131,190,75,.85)', 5); ringLine(ARENA.R - 44, 'rgba(131,190,75,.25)', 2, [30, 22]);
      ringLine(ARENA.coreR + 34, 'rgba(155,232,90,.8)', 4); ringLine(ARENA.opMin - 8, 'rgba(113,202,190,.3)', 2, [8, 14]);
      ringLine(ARENA.opMax + 8, 'rgba(113,202,190,.32)', 2, [18, 18]); ringLine(ARENA.afR, 'rgba(46,230,160,.22)', 2, [4, 10]);
      ringLine(ARENA.bossHold, 'rgba(255,120,130,.16)', 2, [3, 16]);
      lanes(g, gg => { gg.strokeStyle = 'rgba(113,202,190,.4)'; gg.lineWidth = 3; gg.lineJoin = 'round'; for (let r = 180; r < ARENA.spawnR - 30; r += 46) { const k = 5 + r * .034; gg.beginPath(); gg.moveTo((r + 12) * s, -k * s); gg.lineTo(r * s, 0); gg.lineTo((r + 12) * s, k * s); gg.stroke(); }
        gg.fillStyle = 'rgba(255,110,120,.5)'; gg.fillRect((ARENA.spawnR - 34) * s, -62 * s, 5 * s, 124 * s); });
      for (let i = 0; i < 72; i++) { const a = i * TAU / 72; g.fillStyle = i % 6 ? 'rgba(131,190,75,.3)' : 'rgba(190,255,150,.8)'; g.save(); g.translate(c, c); g.rotate(a); g.fillRect((ARENA.R - 62) * s, -1.5, (i % 6 ? 10 : 22) * s, 3); g.restore(); }
    });
    return { color, glow: glowT };
  }
  function makeStripeTex() {
    const t = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 64; i++) { const x = i * 8; g.fillStyle = i % 8 === 0 ? 'rgba(160,255,200,.9)' : 'rgba(90,200,170,.12)'; g.fillRect(x, i % 8 === 0 ? 0 : 18, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? h : 60 + (i * 37 % 120)); }
      g.fillStyle = 'rgba(160,255,200,.7)'; g.fillRect(0, 8, w, 3); g.fillStyle = 'rgba(160,255,200,.2)'; g.fillRect(0, 120, w, 2);
      let seed = 5; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r01() < .2 ? '255,210,130' : '150,240,220'},${.25 + r01() * .5})`; g.fillRect((r01() * 64 | 0) * 8 + 2, 30 + (r01() * 26 | 0) * 8, 4, 3); }
    }, true); t.repeat.set(6, 1); return t;
  }
  function makeWindowTex() {
    return canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      let seed = 3; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let y = 0; y < 31; y++) for (let x = 0; x < 16; x++) { if (r01() > .3) continue; const k = r01(); g.fillStyle = k < .62 ? `rgba(110,230,205,${.25 + r01() * .6})` : k < .88 ? `rgba(255,205,130,${.3 + r01() * .5})` : 'rgba(235,255,245,.9)'; g.fillRect(x * 16 + 4, y * 16 + 5, 9, 7); }
    }, true);
  }
  function makePortalTex() {
    return canvasTex(128, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#000'); grd.addColorStop(.5, '#fff'); grd.addColorStop(1, '#000'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'multiply'; const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, '#333'); v.addColorStop(.5, '#fff'); v.addColorStop(1, '#999'); g.fillStyle = v; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over'; for (let y = 0; y < h; y += 8) { g.fillStyle = `rgba(0,0,0,${.25 + (y % 32 === 0 ? .35 : 0)})`; g.fillRect(0, y, w, 3); }
    }, true);
  }
  function makeHexTex() {
    return canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, w); g.strokeStyle = '#fff'; g.lineWidth = 2.2;
      const r = 21.33, hh = r * Math.sqrt(3) / 2;
      for (let row = -1; row < 5; row++) for (let colI = -1; colI < 4; colI++) { const x = colI * r * 3 + (row % 2 ? r * 1.5 : 0), y = row * hh; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.stroke(); }
    }, true);
  }

  // ---------- loop ----------
  let raf = 0, lastTS = 0, frames = 0, starting = false;
  function frame(ts) {
    const dt = Math.min(.25, Math.max(0, (ts - lastTS) / 1000 || 0)); lastTS = ts; frames++;
    if (S && S.phase === 'play') {
      readInput();
      let left = dt;
      while (S.phase === 'play' && left > 1e-8) { const step = Math.min(1 / 60, left); sim.step(step, input); left -= step; }
    }
    updateCamera(dt); syncScene(S && S.phase === 'paused' ? 0 : dt);
    renderer.info.reset(); composer.render(); drawOverlay();
    raf = requestAnimationFrame(frame);
  }
  function disposeTree(o) { o.traverse(n => { if (n.geometry && !n.userData.sharedStandGeometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { m.map?.dispose?.(); m.dispose(); }); }); }

  resize(); bind();
  camPos.set(31, 15, 0); lastTS = performance.now(); raf = requestAnimationFrame(frame);
  return {
    start(best = 0) {
      starting = true; try { S = sim.start(best); } finally { starting = false; } resize(); lastStage = -1; texts.length = 0; zaps = []; flashA = 0; shakeA = 0; introT = 0; mouse.on = false; clearKeys();
      for (const [, tm] of teamMeshes) { tm.visible = false; freeTeams[tm.userData.team].push(tm); } teamMeshes.clear();
      lastTS = performance.now();
    },
    applyUpgrade: id => sim.applyUpgrade(id),
    chooseUpgrade: id => sim.chooseUpgrade(id),
    useAbility: id => sim.useAbility(id),
    dash() { dashQueued = 2; },
    pause() { if (S && S.phase === 'play') S.phase = 'paused'; },
    resume() { if (S && S.phase === 'paused') { S.phase = 'play'; lastTS = performance.now(); } },
    stop() { if (S) S.phase = 'idle'; S = null; },
    destroy() { cancelAnimationFrame(raf); unbind(); threats.dispose(); bullets.dispose(); bolts.dispose(); disposeTree(scene); art.dispose(); Object.values(markTex).forEach(t => t.dispose()); brandTex.dispose(); scene.background.dispose(); composer.dispose(); renderer.dispose(); fx.remove(); },
    resize,
    get diagnostics() { return { art: 'citadel-3d', calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      enemies: S?.enemies.length || 0, shots: S?.shots.length || 0, enemyBatches: threats.active, bolts: bolts.count, texts: texts.length, frames,
      rig: art.rigDiagnostics, camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: camYaw, fov: camera.fov }, pixelRatio: renderer.getPixelRatio() }; },
    get phase() { return S ? S.phase : 'idle'; },
    get state() { return S || (starting ? sim.state : null); },
    sim,
  };
}
