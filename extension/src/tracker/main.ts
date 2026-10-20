import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let connected = false;
window.addEventListener('message', async event => {
  if (connected || event.source !== parent || event.data?.type !== 'lumen-tracker-connect' || !event.ports[0]) return;
  connected = true;
  const port = event.ports[0];
  try {
    const vision = await FilesetResolver.forVisionTasks('../tracking/wasm');
    const tracker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '../tracking/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'IMAGE', numFaces: 1,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5,
    });
    port.onmessage = ({ data }) => {
      if (data.type !== 'frame' || !data.bitmap) return;
      const bitmap: ImageBitmap = data.bitmap;
      try {
        const face = tracker.detect(bitmap).faceLandmarks[0];
        let result = null;
        if (face) {
          // Iris centres when present; eye corners remain stable during blinks.
          const eye = (iris: number, a: number, b: number) => face[iris] || {
            x: (face[a].x + face[b].x) / 2, y: (face[a].y + face[b].y) / 2,
          };
          const eyes = [eye(468, 33, 133), eye(473, 362, 263)]
            .map(p => ({ x: 1 - p.x, y: p.y })).sort((a, b) => a.x - b.x);
          const dx = (eyes[1].x - eyes[0].x) * bitmap.width;
          const dy = (eyes[1].y - eyes[0].y) * bitmap.height;
          result = {
            detected: true, centerX: (eyes[0].x + eyes[1].x) / 2,
            bridgeY: (eyes[0].y + eyes[1].y) / 2,
            width: Math.hypot(dx, dy) * 2.25 / bitmap.width,
            eyeSpan: Math.hypot(dx, dy) / bitmap.width,
            rollRad: Math.atan2(dy, dx), confidence: 1,
          };
        }
        port.postMessage({ type: 'result', result });
      } catch (error) {
        port.postMessage({ type: 'error', error: String(error) });
      } finally { bitmap.close(); }
    };
    port.postMessage({ type: 'ready' });
  } catch (error) { port.postMessage({ type: 'error', error: String(error) }); }
});
