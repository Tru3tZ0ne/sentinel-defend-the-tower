// Three.js scene: isometric-leaning camera, soft lighting, constrained orbit, resize,
// and a raycaster for picking. Keeps rendering concerns out of the game logic.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // image-based lighting for realistic reflections on metal/glass/screens
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.13;   // subtle realistic reflections without washing out the night mood
  // night security-operations backdrop: a dark room with a cool glow toward the top
  const bg = document.createElement('canvas'); bg.width = 16; bg.height = 256;
  const bgx = bg.getContext('2d'); const grd = bgx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#111b2e'); grd.addColorStop(0.5, '#0a1120'); grd.addColorStop(1, '#05070e');
  bgx.fillStyle = grd; bgx.fillRect(0, 0, 16, 256);
  const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
  scene.fog = new THREE.Fog(0x070b16, 44, 115);

  // a real place, not a model on a table: a dark ground far below + a night-city skyline
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x090e18, roughness: 0.9, metalness: 0.2 }));
  ground.position.y = -16; ground.receiveShadow = true; scene.add(ground);
  const city = new THREE.Group();
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 120;
    const w = 5 + Math.random() * 9, h = 10 + Math.random() * 60;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: 0x0b1222, emissive: 0x1a2f52, emissiveIntensity: 0.35 + Math.random() * 0.3, roughness: 0.85 }));
    b.position.set(Math.cos(a) * r, -16 + h / 2, Math.sin(a) * r); city.add(b);
  }
  scene.add(city);

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 300);
  camera.position.set(1.5, 33, 29);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-0.5, 0.0, -2.2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 16;
  controls.maxDistance = 48;
  controls.maxPolarAngle = Math.PI * 0.42;   // keep a high dollhouse angle so we see into rooms
  controls.minPolarAngle = Math.PI * 0.08;
  controls.minAzimuthAngle = -Math.PI * 0.40; // keep the open front toward us
  controls.maxAzimuthAngle =  Math.PI * 0.40;
  controls.enablePan = false;
  controls.update();

  // lighting — night ops. A cool moonlight key (soft shadows) + very low fill; the building's
  // own warm interior lights and glowing screens do most of the work, so the model reads like
  // a lit scale model at night.
  scene.add(new THREE.HemisphereLight(0x3f557c, 0x090b12, 0.24));
  scene.add(new THREE.AmbientLight(0x4a5a78, 0.12));
  const key = new THREE.DirectionalLight(0xaec6f2, 0.62);
  key.position.set(16, 30, 16); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 90;
  key.shadow.camera.left = -22; key.shadow.camera.right = 22;
  key.shadow.camera.top = 22; key.shadow.camera.bottom = -22;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key); scene.add(key.target); key.target.position.set(0, 0, 0);
  const fill = new THREE.DirectionalLight(0x6f86b8, 0.22); fill.position.set(-14, 14, 18); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x2f6ea0, 0.28); rim.position.set(-12, 8, -18); scene.add(rim);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const clock = new THREE.Clock();

  // Smooth camera focus: glide the orbit target (and pull in to `dist`) onto a point,
  // preserving the current viewing direction so the player stays oriented.
  let tween = null;
  const _dir = new THREE.Vector3(), _toPos = new THREE.Vector3();
  function focusOn(point, dist = 13) {
    if (!point) return;
    _dir.copy(camera.position).sub(controls.target);
    const d = Math.min(controls.maxDistance, Math.max(controls.minDistance, dist));
    _dir.normalize().multiplyScalar(d);
    _toPos.copy(point).add(_dir);
    tween = { fromT: controls.target.clone(), toT: point.clone(), fromP: camera.position.clone(), toP: _toPos.clone(), t: 0, dur: 0.75 };
  }
  function stepTween(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2; // easeInOutQuad
    controls.target.lerpVectors(tween.fromT, tween.toT, e);
    camera.position.lerpVectors(tween.fromP, tween.toP, e);
    if (tween.t >= 1) tween = null;
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Pick the first pickable mesh under a client (px,py) point.
  function pick(px, py, pickables) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((px - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((py - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData?.kind) o = o.parent;
      if (o?.userData?.kind) return { entity: o.userData, point: h.point, object: o };
    }
    return null;
  }

  function render() { stepTween(clock.getDelta()); controls.update(); renderer.render(scene, camera); }

  window.addEventListener('resize', resize);
  resize();
  return { THREE, scene, camera, renderer, controls, render, resize, pick, focusOn };
}
