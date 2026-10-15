// Realistic office props (currently the floor plant). Loaded async and swapped in over the
// procedural hero-plant groups once ready, mirroring the character-visuals load pattern:
// the scene is usable immediately with procedural greenery; the model upgrades it when it arrives.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';

const PROP_URL = 'assets/models/office/plant01.glb';
const TARGET_HEIGHT = 1.3;   // world units; matches the procedural big-plant silhouette

// Deterministic per-anchor yaw so repeated plants don't look stamped from one angle.
const yawFor = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return (v - Math.floor(v)) * Math.PI * 2; };

export async function loadPlantModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(PROP_URL);
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height < 0.1) throw new Error('Invalid plant bounds');
  const scale = TARGET_HEIGHT / height;
  gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = true; } });
  return { scene: gltf.scene, scale, floor: bounds.min.y };
}

// Replace each procedural hero-plant group with a scaled clone of the model. The clone shares
// geometry and materials with the template (one upload), so N plants stay cheap.
export function applyPlantModel(template, propAnchors) {
  let applied = 0;
  for (const a of propAnchors) {
    if (a.kind !== 'plant' || !a.lg) continue;
    const model = template.scene.clone(true);
    model.scale.setScalar(template.scale);
    model.position.set(a.x, -template.floor * template.scale, a.z);
    model.rotation.y = yawFor(a.x, a.z);
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
