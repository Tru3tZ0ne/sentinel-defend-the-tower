// Three.js scene: isometric-leaning camera, soft lighting, constrained orbit, resize,
// and a raycaster for picking. Keeps rendering concerns out of the game logic.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // soft studio gradient backdrop so the diorama reads like a physical model
  const bg = document.createElement('canvas'); bg.width = 16; bg.height = 256;
  const bgx = bg.getContext('2d'); const grd = bgx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#2b3650'); grd.addColorStop(0.55, '#1b2336'); grd.addColorStop(1, '#10151f');
  bgx.fillStyle = grd; bgx.fillRect(0, 0, 16, 256);
  const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 300);
  camera.position.set(4, 32, 30);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(1.5, 0.3, -1.0);
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

  // lighting — bright, daylight diorama. One warm shadow-casting key + sky fill + ambient.
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x6a6350, 0.42));
  scene.add(new THREE.AmbientLight(0x9fb0c8, 0.22));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.15);
  key.position.set(18, 30, 18); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 90;
  key.shadow.camera.left = -22; key.shadow.camera.right = 22;
  key.shadow.camera.top = 22; key.shadow.camera.bottom = -22;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key); scene.add(key.target); key.target.position.set(0, 0, 0);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.55); fill.position.set(-14, 14, 18); scene.add(fill);
  const back = new THREE.DirectionalLight(0xcfe0ff, 0.3); back.position.set(-10, 10, -18); scene.add(back);

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
