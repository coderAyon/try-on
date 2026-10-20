import assert from 'node:assert/strict';
import * as THREE from 'three';
import { faceOcclusionPoint } from '../src/utils/landmarkEyewear';

const out = new THREE.Vector3();
for (const x of [-1.2, -1, -.5, 0, .5, 1, 1.2]) {
  for (const y of [-1, -.15, .6]) {
    const p = new THREE.Vector3(x, y, -.4), original = p.clone();
    faceOcclusionPoint(p, out);
    assert(p.equals(original), 'Occlusion mutated measured anatomy');
    assert.equal(out.y, y);
    assert(Math.abs(out.z - (p.z - .008)) < 1e-12);
    assert(Math.abs(out.x) <= Math.abs(x), 'Mask expanded outside skin');
    assert(Math.abs(out.x - x) <= .040001, 'Inset exceeded its bound');
    if (Math.abs(x) <= .65 || y === -1 || y === .6) assert.equal(out.x, x, 'Central face or non-temple silhouette changed');
  }
}
// At a side view a near arm touching the measured temple must sit in front
// of the corrected mask; the far arm must remain behind the near-side skin.
for (const yaw of [-1, -.6, .6, 1]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, yaw, .1, 'YXZ'));
  const side = yaw > 0 ? -1 : 1;
  const near = new THREE.Vector3(side * 1.1, -.15, -.4);
  const far = new THREE.Vector3(-side * 1.1, -.15, -.4);
  const mask = faceOcclusionPoint(near, new THREE.Vector3()).applyQuaternion(q);
  assert(near.clone().applyQuaternion(q).z > mask.z, 'Near arm is occluded at skin contact');
  assert(far.applyQuaternion(q).z < mask.z, 'Far arm depth ordering was lost');
}
console.log('PASS: bounded temple-only skin bias; anatomy unchanged; near/far arm depth ordering through left/right turns.');

for (const width of [.8, 1.1, 1.5]) for (const height of [-.35, -.15, .1]) {
  const profile = { left: { width, height }, right: { width, height } };
  const skin = new THREE.Vector3(width, height, -.4);
  faceOcclusionPoint(skin, out, profile);
  assert(Math.abs(out.x - (width - .04)) < 1e-10, 'Clearance missed the measured temple');
  faceOcclusionPoint(new THREE.Vector3(.3, height, -.4), out, profile);
  assert.equal(out.x, .3, 'Personalization changed central face');
}
console.log('PASS: personalized mask across narrow/wide faces and different temple heights.');

for (const pitch of [0, .3, .7, -.7]) for (const yaw of [-.6, 0, .6]) {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,.15,'YXZ'));
  const view = new THREE.Vector3(0,0,1).applyQuaternion(rotation.clone().invert());
  for (const side of [-1,1]) {
    const skin = new THREE.Vector3(side*1.1,-.15,-.4);
    const previous = faceOcclusionPoint(skin,new THREE.Vector3()).applyQuaternion(rotation);
    const corrected = faceOcclusionPoint(skin,new THREE.Vector3(),undefined,view).applyQuaternion(rotation);
    assert(Math.abs(previous.x-corrected.x)<1e-10 && Math.abs(previous.y-corrected.y)<1e-10,
      'Nod correction changed projected skin position');
    assert(corrected.z <= previous.z+1e-10 && previous.z-corrected.z<=.040001);
    if (Math.abs(pitch)>.6 && skin.x*view.x>=-.1) assert(previous.z-corrected.z>.02,'Nod did not clear visible temple depth');
    if (pitch===0 || skin.x*view.x<-.1) assert(previous.distanceTo(corrected)<1e-10,'Front/far-side mask changed');
  }
}
console.log('PASS: nod depth bias preserves screen position, frontal mask and far-side occlusion.');
