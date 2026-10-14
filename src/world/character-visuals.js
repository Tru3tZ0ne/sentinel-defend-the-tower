// Reviewed office characters. Navigation owns the outer group; animation owns only
// its child model. Geometry, textures and materials are shared across instances.
import * as THREE from 'three';
import { clone as skeletonClone } from '../vendor/three/SkeletonUtils.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';

export const OFFICE_CHARACTERS = [
  { id: 'josh', url: 'assets/models/office/josh.glb' },
  { id: 'martha', url: 'assets/models/office/martha.glb' },
];

export async function loadOfficeCharacters() {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(OFFICE_CHARACTERS.map(async entry => {
    const gltf = await loader.loadAsync(entry.url);
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height < .1) throw new Error('Invalid character bounds');
    for (const name of ['idle', 'walk', 'work']) {
      if (!gltf.animations.some(clip => clip.name === name)) throw new Error('Missing character clip');
    }
    return { ...entry, ...gltf, scale: 1.48 / height, floor: bounds.min.y };
  }));
  return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}

export function createCharacterVisual(template, seed) {
  const root = new THREE.Group();
  const model = skeletonClone(template.scene);
  model.scale.setScalar(template.scale);
  model.position.y = -template.floor * template.scale;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = false;
    // Bind-pose bounds do not enclose every animated pose. There are eight NPCs;
    // floor visibility handles the useful coarse culling without stale skin bounds.
    object.frustumCulled = false;
    object.userData.sharedCharacterAsset = true;
  });
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(template.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  actions.idle.play();
  actions.idle.time = actions.idle.getClip().duration * ((seed * .371) % 1);
  mixer.update(0);
  return { root, model, mixer, actions, activePose: 'idle', isGLB: true, assetId: template.id };
}

export function updateCharacterVisual(figure, dt, pose, speed, visible) {
  if (dt <= 0 || !visible) return;
  const next = figure.actions[pose] ? pose : 'idle';
  if (next !== figure.activePose) {
    const previous = figure.actions[figure.activePose];
    const action = figure.actions[next];
    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    previous.crossFadeTo(action, .22, false);
    figure.activePose = next;
  }
  figure.actions.walk.setEffectiveTimeScale(speed / 1.45);
  figure.mixer.update(dt);
}

export function disposeCharacterVisual(figure) {
  if (!figure.isGLB) return;
  figure.mixer.stopAllAction();
  figure.mixer.uncacheRoot(figure.model);
  const skeletons = new Set();
  figure.model.traverse(object => { if (object.skeleton) skeletons.add(object.skeleton); });
  skeletons.forEach(skeleton => skeleton.dispose());
}
