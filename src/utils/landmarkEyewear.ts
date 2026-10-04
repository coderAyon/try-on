import * as THREE from 'three';
import { frameFitScale } from '../data/frameFitProfiles';

export interface Landmark { x: number; y: number; z: number }
export function landmarkWorld(p: Landmark, width: number, height: number): THREE.Vector3 {
  // MediaPipe z uses the same scale as normalized x. No arbitrary depth factor.
  return new THREE.Vector3((p.x - 0.5) * width, (0.5 - p.y) * height, -p.z * width);
}

export function eyewearPose(landmarks: Landmark[], width: number, height: number) {
  if (landmarks.length < 468 || landmarks.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) return null;
  const world = (i: number) => landmarkWorld(landmarks[i], width, height);
  const leftEye = world(33).add(world(133)).multiplyScalar(0.5);
  const rightEye = world(263).add(world(362)).multiplyScalar(0.5);
  const xAxis = rightEye.clone().sub(leftEye);
  const eyeSpan = xAxis.length();
  if (eyeSpan < 8) return null;
  xAxis.normalize();
  const up = world(10).sub(world(152)).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, up).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  const position = leftEye.clone().add(rightEye).multiplyScalar(0.5);
  const bridge = world(168);
  // Natural resting position:
  // Sunglasses bridge rests on the nasal saddle / radix (landmark 168),
  // naturally framing the supraorbital brow and centering the eyes at the optical 62-65% height of the lenses.
  const bridgeHeight = bridge.clone().sub(position).dot(yAxis);
  const naturalBrowLift = Math.max(eyeSpan * 0.10, bridgeHeight * 0.80);
  position.addScaledVector(yAxis, naturalBrowLift);
  position.addScaledVector(zAxis, bridge.clone().sub(position).dot(zAxis) + eyeSpan * 0.025);

  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
  const isFrontal = Math.abs(euler.y) < 0.26 && Math.abs(euler.x) < 0.26;

  return {
    position,
    bridge,
    quaternion,
    eyeSpan,
    leftTemple: world(127),
    rightTemple: world(356),
    zAxis,
    yAxis,
    faceWidth: Math.abs(world(234).sub(world(454)).dot(xAxis)),
    isFrontal,
  };
}

type EyewearPose = NonNullable<ReturnType<typeof eyewearPose>>;
// Suppress stationary detector noise, with adaptive response to real movement.
export class StableEyewearPose {
  private rotation: THREE.Quaternion | null = null;
  private previousRotation: THREE.Quaternion | null = null;
  private localAnchor: THREE.Vector3 | null = null;
  private previousSpan = 0;
  private span = 0;
  private frontalSpan: number | null = null;
  private velocity = new THREE.Vector3();
  private angularDirection = new THREE.Vector3();
  private coherentAngularSamples = 0;
  private bridge: THREE.Vector3 | null = null;
  private previousBridge = new THREE.Vector3();
  private bridgeVelocity = new THREE.Vector3();
  private spanVelocity = 0;
  private time = 0;

  reset() {
    this.rotation = null;
    this.previousRotation = null;
    this.localAnchor = null;
    this.bridge = null;
    this.time = 0;
    this.velocity.set(0, 0, 0);
    this.angularDirection.set(0, 0, 0);
    this.coherentAngularSamples = 0;
    this.bridgeVelocity.set(0, 0, 0);
    this.spanVelocity = 0;
    this.frontalSpan = null;
  }

  update(pose: EyewearPose, now: number): EyewearPose {
    const dt = THREE.MathUtils.clamp((now - this.time) / 1000, 1 / 120, 0.1);
    const alpha = (cutoff: number) => 1 - Math.exp(-2 * Math.PI * cutoff * dt);
    const offset = pose.position.clone().sub(pose.bridge).applyQuaternion(pose.quaternion.clone().invert()).divideScalar(pose.eyeSpan);

    if (!this.rotation || !this.localAnchor || now - this.time > 250) {
      this.rotation = pose.quaternion.clone();
      this.localAnchor = offset.clone();
      this.span = pose.eyeSpan;
      this.frontalSpan = pose.eyeSpan;
      this.previousRotation = pose.quaternion.clone();
      this.previousSpan = pose.eyeSpan;
      this.bridge = pose.bridge.clone();
      this.previousBridge.copy(pose.bridge);
      this.velocity.set(0, 0, 0);
      this.angularDirection.set(0, 0, 0);
      this.coherentAngularSamples = 0;
      this.bridgeVelocity.set(0, 0, 0);
      this.spanVelocity = 0;
    } else {
      // 1. Intelligent Angular Velocity & Rotation Responsiveness
      const delta = pose.quaternion.clone().multiply(this.previousRotation!.clone().invert());
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
      const derivative = new THREE.Vector3(delta.x, delta.y, delta.z);
      const length = derivative.length();
      if (length > 1e-8) derivative.multiplyScalar(2 * Math.atan2(length, delta.w) / (length * dt));

      this.coherentAngularSamples = derivative.dot(this.angularDirection) > 0
        ? this.coherentAngularSamples + 1 : 0;
      this.angularDirection.copy(derivative);
      this.velocity.lerp(derivative, alpha(3));
      const rotSpeed = this.velocity.length();
      // Responsive cutoff: adapts smoothly to speed so turns follow immediately with zero lag
      // Alternating small detector errors must not open the movement filter.
      // Coherent turns and larger movements retain the existing fast response.
      const stationaryRotation = this.coherentAngularSamples < 2 && this.rotation.angleTo(pose.quaternion) < .045;
      const rotCutoff = stationaryRotation ? 1.2 : 1.2 + Math.max(0, rotSpeed - 0.03) * 18 + Math.min(12, rotSpeed * 35);
      this.rotation.slerp(pose.quaternion, alpha(rotCutoff));
      this.localAnchor.lerp(offset, alpha(0.8));

      // 2. Continuous Adaptive One-Euro Scale Filter (Butter-smooth zoom in/out + rock-solid stationary lock)
      // Low-pass filtered derivative (cutoff 0.85 Hz) prevents detector frame-to-frame noise from spiking velocity
      const spanDerivative = (pose.eyeSpan - this.previousSpan) / (dt * Math.max(8, this.span));
      this.spanVelocity += (spanDerivative - this.spanVelocity) * alpha(0.85);

      // Deadband filters out stationary sensor tremor so filter stays locked at fmin when sitting still
      const zoomSpeed = Math.max(0, Math.abs(this.spanVelocity) - 0.05);

      // Rotational damping: suppress spurious scale expansion during rapid head turns
      const rotDamping = 1.0 / (1.0 + Math.max(0, rotSpeed - 0.03) * 10.0);

      // Adaptive cutoff frequency:
      // - Stationary lock (zoomSpeed === 0): cutoff = 0.38 Hz guarantees rock-solid, zero-tremor stability ("kapakapi kora jabe na")
      // - Active zoom (zoomSpeed > 0): smoothly scales cutoff up to 4.5+ Hz for fluid, lag-free zoom in/out
      const spanCutoff = 0.38 + zoomSpeed * 28.0 * rotDamping;
      this.span += (pose.eyeSpan - this.span) * alpha(spanCutoff);

      // 3. Fast Nose Bridge Position Responsiveness
      const bridgeDerivative = pose.bridge.clone().sub(this.previousBridge).divideScalar(dt * pose.eyeSpan);
      this.bridgeVelocity.lerp(bridgeDerivative, alpha(3));
      const speed = this.bridgeVelocity.length();
      const displacement = this.bridge!.distanceTo(pose.bridge) / Math.max(8, pose.eyeSpan);
      const posCutoff = displacement < .015 ? 1.4
        : 1.4 + Math.max(0, speed - 0.02) * 22 + Math.max(0, displacement - 0.01) * 120;
      this.bridge!.lerp(pose.bridge, alpha(posCutoff));
    }

    this.previousBridge.copy(pose.bridge);
    this.time = now;
    this.previousRotation = pose.quaternion.clone();
    this.previousSpan = pose.eyeSpan;

    const quaternion = this.rotation.clone();
    const eyeSpan = this.span;
    const bridge = this.bridge!.clone();
    const position = this.localAnchor.clone().multiplyScalar(eyeSpan).applyQuaternion(quaternion).add(bridge);
    return {
      ...pose,
      bridge,
      position,
      quaternion,
      eyeSpan,
      faceWidth: (pose.faceWidth / pose.eyeSpan) * eyeSpan,
      yAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
      zAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
    };
  }
}

interface RigMesh { mesh: THREE.Mesh; source: Float32Array }

// Trim the AR copy in model space, before arm deformation. This also handles
// imported CAD files whose front and hooked arms share a single mesh/material.
export function trimTryOnTempleTips(geometry: THREE.BufferGeometry, depths: readonly number[]): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  let needsTrim = false;
  for (let i = 0; i < position.count; i++) {
    if (position.getZ(i) < depths[position.getX(i) < 0 ? 0 : 1]) { needsTrim = true; break; }
  }
  if (!needsTrim) return geometry.clone();
  const attributes = Object.entries(geometry.attributes);
  const output = new Map(attributes.map(([name]) => [name, [] as number[]]));
  const index = geometry.index;
  const count = index?.count ?? position.count;
  const result = new THREE.BufferGeometry();
  type Vertex = Record<string, number[]>;
  const read = (i: number): Vertex => Object.fromEntries(attributes.map(([name, attribute]) =>
    [name, Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(i, component))]));
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
  for (const group of groups) {
    const start = output.get('position')!.length / 3;
    for (let offset = group.start; offset + 2 < Math.min(count, group.start + group.count); offset += 3) {
      const triangle = [0, 1, 2].map(n => read(index ? index.getX(offset + n) : offset + n));
      const side = triangle.reduce((sum, v) => sum + v.position[0], 0) < 0 ? 0 : 1;
      const cutoff = depths[side];
      const polygon: Vertex[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3];
        const insideA = a.position[2] >= cutoff, insideB = b.position[2] >= cutoff;
        if (insideA) polygon.push(a);
        if (insideA !== insideB) {
          const t = (cutoff - a.position[2]) / (b.position[2] - a.position[2]);
          polygon.push(Object.fromEntries(attributes.map(([name]) => [name, a[name].map((value, j) => value + (b[name][j] - value) * t)])));
        }
      }
      for (let i = 1; i + 1 < polygon.length; i++) {
        for (const vertex of [polygon[0], polygon[i], polygon[i + 1]]) {
          for (const [name] of attributes) output.get(name)!.push(...vertex[name]);
        }
      }
    }
    result.addGroup(start, output.get('position')!.length / 3 - start, group.materialIndex);
  }
  for (const [name, attribute] of attributes) result.setAttribute(name, new THREE.Float32BufferAttribute(output.get(name)!, attribute.itemSize));
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

// Each AR instance owns baked geometry. Never deform the showroom/cache geometry.
export class EyewearRig {
  readonly group = new THREE.Group();
  readonly eyeDistance: number;
  readonly frontWidth: number;
  private fitRatio: number | null = null;
  private meshes: RigMesh[] = [];
  private hingeDepth = -.55;
  private tails = [new THREE.Vector3(-4.4, 0, -6), new THREE.Vector3(4.4, 0, -6)];
  private lastLeft: THREE.Vector3 | null = null;
  private lastRight: THREE.Vector3 | null = null;
  constructor(model: THREE.Group, private readonly productId?: string) {
    model.updateMatrixWorld(true);
    let innerLensEdge = Infinity;
    const rawLensBounds = [new THREE.Box3(), new THREE.Box3()];
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !/lens/i.test(object.name)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        innerLensEdge = Math.min(innerLensEdge, Math.abs(point.x));
        rawLensBounds[point.x < 0 ? 0 : 1].expandByPoint(point);
      }
    });
    // Separate lenses translate rigidly; only the bridge between them stretches.
    // Continuous shield lenses crossing the nose keep their original geometry.
    const rawEyeDistance = rawLensBounds.some(box => box.isEmpty()) ? 0 : rawLensBounds[0].getCenter(new THREE.Vector3()).distanceTo(rawLensBounds[1].getCenter(new THREE.Vector3()));
    // A fixed expansion misses narrow imported aviators. Enforce a 0.26 gap /
    // eye-spacing ratio for two separate lenses (about 16 mm at a 63 mm IPD).
    // Translate lenses rigidly, stretch only the central bridge, and leave
    // continuous shield lenses crossing the nose untouched.
    const minimumExpansion = innerLensEdge > .05 && rawEyeDistance > 0
      ? THREE.MathUtils.clamp((.26 * rawEyeDistance - 2 * innerLensEdge) / (2 * (1 - .26)), 0, .55) : 0;
    const defaultExpansion = model.userData?.bridgeExpansion !== undefined
      ? model.userData.bridgeExpansion
      : (Number.isFinite(innerLensEdge) && innerLensEdge > .2 ? .16 : 0);
    const bridgeExpansion = Math.max(defaultExpansion, minimumExpansion);
    const left = new THREE.Box3(), right = new THREE.Box3();
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.name === 'contact-shadow') return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      const mesh = new THREE.Mesh(geometry, object.material);
      mesh.name = object.name;
      mesh.renderOrder = object.renderOrder;
      const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
      if (bridgeExpansion) {
        for (let i = 0; i < attribute.count; i++) {
          const x = attribute.getX(i);
          attribute.setX(i, x + bridgeExpansion * THREE.MathUtils.clamp(x / innerLensEdge, -1, 1));
        }
        geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      }
      const source = new Float32Array(attribute.array);
      this.meshes.push({ mesh, source }); this.group.add(mesh);
      for (let i = 0; i < attribute.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(attribute, i);
        if (/lens/i.test(object.name)) (point.x < 0 ? left : right).expandByPoint(point);
      }
    });
    const lensBounds = left.clone().union(right);
    if (!lensBounds.isEmpty()) this.hingeDepth = Math.min(-.55, lensBounds.min.z - .12);
    const front = new THREE.Box3(), back = [Infinity, Infinity];
    for (const { source } of this.meshes) {
      for (let i = 0; i < source.length; i += 3) {
        if (source[i + 2] >= this.hingeDepth) front.expandByPoint(new THREE.Vector3(source[i], source[i + 1], source[i + 2]));
        back[source[i] < 0 ? 0 : 1] = Math.min(back[source[i] < 0 ? 0 : 1], source[i + 2]);
      }
    }
    const tips = [new THREE.Box3(), new THREE.Box3()];
    const contactFraction = model.userData.templeContactFraction ?? .8;
    const contacts = back.map(depth => this.hingeDepth + (depth - this.hingeDepth) * contactFraction);
    const contactBounds = [new THREE.Box3(), new THREE.Box3()];
    const nearest = [Infinity, Infinity];
    // Sparse CAD arms may have no vertex exactly at the desired contact section.
    for (const { source } of this.meshes) for (let i = 0; i < source.length; i += 3) {
      const side = source[i] < 0 ? 0 : 1;
      if (source[i + 2] < this.hingeDepth) nearest[side] = Math.min(nearest[side], Math.abs(source[i + 2] - contacts[side]));
    }
    for (const { source } of this.meshes) {
      for (let i = 0; i < source.length; i += 3) {
        const side = source[i] < 0 ? 0 : 1;
        const point = new THREE.Vector3(source[i], source[i + 1], source[i + 2]);
        if (source[i + 2] < back[side] + .3) tips[side].expandByPoint(point);
        if (source[i + 2] < this.hingeDepth && Math.abs(source[i + 2] - contacts[side]) <= nearest[side] + .15) contactBounds[side].expandByPoint(point);
      }
    }
    tips.forEach((box, side) => {
      if (box.isEmpty()) return;
      box.getCenter(this.tails[side]);
      if (contactBounds[side].isEmpty()) return;
      const contact = contactBounds[side].getCenter(new THREE.Vector3());
      // A downward hook is below the actual ear-rest section. Do not lift the
      // complete arm to align that hook's bottom with a temple landmark.
      if (model.userData.templeContactFraction || contact.y - this.tails[side].y > .2) this.tails[side].copy(contact);
    });
    this.frontWidth = front.isEmpty() ? 8.8 : Math.max(1, front.max.x - front.min.x);
    this.eyeDistance = left.isEmpty() || right.isEmpty() ? 4.4 :
      left.getCenter(new THREE.Vector3()).distanceTo(right.getCenter(new THREE.Vector3()));
    // End the visible straight arm slightly ahead of the ear-rest section.
    // Retain the original full-model fit anchors and sizing above: removing a
    // hook must never change the eye alignment, landmark pose or scale filter.
    const cutoffs = this.tails.map((tail, side) => {
      if (!Number.isFinite(back[side]) || back[side] >= this.hingeDepth) return -Infinity;
      const contactDepth = Math.max(tail.z, contacts[side]);
      return this.hingeDepth + (contactDepth - this.hingeDepth) * .85;
    });
    for (const entry of this.meshes) {
      const original = entry.mesh.geometry;
      entry.mesh.geometry = trimTryOnTempleTips(original, cutoffs);
      entry.source = new Float32Array(entry.mesh.geometry.getAttribute('position').array);
      original.dispose();
    }
  }
  fittedScale(eyeSpan: number, faceWidth: number, isFrontal = true) {
    // Smooth proportions only; distance and pose remain immediate.
    const ratio = THREE.MathUtils.clamp(faceWidth / Math.max(1, eyeSpan), 1.8, 2.8);
    if (this.fitRatio === null) {
      this.fitRatio = ratio;
    } else if (isFrontal) {
      // Calibrate face-to-eye width proportion during frontal view
      this.fitRatio += (ratio - this.fitRatio) * 0.035;
    }
    return eyeSpan * Math.max(1 / this.eyeDistance, this.fitRatio * 1.04 / this.frontWidth) * frameFitScale(this.productId);
  }
  fitTemples(leftEar: THREE.Vector3, rightEar: THREE.Vector3) {
    // These are head-local proportions, not screen positions. Reuse the fitted
    // geometry while they remain within roughly a pixel to avoid heavy uploads.
    if (this.lastLeft && this.lastRight && this.lastLeft.distanceTo(leftEar) < .04 && this.lastRight.distanceTo(rightEar) < .04) return;
    // Filter only head-local arm proportions; the shared head pose stays intact.
    if (!this.lastLeft || !this.lastRight) { this.lastLeft = leftEar.clone(); this.lastRight = rightEar.clone(); }
    else { this.lastLeft.lerp(leftEar, .18); this.lastRight.lerp(rightEar, .18); }
    const hingeDepth = this.hingeDepth;
    for (const { mesh, source } of this.meshes) {
      const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const x = source[i * 3], y = source[i * 3 + 1], z = source[i * 3 + 2];
        if (z >= hingeDepth) continue;
        const ear = x < 0 ? this.lastLeft : this.lastRight;
        const tail = this.tails[x < 0 ? 0 : 1];
        const t = THREE.MathUtils.clamp((hingeDepth - z) / Math.max(.5, hingeDepth - tail.z), 0, 1.5);
        const targetZ = Math.min(hingeDepth - 0.2, ear.z - 0.35);
        positions.setXYZ(i,
          x + (ear.x - tail.x) * t,
          y + (ear.y - tail.y) * t,
          hingeDepth + (targetZ - hingeDepth) * t,
        );
      }
      positions.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    }
  }
  dispose() {
    const materials = new Set<THREE.Material>();
    for (const { mesh } of this.meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    materials.forEach(material => material.dispose());
  }
}
