import * as THREE from 'three';

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
  // Keep x/y on the eye line; nasal depth sets the front-plane contact clearance.
  const bridge = world(168);
  position.addScaledVector(zAxis, bridge.clone().sub(position).dot(zAxis) + eyeSpan * 0.025);
  return { position, bridge, quaternion, eyeSpan, leftTemple: world(127), rightTemple: world(356), zAxis, yAxis, faceWidth: Math.abs(world(234).sub(world(454)).dot(xAxis)) };
}

type EyewearPose = NonNullable<ReturnType<typeof eyewearPose>>;
// Suppress stationary detector noise, with adaptive response to real movement.
export class StableEyewearPose {
  private rotation: THREE.Quaternion | null = null;
  private previousRotation: THREE.Quaternion | null = null;
  private localAnchor: THREE.Vector3 | null = null;
  private previousSpan = 0;
  private span = 0;
  private velocity = new THREE.Vector3();
  private bridge: THREE.Vector3 | null = null;
  private previousBridge = new THREE.Vector3();
  private bridgeVelocity = new THREE.Vector3();
  private spanVelocity = 0;
  private time = 0;
  reset() { this.rotation = null; this.previousRotation = null; this.localAnchor = null; this.bridge = null; this.time = 0; this.velocity.set(0, 0, 0); this.bridgeVelocity.set(0, 0, 0); this.spanVelocity = 0; }
  update(pose: EyewearPose, now: number): EyewearPose {
    const dt = THREE.MathUtils.clamp((now - this.time) / 1000, 1 / 120, .1);
    const alpha = (cutoff: number) => 1 - Math.exp(-2 * Math.PI * cutoff * dt);
    const offset = pose.position.clone().sub(pose.bridge).applyQuaternion(pose.quaternion.clone().invert()).divideScalar(pose.eyeSpan);
    if (!this.rotation || !this.localAnchor || now - this.time > 250) {
      this.rotation = pose.quaternion.clone(); this.localAnchor = offset.clone(); this.span = pose.eyeSpan;
      this.previousRotation = pose.quaternion.clone(); this.previousSpan = pose.eyeSpan;
      this.bridge = pose.bridge.clone(); this.previousBridge.copy(pose.bridge);
      this.velocity.set(0, 0, 0); this.bridgeVelocity.set(0, 0, 0); this.spanVelocity = 0;
    } else {
      const delta = pose.quaternion.clone().multiply(this.previousRotation!.clone().invert());
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
      const derivative = new THREE.Vector3(delta.x, delta.y, delta.z);
      const length = derivative.length();
      if (length > 1e-8) derivative.multiplyScalar(2 * Math.atan2(length, delta.w) / (length * dt));
      // Signed velocity cancels alternating tracking noise instead of mistaking
      // every tiny shake for a deliberate fast turn.
      this.velocity.lerp(derivative, alpha(2));
      // Quiet poses are damped; deliberate turns raise the cutoff immediately.
      this.rotation.slerp(pose.quaternion, alpha(.75 + Math.max(0, this.velocity.length() - .08) * 8));
      this.localAnchor.lerp(offset, alpha(.7));
      // Signed derivatives prevent alternating noise from opening the filter.
      this.spanVelocity += ((pose.eyeSpan - this.previousSpan) / Math.max(8, this.previousSpan) / dt - this.spanVelocity) * alpha(2);
      const scaleResidual = Math.abs(pose.eyeSpan - this.span) / Math.max(8, this.span);
      this.span += (pose.eyeSpan - this.span) * alpha(.8 + Math.max(0, Math.abs(this.spanVelocity) - .02) * 20 + Math.max(0, scaleResidual - .01) * 120);
      const bridgeDerivative = pose.bridge.clone().sub(this.previousBridge).divideScalar(dt * pose.eyeSpan);
      this.bridgeVelocity.lerp(bridgeDerivative, alpha(2));
      const speed = this.bridgeVelocity.length();
      const displacement = this.bridge!.distanceTo(pose.bridge) / pose.eyeSpan;
      // The residual opens response for a sudden move even before velocity settles.
      const cutoff = .85 + Math.max(0, speed - .025) * 18 + Math.max(0, displacement - .015) * 100;
      this.bridge!.lerp(pose.bridge, alpha(cutoff));
    }
    this.previousBridge.copy(pose.bridge);
    this.time = now; this.previousRotation = pose.quaternion.clone(); this.previousSpan = pose.eyeSpan;
    const quaternion = this.rotation.clone();
    const eyeSpan = this.span;
    const bridge = this.bridge!.clone();
    const position = this.localAnchor.clone().multiplyScalar(eyeSpan).applyQuaternion(quaternion).add(bridge);
    // Width and eye span must represent the same filtered camera distance.
    // Mixing current cheek width with delayed eye span corrupts the fit ratio
    // during zoom and makes that incorrect ratio linger after the motion ends.
    return { ...pose, bridge, position, quaternion, eyeSpan, faceWidth: pose.faceWidth / pose.eyeSpan * eyeSpan,
      yAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
      zAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion) };
  }
}

interface RigMesh { mesh: THREE.Mesh; source: Float32Array }

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
  constructor(model: THREE.Group) {
    model.updateMatrixWorld(true);
    let innerLensEdge = Infinity;
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !/lens/i.test(object.name)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        innerLensEdge = Math.min(innerLensEdge, Math.abs(point.x));
      }
    });
    // Separate lenses translate rigidly; only the bridge between them stretches.
    // Continuous shield lenses crossing the nose keep their original geometry.
    const bridgeExpansion = model.userData?.bridgeExpansion !== undefined
      ? model.userData.bridgeExpansion
      : (Number.isFinite(innerLensEdge) && innerLensEdge > .2 ? .16 : 0);
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
  }
  fittedScale(eyeSpan: number, faceWidth: number) {
    // Smooth proportions only; distance and pose remain immediate.
    const ratio = THREE.MathUtils.clamp(faceWidth / eyeSpan, 1.7, 2.8);
    this.fitRatio = this.fitRatio === null ? ratio : this.fitRatio + (ratio - this.fitRatio) * .035;
    return eyeSpan * Math.max(1 / this.eyeDistance, this.fitRatio * 1.04 / this.frontWidth);
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
