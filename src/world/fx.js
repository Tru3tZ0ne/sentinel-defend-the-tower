// In-world effects: physical product props, spatial clue markers, movement trails,
// containment cages, ransomware locks, and the "revealed intruder" ring. These are how
// detection and response become visible in the building, not just in text.
import * as THREE from 'three';

export const EV_COLOR = { perimeter: 0xff5a6a, endpoint: 0x39e08a, network: 0x39c0ff, exfil: 0xffc24b };

export function createFx(scene, building) {
  const clues = [];        // floating markers
  const trails = [];        // fading movement lines
  const props = new Map();  // productId/instanceKey -> mesh
  const locks = new Map();   // roomId -> overlay
  const cages = new Map();   // deskId -> cage
  let revealRing = null;

  const emissive = (color, intensity = 0.9) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true });

  function roomPos(roomId) { return building.rooms.get(roomId)?.center.clone() || new THREE.Vector3(); }
  function deskPos(deskId) { return building.desks.get(deskId)?.pos.clone() || null; }

  // ---------- product props ----------
  function addProp(productId, target) {
    const key = productId + ':' + (target || '');
    if (props.has(key)) return props.get(key);
    let mesh;
    if (productId === 'AF') {              // scanner arch at the entrance
      mesh = new THREE.Group();
      const a = building.anchors.AF.clone();
      const barMat = emissive(0xff3b5c, 0.6);
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), barMat);
      const right = left.clone(); const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.2), barMat);
      left.position.set(a.x - 1.2, a.y + 1.1, a.z); right.position.set(a.x + 1.2, a.y + 1.1, a.z); top.position.set(a.x, a.y + 2.2, a.z);
      mesh.add(left, right, top);
    } else if (productId === 'IAG') {       // checkpoint gate at egress
      mesh = new THREE.Group(); const a = building.anchors.IAG.clone();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), emissive(0xffc24b, 0.5));
      const p2 = post.clone(); post.position.set(a.x - 0.8, a.y + 0.7, a.z + 0.6); p2.position.set(a.x + 0.8, a.y + 0.7, a.z + 0.6);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), emissive(0xffc24b, 0.7)); beam.position.set(a.x, a.y + 1.1, a.z + 0.6);
      mesh.add(post, p2, beam);
    } else if (productId === 'XDR') {        // command console glow
      const a = building.anchors.XDR.clone();
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), emissive(0x9a7bff, 0.8));
      mesh.position.set(a.x, a.y + 0.9, a.z + 1.2);
    } else if (productId === 'ASTOR') {      // storage shield in server room
      const a = building.anchors.ASTOR.clone();
      mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), emissive(0x39c0ff, 0.5));
      mesh.position.set(a.x, a.y + 1.4, 0.6);
    } else if (productId === 'MDR') {        // off-site SOC beacon
      const a = building.anchors.MDR.clone();
      mesh = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 6), emissive(0x3fc5ff, 0.4));
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), emissive(0x3fc5ff, 0.9));
      base.position.copy(a); top.position.set(a.x, a.y + 0.9, a.z); mesh.add(base, top);
    } else if (productId === 'NDR') {        // sensor nodes along the circulation core
      mesh = new THREE.Group();
      for (const pt of building.anchors.NDR) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), emissive(0x39c0ff, 1.0));
        s.position.copy(pt); mesh.add(s);
      }
    } else if (productId === 'EDR') {        // shield hovering over a protected desk
      const dp = deskPos(target); if (!dp) return null;
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 16), emissive(0x39e08a, 0.9));
      mesh.rotation.x = Math.PI / 2; mesh.position.set(dp.x, dp.y + 0.35, dp.z);
    }
    if (mesh) { scene.add(mesh); props.set(key, mesh); }
    return mesh;
  }

  // ---------- clue markers ----------
  function addClue(clue) {
    const pos = clue.desk && deskPos(clue.desk) ? deskPos(clue.desk) : roomPos(clue.room);
    const color = EV_COLOR[clue.type] || 0xffffff;
    const g = new THREE.Group();
    const pin = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), emissive(color, 1.0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 20), emissive(color, 0.8)); ring.rotation.x = Math.PI / 2;
    g.add(pin, ring);
    g.position.set(pos.x, pos.y + 1.4, pos.z);
    g.userData = { kind: 'clue', clueId: clue.id };
    scene.add(g);
    const marker = { id: clue.id, group: g, pin, ring, color, born: performance.now(), confirmed: clue.confidence === 'confirmed', resolved: false };
    clues.push(marker);
    return marker;
  }
  function setClueConfirmed(id) { const m = clues.find(c => c.id === id); if (m) m.confirmed = true; }
  function resolveClue(id) { const m = clues.find(c => c.id === id); if (m) { m.resolved = true; m.group.visible = false; } }
  function resolveAllClues() { clues.forEach(m => { m.resolved = true; m.group.visible = false; }); }

  // ---------- movement trail ----------
  function addTrail(fromRoom, toRoom) {
    const a = roomPos(fromRoom), b = roomPos(toRoom);
    a.y += 0.4; b.y += 0.4;
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 1.2;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.TubeGeometry(curve, 20, 0.05, 6, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x39c0ff, transparent: true, opacity: 0.9 }));
    scene.add(mesh);
    trails.push({ mesh, born: performance.now() });
  }

  // ---------- containment visuals ----------
  function lockRoom(roomId, locked) {
    if (locked && !locks.has(roomId)) {
      const r = building.rooms.get(roomId);
      const ov = new THREE.Mesh(new THREE.BoxGeometry(r.width - 0.4, 2.4, building.dims.D - 0.6),
        new THREE.MeshBasicMaterial({ color: 0xff3b5c, transparent: true, opacity: 0.16 }));
      ov.position.set(r.center.x, r.center.y + 1.2, 0); scene.add(ov); locks.set(roomId, ov);
    } else if (!locked && locks.has(roomId)) { scene.remove(locks.get(roomId)); locks.delete(roomId); }
  }
  function restrictRoom(roomId) {
    if (cages.has('room:' + roomId)) return;
    const r = building.rooms.get(roomId); if (!r) return;
    const ov = new THREE.Mesh(new THREE.BoxGeometry(r.width - 0.4, 2.4, building.dims.D - 0.6),
      new THREE.MeshBasicMaterial({ color: 0x39c0ff, transparent: true, opacity: 0.14, wireframe: false }));
    ov.position.set(r.center.x, r.center.y + 1.2, 0); scene.add(ov); cages.set('room:' + roomId, ov);
  }
  function cageDesk(deskId) {
    if (cages.has(deskId)) return; const dp = deskPos(deskId); if (!dp) return;
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.0), new THREE.MeshBasicMaterial({ color: 0x39e08a, wireframe: true, transparent: true, opacity: 0.9 }));
    cage.position.set(dp.x, dp.y + 0.1, dp.z); scene.add(cage); cages.set(deskId, cage);
  }

  // ---------- intruder reveal ----------
  function setReveal(personGroup) {
    if (!revealRing) {
      revealRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff3b5c }));
      revealRing.rotation.x = Math.PI / 2; scene.add(revealRing);
    }
    revealRing.userData.follow = personGroup;
    revealRing.visible = true;
  }
  function clearReveal() { if (revealRing) revealRing.visible = false; }

  function update(dt) {
    const now = performance.now();
    for (const m of clues) {
      if (m.resolved) continue;
      const s = 1 + Math.sin(now * 0.006) * 0.18;
      m.pin.scale.setScalar(s); m.group.rotation.y += dt * 0.8;
      m.ring.scale.setScalar(m.confirmed ? 1.25 + Math.sin(now * 0.01) * 0.2 : 1);
      m.ring.material.emissiveIntensity = m.confirmed ? 1.2 : 0.7;
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      const age = (now - trails[i].born) / 1000;
      trails[i].mesh.material.opacity = Math.max(0, 0.9 - age * 0.12);
      if (age > 8) { scene.remove(trails[i].mesh); trails.splice(i, 1); }
    }
    if (revealRing?.visible && revealRing.userData.follow) {
      const g = revealRing.userData.follow;
      revealRing.position.set(g.position.x, g.position.y + 0.05, g.position.z);
      revealRing.rotation.z += dt * 2;
    }
    // animate storage/vault/mdr props gently
    const astor = props.get('ASTOR:'); if (astor) astor.rotation.y += dt * 0.6;
    const vault = building.desks.get('vault#core'); if (vault?.coreMesh) vault.coreMesh.rotation.y += dt * 0.4;
  }

  return { addProp, addClue, setClueConfirmed, resolveClue, resolveAllClues, addTrail, lockRoom, restrictRoom, cageDesk, setReveal, clearReveal, update, clues };
}
