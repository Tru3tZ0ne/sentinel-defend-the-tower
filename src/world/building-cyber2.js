// Cyber2 building generator — a Sangfor DEFENSE-IN-DEPTH ARCHITECTURE tower. Same neon-fortress
// family as building-cyber.js, but here each stacked tier IS a security LAYER of the stack, and
// the Sangfor product that owns that layer is the hero of the tier: a glowing, labelled "layer
// core" at the centre (AF at the perimeter, EDR over the endpoints, NDR on the network spine,
// aStor at the data core, XDR+MDR at the SOC crown). The rooms of that layer ring the core.
//
// It exposes the SAME interface and the SAME room/desk/nav IDs as building.js/building-cyber.js,
// so the engine, people, fx, overlay and missions all work exactly as before (see
// data/scenario-cyber2.js, where the levels are the layers).
import { loc } from '../i18n.js';
import { PRODUCTS } from '../data/products.js';
import { mergeGeometries } from '../vendor/three/BufferGeometryUtils.js';

// Neon palette keyed to room purpose — deep electric blue dominant, warm/violet accents sparing.
const ROOM_NEON = {
  command: 0x4664ff, office: 0x2a6bff, lobby: 0x1f8fe0, egress: 0xff7a2e,
  server: 0x2460ff, vault: 0xffbf3a, meeting: 0x3a86ff,
};
const RIM = 0x2f7bff, TRACE = 0x2f8dff, CORE = 0x2c6cff;

// Per-layer product identity: the hero product of each level (its "layer core") + an optional
// secondary product that also lives on that layer, and the neon colour that themes the tier.
const LAYER = {
  SOC:  { primary: 'XDR',   secondary: 'MDR', color: 0x6a4bff },
  EP:   { primary: 'EDR',   secondary: null,  color: 0x2a6bff },
  NET:  { primary: 'NDR',   secondary: null,  color: 0x2f8dff },
  EDGE: { primary: 'AF',    secondary: 'IAG', color: 0x3a86ff },
  CORE: { primary: 'ASTOR', secondary: null,  color: 0xffbf3a },
};
// secondary-product beacon colouring (MDR as command-violet, IAG as egress-orange)
const LAYER_SECONDARY_TYPE = { MDR: 'command', IAG: 'egress' };

export function buildBuilding(THREE, LAYOUT) {
  const group = new THREE.Group();
  const WH = 2.6;                         // tier "working height" used by fx for effect columns
  const RING = 7.4;                       // radius of the room-pad ring around each core
  const PAD_R = 1.5;                      // room-pad radius
  const CORE_R = 2.3;                     // central layer-core radius

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
  const glass = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide });

  const rooms = new Map(), desks = new Map(), pickables = [], anchors = {}, lights = [], signs = [], floors = [];
  const nav = { nodes: new Map(), adj: new Map() };
  const propAnchors = [];
  const node = (id, pos) => { nav.nodes.set(id, { id, pos: pos.clone(), level: posLevel(pos.y) }); nav.adj.set(id, nav.adj.get(id) || []); };
  const link = (a, b) => { if (!nav.adj.has(a)) nav.adj.set(a, []); if (!nav.adj.has(b)) nav.adj.set(b, []); if (!nav.adj.get(a).includes(b)) nav.adj.get(a).push(b); if (!nav.adj.get(b).includes(a)) nav.adj.get(b).push(a); };
  const posLevel = y => LAYOUT.levels.reduce((a, b) => Math.abs(a.y - y) < Math.abs(b.y - y) ? a : b).id;

  // ---- small builders ----
  const disk = (r, h, m, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  const ringMesh = (r, tube, m) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 64).rotateX(Math.PI / 2), m);

  // A glowing billboard that labels a LAYER by its hero product + the layer name. These are the
  // signage of the architecture tower; refreshSigns redraws them on language change.
  function productSign(level, prodId, pos, parent, scale = 1) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.0 * scale, 1.25 * scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    pl.position.copy(pos); pl.renderOrder = 3;
    pl.onBeforeRender = (r, s, cam) => pl.quaternion.copy(cam.quaternion);   // billboard: always face the camera
    parent.add(pl);
    const color = '#' + (LAYER[level.id]?.color || RIM).toString(16).padStart(6, '0');
    const sign = { kind: 'product', level, prodId, canvas: c, tex, color };
    signs.push(sign); drawSign(sign); return pl;
  }
  function drawSign(sign) {
    const ctx = sign.canvas.getContext('2d'); ctx.clearRect(0, 0, 512, 160);
    const p = PRODUCTS[sign.prodId];
    ctx.textAlign = 'center'; ctx.shadowColor = sign.color; ctx.shadowBlur = 16;
    // product short name (hero line)
    ctx.fillStyle = sign.color; ctx.font = '700 58px system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText((p?.shortName || sign.prodId).slice(0, 18), 256, 70);
    // layer name (sub line)
    ctx.shadowBlur = 8; ctx.fillStyle = 'rgba(210,228,255,0.92)'; ctx.font = '600 32px system-ui, sans-serif';
    ctx.fillText(loc(sign.level.name).slice(0, 26), 256, 120);
    sign.tex.needsUpdate = true;
  }
  function refreshSigns() { for (const s of signs) drawSign(s); }

  // Desk IDs must match scenario-cyber2 (office#N, l2-finance#N, server#core, vault#core) so the
  // missions, EDR endpoints and MDR assist resolve exactly as in the office build.
  function deskSpecsFor(r) {
    if (r.type === 'office' && r.desks) return Array.from({ length: r.desks }, (_, k) => ({ id: `${r.id}#${k + 1}`, kind: 'workstation' }));
    if (r.type === 'server' && r.id === 'server') return [{ id: 'server#core', kind: 'core' }];
    if (r.type === 'vault') return [{ id: `${r.id}#core`, kind: 'core' }];
    return [];
  }

  // A cluster of glowing server-rack "data-towers" on a pad, tinted to the room's neon.
  function rackCluster(group, neon, n) {
    const bodyMat = mat(0x0b1019, { metalness: 0.62, roughness: 0.4 });
    const bodies = [], strips = [], caps = [];
    const seedR = (i) => { const v = Math.sin(i * 51.7 + 3.1) * 43758.5453; return v - Math.floor(v); };
    // Towers are kept tight to the pad centre so the workstation desks (ringed around the pad
    // edge) stay the frontmost pickable from any orbit angle — EDR clicks must land on the desk.
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4, r = 0.28 + seedR(i) * 0.2;
      const w = 0.34 + seedR(i + 9) * 0.14, h = 1.05 + seedR(i + 3) * 1.45, d = 0.34;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      bodies.push(new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z));
      for (let s = 0; s < Math.max(3, Math.floor(h / 0.2)); s++) {
        strips.push(new THREE.BoxGeometry(w * 0.68, 0.035, 0.02).translate(x, 0.14 + s * 0.2, z + d / 2 + 0.006));
      }
      caps.push(new THREE.BoxGeometry(w * 1.02, 0.05, d * 1.02).translate(x, h + 0.01, z));
      caps.push(new THREE.BoxGeometry(0.025, h, 0.025).translate(x - w / 2, h / 2, z + d / 2));
      caps.push(new THREE.BoxGeometry(0.025, h, 0.025).translate(x + w / 2, h / 2, z + d / 2));
    }
    let body = null;
    if (bodies.length) { body = new THREE.Mesh(mergeGeometries(bodies, false), bodyMat); body.castShadow = true; body.receiveShadow = true; group.add(body); }
    if (strips.length) group.add(new THREE.Mesh(mergeGeometries(strips, false), emis(neon, 1.5)));
    if (caps.length) group.add(new THREE.Mesh(mergeGeometries(caps, false), emis(neon, 1.9)));
    return body;
  }

  // deterministic per-index pseudo-random (so the tower is identical every build)
  const rnd = (i) => { const v = Math.sin(i * 51.7 + 3.1) * 43758.5453; return v - Math.floor(v); };
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const WARM = [0xff5a7a, 0xff8a3c, 0xc04bff, 0x37e0c0]; // red / orange / magenta / teal accent lights

  // The glowing server-"city" visible INSIDE a translucent drum (like the reference): many little
  // towers at varied heights with emissive window grids + a few warm accent beacons.
  function innerCity(lg, pcolor) {
    const towers = [], windows = [], accents = [];
    for (let i = 0; i < 46; i++) {
      const a = rnd(i) * Math.PI * 2, r = CORE_R * (0.15 + 0.72 * rnd(i + 50));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const w = 0.1 + rnd(i + 7) * 0.16, h = WH * (0.22 + 0.72 * rnd(i + 3)), d = 0.1 + rnd(i + 11) * 0.16;
      towers.push(new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z));
      for (let s = 0; s < Math.max(2, Math.floor(h / 0.26)); s++) windows.push(new THREE.BoxGeometry(w * 0.7, 0.05, 0.012).translate(x, 0.1 + s * 0.24, z + d / 2 + 0.006));
      if (rnd(i + 23) > 0.86) accents.push(new THREE.SphereGeometry(0.06, 8, 7).translate(x, h + 0.08, z));
    }
    lg.add(new THREE.Mesh(mergeGeometries(towers, false), mat(0x0a1220, { metalness: 0.6, roughness: 0.4 })));
    lg.add(new THREE.Mesh(mergeGeometries(windows, false), emis(pcolor, 1.3)));
    if (accents.length) lg.add(new THREE.Mesh(mergeGeometries(accents, false), emis(WARM[1], 2.0)));
  }

  // The hero of each tier: a translucent glass drum holding a glowing server-city, themed to the layer.
  function layerCore(lg, level, pcolor) {
    innerCity(lg, pcolor);
    // glass drum enclosing the city (double-shell for a richer fresnel-ish rim)
    const drum = disk(CORE_R, WH, glass(pcolor)); drum.position.y = WH / 2; lg.add(drum);
    const shell = disk(CORE_R + 0.06, WH * 0.99, new THREE.MeshStandardMaterial({ color: pcolor, emissive: pcolor, emissiveIntensity: 0.12, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.4, side: THREE.BackSide })); shell.position.y = WH / 2; lg.add(shell);
    const cap = disk(CORE_R + 0.2, 0.16, mat(0x0a1018, { metalness: 0.7, roughness: 0.3 })); cap.position.y = WH + 0.08; lg.add(cap);
    const base = disk(CORE_R + 0.2, 0.14, mat(0x0a1018, { metalness: 0.7, roughness: 0.3 })); base.position.y = 0.0; lg.add(base);
    const capGlow = ringMesh(CORE_R, 0.06, emis(pcolor, 1.8)); capGlow.position.y = WH + 0.16; lg.add(capGlow);
    const baseGlow = ringMesh(CORE_R, 0.05, emis(pcolor, 1.5)); baseGlow.position.y = 0.08; lg.add(baseGlow);
    // uplight so the core glows its product colour
    const cl = new THREE.PointLight(pcolor, 8, 11, 2); cl.position.set(0, WH * 0.6, 0); lg.add(cl);
    // the hero billboard above the core: product name + layer name
    productSign(level, LAYER[level.id].primary, V(0, WH + 1.6, 0), lg, 1.15);
  }

  // Dense ring of decorative "data node" satellite buildings around a tier — the reference's packed
  // mini high-rises / server cabinets wired to the core. Pure visual density (NOT pickable), placed
  // in the arcs the gameplay room pads don't occupy so clicks stay clean.
  function satelliteField(lg, pcolor, occupied) {
    const pads = [], padRims = [], bodies = [], windows = [], traces = [], bumps = [], accents = [];
    const innerR = CORE_R + 0.5;
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.22;
      if (occupied.some(oa => Math.abs(angDiff(a, oa)) < 0.52)) continue;   // leave room for gameplay pads
      const ringR = RING + (rnd(i) > 0.5 ? 1.0 : -0.3);
      const px = Math.cos(a) * ringR, pz = Math.sin(a) * ringR;
      pads.push(new THREE.CylinderGeometry(0.74, 0.74, 0.1, 20).translate(px, -0.01, pz));
      padRims.push(new THREE.TorusGeometry(0.74, 0.03, 8, 28).rotateX(Math.PI / 2).translate(px, 0.06, pz));
      const m = 2 + Math.floor(rnd(i + 5) * 3);
      for (let k = 0; k < m; k++) {
        const aa = (k / m) * Math.PI * 2 + rnd(i + k), rr = 0.16 + rnd(i * 7 + k) * 0.3;
        const bx = px + Math.cos(aa) * rr, bz = pz + Math.sin(aa) * rr;
        const w = 0.26 + rnd(i + k) * 0.22, h = 0.55 + rnd(i * 3 + k) * 2.0, d = 0.26 + rnd(i + 2 + k) * 0.18;
        bodies.push(new THREE.BoxGeometry(w, h, d).translate(bx, h / 2, bz));
        for (let s = 0; s < Math.max(2, Math.floor(h / 0.24)); s++) windows.push(new THREE.BoxGeometry(w * 0.6, 0.045, 0.014).translate(bx, 0.1 + s * 0.22, bz + d / 2 + 0.008));
        if (rnd(i * 13 + k) > 0.72) accents.push({ g: new THREE.SphereGeometry(0.07, 8, 7).translate(bx, h + 0.09, bz), c: WARM[(i + k) % WARM.length] });
      }
      traces.push(new THREE.BoxGeometry(ringR - innerR, 0.02, 0.04).translate((innerR + ringR) / 2, 0, 0).rotateY(-a).translate(0, 0.05, 0));
      bumps.push(new THREE.SphereGeometry(0.07, 9, 8).translate(Math.cos(a) * innerR, 0.06, Math.sin(a) * innerR));
    }
    if (!bodies.length) return;
    lg.add(new THREE.Mesh(mergeGeometries(pads, false), mat(0x0a111b, { metalness: 0.5, roughness: 0.55 })));
    lg.add(new THREE.Mesh(mergeGeometries(padRims, false), emis(pcolor, 1.1)));
    const bodyMesh = new THREE.Mesh(mergeGeometries(bodies, false), mat(0x0b1019, { metalness: 0.6, roughness: 0.4 })); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; lg.add(bodyMesh);
    lg.add(new THREE.Mesh(mergeGeometries(windows, false), emis(pcolor, 1.25)));
    lg.add(new THREE.Mesh(mergeGeometries(traces, false), emis(TRACE, 1.4)));
    lg.add(new THREE.Mesh(mergeGeometries(bumps, false), emis(pcolor, 1.7)));
    // warm accent beacons, grouped by colour so each colour is one emissive mesh
    const byColor = new Map();
    for (const ac of accents) { (byColor.get(ac.c) || byColor.set(ac.c, []).get(ac.c)).push(ac.g); }
    for (const [c, gs] of byColor) lg.add(new THREE.Mesh(mergeGeometries(gs, false), emis(c, 2.2)));
  }

  // A glowing PCB/topology lattice on a tier's platform: concentric arcs + fine radial spokes.
  function circuitLattice(lg, pcolor) {
    const geos = [];
    for (const rr of [RING - 1.3, RING + 0.4, RING + 1.5]) geos.push(new THREE.TorusGeometry(rr, 0.012, 6, 90).rotateX(Math.PI / 2).translate(0, 0.045, 0));
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const r0 = CORE_R + 0.6, r1 = RING + 1.6; geos.push(new THREE.BoxGeometry(r1 - r0, 0.008, 0.02).translate((r0 + r1) / 2, 0, 0).rotateY(-a).translate(0, 0.043, 0)); }
    lg.add(new THREE.Mesh(mergeGeometries(geos, false), emis(pcolor, 0.6, { transparent: true, opacity: 0.55 })));
  }

  // ---- build each level as a security-layer tier ----
  const DEVICE_ROOM = { AF: 'reception', IAG: 'egress', NDR: 'netops', ASTOR: 'server', HCI: 'server', ADC: 'soc', XDR: 'soc', MDR: 'soc', AICP: 'soc', SASE: 'egress' };
  const deploySlotMap = new Map();
  function deploySlot(id, r) { return deploySlotMap.get(id)?.clone() || (r ? r.center.clone().setY(r.center.y + 0.04) : null); }

  for (const level of LAYOUT.levels) {
    const lg = new THREE.Group(); lg.position.y = level.y; group.add(lg);
    floors.push({ id: level.id, y: level.y, group: lg, name: level.name });
    const layerInfo = LAYER[level.id] || LAYER.NET;
    const pcolor = layerInfo.color;

    // platform disk + neon rim halo + inner ring, tinted to the layer's product colour
    const plat = disk(RING + 2.0, 0.3, mat(0x060a12, { metalness: 0.5, roughness: 0.6 })); plat.position.y = -0.15; plat.receiveShadow = true; lg.add(plat);
    const rim = ringMesh(RING + 2.0, 0.09, emis(RIM, 1.5)); rim.position.y = 0.02; lg.add(rim);
    const rim2 = ringMesh(CORE_R + 0.6, 0.04, emis(pcolor, 1.2)); rim2.position.y = 0.04; lg.add(rim2);

    // the hero product core of this layer
    layerCore(lg, level, pcolor);
    const hubPos = V(0, level.y + 0.12, 0);
    node(`hub:${level.id}`, hubPos);

    // rooms of this layer -> pads around the ring
    const levelRooms = LAYOUT.rooms.filter(r => r.level === level.id);
    const base = -Math.PI / 2;
    const roomAngles = [];
    levelRooms.forEach((r, i) => {
      // spread 1-2 rooms toward the front; more rooms fan around the full ring
      const a = levelRooms.length <= 2 ? base + (i - (levelRooms.length - 1) / 2) * 0.9 : base + (i / levelRooms.length) * Math.PI * 2;
      roomAngles.push(a);
      const px = Math.cos(a) * RING, pz = Math.sin(a) * RING;
      const neon = ROOM_NEON[r.type] || RIM;
      const center = V(px, level.y, pz);

      const pad = disk(PAD_R, 0.14, mat(0x0a111b, { metalness: 0.5, roughness: 0.55 })); pad.position.set(px, 0.0, pz); pad.receiveShadow = true;
      pad.userData = { kind: 'room', roomId: r.id }; pad.material = pad.material.clone(); lg.add(pad); pickables.push(pad);
      const padRim = ringMesh(PAD_R, 0.04, emis(neon, 1.6)); padRim.position.set(px, 0.09, pz); lg.add(padRim);

      const rg = new THREE.Group(); rg.position.set(px, 0.07, pz); rg.rotation.y = -a; lg.add(rg);
      const rackBody = rackCluster(rg, neon, r.type === 'office' ? 6 : r.type === 'server' || r.type === 'vault' ? 5 : 4);
      if (rackBody) { rackBody.userData = { kind: 'room', roomId: r.id }; pickables.push(rackBody); }

      const rl = new THREE.PointLight(neon, 6, 7, 2); rl.position.set(px, 1.6, pz); rl.userData.base = 6; rl.userData.target = 6; lights.push(rl); lg.add(rl);

      // circuit trace from pad to core
      const innerR = CORE_R + 0.5;
      const trace = new THREE.Mesh(new THREE.BoxGeometry(RING - innerR, 0.02, 0.05).translate((innerR + RING) / 2, 0, 0), emis(TRACE, 1.5));
      trace.position.set(0, 0.05, 0); trace.rotation.y = -a; lg.add(trace);
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), emis(neon, 1.8)); bump.position.set(Math.cos(a) * innerR, 0.06, Math.sin(a) * innerR); lg.add(bump);

      const room = { id: r.id, type: r.type, name: r.name, level: r.level, center, width: PAD_R * 2, depth: PAD_R * 2, pad, light: rl, angle: a };
      rooms.set(r.id, room);
      node(`room:${r.id}`, V(px, level.y + 0.12, pz));
      link(`room:${r.id}`, `hub:${level.id}`);

      for (const [dev, room2] of Object.entries(DEVICE_ROOM)) if (room2 === r.id && !deploySlotMap.has(dev)) {
        deploySlotMap.set(dev, V(px + Math.cos(a) * 0.9, level.y + 0.04, pz + Math.sin(a) * 0.9));
      }

      const specs = deskSpecsFor(r);
      specs.forEach((spec, k) => {
        const da = (k / Math.max(1, specs.length)) * Math.PI * 2;
        // ring workstations around the pad EDGE (outside the central rack towers) so each desk is
        // the nearest pickable at its own screen point — makes EDR endpoint clicks reliable.
        const dr = spec.kind === 'workstation' ? 1.08 : 0.72;
        const dx = px + Math.cos(da) * dr, dz = pz + Math.sin(da) * dr;
        if (spec.kind === 'workstation') {
          const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), mat(0x121a24, { metalness: 0.55, roughness: 0.4 }));
          deskMesh.position.set(dx, 0.32, dz); deskMesh.castShadow = true; deskMesh.userData = { kind: 'desk', deskId: spec.id, roomId: r.id }; deskMesh.material = deskMesh.material.clone(); lg.add(deskMesh); pickables.push(deskMesh);
          const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.02), emis(0x3f8cff, 1.0, { metalness: 0.2, roughness: 0.2 }));
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

    // decorative density: PCB lattice on the deck + a packed ring of satellite data-buildings
    circuitLattice(lg, pcolor);
    satelliteField(lg, pcolor, roomAngles);

    // secondary product beacon for layers that host two products (SOC: MDR, EDGE: IAG)
    if (layerInfo.secondary) {
      const sa = base + Math.PI;   // opposite the main room fan
      const sx = Math.cos(sa) * (RING - 1.2), sz = Math.sin(sa) * (RING - 1.2);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.1, 14), emis(ROOM_NEON[LAYER_SECONDARY_TYPE[layerInfo.secondary]] || RIM, 1.1, { transparent: true, opacity: 0.85 }));
      beacon.position.set(sx, 1.05, sz); lg.add(beacon);
      productSign(level, layerInfo.secondary, V(sx, 2.8, sz), lg, 0.8);
    }

    node(`stair:${level.id}`, V(0, level.y + 0.12, 0));
    link(`stair:${level.id}`, `hub:${level.id}`);
  }

  // central spine connecting the tiers (the stack backbone)
  const ys = LAYOUT.levels.map(l => l.y); const yTop = Math.max(...ys) + WH, yBot = Math.min(...ys);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, yTop - yBot + 0.5, 20), emis(CORE, 0.45, { transparent: true, opacity: 0.4 }));
  spine.position.y = (yTop + yBot) / 2; group.add(spine);
  for (let i = 0; i < LAYOUT.levels.length - 1; i++) link(`stair:${LAYOUT.levels[i].id}`, `stair:${LAYOUT.levels[i + 1].id}`);

  // Grand base platform with an intense blue halo beneath the whole tower (as in the reference).
  const baseY = yBot - 1.4, baseR = RING + 5.5;
  const grand = disk(baseR, 0.5, mat(0x05080f, { metalness: 0.55, roughness: 0.6 }), 72); grand.position.y = baseY; grand.receiveShadow = true; group.add(grand);
  const grandRim = ringMesh(baseR, 0.16, emis(0x2b8bff, 2.2)); grandRim.position.y = baseY + 0.28; group.add(grandRim);
  const grandRim2 = ringMesh(baseR - 0.55, 0.05, emis(0x2f8dff, 1.4)); grandRim2.position.y = baseY + 0.3; group.add(grandRim2);
  // a faint wide glow disk just under the rim to read as a halo bloom on the void
  const halo = new THREE.Mesh(new THREE.CircleGeometry(baseR + 2.2, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1f6fff, transparent: true, opacity: 0.1, depthWrite: false }));
  halo.position.y = baseY - 0.22; group.add(halo);
  const baseUp = new THREE.PointLight(0x2b8bff, 60, 60, 2); baseUp.position.set(0, baseY + 1.2, 0); group.add(baseUp);

  // entrance just outside the perimeter gateway pad
  const rec = rooms.get('reception');
  const entry = rec.center.clone(); const ea = rec.angle; entry.x += Math.cos(ea) * 2.4; entry.z += Math.sin(ea) * 2.4; entry.y = 0.12;
  nav.nodes.set('entrance', { id: 'entrance', pos: entry, level: rec.level }); nav.adj.set('entrance', []); link('entrance', 'room:reception');
  anchors.entrance = entry.clone();

  anchors.AF = deploySlotMap.get('AF')?.clone() || rec.center.clone();
  anchors.IAG = deploySlotMap.get('IAG')?.clone() || rooms.get('egress').center.clone();
  anchors.XDR = rooms.get('soc').center.clone();
  anchors.ASTOR = rooms.get('server').center.clone();
  anchors.MDR = V(RING + 3.5, 2.2, 0);
  anchors.NDR = LAYOUT.levels.map(l => V(0, l.y + 0.5, 0));

  const B = { x0: -(RING + 2), x1: RING + 2, z0: -(RING + 2), z1: RING + 2 };
  return { group, rooms, desks, pickables, anchors, nav, lights, signs, refreshSigns, floors, propAnchors, deploySlot,
    levels: LAYOUT.levels, dims: { W: (RING + 2) * 2, D: (RING + 2) * 2, WH, bounds: B, MX: 0, MZ: 0 } };
}
