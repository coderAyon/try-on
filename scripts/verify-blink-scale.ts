import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyewearPose, StableEyewearPose, EyewearRig } from '../src/utils/landmarkEyewear';
import { SUNGLASSES_CATALOG } from '../src/data/catalog';

function face(blink = 0, zoom = 1) {
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }));
  for (const [i, x, y] of [[10,.5,.2], [152,.5,.8], [168,.5,.45],
    [127,.28,.45], [356,.72,.45], [234,.27,.5], [454,.73,.5],
    [33,.36 + blink,.45], [133,.44 + blink,.45],
    [263,.64 - blink,.45], [362,.56 - blink,.45]]) {
    points[i] = { x: .5 + (x - .5) * zoom, y: .5 + (y - .5) * zoom, z: 0 };
  }
  // Uneven squint also changes eye-axis orientation, not just eye spacing.
  points[33].y += blink * .4; points[133].y += blink * .4;
  return eyewearPose(points, 640, 480)!;
}
for (const fps of [20, 30, 60]) {
  const steady = new StableEyewearPose(), blinking = new StableEyewearPose();
  const baseline = steady.update(face(), 0);
  blinking.update(face(), 0);
  const rigs = SUNGLASSES_CATALOG.map(product => {
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(8.8, 3, .4)));
    return [new EyewearRig(model, product.id), new EyewearRig(model, product.id)];
  });
  for (let i = 1; i < fps * 4; i++) {
    const zoom = i < fps * 2 ? 1 : 1 + .2 * Math.sin((i - fps * 2) / fps);
    const open = steady.update(face(0, zoom), i * 1000 / fps);
    const closed = blinking.update(face(.018 * (1 + Math.sin(i * .7)), zoom), i * 1000 / fps);
    assert.ok(Math.abs(open.eyeSpan - closed.eyeSpan) < 1e-9, 'Blink changed scale');
    assert.ok(Math.abs(open.faceWidth - closed.faceWidth) < 1e-9, 'Blink changed fit width');
    if (i < fps * 2) assert.ok(Math.abs(closed.eyeSpan - baseline.eyeSpan) < 1e-9);
    for (const [a, b] of rigs) assert.ok(Math.abs(
      a.fittedScale(open.eyeSpan, open.faceWidth, open.isFrontal) -
      b.fittedScale(closed.eyeSpan, closed.faceWidth, closed.isFrontal)) < 1e-9);
  }
  rigs.flat().forEach(rig => rig.dispose());
  const fresh = face(.02, 1.4);
  assert.equal(blinking.update(fresh, 9000).eyeSpan, fresh.eyeSpan, 'Reacquisition retained stale size');
}
console.log(`Passed: ${SUNGLASSES_CATALOG.length} frame profiles at 20/30/60 FPS; blinking leaves scale unchanged and real zoom still follows the same filter.`);
