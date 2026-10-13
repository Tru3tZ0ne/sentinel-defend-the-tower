// Builds the low-poly cutaway tower from LAYOUT and exposes anchors + a nav graph.
// The front wall (+Z) is omitted so the camera sees inside every room.

const PALETTE = {
  slab: 0x273253, backWall: 0x1b2442, sideWall: 0x202b4d, partition: 0x2d3a63,
  core: 0x1e2746, ramp: 0x33406a,
  roomFloor: { lobby: 0x33506f, command: 0x392f5c, egress: 0x2c5159, office: 0x2e4068,
               meeting: 0x304a63, server: 0x412e4d, vault: 0x4d386a },
  desk: 0x3a4a70, screen: 0x39c0ff, chair: 0x2a3454,
  rack: 0x2b3860, rackLight: 0x39e08a, vaultCore: 0xffd166,
};

export function buildBuilding(THREE, LAYOUT) {
  const group = new THREE.Group();
  const { floors, floorHeight: FH, width: W, depth: D, stairWidth: SW } = LAYOUT;
  const roomsAreaW = W - SW;
  const coreX = W / 2 - SW / 2;

  const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0.05, ...opts });
  const box = (w, h, d, color, opts) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  const add = (mesh, x, y, z, parent = group) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

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

    // floor slab + structure
    add(box(W + 0.4, 0.2, D + 0.4, PALETTE.slab), 0, yBottom, 0);
    add(box(W + 0.4, FH * 0.92, 0.2, PALETTE.backWall), 0, yBottom + FH * 0.46, -D / 2 - 0.1);
    add(box(0.2, FH * 0.92, D + 0.4, PALETTE.sideWall), -W / 2 - 0.1, yBottom + FH * 0.46, 0);
    add(box(0.2, FH * 0.92, D + 0.4, PALETTE.sideWall),  W / 2 + 0.1, yBottom + FH * 0.46, 0);

    // circulation core (right)
    add(box(SW, 0.15, D * 0.9, PALETTE.core), coreX, yFloor, 0);
    // ramp up to next floor
    if (f < floors - 1) {
      const ramp = box(SW * 0.7, 0.15, FH * 1.25, PALETTE.ramp);
      ramp.rotation.x = -Math.atan2(FH, FH * 1.1);
      add(ramp, coreX, yBottom + FH / 2, 0.2);
    }
    node(`stair:${f}`, V(coreX, yFloor, 0), f);
    if (f > 0) link(`stair:${f}`, `stair:${f - 1}`);

    const list = byFloor[f] || [];
    const rw = roomsAreaW / list.length;
    list.forEach((r, i) => {
      const x0 = -W / 2 + i * rw;
      const cx = x0 + rw / 2;
      const cz = 0;

      // room floor pad (pickable)
      const padColor = PALETTE.roomFloor[r.type] || PALETTE.roomFloor.office;
      const pad = box(rw - 0.3, 0.08, D - 0.5, padColor);
      pad.position.set(cx, yFloor + 0.02, cz);
      pad.userData = { kind: 'room', roomId: r.id };
      group.add(pad); pickables.push(pad);

      // partition wall on the right edge (except last before core)
      if (i < list.length - 1) add(box(0.14, FH * 0.8, D * 0.82, PALETTE.partition), x0 + rw, yBottom + FH * 0.42, 0);

      rooms.set(r.id, { id: r.id, type: r.type, floor: f, center: V(cx, yFloor, cz), width: rw, pad });

      // nav node for the room, linked to the floor's stair
      node(`room:${r.id}`, V(cx, yFloor + 0.05, 0.8), f);
      link(`room:${r.id}`, `stair:${f}`);

      // furnish
      furnish(r, cx, yFloor, rw, D);
    });

    // connect rooms on the same floor to each other (adjacent)
    for (let i = 0; i < list.length - 1; i++) link(`room:${list[i].id}`, `room:${list[i + 1].id}`);
  }

  // entrance node (outside the lobby, front)
  const lobby = rooms.get('lobby');
  node('entrance', V(lobby.center.x, 0.15, D / 2 + 2.2), 0);
  link('entrance', 'room:lobby');
  anchors.entrance = V(lobby.center.x, 0.15, D / 2 + 1.0);

  // named anchors for product props
  anchors.AF = V(lobby.center.x, 0.15, D / 2 - 0.6);
  anchors.IAG = rooms.get('egress').center.clone();
  anchors.XDR = rooms.get('soc').center.clone();
  anchors.ASTOR = rooms.get('server').center.clone();
  anchors.MDR = V(-W / 2 - 6, (floors - 1) * FH * 0.6, 3.5);
  anchors.NDR = [];                      // populated with per-floor sensor points
  for (let f = 0; f < floors; f++) anchors.NDR.push(V(coreX, f * FH + 0.4, 0));

  function furnish(r, cx, yFloor, rw, D) {
    if (r.desks) {
      const n = r.desks, spacing = Math.min(1.8, (rw - 1.2) / n);
      const startX = cx - (spacing * (n - 1)) / 2;
      for (let k = 0; k < n; k++) {
        const dx = startX + k * spacing, dz = 1.3;
        const desk = box(0.9, 0.08, 0.6, PALETTE.desk); add(desk, dx, yFloor + 0.45, dz);
        add(box(0.1, 0.45, 0.1, PALETTE.desk), dx - 0.35, yFloor + 0.22, dz);
        add(box(0.1, 0.45, 0.1, PALETTE.desk), dx + 0.35, yFloor + 0.22, dz);
        const screen = box(0.55, 0.34, 0.04, PALETTE.screen, { emissive: PALETTE.screen, emissiveIntensity: 0.6 });
        screen.position.set(dx, yFloor + 0.72, dz - 0.18); group.add(screen);
        add(box(0.4, 0.1, 0.4, PALETTE.chair), dx, yFloor + 0.25, dz + 0.55);
        const id = `${r.id}#${k + 1}`;
        desk.userData = { kind: 'desk', deskId: id, roomId: r.id };
        pickables.push(desk);
        desks.set(id, { id, roomId: r.id, pos: V(dx, yFloor + 0.75, dz), deskMesh: desk, screen });
        node(`desk:${id}`, V(dx, yFloor + 0.05, dz + 0.9), r.floor); link(`desk:${id}`, `room:${r.id}`);
      }
    }
    if (r.type === 'server') {
      let firstRack = null;
      for (let k = 0; k < 4; k++) {
        const rack = box(0.5, 1.4, 0.7, PALETTE.rack);
        add(rack, cx - 1.3 + k * 0.85, yFloor + 0.7, -0.6);
        if (k === 0) firstRack = rack;
        for (let L = 0; L < 4; L++) {
          const lamp = box(0.3, 0.05, 0.02, PALETTE.rackLight, { emissive: PALETTE.rackLight, emissiveIntensity: 0.8 });
          lamp.position.set(cx - 1.3 + k * 0.85, yFloor + 0.35 + L * 0.3, -0.26); group.add(lamp);
        }
      }
      firstRack.userData = { kind: 'desk', deskId: 'server#core', roomId: 'server' };
      pickables.push(firstRack);
      desks.set('server#core', { id: 'server#core', roomId: 'server', pos: V(cx - 1.3, yFloor + 0.9, -0.6), deskMesh: firstRack });
    }
    if (r.type === 'vault') {
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0),
        new THREE.MeshStandardMaterial({ color: PALETTE.vaultCore, emissive: PALETTE.vaultCore, emissiveIntensity: 0.7, flatShading: true }));
      core.position.set(cx, yFloor + 1.0, 0); core.userData = { kind: 'desk', deskId: 'vault#core', roomId: 'vault' };
      group.add(core); pickables.push(core);
      add(box(1.6, 0.1, 1.6, 0x4a356a), cx, yFloor + 0.08, 0);
      desks.set('vault#core', { id: 'vault#core', roomId: 'vault', pos: V(cx, yFloor + 1.0, 0), coreMesh: core });
    }
    if (r.type === 'lobby') add(box(1.6, 0.5, 0.5, PALETTE.desk), cx, yFloor + 0.3, 1.6); // reception desk
    if (r.type === 'command') add(box(1.4, 0.4, 0.7, 0x3a2f5c), cx, yFloor + 0.3, 1.2);   // SOC console base
  }

  return { group, rooms, desks, pickables, anchors, nav, dims: { W, D, FH, floors, coreX } };
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
