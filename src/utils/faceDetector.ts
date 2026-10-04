import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export async function createFaceDetector(runningMode: 'IMAGE' | 'VIDEO', numFaces = 1) {
  const files = await FilesetResolver.forVisionTasks('/tracking/wasm');
  const confidence = runningMode === 'VIDEO' ? { minFaceDetectionConfidence: .6, minFacePresenceConfidence: .6, minTrackingConfidence: .6 } : {};
  try {
    return await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/tracking/face_landmarker.task', delegate: 'GPU' }, runningMode, numFaces, ...confidence });
  } catch {
    return FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/tracking/face_landmarker.task', delegate: 'CPU' }, runningMode, numFaces, ...confidence });
  }
}
