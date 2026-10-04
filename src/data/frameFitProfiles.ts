// Static, per-model corrections. These never modify tracking or smoothing.
export const FRAME_FIT_SCALE: Readonly<Record<string, number>> = {
  'imported-green-round': 1.08,
  'imported-pack-green': 1.08,
  'imported-fly': .90,
};
export function frameFitScale(productId?: string): number {
  return productId ? FRAME_FIT_SCALE[productId] ?? 1 : 1;
}
