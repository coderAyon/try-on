/**
 * High-Performance Client-Side Face & Eye Tracker for Lumen AR Mirror
 * Dual Engine: Hardware-Accelerated Native FaceDetector + Fallback Pico.js Cascade.
 * Zero Network Requests, Zero External Dependencies, 100% CSP Compliant.
 */

import { FACEFINDER_BASE64 } from './facefinder_b64';

export interface FaceTrackerResult {
  detected: boolean;
  centerX: number; // 0..1 in canvas space
  bridgeY: number; // 0..1 in canvas space
  width: number;   // 0..1 in canvas space
  rollRad: number; // Head rotation angle in radians
  confidence: number;
  eyeSpan?: number;
  /** Full 3D head pose from the landmark tracker (absent for the 2D fallbacks). */
  pose?: FacePose;
}

export interface Vec3 { x: number; y: number; z: number }

/**
 * Head pose in mirrored frame space. Every component (including y and z) is
 * normalised by the frame WIDTH, so multiplying by the canvas width gives pixels.
 */
export interface FacePose {
  origin: Vec3;  // midpoint between the eye centres (corner based, gaze independent)
  xAxis: Vec3;   // unit vector across the face, screen-left eye -> screen-right eye
  yAxis: Vec3;   // unit vector down the face, forehead -> chin
  zAxis: Vec3;   // unit vector into the screen (away from the camera)
  ipd: number;   // 3D distance between the eye centres
  faceWidth?: number; // face width at eye level (temple to temple)
}

type ClassifyRegionFn = (r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number;

class PicoDetector {
  private classifyRegion: ClassifyRegionFn | null = null;
  private detectionMemory: ((dets: number[][]) => number[][]) | null = null;
  private isInitialized = false;

  // Native Shape Detection API instance if available
  private nativeDetector: any = null;
  private isNativeDetecting = false;
  private lastNativeResult: FaceTrackerResult | null = null;
  private lastNativeTimestamp = 0;

  // Temporal tracking continuity
  private lastValidResult: FaceTrackerResult | null = null;
  private lastDetectedTimestamp = 0;

  constructor() {
    this.init();
    this.initNativeDetector();
  }

  private initNativeDetector() {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        this.nativeDetector = new (window as any).FaceDetector({
          maxDetectedFaces: 1,
          fastMode: true,
        });
      } catch {
        this.nativeDetector = null;
      }
    }
  }

  private init() {
    try {
      if (typeof atob === 'undefined') return;
      const binaryStr = atob(FACEFINDER_BASE64);
      const len = binaryStr.length;
      const bytes = new Int8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      this.classifyRegion = this.unpackCascade(bytes);
      this.detectionMemory = this.instantiateDetectionMemory(5);
      this.isInitialized = true;
    } catch (err) {
      console.error('[Lumen PicoDetector] Failed to initialize cascade:', err);
    }
  }

  /**
   * Unpacks the pico binary cascade model into a fast decision tree classifier
   */
  private unpackCascade(bytes: Int8Array): ClassifyRegionFn {
    const dview = new DataView(new ArrayBuffer(4));
    let p = 8; // skip header

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    const tdepth = dview.getInt32(0, true);
    p += 4;

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    const ntrees = dview.getInt32(0, true);
    p += 4;

    const tcodes_ls: number[] = [];
    const tpreds_ls: number[] = [];
    const thresh_ls: number[] = [];
    const pow2tdepth = Math.pow(2, tdepth) >> 0;

    for (let t = 0; t < ntrees; ++t) {
      Array.prototype.push.apply(tcodes_ls, [0, 0, 0, 0]);
      Array.prototype.push.apply(tcodes_ls, Array.from(bytes.slice(p, p + 4 * pow2tdepth - 4)));
      p += 4 * pow2tdepth - 4;

      for (let i = 0; i < pow2tdepth; ++i) {
        dview.setUint8(0, bytes[p + 0]);
        dview.setUint8(1, bytes[p + 1]);
        dview.setUint8(2, bytes[p + 2]);
        dview.setUint8(3, bytes[p + 3]);
        tpreds_ls.push(dview.getFloat32(0, true));
        p += 4;
      }

      dview.setUint8(0, bytes[p + 0]);
      dview.setUint8(1, bytes[p + 1]);
      dview.setUint8(2, bytes[p + 2]);
      dview.setUint8(3, bytes[p + 3]);
      thresh_ls.push(dview.getFloat32(0, true));
      p += 4;
    }

    const tcodes = new Int8Array(tcodes_ls);
    const tpreds = new Float32Array(tpreds_ls);
    const thresh = new Float32Array(thresh_ls);

    return function classify(r: number, c: number, s: number, pixels: Uint8Array, ldim: number): number {
      const scaledR = 256 * r;
      const scaledC = 256 * c;
      let root = 0;
      let o = 0.0;

      for (let i = 0; i < ntrees; ++i) {
        let idx = 1;
        for (let j = 0; j < tdepth; ++j) {
          const p1 = pixels[(((scaledR + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim) + ((scaledC + tcodes[root + 4 * idx + 1] * s) >> 8)];
          const p2 = pixels[(((scaledR + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim) + ((scaledC + tcodes[root + 4 * idx + 3] * s) >> 8)];
          idx = 2 * idx + (p1 <= p2 ? 1 : 0);
        }

        o += tpreds[pow2tdepth * i + idx - pow2tdepth];
        if (o <= thresh[i]) return -1;
        root += 4 * pow2tdepth;
      }
      return o - thresh[ntrees - 1];
    };
  }

  private instantiateDetectionMemory(size: number) {
    let n = 0;
    const memory: number[][][] = [];
    for (let i = 0; i < size; ++i) memory.push([]);

    return function update_memory(dets: number[][]) {
      memory[n] = dets;
      n = (n + 1) % memory.length;
      let all: number[][] = [];
      for (let i = 0; i < memory.length; ++i) {
        all = all.concat(memory[i]);
      }
      return all;
    };
  }

  private clusterDetections(dets: number[][], iouthreshold: number): number[][] {
    dets.sort((a, b) => b[3] - a[3]);

    function calculate_iou(det1: number[], det2: number[]) {
      const r1 = det1[0], c1 = det1[1], s1 = det1[2];
      const r2 = det2[0], c2 = det2[1], s2 = det2[2];
      const overr = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
      const overc = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
      return (overr * overc) / (s1 * s1 + s2 * s2 - overr * overc);
    }

    const assignments = new Array(dets.length).fill(0);
    const clusters: number[][] = [];

    for (let i = 0; i < dets.length; ++i) {
      if (assignments[i] === 0) {
        let r = 0.0, c = 0.0, s = 0.0, q = 0.0, n = 0;
        for (let j = i; j < dets.length; ++j) {
          if (calculate_iou(dets[i], dets[j]) > iouthreshold) {
            assignments[j] = 1;
            r += dets[j][0];
            c += dets[j][1];
            s += dets[j][2];
            q += dets[j][3];
            n += 1;
          }
        }
        clusters.push([r / n, c / n, s / n, q]);
      }
    }
    // Sort clusters by accumulated confidence score descending
    clusters.sort((a, b) => b[3] - a[3]);
    return clusters;
  }

  /**
   * Asynchronous native Shape Detection query (if browser supports it)
   */
  private triggerNativeDetection(video: HTMLVideoElement) {
    if (!this.nativeDetector || this.isNativeDetecting) return;
    this.isNativeDetecting = true;

    this.nativeDetector.detect(video).then((faces: any[]) => {
      this.isNativeDetecting = false;
      if (!faces || faces.length === 0) {
        this.lastNativeResult = null;
        return;
      }

      const face = faces[0];
      const box = face.boundingBox;
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      // Notice video is mirrored horizontally in mirror mode
      // Mirror col: x' = vw - (box.x + box.width / 2)
      let centerX = (vw - (box.x + box.width / 2)) / vw;
      let bridgeY = (box.y + box.height * 0.38) / vh;
      let rollRad = 0;
      let eyeSpan = box.width * 0.42;

      // If landmarks are available (eyes & nose)
      if (face.landmarks && face.landmarks.length > 0) {
        let eyeLeft: { x: number; y: number } | null = null;
        let eyeRight: { x: number; y: number } | null = null;

        for (const lm of face.landmarks) {
          if (lm.type === 'eye') {
            const pts = lm.locations || [lm];
            for (const pt of pts) {
              if (pt.x < box.x + box.width / 2) eyeLeft = pt;
              else eyeRight = pt;
            }
          }
        }

        if (eyeLeft && eyeRight) {
          // Mirror eye coordinates horizontally
          const mLeftX = vw - eyeLeft.x;
          const mRightX = vw - eyeRight.x;
          // In mirrored space, viewer's left is mRightX
          const vLeftX = Math.min(mLeftX, mRightX);
          const vRightX = Math.max(mLeftX, mRightX);
          const vLeftY = mLeftX < mRightX ? eyeLeft.y : eyeRight.y;
          const vRightY = mLeftX < mRightX ? eyeRight.y : eyeLeft.y;

          centerX = (vLeftX + vRightX) / 2 / vw;
          bridgeY = (vLeftY + vRightY) / 2 / vh;
          rollRad = Math.atan2(vRightY - vLeftY, vRightX - vLeftX);
          eyeSpan = Math.abs(vRightX - vLeftX);
        }
      }

      // Adult eyewear optical width ratio: temple-to-temple span ≈ 2.25x IPD
      const frameWidthNorm = Math.min(0.65, Math.max(0.25, (eyeSpan * 2.25) / vw));

      this.lastNativeResult = {
        detected: true,
        centerX,
        bridgeY,
        width: frameWidthNorm,
        rollRad: Math.max(-0.4, Math.min(0.4, rollRad)),
        confidence: 3.5,
      };
      this.lastNativeTimestamp = performance.now();
    }).catch(() => {
      this.isNativeDetecting = false;
    });
  }

  /**
   * Tracks user's face, eye positions, and head tilt in real-time video frame
   */
  // Tracking state and throttling cache
  private lastTrackTime = 0;
  private cachedResult: FaceTrackerResult | null = null;

  /**
   * Tracks user's face, eye positions, and head tilt in real-time video frame
   */
  public track(
    video: HTMLVideoElement,
    cvCanvas: HTMLCanvasElement,
    cvCtx: CanvasRenderingContext2D
  ): FaceTrackerResult | null {
    const now = performance.now();

    // 1. Kick off background native face detection if supported
    this.triggerNativeDetection(video);

    // If native detection produced recent valid anchor (within last 150ms), return it
    if (this.lastNativeResult && now - this.lastNativeTimestamp < 150) {
      this.lastValidResult = this.lastNativeResult;
      this.lastDetectedTimestamp = now;
      return this.lastNativeResult;
    }

    if (!this.isInitialized || !this.classifyRegion || !this.detectionMemory) {
      return this.fallbackOrGrace(now);
    }

    // 2. Throttle heavy cascade scanning to ~15fps (every 65ms) to keep UI thread at silky 60fps
    if (this.cachedResult && now - this.lastTrackTime < 65) {
      return this.cachedResult;
    }
    this.lastTrackTime = now;

    // 3. Proportional buffer matching video aspect ratio (prevents squashing human faces)
    const videoAspect = (video.videoHeight || 480) / (video.videoWidth || 640);
    const vw = 240;
    const vh = Math.max(120, Math.min(240, Math.round(vw * videoAspect)));

    if (cvCanvas.width !== vw || cvCanvas.height !== vh) {
      cvCanvas.width = vw;
      cvCanvas.height = vh;
    }

    // Draw mirrored webcam image into tracking buffer
    cvCtx.save();
    cvCtx.translate(vw, 0);
    cvCtx.scale(-1, 1);
    cvCtx.drawImage(video, 0, 0, vw, vh);
    cvCtx.restore();

    let imgData: ImageData;
    try {
      imgData = cvCtx.getImageData(0, 0, vw, vh);
    } catch {
      return this.fallbackOrGrace(now);
    }

    const rgba = imgData.data;
    const gray = new Uint8Array(vw * vh);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    }

    // 4. Multi-scale cascade classification tuned for true webcam aspect ratio
    const minFaceSize = Math.max(28, Math.round(vw * 0.16));
    const maxFaceSize = Math.round(vw * 0.85);

    const params = {
      shiftfactor: 0.10, // 10% search step
      minsize: minFaceSize,
      maxsize: maxFaceSize,
      scalefactor: 1.14, // Geometric progression
    };

    let rawDets: number[][] = [];
    let scale = params.minsize;
    while (scale <= params.maxsize) {
      const step = Math.max(params.shiftfactor * scale, 2) >> 0;
      const offset = Math.ceil(scale / 2);

      const rMax = vh - offset;
      const cMax = vw - offset;

      for (let r = offset; r <= rMax; r += step) {
        for (let c = offset; c <= cMax; c += step) {
          const q = this.classifyRegion(r, c, scale, gray, vw);
          if (q > 0.0) {
            rawDets.push([r, c, scale, q]);
          }
        }
      }
      scale *= params.scalefactor;
    }

    // 5. Cluster and stabilize detections across consecutive frames
    rawDets = this.detectionMemory(rawDets);
    const clusters = this.clusterDetections(rawDets, 0.25);

    if (clusters.length === 0) {
      return this.fallbackOrGrace(now);
    }

    // Pick cluster with highest accumulated confidence
    const best = clusters[0];
    const r = best[0]; // face center row (Y)
    const c = best[1]; // face center col (X)
    const s = best[2]; // face scale/diameter
    const q = best[3]; // confidence score

    // Responsive threshold tuned for real-world webcam lighting
    if (q < 0.20) {
      return this.fallbackOrGrace(now);
    }

    // 6. Continuous 2D Pupil & Nasal Saddle Centroid Extraction:
    // Left eye (viewer's left): col c - s * 0.185, row r - s * 0.10
    // Right eye (viewer's right): col c + s * 0.185, row r - s * 0.10
    const yMin = Math.max(0, Math.round(r - s * 0.22));
    const yMax = Math.min(vh - 1, Math.round(r - s * 0.02));

    const xLMin = Math.max(0, Math.round(c - s * 0.30));
    const xLMax = Math.min(vw - 1, Math.round(c - s * 0.06));

    let sumWL = 0, sumXL = 0, sumYL = 0;
    for (let y = yMin; y <= yMax; y++) {
      const rowOffset = y * vw;
      for (let x = xLMin; x <= xLMax; x++) {
        const lum = gray[rowOffset + x];
        const w = Math.max(0, 155 - lum);
        if (w > 0) {
          sumWL += w;
          sumXL += w * x;
          sumYL += w * y;
        }
      }
    }

    const eyeLX = sumWL > 0 ? sumXL / sumWL : c - s * 0.185;
    const eyeLY = sumWL > 0 ? sumYL / sumWL : r - s * 0.10;

    const xRMin = Math.max(0, Math.round(c + s * 0.06));
    const xRMax = Math.min(vw - 1, Math.round(c + s * 0.30));

    let sumWR = 0, sumXR = 0, sumYR = 0;
    for (let y = yMin; y <= yMax; y++) {
      const rowOffset = y * vw;
      for (let x = xRMin; x <= xRMax; x++) {
        const lum = gray[rowOffset + x];
        const w = Math.max(0, 155 - lum);
        if (w > 0) {
          sumWR += w;
          sumXR += w * x;
          sumYR += w * y;
        }
      }
    }

    const eyeRX = sumWR > 0 ? sumXR / sumWR : c + s * 0.185;
    const eyeRY = sumWR > 0 ? sumYR / sumWR : r - s * 0.10;

    // Head roll rotation angle
    const rollRad = Math.atan2(eyeRY - eyeLY, eyeRX - eyeLX);

    // Nasal saddle resting point (Landmark 168 equivalent):
    // Directly centered between the eyes at nasal bone height
    const bridgeX = (eyeLX + eyeRX) / 2;
    const bridgeY = (eyeLY + eyeRY) / 2 + s * 0.01;

    // Adult temple-to-temple sunglasses width is ~2.25x IPD (eye span)
    const eyeSpan = Math.max(s * 0.32, eyeRX - eyeLX);
    const frameWidth = Math.max(s * 0.92, eyeSpan * 2.25);
    const frameWidthNorm = Math.min(0.70, Math.max(0.22, frameWidth / vw));

    const result: FaceTrackerResult = {
      detected: true,
      centerX: bridgeX / vw,
      bridgeY: bridgeY / vh,
      width: frameWidthNorm,
      rollRad: Math.max(-0.4, Math.min(0.4, rollRad)),
      confidence: q,
    };

    this.lastValidResult = result;
    this.cachedResult = result;
    this.lastDetectedTimestamp = now;
    return result;
  }

  /**
   * Grace period: retains last valid face location for up to 800ms
   * Prevents frames from flickering or snapping back if user blinks or moves quickly.
   */
  private fallbackOrGrace(now: number): FaceTrackerResult | null {
    if (this.lastValidResult && now - this.lastDetectedTimestamp < 800) {
      return {
        ...this.lastValidResult,
        confidence: Math.max(0.3, this.lastValidResult.confidence * 0.85),
      };
    }
    return null;
  }
}

export const picoDetector = new PicoDetector();
