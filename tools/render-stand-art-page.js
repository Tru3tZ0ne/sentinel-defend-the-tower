// Browser-side asset build helper. Renders the actual game meshes, not stock art.
import * as THREE from '../vendor/three/three.module.min.js';
import { createSangforArt } from '../src/stand/sangfor-art.js';
import { PRODUCT_MARKS } from '../src/ui/product-marks.js';

export async function renderStandArtwork() {
  const loader = new THREE.TextureLoader();
  const load = async path => { const t = await loader.loadAsync(path); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const entries = await Promise.all(Object.entries(PRODUCT_MARKS).map(async ([id, info]) =>
    [id, await load('assets/brand/products/sangfor-' + info[0])]));
  const markTex = Object.fromEntries(entries), brandTex = await load('assets/brand/sangfor-logo-white.png');
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x14252d);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xd8eeff, 0x41533e, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-3, 6, -4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fcf7a, 2); rim.position.set(3, 3, 4); scene.add(rim);
  const laneFrame = new THREE.Group();
  const art = createSangforArt({ scene, laneFrame, camera, markTex, brandTex, laneW: 18, length: 34 });
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const assets = {}, visible = new THREE.Group(); scene.add(visible);
  const factories = { EDR: art.turret, MDR: art.ally, NDR: art.radar, HCI: art.core, AF: art.barrier,
    COMMAND: art.operator };
  const fixture = { levels: { IAG: 1, ASTOR: 1, XDR: 1 } };
  art.sync(fixture, { wX: x => x, wZ: y => y, fieldL: -9, fieldR: 9, baseY: 0, bandY: 0 });
  const installed = scene.getObjectByName('sangfor:installed-products');
  const auxModels = Object.fromEntries([...installed.children].map(o => [o.name.split(':')[1], o]));
  installed.visible = false;
  const getModel = id => {
    if (factories[id]) return factories[id]();
    const model = auxModels[id].clone(true); model.scale.setScalar(1); model.position.set(0, 0, 0); return model;
  };
  for (const id of ['EDR', 'MDR', 'NDR', 'HCI', 'IAG', 'ASTOR', 'XDR', 'AF']) {
    visible.clear(); const model = getModel(id); model.visible = true;
    if (id === 'AF') { model.userData.wall.scale.x = 2.7; model.userData.top.scale.x = 2.7;
      model.userData.posts.forEach(p => p.grp.position.x = p.side * 1.35); }
    visible.add(model); art.sync(fixture, { wX: x => x, wZ: y => y, fieldL: -9, fieldR: 9, baseY: 0, bandY: 0 });
    renderer.setSize(360, 240); camera.aspect = 1.5;
    camera.position.set(3.1, 2.6, -4.4); camera.lookAt(0, .75, 0); camera.updateProjectionMatrix();
    renderer.render(scene, camera); assets[id.toLowerCase()] = renderer.domElement.toDataURL('image/webp', .9);
  }
  visible.clear();
  for (const [id, x] of [['NDR', -3.4], ['EDR', -1.5], ['COMMAND', .7], ['HCI', 2.9], ['XDR', 4.7]]) {
    const model = getModel(id); model.visible = true; model.position.set(x, 0, 0); visible.add(model);
  }
  art.sync(fixture, { wX: x => x, wZ: y => y, fieldL: -9, fieldR: 9, baseY: 0, bandY: 0 });
  renderer.setSize(1360, 360); camera.aspect = 1360 / 360;
  camera.position.set(1, 3.5, -5.8); camera.lookAt(.5, .65, 0); camera.updateProjectionMatrix();
  renderer.render(scene, camera); assets['equipment-preview'] = renderer.domElement.toDataURL('image/webp', .92);
  renderer.dispose(); art.dispose(); Object.values(markTex).forEach(t => t.dispose()); brandTex.dispose();
  return assets;
}
