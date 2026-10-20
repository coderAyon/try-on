import type { FaceTrackerResult } from './picoDetector';

/** Run WASM in an extension-owned document, independent of the shop's script CSP. */
export class LandmarkTracker {
  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private ready = false;
  private busy = false;
  private lastSent = 0;
  private lastReceived = 0;
  private result: FaceTrackerResult | null = null;

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
          this.lastReceived = performance.now();
          this.result = data.result;
        }
        if (data.type === 'error') {
          this.busy = false;
          console.warn('[Lumen landmarks]', data.error);
        }
      };
      iframe.contentWindow?.postMessage({ type: 'lumen-tracker-connect' }, new URL(iframe.src).origin, [channel.port2]);
    };
    this.iframe = iframe;
    document.body.appendChild(iframe);
  }

  track(video: HTMLVideoElement): FaceTrackerResult | null {
    const now = performance.now();
    if (this.ready && !this.busy && now - this.lastSent > 80) {
      this.busy = true;
      this.lastSent = now;
      const port = this.port;
      createImageBitmap(video, { resizeWidth: 480 }).then(bitmap => {
        if (this.port !== port) { bitmap.close(); return; }
        port?.postMessage({ type: 'frame', bitmap }, [bitmap]);
      }).catch(() => { this.busy = false; });
    }
    return now - this.lastReceived < 350 ? this.result : null;
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
  }
}
