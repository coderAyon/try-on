import type { FaceTrackerResult } from './picoDetector';

/** Run WASM in an extension-owned document, independent of the shop's script CSP. */
export class LandmarkTracker {
  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private ready = false;
  private busy = false;
  private lastReceived = 0;
  private result: FaceTrackerResult | null = null;
  private nextId = 0;
  // Full-resolution copies of the frames sent for analysis, keyed by request id.
  private pending = new Map<number, ImageBitmap>();
  // The camera frame the current `result` was computed from. Drawing this frame
  // instead of the live video keeps glasses glued to the face during motion.
  private syncedFrame: ImageBitmap | null = null;
  /** Incremented whenever a new tracking result arrives. */
  public version = 0;
  // Smoothed time between results. Frame sync is only worth it when tracking
  // keeps up with the camera; on slow machines the live video is shown instead.
  private interval = 1000;

  start() {
    if (this.iframe) return;
    const iframe = document.createElement('iframe');
    iframe.hidden = true;
    iframe.src = chrome.runtime.getURL('dist/tracker/index.html');
    iframe.onload = () => {
      const channel = new MessageChannel();
      this.port = channel.port1;
      this.port.onmessage = ({ data }) => {
        if (data.type === 'ready') this.ready = true;
        if (data.type === 'result') {
          this.busy = false;
          const now = performance.now();
          if (this.lastReceived) this.interval += (Math.min(1000, now - this.lastReceived) - this.interval) * 0.2;
          this.lastReceived = now;
          this.result = data.result;
          this.version++;
          this.adoptFrame(data.id);
        }
        if (data.type === 'error') {
          this.busy = false;
          this.pending.get(data.id)?.close();
          this.pending.delete(data.id);
          console.warn('[Lumen landmarks]', data.error);
        }
      };
      iframe.contentWindow?.postMessage({ type: 'lumen-tracker-connect' }, new URL(iframe.src).origin, [channel.port2]);
    };
    this.iframe = iframe;
    document.body.appendChild(iframe);
  }

  private adoptFrame(id: number) {
    const frame = this.pending.get(id);
    this.pending.delete(id);
    if (!frame) return;
    this.syncedFrame?.close();
    this.syncedFrame = frame;
  }

  track(video: HTMLVideoElement): FaceTrackerResult | null {
    const now = performance.now();
    // Send the next frame as soon as the previous one is done (no fixed throttle).
    if (this.ready && !this.busy && video.readyState >= 2) {
      this.busy = true;
      const port = this.port;
      const id = ++this.nextId;
      createImageBitmap(video).then(async full => {
        if (this.port !== port || !port) { full.close(); this.busy = false; return; }
        const small = await createImageBitmap(full, { resizeWidth: 480, resizeQuality: 'medium' });
        this.pending.set(id, full);
        port.postMessage({ type: 'frame', bitmap: small, id }, [small]);
      }).catch(() => { this.busy = false; });
    }
    return now - this.lastReceived < LandmarkTracker.STALE_MS ? this.result : null;
  }

  /** A slow device needs longer before a missing result means "no face". */
  static readonly STALE_MS = 700;

  /**
   * Camera frame matching the latest result, or null when tracking is stale or
   * too slow (< ~16 results/s) to drive the display without visible stutter.
   */
  get frame(): ImageBitmap | null {
    if (this.interval > 62 || performance.now() - this.lastReceived > 150) return null;
    return this.syncedFrame;
  }

  get available() { return this.ready; }

  close() {
    this.port?.close();
    this.iframe?.remove();
    this.port = null;
    this.iframe = null;
    this.ready = false;
    this.busy = false;
    this.result = null;
    this.lastReceived = 0;
    this.interval = 1000;
    this.syncedFrame?.close();
    this.syncedFrame = null;
    this.pending.forEach(b => b.close());
    this.pending.clear();
  }
}
