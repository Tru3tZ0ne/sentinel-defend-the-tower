// Cyber-fortress building generator — a second VISUAL version of the tower (gameplay unchanged).
// Styled after references/building.jpg: stacked circular glowing drums (one tier per level) on a
// neon platform, with each level's rooms as node-pads ringed around the core, linked by glowing
// circuit traces. It exposes the SAME interface and the SAME room/desk/nav IDs as building.js, so
// the engine, people, fx, overlay and tests all work exactly as before — only the look differs.
import { loc } from '../i18n.js';
import { mergeGeometries } from '../vendor/three/BufferGeometryUtils.js';

// Neon palette keyed to room purpose; everything is emissive so bloom carries the glow.
const ROOM_NEON = {
  command: 0x8a7bff, office: 0x39c0ff, lobby: 0x46e0a0, egress: 0xffb454,
  server: 0x39e0ff, vault: 0xffcf6e, meeting: 0x57d1ff,
};
const BLUE = 0x2b8bff, RIM = 0x38c6ff, TRACE = 0x4fd2ff, CORE = 0x59b7ff;

export function buildBuilding(THREE, LAYOUT) {
  const group = new THREE.Group();
  const WH = 2.6;                         // tier "working height" used by fx for effect columns
  const RING = 7.4;                       // radius of the room-pad ring around each core
  const PAD_R = 1.5;                      // room-pad radius
  const CORE_R = 2.3;                     // central drum radius

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const matCache = new Map();
  const mat = (color, o = {}) => {
    const key = 'm|' + color + '|' + JSON.stringify(o);
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4, ...o }); matCache.set(key, m); }
    return m;
  };
  const emis = (color, i = 1.0, o = {}) => {
    const key = 'e|' + color + '|' + i + '|' + JSON.stringify(o);
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.4, metalness: 0.2, ...o }); matCache.set(key, m); }
    return m;
  };
  const glass = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide });

  const rooms = new Map(), desks = new Map(), pickables = [], anchors = {}, lights = [], signs = [], floors = [];
  const nav = { nodes: new Map(), adj: new Map() };
  const propAnchors = [];
  const node = (id, pos) => { nav.nodes.set(id, { id, pos: pos.clone(), level: posLevel(pos.y) }); nav.adj.set(id, nav.adj.get(id) || []); };
  const link = (a, b) => { if (!nav.adj.has(a)) nav.adj.set(a, []); if (!nav.adj.has(b)) nav.adj.set(b, []); if (!nav.adj.get(a).includes(b)) nav.adj.get(a).push(b); if (!nav.adj.get(b).includes(a)) nav.adj.get(b).push(a); };
  const posLevel = y => LAYOUT.levels.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b).id;

  // ---- small builders ----
  const disk = (r, h, m, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  const ringMesh = (r, tube, m) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 64).rotateX(Math.PI / 2), m);

  // A glowing bilingual label plane that hovers over a pad; redrawn by refreshSigns on lang change.
  function labelSign(room, pos, parent) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    pl.position.copy(pos); pl.userData.billboard = true; parent.add(pl);
    const sign = { room, canvas: c, tex, color: '#' + (ROOM_NEON[room.type] || RIM).toString(16).padStart(6, '0') };
    signs.push(sign); drawSign(sign); return pl;
  }
  function drawSign(sign) {
    const ctx = sign.canvas.getContext('2d'); ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = sign.color; ctx.font = '600 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = sign.color; ctx.shadowBlur = 12;
    ctx.fillText(loc(sign.room.name).slice(0, 18), 128, 32); sign.tex.needsUpdate = true;
  }
  function refreshSigns() { for (const s of signs) drawSign(s); }

  // Desk IDs must match building.js so missions/clues (office#2, l2-finance#1, server#core,
  // vault#core, …) resolve. Office rooms get N numbered desks; the L3 server/vault get their cores.
  function deskSpecsFor(r) {
    if (r.type === 'office' && r.desks) return Array.from({ length: r.desks }, (_, k) => ({ id: `${r.id}#${k + 1}`, kind: 'workstation' }));
    if (r.type === 'server' && r.id === 'server') return [{ id: 'server#core', kind: 'core' }];
    if (r.type === 'vault') return [{ id: `${r.id}#core`, kind: 'core' }];
    return [];
  }

  // A cluster of glowing server-rack monoliths on a pad, tinted to the room's neon.
  function rackCluster(group, neon, n, roomType) {
    const bodyMat = mat(0x10161f, { metalness: 0.6, roughness: 0.45 });
    const bodies = [], lines = [];
    const seedR = (i) => { const v = Math.sin(i * 51.7 + 3.1) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4, r = 0.55 + seedR(i) * 0.3;
      const w = 0.34 + seedR(i + 9) * 0.12, h = 0.7 + seedR(i + 3) * 1.1, d = 0.34;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      bodies.push(new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z));
      // glowing front strips
      for (let s = 0; s < Math.max(2, Math.floor(h / 0.22)); s++) {
        lines.push(new THREE.BoxGeometry(w * 0.72, 0.03, 0.02).translate(x, 0.12 + s * 0.2, z + d / 2 + 0.005));
      }
    }
    if (bodies.length) { const mb = mergeGeometries(bodies, false); const m = new THREE.Mesh(mb, bodyMat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    if (lines.length) { const ml = mergeGeometries(lines, false); group.add(new THREE.Mesh(ml, emis(neon, 1.4))); }
  }

  // ---- anchors for deployed devices (placed near their room on the tier) ----
  const deploySlotMap = new Map();  // id -> Vector3 (filled as rooms are built)
  function deploySlot(id, r) { return deploySlotMap.get(id)?.clone() || (r ? r.center.clone().setY(r.center.y + 0.04) : null); }

  // ---- build each level as a circular tier ----
  const DEVICE_ROOM = { AF: 'reception', IAG: 'egress', NDR: 'soc', ASTOR: 'server', HCI: 'server', ADC: 'soc', XDR: 'soc', MDR: 'soc', AICP: 'soc', SASE: 'egress' };
  for (const level of LAYOUT.levels) {
    const lg = new THREE.Group(); lg.position.y = level.y; group.add(lg);
    floors.push({ id: level.id, y: level.y, group: lg, name: level.name });

    // platform disk + neon rim halo + inner ring
    const plat = disk(RING + 2.0, 0.3, mat(0x060a12, { metalness: 0.5, roughness: 0.6 })); plat.position.y = -0.15; plat.receiveShadow = true; lg.add(plat);
    const rim = ringMesh(RING + 2.0, 0.09, emis(RIM, 2.2)); rim.position.y = 0.02; lg.add(rim);
    const rim2 = ringMesh(CORE_R + 0.6, 0.04, emis(CORE, 1.6)); rim2.position.y = 0.04; lg.add(rim2);

    // central core drum (glowing data cylinder) + cap
    const drum = disk(CORE_R, WH, glass(CORE)); drum.position.y = WH / 2; lg.add(drum);
    const cap = disk(CORE_R + 0.18, 0.16, mat(0x0a1018, { metalness: 0.7, roughness: 0.3 })); cap.position.y = WH + 0.08; lg.add(cap);
    const capGlow = ringMesh(CORE_R, 0.05, emis(CORE, 1.8)); capGlow.position.y = WH + 0.16; lg.add(capGlow);
    // inner data columns inside the drum
    const colGeos = [];
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = CORE_R * (0.4 + 0.5 * ((Math.sin(i * 7.1) + 1) / 2)); colGeos.push(new THREE.BoxGeometry(0.06, WH * (0.4 + 0.5 * ((Math.sin(i * 3.3) + 1) / 2)), 0.06).translate(Math.cos(a) * r, WH / 2, Math.sin(a) * r)); }
    lg.add(new THREE.Mesh(mergeGeometries(colGeos, false), emis(CORE, 1.1)));
    const hubPos = V(0, level.y + 0.12, 0);
    node(`hub:${level.id}`, hubPos);

    // rooms of this level -> pads around the ring
    const levelRooms = LAYOUT.rooms.filter(r => r.level === level.id);
    const base = (level.id === 'L3') ? -Math.PI / 2 : (level.id === 'L2' ? -Math.PI / 2 + 0.22 : -Math.PI / 2 - 0.22);
    levelRooms.forEach((r, i) => {
      const a = base + (i / levelRooms.length) * Math.PI * 2;
      const px = Math.cos(a) * RING, pz = Math.sin(a) * RING;
      const neon = ROOM_NEON[r.type] || RIM;
      const center = V(px, level.y, pz);

      // pad disk (pickable room) + rim
      const pad = disk(PAD_R, 0.14, mat(0x0a111b, { metalness: 0.5, roughness: 0.55 })); pad.position.set(px, 0.0, pz); pad.receiveShadow = true;
      pad.userData = { kind: 'room', roomId: r.id }; pad.material = pad.material.clone(); lg.add(pad); pickables.push(pad);
      const padRim = ringMesh(PAD_R, 0.04, emis(neon, 1.6)); padRim.position.set(px, 0.09, pz); lg.add(padRim);

      // room structure
      const rg = new THREE.Group(); rg.position.set(px, 0.07, pz); rg.rotation.y = -a; lg.add(rg);
      rackCluster(rg, neon, r.type === 'office' ? 6 : r.type === 'server' || r.type === 'vault' ? 5 : 4, r.type);

      // per-room light
      const rl = new THREE.PointLight(neon, 6, 7, 2); rl.position.set(px, 1.6, pz); rl.userData.base = 6; rl.userData.target = 6; lights.push(rl); lg.add(rl);

      // circuit trace from pad to core (two thin segments: radial + a little jog)
      const traceGeos = [];
      const innerR = CORE_R + 0.5, midR = (RING + innerR) / 2;
      traceGeos.push(new THREE.BoxGeometry(RING - innerR, 0.02, 0.05).translate((innerR + RING) / 2, 0, 0));
      const trace = new THREE.Mesh(mergeGeometries(traceGeos, false), emis(TRACE, 1.5));
      trace.position.set(0, 0.05, 0); trace.rotation.y = -a; lg.add(trace);
      // little node bump where trace meets the ring
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), emis(neon, 1.8)); bump.position.set(Math.cos(a) * innerR, 0.06, Math.sin(a) * innerR); lg.add(bump);

      // floating label above the pad
      labelSign(r, V(px, 2.1, pz), lg);

      // register room + nav
      const room = { id: r.id, type: r.type, name: r.name, level: r.level, center, width: PAD_R * 2, depth: PAD_R * 2, pad, light: rl, angle: a };
      rooms.set(r.id, room);
      node(`room:${r.id}`, V(px, level.y + 0.12, pz));
      link(`room:${r.id}`, `hub:${level.id}`);

      // device slots: place each capability near its mapped room, just outside the pad
      for (const [dev, room2] of Object.entries(DEVICE_ROOM)) if (room2 === r.id && !deploySlotMap.has(dev)) {
        const off = 0.9, oa = a + 0.0; deploySlotMap.set(dev, V(px + Math.cos(oa) * off, level.y + 0.04, pz + Math.sin(oa) * off));
      }

      // desks on the pad
      const specs = deskSpecsFor(r);
      specs.forEach((spec, k) => {
        const da = (k / Math.max(1, specs.length)) * Math.PI * 2;
        const dx = px + Math.cos(a) * 0.0 + Math.cos(da) * 0.7, dz = pz + Math.sin(da) * 0.7;
        if (spec.kind === 'workstation') {
          const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), mat(0x121a24, { metalness: 0.55, roughness: 0.4 }));
          deskMesh.position.set(dx, 0.32, dz); deskMesh.castShadow = true; deskMesh.userData = { kind: 'desk', deskId: spec.id, roomId: r.id }; deskMesh.material = deskMesh.material.clone(); lg.add(deskMesh); pickables.push(deskMesh);
          const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.02), emis(0x6fd6ff, 0.9, { metalness: 0.2, roughness: 0.2 }));
          screen.position.set(dx, 0.6, dz + 0.16); screen.material = screen.material.clone(); lg.add(screen);
          desks.set(spec.id, { id: spec.id, roomId: r.id, pos: V(dx, 0.6 + level.y, dz), deskMesh, screen });
        } else {
          const core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.3, 0.6), mat(0x141c26, { metalness: 0.6, roughness: 0.35 }));
          core.position.set(dx, 0.72, dz); core.castShadow = true; core.userData = { kind: 'desk', deskId: spec.id, roomId: r.id }; core.material = core.material.clone(); lg.add(core); pickables.push(core);
          const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), emis(ROOM_NEON[r.type] || RIM, 1.6)); glow.position.set(dx, 1.4, dz); lg.add(glow);
          desks.set(spec.id, { id: spec.id, roomId: r.id, pos: V(dx, 0.9 + level.y, dz), deskMesh: core, coreMesh: core });
        }
        node(`desk:${spec.id}`, V(dx, level.y + 0.12, dz));
        link(`desk:${spec.id}`, `room:${r.id}`);
      });
    });

    // vertical spine segment (the "stairwell") through the core, linking tiers
    node(`stair:${level.id}`, V(0, level.y + 0.12, 0));
    link(`stair:${level.id}`, `hub:${level.id}`);
  }

  // central spine mesh connecting the tiers
  const ys = LAYOUT.levels.map(l => l.y); const yTop = Math.max(...ys) + WH, yBot = Math.min(...ys);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, yTop - yBot + 0.5, 20), emis(CORE, 0.8, { transparent: true, opacity: 0.5 }));
  spine.position.y = (yTop + yBot) / 2; group.add(spine);
  for (let i = 0; i < LAYOUT.levels.length - 1; i++) link(`stair:${LAYOUT.levels[i].id}`, `stair:${LAYOUT.levels[i + 1].id}`);

  // entrance just outside the L3 reception pad
  const rec = rooms.get('reception');
  const entry = rec.center.clone(); const ea = rec.angle; entry.x += Math.cos(ea) * 2.4; entry.z += Math.sin(ea) * 2.4; entry.y = 0.12;
  nav.nodes.set('entrance', { id: 'entrance', pos: entry, level: 'L3' }); nav.adj.set('entrance', []); link('entrance', 'room:reception');
  anchors.entrance = entry.clone();

  // named anchors used by fx/main (fall back to device slots / rooms)
  anchors.AF = deploySlotMap.get('AF')?.clone() || rec.center.clone();
  anchors.IAG = deploySlotMap.get('IAG')?.clone() || rooms.get('egress').center.clone();
  anchors.XDR = rooms.get('soc').center.clone();
  anchors.ASTOR = rooms.get('server').center.clone();
  anchors.MDR = V(RING + 3.5, 2.2, 0);   // off-platform SOC beacon
  anchors.NDR = LAYOUT.levels.map(l => V(0, l.y + 0.5, 0));

  const B = { x0: -(RING + 2), x1: RING + 2, z0: -(RING + 2), z1: RING + 2 };
  return { group, rooms, desks, pickables, anchors, nav, lights, signs, refreshSigns, floors, propAnchors, deploySlot,
    levels: LAYOUT.levels, dims: { W: (RING + 2) * 2, D: (RING + 2) * 2, WH, bounds: B, MX: 0, MZ: 0 } };
}
