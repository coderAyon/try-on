import assert from 'node:assert/strict';
import * as THREE from 'three';
import { trimTryOnTempleTips, EyewearRig } from '../src/utils/landmarkEyewear';

// A triangle straddling the cutoff must retain its straight section instead of
// disappearing wholesale. Preserve interpolated UVs and material groups.
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute([-4, 0, 0, -4, 0, -8, -4, 1, 0], 3));
geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2));
geometry.addGroup(0, 3, 2);
const trimmed = trimTryOnTempleTips(geometry, [-5, -5]);
assert.equal(trimmed.getAttribute('position').count, 6);
assert.equal(trimmed.groups[0].materialIndex, 2);
assert.equal(trimmed.getAttribute('uv').count, 6);
for (let i = 0; i < 6; i++) assert(trimmed.getAttribute('position').getZ(i) >= -5);
assert.equal(geometry.getAttribute('position').getZ(1), -8, 'Source geometry was mutated');

const model = new THREE.Group();
const front = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3, .4), new THREE.MeshBasicMaterial());
front.name = 'front'; model.add(front);
for (const x of [-4.3, 4.3]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.15, .2, 8), new THREE.MeshBasicMaterial());
  arm.position.set(x, 0, -4); model.add(arm);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(.15, 1, 1), new THREE.MeshBasicMaterial());
  hook.position.set(x, -.5, -7.5); model.add(hook);
}
const rig = new EyewearRig(model);
const frontCopy = rig.group.children.find(mesh => mesh.name === 'front') as THREE.Mesh;
assert.deepEqual(Array.from(frontCopy.geometry.getAttribute('position').array), Array.from(front.geometry.getAttribute('position').array));
const sourceBox = new THREE.Box3().setFromObject(model);
const trimmedBox = new THREE.Box3().setFromObject(rig.group);
assert(trimmedBox.min.z > sourceBox.min.z + 2, 'Hook still extends behind the straight arm');
assert.equal(trimmedBox.max.x, sourceBox.max.x, 'Front width changed');
rig.fitTemples(new THREE.Vector3(-4.4, 0, -4), new THREE.Vector3(4.4, 0, -4));
for (const mesh of rig.group.children as THREE.Mesh[]) {
  const p = mesh.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) assert(Number.isFinite(p.getZ(i)));
}
rig.dispose();
console.log('Temple trim checks passed: hook removed, front/source unchanged, crossing triangles and UV/material groups preserved, fitted vertices finite.');
