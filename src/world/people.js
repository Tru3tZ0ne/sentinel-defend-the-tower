// People: articulated low-poly figures that walk the nav graph, sit and work at desks,
// and idle with small life. Employees run their own daily routine (desk ⇄ common areas);
// the intruder is driven by the engine and is visually indistinguishable from staff.
import * as THREE from 'three';
import { findPath } from './building.js';

// Varied, workplace-plausible palettes. Appearance is deterministic per index so it is
// stable across a session but gives a believable mix of people. The intruder draws from
// the same pools — identity must come from evidence, never from looks.
const SKIN  = [0xf1c9a5, 0xe6b48c, 0xc68642, 0x9c6b3f, 0xffd9b3, 0x7a4a26];
const HAIR  = [0x23201e, 0x4a2f1b, 0x6b4a2a, 0x121212, 0x9a9a9a, 0x3a2b24, 0xb5884f];
const SHIRTS = [0x5b7fb0, 0x5f9a6a, 0xb0645f, 0x7a6ca8, 0x4fa0a0, 0xc9a24b, 0x586a86, 0xcf7aa0, 0xd98f4e];
const PANTS = [0x2f3a56, 0x3a3f4a, 0x4a3b2f, 0x2b3b3b, 0x394150];
const SHOE  = 0x1b2030;

export function createPeople(scene, building, publicNodes) {
  const nav = building.nav;
  const list = [];
  const shadowGeo = new THREE.CircleGeometry(0.32, 18).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false });

  const mat = (c, rough = 0.82) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: rough, metalness: 0.0 });
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // Build one articulated figure. Returns the root group plus named joints for animation.
  function makeFigure(seed, visitor) {
    const skin  = SKIN[seed % SKIN.length];
    const hair  = HAIR[(seed * 3 + 1) % HAIR.length];
    const shirt = SHIRTS[(seed * 5 + 2) % SHIRTS.length];
    const pants = PANTS[(seed * 7 + 3) % PANTS.length];
    const skinMat = mat(skin, 0.7), shirtMat = mat(shirt), pantsMat = mat(pants), hairMat = mat(hair, 0.65), shoeMat = mat(SHOE, 0.6);

    const root = new THREE.Group();
    const HIP = 0.70;

    // ---- legs with knees ----
    function makeLeg(sx) {
      const thigh = new THREE.Group(); thigh.position.set(sx, HIP, 0);
      const thighMesh = box(0.17, 0.34, 0.19, pantsMat); thighMesh.position.y = -0.17; thigh.add(thighMesh);
      const calf = new THREE.Group(); calf.position.y = -0.34; thigh.add(calf);
      const calfMesh = box(0.15, 0.32, 0.17, pantsMat); calfMesh.position.y = -0.16; calf.add(calfMesh);
      const shoe = box(0.17, 0.1, 0.28, shoeMat); shoe.position.set(0, -0.33, 0.05); calf.add(shoe);
      return { thigh, calf };
    }
    const legL = makeLeg(-0.11), legR = makeLeg(0.11);
    root.add(legL.thigh, legR.thigh);

    // ---- upper body (leans as one unit when working) ----
    const upper = new THREE.Group(); upper.position.y = HIP; root.add(upper);
    const pelvis = box(0.38, 0.16, 0.24, pantsMat); pelvis.position.y = 0.06; upper.add(pelvis);
    const torso = box(0.40, 0.44, 0.24, shirtMat); torso.position.y = 0.36; upper.add(torso);

    function makeArm(sx) {
      const shoulder = new THREE.Group(); shoulder.position.set(sx, 0.56, 0);
      const upperArm = box(0.12, 0.26, 0.14, shirtMat); upperArm.position.y = -0.13; shoulder.add(upperArm);
      const elbow = new THREE.Group(); elbow.position.y = -0.26; shoulder.add(elbow);
      const foreArm = box(0.11, 0.24, 0.12, skinMat); foreArm.position.y = -0.12; elbow.add(foreArm);
      const hand = box(0.12, 0.1, 0.13, skinMat); hand.position.y = -0.26; elbow.add(hand);
      return { shoulder, elbow };
    }
    const armL = makeArm(-0.26), armR = makeArm(0.26);
    upper.add(armL.shoulder, armR.shoulder);

    // ---- head + hair ----
    const neck = box(0.1, 0.08, 0.1, skinMat); neck.position.y = 0.62; upper.add(neck);
    const headPivot = new THREE.Group(); headPivot.position.y = 0.70; upper.add(headPivot);
    const head = box(0.24, 0.26, 0.23, skinMat); head.position.y = 0.11; headPivot.add(head);
    const hairStyle = seed % 3;
    const hairTop = box(0.27, hairStyle === 2 ? 0.08 : 0.13, 0.26, hairMat);
    hairTop.position.y = hairStyle === 2 ? 0.235 : 0.2; headPivot.add(hairTop);
    if (hairStyle === 0) { const back = box(0.26, 0.2, 0.08, hairMat); back.position.set(0, 0.11, -0.11); headPivot.add(back); }

    // ---- visitor lanyard (worn by several people, not a tell) ----
    if (visitor) {
      const strap = box(0.03, 0.26, 0.02, mat(0x8a93a8, 0.6)); strap.position.set(0, 0.28, 0.13); upper.add(strap);
      const card = box(0.12, 0.16, 0.02, mat(0xeef2fb, 0.5)); card.position.set(0, 0.14, 0.14); upper.add(card);
    }

    const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.position.y = 0.012; root.add(sh);

    return { root, legL, legR, armL, armR, upper, headPivot, torso };
  }

  // Desk nodes available in a given room (for "go to work" routing).
  function deskNodesIn(roomId) {
    const out = [];
    for (const d of building.desks.values()) if (d.roomId === roomId && nav.nodes.has('desk:' + d.id)) out.push('desk:' + d.id);
    return out;
  }

  function add({ id, startNode, role, visitor, home }) {
    const seed = list.length + (role === 'intruder' ? 4 : 0);
    const fig = makeFigure(seed, visitor);
    const start = nav.nodes.get(startNode) || nav.nodes.get('room:' + home) || [...nav.nodes.values()][0];
    fig.root.position.copy(start.pos);
    fig.root.userData = { kind: 'person', personId: id };
    scene.add(fig.root);

    const homeDesks = home ? deskNodesIn(home) : [];
    const p = {
      id, role, fig, group: fig.root, pos: fig.root.position, currentNode: startNode,
      path: null, wpIndex: 0, targetNode: null, speed: 1.35 + Math.random() * 0.25,
      wander: role === 'employee', home, homeDesks, allowed: publicNodes,
      halted: false, phase: Math.random() * 6.28, seed,
      pose: 'idle', facing: fig.root.rotation.y, atDesk: null,
      wait: 0.5 + Math.random() * 2, blink: 0,
    };
    list.push(p);
    return p;
  }

  function roomOfDeskNode(n) { return n.startsWith('desk:') ? n.slice(5).split('#')[0] : null; }

  function setRoute(p, toNode) {
    let target = toNode;
    if (!nav.nodes.has(target)) {
      const room = roomOfDeskNode(target);
      target = room && nav.nodes.has('room:' + room) ? 'room:' + room : null;
    }
    if (!target) { p.path = null; return false; }
    const path = findPath(nav, p.currentNode, target);
    if (!path || path.length < 2) { p.path = null; return false; }
    p.path = path; p.wpIndex = 1; p.targetNode = target; p.atDesk = null;
    return true;
  }

  // Employees decide where to go next: mostly work at a home desk, sometimes circulate.
  function decide(p) {
    const atDeskNow = p.currentNode.startsWith('desk:');
    if (atDeskNow || Math.random() > 0.62) {
      const dest = p.allowed[(Math.random() * p.allowed.length) | 0];
      if (dest && dest !== p.currentNode) { setRoute(p, dest); p.wait = 3 + Math.random() * 4; return; }
    }
    if (p.homeDesks.length) { setRoute(p, p.homeDesks[(Math.random() * p.homeDesks.length) | 0]); p.wait = 9 + Math.random() * 10; return; }
    const dest = p.allowed[(Math.random() * p.allowed.length) | 0];
    if (dest && dest !== p.currentNode) setRoute(p, dest);
    p.wait = 4 + Math.random() * 4;
  }

  // Face a desk when working (desk sits in -Z from the standing node for normal desks).
  function faceDesk(p) {
    const d = building.desks.get(p.atDesk);
    if (!d) { p.facing = Math.PI; return; }
    const dx = d.pos.x - p.pos.x, dz = (d.pos.z ?? 1.3) - p.pos.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.02) p.facing = Math.atan2(dx, dz);
  }

  const lerp = (a, b, t) => a + (b - a) * t;

  function update(dt) {
    const tnow = performance.now() / 1000;
    for (const p of list) {
      // --- locomotion ---
      let moving = false;
      if (!p.halted && p.path) {
        const target = p.path[p.wpIndex];
        const dir = target.clone().sub(p.pos); dir.y = 0;
        const dist = dir.length();
        if (dist < 0.05) {
          p.pos.copy(target);
          p.wpIndex++;
          if (p.wpIndex >= p.path.length) {
            p.currentNode = p.targetNode; p.path = null;
            p.atDesk = p.currentNode.startsWith('desk:') ? p.currentNode.slice(5) : null;
            if (p.atDesk) faceDesk(p);
            if (p.wander && p.wait <= 0) p.wait = 2 + Math.random() * 3;
          }
        } else {
          dir.normalize();
          const step = Math.min(dist, p.speed * dt);
          p.pos.addScaledVector(dir, step);
          p.pos.y += (target.y - p.pos.y) * Math.min(1, dt * 5);
          p.facing = Math.atan2(dir.x, dir.z);
          p.phase += dt * p.speed * 6.2;
          moving = true;
        }
      }
      if (!p.halted && !p.path && p.wander) { p.wait -= dt; if (p.wait <= 0) decide(p); }

      // --- pose selection ---
      const working = !moving && !!p.atDesk && !p.halted;
      p.pose = moving ? 'walk' : working ? 'work' : 'idle';

      // --- smooth facing ---
      let dyaw = p.facing - p.group.rotation.y;
      while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      p.group.rotation.y += dyaw * Math.min(1, dt * 10);

      animate(p, dt, tnow, moving, working);
    }
  }

  // Drive the rig toward the target pose each frame.
  function animate(p, dt, tnow, moving, working) {
    const f = p.fig, k = Math.min(1, dt * 12);
    const set = (joint, axis, val) => { joint.rotation[axis] = lerp(joint.rotation[axis], val, k); };

    if (moving) {
      const s = Math.sin(p.phase), c = Math.cos(p.phase);
      set(f.legL.thigh, 'x', s * 0.52);
      set(f.legR.thigh, 'x', -s * 0.52);
      set(f.legL.calf, 'x', Math.max(0, -Math.sin(p.phase + 0.5)) * 0.9);
      set(f.legR.calf, 'x', Math.max(0, -Math.sin(p.phase + Math.PI + 0.5)) * 0.9);
      set(f.armL.shoulder, 'x', -s * 0.42); set(f.armR.shoulder, 'x', s * 0.42);
      set(f.armL.elbow, 'x', 0.2); set(f.armR.elbow, 'x', 0.2);
      set(f.upper, 'x', 0.06); set(f.upper, 'z', 0);
      f.root.position.y = p.pos.y + Math.abs(c) * 0.035;
      set(f.headPivot, 'y', 0);
    } else if (working) {
      // seated: thighs horizontal, calves down; lean in; type.
      set(f.legL.thigh, 'x', -1.42); set(f.legR.thigh, 'x', -1.42);
      set(f.legL.calf, 'x', 1.48); set(f.legR.calf, 'x', 1.48);
      const type = Math.sin(tnow * 7 + p.seed) * 0.12;
      set(f.armL.shoulder, 'x', -0.95); set(f.armR.shoulder, 'x', -0.95);
      f.armL.elbow.rotation.x = lerp(f.armL.elbow.rotation.x, 1.1 + type, k);
      f.armR.elbow.rotation.x = lerp(f.armR.elbow.rotation.x, 1.1 - type, k);
      set(f.upper, 'x', 0.26); set(f.upper, 'z', 0);
      f.root.position.y = lerp(f.root.position.y, p.pos.y - 0.30, k);
      set(f.headPivot, 'y', Math.sin(tnow * 0.6 + p.seed) * 0.1);
    } else {
      // idle standing: settle limbs, gentle breathing, occasional glance.
      set(f.legL.thigh, 'x', 0); set(f.legR.thigh, 'x', 0);
      set(f.legL.calf, 'x', 0); set(f.legR.calf, 'x', 0);
      const breathe = Math.sin(tnow * 1.6 + p.seed) * 0.05;
      set(f.armL.shoulder, 'x', breathe); set(f.armR.shoulder, 'x', -breathe);
      set(f.armL.elbow, 'x', 0.12); set(f.armR.elbow, 'x', 0.12);
      set(f.upper, 'x', 0); set(f.upper, 'z', 0);
      f.root.position.y = lerp(f.root.position.y, p.pos.y, k);
      f.torso.scale.y = 1 + breathe * 0.4;
      set(f.headPivot, 'y', Math.sin(tnow * 0.4 + p.seed * 2) * 0.35);
    }
  }

  return { list, add, setRoute, update, get: id => list.find(p => p.id === id) };
}
