import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function sanitizeEmscriptenEnvironment() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  try {
    if ('Module' in win && win.Module) {
      try {
        delete win.Module.noExitRuntime;
      } catch {}
      try {
        delete win.Module;
      } catch {}
      try {
        win.Module = undefined;
      } catch {}
    }
  } catch {}
}

export async function createFaceDetector(runningMode: 'IMAGE' | 'VIDEO', numFaces = 1) {
  sanitizeEmscriptenEnvironment();
  const files = await FilesetResolver.forVisionTasks('/tracking/wasm');
  const confidence = runningMode === 'VIDEO' ? { minFaceDetectionConfidence: .6, minFacePresenceConfidence: .6, minTrackingConfidence: .6 } : {};
  try {
    sanitizeEmscriptenEnvironment();
    return await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/tracking/face_landmarker.task', delegate: 'GPU' }, runningMode, numFaces, ...confidence });
  } catch {
    sanitizeEmscriptenEnvironment();
    return await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/tracking/face_landmarker.task', delegate: 'CPU' }, runningMode, numFaces, ...confidence });
  }
}
