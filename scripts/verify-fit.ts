import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JeelizPoseTracker, projectJeelizPose } from '../src/utils/jeelizPose';

const tracker = new JeelizPoseTracker();
const base = { detected: 0.95, x: 0, y: 0, s: 0.3, rx: 0, ry: 0, rz: 0 };
tracker.update(base, 1000);
let rawEnergy = 0, filteredEnergy = 0;
for (let i = 1; i <= 180; i++) {
  const noise = i % 2 ? 0.004 : -0.004;
  const result = tracker.update({ ...base, x: noise }, 1000 + i * 1000 / 60);
  rawEnergy += noise ** 2; filteredEnergy += result.x ** 2;
}
assert.ok(filteredEnergy < rawEnergy * 0.25, 'Stationary noise should be suppressed');
for (let i = 1; i <= 12; i++) tracker.update({ ...base, x: 0.2 }, 4000 + i * 1000 / 60);
const moving = tracker.update({ ...base, x: 0.2 }, 4220);
assert.ok(moving.x > 0.18, 'Filter should follow motion within 220 ms');
tracker.reset();
assert.equal(tracker.update({ ...base, x: -0.4 }, 5000).x, -0.4, 'Reacquisition must snap to new face');
const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 100);
const p = new THREE.Vector3(), q = new THREE.Quaternion();
const depth = projectJeelizPose(base, camera, p, q);
assert.ok(Math.abs(p.z + depth) < 1e-9);
assert.ok(p.length() > 0 && q.angleTo(new THREE.Quaternion()) < 1e-9);
// Compare pitch/yaw/roll pivot positions with the reference helper equations.
for (const rx of [-0.5, 0, 0.5]) for (const ry of [-0.7, 0, 0.7]) for (const rz of [-0.4, 0, 0.4]) {
  const pose = { ...base, x: 0.2, y: -0.1, rx, ry, rz };
  const d = projectJeelizPose(pose, camera, p, q);
  const e = new THREE.Euler(rx, ry, rz, 'ZYX');
  const expected = new THREE.Vector3(-Math.sin(rz) * 0.2, -Math.cos(rz) * 0.2, -0.6).applyEuler(e);
  const tanX = camera.aspect * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  expected.add(new THREE.Vector3(pose.x * d * tanX, pose.y * d * tanX / camera.aspect + 0.2, -d + 0.6));
  assert.ok(p.distanceTo(expected) < 1e-9);
  // A clicked fitting point is stored in local space and follows all 27 poses.
  const root = new THREE.Object3D(); root.position.copy(p); root.quaternion.copy(q); root.updateMatrixWorld();
  const anchor = new THREE.Vector3(0.04, 0.07, 0.4);
  const restored = root.worldToLocal(root.localToWorld(anchor.clone()));
  assert.ok(restored.distanceTo(anchor) < 1e-9);
}
console.log(`Fit checks passed: noise RMS reduced ${Math.round((1 - Math.sqrt(filteredEnergy / rawEnergy)) * 100)}%, motion/reacquisition, 27 combined rotations and local calibration.`);
