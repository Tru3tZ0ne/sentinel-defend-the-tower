// People: low-poly figures that walk the nav graph. Employees wander on their own;
// the intruder is driven by the engine and is visually indistinguishable at first.
import * as THREE from 'three';
import { findPath } from './building.js';

const BODY_COLORS = [0x6b8cc7, 0x7d9b6a, 0xc78b6b, 0x8a7bb0, 0x5fa3a0, 0xb0758f, 0x9a9f6b];

export function createPeople(scene, nav, publicNodes) {
  const list = [];
  const shadowGeo = new THREE.CircleGeometry(0.35, 16).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });

  function makeFigure(color, isVisitor) {
    const g = new THREE.Group();
    const skin = 0xe8c6a8;
    const bodyMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), bodyMat);
    body.position.y = 0.55; g.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: skin, flatShading: true }));
    head.position.y = 1.02; g.add(head);
    if (isVisitor) { // subtle visitor lanyard — present on several people so it doesn't give the intruder away
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      badge.position.set(0, 0.62, 0.2); g.add(badge);
    }
    const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.position.y = 0.02; g.add(sh);
    return g;
  }

  function add({ id, startNode, role, visitor }) {
    const color = BODY_COLORS[list.length % BODY_COLORS.length];
    const group = makeFigure(visitor ? 0x8a93a8 : color, visitor);
    const start = nav.nodes.get(startNode);
    group.position.copy(start.pos);
    group.userData = { kind: 'person', personId: id };
    scene.add(group);
    const p = { id, role, group, pos: group.position, currentNode: startNode,
                path: null, wpIndex: 0, speed: 1.9, wait: Math.random() * 2, wander: role === 'employee',
                allowed: publicNodes, halted: false, body: group.children[0] };
    list.push(p);
    return p;
  }

  function setRoute(p, toNode) {
    const path = findPath(nav, p.currentNode, toNode);
    if (!path || path.length < 2) { p.path = null; return false; }
    p.path = path; p.wpIndex = 1; p.targetNode = toNode;
    return true;
  }

  function update(dt) {
    for (const p of list) {
      if (p.halted) continue;
      if (!p.path) {
        p.wait -= dt;
        if (p.wander && p.wait <= 0) {
          const dest = p.allowed[(Math.random() * p.allowed.length) | 0];
          if (dest && dest !== p.currentNode) setRoute(p, dest);
          p.wait = 2 + Math.random() * 4;
        }
        continue;
      }
      const target = p.path[p.wpIndex];
      const dir = target.clone().sub(p.pos); dir.y = 0;
      const dist = dir.length();
      if (dist < 0.06) {
        p.pos.copy(target); p.pos.y = target.y;
        p.wpIndex++;
        if (p.wpIndex >= p.path.length) { p.currentNode = p.targetNode; p.path = null; p.wait = 2 + Math.random() * 3; }
        continue;
      }
      dir.normalize();
      const step = Math.min(dist, p.speed * dt);
      p.pos.addScaledVector(dir, step);
      p.pos.y += (target.y - p.pos.y) * Math.min(1, dt * 4);
      p.group.rotation.y = Math.atan2(dir.x, dir.z);
      // gentle walk bob
      p.body.position.y = 0.55 + Math.sin(performance.now() * 0.012 + p.id.length) * 0.03;
    }
  }

  return { list, add, setRoute, update, get: id => list.find(p => p.id === id) };
}
