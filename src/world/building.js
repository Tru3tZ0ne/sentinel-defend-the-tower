// Builds the low-poly cutaway tower from LAYOUT and exposes anchors + a nav graph.
// The front wall (+Z) is omitted so the camera sees inside every room. Each room gets a
// recognizable identity through furniture, materials and accent lighting — reception,
// offices, a meeting room, a server room, a data vault, a security office, an egress.

const PALETTE = {
  slabTop: 0x20283f, slabBottom: 0x141a2c, backWall: 0x202a47, sideWall: 0x1b2440,
  partition: 0x2b3658, fascia: 0x2a3454, core: 0x222c49, coreTread: 0x37446d, rail: 0x3b5a86,
  // carpet / floor finish per room function (matte, readable, cohesive)
  floor: { lobby: 0x4a5069, command: 0x3b3356, egress: 0x374b52, office: 0x36446a,
           meeting: 0x3b4a6b, server: 0x272f4e, vault: 0x463a63 },
  deskTop: 0x59627e, deskLeg: 0x39445f, wood: 0x6b4f35, chair: 0x2d3550,
  monitor: 0x11162a, screenOn: 0x5fd0ff, metal: 0x4a556f, plantPot: 0x6a4a36, leaf: 0x3f8f5e,
  rack: 0x232c47, rackLight: 0x46e0a0, vaultCore: 0xffd166, vaultPlinth: 0x4a3a66,
  cabinet: 0x44506e, sofa: 0x44557a, rug: 0x5a4668, ceilGlow: 0x9fb6e6,
};

export function buildBuilding(THREE, LAYOUT) {
  const group = new THREE.Group();
  const { floors, floorHeight: FH, width: W, depth: D, stairWidth: SW } = LAYOUT;
  const roomsAreaW = W - SW;
  const coreX = W / 2 - SW / 2;

  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0.04, ...opts });
  const emis = (color, intensity = 0.8, opts = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, flatShading: true, roughness: 0.5, ...opts });
  const box = (w, h, d, color, opts) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color?.isMaterial ? color : mat(color, opts));
  const cyl = (rt, rb, h, color, seg = 10, opts) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color?.isMaterial ? color : mat(color, opts));
  const add = (mesh, x, y, z, parent = group) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const lights = [];

  const rooms = new Map();
  const desks = new Map();
  const pickables = [];
  const anchors = {};
  const nav = { nodes: new Map(), adj: new Map() };
  const node = (id, pos, floor) => { nav.nodes.set(id, { id, pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z), floor }); nav.adj.set(id, nav.adj.get(id) || []); };
  const link = (a, b) => { nav.adj.get(a).push(b); nav.adj.get(b).push(a); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // group rooms by floor preserving order
  const byFloor = {};
  for (const r of LAYOUT.rooms) (byFloor[r.floor] ||= []).push(r);

  for (let f = 0; f < floors; f++) {
    const yBottom = f * FH;
    const yFloor = yBottom + 0.1;

    // structural slab (with a lighter top surface) + interior walls
    add(box(W + 0.5, 0.22, D + 0.5, PALETTE.slabBottom), 0, yBottom - 0.02, 0);
    add(box(W + 0.4, 0.04, D + 0.4, PALETTE.slabTop), 0, yBottom + 0.1, 0);
    add(box(W + 0.4, FH * 0.94, 0.18, PALETTE.backWall), 0, yBottom + FH * 0.47, -D / 2 - 0.09);
    add(box(0.18, FH * 0.94, D + 0.4, PALETTE.sideWall), -W / 2 - 0.09, yBottom + FH * 0.47, 0);
    add(box(0.18, FH * 0.94, D + 0.4, PALETTE.sideWall),  W / 2 + 0.09, yBottom + FH * 0.47, 0);
    // thin front fascia beam (frames the cutaway without hiding the room)
    add(box(W + 0.4, 0.16, 0.12, PALETTE.fascia), 0, yBottom + 0.02, D / 2 + 0.14);
    // ceiling light strip — reads as office lighting, adds warmth without washing out
    add(box(roomsAreaW * 0.8, 0.05, 0.3, emis(PALETTE.ceilGlow, 0.5)), -SW / 2, yBottom + FH * 0.9, 1.2);

    // circulation core (right) — treads read as a stair
    add(box(SW, 0.14, D * 0.9, PALETTE.core), coreX, yFloor, 0);
    for (let s = 0; s < 5; s++) add(box(SW * 0.82, 0.08, 0.5, PALETTE.coreTread), coreX, yBottom + 0.2 + s * (FH / 6), -D * 0.28 + s * 0.42);
    add(box(0.06, FH * 0.5, D * 0.9, emis(PALETTE.rail, 0.25)), coreX - SW * 0.42, yBottom + FH * 0.3, 0); // glass stair rail
    node(`stair:${f}`, V(coreX, yFloor, 0), f);
    if (f > 0) link(`stair:${f}`, `stair:${f - 1}`);

    const list = byFloor[f] || [];
    const rw = roomsAreaW / list.length;
    list.forEach((r, i) => {
      const x0 = -W / 2 + i * rw;
      const cx = x0 + rw / 2;

      // room floor finish (pickable) — solid, lighter than walls so rooms feel lit
      const padColor = PALETTE.floor[r.type] || PALETTE.floor.office;
      const pad = box(rw - 0.24, 0.07, D - 0.4, padColor);
      pad.position.set(cx, yFloor + 0.055, 0);
      pad.userData = { kind: 'room', roomId: r.id };
      group.add(pad); pickables.push(pad);

      // low glass partition between rooms on this floor (doesn't hide people)
      if (i < list.length - 1) {
        add(box(0.1, FH * 0.5, D * 0.8, emis(0x3a4f7a, 0.12, { transparent: true, opacity: 0.5 })), x0 + rw, yBottom + FH * 0.3, 0);
        add(box(0.12, 0.06, D * 0.8, emis(PALETTE.rail, 0.3)), x0 + rw, yBottom + FH * 0.56, 0); // lit top rail
      }

      rooms.set(r.id, { id: r.id, type: r.type, floor: f, center: V(cx, yFloor, 0), width: rw, pad });
      node(`room:${r.id}`, V(cx, yFloor + 0.05, 0.9), f);
      link(`room:${r.id}`, `stair:${f}`);

      furnish(r, cx, yFloor, rw);
    });

    for (let i = 0; i < list.length - 1; i++) link(`room:${list[i].id}`, `room:${list[i + 1].id}`);
  }

  // entrance (outside the lobby, front) + glass doors
  const lobby = rooms.get('lobby');
  node('entrance', V(lobby.center.x, 0.15, D / 2 + 2.2), 0);
  link('entrance', 'room:lobby');
  anchors.entrance = V(lobby.center.x, 0.15, D / 2 + 1.0);
  add(box(2.6, 2.2, 0.08, emis(0x4a6fa0, 0.14, { transparent: true, opacity: 0.4 })), lobby.center.x, 1.2, D / 2 + 0.2);

  // named anchors for product props
  anchors.AF = V(lobby.center.x, 0.15, D / 2 - 0.6);
  anchors.IAG = rooms.get('egress').center.clone();
  anchors.XDR = rooms.get('soc').center.clone();
  anchors.ASTOR = rooms.get('server').center.clone();
  anchors.MDR = V(-W / 2 - 6, (floors - 1) * FH * 0.6, 3.5);
  anchors.NDR = [];
  for (let f = 0; f < floors; f++) anchors.NDR.push(V(coreX, f * FH + 0.4, 0));

  // ---------------- furniture kit ----------------
  function officeChair(x, y, z, facing = 0) {
    const g = new THREE.Group();
    g.add(box(0.42, 0.08, 0.42, PALETTE.chair));                          // seat
    const back = box(0.42, 0.42, 0.08, PALETTE.chair); back.position.set(0, 0.25, -0.17); g.add(back);
    const post = cyl(0.04, 0.05, 0.3, PALETTE.deskLeg); post.position.y = -0.17; g.add(post);
    const base = cyl(0.2, 0.2, 0.04, PALETTE.deskLeg); base.position.y = -0.32; g.add(base);
    g.position.set(x, y + 0.42, z); g.rotation.y = facing; group.add(g); return g;
  }
  function workstation(x, y, z, idTag, roomId) {
    // desk with legs, a monitor whose screen glows, keyboard — a readable workstation
    const top = box(1.0, 0.07, 0.62, PALETTE.deskTop); top.position.set(x, y + 0.5, z);
    top.userData = { kind: 'desk', deskId: idTag, roomId }; group.add(top); pickables.push(top);
    for (const sx of [-0.42, 0.42]) { add(box(0.07, 0.5, 0.07, PALETTE.deskLeg), x + sx, y + 0.25, z - 0.22); add(box(0.07, 0.5, 0.07, PALETTE.deskLeg), x + sx, y + 0.25, z + 0.22); }
    const stand = box(0.08, 0.16, 0.08, PALETTE.metal); stand.position.set(x, y + 0.6, z - 0.16); group.add(stand);
    const bezel = box(0.62, 0.4, 0.05, PALETTE.monitor); bezel.position.set(x, y + 0.82, z - 0.18); group.add(bezel);
    const screen = box(0.54, 0.32, 0.02, emis(PALETTE.screenOn, 0.6)); screen.position.set(x, y + 0.82, z - 0.155); group.add(screen);
    add(box(0.42, 0.03, 0.16, PALETTE.metal), x, y + 0.545, z + 0.12); // keyboard
    officeChair(x, y, z + 0.62, Math.PI);
    desks.set(idTag, { id: idTag, roomId, pos: V(x, y + 0.75, z), deskMesh: top, screen });
    node(`desk:${idTag}`, V(x, y + 0.05, z + 0.95), rooms.get(roomId)?.floor ?? 0); link(`desk:${idTag}`, `room:${roomId}`);
  }
  function plant(x, y, z) {
    const g = new THREE.Group();
    g.add(cyl(0.16, 0.2, 0.3, PALETTE.plantPot));
    const l1 = box(0.4, 0.5, 0.4, PALETTE.leaf); l1.position.y = 0.42; g.add(l1);
    const l2 = box(0.28, 0.3, 0.28, PALETTE.leaf); l2.position.set(0.06, 0.72, 0); g.add(l2);
    g.position.set(x, y + 0.15, z); group.add(g); return g;
  }
  function cabinet(x, y, z) {
    const c = box(0.7, 1.0, 0.5, PALETTE.cabinet); c.position.set(x, y + 0.5, z); group.add(c);
    for (let k = 0; k < 3; k++) add(box(0.5, 0.04, 0.02, PALETTE.metal), x, y + 0.25 + k * 0.3, z + 0.26);
  }

  function furnish(r, cx, yFloor, rw) {
    if (r.desks) {
      const n = r.desks, spacing = Math.min(1.9, (rw - 1.4) / n);
      const startX = cx - (spacing * (n - 1)) / 2;
      for (let k = 0; k < n; k++) workstation(startX + k * spacing, yFloor, 1.1, `${r.id}#${k + 1}`, r.id);
      plant(cx + rw / 2 - 0.7, yFloor, -2.8);
      if (r.type === 'office') cabinet(cx - rw / 2 + 0.7, yFloor, -3.0);
    }
    if (r.type === 'lobby') {
      // curved-ish reception counter, waiting sofa, rug, plants, warm light
      const counter = box(2.6, 0.95, 0.7, PALETTE.wood); counter.position.set(cx, yFloor + 0.48, -0.6); group.add(counter);
      add(box(2.8, 0.06, 0.9, PALETTE.deskTop), cx, yFloor + 0.97, -0.6);
      add(box(2.0, 0.02, 1.4, PALETTE.rug), cx - 0.2, yFloor + 0.1, 1.8);
      const sofa = box(1.8, 0.4, 0.6, PALETTE.sofa); sofa.position.set(cx - 0.2, yFloor + 0.3, 2.4); group.add(sofa);
      add(box(1.8, 0.4, 0.2, PALETTE.sofa), cx - 0.2, yFloor + 0.5, 2.7);
      officeChair(cx, yFloor, -1.3, 0);
      plant(cx - rw / 2 + 0.6, yFloor, 1.8); plant(cx + rw / 2 - 0.6, yFloor, 1.8);
      addLight(cx, yFloor + FH * 0.75, 0.5, 0xffd9a8, 0.7, 8);
    }
    if (r.type === 'meeting') {
      const table = box(2.4, 0.1, 1.1, PALETTE.wood); table.position.set(cx, yFloor + 0.55, 0.2); group.add(table);
      add(cyl(0.12, 0.12, 0.55, PALETTE.deskLeg), cx, yFloor + 0.27, 0.2);
      for (const dz of [-0.45, 0.85]) for (const dx of [-0.8, 0, 0.8]) officeChair(cx + dx, yFloor, 0.2 + dz, dz < 0 ? 0 : Math.PI);
      const wall = box(1.8, 1.0, 0.06, PALETTE.monitor); wall.position.set(cx, yFloor + 1.4, -D / 2 + 0.4); group.add(wall);
      add(box(1.66, 0.86, 0.02, emis(PALETTE.screenOn, 0.45)), cx, yFloor + 1.4, -D / 2 + 0.44);
      plant(cx + rw / 2 - 0.6, yFloor, 2.6);
    }
    if (r.type === 'command') {
      // security office: a curved console + a wall of monitors (video wall)
      const desk = box(2.2, 0.75, 0.7, PALETTE.deskTop); desk.position.set(cx, yFloor + 0.38, 0.9); group.add(desk);
      officeChair(cx, yFloor, 1.8, Math.PI);
      for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) {
        const col = (r2 + c2) % 2 ? 0x6a7bff : PALETTE.screenOn;
        add(box(0.62, 0.42, 0.04, emis(col, 0.5)), cx - 0.8 + c2 * 0.8, yFloor + 1.15 + r2 * 0.5, -D / 2 + 0.35);
      }
      addLight(cx, yFloor + FH * 0.75, 0.5, 0x8a7bff, 0.55, 7);
    }
    if (r.type === 'egress') {
      // mailroom: shelving with parcels + an exit door
      for (let s = 0; s < 3; s++) add(box(1.8, 0.06, 0.5, PALETTE.metal), cx, yFloor + 0.4 + s * 0.4, -D / 2 + 0.5);
      for (let p = 0; p < 4; p++) add(box(0.3, 0.26, 0.3, [0xb08a5a, 0x8a95a8, 0xc48a6a, 0x9aa06a][p]), cx - 0.7 + p * 0.45, yFloor + 0.55 + (p % 2) * 0.4, -D / 2 + 0.5);
      add(box(0.9, 1.8, 0.08, PALETTE.metal), cx + rw / 2 - 0.7, yFloor + 0.9, 2.2); // exit door
      add(box(0.12, 0.12, 0.3, emis(0x46e0a0, 0.8)), cx + rw / 2 - 0.7, yFloor + 1.95, 2.2); // EXIT light
    }
    if (r.type === 'server') {
      const rackMat = mat(PALETTE.rack, { metalness: 0.2, roughness: 0.6 });
      let firstRack = null;
      for (let k = 0; k < 5; k++) {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.75), rackMat);
        add(rack, cx - 1.6 + k * 0.8, yFloor + 0.75, -0.7);
        if (k === 0) firstRack = rack;
        for (let L = 0; L < 5; L++) add(box(0.34, 0.05, 0.02, emis(PALETTE.rackLight, 0.9)), cx - 1.6 + k * 0.8, yFloor + 0.35 + L * 0.26, -0.31);
      }
      add(box(rw - 0.6, 0.03, D - 0.9, emis(0x2a6fff, 0.08)), cx, yFloor + 0.12, 0.6); // cool raised-floor glow
      firstRack.userData = { kind: 'desk', deskId: 'server#core', roomId: 'server' };
      pickables.push(firstRack);
      desks.set('server#core', { id: 'server#core', roomId: 'server', pos: V(cx - 1.6, yFloor + 0.9, -0.7), deskMesh: firstRack });
      node('desk:server#core', V(cx - 1.6, yFloor + 0.05, 0.4), r.floor); link('desk:server#core', 'room:server');
      addLight(cx, yFloor + FH * 0.75, 0.3, 0x3fb0ff, 0.7, 8);
    }
    if (r.type === 'vault') {
      const plinth = cyl(1.0, 1.1, 0.22, PALETTE.vaultPlinth, 8); add(plinth, cx, yFloor + 0.11, 0);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0),
        new THREE.MeshStandardMaterial({ color: PALETTE.vaultCore, emissive: PALETTE.vaultCore, emissiveIntensity: 0.8, flatShading: true, roughness: 0.3 }));
      core.position.set(cx, yFloor + 1.05, 0); core.userData = { kind: 'desk', deskId: 'vault#core', roomId: 'vault' };
      group.add(core); pickables.push(core);
      // low protective railing around the vault
      for (const [dx, dz, rot] of [[0, 1.3, 0], [0, -1.3, 0], [1.3, 0, Math.PI / 2], [-1.3, 0, Math.PI / 2]]) {
        const bar = box(2.3, 0.05, 0.05, emis(0xffb24b, 0.4)); bar.position.set(cx + dx, yFloor + 0.75, dz); bar.rotation.y = rot; group.add(bar);
      }
      desks.set('vault#core', { id: 'vault#core', roomId: 'vault', pos: V(cx, yFloor + 1.05, 0), coreMesh: core });
      node('desk:vault#core', V(cx, yFloor + 0.05, 1.2), r.floor); link('desk:vault#core', 'room:vault');
      addLight(cx, yFloor + FH * 0.7, 0.4, 0xffcf6e, 0.9, 9);
    }
  }
  function addLight(x, y, z, color, intensity, dist) { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z); group.add(l); lights.push(l); }

  return { group, rooms, desks, pickables, anchors, nav, lights, dims: { W, D, FH, floors, coreX } };
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
