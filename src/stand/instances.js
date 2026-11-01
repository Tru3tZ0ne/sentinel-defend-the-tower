// Batch repeated meshes without changing geometry, materials or simulation.
import * as THREE from 'three';

export function createBulletInstances(parent) {
  const geometry = new THREE.SphereGeometry(.13, 10, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending,
    transparent: true, opacity: .8, depthWrite: false });
  const matrix = new THREE.Matrix4().makeScale(1, 1, 2.6), color = new THREE.Color();
  let mesh, capacity = 0;
  function reserve(count) {
    if (mesh && capacity >= count) return;
    if (mesh) { parent.remove(mesh); mesh.dispose(); }
    capacity = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, count))));
    mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, color); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0; parent.add(mesh);
  }
  reserve(0);
  return {
    sync(shots, wX, wZ) {
      reserve(shots.length); mesh.count = shots.length; mesh.visible = shots.length > 0;
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i]; matrix.setPosition(wX(shot.x), .9, wZ(shot.y));
        mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.set(shot.color));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
    get capacity() { return capacity; },
    dispose() { parent.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); },
  };
}

export function createEnemyInstances(art, parent, capacity) {
  // Separate hit/cloak materials preserve the existing emission and opacity.
  // Parts retain the exact original geometry and cast/receive the same shadows.
  const batches = new Map();
  let activeBatches = 0;
  function getBatch(enemy, radius, revealed) {
    const key = `${enemy.type}:${!!(enemy.spec.cloak && !revealed)}:${enemy.hit > 0}`;
    if (batches.has(key)) return batches.get(key);
    const source = art.enemy(enemy, radius);
    source.group.removeFromParent();
    const parts = [];
    source.group.traverse(part => {
      if (!part.isMesh) return;
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
      mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
      mesh.userData.sharedStandGeometry = true; parent.add(mesh);
      parts.push({ mesh, source: part });
    });
    const batch = { source, parts, count: 0 }; batches.set(key, batch); return batch;
  }
  return {
    sync(enemies, time, revealed, wX, wZ, wR) {
      for (const batch of batches.values()) batch.count = 0;
      for (const enemy of enemies) {
        const radius = wR(enemy.r), batch = getBatch(enemy, radius, revealed);
        const source = batch.source;
        source.group.scale.setScalar(radius * .79);
        source.group.position.set(wX(enemy.x), radius + .35, wZ(enemy.y));
        art.animateEnemy(source, enemy, time, revealed);
        source.group.updateMatrixWorld(true);
        for (const part of batch.parts) part.mesh.setMatrixAt(batch.count, part.source.matrixWorld);
        batch.count++;
      }
      activeBatches = 0;
      for (const batch of batches.values()) {
        if (batch.count) activeBatches++;
        for (const { mesh } of batch.parts) {
          mesh.count = batch.count; mesh.visible = batch.count > 0;
          if (batch.count) mesh.instanceMatrix.needsUpdate = true;
        }
      }
    },
    get activeBatches() { return activeBatches; },
    get cachedBatches() { return batches.size; },
    dispose() {
      const materials = new Set();
      for (const batch of batches.values()) for (const { mesh } of batch.parts) {
        parent.remove(mesh); mesh.dispose(); materials.add(mesh.material);
      }
      materials.forEach(material => material.dispose()); batches.clear();
    },
  };
}
