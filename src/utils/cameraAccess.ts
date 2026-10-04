// A stopped component can still have an unresolved browser camera request.
// Serialize requests so its eventual stream is released before a retry starts.
let pending: Promise<void> = Promise.resolve();
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 300));
export async function openTryOnCamera(cancelled: () => boolean): Promise<MediaStream | null> {
  const previous = pending;
  let finish!: () => void;
  pending = new Promise<void>(resolve => { finish = resolve; });
  await previous;
  try {
    if (cancelled()) return null;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or localhost and a supported browser.');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: attempt === 0 ? { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } }
            : { facingMode: 'user', frameRate: { ideal: 60, max: 60 } },
          audio: false,
        });
        if (cancelled()) { stream.getTracks().forEach(track => track.stop()); await pause(); return null; }
        return stream;
      } catch (error) {
        if (cancelled()) return null;
        const name = error instanceof Error ? error.name : '';
        if (attempt === 0 && ['NotReadableError', 'AbortError', 'OverconstrainedError'].includes(name)) {
          await pause();
          if (cancelled()) return null;
          continue;
        }
        throw error;
      }
    }
    return null;
  } finally { finish(); }
}

export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('noExitRuntime') || message.includes('Module.')) {
    return 'Face tracking engine refreshed. Click "Retry camera" to start streaming.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera could not start. Close other tabs or apps using your camera, then retry. If it stays unavailable, check your device camera settings.';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access is blocked. Allow camera access in your browser site settings and device privacy settings, then retry.';
  if (name === 'NotFoundError') return 'No available camera was found. Connect or enable your camera, then retry.';
  if (name === 'OverconstrainedError') return 'This camera could not use the requested video settings. Try another camera or use a photo.';
  return error instanceof Error ? error.message : 'Camera could not start. Please retry.';
}
