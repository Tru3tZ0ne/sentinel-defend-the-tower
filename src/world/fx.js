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
  let selRing = null, hoverRing = null;
  const scanFields = new Map();   // roomId -> cyan coverage grid
  const blinds = new Map();       // roomId -> fog-of-war veil (unobserved)
  const scanWaves = [];           // expanding deploy sweeps
  // Effects use world coordinates; separate identity groups hide them with their floor.
  const floorEffects = new Map(building.floors.map(floor => {
    const group = new THREE.Group(); group.name = 'effects:' + floor.id; scene.add(group); return [floor.id, group];
  }));
  function onFloor(object, roomOrLevel) {
    const level = building.rooms.get(roomOrLevel)?.level || roomOrLevel;
    (floorEffects.get(level) || scene).add(object);
  }
  function removeEffect(object) {
    object.removeFromParent();
    object.traverse(o => {
      o.geometry?.dispose();
      for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
        m.map?.dispose(); m.dispose();
      }
    });
  }

  // Fog-of-war veil: an unobserved room is shrouded (dims even emissive glows); lifting it
  // with a scan wave is the "sensor brings this area online" moment.
  function setBlind(roomId, on) {
    if (on) {
      if (!blinds.has(roomId)) {
        const r = building.rooms.get(roomId); if (!r) return;
        const h = (building.dims.WH || 1.4) + 0.7;
        const m = new THREE.Mesh(new THREE.BoxGeometry(r.width - 0.2, h, r.depth - 0.2),
          new THREE.MeshBasicMaterial({ color: 0x060b16, transparent: true, opacity: 0, depthWrite: false }));
        m.position.set(r.center.x, r.center.y + h / 2 - 0.1, r.center.z); m.userData.veil = true; onFloor(m, roomId); blinds.set(roomId, m);
      }
      const m = blinds.get(roomId); m.visible = true; m.userData.target = 0.28; m.material.opacity = 0.28;
    } else if (blinds.has(roomId)) { blinds.get(roomId).userData.target = 0; } // lift smoothly on reveal
  }

  function gridTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.strokeStyle = 'rgba(100,215,255,0.95)'; x.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  // Coverage: a holographic cyan grid resolves over a room your sensors can see.
  function setScan(roomId, on) {
    if (on) {
      if (!scanFields.has(roomId)) {
        const r = building.rooms.get(roomId); if (!r) return;
        const tex = gridTex(); tex.repeat.set((r.width - 1) / 2.2, (r.depth - 1) / 2.2);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(r.width - 0.9, r.depth - 0.9).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.set(r.center.x, r.center.y + 0.04, r.center.z); onFloor(m, roomId); scanFields.set(roomId, m);
      }
      scanFields.get(roomId).visible = true;
    } else if (scanFields.has(roomId)) { scanFields.get(roomId).visible = false; }
  }
  function scanWave(roomId) {
    const r = building.rooms.get(roomId); if (!r) return;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 44), new THREE.MeshBasicMaterial({ color: 0x5ad2ff, transparent: true, opacity: 0.95, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(r.center.x, r.center.y + 0.09, r.center.z); onFloor(ring, roomId);
    scanWaves.push({ ring, born: performance.now(), max: Math.max(r.width, r.depth) * 0.62 });
  }
  function clearScans() { for (const m of scanFields.values()) m.visible = false; for (const m of blinds.values()) { m.visible = false; m.userData.target = 0; m.material.opacity = 0; } }

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
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.12), emissive(0x538693, 0.15));
      mesh.position.set(a.x, a.y + 0.9, a.z + 1.2);
    } else if (productId === 'ASTOR') {      // storage shield in server room
      const a = building.anchors.ASTOR.clone();
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.85), emissive(0x536873, 0.1));
      mesh.position.set(a.x, a.y + 0.55, a.z + 1.4);
    } else if (productId === 'MDR') {        // off-site SOC beacon
      const a = building.anchors.MDR.clone();
      mesh = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 6), emissive(0x3fc5ff, 0.4));
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), emissive(0x3fc5ff, 0.9));
      base.position.copy(a); top.position.set(a.x, a.y + 0.9, a.z); mesh.add(base, top);
    } else if (productId === 'NDR') {        // coverage along the corridor spine + scan rings at each sensor
      mesh = new THREE.Group();
      const z0 = building.dims.bounds.x0 + 0.5, z1 = building.dims.bounds.x1 - 0.5;
      for (const floor of building.floors) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(z1 - z0, 0.9, 3.0),
          new THREE.MeshBasicMaterial({ color: 0x39c0ff, transparent: true, opacity: 0.04, depthWrite: false }));
        beam.position.set((z0 + z1) / 2, floor.y + 0.45, 0); beam.userData.level = floor.id; mesh.add(beam);
      }
      for (const pt of building.anchors.NDR) {
        const level = building.floors.find(f => Math.abs(f.y + 0.5 - pt.y) < 0.01)?.id;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), emissive(0x39c0ff, 0.6)); post.position.set(pt.x, pt.y - 0.05, pt.z); post.userData.level = level; mesh.add(post);
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), emissive(0x39c0ff, 1.0)); s.position.set(pt.x, pt.y + 0.45, pt.z); s.userData.level = level; mesh.add(s);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 26), emissive(0x39c0ff, 0.5));
        ring.rotation.x = Math.PI / 2; ring.position.set(pt.x, pt.y - 0.4, pt.z); ring.userData.scan = true; ring.userData.level = level; mesh.add(ring);
      }
      mesh.userData.ndr = true;
    } else if (productId === 'EDR') {        // protective dome + floor ring over a workstation
      const d = building.desks.get(target); const dp = deskPos(target); if (!dp) return null;
      mesh = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.66, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x39e08a, emissive: 0x39e08a, emissiveIntensity: 0.3, transparent: true, opacity: 0.14, depthWrite: false }));
      dome.position.set(dp.x, dp.y - 0.15, dp.z); mesh.add(dome);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.035, 8, 28), emissive(0x39e08a, 0.9));
      ring.rotation.x = Math.PI / 2; ring.position.set(dp.x, dp.y - 0.62, dp.z); mesh.add(ring);
      if (d?.screen) { d.screen.material.color.setHex(0x4fe6a0); d.screen.material.emissive.setHex(0x3be08a); } // the endpoint now reads as guarded
    }
    if (mesh) {
      const room = productId === 'EDR' ? building.desks.get(target)?.roomId : { AF: 'reception', IAG: 'egress', XDR: 'soc', ASTOR: 'server', MDR: 'soc' }[productId];
      if (room) onFloor(mesh, room); else scene.add(mesh);
      props.set(key, mesh);
      const a = propAnchor(productId, target); if (a) spawnPulse(a.x, a.y, a.z, PROD_COLOR[productId] || 0x5fd0ff);
    }
    return mesh;
  }

  const PROD_COLOR = { AF: 0xff3b5c, IAG: 0xffc24b, XDR: 0x9a7bff, ASTOR: 0x39c0ff, MDR: 0x3fc5ff, NDR: 0x39c0ff, EDR: 0x39e08a };
  function removeProp(product, target) {
    const key = product + ':' + (target || '');
    const prop = props.get(key); if (prop) { removeEffect(prop); props.delete(key); }
    if (product === 'EDR') {
      const screen = building.desks.get(target)?.screen;
      if (screen) { screen.material.color.setHex(0x6fd6ff); screen.material.emissive.setHex(0x6fd6ff); }
    }
  }
  function propAnchor(productId, target) {
    if (productId === 'EDR') { const dp = deskPos(target); return dp ? dp.clone().setY(dp.y - 0.6) : null; }
    const a = building.anchors[productId];
    if (Array.isArray(a)) return a[0]?.clone();
    return a ? a.clone() : null;
  }

  // Expanding "what just changed" pulse ring at a deployment point.
  const pulses = [];
  function spawnPulse(x, y, z, color) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.04, z);
    const floor = building.floors.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b);
    onFloor(ring, floor.id);
    pulses.push({ ring, born: performance.now() });
  }

  // XDR correlation: draw lines from the command console to each active clue when confirmed.
  let corr = null;
  function drawCorrelation(fromPoint, toPoints) {
    clearCorrelation();
    corr = new THREE.Group();
    for (const p of toPoints) {
      const geo = new THREE.BufferGeometry().setFromPoints([fromPoint, p]);
      corr.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xb49cff, transparent: true, opacity: 0.0, depthWrite: false })));
      // a travelling pip along the correlation line reads as "evidence flowing to the console"
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xcdbcff }));
      pip.userData.from = p.clone(); pip.userData.to = fromPoint.clone(); corr.add(pip);
    }
    corr.userData.born = performance.now(); scene.add(corr);
  }
  function clearCorrelation() { if (corr) { removeEffect(corr); corr = null; } }

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
    onFloor(g, clue.room); building.pickables.push(g);
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
    onFloor(mesh, toRoom);
    trails.push({ mesh, born: performance.now() });
  }

  // ---------- containment visuals ----------
  function roomBox(r, color, opacity) {
    const h = (building.dims.WH || 1.4) + 0.5;
    const ov = new THREE.Mesh(new THREE.BoxGeometry(r.width - 0.3, h, (r.depth || 6) - 0.3),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    ov.position.set(r.center.x, r.center.y + h / 2, r.center.z); return ov;
  }
  function lockRoom(roomId, locked) {
    if (locked && !locks.has(roomId)) {
      const r = building.rooms.get(roomId); if (!r) return; const ov = roomBox(r, 0xff3b5c, 0.16); onFloor(ov, roomId); locks.set(roomId, ov);
    } else if (!locked && locks.has(roomId)) { removeEffect(locks.get(roomId)); locks.delete(roomId); }
  }
  function restrictRoom(roomId) {
    if (cages.has('room:' + roomId)) return;
    const r = building.rooms.get(roomId); if (!r) return;
    const ov = roomBox(r, 0x39c0ff, 0.14); onFloor(ov, roomId); cages.set('room:' + roomId, ov);
  }
  function cageDesk(deskId) {
    if (cages.has(deskId)) return; const dp = deskPos(deskId); if (!dp) return;
    const cage = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.0), new THREE.MeshBasicMaterial({ color: 0x39e08a, wireframe: true, transparent: true, opacity: 0.9 }));
    cage.position.set(dp.x, dp.y + 0.1, dp.z); onFloor(cage, building.desks.get(deskId)?.roomId); cages.set(deskId, cage);
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

  // ---------- selection + hover feedback ----------
  function ensureRing(color, rad) {
    const g = new THREE.Group();
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.045, 8, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    r1.rotation.x = Math.PI / 2; g.add(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(rad * 0.7, 0.03, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }));
    r2.rotation.x = Math.PI / 2; g.add(r2);
    scene.add(g); return g;
  }
  function setSelection(point) {
    if (!point) { if (selRing) selRing.visible = false; return; }
    if (!selRing) selRing = ensureRing(0x5fd0ff, 0.7);
    selRing.position.set(point.x, point.y + 0.03, point.z); selRing.visible = true; selRing.userData.born = performance.now();
  }
  function clearSelection() { if (selRing) selRing.visible = false; }
  function setHover(point) {
    if (!point) { if (hoverRing) hoverRing.visible = false; return; }
    if (!hoverRing) { hoverRing = ensureRing(0xffffff, 0.55); hoverRing.children.forEach(m => { m.material.opacity *= 0.5; }); }
    hoverRing.position.set(point.x, point.y + 0.02, point.z); hoverRing.visible = true;
  }

  function update(dt) {
    const now = performance.now();
    for (const floor of building.floors) floorEffects.get(floor.id).visible = floor.group.visible;
    const ndrGroup = props.get('NDR:');
    if (ndrGroup) for (const child of ndrGroup.children) child.visible = building.floors.find(f => f.id === child.userData.level)?.group.visible ?? true;
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
      if (age > 8) { removeEffect(trails[i].mesh); trails.splice(i, 1); }
    }
    if (revealRing?.userData.follow) {
      const g = revealRing.userData.follow;
      revealRing.visible = g.visible;
      revealRing.position.set(g.position.x, g.position.y + 0.05, g.position.z);
      revealRing.rotation.z += dt * 2;
    }
    if (selRing?.visible) { const s = 1 + Math.sin(now * 0.006) * 0.12; selRing.scale.setScalar(s); selRing.rotation.y += dt * 0.6; }
    // per-room light dimming toward target (blind spots fall dark, covered rooms stay lit)
    for (const r of building.rooms.values()) { const l = r.light; if (l && l.userData.target != null) l.intensity += (l.userData.target - l.intensity) * Math.min(1, dt * 3); }
    // coverage grids: scroll + pulse
    for (const m of scanFields.values()) { if (!m.visible) continue; m.material.map.offset.y = (m.material.map.offset.y + dt * 0.08) % 1; m.material.opacity = 0.025 + Math.sin(now * 0.004) * 0.01; }
    // fog-of-war veils: fade toward target, hide when clear
    for (const m of blinds.values()) {
      const tgt = m.userData.target || 0; m.material.opacity += (tgt - m.material.opacity) * Math.min(1, dt * 3);
      if (tgt === 0 && m.material.opacity < 0.02) m.visible = false;
    }
    // deploy scan waves: expand + fade
    for (let i = scanWaves.length - 1; i >= 0; i--) {
      const w = scanWaves[i], age = (now - w.born) / 1000, s = 1 + age * 9;
      w.ring.scale.setScalar(s); w.ring.material.opacity = Math.max(0, 0.95 - age * 1.1);
      if (s > w.max || age > 1) { removeEffect(w.ring); scanWaves.splice(i, 1); }
    }
    // deploy pulses: expand and fade
    for (let i = pulses.length - 1; i >= 0; i--) {
      const age = (now - pulses[i].born) / 1000;
      pulses[i].ring.scale.setScalar(1 + age * 5);
      pulses[i].ring.material.opacity = Math.max(0, 0.9 - age * 1.1);
      if (age > 0.9) { removeEffect(pulses[i].ring); pulses.splice(i, 1); }
    }
    // NDR scan rings: gentle pulse so coverage reads as "watching"
    const ndr = props.get('NDR:');
    if (ndr) ndr.traverse(o => { if (o.userData?.scan) { const s = 1 + Math.sin(now * 0.004 + o.position.y) * 0.18; o.scale.setScalar(s); } });
    // XDR correlation: lines shimmer; pips travel from each clue to the console
    if (corr) {
      const op = Math.min(0.9, (now - corr.userData.born) / 500) * (0.75 + Math.sin(now * 0.006) * 0.25);
      const frac = ((now - corr.userData.born) / 1400) % 1;
      corr.children.forEach(o => {
        if (o.isLine) o.material.opacity = op;
        else if (o.userData.from) o.position.lerpVectors(o.userData.from, o.userData.to, frac);
      });
    }
    // animate storage/vault/mdr props gently
  }

  return { addProp, removeProp, addClue, setClueConfirmed, resolveClue, resolveAllClues, addTrail, lockRoom, restrictRoom, cageDesk, setReveal, clearReveal, setSelection, clearSelection, setHover, drawCorrelation, clearCorrelation, setScan, setBlind, scanWave, clearScans, update, clues };
}
