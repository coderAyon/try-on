import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EyewearRig } from '../src/utils/landmarkEyewear';

function model() {
  const group = new THREE.Group();
  for (const x of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, .1));
    lens.name = 'lens'; lens.position.x = x; group.add(lens);
  }
  return group;
}
for (const [id, multiplier] of Object.entries({
  'imported-green-round': 1.08, 'imported-pack-green': 1.08,
  'imported-fly': .9, 'unmodified-frame': 1,
})) {
  const original = new EyewearRig(model());
  const corrected = new EyewearRig(model(), id);
  for (let i = 0; i < 300; i++) {
    const eyes = 60 + 12 * Math.sin(i / 23);
    const width = eyes * (2.2 + .1 * Math.cos(i / 17));
    const frontal = i % 4 !== 0;
    const baseline = original.fittedScale(eyes, width, frontal);
    const actual = corrected.fittedScale(eyes, width, frontal);
    assert.ok(Math.abs(actual / baseline - multiplier) < 1e-12, id);
  }
}
console.log('Passed: 1,200 scale samples; per-model corrections preserve the existing scale-filter response.');
