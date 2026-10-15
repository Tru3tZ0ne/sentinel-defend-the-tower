// Three.js scene: isometric-leaning camera, soft lighting, constrained orbit, resize,
// and a raycaster for picking. Keeps rendering concerns out of the game logic.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';
import { EffectComposer } from '../vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/postprocessing/OutputPass.js';

export function createWorld(canvas, theme = 'office') {
  const cyber = theme === 'cyber';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cyber ? 1.1 : 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // image-based lighting for realistic reflections on metal/glass/screens
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = cyber ? 0.18 : 0.32;   // keep reflections on metal/glass without flat-filling form
  if (cyber) {
    // Deep-black holographic void: the tower and its neon traces are the only light sources.
    scene.background = new THREE.Color(0x02040a);
    scene.fog = new THREE.FogExp2(0x02040a, 0.013);
  } else {
    // Neutral daylight backdrop keeps floor materials and close views legible.
    const bg = document.createElement('canvas'); bg.width = 16; bg.height = 256;
    const bgx = bg.getContext('2d'); const grd = bgx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#07121f'); grd.addColorStop(0.5, '#142a3a'); grd.addColorStop(1, '#091623');
    bgx.fillStyle = grd; bgx.fillRect(0, 0, 16, 256);
    const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
    scene.fog = new THREE.Fog(0x0c1b28, 50, 150);
  }

  if (!cyber) {
    // A muted city context far below the occupied floors (office theme only).
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x142331, roughness: 0.8, metalness: 0.15 }));
    ground.position.y = -16; ground.receiveShadow = true; scene.add(ground);
    const city = new THREE.Group();
    const random = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 48; i++) {
      const a = random(i + 1) * Math.PI * 2, r = 75 + random(i + 100) * 100;
      const w = 5 + random(i + 200) * 9, h = 10 + random(i + 300) * 42;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({ color: 0x16293a, roughness: 0.9 }));
      b.position.set(Math.cos(a) * r, -16 + h / 2, Math.sin(a) * r); city.add(b);
    }
    scene.add(city);
  }

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 300);
  camera.position.set(1.5, 32, 28);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(-0.5, 0.0, -2.2);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 74;   // room to frame the full three-floor tower
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.minAzimuthAngle = -Math.PI * 0.40; // keep the open front toward us
  controls.maxAzimuthAngle =  Math.PI * 0.40;
  controls.enablePan = false;
  controls.update();

  if (cyber) {
    // Holographic mood: let the tower's own neon emissives + traces carry the image. A dim cool
    // ambient + a soft blue key keep characters and surfaces readable without killing the glow.
    scene.add(new THREE.HemisphereLight(0x25456b, 0x050a14, 0.5));
    scene.add(new THREE.AmbientLight(0x4a6da0, 0.22));
    const key = new THREE.DirectionalLight(0x9fd0ff, 1.1);
    key.position.set(14, 30, 16); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1; key.shadow.camera.far = 120;
    key.shadow.camera.left = -30; key.shadow.camera.right = 30;
    key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
    scene.add(key); scene.add(key.target); key.target.position.set(0, 0, 0);
    const under = new THREE.PointLight(0x2b8bff, 40, 60, 2); under.position.set(0, -2, 0); scene.add(under); // base-platform uplight
  } else {
    // Strong directional key with real shadows gives every object a clear light-to-shade gradient
    // (that is what makes 3D form read as 3D); fill/ambient/IBL are kept low so shadows stay legible.
    scene.add(new THREE.HemisphereLight(0xb7d5ed, 0x4a4438, 0.4));
    scene.add(new THREE.AmbientLight(0xbdcddd, 0.08));
    const key = new THREE.DirectionalLight(0xfff0d2, 3.2);
    key.position.set(18, 34, 15); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1; key.shadow.camera.far = 100;
    key.shadow.camera.left = -24; key.shadow.camera.right = 24;
    key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 2.4;
    scene.add(key); scene.add(key.target); key.target.position.set(0, 0, 0);
    const fill = new THREE.DirectionalLight(0x6fa6cf, 0.38); fill.position.set(-15, 13, 18); scene.add(fill);
    const rim = new THREE.DirectionalLight(0x79c0e2, 0.6); rim.position.set(-12, 8, -18); scene.add(rim);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const clock = new THREE.Clock();

  // Bloom postprocessing for the cyber theme: makes the neon emissives + circuit traces glow.
  let composer = null, bloomPass = null;
  if (cyber) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.2); // strength, radius, threshold
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  // Smooth camera focus: glide the orbit target (and pull in to `dist`) onto a point,
  // preserving the current viewing direction so the player stays oriented.
  let tween = null;
  controls.addEventListener('start', () => { tween = null; });
  const _dir = new THREE.Vector3(), _toPos = new THREE.Vector3();
  function focusOn(point, dist = 13) {
    if (!point) return;
    _dir.copy(camera.position).sub(controls.target);
    const d = Math.min(controls.maxDistance, Math.max(controls.minDistance, dist));
    _dir.normalize().multiplyScalar(d);
    _toPos.copy(point).add(_dir);
    tween = { fromT: controls.target.clone(), toT: point.clone(), fromP: camera.position.clone(), toP: _toPos.clone(), t: 0, dur: 0.75 };
  }
  // Snap the camera to an explicit position/target, cancelling any in-progress focus glide.
  function setView(pos, target) { tween = null; camera.position.copy(pos); controls.target.copy(target); controls.update(); }
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
    // Keep the floor centered in the area beside the inspector and above the deck.
    if (w > 1040) camera.setViewOffset(w, h, Math.min(w * .11, 190), 45, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }

  // Pick the first pickable mesh under a client (px,py) point.
  function pick(px, py, pickables) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((px - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((py - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    for (const h of hits) {
      let visible = true;
      for (let parent = h.object; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
      if (!visible) continue;
      let o = h.object;
      while (o && !o.userData?.kind) o = o.parent;
      if (o?.userData?.kind) return { entity: o.userData, point: h.point, object: o };
    }
    return null;
  }

  function render() { stepTween(clock.getDelta()); controls.update(); if (composer) composer.render(); else renderer.render(scene, camera); }

  window.addEventListener('resize', resize);
  resize();
  return { THREE, scene, camera, renderer, controls, render, resize, pick, focusOn, setView, theme };
}
