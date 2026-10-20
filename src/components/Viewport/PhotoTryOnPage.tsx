import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createFaceDetector } from '../../utils/faceDetector';
import { detectPhotoFaces } from '../../utils/photoFaceDetection';
import { loadEyewearCADModel } from '../../utils/cadModelManager';
import { EyewearRig, eyewearPose, landmarkWorld, faceSkullPose, faceOcclusionPoint } from '../../utils/landmarkEyewear';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';
import { SunglassesProduct } from '../../types';
import { ProductThumbnail } from '../Catalog/ProductThumbnail';
import { ArrowLeft, Upload, Download, X, ImagePlus, Glasses, Sparkles, CheckCircle2, AlertTriangle, User, Globe, ScanFace, Maximize2, Sliders, RotateCcw } from 'lucide-react';

interface PhotoTryOnPageProps {
  products: SunglassesProduct[];
  product: SunglassesProduct;
  onSelect: (p: SunglassesProduct) => void;
  onBack: () => void;
}

type FaceVerificationStatus = 'idle' | 'checking' | 'detected' | 'no_face' | 'multiple_faces';

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  grad.addColorStop(0, 'rgba(20, 15, 12, 0.40)');
  grad.addColorStop(0.35, 'rgba(30, 22, 18, 0.22)');
  grad.addColorStop(0.7, 'rgba(45, 30, 24, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFrameProcessingCanvas(image: HTMLImageElement): HTMLCanvasElement {
  // Keep the hosted segmentation request bounded while retaining source detail.
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw Error('Could not read the sunglasses image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasHasTransparentPixels(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw Error('Could not inspect the sunglasses image.');
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const stride = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 120_000)));
  for (let y = 0; y < canvas.height; y += stride) for (let x = 0; x < canvas.width; x += stride) {
    if (data[(y * canvas.width + x) * 4 + 3] < 245) return true;
  }
  return false;
}

function trimTransparentFrame(image: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw Error('Could not read the isolated sunglasses image.');
  ctx.drawImage(image, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const { data } = imgData;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let transparentPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * 4 + 3];
    if (alpha < 245) transparentPixels++;
    if (alpha > 20) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }

  // If the image does not have transparent cutouts yet, isolate it client-side
  if (maxX < minX || maxY < minY || transparentPixels < (width * height * 0.03)) {
    const seedOffsets = [
      0,
      Math.min(width - 1, 6) * 4,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + width - 1) * 4,
      (Math.floor(height / 2) * width) * 4,
      (Math.floor(height / 2) * width + width - 1) * 4,
      Math.floor(width / 2) * 4,
      ((height - 1) * width + Math.floor(width / 2)) * 4
    ];

    const bgSeeds = seedOffsets.map(off => ({
      r: data[off],
      g: data[off + 1],
      b: data[off + 2]
    }));

    const isBg = (idx: number) => {
      const pr = data[idx];
      const pg = data[idx + 1];
      const pb = data[idx + 2];
      for (const s of bgSeeds) {
        const dSq = (pr - s.r) ** 2 + (pg - s.g) ** 2 + (pb - s.b) ** 2;
        if (dSq < 3000) return true; // ~55 color distance
      }
      return false;
    };

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let qHead = 0, qTail = 0;

    for (let x = 0; x < width; x++) {
      if (isBg(x * 4)) { visited[x] = 1; queue[qTail++] = x; }
      const bot = (height - 1) * width + x;
      if (isBg(bot * 4)) { visited[bot] = 1; queue[qTail++] = bot; }
    }
    for (let y = 0; y < height; y++) {
      const left = y * width;
      if (!visited[left] && isBg(left * 4)) { visited[left] = 1; queue[qTail++] = left; }
      const right = y * width + width - 1;
      if (!visited[right] && isBg(right * 4)) { visited[right] = 1; queue[qTail++] = right; }
    }

    while (qHead < qTail) {
      const pos = queue[qHead++];
      const px = pos % width;
      const py = (pos / width) | 0;

      if (px > 0) {
        const n = pos - 1;
        if (!visited[n] && isBg(n * 4)) { visited[n] = 1; queue[qTail++] = n; }
      }
      if (px < width - 1) {
        const n = pos + 1;
        if (!visited[n] && isBg(n * 4)) { visited[n] = 1; queue[qTail++] = n; }
      }
      if (py > 0) {
        const n = pos - width;
        if (!visited[n] && isBg(n * 4)) { visited[n] = 1; queue[qTail++] = n; }
      }
      if (py < height - 1) {
        const n = pos + width;
        if (!visited[n] && isBg(n * 4)) { visited[n] = 1; queue[qTail++] = n; }
      }
    }

    minX = width; minY = height; maxX = -1; maxY = -1;
    for (let i = 0; i < visited.length; i++) {
      if (visited[i]) {
        data[i * 4 + 3] = 0;
      } else if (data[i * 4 + 3] > 20) {
        const x = i % width;
        const y = (i / width) | 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Safe fallback bounds if segmentation was too strict
  if (maxX <= minX || maxY <= minY) {
    minX = Math.max(0, Math.floor(width * 0.05));
    maxX = Math.min(width - 1, Math.ceil(width * 0.95));
    minY = Math.max(0, Math.floor(height * 0.15));
    maxY = Math.min(height - 1, Math.ceil(height * 0.85));
  }

  const padding = Math.max(2, Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.02));
  const left = Math.max(0, minX - padding), top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding + 1), bottom = Math.min(height, maxY + padding + 1);
  const cropped = document.createElement('canvas');
  cropped.width = Math.max(16, right - left);
  cropped.height = Math.max(16, bottom - top);
  cropped.getContext('2d')!.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return cropped;
}

interface EyewearGeometry {
  fullBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  lensBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  peakLeft: { x: number; y: number };
  peakRight: { x: number; y: number };
  bridge: { x: number; y: number };
  opticalPupilY: number;
  bridgeTopY: number;
  frontWidth: number;
  lensSpan: number;
  lensHeight: number;
  roll: number;
}

function analyzeEyewearGeometry(canvas: HTMLCanvasElement): EyewearGeometry {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw Error('Could not analyze sunglasses image.');
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const { data } = imgData;

  // 1. Analyze row density to distinguish the dense front frame from thin upward temple arms
  const rowDensity = new Int32Array(height);
  let maxRowDensity = 0;
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) count++;
    }
    rowDensity[y] = count;
    if (count > maxRowDensity) maxRowDensity = count;
  }

  // Front frame band: both lenses and bridge form a wide, dense structure (>28% of maxRowDensity)
  const frontThreshold = Math.max(12, maxRowDensity * 0.28);
  let frontTopY = 0;
  for (let y = 0; y < height; y++) {
    if (rowDensity[y] >= frontThreshold) {
      frontTopY = Math.max(0, y - 2);
      break;
    }
  }

  let frontBotY = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    if (rowDensity[y] >= frontThreshold) {
      frontBotY = Math.min(height - 1, y + 2);
      break;
    }
  }

  // If thin temple arms arch upward above the front frame (common in table/desk product photos),
  // mask them out so they do not float awkwardly on the user's forehead/eyebrows in front-facing try-on.
  if (frontTopY > 4) {
    for (let y = 0; y < frontTopY; y++) {
      for (let x = 0; x < width; x++) {
        data[(y * width + x) * 4 + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 2. Measure vertical column density and centers within the front frame band
  const density = new Float32Array(width);
  const colTopY = new Int32Array(width).fill(-1);
  const colBotY = new Int32Array(width).fill(-1);
  const colCenterY = new Float32Array(width);
  let maxD = 0;

  for (let x = 0; x < width; x++) {
    let topY = -1, botY = -1, count = 0;
    for (let y = frontTopY; y <= frontBotY; y++) {
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

  if (maxD < 4) throw Error('No visible sunglasses found in this image.');

  // Smooth density
  const smoothed = new Float32Array(width);
  const win = Math.max(2, Math.round(width * 0.025));
  for (let x = 0; x < width; x++) {
    let sum = 0, count = 0;
    for (let k = Math.max(0, x - win); k <= Math.min(width - 1, x + win); k++) {
      sum += density[k]; count++;
    }
    smoothed[x] = sum / count;
  }

  let frontMinX = width, frontMaxX = 0;
  for (let x = 0; x < width; x++) {
    if (density[x] > 4) {
      frontMinX = Math.min(frontMinX, x);
      frontMaxX = Math.max(frontMaxX, x);
    }
  }
  if (frontMaxX <= frontMinX) {
    frontMinX = 0;
    frontMaxX = width - 1;
  }

  const midX = (frontMinX + frontMaxX) * 0.5;
  const innerMargin = Math.round((frontMaxX - frontMinX) * 0.06);

  // Left lens peak (tallest dense column in left half)
  let peakLeftX = Math.round(frontMinX + (midX - frontMinX) * 0.5), maxLeft = 0;
  for (let x = frontMinX + innerMargin; x < midX - 8; x++) {
    if (smoothed[x] > maxLeft) {
      maxLeft = smoothed[x];
      peakLeftX = x;
    }
  }

  // Right lens peak (tallest dense column in right half)
  let peakRightX = Math.round(midX + (frontMaxX - midX) * 0.5), maxRight = 0;
  for (let x = Math.round(midX + 8); x <= frontMaxX - innerMargin; x++) {
    if (smoothed[x] > maxRight) {
      maxRight = smoothed[x];
      peakRightX = x;
    }
  }

  // Minimum valley bridge between peaks
  let minValley = 9999, bridgeX = Math.round((peakLeftX + peakRightX) * 0.5);
  for (let x = peakLeftX; x <= peakRightX; x++) {
    if (smoothed[x] < minValley) {
      minValley = smoothed[x];
      bridgeX = x;
    }
  }

  const lensSpan = Math.max(20, peakRightX - peakLeftX);
  const frontWidth = frontMaxX - frontMinX + 1;
  const lensHeight = Math.max(16, frontBotY - frontTopY + 1);
  // Optical pupil line: eye pupils sit in the upper-middle portion of the front frame,
  // approximately ~62% down from the bottom of the front frame (or ~38% down from top rim).
  // Placing opticalPupilY at frontTopY + lensHeight * 0.62 lifts the top rim naturally to the eyebrow line.
  const opticalPupilY = frontTopY + lensHeight * 0.62;
  const bridgeY = (colCenterY[peakLeftX] + colCenterY[peakRightX]) * 0.5;
  const roll = Math.atan2(colCenterY[peakRightX] - colCenterY[peakLeftX], lensSpan);

  return {
    fullBounds: { left: 0, top: 0, right: width - 1, bottom: height - 1, width, height },
    lensBounds: { left: frontMinX, top: frontTopY, right: frontMaxX, bottom: frontBotY, width: frontWidth, height: lensHeight },
    peakLeft: { x: peakLeftX, y: colCenterY[peakLeftX] },
    peakRight: { x: peakRightX, y: colCenterY[peakRightX] },
    bridge: { x: bridgeX, y: bridgeY },
    opticalPupilY,
    bridgeTopY: frontTopY,
    frontWidth,
    lensSpan,
    lensHeight,
    roll,
  };
}

function straightenCustomEyewear(canvas: HTMLCanvasElement): HTMLCanvasElement {
  // Find the main axis of the visible frame before measuring the two lenses.
  const pixels = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < canvas.height; y += 2) for (let x = 0; x < canvas.width; x += 2) {
    const weight = pixels[(y * canvas.width + x) * 4 + 3] / 255;
    if (weight < 0.1) continue;
    n += weight; sx += x * weight; sy += y * weight;
    sxx += x * x * weight; syy += y * y * weight; sxy += x * y * weight;
  }
  if (!n) return canvas;
  const cx = sx / n, cy = sy / n;
  const angle = 0.5 * Math.atan2(2 * (sxy / n - cx * cy), (sxx / n - cx * cx) - (syy / n - cy * cy));
  if (Math.abs(angle) < 0.015) return canvas;
  const c = Math.abs(Math.cos(angle)), t = Math.abs(Math.sin(angle));
  const out = document.createElement('canvas');
  out.width = Math.ceil(canvas.width * c + canvas.height * t);
  out.height = Math.ceil(canvas.width * t + canvas.height * c);
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(-angle);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

async function processCustomFrameWithHostedAI(
  image: HTMLImageElement,
  onProgress: (message: string) => void = () => undefined,
): Promise<HTMLCanvasElement> {
  const source = createFrameProcessingCanvas(image);

  // Transparent product PNGs already contain a useful mask. Keep every
  // original pixel and avoid running segmentation over a good cutout.
  if (canvasHasTransparentPixels(source)) {
    return straightenCustomEyewear(trimTransparentFrame(source));
  }

  onProgress('Preparing sunglasses for AI processing…');
  const input = await new Promise<Blob>((resolve, reject) => {
    source.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not prepare the sunglasses image.')), 'image/png');
  });
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('Could not encode the sunglasses image.'));
      reader.onerror = () => reject(Error('Could not read the sunglasses image.'));
      reader.readAsDataURL(input);
    });
    onProgress('Removing background with Hugging Face ZeroGPU AI (Bria RMBG 2.0)…');
    const response = await fetch('/api/photo/normalize-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, useAI: true }),
      signal: AbortSignal.timeout(35_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && typeof payload.image === 'string' && payload.image.startsWith('data:image/png;base64,')) {
      const isolated = new Image();
      isolated.src = payload.image;
      await isolated.decode();
      onProgress('Finishing transparent frame cutout…');
      return straightenCustomEyewear(trimTransparentFrame(isolated));
    }
    console.warn('Backend normalize-frame did not return isolated image, using local processor:', payload);
    onProgress('Finishing with local smart segmentation…');
    return straightenCustomEyewear(trimTransparentFrame(source));
  } catch (error) {
    console.warn('Server AI normalization failed or timed out, falling back to local segmentation:', error);
    onProgress('Finishing with local smart segmentation…');
    return straightenCustomEyewear(trimTransparentFrame(source));
  }
}

function customFrameNeedsAngleCorrection(canvas: HTMLCanvasElement): boolean {
  try {
    const geom = analyzeEyewearGeometry(canvas);
    return Math.abs(geom.roll) > 0.025;
  } catch {
    return false;
  }
}

function createPhotoCrops(composite: HTMLCanvasElement, original: HTMLCanvasElement, points: { x: number; y: number }[], width: number, height: number) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (let i = 0; i < 468; i++) {
    minX = Math.min(minX, points[i].x); maxX = Math.max(maxX, points[i].x);
    minY = Math.min(minY, points[i].y); maxY = Math.max(maxY, points[i].y);
  }
  const faceCenterX = ((minX + maxX) / 2) * width;
  const faceCenterY = ((minY + maxY) / 2) * height;
  const facePixWidth = (maxX - minX) * width;
  const facePixHeight = (maxY - minY) * height;
  const cropSide = Math.round(Math.max(facePixWidth * 2.15, facePixHeight * 1.85));
  const cropX = Math.round(Math.max(0, Math.min(width - cropSide, faceCenterX - cropSide / 2)));
  const cropY = Math.round(Math.max(0, Math.min(height - cropSide, faceCenterY - cropSide * 0.40)));
  const cropWidth = Math.min(cropSide, width - cropX);
  const cropHeight = Math.min(cropSide, height - cropY);
  const size = Math.min(1440, Math.round(Math.max(cropWidth, cropHeight)));
  const fitted = document.createElement('canvas'); fitted.width = size; fitted.height = size;
  const originalCrop = document.createElement('canvas'); originalCrop.width = size; originalCrop.height = size;
  for (const [source, target] of [[composite, fitted], [original, originalCrop]] as const) {
    const ctx = target.getContext('2d')!;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, size, size);
  }
  return { fitted: fitted.toDataURL('image/png'), original: originalCrop.toDataURL('image/png') };
}

interface FitAdjustments {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
}

let sharedCustomRenderer: THREE.WebGLRenderer | null = null;
function getSharedCustomRenderer(width: number, height: number): THREE.WebGLRenderer {
  if (!sharedCustomRenderer) {
    const canvas = document.createElement('canvas');
    sharedCustomRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    sharedCustomRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  sharedCustomRenderer.setSize(width, height, false);
  sharedCustomRenderer.setClearColor(0x000000, 0);
  return sharedCustomRenderer;
}

function createCustomEyewearGeometry(
  frameCanvas: HTMLCanvasElement,
  geom: ReturnType<typeof analyzeEyewearGeometry>,
  scale: number,
  wrapCurvature = true
): THREE.BufferGeometry {
  const segmentsX = 36;
  const segmentsY = 2;
  const width = frameCanvas.width * scale;
  const sourceCenterX = (geom.peakLeft.x + geom.peakRight.x) * 0.5;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 6-base optical wrap curvature: outer rims bend backwards naturally towards the ears
  const wrapRadius = width * 1.55;

  for (let iy = 0; iy <= segmentsY; iy++) {
    const v = iy / segmentsY;
    const py = v * frameCanvas.height;
    const y = (geom.opticalPupilY - py) * scale;

    for (let ix = 0; ix <= segmentsX; ix++) {
      const u = ix / segmentsX;
      const px = u * frameCanvas.width;
      const x = (px - sourceCenterX) * scale;

      const z = wrapCurvature ? -Math.pow(x, 2) / (2 * wrapRadius) : 0;

      positions.push(x, y, z);
      uvs.push(u, 1 - v);
    }
  }

  for (let iy = 0; iy < segmentsY; iy++) {
    for (let ix = 0; ix < segmentsX; ix++) {
      const a = iy * (segmentsX + 1) + ix;
      const b = (iy + 1) * (segmentsX + 1) + ix;
      const c = (iy + 1) * (segmentsX + 1) + (ix + 1);
      const d = iy * (segmentsX + 1) + (ix + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function applyOpticalGlassEnhancement(
  sourceCanvas: HTMLCanvasElement,
  geom: ReturnType<typeof analyzeEyewearGeometry>
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imgData;

  const rx = geom.lensSpan * 0.36;
  const ry = (geom.lensHeight || geom.lensBounds.height) * 0.38;

  // Soften the interior of the lenses so wearer's real eyes show through the glass
  for (const center of [geom.peakLeft, geom.peakRight]) {
    const minPx = Math.max(0, Math.floor(center.x - rx));
    const maxPx = Math.min(canvas.width - 1, Math.ceil(center.x + rx));
    const minPy = Math.max(0, Math.floor(center.y - ry));
    const maxPy = Math.min(canvas.height - 1, Math.ceil(center.y + ry));

    for (let py = minPy; py <= maxPy; py++) {
      for (let px = minPx; px <= maxPx; px++) {
        const dx = (px - center.x) / rx;
        const dy = (py - center.y) / ry;
        const distSq = dx * dx + dy * dy;

        // Inside the optical lens zone (exclude outer 22% to preserve solid rim)
        if (distSq < 0.78) {
          const idx = (py * canvas.width + px) * 4;
          const currentA = data[idx + 3];
          if (currentA > 50) {
            const falloff = Math.max(0, 1 - distSq / 0.78);
            const targetA = Math.round(currentA * (0.76 + 0.16 * (1 - falloff)));
            data[idx + 3] = Math.min(currentA, targetA);
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Add realistic curved glass specular reflection arc across the upper lens diagonal
  ctx.save();
  for (const center of [geom.peakLeft, geom.peakRight]) {
    const grad = ctx.createLinearGradient(
      center.x - rx * 0.6, center.y - ry * 0.8,
      center.x + rx * 0.4, center.y + ry * 0.4
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(center.x - rx * 0.15, center.y - ry * 0.20, rx * 0.65, ry * 0.60, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return canvas;
}

function compositeCustomFrame(
  input: HTMLCanvasElement,
  frame: HTMLImageElement,
  points: { x: number; y: number; z?: number }[],
  width: number,
  height: number,
  adjustments?: FitAdjustments
) {
  // Always clean background, cavities, and reflections from the frame
  const rawFrame = straightenCustomEyewear(trimTransparentFrame(frame));
  const geom = analyzeEyewearGeometry(rawFrame);
  const frameCanvas = applyOpticalGlassEnhancement(rawFrame, geom);

  // Prefer actual iris centers (MediaPipe's refined 478-point face mesh).
  // Fall back to eye-contour centers for models returning only 468 points.
  const landmarkCenter = (indices: number[], fallback: number[]) => {
    const selected = indices.every(index => points[index]) ? indices : fallback;
    return {
      x: selected.reduce((sum, index) => sum + points[index].x, 0) / selected.length * width,
      y: selected.reduce((sum, index) => sum + points[index].y, 0) / selected.length * height,
    };
  };
  const pupilRight = landmarkCenter([468, 469, 470, 471, 472], [33, 133, 159, 145]);
  const pupilLeft = landmarkCenter([473, 474, 475, 476, 477], [263, 362, 386, 374]);

  const eyeSpan = Math.hypot(pupilLeft.x - pupilRight.x, pupilLeft.y - pupilRight.y);
  if (eyeSpan < 8) throw Error('Could not measure eye positions on this face.');

  const pupilCenter = {
    x: (pupilRight.x + pupilLeft.x) * 0.5,
    y: (pupilRight.y + pupilLeft.y) * 0.5,
  };

  // Nasal saddle (radix, landmark 168)
  const noseRadix = { x: points[168].x * width, y: points[168].y * height };

  // Temporal face width (landmarks 234 to 454)
  const faceWidth = Math.hypot((points[454].x - points[234].x) * width, (points[454].y - points[234].y) * height);

  // User adjustments
  const userScale = adjustments?.scale ?? 1;
  const userOffsetX = adjustments?.offsetX ?? 0;
  const userOffsetY = adjustments?.offsetY ?? 0;
  const userRotate = ((adjustments?.rotate ?? 0) * Math.PI) / 180;

  // 2. Optical scale calculation:
  // Sunglasses frame front spans across the temporal face (typical ratio ~2.40x IPD or ~1.04x faceWidth)
  const targetFrontWidth = Math.max(faceWidth * 1.04, eyeSpan * 2.42);
  const targetLensSpan = eyeSpan * 1.08;
  const scaleFromFront = targetFrontWidth / Math.max(20, geom.frontWidth);
  const scaleFromSpan = targetLensSpan / Math.max(16, geom.lensSpan);
  const baseScale = geom.lensSpan > 20 ? (scaleFromFront * 0.65 + scaleFromSpan * 0.35) : scaleFromFront;
  const scale = baseScale * userScale;

  const sourceCenterX = (geom.peakLeft.x + geom.peakRight.x) * 0.5;

  // 3. True 3D Pose Fitting using Three.js & MediaPipe 3D Landmark Mesh
  const safeLandmarks = points.map(p => ({
    x: p.x,
    y: p.y,
    z: typeof p.z === 'number' && Number.isFinite(p.z) ? p.z : 0,
  }));

  let rendered3D = false;
  const composite = document.createElement('canvas');
  composite.width = width;
  composite.height = height;
  const ctx = composite.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(input, 0, 0);

  try {
    const pose = eyewearPose(safeLandmarks, width, height);
    if (pose) {
      const renderer = getSharedCustomRenderer(width, height);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 4500);
      camera.position.z = 1000;
      camera.lookAt(0, 0, 0);

      // 3D Cranium / Head occluder: hides far frame/temple arm on turned poses
      const skullPose = faceSkullPose(pose);
      const skullGeometry = new THREE.SphereGeometry(1, 24, 18);
      const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
      const skull = new THREE.Mesh(skullGeometry, depthMaterial);
      skull.position.copy(skullPose.position);
      skull.quaternion.copy(skullPose.quaternion);
      skull.scale.copy(skullPose.scale);
      skull.renderOrder = -10;
      scene.add(skull);

      // Soft ambient contact shadow on the nose bridge & radix
      const shadowTexture = createContactShadowTexture();
      const shadowGeo = new THREE.PlaneGeometry(pose.eyeSpan * 0.48, pose.eyeSpan * 0.26);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.copy(pose.bridge);
      shadowMesh.position.addScaledVector(pose.yAxis, -pose.eyeSpan * 0.035);
      shadowMesh.position.addScaledVector(pose.zAxis, -pose.eyeSpan * 0.015);
      shadowMesh.quaternion.copy(pose.quaternion);
      shadowMesh.renderOrder = -5;
      scene.add(shadowMesh);

      // 3D Curved Eyewear Mesh with realistic face wrap curvature
      const geometry = createCustomEyewearGeometry(frameCanvas, geom, scale, true);
      const texture = new THREE.CanvasTexture(frameCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.01,
        depthWrite: true,
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Pre-level inherent product tilt plus user rotation
      const localRoll = -geom.roll + userRotate;
      if (Math.abs(localRoll) > 0.0001) {
        mesh.rotateZ(localRoll);
      }

      const root = new THREE.Group();
      root.add(mesh);

      // Anatomical anchor: rests firmly on nasal saddle (landmark 168) on the midline
      const bridgeOnMidline = pose.bridge.clone();
      const pupilDiff = pose.position.clone().sub(bridgeOnMidline).dot(pose.yAxis);
      // Aligns optical center with pupils, resting bridge on nose saddle
      const anchor = bridgeOnMidline.clone().addScaledVector(pose.yAxis, pupilDiff * 0.60);
      // Rest slightly forward along face normal
      anchor.addScaledVector(pose.zAxis, pose.eyeSpan * 0.035);

      // User live adjustments along head-local axes
      anchor.addScaledVector(pose.xAxis, userOffsetX);
      anchor.addScaledVector(pose.yAxis, -userOffsetY);

      root.position.copy(anchor);
      root.quaternion.copy(pose.quaternion);
      scene.add(root);

      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0);

      // Dispose per-frame Three.js geometry/materials
      geometry.dispose();
      material.dispose();
      texture.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTexture.dispose();
      skullGeometry.dispose();
      depthMaterial.dispose();

      rendered3D = true;
    }
  } catch (threeErr) {
    console.warn('3D custom frame fitting fallback to 2D projection:', threeErr);
  }

  if (rendered3D) {
    return composite;
  }

  // 4. Fallback: 3D-Aware 2D Perspective Projection
  const eyeAxisX = (pupilLeft.x - pupilRight.x) / eyeSpan;
  const eyeAxisY = (pupilLeft.y - pupilRight.y) / eyeSpan;
  const dRight = Math.abs((noseRadix.x - pupilRight.x) * eyeAxisX + (noseRadix.y - pupilRight.y) * eyeAxisY);
  const dLeft = Math.abs((pupilLeft.x - noseRadix.x) * eyeAxisX + (pupilLeft.y - noseRadix.y) * eyeAxisY);
  const yawRatio = (dRight + dLeft) > 0 ? (dRight - dLeft) / (dRight + dLeft) : 0;
  const yawAngle = Math.asin(Math.max(-0.6, Math.min(0.6, yawRatio * 1.5)));

  const faceRoll = Math.atan2(pupilLeft.y - pupilRight.y, pupilLeft.x - pupilRight.x);
  const totalRotation = faceRoll - geom.roll + userRotate;

  const scaleX = scale * Math.max(0.40, Math.cos(yawAngle));
  const scaleY = scale;
  const shearY = Math.sin(yawAngle) * 0.16;

  // 3D nasal midline lock
  const anchorX = (noseRadix.x * 0.85 + pupilCenter.x * 0.15) + userOffsetX;
  const anchorY = pupilCenter.y * 0.90 + noseRadix.y * 0.10 + userOffsetY;

  const cosine = Math.cos(totalRotation), sine = Math.sin(totalRotation);

  ctx.save();
  const a = scaleX * cosine;
  const b = scaleX * sine + shearY * cosine;
  const c = -scaleY * sine;
  const d = scaleY * cosine;
  const e = anchorX - a * sourceCenterX - c * geom.opticalPupilY;
  const f = anchorY - b * sourceCenterX - d * geom.opticalPupilY;
  ctx.transform(a, b, c, d, e, f);

  ctx.shadowColor = 'rgba(10, 6, 18, 0.30)';
  ctx.shadowBlur = Math.max(4, Math.min(12, eyeSpan * 0.05));
  ctx.shadowOffsetY = Math.max(2, Math.min(5, eyeSpan * 0.025));

  ctx.drawImage(frameCanvas, 0, 0);
  ctx.restore();
  return composite;
}

export function PhotoTryOnPage({ products, product, onSelect, onBack }: PhotoTryOnPageProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [faceCropResult, setFaceCropResult] = useState<string | null>(null);
  const [faceCropOriginal, setFaceCropOriginal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'face'>('full');
  const [filename, setFilename] = useState('Your photo');
  const [link, setLink] = useState('');
  const [frameLink, setFrameLink] = useState('');
  const [customFrameUrl, setCustomFrameUrl] = useState<string | null>(null);
  const [customFrameAiReady, setCustomFrameAiReady] = useState(false);
  const [customFrameName, setCustomFrameName] = useState('');
  const [customFrameEnabled, setCustomFrameEnabled] = useState(false);
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameAiBusy, setFrameAiBusy] = useState(false);
  const [frameAiMessage, setFrameAiMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [variant, setVariant] = useState(0);
  const [split, setSplit] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'url' | 'models'>('upload');
  const [faceStatus, setFaceStatus] = useState<FaceVerificationStatus>('idle');

  // Precision fit adjustment controls
  const [fitScale, setFitScale] = useState(1);
  const [fitOffsetY, setFitOffsetY] = useState(0);
  const [fitOffsetX, setFitOffsetX] = useState(0);
  const [fitRotate, setFitRotate] = useState(0);

  const cachedPointsRef = useRef<{ x: number; y: number; z?: number }[] | null>(null);
  const cachedInputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cachedFrameImageRef = useRef<HTMLImageElement | null>(null);
  const cachedDimsRef = useRef<{ width: number; height: number } | null>(null);

  const applyLiveAdjustment = (
    nextScale: number,
    nextOffsetY: number,
    nextOffsetX: number,
    nextRotate: number
  ) => {
    setFitScale(nextScale);
    setFitOffsetY(nextOffsetY);
    setFitOffsetX(nextOffsetX);
    setFitRotate(nextRotate);

    if (
      !customFrameEnabled ||
      !cachedInputCanvasRef.current ||
      !cachedFrameImageRef.current ||
      !cachedPointsRef.current ||
      !cachedDimsRef.current
    ) return;

    try {
      const { width, height } = cachedDimsRef.current;
      const composite = compositeCustomFrame(
        cachedInputCanvasRef.current,
        cachedFrameImageRef.current,
        cachedPointsRef.current,
        width,
        height,
        { scale: nextScale, offsetY: nextOffsetY, offsetX: nextOffsetX, rotate: nextRotate }
      );
      const outputs = createPhotoCrops(composite, cachedInputCanvasRef.current, cachedPointsRef.current, width, height);
      setResult(composite.toDataURL('image/png'));
      setFaceCropResult(outputs.fitted);
    } catch (err) {
      console.warn('Live fit adjustment error:', err);
    }
  };

  const resetLiveAdjustments = () => {
    applyLiveAdjustment(1, 0, 0, 0);
  };

  // AI Generative Try-On & Photorealistic Inpainting (Cloudflare Workers AI)
  const [aiEnhanceBusy, setAiEnhanceBusy] = useState(false);
  const [aiEnhancedResult, setAiEnhancedResult] = useState<string | null>(null);
  const [aiEnhancedFaceCrop, setAiEnhancedFaceCrop] = useState<string | null>(null);
  const [isAiBlended, setIsAiBlended] = useState(false);

  const handleAiEnhance = async () => {
    if (!result || aiEnhanceBusy) return;
    setAiEnhanceBusy(true);
    setError('');
    try {
      let faceBox: { left: number; top: number; width: number; height: number } | undefined = undefined;
      if (cachedPointsRef.current && cachedDimsRef.current) {
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const p of cachedPointsRef.current) {
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
        const { width, height } = cachedDimsRef.current;
        const padX = (maxX - minX) * 0.35;
        const padY = (maxY - minY) * 0.35;
        faceBox = {
          left: Math.round(Math.max(0, minX - padX) * width),
          top: Math.round(Math.max(0, minY - padY) * height),
          width: Math.round(Math.min(1, (maxX - minX) + padX * 2) * width),
          height: Math.round(Math.min(1, (maxY - minY) + padY * 2) * height),
        };
      }

      const response = await fetch('/api/photo/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositeImage: result,
          faceBox,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI enhancement failed');
      if (data.image) {
        setAiEnhancedResult(data.image);
        setIsAiBlended(true);
        if (cachedPointsRef.current && cachedDimsRef.current && cachedInputCanvasRef.current) {
          const aiImg = new Image();
          aiImg.src = data.image;
          await aiImg.decode();
          const aiCanvas = document.createElement('canvas');
          aiCanvas.width = cachedDimsRef.current.width;
          aiCanvas.height = cachedDimsRef.current.height;
          const aiCtx = aiCanvas.getContext('2d')!;
          aiCtx.drawImage(aiImg, 0, 0);
          const crops = createPhotoCrops(aiCanvas, cachedInputCanvasRef.current, cachedPointsRef.current, cachedDimsRef.current.width, cachedDimsRef.current.height);
          setAiEnhancedFaceCrop(crops.fitted);
        }
      }
    } catch (err: any) {
      setError(err.message || 'AI Enhancement failed. Please check your connection.');
    } finally {
      setAiEnhanceBusy(false);
    }
  };

  const request = useRef(0);
  const activeRun = useRef(0);
  const urlRef = useRef<string | null>(null);
  const customFrameUrlRef = useRef<string | null>(null);
  const customFrameSourceUrlRef = useRef<string | null>(null);
  const frameRequest = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      request.current++;
      activeRun.current++;
      frameRequest.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (customFrameUrlRef.current) URL.revokeObjectURL(customFrameUrlRef.current);
      if (customFrameSourceUrlRef.current && customFrameSourceUrlRef.current !== customFrameUrlRef.current) URL.revokeObjectURL(customFrameSourceUrlRef.current);
    };
  }, []);

  const acceptCustomFrame = async (blob: Blob, name: string, isCurrent: () => boolean = () => true) => {
    // Some image hosts use a generic binary content type. Let the browser's
    // decoder verify those responses instead of rejecting a valid image URL.
    if (blob.type && !blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') {
      throw Error('Choose a direct JPG, PNG or WebP sunglasses image.');
    }
    if (blob.size > 20 * 1024 * 1024) throw Error('Use a sunglasses image smaller than 20 MB.');
    const sourceUrl = URL.createObjectURL(blob);
    try {
      const image = new Image(); image.src = sourceUrl; await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw Error('That link did not return a readable sunglasses image.');
      if (!isCurrent()) return;
      // Show the exact linked/uploaded source right away while AI preparation
      // runs. The prepared asset is kept separately for the on-face output.
      if (customFrameUrlRef.current && customFrameUrlRef.current !== customFrameSourceUrlRef.current) URL.revokeObjectURL(customFrameUrlRef.current);
      if (customFrameSourceUrlRef.current) URL.revokeObjectURL(customFrameSourceUrlRef.current);
      customFrameSourceUrlRef.current = sourceUrl;
      customFrameUrlRef.current = sourceUrl;
      setCustomFrameUrl(sourceUrl);
      setCustomFrameAiReady(false);
      setCustomFrameName('Original · ' + name);
      setCustomFrameEnabled(true);
      setResult(null); setFaceCropResult(null); setFaceCropOriginal(null); setError('');
      setFrameAiBusy(true);
      setFrameAiMessage('Processing sunglasses image…');
      try {
        const prepared = await processCustomFrameWithHostedAI(image, message => {
          if (isCurrent()) setFrameAiMessage(message);
        });
        const preparedBlob = await new Promise<Blob>((resolve, reject) => prepared.toBlob(value => value ? resolve(value) : reject(Error('Could not prepare the sunglasses image.')), 'image/png'));
        if (!isCurrent()) return;
        const nextUrl = URL.createObjectURL(preparedBlob);
        if (customFrameUrlRef.current && customFrameUrlRef.current !== customFrameSourceUrlRef.current) URL.revokeObjectURL(customFrameUrlRef.current);
        customFrameUrlRef.current = nextUrl;
        setCustomFrameUrl(nextUrl);
        setCustomFrameAiReady(true);
        setCustomFrameName('Fitted · ' + name);
        setFitScale(1); setFitOffsetX(0); setFitOffsetY(0); setFitRotate(0);
        setCustomFrameEnabled(true);
        setResult(null); setFaceCropResult(null); setFaceCropOriginal(null); setError('');
      } catch (err) {
        console.warn('Custom frame preparation warning:', err);
        setCustomFrameAiReady(true);
      }
    } finally {
      if (customFrameSourceUrlRef.current !== sourceUrl && customFrameUrlRef.current !== sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (isCurrent()) { setFrameAiBusy(false); setFrameAiMessage(''); }
    }
  };

  const loadCustomFrameFile = async (file?: File) => {
    if (!file) return;
    const id = ++frameRequest.current;
    setFrameBusy(true); setFrameAiBusy(false); setError('');
    try {
      await acceptCustomFrame(file, file.name, () => id === frameRequest.current);
    } catch (e) {
      if (id === frameRequest.current) setError(e instanceof Error ? e.message : 'Sunglasses image could not load.');
    } finally { if (id === frameRequest.current) setFrameBusy(false); }
  };

  const loadCustomFrameLink = async () => {
    const value = frameLink.trim();
    if (!value) return;
    const id = ++frameRequest.current;
    setFrameBusy(true); setFrameAiBusy(false); setError('');
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('Use an HTTP or HTTPS sunglasses image link.');
      let blob: Blob | null = null;
      try {
        const response = await fetch(url.href, { signal: AbortSignal.timeout(8000), credentials: 'omit' });
        if (response.ok) blob = await response.blob();
      } catch { blob = null; }
      if (!blob) {
        const response = await fetch(`/api/photo/proxy?url=${encodeURIComponent(url.href)}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw Error(payload.error || 'Could not load that image link. Try a direct image URL.');
        }
        blob = await response.blob();
      }
      if (id !== frameRequest.current) return;
      await acceptCustomFrame(blob, url.pathname.split('/').filter(Boolean).pop() || 'Linked sunglasses image', () => id === frameRequest.current);
      setFrameLink('');
    } catch (e) {
      if (id === frameRequest.current) setError(e instanceof Error ? e.message : 'Sunglasses image could not load.');
    } finally { if (id === frameRequest.current) setFrameBusy(false); }
  };

  const normalizeCustomFrameWithAI = async (): Promise<string | null> => {
    if (customFrameAiReady && customFrameUrlRef.current) return customFrameUrlRef.current;
    const sourceUrl = customFrameSourceUrlRef.current;
    if (!sourceUrl) { setError('Load a sunglasses image before leveling it.'); return null; }
    const id = ++frameRequest.current;
    setFrameBusy(true); setFrameAiBusy(true); setError('');
    try {
      const sourceImage = new Image();
      sourceImage.src = sourceUrl;
      await sourceImage.decode();
      setFrameAiMessage('Processing sunglasses frame…');
      const preparedCanvas = await processCustomFrameWithHostedAI(sourceImage, message => {
        if (id === frameRequest.current) setFrameAiMessage(message);
      });

      if (id !== frameRequest.current) return null;
      const preparedBlob = await new Promise<Blob>((resolve, reject) =>
        preparedCanvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not level sunglasses frame.')), 'image/png')
      );
      if (id !== frameRequest.current) return null;

      const nextUrl = URL.createObjectURL(preparedBlob);
      const oldUrl = customFrameUrlRef.current;
      if (oldUrl && oldUrl !== customFrameSourceUrlRef.current) URL.revokeObjectURL(oldUrl);
      customFrameUrlRef.current = nextUrl;
      setCustomFrameUrl(nextUrl);
      setCustomFrameAiReady(true);
      setCustomFrameName(previous => previous.startsWith('Original ·') ? previous.replace('Original ·', 'Fitted ·') : `Fitted · ${previous}`);
      return nextUrl;
    } catch (e) {
      console.warn('Could not level sunglasses image, using current source:', e);
      setCustomFrameAiReady(true);
      return customFrameUrlRef.current || sourceUrl;
    } finally {
      if (id === frameRequest.current) setFrameBusy(false);
      if (id === frameRequest.current) { setFrameAiBusy(false); setFrameAiMessage(''); }
    }
  };

  const clearCustomFrame = () => {
    frameRequest.current++;
    if (customFrameUrlRef.current) URL.revokeObjectURL(customFrameUrlRef.current);
    if (customFrameSourceUrlRef.current && customFrameSourceUrlRef.current !== customFrameUrlRef.current) URL.revokeObjectURL(customFrameSourceUrlRef.current);
    customFrameUrlRef.current = null;
    customFrameSourceUrlRef.current = null;
    setCustomFrameUrl(null); setCustomFrameName(''); setCustomFrameEnabled(false);
    setCustomFrameAiReady(false); setFrameAiBusy(false); setFrameAiMessage('');
    setFrameLink(''); setResult(null); setFaceCropResult(null); setFaceCropOriginal(null); setError('');
  };

  const checkFaceInPhoto = async (imageUrl: string, reqId: number) => {
    setFaceStatus('checking');
    let task: Awaited<ReturnType<typeof createFaceDetector>> | null = null;
    try {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      if (reqId !== request.current) return;

      task = await createFaceDetector('IMAGE', 2);
      if (reqId !== request.current) return;

      const faces = detectPhotoFaces(task, image);
      if (faces.length === 1) {
        setFaceStatus('detected');
      } else if (faces.length === 0) {
        setFaceStatus('no_face');
      } else {
        setFaceStatus('multiple_faces');
      }
    } catch {
      if (reqId === request.current) {
        setFaceStatus('idle');
      }
    } finally {
      task?.close();
    }
  };

  const accept = (blob: Blob, name: string) => {
    if (!blob.type.startsWith('image/')) throw Error('Choose a direct JPG, PNG or WebP image.');
    if (blob.size > 20 * 1024 * 1024) throw Error('Use an image smaller than 20 MB.');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    const currentUrl = urlRef.current;
    const currentId = ++request.current;
    setZoom(1);
    setPhoto(currentUrl);
    setFilename(name);
    setResult(null); // Clear previous result so user can click "Try on"
    setFaceCropResult(null);
    setFaceCropOriginal(null);
    setViewMode('full');
    setError('');
    checkFaceInPhoto(currentUrl, currentId);
  };

  const upload = (file?: File) => {
    if (!file) return;
    try {
      accept(file, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image could not load');
    }
  };

  const loadDemoModel = async (path: string, label: string) => {
    const id = ++request.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(path);
      if (!response.ok) throw Error('Could not load demo portrait.');
      const blob = await response.blob();
      if (id === request.current) {
        accept(blob, label);
      }
    } catch (e: unknown) {
      if (id === request.current) {
        setError(e instanceof Error ? e.message : 'Could not load demo portrait.');
      }
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  const loadLink = async (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    const id = ++request.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const url = new URL(clean);
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('Use an HTTP or HTTPS image URL.');
      
      let blob: Blob | null = null;
      // Direct fetch attempt
      try {
        const response = await fetch(url.href, { signal: AbortSignal.timeout(8000), credentials: 'omit' });
        if (response.ok) {
          blob = await response.blob();
        }
      } catch {
        blob = null;
      }

      // If direct fetch fails (e.g. CORS block from external image host), fall back to server proxy
      if (!blob) {
        const proxyRes = await fetch(`/api/photo/proxy?url=${encodeURIComponent(url.href)}`, { signal: AbortSignal.timeout(15000) });
        if (!proxyRes.ok) {
          const errJson = await proxyRes.json().catch(() => ({}));
          throw Error(errJson.error || 'Image link could not be opened by browser or server.');
        }
        blob = await proxyRes.blob();
      }

      if (id === request.current) {
        accept(blob, 'Web Portrait');
        setLink('');
      }
    } catch (e) {
      if (id === request.current) {
        setError(e instanceof Error ? e.message : 'Image could not load. Try uploading the photo file directly.');
      }
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  // Run 3D glasses fitting on the photo with Ultra-HD super-sampling and unified background rendering
  const handleTryOn = async (frameUrlOverride?: string, useDefaultFit = false) => {
    if (!photo) {
      fileInputRef.current?.click();
      return;
    }

    const useCustomFrame = Boolean(frameUrlOverride) || customFrameEnabled;
    if (useCustomFrame && !frameUrlOverride && !customFrameUrl) {
      setError('Upload a sunglasses image or add its image link first.');
      return;
    }

    const runId = ++activeRun.current;
    setBusy(true);
    setError('');

    let task: Awaited<ReturnType<typeof createFaceDetector>> | null = null;
    let rig: EyewearRig | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let env: THREE.WebGLRenderTarget | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.Material | null = null;
    let skullGeometry: THREE.BufferGeometry | null = null;
    let shadowTexture: THREE.CanvasTexture | null = null;

    try {
      // Detect landmarks on the original upload; never regenerate the portrait.
      const image = new Image();
      image.src = photo;
      await image.decode();
      if (runId !== activeRun.current) return;
      task = await createFaceDetector('IMAGE', 2);
      if (runId !== activeRun.current) return;
      const faces = detectPhotoFaces(task, image);
      if (faces.length !== 1) {
        throw Error(faces.length ? 'More than one person is visible. Use a photo with one clear face.' : 'Could not locate enough facial detail. Use a clearer original photo.');
      }
      const points = faces[0];

      // Keep the original pixel dimensions and decode directly to the base canvas.
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      // Draw high-resolution base plate with high-quality bicubic smoothing
      const input = document.createElement('canvas');
      input.width = width;
      input.height = height;
      const ctx = input.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw Error('Photo processing unavailable.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);

      if (useCustomFrame) {
        if (!frameUrlOverride && !customFrameUrl) throw Error('Upload a sunglasses image or add its image link first.');
        // Fit the extracted, leveled asset shown in the preview.
        const fittedFrameUrl = frameUrlOverride || (customFrameAiReady ? customFrameUrlRef.current : await normalizeCustomFrameWithAI());
        // normalizeCustomFrameWithAI already records the provider's detailed
        // error. Return through finally without replacing it with a generic one.
        if (!fittedFrameUrl) return;
        if (runId !== activeRun.current) return;
        const frameImage = new Image(); frameImage.src = fittedFrameUrl; await frameImage.decode();
        if (runId !== activeRun.current) return;

        // Cache refs for live interactive tuning adjustments
        cachedPointsRef.current = points;
        cachedInputCanvasRef.current = input;
        cachedFrameImageRef.current = frameImage;
        cachedDimsRef.current = { width, height };

        const composite = compositeCustomFrame(input, frameImage, points, width, height, {
          scale: useDefaultFit ? 1 : fitScale,
          offsetY: useDefaultFit ? 0 : fitOffsetY,
          offsetX: useDefaultFit ? 0 : fitOffsetX,
          rotate: useDefaultFit ? 0 : fitRotate,
        });

        const outputs = createPhotoCrops(composite, input, points, width, height);
        if (runId === activeRun.current) {
          setResult(composite.toDataURL('image/png'));
          setFaceCropResult(outputs.fitted);
          setFaceCropOriginal(outputs.original);
          const faceVerticalSpan = Math.abs(points[152].y - points[10].y);
          setViewMode(faceVerticalSpan < 0.32 ? 'face' : 'full');
          setSplit(0);
        }
        return;
      }

      // 3. Compute 3D eyewear pose on high-resolution canvas
      const pose = eyewearPose(points, width, height);
      if (!pose) throw Error('Could not measure this face.');

      const activeVariant = product.variants[variant] || product.variants[0];
      const model = await loadEyewearCADModel(product, activeVariant);
      if (runId !== activeRun.current) return;

      rig = new EyewearRig(model, product.id);

      // 4. Initialize WebGL Renderer with High-Performance Settings & Hardware MSAA
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: true, // Render only eyewear over transparent pixels.
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();

      renderer.setClearColor(0x000000, 0);

      // 6. Balanced Natural Studio Lighting
      env = generateStudioEnvironment(renderer, 'studio');
      scene.environment = env.texture;
      scene.add(new THREE.HemisphereLight(0xfff8f0, 0x4a4036, 1.25));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
      keyLight.position.set(-width * 0.25, height * 0.35, 900);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.75);
      fillLight.position.set(width * 0.3, -height * 0.1, 700);
      scene.add(fillLight);

      // 7. Orthographic Camera exactly framing the canvas
      const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 4500);
      camera.position.z = 1000;

      // 8. Eyewear Group & Temple Arm Fitting
      const root = new THREE.Group();
      root.add(rig.group);
      const fittedScale = rig.fittedFaceScale(pose);
      root.position.copy(rig.fittedPosition(pose, fittedScale));
      root.quaternion.copy(pose.quaternion);
      root.scale.setScalar(fittedScale);
      scene.add(root);
      root.updateMatrixWorld(true);

      const localLeftTemple = root.worldToLocal(pose.leftTemple.clone());
      const localRightTemple = root.worldToLocal(pose.rightTemple.clone());
      rig.fitTemples(localLeftTemple, localRightTemple);

      // 9. Depth Occluders (Skull Volume + Face Surface Mask)
      const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
      material = depthMaterial;

      // Cranium / Skull occluder cleanly hides far temple arm behind head/hair during angled poses
      const faceWidth = localLeftTemple.distanceTo(localRightTemple);
      skullGeometry = new THREE.SphereGeometry(1, 32, 24);
      const skull = new THREE.Mesh(skullGeometry, depthMaterial);
      const skullPose = faceSkullPose(pose);
      skull.position.copy(skullPose.position); skull.quaternion.copy(skullPose.quaternion);
      skull.scale.copy(skullPose.scale);
      skull.renderOrder = -10;
      scene.add(skull);

      // Face mesh occluder
      const response = await fetch('/tracking/face-triangles.json');
      if (!response.ok) throw Error('Face surface could not load.');
      const triangles = await response.json();
      if (runId !== activeRun.current) return;

      geometry = new THREE.BufferGeometry();
      geometry.setIndex(triangles);
      const occlusionView = new THREE.Vector3(0, 0, 1).applyQuaternion(pose.quaternion.clone().invert());
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          pose.surface.flatMap((p) => {
            const w = faceOcclusionPoint(p, new THREE.Vector3(), pose.skinProfile, occlusionView).multiplyScalar(pose.eyeSpan)
              .applyQuaternion(pose.quaternion).add(pose.bridge);
            return w.toArray();
          }),
          3
        )
      );
      const mask = new THREE.Mesh(geometry, depthMaterial);
      mask.renderOrder = -10;
      scene.add(mask);

      // 10. Soft Ambient Contact Shadow on Nose Bridge & Radix
      shadowTexture = createContactShadowTexture();
      const shadowGeo = new THREE.PlaneGeometry(pose.eyeSpan * 0.50, pose.eyeSpan * 0.28);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.copy(pose.bridge);
      shadowMesh.position.addScaledVector(pose.yAxis, -pose.eyeSpan * 0.04);
      shadowMesh.position.addScaledVector(pose.zAxis, -pose.eyeSpan * 0.02);
      shadowMesh.quaternion.copy(pose.quaternion);
      shadowMesh.renderOrder = -5;
      scene.add(shadowMesh);

      // 11. Render Full High-Definition Scene
      renderer.render(scene, camera);

      // 12. Create Crisp Composited Result with Smart Clarity
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = height;
      const fCtx = finalCanvas.getContext('2d', { willReadFrequently: true })!;
      fCtx.drawImage(input, 0, 0);
      fCtx.drawImage(renderer.domElement, 0, 0);
      const fullResultUrl = finalCanvas.toDataURL('image/png');

      // 13. Create the same HD face-focus crop for catalog CAD and custom images.
      const outputs = createPhotoCrops(finalCanvas, input, points, width, height);

      if (runId === activeRun.current) {
        setResult(fullResultUrl);
        setFaceCropResult(outputs.fitted);
        setFaceCropOriginal(outputs.original);
        const faceVerticalSpan = Math.abs(points[152].y - points[10].y);
        setViewMode(faceVerticalSpan < 0.32 ? 'face' : 'full');
      }
    } catch (e) {
      if (runId === activeRun.current) {
        setError(e instanceof Error ? e.message : 'Photo fitting failed.');
      }
    } finally {
      task?.close();
      rig?.dispose();
      env?.dispose();
      geometry?.dispose();
      material?.dispose();
      skullGeometry?.dispose();
      shadowTexture?.dispose();
      renderer?.dispose();
      if (runId === activeRun.current) {
        setBusy(false);
      }
    }
  };

  // Fit automatically whether the portrait or the processed sunglasses arrive
  // first. The input card continues to show the untouched sunglasses source.
  useEffect(() => {
    if (photo && customFrameEnabled && customFrameAiReady && !busy) {
      void handleTryOn();
    } else if (photo && !customFrameEnabled && !busy && !result) {
      void handleTryOn();
    }
  }, [photo, customFrameEnabled, customFrameAiReady, customFrameUrl]);

  return (
    <article className="photo-workspace">
      <button className="product-back" onClick={onBack}>
        <ArrowLeft size={17} /> Back to fitting room
      </button>

      <div className="photo-workspace-heading">
        <span>PHOTO TRY-ON STUDIO</span>
        <h1>Your photo. Your frames.</h1>
        <p>Choose a portrait and a frame to create your fitted image.</p>
      </div>

      <div className="photo-workbench">
        <div className="photo-inputs">
          <div className="photo-input-cards">
            {/* 1. Face photo card */}
            <section
              className={`photo-asset-card ${dragging ? 'photo-drop-active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                upload(e.dataTransfer.files[0]);
              }}
            >
              <header>
                <h2>1. Face photo</h2>
                <span>{photo ? (faceStatus === 'detected' ? 'READY' : faceStatus === 'no_face' ? 'NO FACE' : 'CHECKING') : 'PORTRAIT'}</span>
              </header>

              {/* Source Mode Tabs when no photo is loaded */}
              {!photo && (
                <div className="photo-source-tabs">
                  <button
                    type="button"
                    className={activeInputTab === 'upload' ? 'active' : ''}
                    onClick={() => setActiveInputTab('upload')}
                  >
                    <Upload size={12} /> Upload
                  </button>
                  <button
                    type="button"
                    className={activeInputTab === 'url' ? 'active' : ''}
                    onClick={() => setActiveInputTab('url')}
                  >
                    <Globe size={12} /> Face Link
                  </button>
                  <button
                    type="button"
                    className={activeInputTab === 'models' ? 'active' : ''}
                    onClick={() => setActiveInputTab('models')}
                  >
                    <User size={12} /> Demo Face
                  </button>
                </div>
              )}

              <div className={`photo-asset-preview photo-face-preview ${photo ? 'has-photo !border-none' : ''} !h-72 !rounded-2xl relative overflow-hidden bg-[#130d1d]`}>
                {photo ? (
                  <>
                    {/* Ambient blurred background clone */}
                    <img
                      src={photo}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-35 scale-110 pointer-events-none"
                    />
                    {/* Sharp portrait image on top */}
                    <img src={photo} alt="Face photo for try-on" className="photo-main-img relative z-10 w-full h-full object-cover object-top rounded-2xl" />

                    {/* Floating face verification badge */}
                    {faceStatus === 'checking' && (
                      <div className="face-pill checking !absolute !top-3 !left-3 !z-30 backdrop-blur-md bg-black/60 border border-white/20 px-2.5 py-1 rounded-full text-xs text-white flex items-center gap-1.5 shadow-lg">
                        <Sparkles size={11} className="animate-spin text-purple-400" />
                        <span>Verifying face…</span>
                      </div>
                    )}
                    {faceStatus === 'detected' && (
                      <div className="face-pill valid !absolute !top-3 !left-3 !z-30 backdrop-blur-md bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-full text-xs text-emerald-300 flex items-center gap-1.5 shadow-lg">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span>Human Face Detected</span>
                      </div>
                    )}
                    {faceStatus === 'no_face' && (
                      <div className="face-pill no-face !absolute !top-3 !left-3 !z-30 backdrop-blur-md bg-amber-950/80 border border-amber-500/40 px-2.5 py-1 rounded-full text-xs text-amber-300 flex items-center gap-1.5 shadow-lg">
                        <AlertTriangle size={12} className="text-amber-400" />
                        <span>No Face Detected</span>
                      </div>
                    )}

                    <button
                      className="photo-remove !absolute !top-3 !right-3 !z-30 hover:scale-105 transition"
                      aria-label="Remove photo"
                      onClick={() => {
                        request.current++;
                        activeRun.current++;
                        setPhoto(null);
                        setResult(null);
                        setFaceCropResult(null);
                        setFaceCropOriginal(null);
                        setViewMode('full');
                        setFaceStatus('idle');
                        setError('');
                        setBusy(false);
                      }}
                    >
                      <X size={16} />
                    </button>

                    {/* Clean luxury bottom bar matching Card 2 */}
                    <div className="absolute bottom-0 inset-x-0 z-30 bg-[#130d1d]/90 backdrop-blur-md px-3.5 py-2.5 flex items-center justify-between border-t border-purple-500/20 text-xs text-[#e9d5ff]">
                      <span className="truncate max-w-[170px] font-semibold">{filename || 'Portrait Photo'}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={11} /> Ready for fit
                      </span>
                    </div>

                    {/* Prominent warning if the user loaded sunglasses/non-face in this slot */}
                    {faceStatus === 'no_face' && (
                      <div className="face-alert-overlay">
                        <div className="flex items-start gap-2 text-left">
                          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[11px] font-bold text-red-100">Face not clear enough yet</p>
                            <p className="text-[10px] text-red-200/90 leading-tight mt-0.5">
                              Use a clear front or three-quarter portrait with both eyes visible. Full-body photos work if the face is large and sharp; blurry or covered faces need a closer crop. Sunglasses images go in <strong>2. Eyewear frame</strong>.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => loadDemoModel('/models_faces/female_oval.jpg', 'Female Portrait Model')}
                                className="px-2.5 py-1 bg-red-500/30 hover:bg-red-500/50 text-red-100 rounded text-[10px] font-semibold transition cursor-pointer"
                              >
                                Use Demo Face
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPhoto(null);
                                  setFaceStatus('idle');
                                }}
                                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-medium transition cursor-pointer"
                              >
                                Change Photo
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Tab 1: Upload File */}
                    {activeInputTab === 'upload' && (
                      <div className="w-full h-full flex flex-col justify-between p-2">
                        <label className="photo-placeholder cursor-pointer w-full flex-1 flex flex-col items-center justify-center gap-1.5 p-3 text-center border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 rounded-xl transition group">
                          <ImagePlus size={32} className="text-[#a855f7] transition-transform group-hover:scale-110" />
                          <strong className="text-white text-xs font-semibold">Upload face portrait</strong>
                          <span className="text-[11px] text-[#b3a4c8] leading-tight">Click to browse or drag your photo here</span>
                          <span className="text-[10px] text-[#8e7ea5]">Front or three-quarter view works best; keep both eyes visible</span>
                          <span className="text-[10px] text-[#8e7ea5]">JPG, PNG, WebP · up to 20 MB</span>
                          <input
                            ref={fileInputRef}
                            aria-label="Upload face photo"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              upload(e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>

                        {/* Quick try with demo face row */}
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2 px-1">
                          <span className="text-[11px] text-[#b3a4c8] font-medium">Quick try with demo face:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => loadDemoModel('/models_faces/female_oval.jpg', 'Female Portrait Model')}
                              title="Female Face (Oval shape)"
                              className="w-8 h-8 rounded-full border border-purple-400/50 hover:scale-110 transition overflow-hidden cursor-pointer shadow-sm hover:border-purple-400"
                            >
                              <img src="/models_faces/female_oval.jpg" alt="Female Model" className="w-full h-full object-cover" />
                            </button>
                            <button
                              type="button"
                              onClick={() => loadDemoModel('/models_faces/male_square.jpg', 'Male Portrait Model')}
                              title="Male Face (Square shape)"
                              className="w-8 h-8 rounded-full border border-purple-400/50 hover:scale-110 transition overflow-hidden cursor-pointer shadow-sm hover:border-purple-400"
                            >
                              <img src="/models_faces/male_square.jpg" alt="Male Model" className="w-full h-full object-cover" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Public URL */}
                    {activeInputTab === 'url' && (
                      <div className="w-full h-full flex flex-col justify-center items-center p-3 text-center">
                        <div className="w-9 h-9 rounded-full bg-violet-950/70 border border-violet-500/30 flex items-center justify-center mb-1.5 text-violet-400">
                          <Globe size={18} />
                        </div>
                        <strong className="text-white text-xs font-semibold">Face portrait URL</strong>
                        <p className="text-[10.5px] text-[#b3a4c8] mt-0.5 mb-2 leading-snug">
                          Paste link of a <strong>person's face</strong> (portrait photo)
                        </p>
                        <form
                          className="w-full flex flex-col gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            loadLink(link);
                          }}
                        >
                          <input
                            type="url"
                            value={link}
                            placeholder="https://.../face-photo.jpg"
                            onChange={(e) => setLink(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#251b36] border border-[#4c1d95] text-white focus:outline-none focus:border-violet-400"
                            required
                          />
                          <button
                            type="submit"
                            disabled={busy || !link.trim()}
                            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white text-xs font-semibold shadow-md disabled:opacity-50 cursor-pointer"
                          >
                            {busy ? 'Loading & verifying…' : 'Load face photo'}
                          </button>
                        </form>
                        <span className="text-[9.5px] text-[#8e7ea5] mt-1.5">
                          Note: Sunglasses frames are chosen in <strong>Card 2</strong>.
                        </span>
                      </div>
                    )}

                    {/* Tab 3: Demo Models */}
                    {activeInputTab === 'models' && (
                      <div className="w-full h-full flex flex-col justify-center items-center p-3 text-center">
                        <strong className="text-white text-xs font-semibold mb-1">Select demo model face</strong>
                        <p className="text-[10.5px] text-[#b3a4c8] mb-2.5">Try instant 3D fit with real models:</p>
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => loadDemoModel('/models_faces/female_oval.jpg', 'Female Portrait Model')}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[#251b36] hover:bg-[#3b0764] border border-[#4c1d95] hover:border-violet-400 transition cursor-pointer group"
                          >
                            <img src="/models_faces/female_oval.jpg" alt="Female Model" className="w-11 h-11 rounded-full object-cover border border-violet-400/30 group-hover:scale-105 transition" />
                            <span className="text-[11px] font-medium text-violet-200">Female Face</span>
                            <span className="text-[9px] text-[#a78bfa]">Oval shape</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => loadDemoModel('/models_faces/male_square.jpg', 'Male Portrait Model')}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[#251b36] hover:bg-[#3b0764] border border-[#4c1d95] hover:border-violet-400 transition cursor-pointer group"
                          >
                            <img src="/models_faces/male_square.jpg" alt="Male Model" className="w-11 h-11 rounded-full object-cover border border-violet-400/30 group-hover:scale-105 transition" />
                            <span className="text-[11px] font-medium text-violet-200">Male Face</span>
                            <span className="text-[9px] text-[#a78bfa]">Square shape</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <footer>
                <span>{photo ? (faceStatus === 'detected' ? '✓ Ready for 3D fit' : 'Change portrait') : 'Personalize your portrait'}</span>
                {photo ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setFaceStatus('idle');
                        setActiveInputTab('url');
                      }}
                      className="text-[#c084fc] hover:text-[#d8b4fe] text-[11px] font-semibold cursor-pointer"
                    >
                      Link
                    </button>
                    <span className="text-white/20">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setFaceStatus('idle');
                        setActiveInputTab('models');
                      }}
                      className="text-[#c084fc] hover:text-[#d8b4fe] text-[11px] font-semibold cursor-pointer"
                    >
                      Demo
                    </button>
                    <span className="text-white/20">·</span>
                    <label className="photo-upload-action cursor-pointer">
                      <Upload size={13} />
                      <span>Replace</span>
                      <input
                        aria-label="Upload face photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          upload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#8e7ea5]">Demo faces:</span>
                      <button
                        type="button"
                        onClick={() => loadDemoModel('/models_faces/female_oval.jpg', 'Female Portrait Model')}
                        title="Female Face"
                        className="w-7 h-7 rounded-full border border-purple-400/50 hover:scale-110 transition overflow-hidden cursor-pointer"
                      >
                        <img src="/models_faces/female_oval.jpg" alt="Female" className="w-full h-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => loadDemoModel('/models_faces/male_square.jpg', 'Male Portrait Model')}
                        title="Male Face"
                        className="w-7 h-7 rounded-full border border-purple-400/50 hover:scale-110 transition overflow-hidden cursor-pointer"
                      >
                        <img src="/models_faces/male_square.jpg" alt="Male" className="w-full h-full object-cover" />
                      </button>
                    </div>
                    <label className="photo-upload-action cursor-pointer">
                      <Upload size={14} />
                      <span>Browse</span>
                      <input
                        aria-label="Upload face photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          upload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </footer>
            </section>

            {/* 2. Eyewear frame card */}
            <section className="photo-asset-card">
              <header>
                <h2>2. Eyewear frame</h2>
                <span>{customFrameEnabled ? customFrameUrl ? customFrameAiReady ? 'SOURCE + FIT READY' : frameAiBusy ? 'PROCESSING' : 'SOURCE LOADED' : 'ADD IMAGE' : '3D READY'}</span>
              </header>

              <div className="photo-frame-source-tabs" role="tablist" aria-label="Eyewear source">
                <button type="button" role="tab" aria-selected={!customFrameEnabled} className={!customFrameEnabled ? 'active' : ''} onClick={() => setCustomFrameEnabled(false)}>
                  <Glasses size={12} /> Catalog 3D
                </button>
                <button type="button" role="tab" aria-selected={customFrameEnabled} className={customFrameEnabled ? 'active' : ''} onClick={() => setCustomFrameEnabled(true)}>
                  <ImagePlus size={12} /> Custom image
                </button>
              </div>

              {/* Clean Lightbox Showcase Container matching h-72 height */}
              {customFrameEnabled ? (
                <div className="relative overflow-hidden bg-white border border-gray-200/80 rounded-2xl w-full h-72 flex flex-col justify-between group shadow-sm">
                  {customFrameUrl ? (
                    <>
                      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                        <img
                          src={customFrameSourceUrlRef.current || customFrameUrl}
                          alt={`Original sunglasses source: ${customFrameName}`}
                          className="max-h-44 max-w-full object-contain transition-transform duration-300 hover:scale-105"
                        />
                      </div>
                      
                      {/* Luxury e-commerce bottom title bar */}
                      <div className="bg-gray-50/90 border-t border-gray-200 text-gray-900 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 truncate max-w-[170px]">{customFrameName}</span>
                        <button
                          type="button"
                          className="text-gray-500 hover:text-gray-900 p-0.5 rounded transition cursor-pointer"
                          aria-label="Remove custom sunglasses image"
                          onClick={clearCustomFrame}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5 p-6 text-center text-gray-500">
                      <Glasses size={34} className="text-purple-600/70 mb-1" />
                      <strong className="text-xs font-bold text-gray-800">Add a sunglasses image</strong>
                      <span className="text-[11px] text-gray-500 leading-tight">Transparent PNG works best. Plain backgrounds are removed when possible.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative overflow-hidden bg-white border border-gray-200/80 rounded-2xl w-full h-72 flex flex-col justify-between group shadow-sm">
                  <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                    <img
                      src={product.thumbnailUrl || '/models/catalog-thumbnails/' + product.id + (variant ? '-v' + variant : '') + '.png'}
                      alt={product.name}
                      className="max-h-44 max-w-full object-contain transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  
                  {/* Luxury e-commerce bottom title bar */}
                  <div className="bg-gray-50/90 border-t border-gray-200 text-gray-900 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 truncate">{product.name}</span>
                    <span className="text-[10px] font-mono font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">3D CAD</span>
                  </div>
                </div>
              )}

              {customFrameEnabled && <div className="custom-frame-inputs">
                <label className="custom-frame-upload">
                  <Upload size={13} /> {frameBusy ? frameAiBusy ? frameAiMessage || 'Hosted AI processing…' : 'Loading image…' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={frameBusy} onChange={e => { loadCustomFrameFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <form onSubmit={e => { e.preventDefault(); loadCustomFrameLink(); }}>
                  <input type="url" value={frameLink} onChange={e => setFrameLink(e.target.value)} placeholder="Paste sunglasses image URL" aria-label="Sunglasses image URL" required />
                  <button type="submit" disabled={frameBusy || !frameLink.trim()}><Globe size={12} /> Load link</button>
                </form>
                <p>{customFrameAiReady ? 'Bria RMBG 2.0 removed the background and kept the sunglasses pixels. Only this frame image is sent for processing; your portrait stays on this device.' : 'Upload one clear pair. Bria RMBG 2.0 removes the background without redrawing the sunglasses.'}</p>
              </div>}

              <footer>
                <span>{customFrameEnabled ? customFrameUrl ? customFrameAiReady ? 'Original frame isolated · ready to fit' : 'Original image · ready to process' : 'Choose a file or image link' : 'Inspect the frame · select below'}</span>
                <Glasses size={17} />
              </footer>
            </section>
          </div>

          {/* Settings card with Try On Action */}
          <section className="photo-settings-card">
            <h2>{customFrameEnabled ? 'Fit your custom sunglasses' : 'Make the look yours'}</h2>
            <p>{customFrameEnabled ? 'The frame is aligned to eye landmarks, with face roll and side angle accounted for.' : 'Select your favorite 3D eyewear frame and finish, then click Try on to generate your photo.'}</p>

            {customFrameEnabled ? (
              <div className="custom-frame-selection">
                <div><span>ACTIVE IMAGE</span><strong>{customFrameUrl ? customFrameName : 'Waiting for sunglasses image'}</strong></div>
                <button type="button" onClick={() => setCustomFrameEnabled(false)}>Use catalog frame</button>
              </div>
            ) : (
              /* Two-Column Grid: Left FRAME Dropdown, Right Circular FINISH Swatches matching h-[42px] */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                {/* Left Column: FRAME */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5 h-4">
                    <label htmlFor="photo-frame" className="text-[10.5px] font-bold text-purple-300 tracking-wider uppercase">
                      FRAME
                    </label>
                  </div>
                  <select
                    id="photo-frame"
                    className="!m-0 bg-[#1a132b] border border-purple-500/30 rounded-xl text-white px-3.5 h-[42px] text-xs focus:outline-none focus:border-purple-400 w-full transition-colors cursor-pointer"
                    value={product.id}
                    onChange={(e) => {
                      request.current++;
                      const p = products.find((item) => item.id === e.target.value);
                      if (p) {
                        setVariant(0);
                        onSelect(p);
                        setResult(null);
                        setFaceCropResult(null);
                        setFaceCropOriginal(null);
                      }
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right Column: FINISH (Circular color swatches matching h-[42px]) */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1.5 h-4">
                    <label className="text-[10.5px] font-bold text-purple-300 tracking-wider uppercase">
                      FINISH
                    </label>
                    <span className="text-[10px] text-purple-300 font-mono truncate max-w-[140px]">
                      {product.variants[variant]?.name || 'Standard'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 h-[42px] bg-[#1a132b] border border-purple-500/30 rounded-xl w-full">
                    {product.variants.map((v, i) => (
                      <button
                        key={i}
                        type="button"
                        title={v.name}
                        onClick={() => {
                          request.current++;
                          setVariant(i);
                          setResult(null);
                          setFaceCropResult(null);
                          setFaceCropOriginal(null);
                        }}
                        style={{
                          background: v.lensHex
                            ? `linear-gradient(135deg, ${v.frameHex} 40%, ${v.lensHex} 100%)`
                            : v.frameHex || '#18181b',
                        }}
                        className={`w-6 h-6 rounded-full border border-white/20 transition-all cursor-pointer hover:scale-110 ${
                          variant === i
                            ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-[#0f0a19] scale-110 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Prominent Single Try On CTA Button with Clean Sparkles SVG (No extra emoji) */}
            <div className="my-4">
              <button
                type="button"
                className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_25px_rgba(139,92,246,0.45)] hover:shadow-[0_0_35px_rgba(139,92,246,0.75)] transition-all font-semibold text-white rounded-xl py-3.5 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                onClick={() => void handleTryOn()}
                disabled={busy || frameBusy || (customFrameEnabled && !customFrameUrl)}
              >
                <Sparkles size={18} />
                <span>{busy ? 'Fitting frame to face…' : customFrameEnabled ? 'Fit custom image' : 'Try on'}</span>
              </button>
              {!photo && (
                <p className="text-[11px] text-[#b3a4c8] text-center mt-2">
                  Add your portrait photo first, then click <strong>Try on</strong>
                </p>
              )}
            </div>

            <p className="photo-privacy">
              {customFrameEnabled ? <>Hugging Face ZeroGPU processes only the sunglasses image to remove its background. Your portrait stays in the browser and is not sent to the AI service; the original sunglasses pixels are preserved.</> : <>Your portrait stays on your device. Frames are rendered over your original photo without changing your face, clothing or background.</>}
            </p>
            {error && (
              <p className="photo-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>

        {/* Result Stage */}
        <section className="photo-result-card" aria-live="polite">
          <div className={`photo-result-stage ${zoom > 1 ? 'photo-result-zoomed' : ''} bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:24px_24px]`}>
            <div className="photo-zoom-content" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, position: 'relative' }}>
              
              {/* Interactive View & Compare Switcher */}
              <div className="absolute top-4 inset-x-0 z-30 flex justify-center pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-1.5 bg-black/80 backdrop-blur-md border border-white/20 rounded-full p-1 shadow-2xl">
                  {faceCropResult ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setViewMode('face')}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          viewMode === 'face'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        title="Zoom in on face for high-detail fitting"
                      >
                        <ScanFace size={13} />
                        <span>Face Focus</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('full')}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          viewMode === 'full'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        title="View full portrait"
                      >
                        <Maximize2 size={12} />
                        <span>Full Photo</span>
                      </button>
                      <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                    </>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                      PREVIEW
                    </span>
                  )}
                  {result && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSplit(s => s > 0 ? 0 : 50)}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                          split > 0
                            ? 'bg-emerald-600/80 text-white border border-emerald-400/50'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                        title="Split compare original photo vs fitted eyewear"
                      >
                        <span>↔ Compare {split > 0 ? 'On' : 'Off'}</span>
                      </button>
                      <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />
                      <button
                        type="button"
                        onClick={() => {
                          if (!aiEnhancedResult) {
                            void handleAiEnhance();
                          } else {
                            setIsAiBlended(b => !b);
                          }
                        }}
                        disabled={aiEnhanceBusy}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isAiBlended && aiEnhancedResult
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg border border-amber-300/40'
                            : 'bg-violet-600/50 hover:bg-violet-600/80 text-violet-200 border border-violet-400/40 hover:text-white'
                        } disabled:opacity-50`}
                        title="Photorealistic AI Inpainting with skin reflections, soft shadows, and realistic lighting"
                      >
                        <Sparkles size={12} className={aiEnhanceBusy ? 'animate-spin' : ''} />
                        <span>{aiEnhanceBusy ? 'AI Blending…' : isAiBlended && aiEnhancedResult ? '✓ AI Blend Active' : '✨ AI Studio Blend'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {photo ? (
                <>
                  {/* Ambient blurred backdrop clone to eliminate harsh black side bars */}
                  <img
                    src={photo}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110 pointer-events-none"
                  />

                  {/* Main sharp portrait image on top */}
                  <img
                    className="photo-result-image relative z-10 h-full w-full object-contain"
                    src={(viewMode === 'face'
                      ? (isAiBlended && aiEnhancedFaceCrop ? aiEnhancedFaceCrop : faceCropResult)
                      : (isAiBlended && aiEnhancedResult ? aiEnhancedResult : result)
                    ) || photo}
                    alt={result ? `${product.name} fitted on your face` : 'Photo preview'}
                  />
                  {result && (
                    <>
                      <img
                        className="photo-result-original relative z-10"
                        src={(viewMode === 'face' && faceCropOriginal ? faceCropOriginal : photo)!}
                        alt="Original for comparison"
                        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                      />
                      <div className="photo-split-line z-20" style={{ left: `${split}%` }}>
                        <span>↔</span>
                      </div>
                      <input
                        className="photo-split-control z-20"
                        type="range"
                        min="0"
                        max="100"
                        value={split}
                        onChange={(e) => setSplit(Number(e.target.value))}
                        aria-label="Compare original and fitted image"
                      />
                    </>
                  )}
                </>
              ) : (
                <div className="photo-result-empty flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                    <Glasses size={28} />
                  </div>
                  <h2 className="text-base font-bold text-white mb-1">Your next look starts here</h2>
                  <p className="text-xs text-purple-200/70 max-w-xs leading-relaxed">
                    Upload a face photo and click <strong>Try on</strong> to see your fitted result.
                  </p>
                </div>
              )}
            </div>

            {busy && (
              <div className="photo-rendering" role="status">
                <span />
                {'Rendering eyewear on your original photo…'}
              </div>
            )}
          </div>

          {result && customFrameEnabled && (
            <div className="w-full p-3 rounded-xl bg-[#171026]/95 border border-violet-500/30 backdrop-blur-md shadow-xl my-2">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-200">
                  <Sliders size={14} className="text-violet-400" />
                  <span>Precision Fit Tuning</span>
                </div>
                <button
                  type="button"
                  onClick={resetLiveAdjustments}
                  className="flex items-center gap-1 text-[11px] font-medium text-violet-300 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition cursor-pointer"
                  title="Reset to AI detected fit"
                >
                  <RotateCcw size={11} /> Reset fit
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#b3a4c8]">
                    <span>Size</span>
                    <span className="font-mono text-violet-300">{Math.round(fitScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.65"
                    max="1.50"
                    step="0.01"
                    value={fitScale}
                    onChange={(e) => applyLiveAdjustment(Number(e.target.value), fitOffsetY, fitOffsetX, fitRotate)}
                    className="w-full h-1.5 bg-purple-950/80 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    aria-label="Frame scale size"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#b3a4c8]">
                    <span>Height</span>
                    <span className="font-mono text-violet-300">{fitOffsetY > 0 ? `+${fitOffsetY}` : fitOffsetY}px</span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    step="1"
                    value={fitOffsetY}
                    onChange={(e) => applyLiveAdjustment(fitScale, Number(e.target.value), fitOffsetX, fitRotate)}
                    className="w-full h-1.5 bg-purple-950/80 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    aria-label="Frame height offset"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#b3a4c8]">
                    <span>Position</span>
                    <span className="font-mono text-violet-300">{fitOffsetX > 0 ? `+${fitOffsetX}` : fitOffsetX}px</span>
                  </div>
                  <input
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={fitOffsetX}
                    onChange={(e) => applyLiveAdjustment(fitScale, fitOffsetY, Number(e.target.value), fitRotate)}
                    className="w-full h-1.5 bg-purple-950/80 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    aria-label="Frame horizontal position offset"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-[#b3a4c8]">
                    <span>Tilt</span>
                    <span className="font-mono text-violet-300">{fitRotate > 0 ? `+${fitRotate}` : fitRotate}°</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={fitRotate}
                    onChange={(e) => applyLiveAdjustment(fitScale, fitOffsetY, fitOffsetX, Number(e.target.value))}
                    className="w-full h-1.5 bg-purple-950/80 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    aria-label="Frame tilt angle"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="photo-result-tools flex flex-wrap items-center justify-between gap-2.5">
            {/* View Mode Switch (Full View vs Face Focus) */}
            {faceCropResult ? (
              <div className="flex items-center bg-[#1e152d] p-0.5 rounded-lg border border-purple-900/60">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'full' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#c084fc] hover:text-white'}`}
                  onClick={() => setViewMode('full')}
                >
                  <Maximize2 size={12} />
                  <span>Full View</span>
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'face' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#c084fc] hover:text-white'}`}
                  onClick={() => setViewMode('face')}
                >
                  <ScanFace size={13} />
                  <span>Face Focus</span>
                </button>
              </div>
            ) : <div />}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out">
                −
              </button>
              <span className="text-xs px-1 text-purple-300 font-semibold">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} aria-label="Zoom in">
                +
              </button>
              <button onClick={() => setZoom(1)}>Fit</button>
            </div>

          </div>

          <footer>
            <span className={result && !busy ? 'photo-result-ready' : ''}>
              ● {busy ? 'FITTING EYEWEAR' : result ? 'ORIGINAL PHOTO + EYEWEAR · PNG' : photo ? 'READY TO TRY ON' : 'WAITING FOR PHOTO'}
            </span>
            {result && !busy && (
              <div className="flex items-center gap-2">
                {faceCropResult && (
                  <a
                    className="photo-download secondary px-3 py-1.5 rounded-lg bg-violet-950/60 border border-violet-500/30 hover:border-violet-400 text-violet-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    href={(isAiBlended && aiEnhancedFaceCrop ? aiEnhancedFaceCrop : faceCropResult)}
                    download={`face-portrait-${product.id}.png`}
                    title="Download high-resolution face close-up"
                  >
                    <Download size={13} /> Face crop
                  </a>
                )}
                <a
                  className="photo-download px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-500/25 transition hover:brightness-110 cursor-pointer"
                  href={(isAiBlended && aiEnhancedResult ? aiEnhancedResult : result)}
                  download={`lumen-${product.id}.png`}
                  title="Download complete high-resolution try-on photo"
                >
                  <Download size={13} /> Full Photo
                </a>
              </div>
            )}
          </footer>
        </section>
      </div>
    </article>
  );
}
