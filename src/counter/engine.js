// Sentinel Counter-Breach - first-person view and shell for the rules in sim.js.
// A roofless data-center map built from the sim's grid, box-built threats, a
// viewmodel gun in its own pass, and a rotating radar. The camera sits above the
// map for the menu and the buy phase and drops into the player's eyes for the round.

import * as THREE from 'three';
import { createSim, COLS, ROWS, CELL, cx, cz, idx, SOLID, RACK, CRATE, CRATE_H, SITES, GATES, VENTS, THREAT, EYE, COLOR } from './sim.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';
import { snd, wake } from './sound.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const WALLH = 4.2, H = Math.PI / 2;

export function createCounterGame(canvas, opts = {}) {
  const label = opts.label || (k => k), ev = (t, d) => opts.onEvent?.(t, d);
  let shell = 'menu', lastHud = null;
  const SFX = { shot: a => snd.shot(a), reload: () => snd.reload(), wrong: () => snd.hurt(), hit: a => (a >= 6 ? snd.kill() : snd.buy()), start: () => snd.go(), serve: () => snd.nade(), boss: () => snd.planted() };
  const sim = createSim({ onHud: h => { lastHud = h; opts.onHud?.(h); }, onFeed: opts.onFeed, onToast: opts.onToast, onSfx: (n, a) => SFX[n]?.(a), onOver: s => { shell = 'over'; unlock(); opts.onOver?.(s); } });
  const S = sim.S; sim.reset(1); S.phase = 'idle';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0d12); scene.fog = new THREE.Fog(0x0a0d12, 34, 92);
  const camera = new THREE.PerspectiveCamera(74, 1, .08, 200); camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xe6edf5, 0x30343c, 1.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.5); sun.position.set(-14, 30, 10); scene.add(sun);
  const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(52, 1, .02, 10);
  vmScene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f48, 1.7)); const vmSun = new THREE.DirectionalLight(0xffffff, 1.3); vmSun.position.set(-1, 2, 1); vmScene.add(vmSun);

  // ---------- geometry helpers ----------
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
  const B = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => new THREE.BoxGeometry(w, h, d).applyMatrix4(_m4.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s));
  function merge(list, color) { // merges non-indexed copies; optional per-geometry colors
    const flat = list.map(g => (g.index ? g.toNonIndexed() : g)); let n = 0; for (const g of flat) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = color ? new Float32Array(n * 3) : null; let o = 0;
    flat.forEach((g, gi) => { const k = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); if (col) { _c.set(color[gi]); for (let i = 0; i < k; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; } } o += k; });
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    list.forEach(g => g.dispose()); flat.forEach(g => g.dispose()); return out;
  }
  function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  let seed = 7; const r01 = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  function textSprite(text, color = '#fff', size = 1, bg = 'rgba(8,10,14,.72)') {
    const t = canvasTex(256, 64, (g, w, h) => { g.font = '700 34px "Bahnschrift","DIN Alternate","Roboto Condensed","Arial Narrow","PingFang SC","Microsoft YaHei",sans-serif'; const tw = Math.min(w - 16, g.measureText(text).width + 28); if (bg) { g.fillStyle = bg; g.fillRect((w - tw) / 2, 8, tw, h - 16); g.fillStyle = color; g.fillRect((w - tw) / 2, h - 12, tw, 4); } g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1, w - 24); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(4 * size, size, 1); return sp;
  }

  // ---------- the map ----------
  const open = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !SOLID[idx(c, r)];
  const tint = (c, r) => (r <= 4 ? 0x8a5a55 : r <= 10 ? (c <= 6 ? 0xc0a473 : c >= 16 ? 0x7095b8 : 0x9aa1a8) : r <= 17 ? (c <= 8 ? 0xcfae72 : c >= 14 ? 0x6c98c2 : 0xa3a9af) : 0x86a893);
  const wallTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const v = r01() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},.035)`; g.fillRect(r01() * w, r01() * h, 2 + r01() * 5, 1 + r01() * 2); }
    g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(0, h - 30, w, 30); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, w, 10); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 10, w, 3);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); g.beginPath(); g.moveTo(0, 96); g.lineTo(w, 96); g.moveTo(0, 170); g.lineTo(w, 170); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.25)'; for (const x of [12, w - 16]) for (const y of [106, 180]) g.fillRect(x, y, 4, 4);
  });
  { const geos = [], cols = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!SOLID[idx(c, r)] || RACK[idx(c, r)]) continue; let vis = false; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (open(c + dc, r + dr)) vis = true; if (!vis) continue;
      geos.push(B(CELL, WALLH, CELL, cx(c), WALLH / 2, cz(r))); cols.push(tint(c, r));
    }
    scene.add(new THREE.Mesh(merge(geos, cols), new THREE.MeshLambertMaterial({ map: wallTex, vertexColors: true }))); }
  const rackDraw = led => (g, w, h) => {
    g.fillStyle = led ? '#000' : '#15181d'; g.fillRect(0, 0, w, h); let s2 = 11; const rr = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
    for (let y = 14; y < h - 14; y += 15) { if (!led) { g.fillStyle = '#24282f'; g.fillRect(10, y, w - 20, 11); g.fillStyle = '#0c0e11'; for (let x = 44; x < w - 16; x += 6) g.fillRect(x, y + 2, 3, 7); }
      for (let k = 0; k < 3; k++) { const v = rr(); g.fillStyle = v > .8 ? '#ffb040' : v > .25 ? '#39e58c' : '#3b9bff'; if (rr() > .2) g.fillRect(14 + k * 8, y + 4, 4, 3); } }
    if (!led) { g.strokeStyle = '#3a4048'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }
  };
  { const geos = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (RACK[idx(c, r)]) geos.push(B(1.72, 3.3, 1.72, cx(c), 1.65, cz(r)));
    scene.add(new THREE.Mesh(merge(geos), new THREE.MeshLambertMaterial({ map: canvasTex(128, 256, rackDraw(false)), emissiveMap: canvasTex(128, 256, rackDraw(true)), emissive: 0xffffff, emissiveIntensity: 1.4 }))); }
  // waist-high spare-parts crates: cover you can crouch behind or jump onto
  { const geos = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (CRATE[idx(c, r)]) geos.push(B(CELL - .1, CRATE_H, CELL - .1, cx(c), CRATE_H / 2, cz(r)));
    const tex = canvasTex(128, 128, (g, w) => { g.fillStyle = '#5b6470'; g.fillRect(0, 0, w, w); g.fillStyle = '#4a525d'; g.fillRect(8, 8, w - 16, w - 16); g.strokeStyle = '#2b3038'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, w - 6); g.beginPath(); g.moveTo(8, 8); g.lineTo(w - 8, w - 8); g.moveTo(w - 8, 8); g.lineTo(8, w - 8); g.stroke(); g.fillStyle = '#e9a13b'; g.fillRect(8, 8, w - 16, 12); g.fillStyle = '#1b1e23'; for (let x = 8; x < w - 8; x += 24) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 12, 8); g.lineTo(x + 20, 8); g.lineTo(x + 8, 20); g.fill(); } });
    if (geos.length) scene.add(new THREE.Mesh(merge(geos), new THREE.MeshLambertMaterial({ map: tex }))); }
  const floorTex = canvasTex(128, 128, (g, w) => { g.fillStyle = '#4a4f57'; g.fillRect(0, 0, w, w); for (let i = 0; i < 300; i++) { const v = r01() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},.03)`; g.fillRect(r01() * w, r01() * w, 3, 3); } g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.strokeRect(0, 0, w, w); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.strokeRect(3, 3, w - 6, w - 6); }, true);
  floorTex.repeat.set(COLS, ROWS);
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL), new THREE.MeshLambertMaterial({ map: floorTex })); f.rotation.x = -H; scene.add(f); }
  function floorPatch(c0, r0, c1, r1, color, opacity, y = .012) { const w = (c1 - c0 + 1) * CELL, d = (r1 - r0 + 1) * CELL, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); m.rotation.x = -H; m.position.set((cx(c0) + cx(c1)) / 2, y, (cz(r0) + cz(r1)) / 2); scene.add(m); return m; }
  floorPatch(1, 1, 21, 3, 0xff3b3b, .16); floorPatch(1, 12, 7, 16, 0xffb84a, .13); floorPatch(15, 12, 21, 16, 0x4aa8ff, .14); floorPatch(9, 18, 13, 21, 0x49c7a0, .14);
  for (const k of ['A', 'B']) {
    const t = canvasTex(256, 256, (g, w) => { const col = k === 'A' ? '#ffc04a' : '#5ab4ff'; g.strokeStyle = col; g.lineWidth = 10; g.setLineDash([26, 14]); g.strokeRect(14, 14, w - 28, w - 28); g.setLineDash([]); g.fillStyle = col; g.font = '900 170px "Bahnschrift","Arial Narrow",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = .85; g.fillText(k, w / 2, w / 2 + 8); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -H; m.position.set(SITES[k].x, .02, SITES[k].z); scene.add(m);
  }
  for (const v of VENTS) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), glow(0x9be04a, .45)); m.rotation.x = -H; m.position.set(cx(v.c), .03, cz(v.r)); scene.add(m); scene.add(new THREE.Mesh(B(1.1, .12, 1.1, cx(v.c), .06, cz(v.r)), new THREE.MeshLambertMaterial({ color: 0x1c2a14 }))); }
  // wayfinding beacons above the walls + the firewall planes on the three gates
  const signs = [];
  function sign(key, color, x, y, z, size) { const o = { key, color, x, y, z, size, sp: null }; signs.push(o); return o; }
  sign('sign.A', '#ffc04a', SITES.A.x, 5.6, SITES.A.z, 1.5); sign('sign.B', '#5ab4ff', SITES.B.x, 5.6, SITES.B.z, 1.5); sign('sign.soc', '#49c7a0', 0, 5.3, 18, 1.1); sign('sign.net', '#ff6a6a', 0, 5.6, -19, 1.3);
  GATES.forEach((g, i) => sign('sign.gate' + g.id, '#ff8a3c', g.x, 5.0, g.z, .95));
  function relabel() { for (const s of signs) { if (s.sp) { scene.remove(s.sp); s.sp.material.map.dispose(); s.sp.material.dispose(); } s.sp = textSprite(label(s.key), s.color, s.size); s.sp.position.set(s.x, s.y, s.z); scene.add(s.sp); } for (const k in tagTex) { tagTex[k].dispose(); delete tagTex[k]; } }
  const fwTex = canvasTex(128, 128, (g, w) => { g.strokeStyle = '#fff'; g.lineWidth = 3; for (let y = -1; y < 6; y++) for (let x = -1; x < 5; x++) { const px = x * 32 + (y % 2 ? 16 : 0), py = y * 27; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g[k ? 'lineTo' : 'moveTo'](px + 16 + Math.cos(a) * 17, py + 14 + Math.sin(a) * 17); } g.closePath(); g.stroke(); } }, true);
  const fw = GATES.map(g => { const mat = glow(0xff8a3c, .5); mat.map = fwTex; const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL, WALLH - .2), mat); m.position.set(g.x, WALLH / 2 - .1, g.z); m.visible = false; scene.add(m); const fill = new THREE.Mesh(new THREE.PlaneGeometry(CELL, WALLH - .2), glow(0xff8a3c, .1)); m.add(fill); return { m, mat, fill }; });

  // ---------- threats ----------
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f38 }), eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, depthWrite: false }), cloakMat = glow(0x6fe6ff, .07), xrayMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: .17, depthTest: false, depthWrite: false }), stunMat = new THREE.MeshBasicMaterial({ color: 0x5fd4e8, transparent: true, opacity: .5, depthWrite: false });
  const accMat = {}; for (const k in THREAT) accMat[k] = new THREE.MeshLambertMaterial({ color: THREAT[k].color, emissive: THREAT[k].color, emissiveIntensity: .55 });
  const leg = (w, h, d, x, z = 0) => ({ w, h, d, x, y: h, z });
  const SPEC = {
    phish: { body: [[.55, .6, .32, 0, 1.1, 0], [.14, .55, .16, -.36, 1.08, 0], [.14, .55, .16, .36, 1.08, 0], [.36, .34, .34, 0, 1.58, 0]], acc: [[.3, .2, .04, 0, 1.2, -.17], [.06, .26, .06, 0, 1.86, 0], [.2, .06, .06, .08, 1.98, 0], [.06, .12, .06, .17, 1.92, 0]], eye: [[.26, .07, .03, 0, 1.6, -.18]], legs: [leg(.2, .8, .22, -.16), leg(.2, .8, .22, .16)] },
    worm: { body: [[.6, .5, .5, 0, .3, -.3], [.52, .42, .45, 0, .26, .15], [.42, .34, .4, 0, .22, .55], [.3, .24, .3, 0, .17, .88]], acc: [[.5, .06, .12, 0, .57, -.3], [.44, .06, .12, 0, .49, .15], [.34, .06, .12, 0, .41, .55], [.05, .3, .05, -.18, .7, -.5, .5], [.05, .3, .05, .18, .7, -.5, .5]], eye: [[.1, .1, .03, -.15, .38, -.56], [.1, .1, .03, .15, .38, -.56]], legs: [] },
    trojan: { body: [[.5, .5, 1.1, 0, 1.05, 0], [.26, .62, .26, 0, 1.5, -.5, -.5], [.24, .26, .5, 0, 1.78, -.8]], acc: [[.08, .5, .3, 0, 1.62, -.36, -.5], [.54, .1, .44, 0, 1.33, .05], [.08, .4, .08, 0, 1.05, .6, .5]], eye: [[.04, .07, .1, -.13, 1.82, -.9], [.04, .07, .1, .13, 1.82, -.9]], legs: [leg(.16, .8, .16, -.2, -.38), leg(.16, .8, .16, .2, -.38), leg(.16, .8, .16, .2, .4), leg(.16, .8, .16, -.2, .4)] },
    apt: { body: [[.42, .7, .26, 0, 1.25, 0], [.62, .95, .08, 0, 1.08, .17], [.34, .34, .36, 0, 1.75, 0], [.2, .12, .22, 0, 1.97, 0], [.07, .07, 1.1, .26, 1.3, -.45]], acc: [[.5, .05, .3, 0, 1.6, 0], [.09, .09, .1, .26, 1.3, -1.02]], eye: [[.2, .04, .03, 0, 1.76, -.19]], legs: [leg(.15, .9, .18, -.12), leg(.15, .9, .18, .12)] },
    brute: { body: [[1.3, 1.1, .8, 0, 1.6, 0], [.42, 1.2, .46, -.9, 1.5, 0], [.42, 1.2, .46, .9, 1.5, 0], [.4, .36, .4, 0, 2.36, 0]], acc: [[.5, .5, .06, 0, 1.65, -.41], [.46, .3, .5, -.9, .8, 0], [.46, .3, .5, .9, .8, 0], [.3, .2, .3, -.7, 2.28, 0, 0, 0, .5], [.3, .2, .3, .7, 2.28, 0, 0, 0, -.5]], eye: [[.3, .08, .03, 0, 2.38, -.21]], legs: [leg(.4, 1.02, .45, -.35), leg(.4, 1.02, .45, .35)] },
    carrier: { body: [[.6, .62, .34, 0, 1.12, 0], [.16, .55, .18, -.4, 1.1, 0], [.16, .55, .18, .4, 1.1, 0], [.36, .34, .34, 0, 1.6, 0]], acc: [[.62, .1, .36, 0, 1.3, 0], [.62, .1, .36, 0, .95, 0], [.38, .08, .36, 0, 1.8, 0]], eye: [[.26, .07, .03, 0, 1.62, -.18]], legs: [leg(.22, .8, .24, -.17), leg(.22, .8, .24, .17)] },
  };
  const MODEL = {};
  for (const k in SPEC) { const sp = SPEC[k], mk = l => l.map(a => B(...a)); MODEL[k] = { body: merge(mk(sp.body)), acc: merge(mk(sp.acc)), eye: merge(mk(sp.eye)), legs: sp.legs.map(l => ({ ...l, geo: B(l.w, l.h, l.d, 0, -l.h / 2, 0) })), sil: merge([...mk(sp.body), ...mk(sp.acc), ...sp.legs.map(l => B(l.w, l.h, l.d, l.x, l.h / 2, l.z))]) }; }
  const tagTex = {};
  function tagSprite(key, color) { if (!tagTex[key]) { const s = textSprite(label(key), color, 1, 'rgba(8,10,14,.6)'); tagTex[key] = s.material.map; } const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex[key], transparent: true, depthWrite: false })); sp.scale.set(1.5, .375, 1); return sp; }
  const inst = new Map(), dying = [];
  function makeThreat(th) {
    const m = MODEL[th.type], root = new THREE.Group(), vis = new THREE.Group(); root.add(vis);
    vis.add(new THREE.Mesh(m.body, dark), new THREE.Mesh(m.acc, accMat[th.type]), new THREE.Mesh(m.eye, eyeMat));
    const legs = m.legs.map(l => { const pm = new THREE.Mesh(l.geo, dark); pm.position.set(l.x, l.y, l.z); vis.add(pm); return pm; });
    const flash = new THREE.Mesh(m.sil, flashMat), cloak = new THREE.Mesh(m.sil, cloakMat), xray = new THREE.Mesh(m.sil, xrayMat), stun = new THREE.Mesh(m.sil, stunMat); xray.renderOrder = 6; flash.scale.setScalar(1.03); stun.scale.setScalar(1.05);
    root.add(flash, cloak, xray, stun); const tag = tagSprite('th.' + th.type, THREAT[th.type].color); tag.position.y = th.h + .55; root.add(tag);
    const denied = tagSprite('th.denied', '#5fd4e8'); denied.position.y = th.h + 1.0; root.add(denied);
    scene.add(root); return { root, vis, legs, flash, cloak, xray, stun, tag, denied, lunge: 0, type: th.type };
  }
  const bomb = new THREE.Group(); bomb.add(new THREE.Mesh(B(.5, .3, .34, 0, .15, 0), new THREE.MeshLambertMaterial({ color: 0x1a1c20 })), new THREE.Mesh(B(.36, .06, .2, 0, .32, 0), new THREE.MeshLambertMaterial({ color: 0xd62f2f, emissive: 0xd62f2f, emissiveIntensity: .6 })));
  const bombLight = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); bombLight.position.set(.16, .38, 0); bomb.add(bombLight);
  const bombBeam = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 9, 6, 1, true), glow(0xff3030, .5)); bombBeam.position.y = 4.5; bomb.add(bombBeam); bomb.visible = false; scene.add(bomb);

  // ---------- pooled effects ----------
  const PN = 520, pPos = new Float32Array(PN * 3).fill(-999), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN); let pNext = 0;
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .09, map: canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); points.frustumCulled = false; scene.add(points);
  function burst(x, y, z, color, n, speed = 4, up = 2) { _c.set(color); for (let i = 0; i < n; i++) { const k = pNext = (pNext + 1) % PN, a = Math.random() * 6.283, e = Math.random() * 2 - 1, s = speed * (.3 + Math.random() * .7); pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z; pVel[k * 3] = Math.cos(a) * s * Math.sqrt(1 - e * e * .5); pVel[k * 3 + 1] = e * s * .6 + up; pVel[k * 3 + 2] = Math.sin(a) * s * Math.sqrt(1 - e * e * .5); pCol[k * 3] = _c.r; pCol[k * 3 + 1] = _c.g; pCol[k * 3 + 2] = _c.b; pLife[k] = .35 + Math.random() * .4; } }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const beams = Array.from({ length: 28 }, () => { const m = new THREE.Mesh(unit, glow(0xffffff, 1)); m.visible = false; m.frustumCulled = false; scene.add(m); return { m, life: 0, max: 1 }; }); let bNext = 0;
  function beam(x0, y0, z0, x1, y1, z1, color, width, life) { const b = beams[bNext = (bNext + 1) % beams.length], len = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || .01; b.m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.m.lookAt(x1, y1, z1); b.m.scale.set(width, width, len); b.m.material.color.set(color); b.m.material.opacity = 1; b.m.visible = true; b.life = b.max = life; return b; }
  const ringGeo = new THREE.RingGeometry(.92, 1, 56);
  const rings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(ringGeo, glow(0xffffff, 1)); m.rotation.x = -H; m.visible = false; scene.add(m); return { m, life: 0, max: 1, r: 1 }; }); let rNext = 0;
  function ring(x, z, r, color, life = .5, y = .08) { const o = rings[rNext = (rNext + 1) % rings.length]; o.m.position.set(x, y, z); o.m.material.color.set(color); o.m.visible = true; o.life = o.max = life; o.r = r; }
  const shotGeo = new THREE.SphereGeometry(.17, 8, 6), shotMat = new THREE.MeshBasicMaterial({ color: 0xd9a8ff }), shotMeshes = [];
  const nadeMesh = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5fd4e8 })); nadeMesh.visible = false; scene.add(nadeMesh);
  const lasers = new Map();
  const lootInst = new Map(), intelGeo = new THREE.OctahedronGeometry(.3), patchGeo = merge([B(.5, .16, .16), B(.16, .5, .16)]), haloGeo = new THREE.RingGeometry(.5, .62, 28);
  function makeLoot(l) { const g = new THREE.Group(), col = l.kind === 'patch' ? 0x5dff8a : 0x6fe6ff, core = new THREE.Mesh(l.kind === 'patch' ? patchGeo : intelGeo, new THREE.MeshBasicMaterial({ color: col })), halo = new THREE.Mesh(haloGeo, glow(col, .7)), beamM = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3, 6, 1, true), glow(col, .28)); halo.rotation.x = -H; halo.position.y = .05; beamM.position.y = 1.5; core.position.y = .75; g.add(core, halo, beamM); g.position.set(l.x, 0, l.z); scene.add(g); return { g, core, halo }; }

  // ---------- viewmodel ----------
  const vm = new THREE.Group(); vmScene.add(vm);
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x2a2e35 }), gunMat2 = new THREE.MeshLambertMaterial({ color: 0x50565f }), gunAcc = new THREE.MeshLambertMaterial({ color: 0x49c7a0, emissive: 0x1c8a66, emissiveIntensity: .8 }), glove = new THREE.MeshLambertMaterial({ color: 0x1d2a26 });
  const loader = new THREE.TextureLoader(); const edrTex = loader.load('assets/brand/products/sangfor-' + PRODUCT_MARKS.EDR[0]); edrTex.colorSpace = THREE.SRGBColorSpace;
  const guns = [0, 1, 2, 3].map(lv => {
    const g = new THREE.Group(), add = (mat, ...a) => g.add(new THREE.Mesh(B(...a), mat));
    if (lv === 0) { add(gunMat, .055, .075, .3, 0, 0, -.06); add(gunMat2, .05, .03, .26, 0, .05, -.07); add(gunMat, .05, .15, .07, 0, -.1, .05, .2); add(gunAcc, .057, .012, .2, 0, .02, -.08); add(glove, .09, .11, .1, 0, -.1, .06, .2); g.userData.tip = -.24; }
    else {
      add(gunMat, .07, .1, .5, 0, 0, -.1); add(gunMat2, .045, .045, .34, 0, .01, -.5); add(gunMat, .06, .16, .08, 0, -.12, .02, .25); add(gunMat2, .055, .2, .1, 0, -.14, -.16, -.12); add(gunMat, .065, .11, .26, 0, -.02, .27); add(gunMat2, .03, .05, .2, 0, .075, -.14);
      add(gunAcc, .074, .014, .44, 0, .028, -.1); add(glove, .095, .11, .1, 0, -.12, .03, .25); add(glove, .09, .09, .14, 0, -.07, -.32);
      if (lv >= 2) { add(gunMat, .05, .06, .16, 0, .12, -.1); add(gunAcc, .04, .04, .012, 0, .12, -.19); add(gunMat, .06, .06, .1, 0, 0, -.7); }
      if (lv >= 3) { add(gunMat2, .05, .06, .22, 0, -.06, -.46); add(gunAcc, .08, .03, .03, 0, -.06, -.58); add(gunAcc, .074, .014, .2, 0, -.03, .27); }
      g.userData.tip = lv >= 2 ? -.78 : -.7;
    }
    g.visible = false; vm.add(g); return g;
  });
  const muzzle = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), glow(0xffd27a, 1)); muzzle.material.map = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, 'rgba(255,220,120,.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(255,240,200,.9)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); g.stroke(); } }); muzzle.visible = false; vm.add(muzzle);
  let vmKick = 0, vmFlash = 0, bobT = 0, stepT = 0, shake = 0, deathT = 0;

  // ---------- input ----------
  const keys = new Set(); let yaw = 0, pitch = 0, fire = false, useHeld = false, assist = false, locked = false; const edge = { reload: false, nade: false, mdr: false, jump: false }; const tmove = { x: 0, y: 0 }; let ads = false, tCrouch = false, fovK = 1, landDip = 0, baseFov = 74;
  const canLock = () => !assist && !navigator.webdriver && canvas.requestPointerLock; // automated browsers stall on a pending lock
  function lock() { if (canLock() && document.pointerLockElement !== canvas) { try { const pr = canvas.requestPointerLock(); pr?.catch?.(() => {}); } catch { /* ignore */ } } }
  function unlock() { if (document.pointerLockElement === canvas) document.exitPointerLock?.(); }
  const live = () => shell === 'play' && S.phase === 'live';
  function look(dx, dy, sens = .0022) { if (!live() || !S.p.alive) return; const k = (assist && onTarget() ? .55 : 1) * fovK; yaw = wrap(yaw - dx * sens * k); pitch = clamp(pitch - dy * sens * k, -1.25, 1.25); }
  const onKey = (e, down) => {
    if (e.target?.tagName === 'INPUT') return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) { if (e.repeat) return; keys.add(k); if (live()) { if (k === 'r') edge.reload = true; else if (k === 'g' || k === 'q') edge.nade = true; else if (k === 'x') edge.mdr = true; else if (k === ' ') edge.jump = true; if (k === ' ' || k.startsWith('Arrow') || k === 'Tab') e.preventDefault(); } } else keys.delete(k);
  };
  const kd = e => onKey(e, true), ku = e => onKey(e, false), blur = () => { keys.clear(); fire = false; ads = false; };
  const mm = e => { if (locked) look(e.movementX, e.movementY); else if (dragging && !assist) look(e.movementX * 1.6, e.movementY * 1.6); };
  let dragging = false;
  const md = e => { if (e.pointerType === 'touch') return; wake(); if (!live()) return; if (e.button === 0) { if (!locked) { lock(); dragging = true; } fire = true; } else if (e.button === 2) ads = true; };
  const mu = e => { if (e.pointerType === 'touch') return; if (e.button === 0) { fire = false; dragging = false; } else if (e.button === 2) ads = false; };
  const plc = () => { const was = locked; locked = document.pointerLockElement === canvas; if (was && !locked) { fire = false; if (live()) ev('unlock'); } };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  document.addEventListener('mousemove', mm); canvas.addEventListener('pointerdown', md); window.addEventListener('pointerup', mu); document.addEventListener('pointerlockchange', plc); canvas.addEventListener('contextmenu', e => e.preventDefault());
  function onTarget() { // is the crosshair on a threat the player can see?
    const p = S.p; for (const th of S.threats) { if (th.spawnT > 0 || !th.see || th.cloak) continue; const want = Math.atan2(-(th.x - p.x), -(th.z - p.z)); if (Math.abs(wrap(want - yaw)) > Math.atan2(th.r * .9, th.dist)) continue; const y = EYE + Math.tan(pitch) * th.dist; if (y > -.1 && y < th.h + .15) return th; } return null;
  }
  function assistTarget() { const p = S.p; let best = null, bd = .16; for (const th of S.threats) { if (th.spawnT > 0 || !th.see || th.cloak) continue; const d = Math.abs(wrap(Math.atan2(-(th.x - p.x), -(th.z - p.z)) - yaw)); if (d < bd) { bd = d; best = th; } } return best; }

  // ---------- radar ----------
  const radar = opts.radar, rg = radar?.getContext('2d'), RPX = 6;
  const mapImg = document.createElement('canvas'); mapImg.width = COLS * CELL * RPX; mapImg.height = ROWS * CELL * RPX;
  { const g = mapImg.getContext('2d'), u = CELL * RPX; g.fillStyle = 'rgba(190,200,210,.22)'; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!SOLID[idx(c, r)]) g.fillRect(c * u, r * u, u, u);
    g.fillStyle = 'rgba(255,60,60,.22)'; g.fillRect(u, u, 21 * u, 3 * u); g.fillStyle = 'rgba(255,192,74,.3)'; g.fillRect(u, 12 * u, 7 * u, 5 * u); g.fillStyle = 'rgba(90,180,255,.3)'; g.fillRect(15 * u, 12 * u, 7 * u, 5 * u);
    g.fillStyle = 'rgba(210,220,230,.5)'; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (RACK[idx(c, r)]) g.fillRect(c * u + 2, r * u + 2, u - 4, u - 4);
    g.fillStyle = 'rgba(233,161,59,.42)'; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (CRATE[idx(c, r)]) g.fillRect(c * u + 3, r * u + 3, u - 6, u - 6);
    g.font = `900 ${u * 2.2}px "Bahnschrift","Arial Narrow",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffc04a'; g.fillText('A', (SITES.A.c + .5) * u, (SITES.A.r + .6) * u); g.fillStyle = '#5ab4ff'; g.fillText('B', (SITES.B.c + .5) * u, (SITES.B.r + .6) * u); }
  function drawRadar(t) {
    if (!rg) return; const W = radar.width, R = W / 2, sc = W / 54, p = S.p; rg.clearRect(0, 0, W, W); rg.save(); rg.beginPath(); rg.arc(R, R, R - 2, 0, 6.283); rg.clip(); rg.fillStyle = 'rgba(10,13,18,.62)'; rg.fillRect(0, 0, W, W);
    rg.translate(R, R); rg.rotate(yaw); rg.scale(sc, sc); rg.translate(-p.x, -p.z);
    rg.drawImage(mapImg, -23, -23, 46, 46);
    const walls = S.phase === 'live' ? S.walls.filter(w => !w.down).map(w => w.gate) : []; rg.fillStyle = '#ff8a3c'; for (const i of walls) rg.fillRect(GATES[i].x - 1, GATES[i].z - .35, 2, .7);
    const b = S.bomb, blink = Math.sin(t * 9) > 0;
    for (const th of S.threats) { if (th.spawnT > 0) continue; const known = S.lv.NDR > 0 || (th.see && !th.cloak); if (!known) continue; const car = b.state === 'carried' && b.carrier === th.id; rg.fillStyle = car ? (blink ? '#fff' : '#ff3030') : th.type === 'brute' ? '#ff4055' : '#ff5a5a'; rg.beginPath(); rg.arc(th.x, th.z, car || th.type === 'brute' ? 1.05 : .72, 0, 6.283); rg.fill(); }
    for (const l of S.loot || []) { rg.fillStyle = l.kind === 'patch' ? '#5dff8a' : '#6fe6ff'; rg.fillRect(l.x - .5, l.z - .5, 1, 1); }
    if (b.state === 'planted' || b.state === 'dropped') { rg.fillStyle = blink ? '#ff3030' : '#ffd0d0'; rg.fillRect(b.x - .9, b.z - .9, 1.8, 1.8); }
    rg.restore(); rg.save(); rg.translate(R, R); rg.fillStyle = 'rgba(255,255,255,.1)'; rg.beginPath(); rg.moveTo(0, 0); rg.arc(0, 0, R, -H - .6, -H + .6); rg.fill();
    rg.fillStyle = '#fff'; rg.beginPath(); rg.moveTo(0, -W * .045); rg.lineTo(W * .03, W * .03); rg.lineTo(0, W * .015); rg.lineTo(-W * .03, W * .03); rg.closePath(); rg.fill(); rg.restore();
    rg.strokeStyle = 'rgba(255,255,255,.28)'; rg.lineWidth = 2; rg.beginPath(); rg.arc(R, R, R - 2, 0, 6.283); rg.stroke();
  }

  // ---------- per-frame view ----------
  let time = 0, fpBlend = 0, beepT = 0, lastRound = 0; const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion(), ovPos = new THREE.Vector3(), ovQ = new THREE.Quaternion(), look3 = new THREE.PerspectiveCamera();
  function drainFx() {
    const p = S.p;
    for (const f of S.fx) switch (f.type) {
      case 'shot': { vmKick = 1; vmFlash = .05; camera.getWorldDirection(_v); _v2.crossVectors(_v, camera.up).normalize(); const mx = p.x + _v.x * .9 + _v2.x * .22, my = EYE - .16 + _v.y * .9, mz = p.z + _v.z * .9 + _v2.z * .22; beam(mx, my, mz, f.x, f.y, f.z, 0xffe9a8, .03, .07); burst(f.x, f.y, f.z, f.hit ? 0xff5a4a : 0xffd9a0, f.hit ? 7 : 4, 2.5, 1); if (f.hit) { ev('hit', f.head); (f.head ? snd.head : snd.hit)(); } break; }
      case 'kill': ev('kill', { reward: f.reward, hs: f.hs, by: f.by }); burst(f.x, f.h * .6, f.z, THREAT[f.kind].color, 26, 5, 2.5); ring(f.x, f.z, 1.6, THREAT[f.kind].color, .35); break;
      case 'hurt': { const a = wrap(Math.atan2(-(f.x - p.x), -(f.z - p.z)) - yaw); ev('hurt', { angle: a, d: f.d }); shake = Math.min(1, shake + .5); break; }
      case 'melee': { const o = inst.get(f.id); if (o) o.lunge = 1; break; }
      case 'eshot': burst(f.x, 1.3, f.z, 0xd9a8ff, 5, 2, 1); break;
      case 'snipe': beam(f.x, 1.5, f.z, p.x, f.hit ? EYE - .2 : .2, p.z, 0x9ff3ff, .09, .22); snd.shot(2); break;
      case 'chain': beam(f.x0, 1, f.z0, f.x1, f.h, f.z1, COLOR.XDR, .09, .22); burst(f.x1, f.h, f.z1, COLOR.XDR, 8, 3); snd.chain(); break;
      case 'burst': ring(f.x, f.z, 4, COLOR.EDR, .4); break;
      case 'stun': ring(f.x, f.z, f.r, COLOR.IAG, .7); ring(f.x, f.z, f.r * .6, 0xffffff, .5); burst(f.x, .6, f.z, COLOR.IAG, 40, 7, 3); snd.stun(); break;
      case 'mdr': ring(p.x, p.z, 40, COLOR.MDR, 1); ring(p.x, p.z, 24, 0xffffff, .8); ev('flash', COLOR.MDR); snd.mdr(); break;
      case 'detonate': ring(f.x, f.z, 30, 0xff3030, 1.2); burst(f.x, 1, f.z, 0xff3030, 80, 12, 5); ev('flash', '#ff3030'); snd.boom(); shake = 1; break;
      case 'wallBreak': { const g = GATES[f.gate]; burst(g.x, 2, g.z, COLOR.AF, 60, 7, 3); snd.wall(); break; }
      case 'block': burst(f.x, 1.3, f.z, COLOR.AF, 6, 2, 1); break;
      case 'zap': burst(f.x, f.h * .7, f.z, 0xffd27a, 8, 3); break;
      case 'vent': burst(f.x, .3, f.z, 0x9be04a, 22, 4, 4); ring(f.x, f.z, 2, 0x9be04a, .5); break;
      case 'drop': ring(f.x, f.z, 2.4, 0xff3030, .6); break;
      case 'failover': ev('flash', COLOR.HCI); ring(p.x, p.z, 5, COLOR.HCI, .6); break;
      case 'round': lastRound = f.n; ev('round', f); break;
      case 'jump': snd.jump(); break;
      case 'land': landDip = Math.min(1, f.v / 9); snd.land(); break;
      case 'loot': burst(f.x, .8, f.z, f.kind === 'patch' ? 0x5dff8a : 0x6fe6ff, 18, 3, 3); snd.pickup(); ev('loot', f); break;
      case 'streak': snd.streak(f.n); ev('streak', f); break;
      case 'contract': snd.win(); ev('contract', f); break;
      case 'cover': burst(f.x, .9, f.z, 0xe9a13b, 6, 2, 1); break;
      case 'dmg': { const q = project(f.x, f.y, f.z); if (!q.behind && Math.abs(q.x) < 1 && Math.abs(q.y) < 1) ev('num', { x: q.x * .5 + .5, y: .5 - q.y * .5, d: f.d, hs: f.hs, by: f.by }); break; }
      case 'roundEnd': (f.win ? snd.win : snd.lose)(); fire = false; break;
    }
    S.fx.length = 0;
  }
  function project(x, y, z) { _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); const cxs = _v.x, czs = _v.z, behind = _v.z > -.1; _v.applyMatrix4(camera.projectionMatrix); return { x: _v.x, y: _v.y, behind, bearing: Math.atan2(cxs, -czs) }; }
  function marker(list, kind, x, y, z) { // screen-space pointer to an objective; clamps to an ellipse when it is off screen
    const p = S.p, q = project(x, y, z), off = q.behind || Math.abs(q.x) > .86 || Math.abs(q.y) > .8;
    list.push({ kind, off, dist: Math.hypot(x - p.x, z - p.z), rot: q.bearing, x: off ? .5 + Math.sin(q.bearing) * .4 : q.x * .5 + .5, y: off ? .5 - Math.cos(q.bearing) * .36 : .5 - q.y * .5 });
  }
  function syncThreats(dt) {
    const seen = new Set(), p = S.p;
    for (const th of S.threats) {
      seen.add(th.id); let o = inst.get(th.id); if (!o) { o = makeThreat(th); inst.set(th.id, o); }
      const sIn = th.spawnT > 0 ? clamp(1 - th.spawnT / .6, .05, 1) : 1; o.root.position.set(th.x, 0, th.z); o.root.rotation.y += wrap(th.yaw - o.root.rotation.y) * Math.min(1, dt * 10); o.x = th.x; o.z = th.z; o.h = th.h;
      const sp = Math.hypot(th.vx, th.vz), sw = Math.sin(th.anim * (th.type === 'worm' ? 11 : 7.5)) * Math.min(1, sp / 2) * .65; o.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -sw : sw); });
      o.lunge = Math.max(0, o.lunge - dt * 4); o.vis.position.set(0, th.type === 'worm' ? 0 : Math.abs(sw) * .05, -o.lunge * .35); o.vis.rotation.x = -o.lunge * .35; if (th.type === 'worm') o.vis.rotation.y = Math.sin(th.anim * 9) * .18;
      o.root.scale.setScalar(sIn); const cloak = th.cloak; o.vis.visible = !cloak; o.cloak.visible = cloak; o.tag.visible = !cloak && th.dist < 22 && th.dist > 3.2 && th.spawnT <= 0; o.flash.visible = th.flash > 0 && !cloak; o.xray.visible = S.lv.NDR >= 2; o.stun.visible = o.denied.visible = th.stun > 0;
      // sniper telegraph: a laser the player can see even when the APT itself is cloaked
      if (th.aim > 0) { let l = lasers.get(th.id); if (!l) { l = new THREE.Mesh(unit, glow(0xff4040, .6)); l.frustumCulled = false; scene.add(l); lasers.set(th.id, l); } const y0 = 1.5, y1 = EYE - .25, len = Math.hypot(p.x - th.x, y1 - y0, p.z - th.z); l.position.set((th.x + p.x) / 2, (y0 + y1) / 2, (th.z + p.z) / 2); l.lookAt(p.x, y1, p.z); const w = .015 + th.aim * .035; l.scale.set(w, w, len); l.material.opacity = .25 + th.aim * .6; l.visible = true; }
      else if (lasers.has(th.id)) lasers.get(th.id).visible = false;
    }
    for (const [id, o] of inst) if (!seen.has(id)) { inst.delete(id); if (lasers.has(id)) { scene.remove(lasers.get(id)); lasers.delete(id); } o.t = .32; o.tag.visible = o.denied.visible = o.xray.visible = o.stun.visible = o.cloak.visible = false; o.vis.visible = true; o.flash.visible = true; dying.push(o); }
    for (let i = dying.length - 1; i >= 0; i--) { const o = dying[i]; o.t -= dt; const k = Math.max(0, o.t / .32); o.root.scale.set(1 + (1 - k) * .3, k, 1 + (1 - k) * .3); o.flash.visible = k > .6; if (o.t <= 0) { scene.remove(o.root); dying.splice(i, 1); } }
  }
  function clearThreats() { for (const [, o] of inst) scene.remove(o.root); inst.clear(); for (const o of dying) scene.remove(o.root); dying.length = 0; for (const [, l] of lasers) scene.remove(l); lasers.clear(); }
  function sync(dt) {
    time += dt; const p = S.p, phase = S.phase, inRound = shell !== 'menu' && (phase === 'live' || phase === 'end');
    if (shell === 'play') drainFx(); if (!S.threats.length && inst.size && phase === 'buy') clearThreats();
    if (shell !== 'menu' && S.threats) syncThreats(dt);
    // firewalls
    fwTex.offset.y = time * .25;
    fw.forEach((f, i) => { const w = phase === 'live' || phase === 'end' ? S.walls?.find(o => o.gate === i && !o.down) : null, pre = shell !== 'menu' && phase === 'buy' && S.gateSel[i] && S.lv.AF > 0; f.m.visible = !!w || pre; if (w) { f.mat.opacity = .25 + .45 * (w.hp / w.max) + (w.flash > 0 ? .4 : 0); f.fill.material.opacity = .06 + .1 * (w.hp / w.max) + (w.flash > 0 ? .2 : 0); } else { f.mat.opacity = .5 + Math.sin(time * 4) * .15; f.fill.material.opacity = .12; } });
    // hostile shots, grenade, bomb
    const shots = inRound ? S.shots : []; while (shotMeshes.length < shots.length) { const m = new THREE.Mesh(shotGeo, shotMat); scene.add(m); shotMeshes.push(m); }
    shotMeshes.forEach((m, i) => { const s = shots[i]; m.visible = !!s; if (s) m.position.set(s.x, s.y, s.z); });
    const n = inRound && S.nades[0]; nadeMesh.visible = !!n; if (n) nadeMesh.position.set(n.x, n.y ?? EYE, n.z);
    const b = S.bomb || {}; bomb.visible = inRound && (b.state === 'planted' || b.state === 'dropped' || b.state === 'carried');
    if (bomb.visible) {
      if (b.state === 'carried') { const c = S.threats.find(th => th.id === b.carrier); if (c) { bomb.position.set(c.x + Math.sin(c.yaw) * .4, c.type === 'trojan' ? 1.4 : 1.0, c.z + Math.cos(c.yaw) * .4); bomb.rotation.y = c.yaw; bomb.visible = !c.cloak && c.spawnT <= 0; } else bomb.visible = false; }
      else { bomb.position.set(b.x, 0, b.z); bomb.rotation.y = 0; }
      bombBeam.visible = b.state === 'planted'; const fast = b.state === 'planted' ? clamp(b.t / 22, .12, 1) : 1; bombLight.visible = Math.sin(time * (b.state === 'planted' ? 6 / fast : 5)) > 0;
      if (b.state === 'planted' && phase === 'live') { beepT -= dt; if (beepT <= 0) { beepT = Math.max(.14, fast * .95); snd.beep(b.t < 6); } }
    }
    { const seenL = new Set(); if (inRound) for (const l of S.loot) { seenL.add(l.id); let o = lootInst.get(l.id); if (!o) { o = makeLoot(l); lootInst.set(l.id, o); } o.core.rotation.y = time * 2.4; o.core.position.y = .75 + Math.sin(time * 3 + l.id) * .1; o.halo.scale.setScalar(1 + Math.sin(time * 5) * .12); o.g.visible = l.t > 3 || Math.sin(time * 18) > 0; }
      for (const [id, o] of lootInst) if (!seenL.has(id)) { scene.remove(o.g); lootInst.delete(id); } }
    // particles, beams, rings
    for (let k = 0; k < PN; k++) { if (pLife[k] <= 0) continue; pLife[k] -= dt; if (pLife[k] <= 0) { pPos[k * 3 + 1] = -999; continue; } pVel[k * 3 + 1] -= 9 * dt; pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] = Math.max(.03, pPos[k * 3 + 1] + pVel[k * 3 + 1] * dt); pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    for (const o of beams) if (o.life > 0) { o.life -= dt; o.m.material.opacity = Math.max(0, o.life / o.max); if (o.life <= 0) o.m.visible = false; }
    for (const o of rings) if (o.life > 0) { o.life -= dt; const k = 1 - Math.max(0, o.life / o.max); o.m.scale.setScalar(.3 + o.r * k); o.m.material.opacity = 1 - k; if (o.life <= 0) o.m.visible = false; }
    // cameras: overview for menu / buy, first person for the round
    const wantFp = inRound ? 1 : 0; fpBlend += (wantFp - fpBlend) * Math.min(1, dt * (wantFp ? 3.2 : 5)); if (Math.abs(wantFp - fpBlend) < .002) fpBlend = wantFp;
    if (shell === 'menu' || shell === 'over') { const a = time * .07; ovPos.set(Math.sin(a) * 33, 30, Math.cos(a) * 33 + 2); look3.position.copy(ovPos); look3.lookAt(0, 0, 0); }
    else { ovPos.set(Math.sin(time * .2) * 1.2, 47, 27 + (aspect < 1 ? 16 : 0)); look3.position.copy(ovPos); look3.lookAt(0, 0, -1.5); }
    ovQ.copy(look3.quaternion);
    const moving = phase === 'live' && p.alive && p.ground ? p.moving * (1 - p.crouch * .5) : 0; landDip = Math.max(0, landDip - dt * 5); bobT += dt * moving * 9.5; shake = Math.max(0, shake - dt * 3.5);
    if (moving > .5 && phase === 'live') { stepT -= dt; if (stepT <= 0) { stepT = .36; snd.step(); } }
    if (phase === 'end' && !p.alive) deathT = Math.min(1, deathT + dt * 1.6); else if (p.alive) deathT = 0;
    const eye = (p.eye ?? EYE) - deathT * 1.25 + Math.sin(bobT) * .035 * moving - Math.sin(landDip * Math.PI) * .12;
    camPos.set(p.x + (Math.random() - .5) * shake * .08, eye + (Math.random() - .5) * shake * .08, p.z); _e.set(pitch + vmKick * .012 + deathT * .3, yaw, deathT * .9, 'YXZ'); camQ.setFromEuler(_e);
    camera.position.lerpVectors(ovPos, camPos, fpBlend); camera.quaternion.slerpQuaternions(ovQ, camQ, fpBlend);
    { const lvE = S.lv?.EDR || 0, z = inRound && p.alive ? (p.ads || 0) * (lvE >= 2 ? .44 : lvE ? .3 : .16) : 0, k = 1 - z; if (Math.abs(k - fovK) > .001) { fovK = k; camera.fov = baseFov * k; camera.updateProjectionMatrix(); } }
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    if (opts.onMarkers) { const list = []; if (inRound && fpBlend > .95 && phase === 'live') { const b = S.bomb; if (b.state === 'planted') marker(list, 'bomb', b.x, .6, b.z); else if (b.state === 'dropped') marker(list, 'drop', b.x, .6, b.z); else if (b.state === 'carried') { const c = S.threats.find(th => th.id === b.carrier); if (c && c.spawnT <= 0 && (S.lv.NDR >= 2 || (c.see && !c.cloak))) marker(list, 'carrier', c.x, c.h + .9, c.z); } if (p.hp < 60) for (const l of S.loot) if (l.kind === 'patch') marker(list, 'patch', l.x, 1, l.z); } opts.onMarkers(list); }
    for (const s of signs) if (s.sp) s.sp.material.opacity = 1 - fpBlend * .35;
    scene.fog.near = 34 + (1 - fpBlend) * 60; scene.fog.far = 92 + (1 - fpBlend) * 120;
    const off = (shell === 'menu' && aspect > 1.3) ? .2 : 0; if (off !== viewOff) { viewOff = off; if (off) camera.setViewOffset(vw, vh, -vw * off, 0, vw, vh); else camera.clearViewOffset(); }
    // viewmodel
    const lv = S.lv?.EDR || 0, g = guns[lv]; guns.forEach((o, i) => { o.visible = i === lv; }); vm.visible = fpBlend > .98 && p.alive;
    vmKick = Math.max(0, vmKick - dt * 11); vmFlash -= dt; const reload = lastHud && lastHud.reload >= 0 ? Math.sin(Math.min(1, lastHud.reload) * Math.PI) : 0, defusing = p.useT > 0 ? 1 : 0, narrow = aspect < 1 ? .6 : 1;
    const adsK = p.ads || 0, air = clamp((p.vy || 0) * .004, -.03, .03);
    g.position.set(.17 * narrow * (1 - adsK) + Math.cos(bobT * .5) * .006 * moving, -.15 + adsK * .045 - reload * .14 - defusing * .2 - air - Math.sin(landDip * Math.PI) * .02 + Math.abs(Math.sin(bobT * .5)) * .007 * moving * (1 - adsK * .7), -.5 + adsK * .08 + vmKick * .04); g.scale.setScalar(aspect < 1 ? .4 : .56); g.rotation.set(vmKick * .09 * (1 - adsK * .5) + reload * .7, .04 * (1 - adsK), reload * .5);
    muzzle.visible = vmFlash > 0; if (muzzle.visible) { muzzle.position.set(g.position.x, g.position.y + .008, g.position.z + (g.userData.tip - .06) * (aspect < 1 ? .4 : .56)); muzzle.rotation.z = Math.random() * 6.28; muzzle.scale.setScalar(lv ? 1 : .7); }
    if (inRound) drawRadar(time);
  }
  function inputs() {
    const p = S.p, k = c => (keys.has(c) ? 1 : 0); let mx = k('d') + k('ArrowRight') - k('a') - k('ArrowLeft') + tmove.x, mz = k('w') + k('ArrowUp') - k('s') - k('ArrowDown') - tmove.y, f = fire;
    if (assist && live()) { const t = onTarget(); if (t) f = true; else { const a = assistTarget(); if (a) { const want = Math.atan2(-(a.x - p.x), -(a.z - p.z)); yaw = wrap(yaw + wrap(want - yaw) * .06); } } const tt = t || assistTarget(); if (tt) { const wp = Math.atan2(tt.h * .62 - EYE, tt.dist); pitch += (wp - pitch) * .12; } }
    const inp = { yaw, pitch, mx: clamp(mx, -1, 1), mz: clamp(mz, -1, 1), fire: f, use: useHeld || keys.has('e'), reload: edge.reload, nade: edge.nade, mdr: edge.mdr, jump: edge.jump || keys.has(' '), crouch: tCrouch || keys.has('c') || keys.has('Shift'), ads }; edge.reload = edge.nade = edge.mdr = edge.jump = false; return inp;
  }

  // ---------- loop / shell ----------
  let aspect = 1, raf = 0, last = 0, prevPhase = '', viewOff = 0, vw = 1, vh = 1;
  function resize() {
    const host = canvas.parentNode, w = host.clientWidth || 800, h = host.clientHeight || 600, dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.6 : 2); aspect = w / h; vw = w; vh = h; viewOff = -1;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = vmCam.aspect = aspect; baseFov = aspect >= 1.25 ? 74 : clamp(2 * Math.atan(Math.tan(.6) / aspect) * 57.3, 74, 98); camera.fov = baseFov * fovK; camera.updateProjectionMatrix(); vmCam.fov = aspect < 1 ? 66 : 52; vmCam.updateProjectionMatrix();
  }
  function frame(now) {
    raf = requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    if (shell === 'play') {
      sim.step(dt, inputs());
      if (S.phase !== prevPhase) { if (S.phase === 'live') { yaw = S.p.yaw; pitch = 0; clearThreats(); if (!assist) lock(); } if (S.phase === 'buy') { unlock(); fire = false; ads = false; tCrouch = false; } prevPhase = S.phase; ev('phase', S.phase); }
    }
    sync(shell === 'paused' ? 0 : dt);
    renderer.clear(); renderer.render(scene, camera); if (vm.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
  }
  window.addEventListener('resize', resize); resize(); relabel(); raf = requestAnimationFrame(frame);

  return {
    sim, get state() { return S; }, get phase() { return shell; }, get hud() { return lastHud; },
    start(seed, o) { clearThreats(); sim.reset(seed, o); shell = 'play'; ads = false; tCrouch = false; prevPhase = ''; yaw = pitch = 0; fpBlend = 0; },
    stop() { shell = 'menu'; unlock(); clearThreats(); S.phase = 'idle'; S.threats = []; S.shots = []; S.nades = []; S.walls = []; S.loot = []; S.bomb = { state: 'none' }; },
    pause() { if (shell === 'play') { shell = 'paused'; unlock(); fire = false; keys.clear(); } }, resume() { if (shell === 'paused') { shell = 'play'; last = performance.now(); if (S.phase === 'live' && !assist) lock(); } },
    buy: id => sim.buy(id), toggleGate: i => sim.toggleGate(i), ready: () => sim.ready(), priceOf: id => sim.priceOf(id),
    // touch controls live in the HUD layer and drive these
    touch: { move(x, y) { tmove.x = x; tmove.y = y; }, look: (dx, dy) => look(dx, dy, .0052), fire(b) { fire = b; }, use(b) { useHeld = b; }, crouch(b) { tCrouch = b; }, get crouching() { return tCrouch; }, tap(n) { if (live()) edge[n] = true; }, enable() { assist = true; unlock(); } },
    get assist() { return assist; }, get locked() { return locked; }, lock, relabel, resize,
    aim(y, pt) { yaw = y; pitch = pt; }, diagnostics: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, threats: inst.size }),
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); document.removeEventListener('mousemove', mm); window.removeEventListener('pointerup', mu); document.removeEventListener('pointerlockchange', plc); window.removeEventListener('resize', resize); renderer.dispose(); },
  };
}
