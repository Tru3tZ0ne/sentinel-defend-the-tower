// Batch repeated meshes without changing geometry, materials or simulation.
import * as THREE from 'three';

export function createBulletInstances(parent) {
  const geometry = new THREE.SphereGeometry(.13, 10, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending,
    transparent: true, opacity: .8, depthWrite: false });
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(1, 1, 2.6), color = new THREE.Color();
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
        const shot = shots[i];
        const dx = wX(shot.vx || 0) - wX(0), dz = wZ(shot.vy ?? -980) - wZ(0);
        matrix.makeRotationY(Math.atan2(dx, dz)).scale(scale).setPosition(wX(shot.x), shot.height || .9, wZ(shot.y));
        mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.set(shot.color));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
    get capacity() { return capacity; },
    dispose() { parent.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); },
  };
}

// Reusable three-layer beams and traveling energy packets for command links.
export function createEnergyInstances(parent) {
  const root = new THREE.Group(); parent.add(root);
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 10), orbGeometry = new THREE.SphereGeometry(1, 12, 8);
  const layers = [[2.8, .12], [1.5, .45], [.5, .95]].map(([width, opacity]) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, material, 64); mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.setColorAt(0, new THREE.Color());
    root.add(mesh); return { mesh, width };
  });
  const orbs = new THREE.InstancedMesh(orbGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }), 64);
  orbs.frustumCulled = false; orbs.setColorAt(0, new THREE.Color()); root.add(orbs);
  const from = new THREE.Vector3(), to = new THREE.Vector3(), delta = new THREE.Vector3(), center = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0), quat = new THREE.Quaternion(), scale = new THREE.Vector3(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  return {
    sync(segments, time, wX, wZ) {
      root.visible = segments.length > 0;
      let orbCount = 0;
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i]; from.set(wX(s.x), s.height ?? 1.15, wZ(s.y)); to.set(wX(s.tx), s.targetHeight ?? s.height ?? 1.15, wZ(s.ty));
        delta.subVectors(to, from); const length = delta.length();
        quat.setFromUnitVectors(axis, delta.normalize()); color.set(s.color);
        for (const layer of layers) {
          scale.set(s.width * layer.width, Math.max(.001, length), s.width * layer.width);
          matrix.compose(center.copy(from).add(to).multiplyScalar(.5), quat, scale);
          layer.mesh.setMatrixAt(i, matrix); layer.mesh.setColorAt(i, color);
        }
        if (s.flow) {
          const t = (time * 2 + i * .13) % 1;
          matrix.makeScale(s.width * 4, s.width * 4, s.width * 4).setPosition(center.copy(from).lerp(to, t));
          orbs.setMatrixAt(orbCount, matrix); orbs.setColorAt(orbCount++, color);
        }
      }
      for (const { mesh } of layers) { mesh.count = segments.length; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
      orbs.count = orbCount; orbs.instanceMatrix.needsUpdate = true; orbs.instanceColor.needsUpdate = true;
    },
    dispose() { root.removeFromParent(); for (const { mesh } of layers) { mesh.dispose(); mesh.material.dispose(); } orbs.dispose(); orbs.material.dispose(); geometry.dispose(); orbGeometry.dispose(); },
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
