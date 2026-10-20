import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyewearPose, EyewearRig } from '../src/utils/landmarkEyewear';

for (const pitch of [0, .5, -.5]) {
  const model = new THREE.Group();
  for (const x of [-2, 2]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(3, 3, .1));
    lens.name = 'lens'; lens.position.x = x; model.add(lens);
  }
  const rig = new EyewearRig(model);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, .6, 0, 'YXZ'));
  const span = 100;
  const pose = {
    bridge: new THREE.Vector3(), position: new THREE.Vector3(), quaternion: q,
    eyeSpan: span, eyeLift: 0, zAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
    yAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(q), surface: [],
  } as unknown as NonNullable<ReturnType<typeof eyewearPose>>;
  const scale = 20;
  const mesh = rig.group.children[0] as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox!;
  // A cheek moves just in front of the lens on the next tracking frame.
  const cheek = bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  cheek.z = bounds.max.z * scale + span * .025;
  rig.fittedPosition(pose, scale);
  pose.surface = [cheek.clone().divideScalar(span)];
  const fitted = rig.fittedPosition(pose, scale);
  const outward = fitted.dot(pose.zAxis);
  assert(outward + bounds.max.z * scale >= cheek.z + span * .0119,
    'First collision frame still buries the lens behind the face');
  assert(outward <= span * .06, 'Correction exceeded nasal-seat limit');
  pose.surface = [new THREE.Vector3(10, 10, -10)];
  const released = rig.fittedPosition(pose, scale).dot(pose.zAxis);
  assert(released < outward && released > outward * .9, 'Clearance release snapped');
  rig.dispose();
}
console.log('PASS: first-frame lens clearance during yaw/nods; bounded displacement and gradual release.');
