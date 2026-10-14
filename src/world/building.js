// Multi-level building generator. Builds each LAYOUT level into its own group, stacked in Y,
// with a shared nav graph linked by an internal stairwell. Only one level is shown at a time
// (the floor selector in main.js toggles level groups + moves the camera), so fog-of-war now
// has a spatial dimension: the intruder can slip to a floor you're not watching.
// Exposes: rooms, desks, pickables, anchors, nav graph, lights, signs, floors, levels.
//
// Performance: static, non-interactive detail (walls, trims, racks, LEDs, legs, drawers,
// chairs, plant pots/stems) shares cached materials and is merged per level into a few
// batched meshes (one draw call per material/shadow-flag bucket). Pickable and runtime-mutated
// meshes (room pads, desk tops, server/vault cores, desk screens) keep their own materials and
// are never merged, so picking, highlighting and the EDR "guarded screen" tint stay per-object.
import { loc } from '../i18n.js';
import { mergeGeometries } from '../vendor/three/BufferGeometryUtils.js';

const P = {
  floor: 0xaaa69a, floorLine: 0xa8865a, corridor: 0xa3acb0, rug: { office: 0x65717a, meeting: 0x7e8783, lobby: 0xaaa391, command: 0x586b79, server: 0x79858a, vault: 0x7c898e, egress: 0x8b9087 },
  wall: 0x89949d, wallBack: 0x687785, trim: 0x293c4c,
  glass: 0x8ebed1, glassFrame: 0x314c60,
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

  // Cache identical static materials so repeated detail can share one material and merge.
  // Skip caching when options carry a non-serializable value (e.g. a texture map): those
  // materials (textured floors/rugs) are few and large, not the draw-call problem.
  const matCache = new Map();
  const serializable = o => Object.values(o).every(v => v == null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string');
  const matMk = (color, o = {}) => {
    if (!serializable(o)) return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.0, ...o });
    const key = 'm|' + color + '|' + JSON.stringify(o);
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.0, ...o }); matCache.set(key, m); }
    return m;
  };
  const glassMat = () => new THREE.MeshStandardMaterial({ color: P.glass, transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0.1 });
  const emis = (color, i = 0.9, o = {}) => {
    if (o && !serializable(o)) return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.5, ...o });
    const key = 'e|' + color + '|' + i + '|' + JSON.stringify(o || {});
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.5, ...(o || {}) }); matCache.set(key, m); }
    return m;
  };
  const mesh = (g, m, cast = true, recv = true) => { const x = new THREE.Mesh(g, m.isMaterial ? m : matMk(m)); x.castShadow = cast; x.receiveShadow = recv; return x; };
  const box = (w, h, d, m, cast, recv) => mesh(new THREE.BoxGeometry(w, h, d), m, cast, recv);
  const cyl = (rt, rb, h, m, seg = 12, cast = true) => { const x = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m.isMaterial ? m : matMk(m)); x.castShadow = cast; x.receiveShadow = true; return x; };
  const mat = matMk;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const YUP = new THREE.Vector3(0, 1, 0);
  const ROOM_LIGHT = { office: [0xffe2af, 12], meeting: [0xffe9c3, 12], lobby: [0xffdca4, 14], command: [0xbce2f9, 10], server: [0x9ad4ff, 10], vault: [0xffe5b0, 12], egress: [0xffe4be, 10] };

  // Small deterministic surface maps add scale without external assets or loading requests.
  function surface(kind, repeatX = 1, repeatY = 1) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = kind === 'carpet' ? '#c0c4c6' : kind === 'wood' ? '#c4b6a1' : '#c7c9c7'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const x = (i * 73) % 256, y = (i * 149 + Math.floor(i / 256) * 17) % 256;
      ctx.fillStyle = i % 2 ? '#ffffff12' : '#00000012';
      ctx.fillRect(x, y, kind === 'wood' ? 1 : 2, kind === 'wood' ? 70 : 2);
    }
    if (kind === 'tile') { ctx.strokeStyle = '#777f83'; ctx.lineWidth = 1; ctx.strokeRect(.5,.5,255,255); }
    if (kind === 'carpet') { ctx.strokeStyle = '#a4aaad'; ctx.strokeRect(0,0,128,128); ctx.strokeRect(128,128,128,128); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeatX,repeatY); tex.anisotropy = 8; return tex;
  }
  const tileMap = surface('tile', FW / 1.3, FD / 1.3), carpetMap = surface('carpet',4,3), woodMap = surface('wood',3,1);
  const foliageGeometry = new THREE.SphereGeometry(1,8,5), foliageMaterial = mat(0xffffff);

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
    add(plane, x, y, z); plane.visible = false; signs.push({ canvas, tex, r });
    add(box(0.05, 0.05, 0.05, mat(P.metal)), x, y, z - 0.03);
  }

  // ---------- walls ----------
  const wallMat = mat(P.wall), backMat = mat(P.wallBack), trimMat = mat(P.trim);
  function segX(xA, xB, z, h, th, m = wallMat, trim = true) { const len = Math.abs(xB - xA); if (len < 0.01) return; const c = (xA + xB) / 2; add(box(len, h, th, m), c, h / 2, z); if (trim) add(box(len + 0.02, 0.07, th + 0.05, trimMat, false), c, h, z); }
  function segZ(zA, zB, x, h, th, m = wallMat, trim = true) { const len = Math.abs(zB - zA); if (len < 0.01) return; const c = (zA + zB) / 2; add(box(th, h, len, m), x, h / 2, c); if (trim) add(box(th + 0.05, 0.07, len + 0.02, trimMat, false), x, h, c); }
  function glassWallX(z, doors, dw = 1.9) {
    for (const [a, b] of gaps(B.x0, B.x1, doors, dw)) { const len = Math.abs(b - a), c = (a + b) / 2; add(box(len, 0.35, 0.1, mat(P.glassFrame)), c, 0.175, z); add(box(len, WH - 0.5, 0.06, glassMat(), false, false), c, (WH + 0.35) / 2 + 0.05, z); add(box(len, 0.07, 0.1, mat(P.glassFrame), false), c, WH, z); }
    for (const dx of doors) { add(box(0.1, WH, 0.12, mat(P.glassFrame)), dx - dw / 2, WH / 2, z); add(box(0.1, WH, 0.12, mat(P.glassFrame)), dx + dw / 2, WH / 2, z); }
    for (const [a,b] of gaps(B.x0,B.x1,doors,dw)) for (let x=a+1.1;x<b-.2;x+=1.4) add(box(.045,WH,.09,mat(P.glassFrame)),x,WH/2,z);
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
    top.material = top.material.clone();   // pickable: unique material so the placement highlight is per-desk
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.26, 0.26]) { const l = box(0.06, 0.5, 0.06, mat(P.deskLeg)); l.position.set(sx, 0.25, sz); g.add(l); }
    g.add(place(box(0.07, 0.17, 0.07, mat(P.metal)), 0, 0.6, -0.18));
    g.add(place(box(0.66, 0.42, 0.05, mat(P.monitor)), 0, 0.84, -0.2));
    const screen = place(box(0.58, 0.34, 0.02, emis(P.screenOn, 0.55), false), 0, 0.84, -0.17); g.add(screen);
    screen.material = screen.material.clone();   // mutated by EDR deploy (guarded tint) — keep per-desk
    g.add(place(box(0.44, 0.03, 0.17, mat(P.metal)), 0, 0.545, 0.05));
    g.add(place(box(.14,.025,.19,mat(0x253441)),.39,.55,.08));
    g.add(place(box(.2,.012,.27,mat(0xd7d5cf)), -.4,.55,.12));
    const mug = cyl(.055,.05,.13,mat(0xc7b496),12); mug.position.set(.44,.6,-.16); g.add(mug);
    const divider = box(1.12,.28,.025,mat(0x5b6d78)); divider.position.set(0,.66,-.34); g.add(divider);
    const seat = new THREE.Vector3(0, 0, 0.58).applyAxisAngle(YUP, facing).add(new THREE.Vector3(x, 0, z));
    desks.set(id, { id, roomId, pos: V(x, 0.75 + curY, z), deskMesh: top, screen });
    node(`desk:${id}`, V(seat.x, 0.05, seat.z)); link(`desk:${id}`, `room:${roomId}`);
    chair(seat.x, seat.z, facing + Math.PI);
  }
  function plant(x, z, big = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); curGroup.add(g);
    g.add(place(cyl(big ? 0.22 : 0.16, big ? 0.26 : 0.2, big ? 0.4 : 0.3, mat(P.pot)), 0, big ? 0.2 : 0.15, 0));
    const height = big ? 1.1 : .78;
    g.add(place(cyl(.025,.035,height,mat(0x534c38),7),0,height/2+.22,0));
    const leaves = new THREE.InstancedMesh(foliageGeometry,foliageMaterial,11); leaves.castShadow = true;
    const leaf = new THREE.Object3D();
    for (let i=0;i<11;i++) {
      const a=i*2.4, y=.4+i*height/13, spread=.2+(i%3)*.06;
      leaf.scale.set(big ? .13:.09,.035,big ? .35:.25); leaf.rotation.set(.25,a,.4);
      leaf.position.set(Math.sin(a)*spread,y,Math.cos(a)*spread); leaf.updateMatrix();
      leaves.setMatrixAt(i,leaf.matrix); leaves.setColorAt(i,new THREE.Color(i%2 ? 0x3e704d : 0x597c4f));
    }
    g.add(leaves);
  }
  function ceilingStrips(cx, cz, rw) {
    const wallZ = cz < 0 ? B.z0 + .16 : B.z1 - .16;
    add(box(rw-.6,.04,.06,emis(0xffdb9a,1.2),false,false),cx,.3,wallZ);
  }
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
      add(box(rw - 1.2, 0.03, rd - 1.4, mat(0x7e8b8f, { roughness: 0.72 }), false), cx, 0.07, cz);
      let first = null;
      for (let k = 0; k < 5; k++) {
        const rack = box(0.6, 1.5, 0.8, mat(P.rack, { metalness: 0.3, roughness: 0.5 })); add(rack, r.rect.x0 + 1.0 + k * 0.95, 0.75, r.rect.z0 + 1.1); if (!first) { first = rack; first.material = first.material.clone(); } // pickable core: unique material
        const rx = r.rect.x0 + 1.0 + k * .95, rz = r.rect.z0 + 1.51;
        for (let L=0;L<8;L++) {
          add(box(.5,.115,.03,mat(0x1c2933,{metalness:.5})),rx,.14+L*.17,rz);
          for (let d=0;d<3;d++) add(box(.018,.018,.035,emis(d===0 ? 0x3bc3f5 : 0x64be86,.7),false,false),rx+.16+d*.04,.14+L*.17,rz+.025);
          add(box(.22,.02,.035,mat(0x566778)),rx-.08,.14+L*.17,rz+.025);
        }
      }
      if (r.id === 'server') {   // the L3 server room holds the ransomware-target host
        first.userData = { kind: 'desk', deskId: 'server#core', roomId: 'server' }; pickables.push(first);
        desks.set('server#core', { id: 'server#core', roomId: 'server', pos: V(r.rect.x0 + 1.0, 0.9 + curY, r.rect.z0 + 1.1), deskMesh: first });
        node('desk:server#core', V(r.rect.x0 + 1.0, 0.05, C.z0 - 1.2)); link('desk:server#core', 'room:server');
      }
    } else if (r.type === 'vault') {
      // Protected business records live in recognizable storage cabinets.
      const core = box(0.85, 1.8, 1.0, mat(0x303b42, { metalness: 0.45, roughness: 0.4 }));
      add(core, cx - 0.55, 0.9, cz); core.userData = { kind: 'desk', deskId: 'vault#core', roomId: 'vault' }; pickables.push(core);
      core.material = core.material.clone();   // pickable core: unique material
      add(box(0.85, 1.8, 1.0, mat(0x303b42, { metalness: 0.45, roughness: 0.4 })), cx + 0.55, 0.9, cz);
      for (const dx of [-0.55, 0.55]) for (let row = 0; row < 8; row++) {
        add(box(0.7, 0.15, 0.035, mat(0x55616a, { metalness: 0.5 })), cx + dx, 0.2 + row * 0.2, cz + 0.52);
        add(box(0.035, 0.035, 0.04, emis(0x7cba87, 0.25), false), cx + dx + 0.25, 0.2 + row * 0.2, cz + 0.55);
      }
      desks.set('vault#core', { id: 'vault#core', roomId: 'vault', pos: V(cx - 0.55, 0.9 + curY, cz), coreMesh: core });
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
    add(box(FW, 0.1, FD, mat(P.floor, { map: tileMap, roughness: 0.38, metalness: .12 }), false, true), MX, 0.0, MZ);
    add(box(FW, 0.02, C.z1 - C.z0, mat(P.corridor, { map: tileMap, roughness: 0.26, metalness: .18 })), MX, 0.055, (C.z0 + C.z1) / 2).receiveShadow = true;
    for (const z of [C.z0+.12,C.z1-.12]) add(box(FW,.025,.04,emis(0xffd49a,.8),false,false),MX,.105,z);
    for (let x=B.x0+1;x<B.x1;x+=3) { plant(x,C.z0+.48); plant(x+.5,C.z1-.48); }
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
      const pad = new THREE.Mesh(new THREE.BoxGeometry(rw - 0.3, 0.06, rd - 0.3), new THREE.MeshStandardMaterial({ color: 0x578c5f, emissive: 0x578c5f, emissiveIntensity: 0, transparent: true, opacity: 0, depthWrite: false }));
      pad.position.set(rcx, 0.08, rcz); pad.userData = { kind: 'room', roomId: r.id }; curGroup.add(pad); pickables.push(pad); rooms.get(r.id).pad = pad;
      add(box(rw - 1.4, 0.015, rd - 1.6, mat(P.rug[r.type] || P.rug.office, { map: r.type === 'lobby' ? woodMap : carpetMap, roughness: 0.9 }), false), rcx, 0.062, rcz);
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

  // ---------- static batching ----------
  // Merge a level's static, opaque, non-interactive meshes into one mesh per
  // (material, shadow-flags) bucket. Pickables, runtime-mutated meshes, textured/transparent
  // materials, instanced meshes and the basic-material signs/logos are left untouched.
  function mergeLevelStatics(lg) {
    lg.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(lg.matrixWorld).invert();
    const pickSet = new Set(pickables);
    const screenSet = new Set([...desks.values()].map(d => d.screen).filter(Boolean));
    const buckets = new Map();
    lg.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh) return;
      if (pickSet.has(o) || screenSet.has(o)) return;
      if (o.userData && o.userData.kind) return;                 // any tagged entity stays pickable/separate
      const m = o.material;
      if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent) return;  // skip basic/textured/glass
      const g = o.geometry;
      if (!g || !g.isBufferGeometry || !g.index || !g.getAttribute('uv') || !g.getAttribute('normal')) return;
      const key = m.uuid + '|' + (o.castShadow ? 1 : 0) + '|' + (o.receiveShadow ? 1 : 0);
      let b = buckets.get(key);
      if (!b) { b = { material: m, cast: o.castShadow, recv: o.receiveShadow, items: [] }; buckets.set(key, b); }
      b.items.push(o);
    });
    for (const b of buckets.values()) {
      if (b.items.length < 2) continue;                          // a lone mesh is already one draw call
      const geoms = b.items.map(o => { const cg = o.geometry.clone(); cg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); return cg; });
      const merged = mergeGeometries(geoms, false);
      geoms.forEach(g => g.dispose());
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, b.material);
      mm.castShadow = b.cast; mm.receiveShadow = b.recv; mm.userData.staticBatch = true;
      lg.add(mm);
      for (const o of b.items) { o.removeFromParent(); o.geometry.dispose(); }
    }
  }

  // ---------- build all levels ----------
  for (const level of LAYOUT.levels) {
    curLevel = level.id; curY = level.y;
    const lg = new THREE.Group(); lg.position.y = level.y; group.add(lg); curGroup = lg;
    floors.push({ id: level.id, y: level.y, group: lg, name: level.name });
    buildLevelGeometry(level);
    mergeLevelStatics(lg);
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
  anchors.MDR = V(B.x1 + 1.8, 2.4, B.z1 - 3);   // just off the building edge, so the off-site SOC beacon stays on-screen

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
