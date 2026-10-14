// Distinct, physically grounded scene representatives for deployed capabilities.
// Details are merged by material so adding a device does not add a draw per port.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/BufferGeometryUtils.js';
import { DEPLOYMENT_VISUALS } from '../data/deployment-visuals.js';
import { PRODUCT_MARKS } from '../ui/product-marks.js';

export function createDeploymentAssets(scene, building) {
  const entries = new Map();
  const pickables = [];
  const keyOf = (id, target) => id + ':' + (target || '');

  function position(id, target) {
    const d = building.desks.get(target);
    if (id === 'EDR') return d?.pos.clone() || null;
    const r = building.rooms.get(DEPLOYMENT_VISUALS[id]?.room);
    if (!r) return null;
    const y = r.center.y + .04;
    // Dedicated slots keep purchased devices out of desk seats and walking paths.
    const slots = {
      AF: [8.15, 7.45], IAG: [-12.6, -2.75], NDR: [-7.0, -2.7],
      ASTOR: [-6.85, -5.6], HCI: [-4.8, -5.6], ADC: [-2.9, -2.7],
      XDR: [-12.6, 6.1], MDR: [-8.6, 6.15], AICP: [-10.6, 6.1],
      SASE: [4.1, -2.7],
    };
    const [x, z] = slots[id];
    return new THREE.Vector3(x, y, z);
  }

  function deviceKit(id, kind, accent) {
    const group = new THREE.Group();
    const buckets = new Map();
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x27323b, roughness: .66, metalness: .48 }),
      new THREE.MeshStandardMaterial({ color: 0xc8cdd0, roughness: .48, metalness: .65 }),
      new THREE.MeshStandardMaterial({ color: 0x0b1720, roughness: .72 }),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .35, roughness: .45 }),
    ];
    function box(w, h, d, x, y, z, material = 0) {
      const geometry = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
      if (!buckets.has(material)) buckets.set(material, []);
      buckets.get(material).push(geometry);
    }
    function chassis(y, w = 1.05, height = .24) {
      box(w, height, .72, 0, y, 0);
      box(w - .08, height - .04, .025, 0, y, .478, 1);
      for (let i = 0; i < 6; i++) {
        box(.07, .065, .025, -w * .32 + i * .095, y, .504, 2);
        box(.025, .014, .028, -w * .32 + i * .095, y + .047, .507, 3);
      }
      box(.17, .08, .03, w * .33, y, .507, 2);
    }
    let height = 1.1;
    if (kind === 'agent') {
      // This is an installed software-agent badge on the existing host, not a
      // fictional EDR appliance or a dome around the entire room.
      box(.32, .24, .045, .33, .13, .37, 2);
      box(.26, .035, .05, .33, .22, .37, 3);
      height = .4;
    } else if (['console', 'service', 'automation', 'access'].includes(kind)) {
      box(1.45, .11, .72, 0, .59, 0, 1);
      box(.12, .59, .6, -.55, .295, 0);
      box(.12, .59, .6, .55, .295, 0);
      box(.96, .61, .07, 0, 1.05, -.12);
      box(.84, .49, .08, 0, 1.05, -.073, 2);
      box(.07, .2, .09, 0, .72, -.12, 1);
      box(.6, .025, .19, 0, .665, .17, 2);
      // Screen charts denote the console's function without invented live data.
      const bars = kind === 'service' ? 3 : kind === 'automation' ? 4 : 6;
      for (let i = 0; i < bars; i++) box(.075, .08 + (i % 3) * .07, .012,
        -.29 + i * .11, .98, -.024, 3);
      if (kind === 'service') box(.28, .2, .01, .21, 1.17, -.02, 1);
      height = 1.45;
    } else if (kind === 'storage') {
      box(1.1, 1.42, .83, 0, .74, 0);
      box(.99, 1.3, .035, 0, .76, .433, 1);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
        box(.27, .19, .04, -.31 + col * .31, .35 + row * .26, .46, 2);
        box(.18, .018, .05, -.31 + col * .31, .35 + row * .26, .485, 1);
        box(.025, .035, .055, -.41 + col * .31, .35 + row * .26, .487, 3);
      }
      height = 1.57;
    } else {
      const cluster = kind === 'cluster';
      height = cluster ? 1.53 : kind === 'probe' ? 1.12 : 1.24;
      box(1.18, height - .1, .79, 0, (height - .1) / 2 + .05, 0);
      box(1.09, height - .2, .06, 0, height / 2, .42, 2);
      const count = cluster ? 3 : kind === 'balancer' ? 2 : 1;
      for (let i = 0; i < count; i++) chassis((count === 1 ? .61 : .37) + i * .34);
      box(1.18, .07, .84, 0, height - .08, .02, 1);
      box(.16, .035, .025, .32, height - .24, .48, 3);
      if (count === 1) for (let i = 0; i < 8; i++) box(.035, .11, .026, -.36 + i * .1, .32, .475, 1);
      for (const x of [-.5, .5]) box(.04, .46, .07, x, .62, .51, 1);
      for (const x of [-.49, .49]) box(.08, .07, .65, x, .035, 0, 2);
    }
    for (const [material, geometries] of buckets) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geometry, materials[material]);
      mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    materials.forEach((m, index) => { if (!buckets.has(index)) m.dispose(); });
    return { group, height };
  }

  function add(id, target) {
    const key = keyOf(id, target);
    if (entries.has(key)) return entries.get(key);
    const spec = DEPLOYMENT_VISUALS[id];
    const pos = position(id, target);
    if (!spec || !pos) return null;
    const { group, height } = deviceKit(id, spec.kind, spec.color);
    group.position.copy(pos); group.name = 'deployment:' + key;
    const room = id === 'EDR' ? building.desks.get(target)?.roomId : spec.room;
    const entry = { key, id, target, room, level: building.rooms.get(room)?.level,
      group, height, color: spec.color, position: pos };
    group.userData = { kind: 'deployment', productId: id, target, roomId: room };
    if (id === 'EDR') {
      const screen = building.desks.get(target)?.screen;
      if (screen) { screen.material.color.setHex(0x80d1ac); screen.material.emissive.setHex(0x397c64); }
    }
    // Unchanged official artwork is a small front-panel decal; the actual chassis
    // or software/console representation carries the scene identity.
    const mark = PRODUCT_MARKS[id];
    if (mark) {
      const texture = new THREE.TextureLoader().load('assets/brand/products/sangfor-' + mark[0], loaded => {
        const ratio = loaded.image.width / loaded.image.height;
        decal.scale.set(Math.min(1, ratio), Math.min(1, 1 / ratio), 1);
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(.23, .23),
        new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff }));
      decal.position.set(id === 'EDR' ? .33 : -.37, id === 'EDR' ? .13 : height - .28, id === 'EDR' ? .398 : .468);
      group.add(decal);
    }
    scene.add(group); entries.set(key, entry);
    group.traverse(object => {
      if (object.isMesh) pickables.push(object);
    });
    return entry;
  }
  function remove(id, target) {
    const key = keyOf(id, target), entry = entries.get(key);
    if (!entry) return;
    const nodes = new Set(); entry.group.traverse(o => nodes.add(o));
    for (let i = pickables.length - 1; i >= 0; i--) if (nodes.has(pickables[i])) pickables.splice(i, 1);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    entry.group.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) {
        materials.add(o.material);
        if (o.material.map) textures.add(o.material.map);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    entry.group.removeFromParent(); entries.delete(key);
    if (id === 'EDR') {
      const screen = building.desks.get(target)?.screen;
      if (screen) { screen.material.color.setHex(0x6fd6ff); screen.material.emissive.setHex(0x6fd6ff); }
    }
  }
  function update() {
    for (const entry of entries.values()) entry.group.visible =
      building.floors.find(f => f.id === entry.level)?.group.visible ?? true;
  }
  return { add, remove, update, entries, pickables,
    get: (id, target) => entries.get(keyOf(id, target)) };
}
