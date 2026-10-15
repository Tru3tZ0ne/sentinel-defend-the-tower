// Realistic office props (floor plant + office chair). Loaded async and swapped in over the
// procedural fallback groups once ready, mirroring the character-visuals load pattern: the scene
// is usable immediately with procedural furniture; the models upgrade it when they arrive.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';

const MODELS = {
  plant: { url: 'assets/models/office/plant01.glb', height: 1.3,  yaw: 0 },
  chair: { url: 'assets/models/office/chair01.glb', height: 0.92, yaw: Math.PI },
};

// Deterministic per-spot yaw jitter so repeated props don't look stamped from one angle.
const jitter = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };

async function loadModel(loader, cfg) {
  const gltf = await loader.loadAsync(cfg.url);
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height < 0.1) throw new Error('Invalid model bounds: ' + cfg.url);
  gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = true; } });
  return { scene: gltf.scene, scale: cfg.height / height, floor: bounds.min.y, yaw: cfg.yaw };
}

// Load every office model; a failed one simply leaves its procedural fallback in place.
export async function loadOfficeModels() {
  const loader = new GLTFLoader();
  const out = {};
  const results = await Promise.allSettled(Object.entries(MODELS).map(async ([key, cfg]) => [key, await loadModel(loader, cfg)]));
  for (const r of results) if (r.status === 'fulfilled') out[r.value[0]] = r.value[1];
  return out;
}

// Replace each procedural fallback group with a scaled clone of its model. Clones share geometry
// and materials with the template (one upload), so many props stay cheap. `facing` on an anchor
// (chairs) is honoured; plants get only the deterministic yaw jitter.
export function applyOfficeModels(templates, propAnchors) {
  let applied = 0;
  for (const a of propAnchors) {
    const t = templates[a.kind];
    if (!t || !a.lg) continue;
    const model = t.scene.clone(true);
    model.scale.setScalar(t.scale);
    model.position.set(a.x, -t.floor * t.scale, a.z);
    model.rotation.y = (a.facing || 0) + t.yaw + (jitter(a.x, a.z) - 0.5) * (a.kind === 'plant' ? Math.PI * 2 : 0.25);
    // Geometry/materials/textures are shared with the template; flag so the stage teardown
    // (which disposes per-build resources) leaves them alone for the next build's swap-in.
    model.traverse(o => { if (o.isMesh) o.userData.sharedPropAsset = true; });
    a.lg.add(model);
    if (a.group) a.group.visible = false;   // hide the procedural fallback, keep it for teardown
    a.model = model;
    applied++;
  }
  return applied;
}
