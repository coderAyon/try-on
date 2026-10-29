import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

type V = { x: number; y: number; z: number };
const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a: V, s: number): V => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V) => Math.sqrt(dot(a, a));
const norm = (a: V) => mul(a, 1 / (len(a) || 1));
const cross = (a: V, b: V): V => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * Converts the 478-point mesh into a rigid head pose. Landmarks are mirrored
 * (the mirror shows a flipped camera) and expressed in width-normalised units
 * so x, y and z share one scale. Eye corners are used instead of the irises:
 * they are fixed to the skull, so glasses no longer slide when the eyes move.
 */
function solvePose(face: NormalizedLandmark[], w: number, h: number, matrix?: ArrayLike<number>) {
  const P = (i: number): V => ({ x: 1 - face[i].x, y: face[i].y * h / w, z: face[i].z });
  const mid = (a: number, b: number) => mul(add(P(a), P(b)), 0.5);

  let eyeL = mid(33, 133), eyeR = mid(362, 263);
  if (eyeL.x > eyeR.x) [eyeL, eyeR] = [eyeR, eyeL];

  let xAxis: V, yAxis: V;
  if (matrix && matrix.length >= 16) {
    // Rotation from MediaPipe's solved head pose (column-major 4x4, OpenGL
    // camera: y up, z toward the viewer). Mirroring and flipping to screen
    // axes (y down, z into the screen) maps camera vector v to -v, and our
    // axes are canonical -x and -y, so they are simply columns 0 and 1.
    xAxis = norm({ x: matrix[0], y: matrix[1], z: matrix[2] });
    const col1 = { x: matrix[4], y: matrix[5], z: matrix[6] };
    yAxis = norm(sub(col1, mul(xAxis, dot(col1, xAxis))));
  } else {
    // Fallback from landmarks. MediaPipe's per-point depth is coarse, so this
    // overestimates pitch; only used if the matrix is unavailable.
    let across = add(sub(P(263), P(33)), sub(P(362), P(133)));
    if (across.x < 0) across = mul(across, -1);
    xAxis = norm(across);
    const down = sub(P(152), P(10));
    yAxis = norm(sub(down, mul(xAxis, dot(down, xAxis))));
  }
  // Halve the pitch: estimates carry a forward bias and laptop users look
  // down a lot; full foreshortening squashed the frame into a thin strip.
  const pitch = Math.asin(Math.max(-1, Math.min(1, yAxis.z)));
  const zRaw = cross(xAxis, yAxis);
  const t = -0.5 * pitch;
  yAxis = norm(add(mul(yAxis, Math.cos(t)), mul(zRaw, Math.sin(t))));
  const zAxis = cross(xAxis, yAxis);

  const origin = mul(add(eyeL, eyeR), 0.5);
  // Eye distance measured on screen is precise; undo the yaw foreshortening
  // with the solved axis instead of trusting per-landmark depth.
  const flat = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
  const ipd = flat / Math.max(0.35, Math.hypot(xAxis.x, xAxis.y));
  return { origin, xAxis, yAxis, zAxis, ipd, eyeL, eyeR };
}

let connected = false;
window.addEventListener('message', async event => {
  if (connected || event.source !== parent || event.data?.type !== 'lumen-tracker-connect' || !event.ports[0]) return;
  connected = true;
  const port = event.ports[0];
  try {
    const vision = await FilesetResolver.forVisionTasks('../tracking/wasm');
    const tracker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '../tracking/face_landmarker.task', delegate: 'CPU' },
      // VIDEO mode re-uses the previous face box between frames: faster and far less jittery.
      runningMode: 'VIDEO', numFaces: 1,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      outputFacialTransformationMatrixes: true,
    });
    let lastTs = 0;
    port.onmessage = ({ data }) => {
      if (data.type !== 'frame' || !data.bitmap) return;
      const bitmap: ImageBitmap = data.bitmap;
      try {
        const ts = Math.max(lastTs + 1, performance.now());
        lastTs = ts;
        const detection = tracker.detectForVideo(bitmap, ts);
        const face = detection.faceLandmarks[0];
        let result = null;
        if (face) {
          const pose = solvePose(face, bitmap.width, bitmap.height, detection.facialTransformationMatrixes?.[0]?.data);
          const { eyeL, eyeR } = pose;
          const aspect = bitmap.width / bitmap.height;
          result = {
            detected: true,
            centerX: pose.origin.x,
            bridgeY: pose.origin.y * aspect,
            width: pose.ipd * 2.25,
            eyeSpan: pose.ipd,
            rollRad: Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x),
            confidence: 1,
            pose: { origin: pose.origin, xAxis: pose.xAxis, yAxis: pose.yAxis, zAxis: pose.zAxis, ipd: pose.ipd },
          };
        }
        port.postMessage({ type: 'result', result, id: data.id });
      } catch (error) {
        port.postMessage({ type: 'error', error: String(error), id: data.id });
      } finally { bitmap.close(); }
    };
    port.postMessage({ type: 'ready' });
  } catch (error) { port.postMessage({ type: 'error', error: String(error) }); }
});
