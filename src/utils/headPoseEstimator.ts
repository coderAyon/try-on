import * as THREE from 'three';
import { NormalizedLandmark } from '@mediapipe/face_mesh';
import { CalibrationSettings } from '../types';

export interface HeadPoseResult {
  // 3D Matrix & Components for WebGL scene
  transformMatrix: THREE.Matrix4;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;

  // Real-time Telemetry & Diagnostics
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  ipdMm: number;
  faceWidthMm: number;
  distanceFromCameraCm: number;

  // Key Landmark Anchors (Three.js coordinates)
  leftEyeCenter: THREE.Vector3;
  rightEyeCenter: THREE.Vector3;
  noseBridge: THREE.Vector3;
  noseTip: THREE.Vector3;
}

/**
 * Enterprise Head Pose & Face Landmark Matrix Calculator
 * Extracts 3D orthonormal basis, pupil-centered anchoring, and facial width scaling
 * matching FittingBox & Sunglass Hut optical standards.
 */
export class HeadPoseEstimator {
  private camera: THREE.PerspectiveCamera;
  private canvasWidth: number = 1280;
  private canvasHeight: number = 720;

  // Object-cover coordinate correction coefficients
  private coverScaleX: number = 1.0;
  private coverScaleY: number = 1.0;
  private coverOffsetX: number = 0.0;
  private coverOffsetY: number = 0.0;

  // Temporal low-pass filter states for depth and scale stability
  private smoothedDepthZ: number = -8.0;
  private smoothedScale: number = 0.48;
  private isDepthInitialized: boolean = false;

  // Reusable THREE objects to avoid Garbage Collection frame drops
  private eyeVector = new THREE.Vector3();
  private basisX = new THREE.Vector3();
  private basisY = new THREE.Vector3();
  private basisZ = new THREE.Vector3();
  private rotMatrix = new THREE.Matrix4();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Baseline standard human biometric references
  private readonly AVERAGE_ADULT_IPD_MM = 63.0; // 63mm pupillary distance average
  private readonly BASELINE_DEPTH_Z = -8.0; // Standard distance in Three.js units

  // 3D Model calibration: distance between outer temple hinges in 3D units
  public static readonly MODEL_TEMPLE_WIDTH = 8.8;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /**
   * Updates canvas dimensions and video/photo source aspect ratio to compute
   * pixel-perfect object-cover coordinate mapping.
   */
  public updateViewport(
    canvasWidth: number,
    canvasHeight: number,
    sourceWidth?: number,
    sourceHeight?: number
  ): void {
    this.canvasWidth = Math.max(canvasWidth, 1);
    this.canvasHeight = Math.max(canvasHeight, 1);

    const canvasAspect = this.canvasWidth / this.canvasHeight;
    const sourceAspect =
      sourceWidth && sourceHeight && sourceHeight > 0
        ? sourceWidth / sourceHeight
        : canvasAspect;

    if (sourceAspect > canvasAspect) {
      // Source is wider than canvas: cropped horizontally
      this.coverScaleX = sourceAspect / canvasAspect;
      this.coverScaleY = 1.0;
      this.coverOffsetX = (1.0 - this.coverScaleX) / 2.0;
      this.coverOffsetY = 0.0;
    } else {
      // Source is taller than canvas: cropped vertically
      this.coverScaleX = 1.0;
      this.coverScaleY = canvasAspect / sourceAspect;
      this.coverOffsetX = 0.0;
      this.coverOffsetY = (1.0 - this.coverScaleY) / 2.0;
    }
  }

  /**
   * Resets depth and scale smoothing state (called on face loss or mode switch)
   */
  public reset(): void {
    this.isDepthInitialized = false;
    this.smoothedDepthZ = -8.0;
    this.smoothedScale = 0.48;
  }

  /**
   * Converts MediaPipe source-normalized coordinates [0, 1] to canvas-normalized coordinates [0, 1],
   * compensating for CSS object-cover zoom and crop.
   */
  public mapLandmarkToCanvas(lm: { x: number; y: number; z?: number }): {
    x: number;
    y: number;
    z?: number;
  } {
    return {
      x: lm.x * this.coverScaleX + this.coverOffsetX,
      y: lm.y * this.coverScaleY + this.coverOffsetY,
      z: lm.z,
    };
  }

  /**
   * Converts mapped screen coordinates [0, 1] into 3D camera frustum space.
   */
  public landmarkToVector3(
    lm: { x: number; y: number; z?: number },
    depthZ: number
  ): THREE.Vector3 {
    const mapped = this.mapLandmarkToCanvas(lm);
    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const frustumHeight = 2.0 * Math.tan(vFovRad / 2.0) * Math.abs(depthZ);
    const frustumWidth = frustumHeight * this.camera.aspect;

    // Direct screen space mapping:
    // Screen X: 0 (left) to 1 (right) -> Three.js X: -width/2 to +width/2
    // Screen Y: 0 (top) to 1 (bottom) -> Three.js Y: +height/2 to -height/2
    const x = (mapped.x - 0.5) * frustumWidth;
    const y = -(mapped.y - 0.5) * frustumHeight;
    // Invert MediaPipe lm.z so points closer to camera protrude forward towards origin
    const z = depthZ - (mapped.z || 0) * (frustumWidth * 0.35);

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Estimates 3D transformation matrix, orientation, and biometric scale from 468/478 landmarks.
   * Uses Luxottica / FittingBox standard:
   * - Lateral axis along interpupillary line
   * - Vertical axis along cranial coronal midline (Chin 152 to Forehead 10)
   * - Outward normal calculated via cross product (Right x Up)
   * - Eyewear anchored at nasal bridge and pupil centerline with corneal clearance
   */
  public estimatePose(
    landmarks: NormalizedLandmark[],
    calibration: CalibrationSettings,
    _isMirrored: boolean = true
  ): HeadPoseResult | null {
    if (!landmarks || landmarks.length < 468) return null;

    // 1. Key Landmark Indices (MediaPipe Face Mesh Topology)
    const lmBridge168 = landmarks[168];   // Mid nasal bridge (sellion)
    const lmChin152 = landmarks[152];     // Menton / Chin bottom apex
    const lmForehead10 = landmarks[10];   // Trichion / Superior forehead apex
    const lmNoseTip4 = landmarks[4];      // Nose tip apex

    // Precise Pupil / Eye Centers:
    let eyeA: { x: number; y: number; z?: number };
    let eyeB: { x: number; y: number; z?: number };

    if (landmarks.length >= 478 && landmarks[468] && landmarks[473]) {
      eyeA = { x: landmarks[468].x, y: landmarks[468].y, z: landmarks[468].z };
      eyeB = { x: landmarks[473].x, y: landmarks[473].y, z: landmarks[473].z };
    } else {
      eyeA = {
        x: (landmarks[33].x + landmarks[133].x) / 2,
        y: (landmarks[33].y + landmarks[133].y) / 2,
        z: ((landmarks[33].z || 0) + (landmarks[133].z || 0)) / 2,
      };
      eyeB = {
        x: (landmarks[263].x + landmarks[362].x) / 2,
        y: (landmarks[263].y + landmarks[362].y) / 2,
        z: ((landmarks[263].z || 0) + (landmarks[263].z || 0)) / 2,
      };
    }

    // Always sort so screenLeftEye has smaller x, screenRightEye has larger x
    const screenLeftEye = eyeA.x < eyeB.x ? eyeA : eyeB;
    const screenRightEye = eyeA.x < eyeB.x ? eyeB : eyeA;

    // 2. Map coordinates to canvas UV space to prevent object-cover distortion
    const mappedLeftEye = this.mapLandmarkToCanvas(screenLeftEye);
    const mappedRightEye = this.mapLandmarkToCanvas(screenRightEye);
    const mappedChin = this.mapLandmarkToCanvas(lmChin152);
    const mappedForehead = this.mapLandmarkToCanvas(lmForehead10);

    // 3. Stable 2D Cranial Metrics (Without noisy neural-net dz)
    const eyeDx = mappedRightEye.x - mappedLeftEye.x;
    const eyeDy = mappedRightEye.y - mappedLeftEye.y;
    const eyeDistance2D = Math.hypot(eyeDx, eyeDy);

    // Vertical cranial span from Chin (152) to Forehead (10)
    const faceDx = mappedChin.x - mappedForehead.x;
    const faceDy = mappedChin.y - mappedForehead.y;
    const faceHeight2D = Math.hypot(faceDx, faceDy);

    // Invariant facial scale:
    // When turning yaw, eyeDistance2D shrinks by cos(yaw), but faceHeight2D remains constant.
    // When nodding pitch, faceHeight2D shrinks by cos(pitch), but eyeDistance2D remains constant.
    // The standard human cranial ratio (trichion-to-menton / IPD) is ~2.55.
    const invariantSpan = Math.max(eyeDistance2D, faceHeight2D / 2.55);

    // 4. Dynamic Depth (Z) Calculation with Heavy Temporal Low-Pass Filtering
    const baselineNormalizedSpan = 0.185;
    const targetDistanceRatio = baselineNormalizedSpan / Math.max(0.05, invariantSpan);
    const targetDepthZ =
      this.BASELINE_DEPTH_Z * targetDistanceRatio + (calibration.depthOffsetMm * 0.1);

    if (!this.isDepthInitialized) {
      this.smoothedDepthZ = targetDepthZ;
      this.isDepthInitialized = true;
    } else {
      // 15% EMA filter prevents Z-depth breathing while remaining responsive
      this.smoothedDepthZ += (targetDepthZ - this.smoothedDepthZ) * 0.15;
    }

    const cameraZ = this.smoothedDepthZ;
    const estimatedDistCm = Math.round(Math.abs(cameraZ) * 6.5);

    // 5. Convert Key Points to Three.js 3D Coordinate Space at smoothed depth
    const leftEyePos = this.landmarkToVector3(screenLeftEye, cameraZ);
    const rightEyePos = this.landmarkToVector3(screenRightEye, cameraZ);
    const chinPos = this.landmarkToVector3(lmChin152, cameraZ);
    const foreheadPos = this.landmarkToVector3(lmForehead10, cameraZ);
    const bridgePos = this.landmarkToVector3(lmBridge168, cameraZ);
    const noseTipPos = this.landmarkToVector3(lmNoseTip4, cameraZ);

    // Optical Pupil Midpoint
    const pupilMidPos = new THREE.Vector3()
      .addVectors(leftEyePos, rightEyePos)
      .multiplyScalar(0.5);

    // 6. LUXOTTICA / FITTINGBOX ORTHONORMAL COORDINATE BASIS
    // Basis X (Lateral axis across eyes): Guaranteed pointing to screen-right (+X)
    this.eyeVector.subVectors(rightEyePos, leftEyePos);
    this.basisX.copy(this.eyeVector).normalize();

    // Cranial Vertical Midline Vector (Chin 152 to Forehead 10 establishes true coronal plane):
    const cranialMidline = new THREE.Vector3().subVectors(foreheadPos, chinPos).normalize();

    // Basis Z (Normal vector pointing outward from face towards camera viewer):
    // Right (+X) x Up (+Y) = Out (+Z)
    this.basisZ.crossVectors(this.basisX, cranialMidline).normalize();

    // Basis Y (Strictly orthogonal vertical axis along the face):
    // Out (+Z) x Right (+X) = Up (+Y)
    this.basisY.crossVectors(this.basisZ, this.basisX).normalize();

    // 7. Rotation Matrix & Quaternion Construction
    this.rotMatrix.set(
      this.basisX.x, this.basisY.x, this.basisZ.x, 0,
      this.basisX.y, this.basisY.y, this.basisZ.y, 0,
      this.basisX.z, this.basisY.z, this.basisZ.z, 0,
      0, 0, 0, 1
    );

    const quaternion = new THREE.Quaternion();
    quaternion.setFromRotationMatrix(this.rotMatrix);

    // Extract Euler angles for UI diagnostics
    this.euler.setFromQuaternion(quaternion, 'YXZ');
    const yawDeg = Math.round(THREE.MathUtils.radToDeg(this.euler.y) * 10) / 10;
    const pitchDeg = Math.round(THREE.MathUtils.radToDeg(this.euler.x) * 10) / 10;
    const rollDeg = Math.round(THREE.MathUtils.radToDeg(this.euler.z) * 10) / 10;

    // 8. BIOMETRIC SCALE WITH TEMPORAL LOCKING
    // Eye distance in 3D world space:
    const worldEyeDistance = leftEyePos.distanceTo(rightEyePos);

    // Bi-temporal width for diagnostics
    const templeA = landmarks[127];
    const templeB = landmarks[356];
    const templeLeft = this.landmarkToVector3(templeA.x < templeB.x ? templeA : templeB, cameraZ);
    const templeRight = this.landmarkToVector3(templeA.x < templeB.x ? templeB : templeA, cameraZ);
    const worldTempleDistance = templeLeft.distanceTo(templeRight);

    // Target scale: Model temple width is 8.8, pupil distance is ~4.4
    const rawTargetScale =
      (worldEyeDistance / 4.25) * 1.02 * calibration.scale;

    this.smoothedScale += (rawTargetScale - this.smoothedScale) * 0.12;
    const targetScale = this.smoothedScale;

    // Biometric IPD calculation
    const standardBiZygomaticMm = 139.0;
    const cranialRatio = eyeDistance2D / Math.max(0.12, invariantSpan * 1.35);
    const estimatedIpdMm =
      Math.round(cranialRatio * standardBiZygomaticMm * 10) / 10 +
      calibration.ipdOffsetMm;
    const estimatedFaceWidthMm = Math.round(
      standardBiZygomaticMm * (cranialRatio / 0.455)
    );

    // 9. OPTICAL ANCHOR POSITION (FITTINGBOX & LUXOTTICA STANDARD):
    // Glasses bridge rests precisely on nasal bridge / sellion (168)
    const glassesAnchor = bridgePos.clone();

    // Subtle offset along face local Y axis (Vertical offset calibration)
    const verticalOffset = -0.01 * worldEyeDistance + calibration.verticalOffsetMm * 0.04;
    glassesAnchor.addScaledVector(this.basisY, verticalOffset);

    // Forward clearance along face local Z axis (Corneal clearance: rests right on bridge skin)
    // 0.045 (was 0.08): prevents glasses floating forward off the face
    const forwardOffset = 0.045 * worldEyeDistance + calibration.depthOffsetMm * 0.04;
    glassesAnchor.addScaledVector(this.basisZ, forwardOffset);

    // 10. Full 4x4 Transformation Matrix
    const transformMatrix = new THREE.Matrix4();
    transformMatrix.compose(
      glassesAnchor,
      quaternion,
      new THREE.Vector3(targetScale, targetScale, targetScale)
    );

    return {
      transformMatrix,
      position: glassesAnchor,
      quaternion,
      scale: targetScale,
      yawDeg,
      pitchDeg,
      rollDeg,
      ipdMm: estimatedIpdMm,
      faceWidthMm: estimatedFaceWidthMm,
      distanceFromCameraCm: estimatedDistCm,
      leftEyeCenter: leftEyePos,
      rightEyeCenter: rightEyePos,
      noseBridge: bridgePos,
      noseTip: noseTipPos,
    };
  }
}
