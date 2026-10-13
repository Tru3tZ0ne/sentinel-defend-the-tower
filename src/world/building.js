// Single-floor building generator — "Level 3, Meridian Tower".
// Builds an attractive miniature corporate floor from LAYOUT: a diorama base, an oak floor,
// a corridor spine, glass-fronted rooms off it, exterior walls (front open, dollhouse-style),
// in-world signage, and furniture that gives each room a distinct identity. Exposes the same
// interface the engine/main expect: rooms, desks, pickables, anchors, nav graph, lights.
import { loc } from '../i18n.js';

const P = {
  base: 0x222736, baseTop: 0x2c3242,
  floor: 0xb8966a, floorLine: 0xa8865a, corridor: 0xb6bfcc, rug: { office: 0x6f86a6, meeting: 0x8a76a6, lobby: 0xac855f, command: 0x8a6f78, server: 0x5f8a98, vault: 0xc0a050, egress: 0x6f9086 },
  wall: 0xcfc8ba, wallBack: 0xc6bfb0, trim: 0xb8b0a2, base6: 0xc9c2b4,
  glass: 0x9fd0e6, glassFrame: 0xc3ccd6,
  deskTop: 0xe7e2da, deskLeg: 0x8a93a6, chair: 0x414c66, chairB: 0x37425c,
  metal: 0x9aa3b4, monitor: 0x20252e, screenOn: 0x6fd6ff, wood: 0xb98a5a, sofa: 0x6d7c97,
  pot: 0xb07a4e, leaf: 0x4f9e63, leaf2: 0x5fae70,
  rack: 0x39414f, rackCyan: 0x46e0d0, serverGlow: 0x3fd0ff,
  vaultCore: 0xffd166, vaultPlinth: 0xbfa150, gold: 0xffcf6e,
  brand: 0x72bb38, signBg: 0x1b2230, signInk: 0xf2f5fb, accentCyan: 0x39c0ff,
  door: 0x7f8aa0, exit: 0x46e0a0,
};

export function buildBuilding(THREE, LAYOUT) {
  const group = new THREE.Group();
  const { bounds: B, corridor: C, wallH: WH } = LAYOUT;
  const FW = B.x1 - B.x0, FD = B.z1 - B.z0, MX = (B.x0 + B.x1) / 2, MZ = (B.z0 + B.z1) / 2;

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.0, ...o });
  const glassMat = () => new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0 });
  const emis = (color, i = 0.9, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.5, ...o });
  const geomBox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const mesh = (g, m, cast = true, recv = true) => { const x = new THREE.Mesh(g, m.isMaterial ? m : mat(m)); x.castShadow = cast; x.receiveShadow = recv; return x; };
  const box = (w, h, d, m, cast, recv) => mesh(geomBox(w, h, d), m, cast, recv);
  const cyl = (rt, rb, h, m, seg = 12, cast = true) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m.isMaterial ? m : mat(m)); x.castShadow = cast; x.receiveShadow = true; return x; };
  const add = (m, x, y, z, parent = group) => { m.position.set(x, y, z); parent.add(m); return m; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const YUP = new THREE.Vector3(0, 1, 0);
  const ROOM_LIGHT = { office: [0xbcd0f0, 5.5], meeting: [0xc2d2ee, 5], lobby: [0xffe0b8, 6.5], command: [0x9a86ff, 5.5], server: [0x3fb0ff, 6.5], vault: [0xffcf6e, 7.5], egress: [0x9fe0c0, 4.5] };

  const logoTex = new THREE.TextureLoader().load('assets/brand/sangfor-logo-white.png');
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
  const rooms = new Map(), desks = new Map(), pickables = [], anchors = {}, lights = [], signs = [];
  const nav = { nodes: new Map(), adj: new Map() };
  const node = (id, pos) => { nav.nodes.set(id, { id, pos: pos.clone ? pos.clone() : V(pos.x, pos.y, pos.z), floor: 0 }); nav.adj.set(id, nav.adj.get(id) || []); };
  const link = (a, b) => { if (nav.adj.get(a) && nav.adj.get(b)) { nav.adj.get(a).push(b); nav.adj.get(b).push(a); } };

  // ---------- floor slab (a real building floor, not a diorama base) ----------
  add(box(FW + 0.6, 0.4, FD + 0.6, mat(0x141a28, { roughness: 0.95 }), true, true), MX, -0.22, MZ);
  const floor = box(FW, 0.1, FD, mat(P.floor, { roughness: 0.9 }), false, true); add(floor, MX, 0.0, MZ);
  // subtle plank lines
  for (let x = B.x0 + 2; x < B.x1; x += 2) add(box(0.03, 0.005, FD, mat(P.floorLine)), x, 0.051, MZ, group).receiveShadow = true;
  // corridor finish
  add(box(FW, 0.02, C.z1 - C.z0, mat(P.corridor, { roughness: 0.6 })), MX, 0.055, (C.z0 + C.z1) / 2, group).receiveShadow = true;

  // ---------- signage (canvas textures, bilingual via refreshSigns) ----------
  function drawSign(canvas, text, accent) {
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = 16; ctx.fillStyle = '#1b2230';
    ctx.beginPath(); ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, r); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(18, canvas.height / 2 - 18, 7, 36);
    ctx.fillStyle = '#f2f5fb'; ctx.font = '600 44px -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, 40, canvas.height / 2 + 2);
  }
  function makeSign(r, x, y, z) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 96;
    const accent = '#' + (P.brand).toString(16).padStart(6, '0');
    drawSign(canvas, loc(r.name), r.type === 'server' ? '#39c0ff' : r.type === 'vault' ? '#ffcf6e' : accent);
    const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    add(plane, x, y, z); signs.push({ canvas, tex, r, mesh: plane });
    // small mount
    add(box(0.05, 0.05, 0.05, mat(P.metal)), x, y, z - 0.03);
    return plane;
  }

  // ---------- walls ----------
  const wallMat = mat(P.wall), backMat = mat(P.wallBack), trimMat = mat(P.trim);
  function segX(xA, xB, z, h, th, m = wallMat, trim = true) {
    const len = Math.abs(xB - xA); if (len < 0.01) return; const c = (xA + xB) / 2;
    add(box(len, h, th, m), c, h / 2, z);
    if (trim) add(box(len + 0.02, 0.07, th + 0.05, trimMat, false), c, h, z);
  }
  function segZ(zA, zB, x, h, th, m = wallMat, trim = true) {
    const len = Math.abs(zB - zA); if (len < 0.01) return; const c = (zA + zB) / 2;
    add(box(th, h, len, m), x, h / 2, c);
    if (trim) add(box(th + 0.05, 0.07, len + 0.02, trimMat, false), x, h, c);
  }
  // glass corridor wall along a z line, with door gaps; low solid base + translucent upper
  function glassWallX(z, doors, dw = 1.9) {
    const spans = gaps(B.x0, B.x1, doors, dw);
    for (const [a, b] of spans) {
      const len = Math.abs(b - a), c = (a + b) / 2;
      add(box(len, 0.35, 0.1, mat(P.glassFrame)), c, 0.175, z);                 // kick base
      add(box(len, WH - 0.5, 0.06, glassMat(), false, false), c, (WH + 0.35) / 2 + 0.05, z); // glass
      add(box(len, 0.07, 0.1, mat(P.glassFrame), false), c, WH, z);             // head rail
    }
    // door frames
    for (const dx of doors) { add(box(0.1, WH, 0.12, mat(P.glassFrame)), dx - dw / 2, WH / 2, z); add(box(0.1, WH, 0.12, mat(P.glassFrame)), dx + dw / 2, WH / 2, z); }
  }
  function gaps(a, b, doors, dw) {
    const sorted = [...doors].sort((p, q) => p - q); const out = []; let cur = a;
    for (const d of sorted) { out.push([cur, d - dw / 2]); cur = d + dw / 2; } out.push([cur, b]); return out;
  }

  const EXT = WH + 0.55; // exterior walls a touch taller
  // back + sides (front left open, reception entrance added separately)
  const exitDoorX = -11;
  for (const [a, b] of gaps(B.x0, B.x1, [exitDoorX], 1.7)) segX(a, b, B.z0, EXT, 0.2, backMat);
  segZ(B.z0, B.z1, B.x0, EXT, 0.2, backMat);
  segZ(B.z0, B.z1, B.x1, EXT, 0.2, backMat);
  // a short return wall across the open front on the office/soc side so the floor isn't sheared,
  // leaving reception's frontage as the glazed entrance
  add(box(0.2, 0.5, 0.2, trimMat, false), B.x0, 0.25, B.z1);
  add(box(0.2, 0.5, 0.2, trimMat, false), 6, 0.25, B.z1);

  // corridor glass walls (front-row back edge z=C.z1, back-row front edge z=C.z0)
  const frontRooms = LAYOUT.rooms.filter(r => r.rect.z0 >= 0);
  const backRooms = LAYOUT.rooms.filter(r => r.rect.z1 <= 0);
  glassWallX(C.z1, frontRooms.map(r => r.door.x));
  glassWallX(C.z0, backRooms.map(r => r.door.x));

  // inter-room partitions (shared x boundaries within each row)
  const partsFront = [-7, 6], partsBack = [-8, -2, 5];
  for (const x of partsFront) segZ(C.z1, B.z1, x, WH, 0.14);
  for (const x of partsBack) segZ(B.z0, C.z0, x, WH, 0.14);

  // ---------- reception entrance (glazed) at the open front ----------
  (function entrance() {
    const r = LAYOUT.rooms.find(x => x.id === 'reception'); const ex = (r.rect.x0 + r.rect.x1) / 2; const z = B.z1;
    const fw = r.rect.x1 - r.rect.x0;
    // glazed facade either side of the doors
    for (const [a, b] of gaps(r.rect.x0 + 0.2, r.rect.x1 - 0.2, [ex], 2.2)) {
      const len = Math.abs(b - a); add(box(len, 0.3, 0.12, mat(P.glassFrame)), (a + b) / 2, 0.15, z);
      add(box(len, WH - 0.4, 0.06, glassMat(), false, false), (a + b) / 2, (WH + 0.3) / 2 + 0.05, z);
    }
    add(box(2.6, 0.12, 0.6, mat(P.brand), false), ex, WH + 0.18, z + 0.08); // small red entrance canopy over the doors
    add(box(0.08, WH, 0.14, mat(P.glassFrame)), ex - 1.1, WH / 2, z); add(box(0.08, WH, 0.14, mat(P.glassFrame)), ex + 1.1, WH / 2, z);
  })();

  // ---------- rooms: pads, rugs, signage, furniture, nav ----------
  // corridor spine nodes at every door x
  const doorXs = [...new Set(LAYOUT.rooms.map(r => r.door.x))].sort((a, b) => a - b);
  for (const dx of doorXs) node(`cor:${dx}`, V(dx, 0.05, 0));
  for (let i = 0; i < doorXs.length - 1; i++) link(`cor:${doorXs[i]}`, `cor:${doorXs[i + 1]}`);

  for (const r of LAYOUT.rooms) {
    const { rect } = r; const rcx = (rect.x0 + rect.x1) / 2, rcz = (rect.z0 + rect.z1) / 2;
    const rw = rect.x1 - rect.x0, rd = rect.z1 - rect.z0;
    rooms.set(r.id, { id: r.id, type: r.type, floor: 0, center: V(rcx, 0.05, rcz), width: rw, depth: rd, rect });

    // pick pad (invisible, covers the room)
    const pad = new THREE.Mesh(geomBox(rw - 0.3, 0.06, rd - 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    pad.position.set(rcx, 0.08, rcz); pad.userData = { kind: 'room', roomId: r.id }; group.add(pad); pickables.push(pad);
    rooms.get(r.id).pad = pad;

    // area rug (room tint)
    add(box(rw - 1.4, 0.015, rd - 1.6, mat(P.rug[r.type] || P.rug.office, { roughness: 0.95 }), false), rcx, 0.062, rcz);

    // signage above the door, facing the camera (+Z)
    const sz = r.door.side === 'back' ? C.z1 : C.z0;
    makeSign(r, r.door.x, WH + 0.33, sz + 0.07);

    // nav: room node just inside the door, linked to its corridor node
    const inZ = r.door.side === 'back' ? C.z1 + 1.1 : C.z0 - 1.1;
    node(`room:${r.id}`, V(r.door.x, 0.05, inZ)); link(`room:${r.id}`, `cor:${r.door.x}`);

    furnish(r, rcx, rcz, rw, rd);
  }

  // entrance node outside reception front
  const rec = rooms.get('reception');
  node('entrance', V(rec.center.x, 0.05, B.z1 + 2.0)); link('entrance', 'room:reception');
  anchors.entrance = V(rec.center.x, 0.15, B.z1 + 0.6);

  // ---------- anchors ----------
  anchors.AF = V(rec.center.x, 0.15, B.z1 - 0.3);
  const egressDoorX = LAYOUT.rooms.find(r => r.id === 'egress').door.x;
  anchors.IAG = V(egressDoorX, 0.15, C.z0 - 0.6);
  anchors.XDR = rooms.get('soc').center.clone();
  anchors.ASTOR = rooms.get('server').center.clone();
  anchors.MDR = V(B.x1 + 4.5, 2.6, B.z1 - 2);
  anchors.NDR = doorXs.map(dx => V(dx, 0.5, 0));            // corridor sensor points
  anchors.corridorZ = 0;

  // ---------- furniture kit ----------
  function chair(x, z, facing) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.44, 0.09, 0.44), mat(P.chair)));
    const b = box(0.44, 0.46, 0.09, mat(P.chair)); b.position.set(0, 0.26, -0.18); g.add(b);
    const post = cyl(0.045, 0.05, 0.3, mat(P.deskLeg)); post.position.y = -0.17; g.add(post);
    const base = cyl(0.19, 0.19, 0.04, mat(P.deskLeg)); base.position.y = -0.32; g.add(base);
    g.position.set(x, 0.42, z); g.rotation.y = facing; group.add(g); return g;
  }
  function workstation(x, z, id, roomId, facing = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = facing; group.add(g);
    const top = mesh(new THREE.BoxGeometry(1.15, 0.07, 0.68), mat(P.deskTop)); top.position.y = 0.5;
    top.userData = { kind: 'desk', deskId: id, roomId }; g.add(top); pickables.push(top);
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.26, 0.26]) { const l = box(0.06, 0.5, 0.06, mat(P.deskLeg)); l.position.set(sx, 0.25, sz); g.add(l); }
    g.add(place(box(0.07, 0.17, 0.07, mat(P.metal)), 0, 0.6, -0.18));
    g.add(place(box(0.66, 0.42, 0.05, mat(P.monitor)), 0, 0.84, -0.2));
    const screen = place(box(0.58, 0.34, 0.02, emis(P.screenOn, 0.55), false), 0, 0.84, -0.17); g.add(screen);
    g.add(place(box(0.44, 0.03, 0.17, mat(P.metal)), 0, 0.545, 0.05)); // keyboard
    // seat position (local +Z, in front of the desk), transformed to world
    const seat = new THREE.Vector3(0, 0, 0.58).applyAxisAngle(YUP, facing).add(new THREE.Vector3(x, 0, z));
    desks.set(id, { id, roomId, pos: new THREE.Vector3(x, 0.75, z), deskMesh: top, screen });
    node(`desk:${id}`, new THREE.Vector3(seat.x, 0.05, seat.z)); link(`desk:${id}`, `room:${roomId}`);
    chair(seat.x, seat.z, facing + Math.PI); // chair faces the desk
  }
  function place(m, x, y, z) { m.position.set(x, y, z); return m; }
  function plant(x, z, big = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    g.add(place(cyl(big ? 0.22 : 0.16, big ? 0.26 : 0.2, big ? 0.4 : 0.3, mat(P.pot)), 0, big ? 0.2 : 0.15, 0));
    const s1 = mesh(new THREE.IcosahedronGeometry(big ? 0.4 : 0.3, 0), mat(P.leaf)); s1.position.y = big ? 0.68 : 0.5; g.add(s1);
    const s2 = mesh(new THREE.IcosahedronGeometry(big ? 0.28 : 0.2, 0), mat(P.leaf2)); s2.position.set(0.1, big ? 0.95 : 0.7, 0.05); g.add(s2);
  }
  function ceilingStrips(cx, cz, rw) {
    // small recessed light fixtures high on the back wall — read as lighting without a ceiling
    for (const dx of [-rw / 4, rw / 4]) add(box(1.4, 0.06, 0.22, emis(0xfff4e2, 0.7), false, false), cx + dx, WH + 0.18, cz);
  }

  function furnish(r, cx, cz, rw, rd) {
    ceilingStrips(cx, cz, rw);
    const [lc, li] = ROOM_LIGHT[r.type] || [0xbcd0f0, 5];
    const rl = addLight(cx, WH + 0.1, cz, lc, li, Math.max(rw, rd) * 1.0);
    rl.userData.base = li; rl.userData.target = li;
    const rr = rooms.get(r.id); if (rr) rr.light = rl;
    if (r.type === 'office') {
      // four workstation pods; the front pair face the corridor, the back pair face front
      [['office#1', cx - 3.2, cz + 1.4, 0], ['office#2', cx - 0.6, cz + 1.4, 0],
       ['office#3', cx + 2.0, cz + 1.4, 0], ['office#4', cx + 2.0, cz - 1.6, Math.PI]]
        .forEach(([id, px, pz, f]) => workstation(px, pz, id, 'office', f));
      add(box(2.2, 1.1, 0.08, mat(0xeef1f5)), cx - rw / 2 + 1.4, 0.9, r.rect.z1 - 0.2); // whiteboard
      plant(r.rect.x1 - 0.8, r.rect.z1 - 0.9, true);
    } else if (r.type === 'lobby') {
      // reception counter + logo wall + waiting lounge
      const counter = box(3.0, 1.0, 0.75, mat(P.wood)); add(counter, cx, 0.5, r.rect.z0 + 1.3);
      add(box(3.2, 0.07, 0.95, mat(P.deskTop), false), cx, 1.0, r.rect.z0 + 1.3);
      add(box(2.7, 1.45, 0.12, mat(0x16203a), true), cx, 1.12, r.rect.z0 + 0.24);   // brand wall
      add(box(2.7, 0.06, 0.13, emis(P.brand, 0.6), false), cx, 1.86, r.rect.z0 + 0.24); // green brand rail
      const logoWall = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.69), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }));
      logoWall.position.set(cx, 1.16, r.rect.z0 + 0.31); group.add(logoWall);
      chair(cx, r.rect.z0 + 2.0, 0);
      // lounge
      add(box(2.0, 0.42, 0.7, mat(P.sofa)), cx + 1.4, 0.3, r.rect.z1 - 1.4); add(box(2.0, 0.5, 0.18, mat(P.sofa)), cx + 1.4, 0.5, r.rect.z1 - 1.1);
      add(box(0.9, 0.32, 0.6, mat(P.wood)), cx + 1.4, 0.2, r.rect.z1 - 2.3);
      plant(r.rect.x0 + 0.8, r.rect.z1 - 1.0, true); plant(r.rect.x1 - 0.8, r.rect.z0 + 1.0);
    } else if (r.type === 'command') {
      // security office: console desk + video wall
      add(box(2.4, 0.78, 0.7, mat(P.deskTop)), cx, 0.39, r.rect.z0 + 1.0);
      chair(cx, r.rect.z0 + 1.9, 0);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const on = (row + col) % 2 ? P.accentCyan : 0x8a7bff;
        add(box(0.7, 0.44, 0.05, emis(on, 0.5), false), cx - 0.85 + col * 0.85, 1.15 + row * 0.52, r.rect.z0 + 0.24);
      }
      add(box(2.8, 0.1, 0.1, mat(P.brand), false), cx, 1.95, r.rect.z0 + 0.24);
      plant(r.rect.x0 + 0.8, r.rect.z1 - 0.9);
    } else if (r.type === 'server') {
      add(box(rw - 1.2, 0.03, rd - 1.4, emis(P.serverGlow, 0.06), false), cx, 0.07, cz); // cool raised-floor glow
      let first = null;
      for (let k = 0; k < 5; k++) {
        const rack = box(0.6, 1.5, 0.8, mat(P.rack, { metalness: 0.3, roughness: 0.5 })); add(rack, r.rect.x0 + 1.0 + k * 0.95, 0.75, r.rect.z0 + 1.1);
        if (!first) first = rack;
        for (let L = 0; L < 5; L++) add(box(0.4, 0.05, 0.02, emis(P.rackCyan, 0.95), false), r.rect.x0 + 1.0 + k * 0.95, 0.4 + L * 0.26, r.rect.z0 + 0.71);
      }
      first.userData = { kind: 'desk', deskId: 'server#core', roomId: 'server' }; pickables.push(first);
      desks.set('server#core', { id: 'server#core', roomId: 'server', pos: V(r.rect.x0 + 1.0, 0.9, r.rect.z0 + 1.1), deskMesh: first });
      node('desk:server#core', V(r.rect.x0 + 1.0, 0.05, C.z0 - 1.2)); link('desk:server#core', 'room:server');
    } else if (r.type === 'vault') {
      const plinth = cyl(1.05, 1.15, 0.24, mat(P.vaultPlinth), 10); add(plinth, cx, 0.12, cz);
      const core = mesh(new THREE.IcosahedronGeometry(0.66, 0), new THREE.MeshStandardMaterial({ color: P.vaultCore, emissive: P.vaultCore, emissiveIntensity: 0.8, roughness: 0.3 }));
      core.position.set(cx, 1.1, cz); core.userData = { kind: 'desk', deskId: 'vault#core', roomId: 'vault' }; group.add(core); pickables.push(core);
      for (const [dx, dz, rot] of [[0, 1.35, 0], [0, -1.35, 0], [1.35, 0, Math.PI / 2], [-1.35, 0, Math.PI / 2]]) { const bar = box(2.4, 0.05, 0.05, emis(P.gold, 0.4), false); bar.position.set(cx + dx, 0.78, cz + dz); bar.rotation.y = rot; group.add(bar); }
      desks.set('vault#core', { id: 'vault#core', roomId: 'vault', pos: V(cx, 1.1, cz), coreMesh: core });
      node('desk:vault#core', V(cx, 0.05, C.z0 - 1.2)); link('desk:vault#core', 'room:vault');
      add(box(0.5, 0.3, 0.1, emis(P.accentCyan, 0.5), false), r.rect.x1 - 0.5, 1.1, C.z0 - 0.02); // card reader by door
    } else if (r.type === 'meeting') {
      const table = box(2.8, 0.1, 1.2, mat(P.wood)); add(table, cx, 0.56, cz);
      add(cyl(0.14, 0.14, 0.56, mat(P.deskLeg)), cx, 0.28, cz);
      for (const dz of [-0.95, 0.95]) for (const dx of [-0.9, 0, 0.9]) chair(cx + dx, cz + dz, dz < 0 ? 0 : Math.PI);
      add(box(2.0, 1.1, 0.06, mat(P.monitor)), cx, 1.35, r.rect.z0 + 0.2); add(box(1.86, 0.94, 0.02, emis(P.screenOn, 0.4), false), cx, 1.35, r.rect.z0 + 0.25);
      plant(r.rect.x1 - 0.8, r.rect.z1 - 0.9);
    } else if (r.type === 'egress') {
      for (let s = 0; s < 3; s++) add(box(1.6, 0.06, 0.5, mat(P.metal)), cx, 0.45 + s * 0.42, r.rect.z0 + 0.6);
      for (let p = 0; p < 4; p++) add(box(0.32, 0.26, 0.32, mat([0xb08a5a, 0x8a95a8, 0xc48a6a, 0x9aa06a][p])), cx - 0.7 + p * 0.46, 0.6 + (p % 2) * 0.42, r.rect.z0 + 0.6);
      add(box(0.12, 0.3, 0.3, emis(P.exit, 0.9), false), exitDoorX, EXT - 0.3, B.z0 + 0.15); // EXIT light on back wall
      plant(r.rect.x1 - 0.7, r.rect.z1 - 0.9);
    }
  }

  // ---------- accent lights (few; one shadow light lives in world.js) ----------
  function addLight(x, y, z, color, intensity, dist) { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z); group.add(l); lights.push(l); return l; }

  function refreshSigns() { for (const s of signs) { drawSign(s.canvas, loc(s.r.name), s.r.type === 'server' ? '#39c0ff' : s.r.type === 'vault' ? '#ffcf6e' : '#' + P.brand.toString(16).padStart(6, '0')); s.tex.needsUpdate = true; } }

  return { group, rooms, desks, pickables, anchors, nav, lights, signs, refreshSigns, dims: { W: FW, D: FD, WH, bounds: B, MX, MZ } };
}

// BFS pathfinding over the nav graph; returns array of Vector3 waypoints (inclusive).
export function findPath(nav, fromId, toId) {
  if (fromId === toId) return [nav.nodes.get(toId).pos];
  const prev = new Map([[fromId, null]]);
  const q = [fromId];
  while (q.length) {
    const cur = q.shift();
    if (cur === toId) break;
    for (const nx of (nav.adj.get(cur) || [])) if (!prev.has(nx)) { prev.set(nx, cur); q.push(nx); }
  }
  if (!prev.has(toId)) return null;
  const path = []; let c = toId;
  while (c != null) { path.unshift(nav.nodes.get(c).pos); c = prev.get(c); }
  return path;
}
