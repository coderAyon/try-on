import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyewearPose, faceBoundedScale, StableFaceScale } from '../src/utils/landmarkEyewear';

// Real screen coordinates stay fixed while inferred depth/scale is wrong.
// Unlike rigid 3D rotation tests, this checks what the user actually sees.
for (const yaw of [-1, -.6, 0, .6, 1]) for (const pitch of [0, .65]) {
  for (const zoom of [.7, 1, 1.3]) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, .2, 'YXZ'));
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const pose = {
      xAxis: axis,
      screenFaceSpan: axis.clone().multiplyScalar(260 * zoom).setZ(0),
    } as NonNullable<ReturnType<typeof eyewearPose>>;
    const frontWidth = 10;
    const normal = 26 * zoom;
    assert.equal(faceBoundedScale(pose, frontWidth, normal), normal, 'Normal fit changed');
    const oversized = normal * 1.4;
    const corrected = faceBoundedScale(pose, frontWidth, oversized);
    assert(Math.abs(corrected / normal - 1.04) < 1e-10, 'Rendered width exceeds face allowance');
    // A delayed rotation must not leave the old frame wider than the face.
    pose.xAxis = new THREE.Vector3(1, 0, 0);
    const delayed = faceBoundedScale(pose, frontWidth, oversized);
    assert(delayed * frontWidth <= Math.abs(pose.screenFaceSpan.x) * 1.04 + 1e-9);
  }
}
console.log('PASS: screen width bounds for yaw, nod, roll, distance changes and rotation lag; normal fit preserved.');

for (const fps of [20, 30, 60]) {
  const filter = new StableFaceScale();
  const pose = {
    xAxis: new THREE.Vector3(Math.cos(.7), 0, -Math.sin(.7)),
    screenFaceSpan: new THREE.Vector3(),
  } as NonNullable<ReturnType<typeof eyewearPose>>;
  let rawEnergy = 0, filteredEnergy = 0;
  for (let i = 0; i < fps * 3; i++) {
    const noise = .03 * Math.sin(i * 2.1);
    pose.screenFaceSpan.set(260 * Math.cos(.7) * (1 + noise), 0, 0);
    const raw = faceBoundedScale(pose, 10, 35);
    const actual = filter.update(pose, 10, 35, i * 1000 / fps);
    if (i > fps) {
      rawEnergy += (raw - 27.04) ** 2;
      filteredEnergy += (actual - 27.04) ** 2;
    }
  }
  assert(filteredEnergy < rawEnergy * .15, 'Side-view width noise bypassed smoothing');
  filter.reset();
  pose.screenFaceSpan.set(260 * Math.cos(.7), 0, 0);
  const before = filter.update(pose, 10, 35, 3000);
  pose.screenFaceSpan.multiplyScalar(1.3);
  const after = filter.update(pose, 10, 35 * 1.3, 3000 + 1000 / fps);
  assert(Math.abs(after / before - 1.3) < .002, 'Real distance change was delayed');
  filter.reset();
  pose.screenFaceSpan.multiplyScalar(.7);
  assert.equal(filter.update(pose, 10, 35, 4000), faceBoundedScale(pose, 10, 35), 'New face retained previous fit');
}
console.log('PASS: oblique width jitter reduced at 20/30/60 FPS; distance response and reacquisition preserved.');
