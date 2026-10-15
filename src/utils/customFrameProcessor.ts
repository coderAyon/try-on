import * as THREE from 'three';
import { SunglassesProduct } from '../types';
import { MODEL_TEMPLE_WIDTH } from './cadModelManager';

export interface EyewearGeometry {
  fullBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  lensBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  peakLeft: { x: number; y: number };
  peakRight: { x: number; y: number };
  bridge: { x: number; y: number };
  opticalPupilY: number;
  bridgeTopY: number;
  frontWidth: number;
  lensSpan: number;
  lensHeight?: number;
  roll: number;
}

export function canvasHasTransparentPixels(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const stride = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 120_000)));
  for (let y = 0; y < canvas.height; y += stride) {
    for (let x = 0; x < canvas.width; x += stride) {
      if (data[(y * canvas.width + x) * 4 + 3] < 240) return true;
    }
  }
  return false;
}

export function trimTransparentFrame(image: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read the sunglasses image canvas.');
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  let transparentPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 240) transparentPixels++;
      if (alpha > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY || transparentPixels === 0) {
    // Return original if no clear alpha boundary detected
    return canvas;
  }

  const padding = Math.max(4, Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.025));
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding + 1);
  const bottom = Math.min(height, maxY + padding + 1);

  const cropped = document.createElement('canvas');
  cropped.width = right - left;
  cropped.height = bottom - top;
  cropped.getContext('2d')!.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped;
}

export function straightenCustomEyewear(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const weight = pixels[(y * canvas.width + x) * 4 + 3] / 255;
      if (weight < 0.1) continue;
      n += weight;
      sx += x * weight;
      sy += y * weight;
      sxx += x * x * weight;
      syy += y * y * weight;
      sxy += x * y * weight;
    }
  }
  if (!n) return canvas;

  const cx = sx / n;
  const cy = sy / n;
  const angle = 0.5 * Math.atan2(2 * (sxy / n - cx * cy), (sxx / n - cx * cx) - (syy / n - cy * cy));
  if (Math.abs(angle) < 0.015) return canvas;

  const c = Math.abs(Math.cos(angle));
  const t = Math.abs(Math.sin(angle));
  const out = document.createElement('canvas');
  out.width = Math.ceil(canvas.width * c + canvas.height * t);
  out.height = Math.ceil(canvas.width * t + canvas.height * c);
  const outCtx = out.getContext('2d');
  if (!outCtx) return canvas;
  outCtx.translate(out.width / 2, out.height / 2);
  outCtx.rotate(-angle);
  outCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export function analyzeEyewearGeometry(canvas: HTMLCanvasElement): EyewearGeometry {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not analyze sunglasses image context.');
  const width = canvas.width;
  const height = canvas.height;
  const { data } = ctx.getImageData(0, 0, width, height);

  const density = new Float32Array(width);
  const colTopY = new Int32Array(width).fill(-1);
  const colBotY = new Int32Array(width).fill(-1);
  const colCenterY = new Float32Array(width);
  let maxD = 0;

  for (let x = 0; x < width; x++) {
    let topY = -1, botY = -1, count = 0;
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
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
      fullBounds: { left: 0, top: 0, right: width, bottom: height, width, height },
      lensBounds: { left: 0, top: 0, right: width, bottom: height, width, height },
      peakLeft: { x: width * 0.28, y: height * 0.5 },
      peakRight: { x: width * 0.72, y: height * 0.5 },
      bridge: { x: width * 0.5, y: height * 0.45 },
      opticalPupilY: height * 0.42,
      bridgeTopY: height * 0.2,
      frontWidth: width,
      lensSpan: width * 0.44,
      roll: 0,
    };
  }

  const smoothed = new Float32Array(width);
  const win = Math.max(2, Math.round(width * 0.025));
  for (let x = 0; x < width; x++) {
    let sum = 0, count = 0;
    for (let k = Math.max(0, x - win); k <= Math.min(width - 1, x + win); k++) {
      sum += density[k]; count++;
    }
    smoothed[x] = sum / count;
  }

  let frontMinX = width, frontMaxX = 0, frameTop = height, frameBottom = 0;
  for (let x = 0; x < width; x++) {
    if (density[x] > 0) { frontMinX = Math.min(frontMinX, x); frontMaxX = Math.max(frontMaxX, x); }
  }
  for (let y = 0; y < height; y++) {
    for (let x = frontMinX; x <= frontMaxX; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) { frameTop = Math.min(frameTop, y); frameBottom = Math.max(frameBottom, y); }
    }
  }

  const midX = (frontMinX + frontMaxX) * 0.5;

  let peakLeftX = frontMinX, maxLeft = 0;
  for (let x = frontMinX; x < midX; x++) {
    if (smoothed[x] > maxLeft) { maxLeft = smoothed[x]; peakLeftX = x; }
  }

  let peakRightX = Math.round(midX), maxRight = 0;
  for (let x = Math.round(midX); x <= frontMaxX; x++) {
    if (smoothed[x] > maxRight) { maxRight = smoothed[x]; peakRightX = x; }
  }

  let minValley = 999, bridgeX = Math.round((peakLeftX + peakRightX) * 0.5);
  for (let x = peakLeftX; x <= peakRightX; x++) {
    if (smoothed[x] < minValley) { minValley = smoothed[x]; bridgeX = x; }
  }

  const lensSpan = Math.max(20, peakRightX - peakLeftX);
  const frontWidth = Math.max(20, frontMaxX - frontMinX + 1);

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
  const bridgeY = (colCenterY[peakLeftX] + colCenterY[peakRightX]) * 0.5;
  const roll = Math.atan2(colCenterY[peakRightX] - colCenterY[peakLeftX], lensSpan);

  return {
    fullBounds: { left: 0, top: 0, right: width - 1, bottom: height - 1, width, height },
    lensBounds: { left: frontMinX, top: lensTopY, right: frontMaxX, bottom: lensBottomY, width: frontWidth, height: lensHeight },
    peakLeft: { x: peakLeftX, y: colCenterY[peakLeftX] },
    peakRight: { x: peakRightX, y: colCenterY[peakRightX] },
    bridge: { x: bridgeX, y: bridgeY },
    opticalPupilY,
    bridgeTopY: lensTopY,
    frontWidth,
    lensSpan,
    roll,
  };
}

/**
 * Loads an external or local image, normalizes CORS proxying, removes background if needed,
 * trims, straightens, and extracts eyewear geometry.
 */
export async function prepareSunglassesCutout(
  rawUrl: string,
  onProgress?: (message: string) => void
): Promise<{ canvas: HTMLCanvasElement; geom: EyewearGeometry }> {
  onProgress?.('Fetching sunglasses image…');
  let fetchUrl = rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) {
    // Route via server proxy to prevent CORS taint
    fetchUrl = `/api/photo/proxy?url=${encodeURIComponent(rawUrl)}`;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => {
      // If proxy failed and original is HTTPS, try direct
      if (fetchUrl !== rawUrl) {
        const directImg = new Image();
        directImg.crossOrigin = 'anonymous';
        directImg.onload = () => { img.src = directImg.src; resolve(); };
        directImg.onerror = () => reject(new Error('Could not load sunglasses image.'));
        directImg.src = rawUrl;
      } else {
        reject(new Error('Could not load sunglasses image.'));
      }
    };
    img.src = fetchUrl;
  });

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = img.naturalWidth || img.width;
  sourceCanvas.height = img.naturalHeight || img.height;
  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context.');
  ctx.drawImage(img, 0, 0);

  // Check if image already has transparent alpha channel
  if (canvasHasTransparentPixels(sourceCanvas)) {
    onProgress?.('Detecting frame alignment…');
    const trimmed = trimTransparentFrame(sourceCanvas);
    const straightened = straightenCustomEyewear(trimmed);
    const geom = analyzeEyewearGeometry(straightened);
    return { canvas: straightened, geom };
  }

  // Not transparent: Try background removal endpoint
  onProgress?.('Isolating sunglasses frame…');
  try {
    const dataUrl = sourceCanvas.toDataURL('image/png');
    const response = await fetch('/api/photo/normalize-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, useAI: true }),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) {
      const data = await response.json();
      if (typeof data.image === 'string' && data.image.startsWith('data:image/')) {
        const isolatedImg = new Image();
        isolatedImg.src = data.image;
        await isolatedImg.decode();
        const trimmed = trimTransparentFrame(isolatedImg);
        const straightened = straightenCustomEyewear(trimmed);
        const geom = analyzeEyewearGeometry(straightened);
        return { canvas: straightened, geom };
      }
    }
  } catch (err) {
    console.warn('AI segmentation fallback to edge trimming:', err);
  }

  // Fallback: local trim and geometry
  const trimmed = trimTransparentFrame(sourceCanvas);
  const straightened = straightenCustomEyewear(trimmed);
  const geom = analyzeEyewearGeometry(straightened);
  return { canvas: straightened, geom };
}

/**
 * Builds a realistic 3D curved Three.js eyewear rig from a 2D sunglasses cutout.
 * Features:
 * - Cylindrical face-wrap curvature (radius ~ 14 units)
 * - PBR MeshPhysicalMaterial with clearcoat gloss and optical reflection
 * - Procedural temple arms extending backward for realistic 3D occlusion
 * - Accurate optical center and nasal bridge alignment
 */
export async function createCustomCutoutEyewear3D(
  product: SunglassesProduct,
  onProgress?: (message: string) => void
): Promise<THREE.Group> {
  const imageUrl = product.customFrameCutoutUrl || product.customFrameUrl || product.thumbnailUrl;
  if (!imageUrl) {
    throw new Error('No custom frame image provided for virtual try-on.');
  }

  const { canvas, geom } = await prepareSunglassesCutout(imageUrl, onProgress);

  const group = new THREE.Group();
  group.name = `custom-eyewear-${product.id}`;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Frame dimensions normalized to standard eyewear scale
  const frameWidth = MODEL_TEMPLE_WIDTH; // 8.8 Three.js units
  const aspect = canvas.height / canvas.width;
  const frameHeight = frameWidth * aspect;

  // 1. Front Curved Frame Mesh
  // Subdivide horizontally to bend realistically around the user's face
  const segmentsX = 24;
  const segmentsY = 4;
  const frontGeometry = new THREE.PlaneGeometry(frameWidth, frameHeight, segmentsX, segmentsY);

  // Optical alignment: shift origin so (0,0) is at optical pupil line and nasal bridge
  const normCenterX = geom.bridge.x / canvas.width; // 0 to 1
  const normCenterY = geom.opticalPupilY / canvas.height; // 0 to 1
  const xOffset = -(normCenterX - 0.5) * frameWidth;
  const yOffset = (normCenterY - 0.5) * frameHeight;

  const positions = frontGeometry.attributes.position as THREE.BufferAttribute;
  const curveRadius = 14.0; // Subtle ergonomic facial wrap curvature

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    // Face-wrap cylindrical curvature: Z bends backwards away from nasal saddle
    const z = -(x * x) / (2 * curveRadius);
    positions.setXYZ(i, x + xOffset, y + yOffset, z);
  }
  frontGeometry.computeVertexNormals();

  const frameMaterial = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    roughness: 0.14,
    metalness: 0.10,
    clearcoat: 0.95,
    clearcoatRoughness: 0.03,
    reflectivity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  const frontMesh = new THREE.Mesh(frontGeometry, frameMaterial);
  frontMesh.name = 'custom-frame-front';
  group.add(frontMesh);

  // 2. Procedural Left & Right Temple Arms (Ear Stems)
  // These give authentic 3D depth and enable coronal occlusion behind ears/hair
  const templeArmLength = 6.2;
  const templeArmThickness = 0.12;
  const templeArmDepth = 0.22;
  const templeArmGeom = new THREE.BoxGeometry(templeArmThickness, templeArmDepth, templeArmLength);

  // Dark acetate / matte finish matching typical sunglass arms
  const armMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1c1917'),
    roughness: 0.25,
    metalness: 0.2,
    clearcoat: 0.6,
  });

  // Left Temple Arm
  const leftArm = new THREE.Mesh(templeArmGeom, armMaterial);
  leftArm.name = 'custom-frame-left-arm';
  leftArm.position.set(-frameWidth * 0.48 + xOffset, yOffset, -templeArmLength * 0.5 - 0.6);
  leftArm.rotation.y = 0.04;
  group.add(leftArm);

  // Right Temple Arm
  const rightArm = new THREE.Mesh(templeArmGeom, armMaterial);
  rightArm.name = 'custom-frame-right-arm';
  rightArm.position.set(frameWidth * 0.48 + xOffset, yOffset, -templeArmLength * 0.5 - 0.6);
  rightArm.rotation.y = -0.04;
  group.add(rightArm);

  // Store metadata for EyewearRig and calibration
  group.userData = {
    customEyewear: true,
    geom,
    frameWidth,
    frameHeight,
    aspect,
  };

  return group;
}
