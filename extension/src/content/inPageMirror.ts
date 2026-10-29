/**
 * In-Page Floating AR Mirror Widget for Lumen Anywhere
 * Local MediaPipe iris tracking aligns the product's lens centres to the eyes.
 * Native/Pico detection supplies an approximate fit while WASM initializes.
 * Product photos are 2D cutouts; front-facing photos give the best fit.
 */

import { picoDetector, type FacePose, type FaceTrackerResult, type Vec3 } from './picoDetector';
import { LandmarkTracker } from './landmarkTracker';
import { GlassesRenderer, GRID_COLS, GRID_ROWS, type Shade } from './glassesRenderer';

export interface MirrorFramePayload {
  frame: string;
  title?: string;
  brand?: string;
  price?: number;
  domain?: string;
}

export interface EyewearGeometry {
  bridge: { x: number; y: number };
  opticalPupilY: number;
  frontWidth: number;
  lensSpan: number;
  roll: number;
}

/** One Euro filter: steady when the head is still, low lag when it moves. */
class OneEuro {
  private x = NaN;
  private dx = 0;
  constructor(private minCutoff: number, private beta: number, private dCutoff = 1) {}
  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(v: number, dt: number) {
    if (Number.isNaN(this.x)) { this.x = v; return v; }
    const d = (v - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (d - this.dx);
    this.x += this.alpha(this.minCutoff + this.beta * Math.abs(this.dx), dt) * (v - this.x);
    return this.x;
  }
  reset() { this.x = NaN; this.dx = 0; }
}

const vNorm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const vDot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const vCross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});

class InPageMirror {
  private landmarks = new LandmarkTracker();
  private frameRequest = 0;
  private lastFaceSeen = 0;
  private container: HTMLElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private frameGeom: EyewearGeometry | null = null;

  // Buffer for fast real-time eye-level and head tracking
  private cvCanvas: HTMLCanvasElement | null = null;
  private cvCtx: CanvasRenderingContext2D | null = null;

  private cutoutCanvas: HTMLCanvasElement | null = null;
  private fallbackImage: HTMLImageElement | null = null;

  private isRunning: boolean = false;
  private isMinimized: boolean = false;
  private animFrameId: number = 0;

  // Fit calibration parameters (calibrated to human webcam eye-level)
  private userScale: number = 1.0;
  private userOffsetY: number = 0;
  private userOffsetX: number = 0;

  // Filtered head pose: origin (3), x axis (3), y axis (3), ipd (1)
  private renderer = new GlassesRenderer();
  private poseFilters = [
    ...[0, 1, 2].map(() => new OneEuro(1.7, 12)),
    ...[0, 1, 2, 3, 4, 5].map(() => new OneEuro(1.5, 6)),
    new OneEuro(0.6, 3),
  ];
  private pose: FacePose | null = null;
  private lastPoseTime = 0;
  private lastTrackVersion = -1;
  private hasFittedOnce: boolean = false;
  private meshPositions = new Float32Array((GRID_COLS + 1) * (GRID_ROWS + 1) * 3);
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private frameCounter = 0;
  private shade: Shade = { gain: 1, tint: [1, 1, 1] };

  // Direct canvas drag-to-fit support
  private isDraggingGlasses: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Header window drag support
  private isDraggingWindow: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  private currentPayload: MirrorFramePayload | null = null;

  /**
   * Opens or updates the in-page floating mirror with the specified sunglasses frame
   */
  public async open(payload: MirrorFramePayload) {
    this.resetCalibration();
    this.currentPayload = payload;

    if (!this.container) {
      this.createWidget();
    }

    this.updateProductInfo();
    this.show();
    this.landmarks.start();

    if (this.isMinimized) {
      this.expand();
    }

    // 1. Immediately start webcam video
    if (!this.stream) {
      this.startCamera().catch((err) => {
        console.error('[Lumen Mirror] Camera error:', err);
      });
    }

    // 2. Load & isolate sunglasses image with reflection-stripping
    this.setStatus('Fitting frame…');
    this.loadAndProcessFrame(payload.frame).catch((err) => {
      console.warn('[Lumen Mirror] Frame processing failed:', err);
      this.setStatus('Could not load this frame. Try another product image.');
    });
  }

  /**
   * Creates the floating mirror DOM structure
   */
  private createWidget() {
    const existing = document.getElementById('lumen-floating-mirror');
    if (existing) existing.remove();

    const widget = document.createElement('div');
    widget.id = 'lumen-floating-mirror';
    widget.className = 'lumen-mirror-box';
    widget.innerHTML = `
      <!-- Header / Drag Bar -->
      <div class="lumen-mirror-header" id="lumen-mirror-drag-handle">
        <div class="lumen-mirror-brand">
          <span class="lumen-mirror-logo">🕶️</span>
          <span class="lumen-mirror-title">Lumen AR Mirror</span>
          <span class="lumen-live-dot" id="lumen-face-status" title="Camera Active"></span>
          <span class="lumen-face-lock-badge" id="lumen-face-badge">Live AR Fit</span>
        </div>
        <div class="lumen-mirror-actions">
          <button class="lumen-btn-icon" id="lumen-btn-minimize" title="Minimize to pill">_</button>
          <button class="lumen-btn-icon lumen-btn-close" id="lumen-btn-close" title="Close mirror">✕</button>
        </div>
      </div>

      <!-- Active Frame Banner -->
      <div class="lumen-mirror-meta">
        <span class="lumen-meta-title" id="lumen-meta-title">Sunglasses</span>
        <span class="lumen-meta-brand" id="lumen-meta-brand">Store Frame</span>
      </div>

      <!-- Camera Viewport Container -->
      <div class="lumen-mirror-viewport" id="lumen-viewport-area">
        <video id="lumen-mirror-video" playsinline autoplay muted></video>
        <canvas id="lumen-mirror-canvas"></canvas>
        <div class="lumen-mirror-flash" id="lumen-mirror-flash"></div>
        <div class="lumen-mirror-status" id="lumen-mirror-status">
          <div class="lumen-status-spinner"></div>
          <span class="lumen-status-text">Starting Camera…</span>
        </div>
      </div>

      <!-- Interactive Controls Toolbar -->
      <div class="lumen-mirror-controls">
        <div class="lumen-ctrl-group">
          <span class="lumen-ctrl-label">Size:</span>
          <button class="lumen-ctrl-btn" id="lumen-btn-scale-down" title="Scale smaller">-</button>
          <span class="lumen-ctrl-val" id="lumen-val-scale">100%</span>
          <button class="lumen-ctrl-btn" id="lumen-btn-scale-up" title="Scale larger">+</button>
        </div>

        <div class="lumen-ctrl-group">
          <span class="lumen-ctrl-label">Nose:</span>
          <button class="lumen-ctrl-btn" id="lumen-btn-move-up" title="Move higher">▲</button>
          <button class="lumen-ctrl-btn" id="lumen-btn-move-down" title="Move lower">▼</button>
        </div>

        <div class="lumen-ctrl-group lumen-ctrl-right">
          <button class="lumen-snap-btn" id="lumen-btn-snapshot" title="Take a photo">📸 Snap</button>
          <button class="lumen-ctrl-btn" id="lumen-btn-reset" title="Reset adjustments">↺</button>
        </div>
      </div>

      <!-- Minimized Floating Pill (visible when minimized) -->
      <div class="lumen-minimized-pill" id="lumen-minimized-pill">
        <span class="lumen-pill-icon">🕶️</span>
        <span class="lumen-pill-text" id="lumen-pill-text">Lumen Mirror Active</span>
        <span class="lumen-pill-expand">✦ Click to view</span>
      </div>
    `;

    document.body.appendChild(widget);
    this.container = widget;

    this.videoEl = widget.querySelector<HTMLVideoElement>('#lumen-mirror-video');
    this.canvasEl = widget.querySelector<HTMLCanvasElement>('#lumen-mirror-canvas');
    if (this.canvasEl) {
      this.ctx = this.canvasEl.getContext('2d', { alpha: true });
    }

    this.cvCanvas = document.createElement('canvas');
    this.cvCanvas.width = 240;
    this.cvCanvas.height = 180;
    this.cvCtx = this.cvCanvas.getContext('2d', { willReadFrequently: true });

    this.attachEvents();
  }

  /**
   * Attaches interactive event handlers (buttons, sliders, direct mouse drag)
   */
  private attachEvents() {
    if (!this.container || !this.canvasEl) return;

    // Close button
    const closeBtn = this.container.querySelector('#lumen-btn-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Minimize button
    const minBtn = this.container.querySelector('#lumen-btn-minimize');
    minBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    // Minimized pill click -> expand
    const pill = this.container.querySelector('#lumen-minimized-pill');
    pill?.addEventListener('click', () => {
      this.expand();
    });

    // Fit Controls
    const scaleUp = this.container.querySelector('#lumen-btn-scale-up');
    scaleUp?.addEventListener('click', () => this.adjustScale(0.08));

    const scaleDown = this.container.querySelector('#lumen-btn-scale-down');
    scaleDown?.addEventListener('click', () => this.adjustScale(-0.08));

    const moveUp = this.container.querySelector('#lumen-btn-move-up');
    moveUp?.addEventListener('click', () => this.adjustOffsetY(-12));

    const moveDown = this.container.querySelector('#lumen-btn-move-down');
    moveDown?.addEventListener('click', () => this.adjustOffsetY(12));

    const resetBtn = this.container.querySelector('#lumen-btn-reset');
    resetBtn?.addEventListener('click', () => this.resetCalibration());

    const snapBtn = this.container.querySelector('#lumen-btn-snapshot');
    snapBtn?.addEventListener('click', () => this.takeSnapshot());

    // Direct canvas drag-and-drop: click and drag the glasses directly to any position!
    this.canvasEl.style.cursor = 'grab';
    this.canvasEl.addEventListener('mousedown', (e) => {
      this.isDraggingGlasses = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvasEl!.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDraggingGlasses || !this.canvasEl) return;
      const rect = this.canvasEl.getBoundingClientRect();
      const scaleX = this.canvasEl.width / (rect.width || 1);
      const scaleY = this.canvasEl.height / (rect.height || 1);
      const dx = (e.clientX - this.lastMouseX) * scaleX;
      const dy = (e.clientY - this.lastMouseY) * scaleY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      // Follow cursor directly
      this.userOffsetX += dx;
      this.userOffsetY += dy;
    });

    window.addEventListener('mouseup', () => {
      if (this.isDraggingGlasses) {
        this.isDraggingGlasses = false;
        if (this.canvasEl) this.canvasEl.style.cursor = 'grab';
      }
    });

    // Drag header handle to move window around screen
    const header = this.container.querySelector('#lumen-mirror-drag-handle') as HTMLElement;
    if (header) {
      header.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).closest('.lumen-btn-icon, .lumen-btn-studio')) return;
        this.isDraggingWindow = true;
        const rect = this.container!.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartY = e.clientY - rect.top;
        header.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDraggingWindow || !this.container) return;
        const newLeft = e.clientX - this.dragStartX;
        const newTop = e.clientY - this.dragStartY;
        this.container.style.left = `${Math.max(10, Math.min(window.innerWidth - 360, newLeft))}px`;
        this.container.style.top = `${Math.max(10, Math.min(window.innerHeight - 440, newTop))}px`;
        this.container.style.bottom = 'auto';
        this.container.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        if (this.isDraggingWindow && header) {
          this.isDraggingWindow = false;
          header.style.cursor = 'grab';
        }
      });
    }
  }

  /**
   * Opens the full 3D AR Virtual Try-On Studio in a dedicated browser tab
   */
  public openFullStudio() {
    if (!this.currentPayload) return;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'OPEN_TRYON',
          payload: {
            frame: this.currentPayload.frame,
            title: this.currentPayload.title,
            brand: this.currentPayload.brand,
            price: this.currentPayload.price,
            domain: window.location.hostname,
          },
        });
      }
    } catch (err) {
      console.warn('[Lumen Mirror] Failed to send OPEN_TRYON message:', err);
    }
  }

  /**
   * Updates title and metadata
   */
  private updateProductInfo() {
    if (!this.container || !this.currentPayload) return;
    const titleEl = this.container.querySelector('#lumen-meta-title');
    const brandEl = this.container.querySelector('#lumen-meta-brand');
    const pillText = this.container.querySelector('#lumen-pill-text');

    const brand = this.currentPayload.brand || 'Eyewear Store';
    const title = this.currentPayload.title || 'Sunglasses';

    if (titleEl) titleEl.textContent = title;
    if (brandEl) brandEl.textContent = brand;
    if (pillText) pillText.textContent = `${brand} · ${title}`;
  }

  /**
   * Status overlay helper
   */
  private setStatus(msg: string | null) {
    if (!this.container) return;
    const statusEl = this.container.querySelector<HTMLElement>('#lumen-mirror-status');
    const textEl = this.container.querySelector<HTMLElement>('.lumen-status-text');
    if (!statusEl || !textEl) return;

    if (msg) {
      textEl.textContent = msg;
      statusEl.style.display = 'flex';
    } else {
      statusEl.style.display = 'none';
    }
  }

  /**
   * Starts user webcam video stream
   */
  private async startCamera() {
    this.setStatus('Requesting Camera Access…');
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        this.setStatus('Camera API not available');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      this.stream = stream;
      if (this.videoEl) {
        this.videoEl.srcObject = stream;
        await this.videoEl.play();
        this.syncCanvasDimensions();
      }

      this.setStatus(null);
      this.isRunning = true;
      this.startRenderLoop();
    } catch (err: any) {
      console.error('[Lumen Mirror] Camera error:', err);
      this.setStatus('Camera blocked. Please allow camera permission.');
    }
  }

  /**
   * Syncs canvas dimensions to video
   */
  private syncCanvasDimensions() {
    if (!this.videoEl || !this.canvasEl) return;
    const w = this.videoEl.videoWidth || 640;
    const h = this.videoEl.videoHeight || 480;
    this.canvasEl.width = w;
    this.canvasEl.height = h;

    // Preserve the video aspect ratio in the display as well as the canvas.
    const vp = this.container?.querySelector<HTMLElement>('#lumen-viewport-area');
    if (vp) {
      vp.style.height = 'auto';
      vp.style.aspectRatio = `${w} / ${h}`;
    }
  }

  /**
   * Loads image via background data URL proxy or direct image with fallback
   */
  private async loadAndProcessFrame(srcUrl: string) {
    const request = ++this.frameRequest;
    this.cutoutCanvas = null;
    this.fallbackImage = null;
    this.frameGeom = null;
    if (typeof Image === 'undefined') {
      this.setStatus(null);
      return;
    }

    let resolvedUrl = srcUrl;

    // Fetch via background service worker to completely bypass CORS
    try {
      const resp = await new Promise<any>((resolve) => {
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              { type: 'FETCH_IMAGE_DATA_URL', payload: { url: srcUrl } },
              (res) => {
                if (chrome.runtime?.lastError) resolve(null);
                else resolve(res);
              }
            );
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
      if (resp && resp.dataUrl) {
        resolvedUrl = resp.dataUrl;
      }
    } catch {}

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => {
        reject(new Error('Could not load the selected frame image'));
      };
      img.src = resolvedUrl;
    });

    if (request !== this.frameRequest) return;

    try {
      const cutout = this.removeBackground(img);
      // Geometry first: it relies on the lenses still being solid.
      this.frameGeom = this.analyzeEyewearGeometry(cutout);
      this.refineLenses(cutout);
      this.cutoutCanvas = cutout;
      this.fallbackImage = null;
      this.renderer.setTexture(cutout);
    } catch (err) {
      console.warn('[Lumen Mirror] Background removal error, using raw image:', err);
      this.setStatus('Unable to process this image. Choose a front-facing product photo.');
      this.frameGeom = null;
      return;
    }

    this.setStatus(null);
  }

  /**
   * Client-side background removal & transparent frame generator
   * Multi-seed BFS flood-fill that handles both white and dark backgrounds,
   * automatically strips tabletop specular reflections, and trims temple arms.
   */
  private removeBackground(image: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const width = image.naturalWidth || image.width || 400;
    const height = image.naturalHeight || image.height || 200;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not create frame canvas');

    ctx.drawImage(image, 0, 0);

    let imgData: ImageData;
    try {
      imgData = ctx.getImageData(0, 0, width, height);
    } catch {
      throw new Error('Product image cannot be read for background removal');
    }

    const data = imgData.data;

    // Already a cut-out PNG? Judge by the border: semi-transparent lenses on
    // an opaque white background must still go through background removal.
    let borderTransparent = 0, borderCount = 0;
    for (let x = 0; x < width; x++) {
      for (const y of [0, height - 1]) {
        borderCount++;
        if (data[(y * width + x) * 4 + 3] < 200) borderTransparent++;
      }
    }
    for (let y = 1; y < height - 1; y++) {
      for (const x of [0, width - 1]) {
        borderCount++;
        if (data[(y * width + x) * 4 + 3] < 200) borderTransparent++;
      }
    }
    const isAlreadyIsolated = borderTransparent > borderCount * 0.5;

    if (!isAlreadyIsolated) {
      // 1. Multi-seed border sampling around perimeter
      const sampleIndices: [number, number][] = [
        [1, 1],
        [width - 2, 1],
        [1, height - 2],
        [width - 2, height - 2],
        [Math.floor(width / 2), 1],
        [Math.floor(width / 2), height - 2],
        [1, Math.floor(height / 2)],
        [width - 2, Math.floor(height / 2)],
        [Math.floor(width * 0.25), 1],
        [Math.floor(width * 0.75), 1],
        [Math.floor(width * 0.25), height - 2],
        [Math.floor(width * 0.75), height - 2],
      ];

      const seeds: { r: number; g: number; b: number }[] = [];
      for (const [x, y] of sampleIndices) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          seeds.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
        }
      }

      // Pixel matches background if close to any seed or near-white
      const isBgPixel = (r: number, g: number, b: number) => {
        if (r > 238 && g > 238 && b > 238) return true;
        for (const s of seeds) {
          const dr = r - s.r;
          const dg = g - s.g;
          const db = b - s.b;
          if ((dr * dr + dg * dg + db * db) < 3200) return true;
        }
        return false;
      };

      // 2. BFS Flood-fill starting at all image borders
      const visited = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      let qHead = 0, qTail = 0;

      for (let x = 0; x < width; x++) {
        const topIdx = x * 4;
        if (isBgPixel(data[topIdx], data[topIdx + 1], data[topIdx + 2])) {
          visited[x] = 1;
          queue[qTail++] = x;
        }
        const bot = (height - 1) * width + x;
        const botIdx = bot * 4;
        if (isBgPixel(data[botIdx], data[botIdx + 1], data[botIdx + 2])) {
          visited[bot] = 1;
          queue[qTail++] = bot;
        }
      }
      for (let y = 0; y < height; y++) {
        const left = y * width;
        if (!visited[left]) {
          const lIdx = left * 4;
          if (isBgPixel(data[lIdx], data[lIdx + 1], data[lIdx + 2])) {
            visited[left] = 1;
            queue[qTail++] = left;
          }
        }
        const right = y * width + width - 1;
        if (!visited[right]) {
          const rIdx = right * 4;
          if (isBgPixel(data[rIdx], data[rIdx + 1], data[rIdx + 2])) {
            visited[right] = 1;
            queue[qTail++] = right;
          }
        }
      }

      while (qHead < qTail) {
        const pos = queue[qHead++];
        const px = pos % width;
        const py = (pos / width) | 0;

        const n1 = px > 0 ? pos - 1 : -1;
        const n2 = px < width - 1 ? pos + 1 : -1;
        const n3 = py > 0 ? pos - width : -1;
        const n4 = py < height - 1 ? pos + width : -1;

        for (const n of [n1, n2, n3, n4]) {
          if (n >= 0 && !visited[n]) {
            const nIdx = n * 4;
            if (isBgPixel(data[nIdx], data[nIdx + 1], data[nIdx + 2])) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }
      }

      // Enclosed background pockets (between double bridges, inside clear lenses,
      // baked-in "transparent" checkerboards) are unreachable from the border.
      // Clear sizeable ones that match the background colour tightly.
      this.clearEnclosedBackground(data, width, height, visited, seeds);

      this.softMatte(data, width, height, visited, seeds);
    }

    // Shop watermarks, logos and price text are separate islands; keep the glasses.
    this.eraseCastShadows(data, width, height);
    this.keepMainComponents(data, width, height);

    // 3. Find bounding box of remaining frame pixels
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 25) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      return canvas;
    }

    const frameW = maxX - minX + 1;

    // 4. Locate Front Frame Top and Bottom to completely strip Table Reflections
    const rowDensity = new Int32Array(height);
    let maxDensity = 0;
    for (let y = minY; y <= maxY; y++) {
      let count = 0;
      for (let x = minX; x <= maxX; x++) {
        if (data[(y * width + x) * 4 + 3] > 25) count++;
      }
      rowDensity[y] = count;
      if (count > maxDensity) maxDensity = count;
    }

    // Stop at the first gap under the actual front. Searching from the image's
    // bottom instead mistakes a tabletop reflection for the lower lens rims.
    let mainRow = minY;
    for (let y = minY; y <= maxY; y++) {
      if (rowDensity[y] >= maxDensity * 0.55) { mainRow = y; break; }
    }
    let gap = 0;
    for (let y = mainRow + Math.round(frameW * 0.12); y <= maxY; y++) {
      gap = rowDensity[y] < maxDensity * 0.16 ? gap + 1 : 0;
      if (gap >= Math.max(2, Math.round(frameW * 0.008))) {
        maxY = y - gap;
        break;
      }
    }

    let frontTopY = minY;
    for (let y = minY; y <= maxY; y++) {
      if (rowDensity[y] >= Math.max(8, maxDensity * 0.18)) {
        frontTopY = y;
        break;
      }
    }

    // Identify bottom rim of both lenses (ignoring specular reflections below)
    let leftLensBotY = frontTopY;
    let rightLensBotY = frontTopY;

    for (let x = Math.round(minX + frameW * 0.20); x <= Math.round(minX + frameW * 0.42); x++) {
      for (let y = maxY; y >= frontTopY; y--) {
        if (data[(y * width + x) * 4 + 3] > 35) {
          leftLensBotY = Math.max(leftLensBotY, y);
          break;
        }
      }
    }
    for (let x = Math.round(minX + frameW * 0.58); x <= Math.round(minX + frameW * 0.80); x++) {
      for (let y = maxY; y >= frontTopY; y--) {
        if (data[(y * width + x) * 4 + 3] > 35) {
          rightLensBotY = Math.max(rightLensBotY, y);
          break;
        }
      }
    }

    const estimatedLensBot = Math.max(leftLensBotY, rightLensBotY);
    const maxLensH = Math.round(frameW * 0.50);
    const cutBottomY = Math.min(maxY, Math.min(frontTopY + maxLensH, estimatedLensBot + 3));

    // Clear all tabletop reflection pixels below the bottom rim
    for (let y = cutBottomY; y <= height - 1; y++) {
      for (let x = 0; x < width; x++) {
        data[(y * width + x) * 4 + 3] = 0;
      }
    }

    // 5. Trim Temple Arms extending downwards/backwards on outer flanks
    const templeOuterLeft = minX + frameW * 0.09;
    const templeOuterRight = maxX - frameW * 0.09;
    const templeCutY = Math.max(frontTopY + 10, estimatedLensBot - 4);

    for (let y = templeCutY; y <= cutBottomY; y++) {
      for (let x = minX; x < templeOuterLeft; x++) {
        data[(y * width + x) * 4 + 3] = 0;
      }
      for (let x = Math.round(templeOuterRight); x <= maxX; x++) {
        data[(y * width + x) * 4 + 3] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Recompute clean crop boundaries
    let cropMinX = width, cropMinY = height, cropMaxX = 0, cropMaxY = 0;
    let cleanCount = 0;
    for (let y = frontTopY; y < cutBottomY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (data[(y * width + x) * 4 + 3] > 25) {
          cropMinX = Math.min(cropMinX, x);
          cropMinY = Math.min(cropMinY, y);
          cropMaxX = Math.max(cropMaxX, x);
          cropMaxY = Math.max(cropMaxY, y);
          cleanCount++;
        }
      }
    }

    if (cleanCount > 30 && cropMaxX > cropMinX && cropMaxY > cropMinY) {
      const cropW = cropMaxX - cropMinX + 1;
      const cropH = cropMaxY - cropMinY + 1;
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(canvas, cropMinX, cropMinY, cropW, cropH, 0, 0, cropW, cropH);
        return croppedCanvas;
      }
    }

    return canvas;
  }

  /**
   * Removes opaque islands that are much smaller than the largest one (logos,
   * watermarks, captions). Rimless lenses and separate temple pieces are
   * comparable in size to the main piece, so they survive.
   */
  private keepMainComponents(data: Uint8ClampedArray, width: number, height: number) {
    const n = width * height;
    const label = new Int32Array(n);
    const sizes: number[] = [0];
    const stack = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (label[start] || data[start * 4 + 3] <= 25) continue;
      const id = sizes.length;
      let size = 0, sp = 0;
      stack[sp++] = start;
      label[start] = id;
      while (sp > 0) {
        const p = stack[--sp];
        size++;
        const x = p % width, y = (p / width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            const q = yy * width + xx;
            if (!label[q] && data[q * 4 + 3] > 25) {
              label[q] = id;
              stack[sp++] = q;
            }
          }
        }
      }
      sizes.push(size);
    }
    if (sizes.length <= 2) return;
    const keepMin = Math.max(...sizes) * 0.12;
    for (let i = 0; i < n; i++) {
      const l = label[i];
      if (l && sizes[l] < keepMin) data[i * 4 + 3] = 0;
    }
  }

  /**
   * Product photos often carry a soft grey drop shadow under the bridge; left
   * in, it shows up as a pale ghost on the nose. Grow from the transparent
   * area into neutral, light, smooth pixels (shadow), stopping at the frame:
   * rims are dark, coloured or carry sharp edges.
   */
  private eraseCastShadows(data: Uint8ClampedArray, width: number, height: number) {
    const n = width * height;
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      lum[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    }
    const isShadow = (i: number) => {
      const a = data[i * 4 + 3];
      if (a <= 25) return false;
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 30) return false;
      const x = i % width;
      if (a < 150) {
        // Shadows baked into transparent PNGs are faint. Anti-aliased frame
        // edges are faint too, but always touch a solid frame pixel.
        const y = (i / width) | 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < width && data[(yy * width + xx) * 4 + 3] > 200) return false;
          }
        }
        return true;
      }
      if (lum[i] < 120) return false;
      let grad = 0;
      if (x > 0) grad = Math.max(grad, Math.abs(lum[i] - lum[i - 1]));
      if (x < width - 1) grad = Math.max(grad, Math.abs(lum[i] - lum[i + 1]));
      if (i >= width) grad = Math.max(grad, Math.abs(lum[i] - lum[i - width]));
      if (i + width < n) grad = Math.max(grad, Math.abs(lum[i] - lum[i + width]));
      return grad < 14;
    };
    const queue = new Int32Array(n);
    const done = new Uint8Array(n);
    let head = 0, tail = 0;
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] <= 25) { done[i] = 1; queue[tail++] = i; }
    }
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const nb = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const q of nb) {
        if (q < 0 || q >= n || done[q]) continue;
        done[q] = 1;
        if (isShadow(q)) {
          data[q * 4 + 3] = 0;
          queue[tail++] = q;
        }
      }
    }
  }

  private clearEnclosedBackground(
    data: Uint8ClampedArray, width: number, height: number,
    visited: Uint8Array, seeds: { r: number; g: number; b: number }[],
  ) {
    const n = width * height;
    const isTightBg = (i: number) => {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (r > 246 && g > 246 && b > 246) return true;
      for (const s of seeds) {
        const dr = r - s.r, dg = g - s.g, db = b - s.b;
        if (dr * dr + dg * dg + db * db < 900) return true;
      }
      return false;
    };
    const minArea = Math.max(40, n * 0.003);
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    const region: number[] = [];
    for (let start = 0; start < n; start++) {
      if (visited[start] || seen[start] || !isTightBg(start)) continue;
      region.length = 0;
      let sp = 0;
      stack[sp++] = start;
      seen[start] = 1;
      while (sp > 0) {
        const p = stack[--sp];
        region.push(p);
        const x = p % width;
        const nb = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
        for (const q of nb) {
          if (q >= 0 && q < n && !visited[q] && !seen[q] && isTightBg(q)) {
            seen[q] = 1;
            stack[sp++] = q;
          }
        }
      }
      if (region.length >= minArea) for (const p of region) visited[p] = 1;
    }
  }

  /**
   * Turns the binary flood-fill mask into a soft alpha matte and removes the
   * background colour that bleeds into anti-aliased edge pixels (the white /
   * grey fringe that made frames look like hand-cut stickers).
   */
  private softMatte(
    data: Uint8ClampedArray, width: number, height: number,
    visited: Uint8Array, seeds: { r: number; g: number; b: number }[],
  ) {
    const n = width * height;
    const palette = [...seeds, { r: 255, g: 255, b: 255 }];
    const dist = new Float32Array(n);
    const nearest = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      let best = Infinity, bi = 0;
      for (let k = 0; k < palette.length; k++) {
        const s = palette[k];
        const d = (r - s.r) ** 2 + (g - s.g) ** 2 + (b - s.b) ** 2;
        if (d < best) { best = d; bi = k; }
      }
      dist[i] = Math.sqrt(best);
      nearest[i] = bi;
    }

    // Edge band: pixels within 2px of the foreground/background boundary.
    const band = new Uint8Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const v = visited[i];
        if ((x > 0 && visited[i - 1] !== v) || (x < width - 1 && visited[i + 1] !== v) ||
            (y > 0 && visited[i - width] !== v) || (y < height - 1 && visited[i + width] !== v)) {
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && xx < width && yy >= 0 && yy < height) band[yy * width + xx] = 1;
            }
          }
        }
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!band[i]) {
          if (visited[i]) data[i * 4 + 3] = 0;
          continue;
        }
        // Distance of the nearby solid frame colour from the background.
        let dmax = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
            const j = yy * width + xx;
            if (!visited[j] && dist[j] > dmax) dmax = dist[j];
          }
        }
        let a = dmax > 30 ? (dist[i] - 10) / (dmax - 10) : (visited[i] ? 0 : 1);
        a = Math.max(0, Math.min(1, a));
        if (a <= 0.02) { data[i * 4 + 3] = 0; continue; }
        if (a < 0.98) {
          // Un-mix the background: C = B + (I - B) / alpha
          const s = palette[nearest[i]];
          data[i * 4] = Math.max(0, Math.min(255, s.r + (data[i * 4] - s.r) / a));
          data[i * 4 + 1] = Math.max(0, Math.min(255, s.g + (data[i * 4 + 1] - s.g) / a));
          data[i * 4 + 2] = Math.max(0, Math.min(255, s.b + (data[i * 4 + 2] - s.b) / a));
        }
        data[i * 4 + 3] = Math.round(data[i * 4 + 3] * a);
      }
    }
  }

  /**
   * Real lenses are tinted glass, not paint. Pixels deep inside the frame
   * outline (further than the rim thickness from any edge) are treated as lens
   * and made semi-transparent so the eyes show through faintly, while specular
   * highlights stay visible. Clear lenses become almost fully transparent.
   */
  private refineLenses(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, n = W * H;
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;

    // Chamfer distance to the nearest transparent pixel (or image border).
    const INF = 1e6;
    const dist = new Float32Array(n);
    for (let i = 0; i < n; i++) dist[i] = d[i * 4 + 3] < 128 ? 0 : INF;
    const D = Math.SQRT2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (dist[i] === 0) continue;
        let v = (x === 0 || y === 0) ? 1 : dist[i];
        if (x > 0) v = Math.min(v, dist[i - 1] + 1);
        if (y > 0) {
          v = Math.min(v, dist[i - W] + 1);
          if (x > 0) v = Math.min(v, dist[i - W - 1] + D);
          if (x < W - 1) v = Math.min(v, dist[i - W + 1] + D);
        }
        dist[i] = v;
      }
    }
    for (let y = H - 1; y >= 0; y--) {
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        if (dist[i] === 0) continue;
        let v = (x === W - 1 || y === H - 1) ? 1 : dist[i];
        if (x < W - 1) v = Math.min(v, dist[i + 1] + 1);
        if (y < H - 1) {
          v = Math.min(v, dist[i + W] + 1);
          if (x < W - 1) v = Math.min(v, dist[i + W + 1] + D);
          if (x > 0) v = Math.min(v, dist[i + W - 1] + D);
        }
        dist[i] = v;
      }
    }

    const rim = Math.max(3, W * 0.035);
    const lum = (i: number) => (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    const interior: number[] = [];
    for (let i = 0; i < n; i++) if (dist[i] > rim * 1.4) interior.push(lum(i));
    if (interior.length < n * 0.03) return; // wire frames / already-clear lenses
    interior.sort((a, b) => a - b);
    const medianL = interior[interior.length >> 1];
    const clear = medianL > 0.78;
    const base = Math.max(0.62, Math.min(0.9, 0.95 - medianL * 0.55));
    const hiStart = Math.max(medianL * 1.6, 0.35);

    const smooth = (e0: number, e1: number, v: number) => {
      const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    for (let i = 0; i < n; i++) {
      if (dist[i] <= rim) continue;
      const t = smooth(rim, rim * 1.8, dist[i]);
      const L = lum(i);
      const lensA = clear
        ? Math.max(0.04, Math.min(0.5, (0.92 - L) * 1.6))
        : base + (0.96 - base) * smooth(hiStart, 0.95, L);
      d[i * 4 + 3] = Math.round(d[i * 4 + 3] * (1 + (lensA - 1) * t));
    }
    ctx.putImageData(img, 0, 0);
  }

  /**
   * Local Project Optical Eyewear Geometry Calculation:
   * Accurately extracts bridge coordinates, pupil eyeline, and lens span
   * matching customFrameProcessor.ts from the local project.
   */
  private analyzeEyewearGeometry(canvas: HTMLCanvasElement): EyewearGeometry {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    if (!ctx) {
      return {
        bridge: { x: width * 0.5, y: height * 0.44 },
        opticalPupilY: height * 0.42,
        frontWidth: width,
        lensSpan: width * 0.44,
        roll: 0,
      };
    }
    const { data } = ctx.getImageData(0, 0, width, height);

    const density = new Float32Array(width);
    const colTopY = new Int32Array(width).fill(-1);
    const colBotY = new Int32Array(width).fill(-1);
    const colCenterY = new Float32Array(width);
    let maxD = 0;

    for (let x = 0; x < width; x++) {
      let topY = -1, botY = -1, count = 0;
      for (let y = 0; y < height; y++) {
        if (data[(y * width + x) * 4 + 3] > 25) {
          if (topY < 0) topY = y;
          botY = y;
          count++;
        }
      }
      if (topY >= 0) {
        colTopY[x] = topY;
        colBotY[x] = botY;
        colCenterY[x] = (topY + botY) * 0.5;
        density[x] = count;
        if (count > maxD) maxD = count;
      }
    }

    if (maxD < 4) {
      return {
        bridge: { x: width * 0.5, y: height * 0.44 },
        opticalPupilY: height * 0.42,
        frontWidth: width,
        lensSpan: width * 0.44,
        roll: 0,
      };
    }

    let frontMinX = width, frontMaxX = 0;
    for (let x = 0; x < width; x++) {
      if (density[x] > 0) {
        frontMinX = Math.min(frontMinX, x);
        frontMaxX = Math.max(frontMaxX, x);
      }
    }

    const frontWidth = Math.max(20, frontMaxX - frontMinX + 1);
    const midX = (frontMinX + frontMaxX) * 0.5;

    const smoothed = new Float32Array(width);
    const win = Math.max(2, Math.round(width * 0.025));
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let k = Math.max(0, x - win); k <= Math.min(width - 1, x + win); k++) {
        sum += density[k];
        count++;
      }
      smoothed[x] = sum / count;
    }

    let peakLeftX = frontMinX, maxLeft = 0;
    for (let x = frontMinX; x < midX; x++) {
      if (smoothed[x] > maxLeft) { maxLeft = smoothed[x]; peakLeftX = x; }
    }

    let peakRightX = Math.round(midX), maxRight = 0;
    for (let x = Math.round(midX); x <= frontMaxX; x++) {
      if (smoothed[x] > maxRight) { maxRight = smoothed[x]; peakRightX = x; }
    }

    // Flat lens interiors have many equally tall columns. Their weighted centre
    // is the optical anchor; the first maximum is usually an outside rim.
    const lensCenter = (lo: number, hi: number, fallback: number) => {
      let mass = 0, sum = 0;
      for (let x = Math.ceil(lo); x <= Math.floor(hi); x++) {
        const w = smoothed[x] ** 2;
        mass += w; sum += x * w;
      }
      return mass ? Math.round(sum / mass) : fallback;
    };
    peakLeftX = lensCenter(frontMinX + frontWidth * 0.10, midX - frontWidth * 0.05, peakLeftX);
    peakRightX = lensCenter(midX + frontWidth * 0.05, frontMaxX - frontWidth * 0.10, peakRightX);

    let minValley = 999, bridgeX = Math.round((peakLeftX + peakRightX) * 0.5);
    for (let x = peakLeftX; x <= peakRightX; x++) {
      if (smoothed[x] < minValley) { minValley = smoothed[x]; bridgeX = x; }
    }
    bridgeX = (peakLeftX + peakRightX) / 2;

    const lensSpan = Math.max(20, peakRightX - peakLeftX);

    // Compute roll via mass centroid of left lens vs right lens (temple-arm immune)
    let leftMass = 0, leftYMass = 0;
    let rightMass = 0, rightYMass = 0;

    for (let y = 0; y < height; y++) {
      for (let x = frontMinX; x <= frontMaxX; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a > 25) {
          if (x >= frontMinX + frontWidth * 0.15 && x <= bridgeX - frontWidth * 0.05) {
            leftMass += a;
            leftYMass += y * a;
          } else if (x >= bridgeX + frontWidth * 0.05 && x <= frontMaxX - frontWidth * 0.15) {
            rightMass += a;
            rightYMass += y * a;
          }
        }
      }
    }

    const leftCentroidY = leftMass > 0 ? leftYMass / leftMass : colCenterY[peakLeftX];
    const rightCentroidY = rightMass > 0 ? rightYMass / rightMass : colCenterY[peakRightX];

    let roll = Math.atan2(rightCentroidY - leftCentroidY, lensSpan);
    // Ignore micro-tilt (< 1.8 degrees) to keep glasses clean and level
    if (Math.abs(roll) < 0.032) roll = 0;

    let lensTopY = height, lensBottomY = 0;
    const sampleCols = [peakLeftX, peakRightX, Math.round((peakLeftX + bridgeX) * 0.5), Math.round((peakRightX + bridgeX) * 0.5)];
    for (const x of sampleCols) {
      if (x >= 0 && x < width && colTopY[x] >= 0) {
        lensTopY = Math.min(lensTopY, colTopY[x]);
        lensBottomY = Math.max(lensBottomY, colBotY[x]);
      }
    }
    const lensHeight = Math.max(16, lensBottomY - lensTopY + 1);
    const opticalPupilY = lensTopY + lensHeight * 0.38;
    const bridgeY = (leftCentroidY + rightCentroidY) * 0.5;

    return {
      bridge: { x: bridgeX, y: bridgeY },
      opticalPupilY,
      frontWidth,
      lensSpan,
      roll,
    };
  }

  /**
   * Native Face & Eye Tracker
   */
  private trackFaceFeatures() {
    if (!this.cvCtx || !this.cvCanvas || !this.videoEl) return null;
    const precise = this.landmarks.track(this.videoEl);
    if (this.landmarks.available) return precise;
    return picoDetector.track(this.videoEl, this.cvCanvas, this.cvCtx);
  }

  /**
   * Converts a 2D fallback detection (Pico / native FaceDetector) into a flat,
   * roll-only pose so both trackers share one rendering path.
   */
  private poseFromResult(t: FaceTrackerResult, cw: number, ch: number): FacePose {
    if (t.pose) return t.pose;
    const c = Math.cos(t.rollRad), s = Math.sin(t.rollRad);
    return {
      origin: { x: t.centerX, y: t.bridgeY * ch / cw, z: 0 },
      xAxis: { x: c, y: s, z: 0 },
      yAxis: { x: -s, y: c, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      ipd: t.eyeSpan ?? t.width / 2.25,
    };
  }

  private filterPose(raw: FacePose, dt: number): FacePose {
    const f = this.poseFilters;
    const v = [
      raw.origin.x, raw.origin.y, raw.origin.z,
      raw.xAxis.x, raw.xAxis.y, raw.xAxis.z,
      raw.yAxis.x, raw.yAxis.y, raw.yAxis.z,
      raw.ipd,
    ].map((x, i) => f[i].filter(x, dt));
    const xAxis = vNorm({ x: v[3], y: v[4], z: v[5] });
    const yRaw = { x: v[6], y: v[7], z: v[8] };
    const k = vDot(yRaw, xAxis);
    const yAxis = vNorm({ x: yRaw.x - xAxis.x * k, y: yRaw.y - xAxis.y * k, z: yRaw.z - xAxis.z * k });
    return {
      origin: { x: v[0], y: v[1], z: v[2] },
      xAxis, yAxis, zAxis: vCross(xAxis, yAxis), ipd: v[9],
    };
  }

  private resetPose() {
    this.poseFilters.forEach(f => f.reset());
    this.pose = null;
    this.lastPoseTime = 0;
    this.hasFittedOnce = false;
  }

  /**
   * Projects the product cut-out onto the face as a slightly wrapped surface
   * sitting in front of the eyes. Lens centres land on the eye centres, the
   * frame foreshortens with yaw/pitch and gets mild perspective.
   */
  private buildMesh(pose: FacePose, cw: number, src: { width: number; height: number }) {
    const g = this.frameGeom;
    const texW = src.width, texH = src.height;
    const bridgeX = g ? g.bridge.x : texW * 0.5;
    const pupilY = g ? g.opticalPupilY : texH * 0.42;
    const lensSpan = g ? g.lensSpan : texW * 0.44;
    const photoRoll = g ? g.roll : 0;

    const ipdPx = pose.ipd * cw;
    const S = (ipdPx / lensSpan) * this.userScale;        // canvas px per texture px
    const halfW = (texW * S) / 2;
    const forward = ipdPx * 0.22;                           // lens plane sits ahead of the eyes
    const wrap = 0.1;                                       // frame-front curvature
    const focal = ipdPx * 9;                                // ~ webcam at arm's length
    const O = { x: pose.origin.x * cw, y: pose.origin.y * cw, z: pose.origin.z * cw };
    const { xAxis: X, yAxis: Y, zAxis: Z } = pose;
    const cr = Math.cos(-photoRoll), sr = Math.sin(-photoRoll);

    const out = this.meshPositions;
    let k = 0;
    for (let r = 0; r <= GRID_ROWS; r++) {
      for (let c = 0; c <= GRID_COLS; c++) {
        const tx = (c / GRID_COLS) * texW - bridgeX;
        const ty = (r / GRID_ROWS) * texH - pupilY;
        const lx = (tx * cr - ty * sr) * S;
        const ly = (tx * sr + ty * cr) * S;
        const nx = lx / halfW;
        const lz = -forward + wrap * halfW * nx * nx;
        const px = O.x + X.x * lx + Y.x * ly + Z.x * lz;
        const py = O.y + X.y * lx + Y.y * ly + Z.y * lz;
        const depth = X.z * lx + Y.z * ly + Z.z * lz;
        const persp = focal / (focal + depth);
        out[k++] = O.x + (px - O.x) * persp + this.userOffsetX;
        out[k++] = O.y + (py - O.y) * persp + this.userOffsetY;
        out[k++] = Math.max(-1, Math.min(1, depth / (halfW * 4)));
      }
    }
    return out;
  }

  /**
   * Estimates the light falling on the face (sampled from the cheeks) so a
   * brightly lit studio product photo is dimmed to match a typical webcam.
   */
  private updateShade(source: CanvasImageSource, srcW: number, srcH: number, pose: FacePose) {
    if (!this.sampleCtx) {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      this.sampleCtx = c.getContext('2d', { willReadFrequently: true });
    }
    const ctx = this.sampleCtx;
    if (!ctx) return;
    const ipd = pose.ipd * srcW;
    // The source is unmirrored; pose x is mirrored.
    const cx = (1 - pose.origin.x) * srcW;
    const cy = pose.origin.y * srcW + ipd * 0.7;
    const sw = ipd * 1.6, sh = ipd * 0.5;
    const sx = Math.max(0, cx - sw / 2), sy = Math.max(0, Math.min(srcH - sh, cy - sh / 2));
    try {
      ctx.drawImage(source, sx, sy, Math.min(sw, srcW - sx), sh, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const px = d.length / 4;
      r /= px * 255; g /= px * 255; b /= px * 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const gain = Math.max(0.6, Math.min(1.1, 0.35 + 0.65 * (lum / 0.55)));
      const m = Math.max(r, g, b, 1e-3);
      const tint: [number, number, number] = [r / m, g / m, b / m].map(t => 1 + (t - 1) * 0.08) as [number, number, number];
      const s = this.shade;
      s.gain += (gain - s.gain) * 0.15;
      s.tint = s.tint.map((t, i) => t + (tint[i] - t) * 0.15) as [number, number, number];
    } catch { /* tainted or not ready: keep previous estimate */ }
  }

  /**
   * Main animation loop: draws the camera frame the tracker analysed (so the
   * overlay never trails the face), then the glasses as a projected 3D surface
   * with a soft contact shadow and light matched to the room.
   */
  private startRenderLoop() {
    const render = () => {
      if (!this.isRunning) return;
      this.animFrameId = requestAnimationFrame(render);

      if (!this.ctx || !this.videoEl || !this.canvasEl) return;
      if (this.videoEl.readyState < 2) return;

      const cw = this.canvasEl.width;
      const ch = this.canvasEl.height;
      const ctx = this.ctx;

      const tracker = this.trackFaceFeatures();
      const synced = this.landmarks.available ? this.landmarks.frame : null;
      const source: CanvasImageSource = synced || this.videoEl;
      const srcW = synced ? synced.width : this.videoEl.videoWidth || cw;
      const srcH = synced ? synced.height : this.videoEl.videoHeight || ch;

      // 1. Mirrored camera frame
      ctx.save();
      ctx.setTransform(-1, 0, 0, 1, cw, 0);
      ctx.drawImage(source, 0, 0, cw, ch);
      ctx.restore();

      // 2. Pose update (only on new tracker output for the landmark engine)
      const badge = this.container?.querySelector('#lumen-face-badge');
      const now = performance.now();
      if (tracker && tracker.detected) {
        const fresh = !this.landmarks.available || this.landmarks.version !== this.lastTrackVersion;
        if (fresh) {
          this.lastTrackVersion = this.landmarks.version;
          const dt = this.lastPoseTime ? Math.max(1 / 120, Math.min(0.25, (now - this.lastPoseTime) / 1000)) : 1 / 30;
          this.lastPoseTime = now;
          this.pose = this.filterPose(this.poseFromResult(tracker, cw, ch), dt);
          this.hasFittedOnce = true;
        }
        this.lastFaceSeen = now;
        if (badge && badge.textContent !== 'Face Locked') {
          badge.textContent = 'Face Locked';
          (badge as HTMLElement).style.background = 'rgba(16, 185, 129, 0.25)';
          (badge as HTMLElement).style.color = '#34d399';
        }
      } else {
        if (now - this.lastFaceSeen > 500 && this.hasFittedOnce) this.resetPose();
        if (badge && badge.textContent !== 'Searching Face…') {
          badge.textContent = 'Searching Face…';
          (badge as HTMLElement).style.background = 'rgba(245, 158, 11, 0.20)';
          (badge as HTMLElement).style.color = '#f59e0b';
        }
      }

      // 3. Glasses
      const frameSource = this.cutoutCanvas;
      const pose = this.pose;
      if (!frameSource || !pose || !this.hasFittedOnce) return;

      if (this.frameCounter++ % 6 === 0) this.updateShade(source, srcW, srcH, pose);
      const mesh = this.buildMesh(pose, cw, frameSource);
      const ipdPx = pose.ipd * cw;
      // Mipmaps already pick the right resolution; a small extra LOD bias
      // softens the studio-sharp product photo to webcam softness.
      const blur = 0.5;

      if (this.renderer.render(cw, ch, mesh, this.shade, blur)) {
        const layer = this.renderer.canvas;
        // Soft contact shadow cast onto the nose and cheeks
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.filter = `brightness(0) blur(${Math.max(2, ipdPx * 0.05).toFixed(1)}px)`;
        ctx.drawImage(layer, 0, ipdPx * 0.06);
        ctx.restore();
        ctx.drawImage(layer, 0, 0);
      } else {
        // 2D fallback: affine fit of the projected corners
        const C = GRID_COLS + 1;
        const p0 = 0, p1 = GRID_COLS * 3, p2 = GRID_ROWS * C * 3;
        const w = frameSource.width, h = frameSource.height;
        ctx.save();
        ctx.setTransform(
          (mesh[p1] - mesh[p0]) / w, (mesh[p1 + 1] - mesh[p0 + 1]) / w,
          (mesh[p2] - mesh[p0]) / h, (mesh[p2 + 1] - mesh[p0 + 1]) / h,
          mesh[p0], mesh[p0 + 1],
        );
        ctx.imageSmoothingQuality = 'high';
        ctx.filter = `brightness(${this.shade.gain.toFixed(2)})`;
        ctx.drawImage(frameSource, 0, 0);
        ctx.restore();
      }
    };

    render();
  }

  /**
   * Adjusts the scale of the glasses frame
   */
  private adjustScale(delta: number) {
    this.userScale = Math.max(0.6, Math.min(1.6, this.userScale + delta));
    const valEl = this.container?.querySelector('#lumen-val-scale');
    if (valEl) valEl.textContent = `${Math.round(this.userScale * 100)}%`;
  }

  /**
   * Adjusts the vertical offset (height on nose bridge)
   */
  private adjustOffsetY(delta: number) {
    this.userOffsetY += delta;
  }

  /**
   * Resets calibration adjustments back to standard fit
   */
  private resetCalibration() {
    this.userScale = 1.0;
    this.userOffsetY = 0;
    this.userOffsetX = 0;
    this.hasFittedOnce = false;
    const valEl = this.container?.querySelector('#lumen-val-scale');
    if (valEl) valEl.textContent = '100%';
  }

  /**
   * Captures a high-resolution snapshot and initiates immediate download
   */
  private takeSnapshot() {
    if (!this.canvasEl || !this.container) return;

    const flash = this.container.querySelector<HTMLElement>('#lumen-mirror-flash');
    if (flash) {
      flash.classList.add('lumen-flashing');
      setTimeout(() => flash.classList.remove('lumen-flashing'), 220);
    }

    const dataUrl = this.canvasEl.toDataURL('image/png');
    const a = document.createElement('a');
    const frameName = (this.currentPayload?.title || 'sunglasses')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    a.download = `lumen-${frameName}-tryon.png`;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  public toggleMinimize() {
    if (this.isMinimized) {
      this.expand();
    } else {
      this.minimize();
    }
  }

  public minimize() {
    if (!this.container) return;
    this.isMinimized = true;
    this.container.classList.add('lumen-minimized');
  }

  public expand() {
    if (!this.container) return;
    this.isMinimized = false;
    this.container.classList.remove('lumen-minimized');
  }

  public show() {
    if (!this.container) return;
    this.container.classList.add('lumen-mirror-visible');
  }

  /**
   * Completely closes the mirror and cleanly stops the camera hardware
   */
  public close() {
    this.landmarks.close();
    this.frameRequest++;
    this.hasFittedOnce = false;
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.container) {
        this.container.remove();
        this.container = null;
        this.videoEl = null;
        this.canvasEl = null;
        this.ctx = null;
        this.cutoutCanvas = null;
        this.fallbackImage = null;
        this.cvCanvas = null;
        this.cvCtx = null;
        this.pose = null;
    }
  }
}

// Global Singleton Instance
export const inPageMirror = new InPageMirror();
