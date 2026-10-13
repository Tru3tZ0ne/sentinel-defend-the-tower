// Three.js scene: isometric-leaning camera, soft lighting, constrained orbit, resize,
// and a raycaster for picking. Keeps rendering concerns out of the game logic.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0a0f1d, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0f1d, 42, 78);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(17, 16, 23);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 14;
  controls.maxDistance = 48;
  controls.maxPolarAngle = Math.PI * 0.49;   // don't go under the floor
  controls.minPolarAngle = Math.PI * 0.12;
  controls.minAzimuthAngle = -Math.PI * 0.42; // keep the open (front) faces toward us
  controls.maxAzimuthAngle =  Math.PI * 0.42;
  controls.enablePan = false;
  controls.update();

  // lighting — stylized, cheap (no shadow maps)
  scene.add(new THREE.HemisphereLight(0xaecbff, 0x141a2e, 1.05));
  scene.add(new THREE.AmbientLight(0x5a6c96, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(10, 22, 18); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.4); fill.position.set(-6, 10, 14); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff5a6a, 0.22); rim.position.set(-14, 8, -10); scene.add(rim);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

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

  function render() { controls.update(); renderer.render(scene, camera); }

  window.addEventListener('resize', resize);
  resize();
  return { THREE, scene, camera, renderer, controls, render, resize, pick };
}
