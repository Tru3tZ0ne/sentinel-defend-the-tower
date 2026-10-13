// Three.js scene: isometric-leaning camera, soft lighting, constrained orbit, resize,
// and a raycaster for picking. Keeps rendering concerns out of the game logic.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x070b16, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070b16, 46, 96);

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 300);
  camera.position.set(15, 15.5, 25);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(1.5, 5.2, 0.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 10;
  controls.maxDistance = 52;
  controls.maxPolarAngle = Math.PI * 0.49;   // don't go under the floor
  controls.minPolarAngle = Math.PI * 0.12;
  controls.minAzimuthAngle = -Math.PI * 0.44; // keep the open (front) faces toward us
  controls.maxAzimuthAngle =  Math.PI * 0.44;
  controls.enablePan = false;
  controls.update();

  // environment backdrop — a dark plaza + distant skyline so the tower sits in a place
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c1324, roughness: 1 }));
  ground.position.y = -0.2; scene.add(ground);
  const grid = new THREE.GridHelper(120, 60, 0x1b2746, 0x12182c);
  grid.position.y = -0.18; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
  const skyline = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2, r = 46 + Math.random() * 26;
    const h = 4 + Math.random() * 20, w = 3 + Math.random() * 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: 0x0e1526, emissive: 0x16233f, emissiveIntensity: 0.25, flatShading: true }));
    b.position.set(Math.cos(a) * r, h / 2 - 0.2, Math.sin(a) * r);
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.6 && Math.cos(a) > 0) continue; // keep the front clear
    skyline.add(b);
  }
  scene.add(skyline);

  // lighting — stylized, cheap (no shadow maps). Key + cool fill + warm/red rims.
  scene.add(new THREE.HemisphereLight(0xb6cfff, 0x0e1420, 0.9));
  scene.add(new THREE.AmbientLight(0x56688f, 0.5));
  const key = new THREE.DirectionalLight(0xfff2e0, 1.25); key.position.set(12, 24, 20); scene.add(key);
  const fill = new THREE.DirectionalLight(0xaecaff, 0.5); fill.position.set(-8, 12, 16); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff6676, 0.3); rim.position.set(-16, 9, -12); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0x4f7bff, 0.28); rim2.position.set(16, 7, -14); scene.add(rim2);

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
