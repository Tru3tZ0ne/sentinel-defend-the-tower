// Original arcade equipment and threat sculptures. Brand decals remain official
// artwork; these silhouettes do not describe commercial appliance specifications.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const COLORS = { white: 0xdce3e4, metal: 0x86999f, dark: 0x172831, black: 0x07141c,
  green: 0x71c744, cyan: 0x57c8d8, amber: 0xeab66a, red: 0xea5260 };

export function createSangforArt({ scene, laneFrame, camera, markTex, brandTex, laneW, length }) {
  const templates = new Map(), geometries = new Set(), originals = new Set();
  const textures = new Set(), pendingFits = new Set(), labels = new Map(), planes = new Map();
  const palette = Object.fromEntries(Object.entries(COLORS).map(([id, color]) => [id,
    new THREE.MeshStandardMaterial({ color, roughness: id === 'white' ? .4 : .58,
      metalness: id === 'metal' ? .72 : .24,
      emissive: ['green', 'cyan', 'red', 'amber'].includes(id) ? color : 0,
      emissiveIntensity: ['green', 'cyan'].includes(id) ? .65 : .18 })]));
  Object.values(palette).forEach(m => originals.add(m));

  function kit(materials = palette) {
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
      const r = Math.min(bevel, w * .18, h * .18, d * .18);
      const shape = new THREE.Shape();
      const x0 = -w / 2 + r, x1 = w / 2 - r, y0 = -h / 2 + r, y1 = h / 2 - r;
      shape.moveTo(x0, -h / 2); shape.lineTo(x1, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, y0); shape.lineTo(w / 2, y1);
      shape.quadraticCurveTo(w / 2, h / 2, x1, h / 2); shape.lineTo(x0, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1); shape.lineTo(-w / 2, y0);
      shape.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.01, d - r * 2),
        bevelEnabled: true, bevelThickness: r, bevelSize: r * .45, bevelSegments: 1, steps: 1, curveSegments: 2 });
      geometry.translate(0, 0, -(d - r * 2) / 2);
      add(geometry, material, [x, y, z], rotation);
    }
    function sphere(r, x, y, z, material, scale = [1, 1, 1], detail = 1) {
      add(new THREE.IcosahedronGeometry(r, detail), material, [x, y, z], [0, 0, 0], scale);
    }
    function rod(a, b, r0, r1, material, segments = 8) {
      const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
      const geometry = new THREE.CylinderGeometry(r1, r0, delta.length(), segments);
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
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e1e8e8'; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#72ba42'; ctx.fillRect(0, 0, 10, 96);
    ctx.fillStyle = '#16313a'; ctx.font = '700 47px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(text, 257, 65);
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
  function identify(root, id, width = 1.1, height = .28, y = .57, z = -.73) {
    decal(root, labelTexture(id === 'ASTOR' ? 'aStor' : id), width, height, 0, y, z);
    if (markTex[id]) decal(root, markTex[id], .31, .31, -.45, y + .4, z - .015);
    return root;
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
  function equipment(id) {
    const root = instantiate('equipment:' + id, () => {
      const k = kit();
      k.box(1.65, .18, 1.65, 0, .12, 0, 'dark', .09);
      for (const s of [-1, 1]) {
        k.box(.23, .3, 1.35, s * .62, .29, 0, 'metal');
        k.box(.07, .07, .85, s * .755, .38, 0, 'green');
      }
      if (id === 'EDR' || id === 'COMMAND') {
        k.rod([0, .3, 0], [0, .65, 0], .48, .43, 'metal', 18);
        k.box(1.3, .5, 1.25, 0, .82, -.06, 'white', .13);
        k.box(.7, .35, .9, 0, 1.08, .12, 'dark', .09);
        for (const s of [-1, 1]) {
          k.rod([s * .27, 1.1, .2], [s * .27, 1.1, 1.23], .13, .105, 'metal', 12);
          k.rod([s * .27, 1.1, 1.2], [s * .27, 1.1, 1.36], .14, .14, 'dark', 12);
          k.rod([s * .27, 1.1, 1.355], [s * .27, 1.1, 1.37], .072, .072, 'green', 10);
          for (let i = 0; i < 4; i++) k.box(.08, .16, .08, s * .27, 1.2, .3 + i * .16, 'dark', .012);
          k.box(.14, .11, .66, s * .57, 1.02, -.1, 'green');
        }
        k.box(.55, .13, .13, 0, 1.16, -.52, 'black');
        k.box(.37, .055, .03, 0, 1.16, -.598, 'cyan');
      } else if (id === 'NDR') {
        k.box(.95, .7, .95, 0, .62, 0, 'white', .09);
        k.rod([0, .9, 0], [0, 1.35, 0], .1, .09, 'metal');
        k.sphere(.62, 0, 1.54, .08, 'white', [1, .43, 1], 2);
        k.ring(.53, .035, 0, 1.59, .08, 'cyan');
        k.rod([0, 1.55, 0], [0, 1.95, .35], .06, .025, 'metal');
        k.sphere(.085, 0, 1.95, .35, 'cyan');
      } else if (id === 'IAG') {
        k.box(1.6, .53, 1.16, 0, .56, 0, 'white', .08);
        k.box(1.39, .3, .06, 0, .55, -.63, 'dark');
        for (let i = 0; i < 6; i++) {
          k.box(.12, .09, .025, -.5 + i * .2, .57, -.68, 'metal', .008);
          k.box(.04, .025, .025, -.5 + i * .2, .65, -.7, 'green', .004);
        }
        for (const side of [-1, 1]) k.rod([side * .65, .75, .3], [side * .72, 1.55, .4], .04, .025, 'dark');
        k.box(.8, .04, .2, 0, .85, 0, 'green');
      } else {
        const h = id === 'ASTOR' ? 1.45 : 1.23;
        k.box(1.24, h, 1.15, 0, h / 2 + .24, 0, 'white', .09);
        k.box(1.06, h - .14, .06, 0, h / 2 + .26, -.61, 'dark');
        const count = id === 'ASTOR' ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const yy = .45 + i * (h - .32) / count;
          k.box(.85, .13, .07, 0, yy, -.65, 'metal', .018);
          k.box(.055, .035, .025, -.31, yy, -.7, 'green', .005);
          k.box(.34, .025, .02, .1, yy, -.7, 'black', .003);
        }
        k.box(.055, h - .22, .1, .52, h / 2 + .24, -.63, id === 'XDR' ? 'cyan' : 'green');
        if (id === 'XDR') {
          k.rod([0, h + .22, 0], [0, h + .8, 0], .1, .08, 'metal');
          k.ring(.32, .045, 0, h + .65, 0, 'cyan', [0, 0, 0]);
        }
      }
      return k.finish('sangfor:' + id);
    });
    identify(root, id, .85, .21, .33, id === 'EDR' || id === 'COMMAND' ? -.71 : -.72);
    if (id === 'EDR' || id === 'COMMAND') flash(root);
    return root;
  }

  function operator(id = 'COMMAND') {
    // A mobile command chassis is an arcade avatar, never a fictional product SKU.
    const root = equipment('COMMAND'); root.name = 'sangfor:operator';
    const tracks = instantiate('command-tracks', () => {
    const k = kit();
    for (const s of [-1, 1]) {
      k.box(.35, .38, 1.7, s * .88, .32, -.15, 'dark', .12);
      for (let i = 0; i < 5; i++) k.rod([s * 1.04, .3, -.75 + i * .3], [s * 1.08, .3, -.75 + i * .3], .12, .12, 'metal');
    }
    return k.finish('command-tracks');
    }); root.add(tracks);
    decal(root, brandTex, .95, .24, 0, .82, -.72);
    return root;
  }
  function operative(team = 'MDR') {
    const root = instantiate('operative:' + team, () => {
      const k = kit(), accent = team === 'rt' ? 'red' : team === 'pt' ? 'amber' : 'green';
      for (const s of [-1, 1]) {
        k.box(.24, .24, .53, s * .27, .14, .12, 'dark', .05);
        k.rod([s * .25, .28, 0], [s * .29, .79, -.04], .14, .15, 'dark');
        k.box(.2, .29, .19, s * .28, .53, -.17, 'white');
        k.sphere(.24, s * .46, 1.18, .01, 'white', [1, 1.1, .8]);
        k.rod([s * .47, 1.15, .02], [s * .34, .96, .43], .12, .105, 'dark');
      }
      k.box(.74, .65, .48, 0, 1.08, -.04, 'white', .1);
      k.box(.42, .39, .16, 0, 1.09, -.32, 'dark');
      k.box(.36, .045, .025, 0, 1.17, -.42, accent, .01);
      k.sphere(.3, 0, 1.68, 0, 'dark', [1, 1.1, 1], 2);
      k.box(.48, .15, .14, 0, 1.7, .23, accent, .05);
      k.box(.2, .17, 1.05, .32, 1.04, .51, 'metal');
      k.box(.3, .29, .4, .32, 1.04, .23, 'dark');
      return k.finish('sangfor:operative:' + team);
    });
    flash(root, .32, 1.04, 1.12, team === 'rt' ? COLORS.red : COLORS.green);
    // The existing team synchronization expects a tag; keep it compact and readable.
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(team.toUpperCase()), depthWrite: false }));
    tag.scale.set(.95, .19, 1); tag.position.y = 2.15; root.add(tag); root.userData.tag = tag;
    return root;
  }

  function barrier() {
    const root = new THREE.Group(); root.name = 'sangfor:AF-gateway';
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), new THREE.MeshBasicMaterial({
      color: COLORS.green, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.y = .78; root.add(wall);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, .035, .035), new THREE.MeshBasicMaterial({ color: COLORS.green }));
    top.position.y = 1.5; root.add(top);
    const posts = [-1, 1].map(side => {
      const grp = instantiate('AF-post', () => {
        const k = kit();
        k.box(.85, .22, 1.05, 0, .13, 0, 'dark');
        k.box(.55, 1.45, .65, 0, .92, 0, 'white', .07);
        k.box(.22, 1.12, .05, 0, .97, -.36, 'dark');
        for (let i = 0; i < 4; i++) k.box(.11, .13, .025, 0, .6 + i * .22, -.4, 'green');
        return k.finish('sangfor:AF-emitter');
      });
      identify(grp, 'AF', .4, .16, 1.45, -.4); root.add(grp); return { grp, side };
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
      fortress.box(2.25, 1.18, 1.65, i * 2.5, 1.05, -2.1, 'white', .12);
      fortress.box(1.98, .74, .08, i * 2.5, 1.07, -2.99, 'dark');
      for (let j = 0; j < 5; j++) fortress.box(.22, .09, .04, i * 2.5 - .65 + j * .31, .96, -3.05, 'metal');
      fortress.box(1.35, .045, .05, i * 2.5, 1.45, -3.02, 'green', .01);
    }
    const base = fortress.finish('sangfor:fortress');
    base.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
    decal(base, brandTex, 3.35, .65, 0, 1.1, -3.12); laneFrame.add(base);
  }
  environment();
  const aux = new THREE.Group(); aux.name = 'sangfor:installed-products'; scene.add(aux);
  const installed = new Map();
  function sync(S, { wX, wZ, fieldL, fieldR, baseY, bandY }) {
    for (const [id, side, y] of [['ASTOR', -1, baseY - 17], ['XDR', 1, baseY - 78], ['IAG', -1, bandY]]) {
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
  return { operator, turret: () => equipment('EDR'), ally: () => operative('MDR'), operative,
    radar: () => equipment('NDR'), core: () => equipment('HCI'), barrier, enemy, sync, animateEnemy,
    dispose() { geometries.forEach(g => g.dispose()); originals.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); } };
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
