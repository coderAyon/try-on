/**
 * In-Page Floating AR Mirror Widget for Lumen Anywhere
 * Local MediaPipe iris tracking aligns the product's lens centres to the eyes.
 * Native/Pico detection supplies an approximate fit while WASM initializes.
 * Product photos are 2D cutouts; front-facing photos give the best fit.
 */

import { picoDetector } from './picoDetector';
import { LandmarkTracker } from './landmarkTracker';

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

  // Smoothed tracking state (EMA filter for silky smooth, jitter-free AR)
  private smoothX: number = 0;
  private smoothY: number = 0;
  private smoothWidth: number = 0;
  private smoothHeight: number = 0;
  private smoothRoll: number = 0;
  private hasInitializedPose: boolean = false;
  private hasFittedOnce: boolean = false;

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

    // Centered webcam resting pose
    if (!this.hasInitializedPose) {
      this.smoothX = w * 0.5;
      this.smoothY = h * 0.40;
      this.smoothWidth = w * 0.42;
      this.smoothHeight = w * 0.18;
      this.smoothRoll = 0;
      this.hasInitializedPose = true;
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
      this.cutoutCanvas = this.removeBackground(img);
      this.fallbackImage = null;
      this.frameGeom = this.analyzeEyewearGeometry(this.cutoutCanvas);
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

    // Check if the image is already a transparent PNG (> 3% transparent pixels)
    let transparentCount = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 200) transparentCount++;
    }
    const isAlreadyIsolated = transparentCount > (width * height * 0.03);

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

      for (let i = 0; i < visited.length; i++) {
        if (visited[i]) {
          data[i * 4 + 3] = 0;
        }
      }
    }

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
   * Main animation loop: renders video frame mirrored + fits sunglasses onto eyes and nose bridge
   */
  private startRenderLoop() {
    const render = () => {
      if (!this.isRunning) return;
      this.animFrameId = requestAnimationFrame(render);

      if (!this.ctx || !this.videoEl || !this.canvasEl) return;
      if (this.videoEl.readyState < 2) return;

      const cw = this.canvasEl.width;
      const ch = this.canvasEl.height;

      // 1. Draw mirrored camera stream (true mirror reflection)
      this.ctx.save();
      this.ctx.translate(cw, 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.videoEl, 0, 0, cw, ch);
      this.ctx.restore();

      // 2. Real-Time Face & Eye Landmark Alignment via Dual Engine
      const tracker = this.trackFaceFeatures();
      const badge = this.container?.querySelector('#lumen-face-badge');

      if (tracker && tracker.detected) {
        this.lastFaceSeen = performance.now();
        if (badge && badge.textContent !== 'Face Locked') {
          badge.textContent = 'Face Locked';
          (badge as HTMLElement).style.background = 'rgba(16, 185, 129, 0.25)';
          (badge as HTMLElement).style.color = '#34d399';
        }

        const targetX = cw * tracker.centerX + this.userOffsetX;
        const targetY = ch * tracker.bridgeY + this.userOffsetY;
        const targetWidth = tracker.eyeSpan && this.frameGeom
          ? cw * tracker.eyeSpan * ((this.cutoutCanvas?.width || 1) / this.frameGeom.lensSpan) * this.userScale
          : cw * tracker.width * this.userScale;
        const targetRoll = tracker.rollRad;

        // 3. Smooth temporal interpolation: immediate snap on first face acquisition, then silky EMA tracking
        if (!this.hasFittedOnce) {
          this.smoothX = targetX;
          this.smoothY = targetY;
          this.smoothWidth = targetWidth;
          this.smoothRoll = targetRoll;
          this.hasFittedOnce = true;
        } else {
          const dist = Math.hypot(targetX - this.smoothX, targetY - this.smoothY);
          const lerpFactor = dist > 40 ? 0.65 : 0.45;
          this.smoothX += (targetX - this.smoothX) * lerpFactor;
          this.smoothY += (targetY - this.smoothY) * lerpFactor;
          this.smoothWidth += (targetWidth - this.smoothWidth) * lerpFactor;
          this.smoothRoll += (targetRoll - this.smoothRoll) * lerpFactor;
        }
      } else {
        if (performance.now() - this.lastFaceSeen > 350) this.hasFittedOnce = false;
        if (badge && badge.textContent !== 'Searching Face…') {
          badge.textContent = 'Searching Face…';
          (badge as HTMLElement).style.background = 'rgba(245, 158, 11, 0.20)';
          (badge as HTMLElement).style.color = '#f59e0b';
        }
      }

      // 4. Render Sunglasses Frame onto Face
      const frameSource = this.cutoutCanvas || this.fallbackImage;
      if (frameSource && this.hasFittedOnce) {
        const aspect = (frameSource.height || 180) / (frameSource.width || 400);
        this.smoothHeight = this.smoothWidth * aspect;

        this.ctx.save();
        this.ctx.translate(this.smoothX, this.smoothY);
        this.ctx.rotate(this.smoothRoll - (this.frameGeom ? this.frameGeom.roll : 0));

        // Realistic depth shadow under the frame on the nasal saddle and cheeks
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
        this.ctx.shadowBlur = 14;
        this.ctx.shadowOffsetY = 4;

        // Optical landmark alignment matching local project calculation (customFrameProcessor.ts):
        // Bridge center aligns with user's nasal saddle, optical pupil line aligns with user's eye level
        const srcW = frameSource.width || 400;
        const srcH = frameSource.height || 180;
        const normBridgeX = this.frameGeom ? this.frameGeom.bridge.x / srcW : 0.50;
        const normPupilY = this.frameGeom ? this.frameGeom.opticalPupilY / srcH : 0.42;

        const drawX = -normBridgeX * this.smoothWidth;
        const drawY = -normPupilY * this.smoothHeight;

        this.ctx.drawImage(
          frameSource,
          drawX,
          drawY,
          this.smoothWidth,
          this.smoothHeight
        );


        this.ctx.restore();
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
        this.hasInitializedPose = false;
    }
  }
}

// Global Singleton Instance
export const inPageMirror = new InPageMirror();
