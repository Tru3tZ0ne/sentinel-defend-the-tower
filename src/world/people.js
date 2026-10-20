// Navigation and behavior are independent of character visuals. Reviewed office
// characters load asynchronously; procedural figures keep the game usable on failure.
import * as THREE from 'three';
import { createCharacterVisual, updateCharacterVisual, disposeCharacterVisual } from './character-visuals.js';
import { findPath } from './building.js';

// fallback procedural palettes
const SKIN = [0xf1c9a5, 0xe6b48c, 0xc68642, 0x9c6b3f, 0xffd9b3, 0x7a4a26];
const HAIR = [0x23201e, 0x4a2f1b, 0x6b4a2a, 0x121212, 0x9a9a9a, 0x3a2b24, 0xb5884f];
const SHIRTS = [0x485569, 0x65716f, 0x6f777c, 0x535c68, 0x466571, 0x77776d, 0x586a78, 0x666c76, 0x4b5663];
const PANTS = [0x2f3a56, 0x3a3f4a, 0x4a3b2f, 0x2b3b3b, 0x394150];

export function createPeople(scene, building, publicNodes, templates = []) {
  const nav = building.nav;
  const list = [];

  let characterTemplates = templates;

  const mat = (c, rough = 0.62) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.02 });
  const box = (w, hh, d, m) => { const x = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); x.castShadow = true; return x; };
  const ball = (r, m, seg = 16) => { const x = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), m); x.castShadow = true; return x; };
  // smooth capsule limb (premium-stylized, not blocky)
  const cap = (r, len, m) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m); x.castShadow = true; return x; };

  // ---------- premium stylized figure (original art: smooth rounded forms) ----------
  function makeFigure(seed, visitor) {
    const skin = SKIN[seed % SKIN.length], hair = HAIR[(seed * 3 + 1) % HAIR.length];
    const shirt = SHIRTS[(seed * 5 + 2) % SHIRTS.length], pants = PANTS[(seed * 7 + 3) % PANTS.length];
    const skinMat = mat(skin, 0.55), shirtMat = mat(shirt, 0.6), pantsMat = mat(pants, 0.62), hairMat = mat(hair, 0.5), shoeMat = mat(0x20262f, 0.45), eyeMat = mat(0x1a1c22, 0.4);
    const root = new THREE.Group(); const HIP = 0.72;
    function leg(sx) {
      const thigh = new THREE.Group(); thigh.position.set(sx, HIP, 0);
      const tm = cap(0.085, 0.18, pantsMat); tm.position.y = -0.16; thigh.add(tm);
      const calf = new THREE.Group(); calf.position.y = -0.34; thigh.add(calf);
      const cm = cap(0.07, 0.17, pantsMat); cm.position.y = -0.15; calf.add(cm);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), shoeMat); shoe.scale.set(1, 0.7, 1.6); shoe.position.set(0, -0.32, 0.05); shoe.castShadow = true; calf.add(shoe);
      return { thigh, calf };
    }
    const legL = leg(-0.1), legR = leg(0.1); root.add(legL.thigh, legR.thigh);
    const upper = new THREE.Group(); upper.position.y = HIP; root.add(upper);
    const hips = cap(0.15, 0.06, pantsMat); hips.rotation.z = Math.PI / 2; hips.position.y = 0.05; upper.add(hips);
    const torso = cap(0.165, 0.26, shirtMat); torso.position.y = 0.34; upper.add(torso);           // smooth rounded torso
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), shirtMat); chest.scale.set(1, 0.7, 0.85); chest.position.y = 0.47; chest.castShadow = true; upper.add(chest);
    function arm(sx) {
      const sh = new THREE.Group(); sh.position.set(sx, 0.56, 0);
      const ua = cap(0.052, 0.18, shirtMat); ua.position.y = -0.12; sh.add(ua);
      const el = new THREE.Group(); el.position.y = -0.25; sh.add(el);
      const fa = cap(0.046, 0.16, skinMat); fa.position.y = -0.11; el.add(fa);
      const hand = ball(0.055, skinMat, 12); hand.position.y = -0.24; el.add(hand);
      return { shoulder: sh, elbow: el };
    }
    const armL = arm(-0.2), armR = arm(0.2); upper.add(armL.shoulder, armR.shoulder);
    const neck = cap(0.05, 0.04, skinMat); neck.position.y = 0.64; upper.add(neck);
    const headPivot = new THREE.Group(); headPivot.position.y = 0.72; upper.add(headPivot);
    const head = ball(0.15, skinMat, 18); head.scale.set(0.95, 1.05, 0.98); head.position.y = 0.11; headPivot.add(head);
    // simple stylized face (reads as a person without being a cube)
    for (const ex of [-0.055, 0.055]) { const eye = ball(0.02, eyeMat, 8); eye.position.set(ex, 0.12, 0.135); headPivot.add(eye); }
    const hs = seed % 3;
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 14, 0, Math.PI * 2, 0, Math.PI * (hs === 2 ? 0.55 : 0.72)), hairMat);
    hairMesh.position.y = 0.11 + (hs === 2 ? 0.02 : 0.0); hairMesh.scale.set(1, 1.05, 1); hairMesh.castShadow = true; headPivot.add(hairMesh);
    if (hs === 0) { const bun = ball(0.06, hairMat, 10); bun.position.set(0, 0.16, -0.1); headPivot.add(bun); }
    if (visitor) { const strap = box(0.02, 0.2, 0.01, mat(0x9aa6bd, 0.5)); strap.position.set(0, 0.42, 0.14); upper.add(strap); const card = box(0.1, 0.13, 0.015, mat(0xeef2fb, 0.4)); card.position.set(0, 0.3, 0.15); upper.add(card); }
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return { root, legL, legR, armL, armR, upper, headPivot, torso, isGLB: false };
  }

  function deskNodesIn(roomId) { const out = []; for (const d of building.desks.values()) if (d.roomId === roomId && nav.nodes.has('desk:' + d.id)) out.push('desk:' + d.id); return out; }

  // A glowing "threat packet" — used in abstract themes (cyber2) where the intruder is a hostile
  // data-packet travelling the architecture rather than a human figure.
  function makeThreatPacket() {
    const root = new THREE.Group();
    const Y = 0.95;
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xff2d6a, emissive: 0xff2d6a, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.2 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), coreMat); core.position.y = Y; core.castShadow = true; root.add(core);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xff5a86, wireframe: true, transparent: true, opacity: 0.6 })); shell.position.y = Y; root.add(shell);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff6a90 })); halo.position.y = Y; halo.rotation.x = Math.PI / 2; root.add(halo);
    // a tall threat beacon so the actor is easy to spot among the dense buildings (a "you are here")
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 6, 12), new THREE.MeshBasicMaterial({ color: 0xff3a6a, transparent: true, opacity: 0.28, depthWrite: false })); beam.position.y = Y + 3.0; root.add(beam);
    const glow = new THREE.PointLight(0xff3a6a, 7, 9, 2); glow.position.y = Y; root.add(glow);
    return { root, isGLB: false, isPacket: true, packet: { core, shell, halo, beam } };
  }

  function add({ id, startNode, role, visitor, home, allowed, avatar }) {
    const seed = list.length + (role === 'intruder' ? 4 : 0);
    const fig = avatar === 'threat' ? makeThreatPacket()
      : characterTemplates.length ? createCharacterVisual(characterTemplates[seed % characterTemplates.length], seed) : makeFigure(seed, visitor);
    const start = nav.nodes.get(startNode) || nav.nodes.get('room:' + home) || [...nav.nodes.values()][0];
    fig.root.position.copy(start.pos);
    fig.root.userData = { kind: 'person', personId: id };
    scene.add(fig.root);
    const homeDesks = home ? deskNodesIn(home) : [];
    const p = { id, role, fig, group: fig.root, pos: fig.root.position.clone(), currentNode: startNode,
      path: null, wpIndex: 0, targetNode: null, speed: 1.35 + Math.random() * 0.25,
      wander: role === 'employee', home, homeDesks, allowed: allowed || publicNodes,
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
    // A new incident beat can redirect someone before their previous route finishes.
    const from = p.path ? [...nav.nodes.values()].reduce((a, b) => a.pos.distanceToSquared(p.pos) < b.pos.distanceToSquared(p.pos) ? a : b).id : p.currentNode;
    const path = findPath(nav, from, target);
    if (!path) { p.path = null; return false; }
    if (path.length === 1 && p.pos.distanceTo(path[0]) < .05) { p.path = null; p.currentNode = target; p.atDesk = target.startsWith('desk:') ? target.slice(5) : null; return false; }
    p.path = path; p.wpIndex = path.length > 1 && from === p.currentNode ? 1 : 0; p.targetNode = target; p.atDesk = null; return true;
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

      // Animation offsets must never feed back into simulation/navigation coordinates.
      p.group.position.copy(p.pos);
      if (p.fig.isGLB) updateCharacterVisual(p.fig, dt, p.pose, p.speed, p.group.visible);
      else if (p.fig.isPacket) animatePacket(p, dt, tnow);
      else animateProc(p, dt, tnow, moving, working);
    }
  }

  // Spin + bob the threat packet so it reads as a live, hostile object gliding through the tower.
  function animatePacket(p, dt, tnow) {
    const pk = p.fig.packet; if (!pk) return;
    pk.core.rotation.y += dt * 2.0; pk.core.rotation.x += dt * 1.3;
    pk.shell.rotation.y -= dt * 1.1; pk.shell.rotation.z += dt * 0.7;
    pk.halo.rotation.z += dt * 1.6;
    p.fig.root.position.y = p.pos.y + Math.sin(tnow * 2.2 + p.phase) * 0.06;
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

  function setTemplates(templates) {
    if (!templates.length) return;
    characterTemplates = templates;
    for (const p of list) {
      if (p.fig.isPacket) continue;   // abstract threat packets keep their own visual
      const previous = p.fig;
      const next = createCharacterVisual(templates[p.seed % templates.length], p.seed);
      // Keep the navigation group and any FX references stable during async loading.
      if (previous.isGLB) disposeCharacterVisual(previous);
      else {
        const geometries = new Set(), materials = new Set();
        previous.root.traverse(o => {
          if (o.geometry) geometries.add(o.geometry);
          if (o.material) materials.add(o.material);
        });
        geometries.forEach(g => g.dispose());
        materials.forEach(m => m.dispose());
      }
      p.group.clear();
      for (const child of [...next.root.children]) p.group.add(child);
      next.root = p.group;
      p.fig = next;
    }
  }
  function dispose() { list.forEach(p => { if (!p.fig.isPacket) disposeCharacterVisual(p.fig); }); }
  return { list, add, setRoute, update, setTemplates, dispose, get: id => list.find(p => p.id === id) };
}
