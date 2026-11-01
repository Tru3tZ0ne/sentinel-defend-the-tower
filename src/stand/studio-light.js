import * as THREE from 'three';

// A small, locally generated studio reflection map. No HDR download or extra pass.
export function createStudioEnvironment(renderer) {
  const room = new THREE.Scene();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 30),
    new THREE.MeshBasicMaterial({ color: 0x56616e, side: THREE.BackSide }));
  room.add(shell);
  const panels = [[-8, 6, -2, 0, Math.PI / 2, 9, 5], [7, 5, 2, 0, -Math.PI / 2, 7, 4],
    [0, 9, -1, Math.PI / 2, 0, 12, 7]];
  for (const [x, y, z, rx, ry, w, h] of panels) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.2, 4.5), side: THREE.DoubleSide }));
    panel.position.set(x, y, z); panel.rotation.set(rx, ry, 0); room.add(panel);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room, .04, .1, 100);
  generator.dispose();
  room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return target;
}
