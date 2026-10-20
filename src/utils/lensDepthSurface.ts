import * as THREE from 'three';

// A small head-local depth map of the actual lenses. Build once per rig, then
// query in constant time; no raycasts or triangle scans in the camera loop.
// Empty cells keep cheeks outside a round/cat-eye lens from pushing it forward.
export class LensDepthSurface {
  readonly bounds = new THREE.Box3();
  private readonly size = 32;
  private readonly depth = new Float32Array(32 * 32).fill(-Infinity);
  constructor(geometries: THREE.BufferGeometry[]) {
    for (const geometry of geometries) {
      geometry.computeBoundingBox();
      if (geometry.boundingBox) this.bounds.union(geometry.boundingBox);
    }
    const extent = this.bounds.getSize(new THREE.Vector3());
    if (extent.x <= 0 || extent.y <= 0) return;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const cellX = (x: number) => THREE.MathUtils.clamp(Math.floor((x - this.bounds.min.x) / extent.x * this.size), 0, this.size - 1);
    const cellY = (y: number) => THREE.MathUtils.clamp(Math.floor((y - this.bounds.min.y) / extent.y * this.size), 0, this.size - 1);
    for (const geometry of geometries) {
      const p = geometry.getAttribute('position'), index = geometry.index;
      const count = index?.count ?? p.count;
      for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(p, index ? index.getX(i) : i);
        b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1);
        c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2);
        const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(denominator) < 1e-10) continue;
        const minX = cellX(Math.min(a.x, b.x, c.x)), maxX = cellX(Math.max(a.x, b.x, c.x));
        const minY = cellY(Math.min(a.y, b.y, c.y)), maxY = cellY(Math.max(a.y, b.y, c.y));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
          const px = this.bounds.min.x + (x + .5) / this.size * extent.x;
          const py = this.bounds.min.y + (y + .5) / this.size * extent.y;
          const u = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / denominator;
          const v = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / denominator;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const at = y * this.size + x;
          this.depth[at] = Math.max(this.depth[at], u * a.z + v * b.z + (1 - u - v) * c.z);
        }
      }
    }
  }
  at(x: number, y: number): number | null {
    if (this.bounds.isEmpty() || x < this.bounds.min.x || x > this.bounds.max.x || y < this.bounds.min.y || y > this.bounds.max.y) return null;
    const ix = Math.min(this.size - 1, Math.floor((x - this.bounds.min.x) / (this.bounds.max.x - this.bounds.min.x) * this.size));
    const iy = Math.min(this.size - 1, Math.floor((y - this.bounds.min.y) / (this.bounds.max.y - this.bounds.min.y) * this.size));
    const z = this.depth[iy * this.size + ix];
    return Number.isFinite(z) ? z : null;
  }
}
