/**
 * Turns a generated GLB (one mesh: float positions + uint32 indices, y up,
 * frame front facing +z or -z) into face-ready geometry:
 *  - units: frame-front width = 1, origin between the lenses on the pupil line
 *  - axes: x right, y down, z into the head (front of the lenses at z = 0)
 *  - per-vertex normals and a projection of the product photo onto the front
 */

export interface FrameModel {
  positions: Float32Array; // local, x/y/z
  normals: Float32Array;
  uvs: Float32Array;       // product-photo coordinates (0..1) for front-facing parts
  photoWeight: Float32Array; // 1 = take colour from the photo, 0 = frame colour
  indices: Uint32Array;
  depth: number;           // front-to-back extent (arms), in frame widths
}

export function parseGlb(buf: ArrayBuffer): { positions: Float32Array; indices: Uint32Array } {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const prim = json.meshes[0].primitives[0];
  const view = (acc: any) => {
    const bv = json.bufferViews[acc.bufferView];
    return binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
  };
  const pa = json.accessors[prim.attributes.POSITION];
  const positions = new Float32Array(buf.slice(view(pa), view(pa) + pa.count * 12));
  let indices: Uint32Array;
  if (prim.indices !== undefined) {
    const ia = json.accessors[prim.indices];
    const off = view(ia);
    if (ia.componentType === 5125) indices = new Uint32Array(buf.slice(off, off + ia.count * 4));
    else if (ia.componentType === 5123) indices = Uint32Array.from(new Uint16Array(buf.slice(off, off + ia.count * 2)));
    else indices = Uint32Array.from(new Uint8Array(buf.slice(off, off + ia.count)));
  } else {
    indices = Uint32Array.from({ length: pa.count }, (_, i) => i);
  }
  return { positions, indices };
}

export function prepareFrameModel(raw: { positions: Float32Array; indices: Uint32Array }): FrameModel {
  const P = raw.positions, n = P.length / 3;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const W = maxX - minX, D = maxZ - minZ;
  const cxAll = (minX + maxX) / 2;

  // The front is the end whose slab has geometry in the middle (lenses and
  // bridge); the far end only has the two arm tips at the sides.
  const slab = D * 0.15;
  let nearPlus = 0, nearMinus = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(P[i * 3] - cxAll) > W * 0.3) continue;
    const z = P[i * 3 + 2];
    if (z > maxZ - slab) nearPlus++;
    if (z < minZ + slab) nearMinus++;
  }
  const sign = nearPlus >= nearMinus ? 1 : -1;     // +1: front at +z
  const zFront = sign > 0 ? maxZ : minZ;

  // Front slab bounds give the visible front (width, lens band).
  let fMinX = Infinity, fMaxX = -Infinity, fMinY = Infinity, fMaxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if ((zFront - P[i * 3 + 2]) * sign > slab) continue;
    const x = P[i * 3], y = P[i * 3 + 1];
    if (x < fMinX) fMinX = x; if (x > fMaxX) fMaxX = x;
    if (y < fMinY) fMinY = y; if (y > fMaxY) fMaxY = y;
  }
  const fw = Math.max(1e-6, fMaxX - fMinX);
  const cx = (fMinX + fMaxX) / 2;
  // Optical centre sits a little above the middle of the lens band.
  const pupilY = fMaxY - (fMaxY - fMinY) * 0.46;

  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = (P[i * 3] - cx) / fw;
    positions[i * 3 + 1] = (pupilY - P[i * 3 + 1]) / fw;
    positions[i * 3 + 2] = (zFront - P[i * 3 + 2]) * sign / fw;
  }
  // Flipping y alone mirrors the mesh; mirror x back when the front faced -z
  // (the z flip already cancelled it in the +z case).
  if (sign < 0) for (let i = 0; i < n; i++) positions[i * 3] = -positions[i * 3];

  // Area-weighted vertex normals in local space.
  const normals = new Float32Array(n * 3);
  const I = raw.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
  }
  // Orient normals outward (away from the mesh centre) — winding may be either way.
  let outward = 0;
  const mzc = (D / fw) * 0.5;
  for (let i = 0; i < n; i += 7) {
    const dx = positions[i * 3], dy = positions[i * 3 + 1], dz = positions[i * 3 + 2] - mzc;
    outward += dx * normals[i * 3] + dy * normals[i * 3 + 1] + dz * normals[i * 3 + 2];
  }
  const flip = outward < 0 ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    normals[i * 3] = x / l * flip; normals[i * 3 + 1] = y / l * flip; normals[i * 3 + 2] = z / l * flip;
  }

  // Project the product photo onto the front: photo spans the front slab box.
  const uvs = new Float32Array(n * 2);
  const photoWeight = new Float32Array(n);
  const top = (pupilY - fMaxY) / fw, bottom = (pupilY - fMinY) / fw;
  const depthLimit = 0.12;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    uvs[i * 2] = x + 0.5;
    uvs[i * 2 + 1] = (y - top) / Math.max(1e-6, bottom - top);
    const facing = -normals[i * 3 + 2]; // toward the viewer (−z)
    const front = Math.max(0, Math.min(1, (facing - 0.15) / 0.45));
    const near = Math.max(0, Math.min(1, (depthLimit - z) / (depthLimit * 0.5)));
    photoWeight[i] = front * near;
  }

  return { positions, normals, uvs, photoWeight, indices: raw.indices, depth: D / fw };
}
