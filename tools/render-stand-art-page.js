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
  scene.fog = new THREE.Fog(0x14252d, 8, 22);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xd8eeff, 0x41533e, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-3, 6, -4); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10; key.shadow.camera.right = 10;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.bias = -.0003;
  const rim = new THREE.DirectionalLight(0x9fcf7a, 2); rim.position.set(3, 3, 4); scene.add(rim);
  const laneFrame = new THREE.Group();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const art = createSangforArt({ scene, laneFrame, renderer, camera, markTex, brandTex, laneW: 18, length: 34 });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const assets = {}, visible = new THREE.Group(); scene.add(visible);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x060b11, roughness: .75, metalness: .15 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; floor.receiveShadow = true; scene.add(floor);
  const fixture = { levels: {} };
  art.sync(fixture, { wX: x => x, wZ: y => y, fieldL: -9, fieldR: 9, baseY: 0, bandY: 0 });
  const getModel = id => id === 'COMMAND' ? art.operator() : art.product(id);
  for (const id of ['EDR', 'MDR', 'NDR', 'HCI', 'IAG', 'ASTOR', 'XDR', 'AF']) {
    visible.clear(); const model = getModel(id); model.visible = true;
    if (id === 'AF') { model.userData.wall.scale.x = 2.7; model.userData.top.scale.x = 2.7;
      model.userData.posts.forEach(p => p.grp.position.x = p.side * 1.35); }
    visible.add(model); art.sync(fixture, { wX: x => x, wZ: y => y, fieldL: -9, fieldR: 9, baseY: 0, bandY: 0 });
    renderer.setSize(720, 480); camera.aspect = 1.5;
    camera.position.set(2.9, 2.1, -4.5); camera.lookAt(0, .65, 0); camera.updateProjectionMatrix();
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
