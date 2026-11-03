// Original arcade equipment and threat sculptures. Brand decals remain official
// artwork; these silhouettes do not describe commercial appliance specifications.
import * as THREE from 'three';
import { createMechFactory } from './mech-art.js?mech=v2';
import { createStudioEnvironment } from './studio-light.js';

const TAU = Math.PI * 2;
const COLORS = { white: 0xcbd0d4, armor: 0x6c7e8b, metal: 0x89929c, dark: 0x252a31, black: 0x0d1015,
  green: 0x72bb38, cyan: 0x32a8ce, amber: 0xcaa261, red: 0xea5260 };

export function createSangforArt({ scene, laneFrame, renderer, markTex, brandTex, laneW, length, integrated = false }) {
  const studio = createStudioEnvironment(renderer);
  scene.environment = studio.texture; scene.environmentIntensity = .6;
  const templates = new Map(), geometries = new Set(), originals = new Set();
  const textures = new Set(), pendingFits = new Set(), labels = new Map(), planes = new Map();
  const palette = Object.fromEntries(Object.entries(COLORS).map(([id, color]) => [id,
    new THREE.MeshStandardMaterial({ color, roughness: id === 'white' ? .32 : id === 'metal' ? .28 : .43,
      metalness: id === 'metal' ? .82 : id === 'armor' ? .68 : id === 'dark' ? .55 : .22,
      emissive: ['green', 'cyan', 'red', 'amber'].includes(id) ? color : 0,
      emissiveIntensity: ['green', 'cyan'].includes(id) ? .4 : .12 })]));
  Object.values(palette).forEach(m => originals.add(m));

  function kit(materials = palette, smooth = false) {
    const parts = new Map();
    function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale) {
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
        new THREE.Vector3(...(scale || [1, 1, 1])));
      geometry.applyMatrix4(matrix);
      geometry.deleteAttribute('uv');
      if (!parts.has(material)) parts.set(material, []);
      parts.get(material).push(geometry);
    }
    function box(w, h, d, x, y, z, material = 'dark', bevel = .04, rotation) {
      // Contacts, vent slits and LEDs do not need bevel topology at game scale.
      if (Math.min(w, h, d) < .035 || bevel < .01) {
        add(new THREE.BoxGeometry(w, h, d), material, [x, y, z], rotation); return;
      }
      const r = Math.min(bevel, w * .18, h * .18, d * .18);
      const shape = new THREE.Shape();
      const x0 = -w / 2 + r, x1 = w / 2 - r, y0 = -h / 2 + r, y1 = h / 2 - r;
      shape.moveTo(x0, -h / 2); shape.lineTo(x1, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, y0); shape.lineTo(w / 2, y1);
      shape.quadraticCurveTo(w / 2, h / 2, x1, h / 2); shape.lineTo(x0, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1); shape.lineTo(-w / 2, y0);
      shape.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, d - r * 2),
        bevelEnabled: true, bevelThickness: r, bevelSize: r * .45, bevelSegments: smooth ? 2 : 1, steps: 1, curveSegments: smooth ? 4 : 2 });
      geometry.translate(0, 0, -(d - r * 2) / 2);
      add(geometry, material, [x, y, z], rotation);
    }
    function sphere(r, x, y, z, material, scale = [1, 1, 1], detail = 1) {
      add(smooth ? new THREE.SphereGeometry(r, 20, 12) : new THREE.IcosahedronGeometry(r, detail), material, [x, y, z], [0, 0, 0], scale);
    }
    function rod(a, b, r0, r1, material, segments = 8) {
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
      const geometry = new THREE.CylinderGeometry(r1, r0, delta.length(), smooth ? Math.max(16, segments) : segments);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
      add(geometry, material, from.add(to).multiplyScalar(.5).toArray());
    }
    function ring(r, tube, x, y, z, material, rotation = [-Math.PI / 2, 0, 0]) {
      add(new THREE.TorusGeometry(r, tube, 5, 28), material, [x, y, z], rotation);
    }
    function finish(name) {
      const root = new THREE.Group(); root.name = name;
      for (const [id, pieces] of parts) {
        const flat = pieces.map(g => g.index ? g.toNonIndexed() : g);
        const geometry = new THREE.BufferGeometry();
        for (const attribute of ['position', 'normal']) {
          const arrays = flat.map(g => g.getAttribute(attribute).array);
          const joined = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
          let offset = 0;
          for (const array of arrays) { joined.set(array, offset); offset += array.length; }
          geometry.setAttribute(attribute, new THREE.BufferAttribute(joined, 3));
        }
        new Set([...pieces, ...flat]).forEach(g => g.dispose()); geometries.add(geometry);
        const mesh = new THREE.Mesh(geometry, materials[id]);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.name = id; mesh.userData.sharedStandGeometry = true;
        root.add(mesh);
      }
      return root;
    }
    return { box, sphere, rod, ring, finish };
  }

  function instantiate(name, build) {
    if (!templates.has(name)) templates.set(name, build());
    const root = templates.get(name).clone(true), materialMap = new Map();
    root.traverse(o => {
      if (!o.isMesh) return;
      if (!materialMap.has(o.material)) materialMap.set(o.material, o.material.clone());
      o.material = materialMap.get(o.material);
    });
    return root;
  }

  function labelTexture(text) {
    if (labels.has(text)) return labels.get(text);
    const canvas = document.createElement('canvas'); canvas.width = text.length <= 5 ? 256 : 512; canvas.height = 96;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#10161d'; ctx.fillRect(0, 0, canvas.width, 96);
    ctx.fillStyle = '#72bb38'; ctx.fillRect(0, 0, 6, 96);
    ctx.fillStyle = '#e8edf1'; ctx.font = `700 ${text.length <= 5 ? 64 : 42}px "Segoe UI",sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, text.length <= 5 ? 72 : 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture); labels.set(text, texture); return texture;
  }
  function decal(root, texture, w, h, x, y, z, ground = false) {
    if (!texture) return;
    const key = w + ':' + h;
    if (!planes.has(key)) { const geo = new THREE.PlaneGeometry(w, h); planes.set(key, geo); geometries.add(geo); }
    const geometry = planes.get(key);
    const plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    plane.userData.sharedStandGeometry = true;
    plane.position.set(x, y, z);
    if (ground) { plane.rotation.x = -Math.PI / 2; plane.rotation.z = Math.PI; }
    else plane.rotation.y = Math.PI;
    plane.userData.fitTexture = { w, h }; pendingFits.add(plane);
    root.add(plane); return plane;
  }
  function flash(root, x = 0, y = 1.1, z = 1.25, color = COLORS.green) {
    if (!planes.has('muzzle')) { const geo = new THREE.OctahedronGeometry(.18); planes.set('muzzle', geo); geometries.add(geo); }
    const geometry = planes.get('muzzle');
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true,
      opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.userData.sharedStandGeometry = true; mesh.scale.set(.7, .7, 2.4);
    mesh.position.set(x, y, z); mesh.visible = false; root.add(mesh); root.userData.flash = mesh;
    return root;
  }
  // Hardware proportions follow the official NGFW and HCI product photographs.
  // Guns, radar and mobile mounts are explicitly fictional gameplay attachments.
  function networkChassis(k, y = .42, width = 1.9, depth = 1.42) {
    const sx = width / 1.9;
    k.box(width, .32, depth, 0, y, 0, 'dark', .035);
    k.box(width - .06, .045, depth - .06, 0, y + .18, 0, 'black', .012);
    k.box(width - .07, .275, .045, 0, y, -depth / 2 - .022, 'white', .012);
    for (const side of [-1, 1]) {
      k.box(.13, .34, .07, side * (width / 2 + .015), y, -depth / 2, 'metal', .018);
      k.rod([side * width / 2, y - .1, -depth / 2 - .06],
        [side * width / 2, y + .1, -depth / 2 - .06], .026, .026, 'dark');
      for (let j = 0; j < 7; j++) k.box(.025, .07, .075,
        side * (width / 2 + .003), y + .025, -.42 + j * .13, 'black', .002);
    }
    // Recessed copper ports with metal rims, link LEDs and contact strips.
    for (let i = 0; i < 8; i++) {
      const x = (-.35 + i * .135) * sx, z = -depth / 2 - .05;
      k.box(.105 * sx, .1, .028, x, y, z, 'metal', .007);
      k.box(.077 * sx, .065, .02, x, y + .003, z - .02, 'black', .003);
      k.box(.054 * sx, .013, .008, x, y - .022, z - .034, 'amber', .002);
      k.box(.017 * sx, .014, .008, x - .033 * sx, y + .067, z - .03, 'green', .002);
    }
    k.box(.32 * sx, .1, .025, -.68 * sx, y, -depth / 2 - .055, 'black', .006);
    k.box(.09 * sx, .043, .028, -.68 * sx, y - .088, -depth / 2 - .06, 'dark', .003);
  }
  function serverChassis(k, storage = false) {
    const h = storage ? 1.38 : 1.02, cols = storage ? 5 : 4, rows = storage ? 4 : 3;
    k.box(1.94, h, 1.48, 0, .26 + h / 2, 0, 'dark', .045);
    k.box(1.82, h - .1, .045, 0, .26 + h / 2, -.77, 'black', .01);
    for (const side of [-1, 1]) {
      k.box(.09, h + .04, .09, side * 1.02, .26 + h / 2, -.72, 'metal', .012);
      k.rod([side * 1.01, .39, -.87], [side * 1.01, h + .11, -.87], .045, .045, 'dark');
    }
    const dx = 1.73 / cols, dy = (h - .15) / rows;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = (col - (cols - 1) / 2) * dx, y = .35 + dy * (row + .5);
      k.box(dx - .035, dy - .03, .07, x, y, -.8, 'metal', .012);
      k.box(dx - .085, dy - .075, .022, x + .01, y, -.85, 'black', .006);
      k.box(.033, dy - .075, .024, x - dx / 2 + .04, y, -.87, 'cyan', .004);
      for (let n = 0; n < 3; n++) k.box(dx - .14, .015, .012,
        x + .02, y - .048 + n * .048, -.871, 'dark', .001);
      k.box(.018, .018, .01, x + dx / 2 - .05, y - .045, -.88, 'green', .002);
    }
    return h + .28;
  }
  function screenTexture(id) {
    const key = 'console:' + id; if (labels.has(key)) return labels.get(key);
    const c = document.createElement('canvas'); c.width = 512; c.height = 288;
    const g = c.getContext('2d'); g.fillStyle = '#061b25'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#72bb38'; g.fillRect(0, 0, 512, 5);
    g.fillStyle = '#edf4f5'; g.font = '600 23px Segoe UI'; g.fillText(id === 'EDR' ? 'ENDPOINT SECURE' : 'ATHENA XDR', 20, 38);
    g.fillStyle = '#344c56'; g.fillRect(20, 51, 470, 1);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#102c38'; g.fillRect(20 + i * 159, 68, 147, 50);
      g.fillStyle = '#78c94d'; g.font = '600 21px Segoe UI'; g.fillText(['PROTECTED', 'ONLINE', 'ACTIVE'][i], 28 + i * 159, 101);
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i === 1 ? '#1d4651' : '#102b36'; g.fillRect(20, 137 + i * 27, 470, 20);
      g.fillStyle = '#59c49a'; g.fillRect(30, 143 + i * 27, 7, 7);
      g.fillStyle = '#7394a3'; g.fillRect(50, 143 + i * 27, 110 + i * 14, 5);
      g.fillStyle = '#376b7c'; g.fillRect(300, 143 + i * 27, 130 - i * 12, 5);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    textures.add(t); labels.set(key, t); return t;
  }
  function equipment(id) {
    let roof = .62;
    const root = instantiate('equipment:' + id, () => {
      const k = kit();
      k.box(2.08, .14, 1.7, 0, .1, 0, 'black', .045);
      for (const side of [-1, 1]) k.box(.055, .025, 1.1, side * .96, .19, .04, 'green', .007);
      if (id === 'AI' || id === 'AGENT') {
        // Compact compute blade and workflow console, using cached material batches.
        k.box(1.85, .5, 1.38, 0, .44, 0, 'dark');
        k.box(1.7, .33, .05, 0, .44, -.72, 'metal');
        for (let n = 0; n < 6; n++) {
          k.box(.18, .22, .025, -.65 + n * .26, .44, -.76, 'black', .004);
          k.box(.025, .08, .025, -.71 + n * .26, .44, -.78, 'cyan', .002);
        }
        if (id === 'AGENT') {
          k.box(1.3, .68, .1, 0, 1.05, .22, 'black');
          for (const x of [-.43, 0, .43]) k.box(.23, .25, .025, x, 1.05, .15, 'cyan', .008);
          k.box(.98, .025, .025, 0, 1.05, .13, 'metal', .002);
        }
      } else if (id === 'HCI' || id === 'ASTOR') {
        serverChassis(k, id === 'ASTOR');
      } else {
        networkChassis(k);
        if (id === 'EDR' || id === 'COMMAND') {
          k.rod([0, .62, .14], [0, .81, .14], .46, .4, 'metal', 20);
          k.box(.94, .34, .76, 0, .94, .19, 'dark', .07);
          k.box(.69, .045, .56, 0, 1.13, .18, 'white', .016);
          for (const side of [-1, 1]) {
            k.rod([side * .25, .97, .42], [side * .25, .97, 1.34], .1, .085, 'metal', 14);
            k.rod([side * .25, .97, 1.27], [side * .25, .97, 1.46], .12, .12, 'black', 14);
            k.rod([side * .25, .97, 1.46], [side * .25, .97, 1.475], .062, .062, 'green', 12);
            for (let j = 0; j < 5; j++) k.box(.09, .055, .045, side * .25, 1.06, .58 + j * .12, 'black', .006);
            k.box(.085, .04, .42, side * .43, 1.06, .18, 'green', .012);
          }
          if (id === 'EDR') {
            // The unit carries a real Sangfor Endpoint Secure appliance on its mount:
            // a white 1U chassis with a dark front bezel, metal rack ears, a row of
            // green status LEDs and top vent slits. It visibly RUNS the EDR box.
            k.box(.72, .22, .5, 0, 1.27, .18, 'white', .022);                       // appliance chassis
            k.box(.6, .14, .05, 0, 1.27, .45, 'dark', .012);                        // front bezel (faces the lane)
            k.box(.5, .02, .02, 0, 1.22, .465, 'green', .004);                      // bezel status line
            for (const s of [-1, 1]) k.box(.05, .24, .52, s * .365, 1.27, .18, 'metal', .012);   // rack ears
            for (let i = 0; i < 4; i++) k.box(.04, .025, .03, -.18 + i * .12, 1.385, .42, 'green', .004);   // front status LEDs
            for (let j = 0; j < 8; j++) k.box(.012, .02, .12, -.22 + j * .063, 1.39, .34, 'black', .001);   // front vent slits
            // side diagnostics console
            k.box(.62, .38, .075, -.58, .87, -.34, 'black', .035, [-.3, 0, 0]);
            k.rod([-.58, .58, -.26], [-.58, .8, -.29], .055, .04, 'metal');
          }
        } else if (id === 'NDR') {
          k.rod([0, .6, .22], [0, 1.15, .22], .09, .075, 'metal');
          k.sphere(.58, 0, 1.34, .22, 'metal', [1, .2, 1], 2);
          k.sphere(.51, 0, 1.38, .22, 'dark', [1, .13, 1], 2);
          k.ring(.5, .018, 0, 1.4, .22, 'cyan');
          for (const side of [-1, 1]) k.rod([side * .44, 1.4, .22], [0, 1.73, .22], .025, .018, 'metal');
          k.rod([0, 1.39, .22], [0, 1.76, .22], .025, .018, 'metal');
          k.sphere(.06, 0, 1.77, .22, 'cyan');
        } else if (id === 'XDR') {
          k.box(.13, .44, .12, 0, .82, .2, 'metal');
          k.box(1.55, .88, .1, 0, 1.26, .22, 'black', .045);
          k.box(1.38, .025, .015, 0, .78, .155, 'green', .004);
        } else if (id === 'IAG') {
          // A wired perimeter appliance, with two optical uplinks above copper ports.
          for (const x of [-.28, -.08]) {
            k.box(.12, .065, .025, x, .52, -.77, 'black', .004);
            k.box(.055, .028, .01, x, .52, -.789, 'cyan', .002);
          }
          for (let j = 0; j < 8; j++) k.box(.025, .015, .35, -.7 + j * .07, .627, .24, 'metal', .003);
        }
      }
      return k.finish('sangfor:' + id);
    });
    roof = id === 'ASTOR' ? 1.68 : id === 'HCI' ? 1.32 : ['AI', 'AGENT'].includes(id) ? .71 : .63;
    const title = { EDR: 'Endpoint Secure', NDR: 'Cyber Command', IAG: 'Secure Web Gateway',
      HCI: 'aServer HCI', ASTOR: 'aStor', XDR: 'Athena XDR', COMMAND: 'SANGFOR COMMAND', AI: 'AI Platform', AGENT: 'Agent Builder' }[id] || id;
    decal(root, brandTex, .84, .22, .28, roof + .006, -.4, true);
    decal(root, labelTexture(title), 1.13, .16, .12, roof + .009, -.6, true);
    if (markTex[id]) decal(root, markTex[id], id === 'XDR' ? .76 : .3, id === 'XDR' ? .76 : .3,
      id === 'XDR' ? -.48 : -.67, roof + .013, id === 'XDR' ? .12 : -.33, true);
    if (id === 'EDR') {
      const screen = decal(root, screenTexture(id), .53, .3, -.58, .875, -.385);
      screen.rotation.x = -.3;
      // Brand the carried appliance so it clearly embodies Sangfor Endpoint Secure:
      // the product mark on its top (read from the overhead camera) and a name plate
      // across the back face (which faces the player's camera down the lane).
      decal(root, markTex.EDR, .27, .27, 0, 1.405, .04, true);
      decal(root, labelTexture('Endpoint Secure'), .56, .1, 0, 1.3, -.075);
    }
    if (id === 'XDR') decal(root, screenTexture(id), 1.41, .77, 0, 1.26, .16);
    if (id === 'HCI' || id === 'ASTOR') decal(root, brandTex, .82, .12, 0, .305, -.885);
    if (id === 'EDR' || id === 'COMMAND') {
      decal(root, brandTex, .74, .21, 0, .96, -.206);
      flash(root, 0, .97, 1.49);
    }
    return root;
  }

  const mech = integrated ? createMechFactory({kit:()=>kit(palette,true),instantiate,decal,labelTexture,markTex,brandTex,flash,networkChassis,serverChassis}) : null;
  function operator() {
    if(mech) return mech.build();
    const root = equipment('COMMAND'); root.name = 'sangfor:operator';
    const tracks = instantiate('command-tracks', () => {
      const k = kit();
      for (const side of [-1, 1]) {
        k.box(.23, .3, 1.57, side * .97, .23, .02, 'black', .08);
        for (let i = 0; i < 7; i++) k.box(.25, .055, .09, side * .97, .4, -.59 + i * .2, 'metal', .009);
      }
      return k.finish('command-tracks');
    }); root.add(tracks); return root;
  }
  function operative(team = 'MDR') {
    const root = instantiate('operative:' + team, () => {
      const k = kit(), accent = team === 'rt' ? 'red' : team === 'pt' ? 'amber' : 'green';
      for (const s of [-1, 1]) {
        k.box(.24, .24, .53, s * .27, .14, .12, 'dark', .05);
        k.rod([s * .25, .28, 0], [s * .29, .79, -.04], .14, .15, 'dark');
        k.box(.2, .29, .19, s * .28, .53, -.17, 'metal');
        k.sphere(.24, s * .46, 1.18, .01, 'dark', [1, 1.1, .8]);
        k.rod([s * .47, 1.15, .02], [s * .34, .96, .43], .12, .105, 'dark');
      }
      k.box(.74, .65, .48, 0, 1.08, -.04, 'dark', .08);
      k.box(.42, .39, .16, 0, 1.09, -.32, 'dark');
      k.box(.36, .045, .025, 0, 1.17, -.42, accent, .01);
      k.sphere(.3, 0, 1.68, 0, 'dark', [1, 1.1, 1], 2);
      k.box(.48, .15, .14, 0, 1.7, .23, accent, .05);
      k.box(.2, .17, 1.05, .32, 1.04, .51, 'metal');
      k.box(.3, .29, .4, .32, 1.04, .23, 'dark');
      return k.finish('sangfor:operative:' + team);
    });
    flash(root, .32, 1.04, 1.12, team === 'rt' ? COLORS.red : COLORS.green);
    decal(root, brandTex, .52, .15, 0, 1.29, -.31);
    if (team === 'MDR') decal(root, markTex.MDR, .21, .21, 0, 1.01, -.41);
    // The existing team synchronization expects a tag; keep it compact and readable.
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(team.toUpperCase()), depthWrite: false }));
    tag.scale.set(.95, .19, 1); tag.position.y = 2.15; root.add(tag); root.userData.tag = tag;
    return root;
  }

  function barrier(compact = false) {
    const root = new THREE.Group(); root.name = 'sangfor:AF-gateway';
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), new THREE.MeshBasicMaterial({
      color: COLORS.green, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.y = .78; root.add(wall);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, .035, .035), new THREE.MeshBasicMaterial({ color: COLORS.green }));
    top.position.y = 1.5; root.add(top);
    const posts = compact ? [] : [-1, 1].map(side => {
      const grp = instantiate('AF-post', () => {
        const k = kit();
        k.box(1.4, .16, 1.35, 0, .1, 0, 'black');
        networkChassis(k, .4, 1.28, 1.16);
        k.rod([0, .59, .35], [0, 1.48, .35], .06, .045, 'metal');
        for (let i = 0; i < 4; i++) k.ring(.09, .025, 0, .8 + i * .16, .35, 'green');
        return k.finish('sangfor:AF-emitter');
      });
      decal(grp, brandTex, .77, .19, 0, .625, -.24, true);
      decal(grp, labelTexture('Athena NGFW'), .9, .13, 0, .627, -.47, true);
      root.add(grp); return { grp, side };
    });
    root.userData = { wall, top, posts }; root.visible = false; scene.add(root); return root;
  }

  function enemy(e, radius) {
    const type = e.type, color = new THREE.Color(e.spec.color);
    const threatMaterials = {
      shell: new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(.48),
        roughness: .4, metalness: .25, emissive: color, emissiveIntensity: .055 }),
      flesh: new THREE.MeshStandardMaterial({ color, roughness: .58, metalness: .08,
        emissive: color, emissiveIntensity: .09 }),
      jaw: new THREE.MeshStandardMaterial({ color: 0x271c2b, roughness: .3, metalness: .6 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xffdfaf, emissive: 0xff7b55, emissiveIntensity: 1.1 }),
    };
    Object.values(threatMaterials).forEach(material => { material.envMapIntensity = .12; });
    const group = instantiate('threat:' + type, () => {
      Object.values(threatMaterials).forEach(m => originals.add(m));
      const k = kit(threatMaterials), boss = !!e.spec.boss;
      function leg(side, x, z, size = 1) {
        const a = [side * x, -.18, z], b = [side * (x + .46 * size), -.14, z - .35 * size];
        const c = [side * (x + .65 * size), -.72, z - .62 * size];
        k.rod(a, b, .12 * size, .08 * size, 'shell'); k.sphere(.13 * size, ...b, 'jaw');
        k.rod(b, c, .075 * size, .008, 'jaw');
      }
      function thorn(x, y, z, dx, dy, dz, r = .13) {
        k.rod([x, y, z], [x + dx, y + dy, z + dz], r, .007, 'shell');
        k.sphere(r * .66, x, y, z, 'flesh');
      }
      if (type === 'worm') {
        for (let i = 0; i < 6; i++) {
          const z = (i - 2.5) * .39, x = Math.sin(i * .9) * .25, size = .45 - i * .035;
          k.sphere(size, x, 0, z, 'shell', [1.05, .8, 1], 2);
          k.ring(size * .8, .045, x, .01, z, 'flesh', [0, 0, 0]);
          for (const side of [-1, 1]) leg(side, size * .6, z, .48);
          thorn(x, size * .65, z, .05, .28, .1, .08);
        }
      } else if (type === 'apt' || type === 'wraith') {
        k.sphere(.82, 0, .06, 0, 'shell', [1, .48, 1.3], 2);
        for (const side of [-1, 1]) {
          k.sphere(.56, side * .77, -.02, .13, 'shell', [1.6, .24, .9]);
          for (let i = 0; i < 4; i++) thorn(side * (.7 + i * .16), 0, .22 + i * .14, side * .2, .1, .7, .1);
          thorn(side * .23, 0, -.65, side * .1, .02, -.48, .1);
        }
      } else if (type === 'botnet') {
        k.sphere(.78, 0, .1, 0, 'shell', [1, .9, 1], 2);
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8, x = Math.cos(a), z = Math.sin(a);
          k.rod([x * .6, 0, z * .6], [x * 1.2, -.3, z * 1.2], .13, .08, 'shell');
          k.rod([x * 1.2, -.3, z * 1.2], [x * 1.45, -.1, z * 1.45], .08, .035, 'flesh');
          k.sphere(.2, x * 1.45, -.1, z * 1.45, 'shell');
          k.sphere(.075, x * 1.45, -.1, z * 1.45 - .18, 'eye');
        }
      } else {
        const virus = type === 'malware', heavy = type === 'ransom' || type === 'siege';
        k.sphere(.79, 0, .04, 0, 'flesh', [1, .8, 1.08], 2);
        k.sphere(.79, 0, .21, .13, 'shell', [1, .7, 1.05], 2);
        for (const side of [-1, 1]) for (let i = 0; i < (heavy ? 4 : 3); i++) leg(side, .57, -.45 + i * .37, heavy ? 1.05 : .8);
        const count = heavy ? 12 : virus ? 14 : 7;
        for (let i = 0; i < count; i++) {
          const a = i * 2.39996, yy = .15 + (i % 4) * .17, spread = Math.sqrt(Math.max(.15, 1 - yy * yy));
          const x = Math.cos(a) * .68 * spread, z = Math.sin(a) * .68 * spread;
          thorn(x, yy, z, x * .6, .25 + (i % 3) * .08, z * .6, heavy ? .16 : .11);
        }
        if (heavy) for (const side of [-1, 1]) {
          k.sphere(.38, side * .9, -.12, -.68, 'shell', [1.15, .75, 1.3], 2);
          k.rod([side * .9, -.12, -.8], [side * .42, -.18, -1.35], .17, .01, 'jaw');
        }
        if (type === 'exfil') for (const side of [-1, 1]) {
          k.sphere(.7, side * .9, .32, .15, 'shell', [1.15, .12, .8]);
          k.rod([side * .25, .48, -.45], [side * .5, .9, -.8], .055, .01, 'flesh');
        }
      }
      // Eyes and mandibles live on the creature; there is no floating threat icon.
      for (const side of [-1, 1]) {
        k.sphere(.105, side * .23, .04, -.72, 'eye', [1.2, .65, 1], 1);
        k.rod([side * .17, -.13, -.71], [side * .13, -.27, -.98], .1, .005, 'jaw');
      }
      if (type === 'ransom') {
        k.box(.53, .47, .16, 0, .35, -.7, 'jaw');
        k.ring(.18, .055, 0, .64, -.7, 'shell', [0, 0, 0]);
        k.sphere(.055, 0, .38, -.81, 'eye');
      }
      return k.finish('threat:' + type);
    });
    // Materials built for an already cached template are not retained.
    for (const material of Object.values(threatMaterials)) if (!originals.has(material)) material.dispose();
    group.scale.setScalar(radius * .79);
    const body = group.getObjectByName('flesh') || group.getObjectByName('shell');
    scene.add(group);
    return { group, body, core: null, glyph: null, shell: null, orbit: null, nodes: null,
      baseEmissive: .09, custom: true };
  }

  // The battleground is a shallow appliance deck, with lighting and mechanical
  // details kept outside the actual collision lane.
  function environment() {
    const k = kit();
    k.box(laneW + .5, .35, length + 7, 0, -.24, length / 2 - 1.5, 'dark', .1);
    for (const side of [-1, 1]) {
      k.box(.7, .45, length + 7, side * (laneW / 2 + .05), .08, length / 2 - 1.5, 'metal');
      for (let z = -3; z < length + 2; z += 3.6) {
        k.box(.12, .035, 1.7, side * (laneW / 2 - .12), .34, z, 'green', .01);
        k.box(.58, .85, .72, side * (laneW / 2 + .2), .5, z, 'dark');
        k.box(.3, .09, .09, side * (laneW / 2 + .2), .91, z - .37, 'white');
      }
    }
    const stage = k.finish('sangfor:deck-frame');
    stage.traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); laneFrame.add(stage);
    const fortress = kit();
    fortress.box(laneW + .5, .6, 2.3, 0, .28, -2, 'dark', .12);
    for (let i = -3; i <= 3; i++) {
      fortress.box(2.25, .67, 1.65, i * 2.5, .8, -2.1, 'dark', .045);
      fortress.box(1.98, .48, .07, i * 2.5, .8, -2.99, 'black');
      for (let j = 0; j < 6; j++) {
        fortress.box(.25, .31, .045, i * 2.5 - .8 + j * .32, .8, -3.05, 'metal', .008);
        fortress.box(.18, .22, .025, i * 2.5 - .8 + j * .32, .8, -3.09, 'black', .006);
        fortress.box(.025, .1, .015, i * 2.5 - .87 + j * .32, .8, -3.11, 'cyan', .003);
      }
      fortress.box(1.55, .025, .025, i * 2.5, 1.1, -3.02, 'green', .005);
    }
    const base = fortress.finish('sangfor:fortress');
    base.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    decal(base, brandTex, 3.35, .65, 0, 1.15, -2.2, true); laneFrame.add(base);
  }
  environment();
  const aux = new THREE.Group(); aux.name = 'sangfor:installed-products'; scene.add(aux);
  const installed = new Map();
  function sync(S, { wX, wZ, fieldL, fieldR, baseY, bandY }) {
    mech?.sync(S);
    for (const [id, side, y] of (integrated ? [] : [['ASTOR', -1, baseY - 17], ['XDR', 1, baseY - 78], ['IAG', -1, bandY], ['AI', -1, baseY - 184], ['AGENT', -1, baseY - 258]])) {
      if (!S.levels[id]) { const old = installed.get(id); if (old) old.visible = false; continue; }
      if (!installed.has(id)) { const root = equipment(id); aux.add(root); installed.set(id, root); }
      const root = installed.get(id); root.visible = true;
      root.position.set(wX(side < 0 ? fieldL + 23 : fieldR - 23), 0, wZ(y));
      root.scale.setScalar(.84);
    }
    for (const plane of pendingFits) {
      const image = plane.material.map?.image;
      if (!image?.width) continue;
      const { w, h } = plane.userData.fitTexture, ratio = image.width / image.height;
      plane.scale.set(Math.min(1, h * ratio / w), Math.min(1, w / (ratio * h)), 1);
      pendingFits.delete(plane);
    }
  }
  function animateEnemy(mesh, e, time, revealed) {
    const cloaked = e.spec.cloak && !revealed;
    mesh.group.rotation.y = Math.sin(time * 2.4 + e.id) * .12;
    mesh.group.rotation.z = Math.sin(time * 4 + e.id) * .035;
    mesh.group.position.y += Math.sin(time * 3.1 + e.id) * .035;
    mesh.group.traverse(o => {
      if (!o.isMesh) return;
      o.material.transparent = cloaked; o.material.opacity = cloaked ? .24 : 1;
    });
    mesh.body.material.emissiveIntensity = e.hit > 0 ? .9 : .09;
    mesh.body.material.emissive.set(e.hit > 0 ? 0xffe0ce : e.spec.color);
  }
  return { integrated, get rigDiagnostics(){return mech?.diagnostics;}, operator, turret: () => equipment('EDR'), ally: () => operative('MDR'), operative,
    radar: () => equipment('NDR'), core: () => equipment('HCI'), barrier:()=>barrier(integrated), enemy, sync, animateEnemy,
    product: id => id === 'AF' ? barrier() : id === 'MDR' ? operative('MDR') : equipment(id),
    dispose() { studio.dispose(); geometries.forEach(g => g.dispose()); originals.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
}

export function createDeckTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#273b43'; ctx.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 128) for (let x = 0; x < 1024; x += 256) {
    ctx.fillStyle = ((x / 256 + y / 128) % 2) ? '#30464d' : '#2d4149';
    ctx.fillRect(x + 3, y + 3, 250, 122);
    ctx.strokeStyle = '#53626a'; ctx.lineWidth = 2; ctx.strokeRect(x + 9, y + 9, 238, 110);
    for (const dx of [16, 240]) for (const dy of [16, 112]) {
      ctx.fillStyle = '#152a32'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#3b5057'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 40 + i * 29, y + 92, 15, 3);
  }
  // Quiet dashed guidance supports the firing lane without overpowering threats.
  ctx.fillStyle = '#8da49c'; for (let y = 0; y < 1024; y += 128) ctx.fillRect(508, y + 32, 4, 34);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.5, 3.5); return texture;
}
