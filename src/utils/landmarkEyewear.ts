import * as THREE from 'three';
import { frameFitScale } from '../data/frameFitProfiles';
import { LensDepthSurface } from './lensDepthSurface';

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
  // Average the lower brow contour on both sides, in head-local coordinates.
  // Multiple points keep one noisy landmark / raised eyebrow from dominating.
  const browHeight = [46, 53, 52, 276, 283, 282]
    .reduce((sum, i) => sum + world(i).sub(position).dot(yAxis), 0) / 6;
  // Natural resting position:
  // Sunglasses bridge rests on the nasal saddle / radix (landmark 168),
  // Keep the optical centre near the eyes, with a bounded lift for the nasal saddle.
  const bridgeHeight = bridge.clone().sub(position).dot(yAxis);
  const browLimit = browHeight > eyeSpan * .08 ? browHeight * .30 : eyeSpan * .08;
  const naturalBrowLift = THREE.MathUtils.clamp(
    Math.min(bridgeHeight * .55, browLimit), eyeSpan * .04, eyeSpan * .10);
  position.addScaledVector(yAxis, naturalBrowLift);
  position.addScaledVector(zAxis, bridge.clone().sub(position).dot(zAxis) + eyeSpan * 0.012);

  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
  const isFrontal = Math.abs(euler.y) < 0.26 && Math.abs(euler.x) < 0.26;
  const headAxis = world(356).sub(world(127)).normalize();
  // Build the head-local face surface with one inverse transform per frame.
  // The previous per-landmark quaternion clone/invert added hundreds of
  // temporary objects to the synchronous camera loop and made lower-end GPUs
  // drop tracking frames during turns.
  const inverseQuaternion = quaternion.clone().invert();
  const templeProfile = [127, 356].map(i => {
    const p = world(i).sub(bridge).applyQuaternion(inverseQuaternion).divideScalar(eyeSpan);
    return { width: THREE.MathUtils.clamp(Math.abs(p.x), .8, 1.5),
      height: THREE.MathUtils.clamp(p.y, -.4, .15) };
  });

  return {
    position,
    skinProfile: { left: templeProfile[0], right: templeProfile[1] },
    bridge,
    // Normalized face anatomy, anchored to the nasal saddle rather than screen axes.
    surface: landmarks.slice(0, 468).map((_, i) => world(i).sub(bridge)
      .applyQuaternion(inverseQuaternion).divideScalar(eyeSpan)),
    eyeLift: naturalBrowLift,
    browHeight: browHeight > eyeSpan * .08 ? browHeight : undefined,
    quaternion,
    eyeSpan,
    // Temple landmarks are outside the eyelids and do not contract on a blink.
    scaleSpan: world(127).distanceTo(world(356)),
    // Upper-face height is independent of jaw opening and horizontal depth noise.
    scaleHeight: world(10).distanceTo(world(168)),
    scaleFaceWidth: Math.abs(world(234).sub(world(454)).dot(headAxis)),
    scaleAxis: headAxis,
    // Screen-space cheek span provides a depth-independent size ceiling.
    screenFaceSpan: world(454).sub(world(234)).setZ(0),
    leftTemple: world(127),
    rightTemple: world(356),
    xAxis,
    zAxis,
    yAxis,
    faceWidth: Math.abs(world(234).sub(world(454)).dot(xAxis)),
    isFrontal,
  };
}

type EyewearPose = NonNullable<ReturnType<typeof eyewearPose>>;

// Bound the rendered front against the face in the same orthographic image.
// Use the rendered axis (including rotation smoothing), not inferred landmark
// depth: an inflated z estimate must not allow an oversized visible frame.
export function faceBoundedScale(pose: EyewearPose, frontWidth: number, scale: number) {
  const axis = new THREE.Vector2(pose.xAxis.x, pose.xAxis.y);
  const projection = axis.length();
  if (!pose.screenFaceSpan || projection < .25 || frontWidth <= 0) return scale;
  axis.divideScalar(projection);
  const visibleWidth = Math.abs(pose.screenFaceSpan.x * axis.x + pose.screenFaceSpan.y * axis.y);
  if (visibleWidth < 8) return scale;
  return Math.min(scale, visibleWidth * 1.04 / (frontWidth * projection));
}

// Smooth only the face-width correction, not camera-distance scale. Raw cheek
// landmarks otherwise bypass StableEyewearPose and resize the frame each tick.
export class StableFaceScale {
  private ratio = 1;
  private time: number | null = null;
  reset() { this.time = null; this.ratio = 1; }
  update(pose: EyewearPose, frontWidth: number, scale: number, now: number) {
    if (scale <= 0) return scale;
    const projection = Math.hypot(pose.xAxis.x, pose.xAxis.y);
    // Near profile the projected width is ill-conditioned. Retain the last
    // reliable proportion; distance scaling continues through `scale`.
    const target = projection < .3 && this.time !== null
      ? this.ratio : faceBoundedScale(pose, frontWidth, scale) / scale;
    if (this.time === null || now - this.time > 250) this.ratio = target;
    else {
      const dt = THREE.MathUtils.clamp((now - this.time) / 1000, 1 / 120, .1);
      const cutoff = Math.abs(target - this.ratio) > .08 ? 6 : 1.5;
      this.ratio += (target - this.ratio) * (1 - Math.exp(-2 * Math.PI * cutoff * dt));
    }
    this.time = now;
    return scale * this.ratio;
  }
}
// Suppress stationary detector noise, with adaptive response to real movement.
export class StableEyewearPose {
  private rotation: THREE.Quaternion | null = null;
  private previousRotation: THREE.Quaternion | null = null;
  private localAnchor: THREE.Vector3 | null = null;
  private previousSpan = 0;
  private span = 0;
  private headToEyeRatio = 1;
  private headToFaceRatio = 1;
  private previousScaleAxis: THREE.Vector3 | null = null;
  private scaleAngularSpeed = 0;
  private heightToEyeRatio = 1;
  private velocity = new THREE.Vector3();
  private angularDirection = new THREE.Vector3();
  private coherentAngularSamples = 0;
  private bridge: THREE.Vector3 | null = null;
  private previousBridge = new THREE.Vector3();
  private bridgeVelocity = new THREE.Vector3();
  private previousBridgeDirection = new THREE.Vector3();
  private coherentBridgeSamples = 0;
  private spanVelocity = 0;
  private time = 0;
  private browRatio: number | undefined;
  private liftRatio = .08;
  private surface: THREE.Vector3[] | null = null;
  private skinProfile: EyewearPose['skinProfile'] | null = null;

  reset() {
    this.rotation = null;
    this.previousRotation = null;
    this.localAnchor = null;
    this.bridge = null;
    this.time = 0;
    this.browRatio = undefined;
    this.surface = null;
    this.skinProfile = null;
    this.velocity.set(0, 0, 0);
    this.angularDirection.set(0, 0, 0);
    this.coherentAngularSamples = 0;
    this.bridgeVelocity.set(0, 0, 0);
    this.previousBridgeDirection.set(0, 0, 0);
    this.coherentBridgeSamples = 0;
    this.spanVelocity = 0;
    this.heightToEyeRatio = 1;
    this.headToEyeRatio = 1;
    this.headToFaceRatio = 1;
    this.previousScaleAxis = null;
    this.scaleAngularSpeed = 0;
  }

  update(pose: EyewearPose, now: number): EyewearPose {
    const dt = THREE.MathUtils.clamp((now - this.time) / 1000, 1 / 120, 0.1);
    const alpha = (cutoff: number) => 1 - Math.exp(-2 * Math.PI * cutoff * dt);
    const headSpan = pose.scaleSpan && pose.scaleSpan > 8 ? pose.scaleSpan : null;
    const reacquiring = !this.rotation || !this.localAnchor || now - this.time > 250;
    // Learn temple proportions once per face acquisition, not per noisy turn.
    if (reacquiring) this.skinProfile = pose.skinProfile ?? null;
    if (reacquiring) this.headToEyeRatio = headSpan ? pose.eyeSpan / headSpan : 1;
    if (reacquiring) this.headToFaceRatio = pose.scaleFaceWidth && pose.scaleFaceWidth > 8
      ? pose.faceWidth / pose.scaleFaceWidth : 1;
    const heightSpan = pose.scaleHeight > 8 ? pose.scaleHeight : null;
    if (reacquiring) this.heightToEyeRatio = heightSpan ? pose.eyeSpan / heightSpan : 1;
    const templeSpan = headSpan ? headSpan * this.headToEyeRatio : pose.eyeSpan;
    // Keep facial proportions fixed until reacquisition. Taking a running maximum
    // of eye/temple ratios permanently enlarged the frame after noisy turns.
    let measuredSpan = templeSpan;
    if (heightSpan && headSpan) {
      const heightEstimate = heightSpan * this.heightToEyeRatio;
      const angles = new THREE.Euler().setFromQuaternion(pose.quaternion, 'YXZ');
      // During yaw, estimated temple depth can inflate while upper-face height
      // stays reliable. Fade this cross-check out during pitch (foreshortening).
      const yawWeight = Math.sin(angles.y) ** 2 / (Math.sin(angles.y) ** 2 + Math.sin(angles.x) ** 2 + .025);
      const corroborated = THREE.MathUtils.clamp(templeSpan, heightEstimate * .98, heightEstimate * 1.02);
      measuredSpan = THREE.MathUtils.lerp(templeSpan, corroborated, yawWeight);
      // A nod must not disable the upper bound: inferred temple depth can
      // inflate during combined pitch/yaw too. Only cap expansion here; do
      // not force growth from the height estimate. Both spans still follow
      // real camera-distance changes together.
      measuredSpan = Math.min(measuredSpan, heightEstimate * 1.02);
    }
    const measuredFaceWidth = pose.scaleFaceWidth && pose.scaleFaceWidth > 8
      ? pose.scaleFaceWidth * this.headToFaceRatio : pose.faceWidth;
    // Preserve the detector's current face shape at oblique angles. Replaying
    // a frozen frontal shape gave incorrect temple targets on real head nods.
    const surfaceRatio = pose.eyeSpan / measuredSpan;
    // This pose owns its per-frame surface array, so scale it in place instead
    // of cloning 468 Vector3 objects on every camera frame.
    if (pose.surface) {
      for (const point of pose.surface) point.multiplyScalar(surfaceRatio);
      if (reacquiring || !this.surface || this.surface.length !== pose.surface.length) {
        this.surface = pose.surface;
      } else {
        // Smooth the face occluder in head-local space. The glasses pose still
        // follows the filtered head transform immediately; smoothing only
        // prevents raw mesh noise from making lens edges pop through the skin.
        const surfaceAlpha = alpha(5);
        for (let i = 0; i < pose.surface.length; i++) this.surface[i].lerp(pose.surface[i], surfaceAlpha);
      }
    } else this.surface = null;
    if (reacquiring) this.browRatio = undefined;
    // Eyebrow landmarks are expressive and move independently of the nose and
    // eyes. Lock their contribution after acquisition so a brow raise cannot
    // pull the sunglasses up or down. A new face/dropout reacquires a baseline.
    if (reacquiring && pose.browHeight !== undefined) {
      this.browRatio = pose.browHeight / measuredSpan;
    }
    if (reacquiring) {
      this.liftRatio = (pose.eyeLift ?? measuredSpan * .08) / measuredSpan;
    }
    const offset = pose.position.clone().sub(pose.bridge).applyQuaternion(pose.quaternion.clone().invert()).divideScalar(measuredSpan);

    if (!this.rotation || !this.localAnchor || now - this.time > 250) {
      this.rotation = pose.quaternion.clone();
      this.localAnchor = offset.clone();
      this.span = measuredSpan;

      this.previousRotation = pose.quaternion.clone();
      this.previousSpan = measuredSpan;
      this.bridge = pose.bridge.clone();
      this.previousBridge.copy(pose.bridge);
      this.velocity.set(0, 0, 0);
      this.angularDirection.set(0, 0, 0);
      this.coherentAngularSamples = 0;
      this.bridgeVelocity.set(0, 0, 0);
      this.previousBridgeDirection.set(0, 0, 0);
      this.coherentBridgeSamples = 0;
      this.spanVelocity = 0;
      this.previousScaleAxis = pose.scaleAxis?.clone() ?? null;
      this.scaleAngularSpeed = 0;
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
      this.velocity.lerp(derivative, alpha(1.5));
      const rotSpeed = this.velocity.length();
      // Adaptive response follows intentional turns while damping detector noise.
      // Alternating small detector errors must not open the movement filter.
      // Coherent turns and larger movements retain the existing fast response.
      const stationaryRotation = this.coherentAngularSamples < 2 && rotSpeed < .45 && this.rotation.angleTo(pose.quaternion) < .045;
      const rotCutoff = stationaryRotation ? 0.48
        : 0.9 + Math.max(0, rotSpeed - 0.03) * 3.4 + Math.min(2.1, rotSpeed * 2.1);
      // Keep some smoothing active even during a nod; a fast detector sample
      // should not make the complete frame snap to a noisy landmark estimate.
      this.rotation.slerp(pose.quaternion, alpha(Math.min(6.5, rotCutoff)));
      const bridgeDerivative = pose.bridge.clone().sub(this.previousBridge).divideScalar(dt * measuredSpan);
      this.coherentBridgeSamples = bridgeDerivative.dot(this.previousBridgeDirection) > 0
        ? this.coherentBridgeSamples + 1 : 0;
      this.previousBridgeDirection.copy(bridgeDerivative);
      this.bridgeVelocity.lerp(bridgeDerivative, alpha(3));
      const speed = this.bridgeVelocity.length();
      const displacement = this.bridge!.distanceTo(pose.bridge) / Math.max(8, measuredSpan);
      const posCutoff = displacement < .015 ? 0.9
        : 0.95 + Math.max(0, speed - 0.02) * 7 + Math.max(0, displacement - 0.01) * 30;
      // Calibrate the model origin from a reliable frontal view.  In profile
      // the visible eye midpoint moves because one eye is occluded; updating
      // the local origin from that midpoint makes the whole frame detach and
      // jump.  During a turn, keep this calibrated offset and follow only the
      // stable nasal bridge below.
      // The nasal seat is anatomical: keep it fixed through turns and returns.
      // Re-learning it as the head crosses frontal caused a rocking motion.

      // 2. Continuous Adaptive One-Euro Scale Filter (Butter-smooth zoom in/out + rock-solid stationary lock)
      // Low-pass filtered derivative (cutoff 0.85 Hz) prevents detector frame-to-frame noise from spiking velocity
      const spanDerivative = (measuredSpan - this.previousSpan) / (dt * Math.max(8, this.span));
      this.spanVelocity += (spanDerivative - this.spanVelocity) * alpha(0.85);

      // Deadband filters out stationary sensor tremor so filter stays locked at fmin when sitting still
      const zoomSpeed = Math.max(0, Math.abs(this.spanVelocity) - 0.05);

      // Rotational damping: suppress spurious scale expansion during rapid head turns
      // Scale damping must also ignore eyelid-induced eye-axis rotation.
      if (pose.scaleAxis && this.previousScaleAxis) {
        const headSpeed = pose.scaleAxis.angleTo(this.previousScaleAxis) / dt;
        this.scaleAngularSpeed += (headSpeed - this.scaleAngularSpeed) * alpha(3);
      }
      const scaleRotSpeed = pose.scaleAxis ? this.scaleAngularSpeed : rotSpeed;
      const rotDamping = 1.0 / (1.0 + Math.max(0, scaleRotSpeed - 0.03) * 10.0);

      const spanDisplacement = Math.abs(measuredSpan - this.span) / Math.max(8, this.span);
      const displacementBonus = Math.max(0, spanDisplacement - 0.012) * 26.0;

      // Adaptive cutoff frequency:
      // - Stationary lock (zoomSpeed === 0, displacement < 1.2%): cutoff = 0.38 Hz guarantees rock-solid, zero-tremor stability ("kapakapi kora jabe na")
      // - Active zoom / approach response: smoothly scales cutoff up to 4.5+ Hz for fluid, instant zoom in/out
      const spanCutoff = 0.38 + (zoomSpeed * 28.0 + displacementBonus) * rotDamping;

      // Apply the same response to growth and shrinkage; asymmetric filtering
      // ratchets size upward on repeated left/right movements.
      this.span += (measuredSpan - this.span) * alpha(Math.min(7.0, spanCutoff));

      // Keep the translation filter independent: position noise must not open
      // the rotation filter and amplify wobble when the head is moving.
      const movementResponse = this.coherentBridgeSamples >= 2
        ? THREE.MathUtils.smoothstep(speed, .04, .35) : 0;
      const translationCutoff = THREE.MathUtils.lerp(posCutoff, Math.max(posCutoff, 10), movementResponse);
      this.bridge!.lerp(pose.bridge, alpha(Math.min(20, translationCutoff)));
    }

    this.previousBridge.copy(pose.bridge);
    this.time = now;
    this.previousRotation = pose.quaternion.clone();
    this.previousSpan = measuredSpan;
    this.previousScaleAxis = pose.scaleAxis?.clone() ?? null;

    const quaternion = this.rotation.clone();
    const eyeSpan = this.span;
    const bridge = this.bridge!.clone();
    const position = this.localAnchor.clone().multiplyScalar(eyeSpan).applyQuaternion(quaternion).add(bridge);
    // Temple fitting and occlusion must use the same transform as the frame.
    const filteredTemple = (point: THREE.Vector3) => point.clone().sub(pose.bridge)
      .applyQuaternion(pose.quaternion.clone().invert()).multiplyScalar(eyeSpan / measuredSpan)
      .applyQuaternion(quaternion).add(bridge);
    return {
      ...pose,
      skinProfile: this.skinProfile ?? pose.skinProfile,
      bridge,
      surface: this.surface ?? pose.surface,
      position,
      quaternion,
      eyeSpan,
      leftTemple: filteredTemple(pose.leftTemple),
      rightTemple: filteredTemple(pose.rightTemple),
      eyeLift: this.liftRatio * eyeSpan,
      browHeight: this.browRatio === undefined ? undefined : this.browRatio * eyeSpan,
      faceWidth: (measuredFaceWidth / measuredSpan) * eyeSpan,
      xAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
      yAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
      zAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
    };
  }
}

// The back-of-head occluder belongs to the face, independently of frame fitting.
// Landmarks approximate skin, not its exact depth. Apply a small inward bias
// only around the temples, in normalized head space, to avoid self-occluding
// arms resting on that surface. Keep the central face and far-side depth test.
export function faceOcclusionPoint(point: THREE.Vector3, target: THREE.Vector3, profile?: EyewearPose['skinProfile'], viewDirection?: THREE.Vector3) {
  const temple = point.x < 0 ? profile?.left : profile?.right;
  const widthRatio = (temple?.width ?? 1.1) / 1.1;
  const side = THREE.MathUtils.smoothstep(Math.abs(point.x) / widthRatio, .65, 1.05);
  const templeBand = 1 - THREE.MathUtils.smoothstep(Math.abs(point.y - (temple?.height ?? -.15)), .2, .55);
  const inset = .04 * side * templeBand;
  target.set(point.x - Math.sign(point.x) * inset, point.y, point.z - .008);
  // Sideways inset alone does not resolve a nod: the camera then looks down
  // onto the temple. Bias only its visible skin depth along the viewing ray,
  // leaving screen coordinates and all eyewear transforms unchanged.
  if (viewDirection && point.x * viewDirection.x >= -.1) {
    const nod = THREE.MathUtils.smoothstep(Math.abs(viewDirection.y), .15, .65);
    target.addScaledVector(viewDirection, -.04 * side * templeBand * nod);
  }
  return target;
}

export function faceSkullPose(pose: EyewearPose) {
  const width = pose.leftTemple.distanceTo(pose.rightTemple);
  return {
    position: pose.leftTemple.clone().add(pose.rightTemple).multiplyScalar(.5)
      .addScaledVector(pose.yAxis, width * .06)
      // Keep the synthetic cranium behind the measured face surface. The old
      // sphere reached 18% of face width in front of the temples and depth-
      // occluded the glasses, making them appear embedded in the face.
      .addScaledVector(pose.zAxis, -width * .38),
    scale: new THREE.Vector3(width * .49, width * .70, width * .34),
    quaternion: pose.quaternion,
  };
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
      const vertices = [0, 1, 2].map(n => index ? index.getX(offset + n) : offset + n);
      const sideFast = vertices.reduce((sum, i) => sum + position.getX(i), 0) < 0 ? 0 : 1;
      const inside = vertices.map(i => position.getZ(i) >= depths[sideFast]);
      if (inside.every(Boolean)) {
        // Unclipped triangles need no temporary per-vertex attribute objects.
        for (const i of vertices) for (const [name, attribute] of attributes) {
          const values = output.get(name)!;
          for (let component = 0; component < attribute.itemSize; component++) values.push(attribute.getComponent(i, component));
        }
        continue;
      }
      if (!inside.some(Boolean)) continue;
      const triangle = vertices.map(read);
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
const preparedRigs = new Map<string, {
  geometries: THREE.BufferGeometry[]; sources: Float32Array[];
  frontWidth: number; eyeDistance: number; hingeDepth: number; tails: THREE.Vector3[];
}>();
export class EyewearRig {
  readonly group = new THREE.Group();
  readonly eyeDistance: number;
  readonly frontWidth: number;
  private fitRatio: number | null = null;
  private fitTime: number | null = null;
  private readonly faceScale = new StableFaceScale();
  private lensTop: number | undefined;
  private lensClearanceBounds: THREE.Box3[] | null = null;
  private clearanceRatio = 0;
  private clearanceTime: number | null = null;
  private lensDepth: LensDepthSurface | null = null;
  private templeTime: number | null = null;
  private meshes: RigMesh[] = [];
  private hingeDepth = -.55;
  private tails = [new THREE.Vector3(-4.4, 0, -6), new THREE.Vector3(4.4, 0, -6)];
  private lastLeft: THREE.Vector3 | null = null;
  private lastRight: THREE.Vector3 | null = null;
  constructor(model: THREE.Group, private readonly productId?: string) {
    model.updateMatrixWorld(true);
    const inputMeshes: THREE.Mesh[] = [];
    model.traverse(object => { if (object instanceof THREE.Mesh && object.name !== 'contact-shadow') inputMeshes.push(object); });
    const cacheKey = JSON.stringify([model.userData.bridgeExpansion, model.userData.templeContactFraction,
      inputMeshes.map(mesh => [mesh.geometry.uuid, mesh.name, mesh.matrixWorld.elements])]);
    const prepared = preparedRigs.get(cacheKey);
    if (prepared) {
      preparedRigs.delete(cacheKey); preparedRigs.set(cacheKey, prepared);
      this.frontWidth = prepared.frontWidth; this.eyeDistance = prepared.eyeDistance;
      this.hingeDepth = prepared.hingeDepth; this.tails = prepared.tails.map(tail => tail.clone());
      this.meshes = inputMeshes.map((input, i) => {
        const mesh = new THREE.Mesh(prepared.geometries[i].clone(), input.material);
        mesh.name = input.name; mesh.renderOrder = input.renderOrder; this.group.add(mesh);
        return { mesh, source: prepared.sources[i] };
      });
      return;
    }
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
    // Image-derived frames have a continuous curved front, not named lenses.
    // Keep that entire surface ahead of the arm deformation/trim boundary.
    for (const { mesh, source } of this.meshes) {
      if (mesh.name !== 'custom-frame-front') continue;
      for (let i = 0; i < source.length; i += 3) {
        lensBounds.expandByPoint(new THREE.Vector3(source[i], source[i + 1], source[i + 2]));
      }
    }
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
      return this.hingeDepth + (contactDepth - this.hingeDepth) * .91;
    });
    for (const entry of this.meshes) {
      const original = entry.mesh.geometry;
      entry.mesh.geometry = trimTryOnTempleTips(original, cutoffs);
      entry.source = new Float32Array(entry.mesh.geometry.getAttribute('position').array);
      original.dispose();
    }
    preparedRigs.set(cacheKey, {
      geometries: this.meshes.map(entry => entry.mesh.geometry.clone()), sources: this.meshes.map(entry => entry.source),
      frontWidth: this.frontWidth, eyeDistance: this.eyeDistance, hingeDepth: this.hingeDepth,
      tails: this.tails.map(tail => tail.clone()),
    });
    // Keep only three recent models; never retain an entire catalog's meshes.
    if (preparedRigs.size > 3) {
      const oldest = preparedRigs.keys().next().value!;
      preparedRigs.get(oldest)!.geometries.forEach(geometry => geometry.dispose());
      preparedRigs.delete(oldest);
    }
  }
  fittedScale(eyeSpan: number, faceWidth: number, isFrontal = true) {
    // Learn the current wearer's facial proportion independently of camera
    // distance. A rig can stay mounted while different people take turns, so
    // a large ratio jump must be treated as a new face rather than as noise.
    const ratio = THREE.MathUtils.clamp(faceWidth / Math.max(1, eyeSpan), 1.8, 2.8);
    if (this.fitRatio === null) {
      this.fitRatio = ratio;
    } else if (isFrontal) {
      const delta = Math.abs(ratio - this.fitRatio);
      const learningRate = delta > 0.18 ? 0.24 : 0.06;
      this.fitRatio += (ratio - this.fitRatio) * learningRate;
    }
    return eyeSpan * Math.max(1 / this.eyeDistance, this.fitRatio * 1.04 / this.frontWidth) * frameFitScale(this.productId);
  }
  resetFitRatio() {
    this.fitRatio = null; this.fitTime = null; this.faceScale.reset(); this.clearanceRatio = 0; this.clearanceTime = null;
    this.lastLeft = null; this.lastRight = null; this.templeTime = null;
  }
  fittedFaceScale(pose: EyewearPose, now?: number) {
    if (now !== undefined) {
      if (this.fitTime !== null && now - this.fitTime > 250) this.resetFitRatio();
      this.fitTime = now;
    }
    const scale = this.fittedScale(pose.eyeSpan, pose.faceWidth, pose.isFrontal);
    return now === undefined ? faceBoundedScale(pose, this.frontWidth, scale)
      : this.faceScale.update(pose, this.frontWidth, scale, now);
  }
  fittedPosition(pose: EyewearPose, scale: number, now?: number) {
    const dt = now !== undefined && this.clearanceTime !== null
      ? THREE.MathUtils.clamp((now - this.clearanceTime) / 1000, 1 / 120, .1) : 1 / 30;
    if (now !== undefined) this.clearanceTime = now;
    const position = pose.position.clone();
    if (this.lensTop === undefined) {
      const bounds = [new THREE.Box3(), new THREE.Box3()];
      for (const { mesh, source } of this.meshes) {
        if (!/lens/i.test(mesh.name)) continue;
        for (let i = 0; i < source.length; i += 3) {
          bounds[source[i] < 0 ? 0 : 1].expandByPoint(new THREE.Vector3(source[i], source[i + 1], source[i + 2]));
        }
      }
      this.lensClearanceBounds = bounds.filter(box => !box.isEmpty());
      this.lensDepth = new LensDepthSurface(this.meshes.filter(({ mesh }) => /lens/i.test(mesh.name)).map(({ mesh }) => mesh.geometry));
      this.lensTop = this.lensClearanceBounds.length
        ? Math.max(...this.lensClearanceBounds.map(box => box.max.y)) : 0;
    }
    if (pose.browHeight !== undefined) {
      const topHeight = pose.eyeLift + this.lensTop * scale;
      const correction = THREE.MathUtils.clamp(topHeight - pose.browHeight - pose.eyeSpan * .025,
        0, pose.eyeSpan * .08);
      position.addScaledVector(pose.yAxis, -correction);
    }
    if (pose.surface?.length) {
      const inverse = pose.quaternion.clone().invert();
      const localOrigin = position.clone().sub(pose.bridge).applyQuaternion(inverse);
      let clearance = 0;
      const point = new THREE.Vector3();
      for (const box of this.lensClearanceBounds!) {
        // Test facial samples under each lens, including cheek and eye sockets.
        // Exclude the nasal tip between lenses, where the bridge has its own seat.
        for (const sample of pose.surface) {
          point.copy(sample).multiplyScalar(pose.eyeSpan).sub(localOrigin).divideScalar(scale);
          if (point.x < box.min.x || point.x > box.max.x || point.y < box.min.y || point.y > box.max.y) continue;
          // Follow the actual curved lens surface and silhouette instead of
          // treating its entire bounding rectangle as a flat lens.
          const lensZ = this.lensDepth?.at(point.x, point.y);
          if (lensZ === null || lensZ === undefined) continue;
          clearance = Math.max(clearance, (point.z - lensZ) * scale + pose.eyeSpan * .012);
        }
      }
      // Never move the bridge away from its nasal seat to clear a cheek estimate.
      // A depth-only correction changes screen height sharply during a head nod.
      const ratio = Math.min(Math.max(0, clearance) / pose.eyeSpan, .06);
      // Move immediately when skin would occlude the lens; release gradually
      // to keep the glasses face-locked as the cheek contour changes in 3D.
      this.clearanceRatio = ratio > this.clearanceRatio
        ? ratio : THREE.MathUtils.lerp(this.clearanceRatio, ratio, 1 - Math.pow(.965, dt * 30));
      position.addScaledVector(pose.zAxis, this.clearanceRatio * pose.eyeSpan);
    }
    return position;
  }
  fitTemples(leftEar: THREE.Vector3, rightEar: THREE.Vector3, now?: number) {
    const dt = now !== undefined && this.templeTime !== null
      ? THREE.MathUtils.clamp((now - this.templeTime) / 1000, 1 / 120, .1) : 1 / 30;
    if (now !== undefined) this.templeTime = now;
    // These are head-local proportions, not screen positions. Reuse the fitted
    // geometry while they remain within roughly a pixel to avoid heavy uploads.
    if (this.lastLeft && this.lastRight && this.lastLeft.distanceTo(leftEar) < .04 && this.lastRight.distanceTo(rightEar) < .04) return;
    // Filter only head-local arm proportions; the shared head pose stays intact.
    if (!this.lastLeft || !this.lastRight) { this.lastLeft = leftEar.clone(); this.lastRight = rightEar.clone(); }
    else {
      const response = 1 - Math.exp(-2 * Math.PI * .95 * dt);
      this.lastLeft.lerp(leftEar, response); this.lastRight.lerp(rightEar, response);
    }
    const hingeDepth = this.hingeDepth;
    for (const { mesh, source } of this.meshes) {
      const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const x = source[i * 3], y = source[i * 3 + 1], z = source[i * 3 + 2];
        if (z >= hingeDepth) continue;
        const ear = x < 0 ? this.lastLeft : this.lastRight;
        const tail = this.tails[x < 0 ? 0 : 1];
        const t = THREE.MathUtils.clamp((hingeDepth - z) / Math.max(.5, hingeDepth - tail.z), 0, 1.5);
        // End at the measured head, without an extra fixed-length extension.
        // Use model-relative dimensions so imported geometry shares the fit.
        const targetZ = Math.min(hingeDepth - this.frontWidth * .02, ear.z);
        let fittedX = x + (ear.x - tail.x) * t;
        const progress = THREE.MathUtils.clamp(t, 0, 1);
        const contour = THREE.MathUtils.lerp(this.frontWidth / 2, Math.abs(ear.x), progress) + this.frontWidth * .007;
        fittedX = Math.sign(x) * Math.min(Math.abs(fittedX), contour);
        positions.setXYZ(i,
          fittedX,
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
