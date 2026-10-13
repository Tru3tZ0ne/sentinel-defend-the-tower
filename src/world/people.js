// People. Prefers a realistic rigged+animated GLB model (set via `charGltf`); falls back to
// a clean procedural figure if the model isn't available. Movement/nav/behaviour are identical
// either way — only the visual + animation differ. The GLB model path is configurable in
// main.js so a licensed business-character pack can be dropped in later.
import * as THREE from 'three';
import { clone as skeletonClone } from '../vendor/three/SkeletonUtils.js';
import { findPath } from './building.js';

// per-person tint (subtle variety over a single base model)
const TINTS = [0xffffff, 0xe9e2d6, 0xd9e0ea, 0xe7dede, 0xdfe7de, 0xeae2ee, 0xe0e6ea];
// fallback procedural palettes
const SKIN = [0xf1c9a5, 0xe6b48c, 0xc68642, 0x9c6b3f, 0xffd9b3, 0x7a4a26];
const HAIR = [0x23201e, 0x4a2f1b, 0x6b4a2a, 0x121212, 0x9a9a9a, 0x3a2b24, 0xb5884f];
const SHIRTS = [0x5b7fb0, 0x5f9a6a, 0xb0645f, 0x7a6ca8, 0x4fa0a0, 0xc9a24b, 0x586a86, 0xcf7aa0, 0xd98f4e];
const PANTS = [0x2f3a56, 0x3a3f4a, 0x4a3b2f, 0x2b3b3b, 0x394150];

export function createPeople(scene, building, publicNodes, charGltf) {
  const nav = building.nav;
  const list = [];

  // ---- precompute GLB template transform ----
  let glb = null;
  if (charGltf && charGltf.scene) {
    // CesiumMan renders ~1.2u native; normalise to ~1.5u. (Skinned auto-bbox is unreliable.)
    glb = { scale: 1.25, yOffset: 0, faceY: Math.PI, animations: charGltf.animations || [] };
  }

  const mat = (c, rough = 0.82) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.0 });
  const box = (w, hh, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); x.castShadow = true; return x; };
  const ball = (r, m, seg = 14) => { const x = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg - 2), m); x.castShadow = true; return x; };

  // ---------- GLB figure ----------
  function makeGLB(seed) {
    const root = new THREE.Group();
    const model = skeletonClone(charGltf.scene);
    model.scale.setScalar(glb.scale);
    model.position.y = glb.yOffset;
    model.rotation.y = glb.faceY;
    const tint = new THREE.Color(TINTS[seed % TINTS.length]);
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); if (o.material.color) o.material.color.multiply(tint); } });
    root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const clip = glb.animations.find(a => /walk/i.test(a.name)) || glb.animations[0];
    const action = clip ? mixer.clipAction(clip) : null; if (action) { action.play(); action.paused = true; }
    return { root, mixer, action, isGLB: true };
  }

  // ---------- procedural fallback figure ----------
  function makeFigure(seed, visitor) {
    const skin = SKIN[seed % SKIN.length], hair = HAIR[(seed * 3 + 1) % HAIR.length];
    const shirt = SHIRTS[(seed * 5 + 2) % SHIRTS.length], pants = PANTS[(seed * 7 + 3) % PANTS.length];
    const skinMat = mat(skin, 0.7), shirtMat = mat(shirt), pantsMat = mat(pants), hairMat = mat(hair, 0.65), shoeMat = mat(0x1b2030, 0.6);
    const root = new THREE.Group(); const HIP = 0.70;
    function leg(sx) {
      const thigh = new THREE.Group(); thigh.position.set(sx, HIP, 0);
      const tm = box(0.17, 0.34, 0.19, pantsMat); tm.position.y = -0.17; thigh.add(tm);
      const calf = new THREE.Group(); calf.position.y = -0.34; thigh.add(calf);
      const cm = box(0.15, 0.32, 0.17, pantsMat); cm.position.y = -0.16; calf.add(cm);
      const shoe = box(0.17, 0.1, 0.28, shoeMat); shoe.position.set(0, -0.33, 0.05); calf.add(shoe);
      return { thigh, calf };
    }
    const legL = leg(-0.11), legR = leg(0.11); root.add(legL.thigh, legR.thigh);
    const upper = new THREE.Group(); upper.position.y = HIP; root.add(upper);
    upper.add((() => { const m = box(0.38, 0.16, 0.24, pantsMat); m.position.y = 0.06; return m; })());
    const torso = box(0.40, 0.44, 0.24, shirtMat); torso.position.y = 0.36; upper.add(torso);
    function arm(sx) {
      const sh = new THREE.Group(); sh.position.set(sx, 0.56, 0);
      const ua = box(0.12, 0.26, 0.14, shirtMat); ua.position.y = -0.13; sh.add(ua);
      const el = new THREE.Group(); el.position.y = -0.26; sh.add(el);
      const fa = box(0.11, 0.24, 0.12, skinMat); fa.position.y = -0.12; el.add(fa);
      const hand = box(0.12, 0.1, 0.13, skinMat); hand.position.y = -0.26; el.add(hand);
      return { shoulder: sh, elbow: el };
    }
    const armL = arm(-0.26), armR = arm(0.26); upper.add(armL.shoulder, armR.shoulder);
    const neck = box(0.1, 0.08, 0.1, skinMat); neck.position.y = 0.62; upper.add(neck);
    const headPivot = new THREE.Group(); headPivot.position.y = 0.70; upper.add(headPivot);
    const head = ball(0.155, skinMat, 14); head.scale.set(1, 1.08, 0.98); head.position.y = 0.12; headPivot.add(head);
    const hairMesh = ball(0.168, hairMat, 14); hairMesh.scale.set(1, (seed % 3 === 2) ? 0.55 : 0.9, 1); hairMesh.position.y = (seed % 3 === 2) ? 0.17 : 0.15; headPivot.add(hairMesh);
    if (visitor) { const card = box(0.12, 0.16, 0.02, mat(0xeef2fb, 0.5)); card.position.set(0, 0.14, 0.14); upper.add(card); }
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return { root, legL, legR, armL, armR, upper, headPivot, torso, isGLB: false };
  }

  function deskNodesIn(roomId) { const out = []; for (const d of building.desks.values()) if (d.roomId === roomId && nav.nodes.has('desk:' + d.id)) out.push('desk:' + d.id); return out; }

  function add({ id, startNode, role, visitor, home }) {
    const seed = list.length + (role === 'intruder' ? 4 : 0);
    const fig = glb ? makeGLB(seed) : makeFigure(seed, visitor);
    const start = nav.nodes.get(startNode) || nav.nodes.get('room:' + home) || [...nav.nodes.values()][0];
    fig.root.position.copy(start.pos);
    fig.root.userData = { kind: 'person', personId: id };
    scene.add(fig.root);
    const homeDesks = home ? deskNodesIn(home) : [];
    const p = { id, role, fig, group: fig.root, pos: fig.root.position, currentNode: startNode,
      path: null, wpIndex: 0, targetNode: null, speed: 1.35 + Math.random() * 0.25,
      wander: role === 'employee', home, homeDesks, allowed: publicNodes,
      halted: false, phase: Math.random() * 6.28, seed, pose: 'idle', facing: fig.root.rotation.y, atDesk: null,
      wait: 0.5 + Math.random() * 2 };
    list.push(p);
    return p;
  }

  function roomOfDeskNode(n) { return n.startsWith('desk:') ? n.slice(5).split('#')[0] : null; }
  function setRoute(p, toNode) {
    let target = toNode;
    if (!nav.nodes.has(target)) { const room = roomOfDeskNode(target); target = room && nav.nodes.has('room:' + room) ? 'room:' + room : null; }
    if (!target) { p.path = null; return false; }
    const path = findPath(nav, p.currentNode, target);
    if (!path || path.length < 2) { p.path = null; return false; }
    p.path = path; p.wpIndex = 1; p.targetNode = target; p.atDesk = null; return true;
  }
  function decide(p) {
    const atDeskNow = p.currentNode.startsWith('desk:');
    if (atDeskNow || Math.random() > 0.62) { const dest = p.allowed[(Math.random() * p.allowed.length) | 0]; if (dest && dest !== p.currentNode) { setRoute(p, dest); p.wait = 3 + Math.random() * 4; return; } }
    if (p.homeDesks.length) { setRoute(p, p.homeDesks[(Math.random() * p.homeDesks.length) | 0]); p.wait = 9 + Math.random() * 10; return; }
    const dest = p.allowed[(Math.random() * p.allowed.length) | 0]; if (dest && dest !== p.currentNode) setRoute(p, dest); p.wait = 4 + Math.random() * 4;
  }
  function faceDesk(p) { const d = building.desks.get(p.atDesk); if (!d) { p.facing = Math.PI; return; } const dx = d.pos.x - p.pos.x, dz = (d.pos.z ?? 1.3) - p.pos.z; if (Math.abs(dx) + Math.abs(dz) > 0.02) p.facing = Math.atan2(dx, dz); }
  const lerp = (a, b, t) => a + (b - a) * t;

  function update(dt) {
    const tnow = performance.now() / 1000;
    for (const p of list) {
      let moving = false;
      if (!p.halted && p.path) {
        const target = p.path[p.wpIndex];
        const dir = target.clone().sub(p.pos); dir.y = 0; const dist = dir.length();
        if (dist < 0.05) {
          p.pos.copy(target); p.wpIndex++;
          if (p.wpIndex >= p.path.length) { p.currentNode = p.targetNode; p.path = null; p.atDesk = p.currentNode.startsWith('desk:') ? p.currentNode.slice(5) : null; if (p.atDesk) faceDesk(p); if (p.wander && p.wait <= 0) p.wait = 2 + Math.random() * 3; }
        } else {
          dir.normalize(); const step = Math.min(dist, p.speed * dt);
          p.pos.addScaledVector(dir, step); p.pos.y += (target.y - p.pos.y) * Math.min(1, dt * 5);
          p.facing = Math.atan2(dir.x, dir.z); p.phase += dt * p.speed * 6.2; moving = true;
        }
      }
      if (!p.halted && !p.path && p.wander) { p.wait -= dt; if (p.wait <= 0) decide(p); }

      const working = !moving && !!p.atDesk && !p.halted;
      p.pose = moving ? 'walk' : working ? 'work' : 'idle';
      let dyaw = p.facing - p.group.rotation.y; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      p.group.rotation.y += dyaw * Math.min(1, dt * 10);

      if (p.fig.isGLB) animateGLB(p, dt, moving);
      else animateProc(p, dt, tnow, moving, working);
    }
  }

  function animateGLB(p, dt, moving) {
    const f = p.fig;
    if (f.action) {
      if (moving) { f.action.paused = false; f.mixer.update(dt * (0.6 + p.speed)); }
      else { f.action.paused = true; f.action.time = 0.0; f.mixer.update(0); }  // settle to a standing frame
    }
    f.root.position.y = p.pos.y;
  }

  function animateProc(p, dt, tnow, moving, working) {
    const f = p.fig, k = Math.min(1, dt * 12);
    const set = (joint, axis, val) => { joint.rotation[axis] = lerp(joint.rotation[axis], val, k); };
    if (moving) {
      const s = Math.sin(p.phase), c = Math.cos(p.phase);
      set(f.legL.thigh, 'x', s * 0.52); set(f.legR.thigh, 'x', -s * 0.52);
      set(f.legL.calf, 'x', Math.max(0, -Math.sin(p.phase + 0.5)) * 0.9); set(f.legR.calf, 'x', Math.max(0, -Math.sin(p.phase + Math.PI + 0.5)) * 0.9);
      set(f.armL.shoulder, 'x', -s * 0.42); set(f.armR.shoulder, 'x', s * 0.42); set(f.armL.elbow, 'x', 0.2); set(f.armR.elbow, 'x', 0.2);
      set(f.upper, 'x', 0.06); f.root.position.y = p.pos.y + Math.abs(c) * 0.035; set(f.headPivot, 'y', 0);
    } else if (working) {
      set(f.legL.thigh, 'x', -1.42); set(f.legR.thigh, 'x', -1.42); set(f.legL.calf, 'x', 1.48); set(f.legR.calf, 'x', 1.48);
      const type = Math.sin(tnow * 7 + p.seed) * 0.12;
      set(f.armL.shoulder, 'x', -0.95); set(f.armR.shoulder, 'x', -0.95);
      f.armL.elbow.rotation.x = lerp(f.armL.elbow.rotation.x, 1.1 + type, k); f.armR.elbow.rotation.x = lerp(f.armR.elbow.rotation.x, 1.1 - type, k);
      set(f.upper, 'x', 0.26); f.root.position.y = lerp(f.root.position.y, p.pos.y - 0.30, k); set(f.headPivot, 'y', Math.sin(tnow * 0.6 + p.seed) * 0.1);
    } else {
      set(f.legL.thigh, 'x', 0); set(f.legR.thigh, 'x', 0); set(f.legL.calf, 'x', 0); set(f.legR.calf, 'x', 0);
      const breathe = Math.sin(tnow * 1.6 + p.seed) * 0.05;
      set(f.armL.shoulder, 'x', breathe); set(f.armR.shoulder, 'x', -breathe); set(f.armL.elbow, 'x', 0.12); set(f.armR.elbow, 'x', 0.12);
      set(f.upper, 'x', 0); f.root.position.y = lerp(f.root.position.y, p.pos.y, k); f.torso.scale.y = 1 + breathe * 0.4; set(f.headPivot, 'y', Math.sin(tnow * 0.4 + p.seed * 2) * 0.35);
    }
  }

  return { list, add, setRoute, update, get: id => list.find(p => p.id === id) };
}
