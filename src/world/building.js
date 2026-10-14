// Multi-level building generator. Builds each LAYOUT level into its own group, stacked in Y,
// with a shared nav graph linked by an internal stairwell. Only one level is shown at a time
// (the floor selector in main.js toggles level groups + moves the camera), so fog-of-war now
// has a spatial dimension: the intruder can slip to a floor you're not watching.
// Exposes: rooms, desks, pickables, anchors, nav graph, lights, signs, floors, levels.
import { loc } from '../i18n.js';

const P = {
  floor: 0xb8966a, floorLine: 0xa8865a, corridor: 0xb6bfcc, rug: { office: 0x6f86a6, meeting: 0x8a76a6, lobby: 0xac855f, command: 0x8a6f78, server: 0x5f8a98, vault: 0xc0a050, egress: 0x6f9086 },
  wall: 0xcfc8ba, wallBack: 0xc6bfb0, trim: 0xb8b0a2,
  glass: 0x9fd0e6, glassFrame: 0xc3ccd6,
  deskTop: 0xe7e2da, deskLeg: 0x8a93a6, chair: 0x414c66,
  metal: 0x9aa3b4, monitor: 0x20252e, screenOn: 0x6fd6ff, wood: 0xb98a5a, sofa: 0x6d7c97,
  pot: 0xb07a4e, leaf: 0x4f9e63, leaf2: 0x5fae70,
  rack: 0x39414f, rackCyan: 0x46e0d0, serverGlow: 0x3fd0ff,
  vaultCore: 0xffd166, vaultPlinth: 0xbfa150, gold: 0xffcf6e,
  brand: 0x72bb38, accentCyan: 0x39c0ff, exit: 0x46e0a0, stair: 0x7f8aa0,
};

export function buildBuilding(THREE, LAYOUT) {
  const group = new THREE.Group();
  const { bounds: B, corridor: C, wallH: WH } = LAYOUT;
  const FW = B.x1 - B.x0, FD = B.z1 - B.z0, MX = (B.x0 + B.x1) / 2, MZ = (B.z0 + B.z1) / 2;
  const EXT = WH + 0.55, exitDoorX = -11;

  const matMk = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.0, ...o });
  const glassMat = () => new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0.1 });
  const emis = (color, i = 0.9, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.5, ...o });
  const mesh = (g, m, cast = true, recv = true) => { const x = new THREE.Mesh(g, m.isMaterial ? m : matMk(m)); x.castShadow = cast; x.receiveShadow = recv; return x; };
  const box = (w, h, d, m, cast, recv) => mesh(new THREE.BoxGeometry(w, h, d), m, cast, recv);
  const cyl = (rt, rb, h, m, seg = 12, cast = true) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m.isMaterial ? m : matMk(m)); x.castShadow = cast; x.receiveShadow = true; return x; };
  const mat = matMk;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const YUP = new THREE.Vector3(0, 1, 0);
  const ROOM_LIGHT = { office: [0xbcd0f0, 5.5], meeting: [0xc2d2ee, 5], lobby: [0xffe0b8, 6.5], command: [0x9a86ff, 5.5], server: [0x3fb0ff, 6.5], vault: [0xffcf6e, 7.5], egress: [0x9fe0c0, 4.5] };

  const logoTex = new THREE.TextureLoader().load('assets/brand/sangfor-logo-white.png');
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;

  const rooms = new Map(), desks = new Map(), pickables = [], anchors = {}, lights = [], signs = [], floors = [];
  const nav = { nodes: new Map(), adj: new Map() };

  // ---- level context (mutated per level) ----
  let curGroup = group, curY = 0, curLevel = 'L3';
  const add = (m, x, y, z, parent = curGroup) => { m.position.set(x, y, z); parent.add(m); return m; };
  const node = (id, pos) => { const p = pos.clone ? pos.clone() : V(pos.x, pos.y, pos.z); p.y += curY; nav.nodes.set(id, { id, pos: p, level: curLevel }); nav.adj.set(id, nav.adj.get(id) || []); };
  const link = (a, b) => { if (nav.adj.get(a) && nav.adj.get(b)) { nav.adj.get(a).push(b); nav.adj.get(b).push(a); } };

  // ---------- signage ----------
  function drawSign(canvas, text, accent) {
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1b2230'; ctx.beginPath(); ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 16); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(18, canvas.height / 2 - 18, 7, 36);
    ctx.fillStyle = '#f2f5fb'; ctx.font = '600 44px -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, 40, canvas.height / 2 + 2);
  }
  function makeSign(r, x, y, z) {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 96;
    drawSign(canvas, loc(r.name), r.type === 'server' ? '#39c0ff' : r.type === 'vault' ? '#ffcf6e' : '#' + P.brand.toString(16).padStart(6, '0'));
    const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    add(plane, x, y, z); signs.push({ canvas, tex, r });
    add(box(0.05, 0.05, 0.05, mat(P.metal)), x, y, z - 0.03);
  }

  // ---------- walls ----------
  const wallMat = mat(P.wall), backMat = mat(P.wallBack), trimMat = mat(P.trim);
  function segX(xA, xB, z, h, th, m = wallMat, trim = true) { const len = Math.abs(xB - xA); if (len < 0.01) return; const c = (xA + xB) / 2; add(box(len, h, th, m), c, h / 2, z); if (trim) add(box(len + 0.02, 0.07, th + 0.05, trimMat, false), c, h, z); }
  function segZ(zA, zB, x, h, th, m = wallMat, trim = true) { const len = Math.abs(zB - zA); if (len < 0.01) return; const c = (zA + zB) / 2; add(box(th, h, len, m), x, h / 2, c); if (trim) add(box(th + 0.05, 0.07, len + 0.02, trimMat, false), x, h, c); }
  function glassWallX(z, doors, dw = 1.9) {
    for (const [a, b] of gaps(B.x0, B.x1, doors, dw)) { const len = Math.abs(b - a), c = (a + b) / 2; add(box(len, 0.35, 0.1, mat(P.glassFrame)), c, 0.175, z); add(box(len, WH - 0.5, 0.06, glassMat(), false, false), c, (WH + 0.35) / 2 + 0.05, z); add(box(len, 0.07, 0.1, mat(P.glassFrame), false), c, WH, z); }
    for (const dx of doors) { add(box(0.1, WH, 0.12, mat(P.glassFrame)), dx - dw / 2, WH / 2, z); add(box(0.1, WH, 0.12, mat(P.glassFrame)), dx + dw / 2, WH / 2, z); }
  }
  function gaps(a, b, doors, dw) { const sorted = [...doors].sort((p, q) => p - q); const out = []; let cur = a; for (const d of sorted) { out.push([cur, d - dw / 2]); cur = d + dw / 2; } out.push([cur, b]); return out; }

  // ---------- furniture kit (uses curGroup/curY via add/node) ----------
  const place = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  function chair(x, z, facing) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.44, 0.09, 0.44), mat(P.chair)));
    const b = box(0.44, 0.46, 0.09, mat(P.chair)); b.position.set(0, 0.26, -0.18); g.add(b);
    const post = cyl(0.045, 0.05, 0.3, mat(P.deskLeg)); post.position.y = -0.17; g.add(post);
    const base = cyl(0.19, 0.19, 0.04, mat(P.deskLeg)); base.position.y = -0.32; g.add(base);
    g.position.set(x, 0.42, z); g.rotation.y = facing; curGroup.add(g); return g;
  }
  function workstation(x, z, id, roomId, facing = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = facing; curGroup.add(g);
    const top = mesh(new THREE.BoxGeometry(1.15, 0.07, 0.68), mat(P.deskTop)); top.position.y = 0.5;
    top.userData = { kind: 'desk', deskId: id, roomId }; g.add(top); pickables.push(top);
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.26, 0.26]) { const l = box(0.06, 0.5, 0.06, mat(P.deskLeg)); l.position.set(sx, 0.25, sz); g.add(l); }
    g.add(place(box(0.07, 0.17, 0.07, mat(P.metal)), 0, 0.6, -0.18));
    g.add(place(box(0.66, 0.42, 0.05, mat(P.monitor)), 0, 0.84, -0.2));
    const screen = place(box(0.58, 0.34, 0.02, emis(P.screenOn, 0.55), false), 0, 0.84, -0.17); g.add(screen);
    g.add(place(box(0.44, 0.03, 0.17, mat(P.metal)), 0, 0.545, 0.05));
    const seat = new THREE.Vector3(0, 0, 0.58).applyAxisAngle(YUP, facing).add(new THREE.Vector3(x, 0, z));
    desks.set(id, { id, roomId, pos: V(x, 0.75 + curY, z), deskMesh: top, screen });
    node(`desk:${id}`, V(seat.x, 0.05, seat.z)); link(`desk:${id}`, `room:${roomId}`);
    chair(seat.x, seat.z, facing + Math.PI);
  }
  function plant(x, z, big = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); curGroup.add(g);
    g.add(place(cyl(big ? 0.22 : 0.16, big ? 0.26 : 0.2, big ? 0.4 : 0.3, mat(P.pot)), 0, big ? 0.2 : 0.15, 0));
    const s1 = mesh(new THREE.IcosahedronGeometry(big ? 0.4 : 0.3, 1), mat(P.leaf)); s1.position.y = big ? 0.68 : 0.5; g.add(s1);
    const s2 = mesh(new THREE.IcosahedronGeometry(big ? 0.28 : 0.2, 1), mat(P.leaf2)); s2.position.set(0.1, big ? 0.95 : 0.7, 0.05); g.add(s2);
  }
  function ceilingStrips(cx, cz, rw) { for (const dx of [-rw / 4, rw / 4]) add(box(1.4, 0.06, 0.22, emis(0xfff4e2, 0.7), false, false), cx + dx, WH + 0.18, cz); }
  function addLight(x, y, z, color, intensity, dist) { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z); curGroup.add(l); lights.push(l); return l; }

  function furnish(r, cx, cz, rw, rd) {
    ceilingStrips(cx, cz, rw);
    const [lc, li] = ROOM_LIGHT[r.type] || [0xbcd0f0, 5];
    const rl = addLight(cx, WH + 0.1, cz, lc, li, Math.max(rw, rd) * 1.0); rl.userData.base = li; rl.userData.target = li;
    const rr = rooms.get(r.id); if (rr) rr.light = rl;
    const desksN = r.desks || 0;
    if (r.type === 'office') {
      const ids = []; for (let k = 0; k < desksN; k++) ids.push(`${r.id}#${k + 1}`);
      const spots = [[cx - 3.2, cz + 1.4, 0], [cx - 0.6, cz + 1.4, 0], [cx + 2.0, cz + 1.4, 0], [cx + 2.0, cz - 1.6, Math.PI]];
      ids.forEach((id, i) => workstation(spots[i][0], spots[i][1], id, r.id, spots[i][2]));
      add(box(2.2, 1.1, 0.08, mat(0xeef1f5)), cx - rw / 2 + 1.4, 0.9, r.rect.z1 - 0.2);
      plant(r.rect.x1 - 0.8, r.rect.z1 - 0.9, true);
    } else if (r.type === 'lobby') {
      add(box(3.0, 1.0, 0.75, mat(P.wood)), cx, 0.5, r.rect.z0 + 1.3);
      add(box(3.2, 0.07, 0.95, mat(P.deskTop), false), cx, 1.0, r.rect.z0 + 1.3);
      add(box(2.7, 1.45, 0.12, mat(0x16203a), true), cx, 1.12, r.rect.z0 + 0.24);
      add(box(2.7, 0.06, 0.13, emis(P.brand, 0.6), false), cx, 1.86, r.rect.z0 + 0.24);
      const logoWall = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.69), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })); logoWall.position.set(cx, 1.16, r.rect.z0 + 0.31); curGroup.add(logoWall);
      chair(cx, r.rect.z0 + 2.0, 0);
      add(box(2.0, 0.42, 0.7, mat(P.sofa)), cx + 1.4, 0.3, r.rect.z1 - 1.4); add(box(2.0, 0.5, 0.18, mat(P.sofa)), cx + 1.4, 0.5, r.rect.z1 - 1.1);
      add(box(0.9, 0.32, 0.6, mat(P.wood)), cx + 1.4, 0.2, r.rect.z1 - 2.3);
      plant(r.rect.x0 + 0.8, r.rect.z1 - 1.0, true); plant(r.rect.x1 - 0.8, r.rect.z0 + 1.0);
    } else if (r.type === 'command') {
      add(box(2.4, 0.78, 0.7, mat(P.deskTop)), cx, 0.39, r.rect.z0 + 1.0);
      chair(cx, r.rect.z0 + 1.9, 0);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) add(box(0.7, 0.44, 0.05, emis((row + col) % 2 ? P.accentCyan : 0x8a7bff, 0.5), false), cx - 0.85 + col * 0.85, 1.15 + row * 0.52, r.rect.z0 + 0.24);
      add(box(2.8, 0.1, 0.1, mat(P.brand), false), cx, 1.95, r.rect.z0 + 0.24);
      plant(r.rect.x0 + 0.8, r.rect.z1 - 0.9);
    } else if (r.type === 'server') {
      add(box(rw - 1.2, 0.03, rd - 1.4, emis(P.serverGlow, 0.06), false), cx, 0.07, cz);
      let first = null;
      for (let k = 0; k < 5; k++) {
        const rack = box(0.6, 1.5, 0.8, mat(P.rack, { metalness: 0.3, roughness: 0.5 })); add(rack, r.rect.x0 + 1.0 + k * 0.95, 0.75, r.rect.z0 + 1.1); if (!first) first = rack;
        for (let L = 0; L < 5; L++) add(box(0.4, 0.05, 0.02, emis(P.rackCyan, 0.95), false), r.rect.x0 + 1.0 + k * 0.95, 0.4 + L * 0.26, r.rect.z0 + 0.71);
      }
      if (r.id === 'server') {   // the L3 server room holds the ransomware-target host
        first.userData = { kind: 'desk', deskId: 'server#core', roomId: 'server' }; pickables.push(first);
        desks.set('server#core', { id: 'server#core', roomId: 'server', pos: V(r.rect.x0 + 1.0, 0.9 + curY, r.rect.z0 + 1.1), deskMesh: first });
        node('desk:server#core', V(r.rect.x0 + 1.0, 0.05, C.z0 - 1.2)); link('desk:server#core', 'room:server');
      }
    } else if (r.type === 'vault') {
      add(cyl(1.05, 1.15, 0.24, mat(P.vaultPlinth), 10), cx, 0.12, cz);
      const core = mesh(new THREE.IcosahedronGeometry(0.66, 0), new THREE.MeshStandardMaterial({ color: P.vaultCore, emissive: P.vaultCore, emissiveIntensity: 0.8, roughness: 0.3 }));
      core.position.set(cx, 1.1, cz); core.userData = { kind: 'desk', deskId: 'vault#core', roomId: 'vault' }; curGroup.add(core); pickables.push(core);
      for (const [dx, dz, rot] of [[0, 1.35, 0], [0, -1.35, 0], [1.35, 0, Math.PI / 2], [-1.35, 0, Math.PI / 2]]) { const bar = box(2.4, 0.05, 0.05, emis(P.gold, 0.4), false); bar.position.set(cx + dx, 0.78, cz + dz); bar.rotation.y = rot; curGroup.add(bar); }
      desks.set('vault#core', { id: 'vault#core', roomId: 'vault', pos: V(cx, 1.1 + curY, cz), coreMesh: core });
      node('desk:vault#core', V(cx, 0.05, C.z0 - 1.2)); link('desk:vault#core', 'room:vault');
      add(box(0.5, 0.3, 0.1, emis(P.accentCyan, 0.5), false), r.rect.x1 - 0.5, 1.1, C.z0 - 0.02);
    } else if (r.type === 'meeting') {
      add(box(2.8, 0.1, 1.2, mat(P.wood)), cx, 0.56, cz); add(cyl(0.14, 0.14, 0.56, mat(P.deskLeg)), cx, 0.28, cz);
      for (const dz of [-0.95, 0.95]) for (const dx of [-0.9, 0, 0.9]) chair(cx + dx, cz + dz, dz < 0 ? 0 : Math.PI);
      add(box(2.0, 1.1, 0.06, mat(P.monitor)), cx, 1.35, r.rect.z0 + 0.2); add(box(1.86, 0.94, 0.02, emis(P.screenOn, 0.4), false), cx, 1.35, r.rect.z0 + 0.25);
      plant(r.rect.x1 - 0.8, r.rect.z1 - 0.9);
    } else if (r.type === 'egress') {
      for (let s = 0; s < 3; s++) add(box(1.6, 0.06, 0.5, mat(P.metal)), cx, 0.45 + s * 0.42, r.rect.z0 + 0.6);
      for (let p = 0; p < 4; p++) add(box(0.32, 0.26, 0.32, mat([0xb08a5a, 0x8a95a8, 0xc48a6a, 0x9aa06a][p])), cx - 0.7 + p * 0.46, 0.6 + (p % 2) * 0.42, r.rect.z0 + 0.6);
      add(box(0.12, 0.3, 0.3, emis(P.exit, 0.9), false), exitDoorX, EXT - 0.3, B.z0 + 0.15);
      plant(r.rect.x1 - 0.7, r.rect.z1 - 0.9);
    }
  }

  // ---------- build one level ----------
  function buildLevelGeometry(level) {
    const levelRooms = LAYOUT.rooms.filter(r => r.level === level.id);
    // floor slab + finish
    add(box(FW + 0.6, 0.4, FD + 0.6, mat(0x141a28, { roughness: 0.95 }), true, true), MX, -0.22, MZ);
    add(box(FW, 0.1, FD, mat(P.floor, { roughness: 0.9 }), false, true), MX, 0.0, MZ);
    add(box(FW, 0.02, C.z1 - C.z0, mat(P.corridor, { roughness: 0.6 })), MX, 0.055, (C.z0 + C.z1) / 2).receiveShadow = true;
    // exterior walls (front open), with the exit gap
    for (const [a, b] of gaps(B.x0, B.x1, [exitDoorX], 1.7)) segX(a, b, B.z0, EXT, 0.2, backMat);
    segZ(B.z0, B.z1, B.x0, EXT, 0.2, backMat); segZ(B.z0, B.z1, B.x1, EXT, 0.2, backMat);
    add(box(0.2, 0.5, 0.2, trimMat, false), B.x0, 0.25, B.z1); add(box(0.2, 0.5, 0.2, trimMat, false), 6, 0.25, B.z1);
    // corridor glass walls + partitions
    glassWallX(C.z1, levelRooms.filter(r => r.rect.z0 >= 0).map(r => r.door.x));
    glassWallX(C.z0, levelRooms.filter(r => r.rect.z1 <= 0).map(r => r.door.x));
    for (const x of [-7, 6]) segZ(C.z1, B.z1, x, WH, 0.14);
    for (const x of [-8, -2, 5]) segZ(B.z0, C.z0, x, WH, 0.14);
    // corridor spine nodes (namespaced by level)
    const doorXs = [...new Set(levelRooms.map(r => r.door.x))].sort((a, b) => a - b);
    for (const dx of doorXs) node(`cor:${level.id}:${dx}`, V(dx, 0.05, 0));
    for (let i = 0; i < doorXs.length - 1; i++) link(`cor:${level.id}:${doorXs[i]}`, `cor:${level.id}:${doorXs[i + 1]}`);
    // rooms
    for (const r of levelRooms) {
      const { rect } = r; const rcx = (rect.x0 + rect.x1) / 2, rcz = (rect.z0 + rect.z1) / 2, rw = rect.x1 - rect.x0, rd = rect.z1 - rect.z0;
      rooms.set(r.id, { id: r.id, type: r.type, level: level.id, center: V(rcx, 0.05 + level.y, rcz), width: rw, depth: rd, rect });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.3, 0.06, rd - 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
      pad.position.set(rcx, 0.08, rcz); pad.userData = { kind: 'room', roomId: r.id }; curGroup.add(pad); pickables.push(pad); rooms.get(r.id).pad = pad;
      add(box(rw - 1.4, 0.015, rd - 1.6, mat(P.rug[r.type] || P.rug.office, { roughness: 0.95 }), false), rcx, 0.062, rcz);
      makeSign(r, r.door.x, WH + 0.33, (r.door.side === 'back' ? C.z1 : C.z0) + 0.07);
      node(`room:${r.id}`, V(r.door.x, 0.05, r.door.side === 'back' ? C.z1 + 1.1 : C.z0 - 1.1)); link(`room:${r.id}`, `cor:${level.id}:${r.door.x}`);
      furnish(r, rcx, rcz, rw, rd);
    }
    // entrance (only the level with an entrance room) + glazed facade
    const entRoom = levelRooms.find(r => r.entrance);
    if (entRoom) {
      const ex = (entRoom.rect.x0 + entRoom.rect.x1) / 2, z = B.z1;
      for (const [a, b] of gaps(entRoom.rect.x0 + 0.2, entRoom.rect.x1 - 0.2, [ex], 2.2)) { const len = Math.abs(b - a); add(box(len, 0.3, 0.12, mat(P.glassFrame)), (a + b) / 2, 0.15, z); add(box(len, WH - 0.4, 0.06, glassMat(), false, false), (a + b) / 2, (WH + 0.3) / 2 + 0.05, z); }
      add(box(2.6, 0.12, 0.6, mat(P.brand), false), ex, WH + 0.18, z + 0.08);
      add(box(0.08, WH, 0.14, mat(P.glassFrame)), ex - 1.1, WH / 2, z); add(box(0.08, WH, 0.14, mat(P.glassFrame)), ex + 1.1, WH / 2, z);
    }
    // internal stairwell (visual + nav node), linked to the nearest corridor node
    const sx = LAYOUT.stair.x;
    add(box(1.6, WH, 1.6, mat(0x2a3346), true), sx, WH / 2, 0);
    for (let s = 0; s < 4; s++) add(box(1.3, 0.08, 0.3, mat(P.stair)), sx, 0.1 + s * (WH / 5), -0.5 + s * 0.3);
    add(box(0.5, 0.26, 0.1, emis(0xffd166, 0.7), false), sx, WH + 0.2, 0.75);   // stair sign
    node(`stair:${level.id}`, V(sx, 0.05, 0));
    const nearest = doorXs.reduce((a, b) => Math.abs(b - sx) < Math.abs(a - sx) ? b : a, doorXs[0]);
    link(`stair:${level.id}`, `cor:${level.id}:${nearest}`);
    // NDR corridor sensor points for this level (building-wide coverage)
    for (const dx of doorXs) (anchors.NDR ||= []).push(V(dx, 0.5 + level.y, 0));
  }

  // ---------- build all levels ----------
  for (const level of LAYOUT.levels) {
    curLevel = level.id; curY = level.y;
    const lg = new THREE.Group(); lg.position.y = level.y; group.add(lg); curGroup = lg;
    floors.push({ id: level.id, y: level.y, group: lg, name: level.name });
    buildLevelGeometry(level);
  }
  curGroup = group; curY = 0; curLevel = LAYOUT.defaultLevel;

  // link stairwells between consecutive levels (vertical travel)
  for (let i = 0; i < LAYOUT.levels.length - 1; i++) link(`stair:${LAYOUT.levels[i].id}`, `stair:${LAYOUT.levels[i + 1].id}`);

  // ---------- anchors (L3) ----------
  const rec = rooms.get('reception');
  const recNode = nav.nodes.get('room:reception');
  nav.nodes.set('entrance', { id: 'entrance', pos: V(rec.center.x, 0.15, B.z1 + 2.0), level: 'L3' }); nav.adj.set('entrance', []); link('entrance', 'room:reception');
  anchors.entrance = V(rec.center.x, 0.15, B.z1 + 0.6);
  anchors.AF = V(rec.center.x, 0.15, B.z1 - 0.3);
  anchors.IAG = V(LAYOUT.rooms.find(r => r.id === 'egress').door.x, 0.15, C.z0 - 0.6);
  anchors.XDR = rooms.get('soc').center.clone();
  anchors.ASTOR = rooms.get('server').center.clone();
  anchors.MDR = V(B.x1 + 4.5, 2.6, B.z1 - 2);

  function refreshSigns() { for (const s of signs) drawSign(s.canvas, loc(s.r.name), s.r.type === 'server' ? '#39c0ff' : s.r.type === 'vault' ? '#ffcf6e' : '#' + P.brand.toString(16).padStart(6, '0')), s.tex.needsUpdate = true; }

  return { group, rooms, desks, pickables, anchors, nav, lights, signs, refreshSigns, floors, levels: LAYOUT.levels, dims: { W: FW, D: FD, WH, bounds: B, MX, MZ } };
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
