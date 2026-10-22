// 3D board for "Kill Chain": a neon circuit lane winding from the internet to the
// data core, flanked by tower pads, over a glowing grid. Pure scenery + pad geometry;
// towers / threats / shots are spawned by main-td.js. Reuses the cyber neon palette.

const RIM = 0x2f8dff, LANE = 0x123a6e, PAD = 0x39c0ff, CORE = 0xffd166, START = 0x7fe0ff, GRID = 0x16407a;

// Serpentine kill-chain path (world XZ). Threats march start → core along these waypoints.
const PATH = [
  { x: -26, z: -8 }, { x: -8, z: -8 }, { x: -8, z: -1 }, { x: 12, z: -1 },
  { x: 12, z: 6 }, { x: -4, z: 6 }, { x: -4, z: 11 }, { x: 10, z: 11 },
];
// Kill-chain stage labels, dropped near segment midpoints.
const STAGES = ['RECON', 'DELIVERY', 'EXPLOIT', 'LATERAL', 'ACTIONS', 'EXFIL'];

export function buildBoard(THREE) {
  const group = new THREE.Group();
  const emis = (c, i = 1, rough = 0.5, metal = 0.1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: rough, metalness: metal });
  const labels = [];

  // ---- grid floor ----
  const grid = new THREE.GridHelper(80, 40, GRID, 0x0c2550);
  grid.position.y = -0.06; grid.material.transparent = true; grid.material.opacity = 0.5; group.add(grid);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(46, 64), new THREE.MeshStandardMaterial({ color: 0x030a1a, roughness: 1, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; group.add(floor);
  // outer halo ring (the reference image's signature blue rim)
  const halo = new THREE.Mesh(new THREE.RingGeometry(40, 43, 80), emis(0x2b8bff, 0.6));
  halo.rotation.x = -Math.PI / 2; halo.position.y = -0.1; halo.material.side = THREE.DoubleSide; group.add(halo);

  // ---- lane ribbon: a dark matte trace with thin glowing edges ----
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x061531, emissive: 0x0a2142, emissiveIntensity: 0.25, roughness: 0.85, metalness: 0.1 });
  const edgeMat = emis(RIM, 0.5);
  const W = 2.1;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    const mk = (w, h, y, m, zoff = 0) => { const s = new THREE.Mesh(new THREE.BoxGeometry(len + W, h, w), m); const px = -Math.sin(-ang), pz = Math.cos(-ang); s.position.set((a.x + b.x) / 2 + px * zoff, y, (a.z + b.z) / 2 + pz * zoff); s.rotation.y = -ang; group.add(s); return s; };
    mk(W, 0.16, 0.0, laneMat);                 // dark matte deck
    mk(0.14, 0.09, 0.07, edgeMat, W / 2);      // glowing side rail (+)
    mk(0.14, 0.09, 0.07, edgeMat, -W / 2);     // glowing side rail (−)
    // center dashes
    const dashes = Math.max(1, Math.floor(len / 2.2));
    for (let d = 0; d < dashes; d++) {
      const t = (d + 0.5) / dashes;
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.18), emis(0x6fb0ff, 0.9));
      dash.position.set(a.x + dx * t, 0.12, a.z + dz * t); dash.rotation.y = -ang; group.add(dash);
    }
    // joint filler at each inner corner
    if (i > 0) { const j = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, W), laneMat); j.position.set(a.x, 0.0, a.z); group.add(j); }
  }

  // ---- START (internet) portal ----
  const s0 = PATH[0];
  const portal = new THREE.Group(); portal.position.set(s0.x, 0, s0.z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.22, 16, 40), emis(START, 0.9)); ring.rotation.x = Math.PI / 2; ring.position.y = 1.9; portal.add(ring);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.8, 10), emis(START, 0.7));
  const pL = post.clone(); pL.position.set(-1.9, 1.9, 0); const pR = post.clone(); pR.position.set(1.9, 1.9, 0); portal.add(pL, pR);
  portal.add(mkLight(THREE, START, 9, 10, 2.4, 0, 0));
  group.add(portal);
  labels.push(addLabel(THREE, group, '⟨ INTERNET ⟩', s0.x, 4.4, s0.z, START));

  // ---- CORE (the data being defended) ----
  const cN = PATH[PATH.length - 1];
  const core = new THREE.Group(); core.position.set(cN.x, 0, cN.z);
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 3.2, 8), emis(0x1a1206, 0.3, 0.4, 0.6)); vault.position.y = 1.6; core.add(vault);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.3, 8), emis(CORE, 0.85)); glow.position.y = 1.75; core.add(glow);
  for (let r = 0; r < 3; r++) { const tr = new THREE.Mesh(new THREE.TorusGeometry(2.5 + r * 0.14, 0.06, 10, 40), emis(CORE, 0.85)); tr.rotation.x = Math.PI / 2; tr.position.y = 0.4 + r * 1.3; core.add(tr); }
  core.add(mkLight(THREE, CORE, 9, 11, 2.6, 0, 0));
  group.add(core);
  labels.push(addLabel(THREE, group, '◆ DATA CORE ◆', cN.x, 4.9, cN.z, CORE));

  // ---- tower pads (sampled along each segment, offset to alternating sides) ----
  const slots = [], padBySlot = new Map(), pickables = [];
  let flip = 1, n = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 4) continue;
    const ux = dx / len, uz = dz / len, px = -uz, pz = ux;      // perpendicular
    const ts = len > 14 ? [0.25, 0.55, 0.82] : [0.35, 0.72];
    for (const t of ts) {
      for (const side of (len > 14 ? [flip, -flip] : [flip])) {
        const cx = a.x + dx * t + px * 3.3 * side, cz = a.z + dz * t + pz * 3.3 * side;
        // keep pads clear of the start portal / core
        if (Math.hypot(cx - s0.x, cz - s0.z) < 4 || Math.hypot(cx - cN.x, cz - cN.z) < 4.5) continue;
        const id = 'p' + (n++);
        slots.push({ id, x: cx, z: cz });
        const pad = makePad(THREE, emis, id); pad.position.set(cx, 0, cz);
        group.add(pad); padBySlot.set(id, pad); pickables.push(pad.children[0]);
      }
      flip *= -1;
    }
  }
  // a dedicated core pad (for aStor) beside the vault
  { const id = 'core'; const cx = cN.x - 3.4, cz = cN.z + 0.2; slots.push({ id, x: cx, z: cz }); const pad = makePad(THREE, emis, id, CORE); pad.position.set(cx, 0, cz); group.add(pad); padBySlot.set(id, pad); pickables.push(pad.children[0]); }

  // ---- stage labels along the lane ----
  for (let i = 0; i < Math.min(STAGES.length, PATH.length - 1); i++) {
    const a = PATH[i], b = PATH[i + 1]; const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    labels.push(addLabel(THREE, group, STAGES[i], mx, 0.6, mz - 0.0, 0x8fb6ff, 0.5));
  }

  // ---- scattered data-node scenery (non-interactive, merged-ish cheap) ----
  scatter(THREE, group, emis, PATH, [s0, cN]);

  const coreWorld = new THREE.Vector3(cN.x, 1.5, cN.z);
  function update(camera) { for (const l of labels) l.quaternion.copy(camera.quaternion); }
  return { group, path: PATH.map(p => ({ x: p.x, z: p.z })), slots, padBySlot, pickables, coreWorld, update };
}

function mkLight(THREE, color, intensity, dist, y, x = 0, z = 0) { const l = new THREE.PointLight(color, intensity, dist, 2); l.position.set(x, y, z); return l; }

function makePad(THREE, emis, id, color = PAD) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: color, emissiveIntensity: 0.14, roughness: 0.4, metalness: 0.3 }));
  base.position.y = 0.15; base.userData = { kind: 'slot', slotId: id }; g.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.055, 8, 24), emis(color, 0.5)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; g.add(rim);
  return g;
}

// Canvas-text billboard; returned mesh is kept flat-facing the camera by board.update().
function addLabel(THREE, parent, text, x, y, z, color = 0xaad0ff, scale = 0.7) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
  c.clearRect(0, 0, 256, 64);
  c.font = '700 30px -apple-system, "Segoe UI", Roboto, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#000'; c.shadowBlur = 8;
  c.fillStyle = '#' + color.toString(16).padStart(6, '0');
  c.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4 * scale, 1 * scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.set(x, y, z); parent.add(m); return m;
}

// cheap scattered server-node buildings around the board edge (reference-style density)
function scatter(THREE, group, emis, path, avoid) {
  const rng = (s => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)(99);
  const cols = [0x2f6bff, 0x18b7ff, 0x8a5bff, 0xff7a3d];
  for (let i = 0; i < 26; i++) {
    const ang = rng() * Math.PI * 2, rad = 22 + rng() * 16;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad * 0.7;
    if (avoid.some(p => Math.hypot(x - p.x, z - p.z) < 10)) continue;
    const h = 1.5 + rng() * 5, w = 1 + rng() * 1.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x0a1526, emissive: cols[i % cols.length], emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.4 }));
    body.position.set(x, h / 2, z); group.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.12, w * 1.1), emis(cols[i % cols.length], 0.7)); cap.position.set(x, h + 0.06, z); group.add(cap);
  }
}
