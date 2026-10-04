import assert from 'node:assert/strict';
import { SUNGLASSES_CATALOG } from '../src/data/catalog';
import { suggestFrames } from '../src/utils/faceFitAdvisor';
import type { FaceMeasurements, FaceShape } from '../src/types';

const expected: Record<FaceShape, string> = { Oval: 'Oval', Round: 'Round', Square: 'Square', Heart: 'Oval', Diamond: 'Oval' };
const measure = (shape: FaceShape): FaceMeasurements => ({ shape, heightToWidth: 1.2, jawToCheek: .85, foreheadToCheek: .85, samples: 12, measuredAt: Date.now() });
for (const shape of Object.keys(expected) as FaceShape[]) {
  const result = suggestFrames(measure(shape), SUNGLASSES_CATALOG);
  assert.equal(result.shape, shape);
  assert.equal(result.recommendedShape, expected[shape]);
  assert.deepEqual(result.shapes, [expected[shape]]);
  assert.ok(result.frames.length > 0);
  assert.ok(result.frames.every(item => item.shape === expected[shape]));
  const reversed = suggestFrames(measure(shape), [...SUNGLASSES_CATALOG].reverse());
  assert.equal(reversed.recommendedShape, expected[shape]);
  assert.deepEqual(result.frames.map(f => f.product.id).sort(), reversed.frames.map(f => f.product.id).sort());
}
const square = suggestFrames(measure('Square'), SUNGLASSES_CATALOG);
assert.ok(square.frames.length > 6, 'All matching models must remain available beyond six cards');
const medusa = SUNGLASSES_CATALOG.find(p => p.id === 'versace-ve4514d')!;
const fallback = suggestFrames(measure('Heart'), [medusa]);
assert.equal(fallback.recommendedShape, 'Oval');
assert.equal(fallback.frames[0].product.id, medusa.id);
const empty = suggestFrames(measure('Round'), [medusa]);
assert.equal(empty.recommendedShape, null);
assert.deepEqual(empty.frames, []);
assert.deepEqual(suggestFrames(measure('Square'), [medusa]).frames, [], 'Do not substitute oval frames for a square result');
assert.deepEqual(suggestFrames(measure('Square'), []).frames, []);
console.log('All five face types: one matching silhouette, complete model groups, catalog-order independence, sparse and empty catalog checks passed.');
