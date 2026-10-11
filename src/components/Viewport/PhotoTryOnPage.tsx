import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createFaceDetector } from '../../utils/faceDetector';
import { detectPhotoFaces } from '../../utils/photoFaceDetection';
import { loadEyewearCADModel } from '../../utils/cadModelManager';
import { EyewearRig, eyewearPose, landmarkWorld, faceSkullPose } from '../../utils/landmarkEyewear';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';
import { SunglassesProduct } from '../../types';
import { ProductThumbnail } from '../Catalog/ProductThumbnail';
import { ArrowLeft, Upload, Download, X, ImagePlus, Glasses, Sparkles, CheckCircle2, AlertTriangle, User, Globe, ScanFace, Maximize2 } from 'lucide-react';

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

function applyPhotographicClarity(ctx: CanvasRenderingContext2D, width: number, height: number, amount = 0.22) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    const w = width;
    const h = height;
    const k = amount;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = (row + x) * 4;
        const up = ((y - 1) * w + x) * 4;
        const down = ((y + 1) * w + x) * 4;
        const left = (row + x - 1) * 4;
        const right = (row + x + 1) * 4;
        for (let c = 0; c < 3; c++) {
          const val = copy[idx + c];
          const laplacian = 4 * val - copy[up + c] - copy[down + c] - copy[left + c] - copy[right + c];
          const delta = Math.max(-28, Math.min(28, laplacian * k));
          data[idx + c] = Math.min(255, Math.max(0, val + delta));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {}
}

function prepareCustomFrame(image: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw Error('Custom frame preview is unavailable.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Keep existing transparency. For product shots on a plain background,
  // remove only the connected background touching the image edges.
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = pixels;
  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 64) {
    if (data[i] < 245) { hasTransparency = true; break; }
  }
  if (!hasTransparency) {
    const w = canvas.width, h = canvas.height;
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
      .map(([x, y]) => ((y * w + x) * 4));
    const background = [0, 1, 2].map(channel => Math.round(corners.reduce((sum, i) => sum + data[i + channel], 0) / 4));
    const uniform = corners.every(i => Math.abs(data[i] - background[0]) < 34 && Math.abs(data[i + 1] - background[1]) < 34 && Math.abs(data[i + 2] - background[2]) < 34);
    if (uniform) {
      const visited = new Uint8Array(w * h);
      const queue = new Uint32Array(w * h);
      let head = 0, tail = 0;
      const add = (index: number) => {
        if (visited[index]) return;
        const pixel = index * 4;
        const distance = Math.abs(data[pixel] - background[0]) + Math.abs(data[pixel + 1] - background[1]) + Math.abs(data[pixel + 2] - background[2]);
        if (distance > 72) return;
        visited[index] = 1; queue[tail++] = index;
      };
      for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
      while (head < tail) {
        const index = queue[head++];
        const x = index % w, y = Math.floor(index / w);
        data[index * 4 + 3] = 0;
        if (x > 0) add(index - 1);
        if (x + 1 < w) add(index + 1);
        if (y > 0) add(index - w);
        if (y + 1 < h) add(index + w);
      }
      ctx.putImageData(pixels, 0, 0);
    }
  }
  return canvas;
}

function customFrameNeedsAngleCorrection(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width, right = 0, top = canvas.height, bottom = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (data[(y * canvas.width + x) * 4 + 3] > 16) {
      left = Math.min(left, x); right = Math.max(right, x + 1);
      top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) return false;

  const width = right - left;
  const counts = new Uint16Array(width);
  for (let x = left; x < right; x++) for (let y = top; y < bottom; y++) {
    if (data[(y * canvas.width + x) * 4 + 3] > 16) counts[x - left]++;
  }
  const smoothing = Math.max(1, Math.min(9, Math.round(width * 0.012)));
  const density = new Uint16Array(width);
  let peak = 0;
  for (let x = 0; x < width; x++) {
    let total = 0, n = 0;
    for (let j = Math.max(0, x - smoothing); j <= Math.min(width - 1, x + smoothing); j++) { total += counts[j]; n++; }
    density[x] = Math.round(total / n);
    peak = Math.max(peak, density[x]);
  }
  const threshold = Math.max(3, peak * 0.24);
  let first = -1, last = -1;
  for (let x = 0; x < width; x++) if (density[x] >= threshold) {
    if (first < 0) first = x;
    last = x + 1;
  }
  if (first < 0 || last <= first) return false;
  const frontCoverage = (last - first) / width;
  // A long, thin arm outside the dense two-lens body is a useful signal that
  // the product was shot obliquely and needs a generated front-view preview.
  return frontCoverage >= 0.48 && frontCoverage < 0.78;
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

function compositeCustomFrame(input: HTMLCanvasElement, frame: HTMLImageElement, points: { x: number; y: number }[], width: number, height: number) {
  const source = document.createElement('canvas');
  source.width = frame.naturalWidth; source.height = frame.naturalHeight;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })!;
  sourceCtx.drawImage(frame, 0, 0);
  const sourcePixels = sourceCtx.getImageData(0, 0, source.width, source.height).data;
  let left = source.width, top = source.height, right = 0, bottom = 0;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (sourcePixels[(y * source.width + x) * 4 + 3] > 16) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) throw Error('No visible sunglasses found in this image.');

  // Product photos often include thin temple arms that extend far behind the
  // lenses. They should not control the frame scale or its center on the face.
  // Use the dense, lens-bearing columns as the front-frame bounds, while
  // retaining the full alpha bounds for lightweight wire frames.
  const boundsWidth = right - left;
  const columnCounts = new Uint16Array(boundsWidth);
  for (let x = left; x < right; x++) for (let y = top; y < bottom; y++) {
    if (sourcePixels[(y * source.width + x) * 4 + 3] > 16) columnCounts[x - left]++;
  }
  const window = Math.max(1, Math.min(9, Math.round(boundsWidth * 0.012)));
  const denseColumns = new Uint16Array(boundsWidth);
  let maxColumnDensity = 0;
  for (let x = 0; x < boundsWidth; x++) {
    let total = 0, count = 0;
    for (let j = Math.max(0, x - window); j <= Math.min(boundsWidth - 1, x + window); j++) { total += columnCounts[j]; count++; }
    denseColumns[x] = Math.round(total / count);
    maxColumnDensity = Math.max(maxColumnDensity, denseColumns[x]);
  }
  const densityThreshold = Math.max(3, maxColumnDensity * 0.24);
  let frontLeft = -1, frontRight = -1;
  for (let x = 0; x < boundsWidth; x++) if (denseColumns[x] >= densityThreshold) {
    if (frontLeft < 0) frontLeft = x;
    frontRight = x + 1;
  }
  if (frontLeft >= 0 && frontRight > frontLeft) {
    const frontWidth = frontRight - frontLeft;
    const frontRatio = frontWidth / boundsWidth;
    if (frontRatio >= 0.48 && frontRatio <= 0.96) {
      left += frontLeft;
      right = left + frontWidth;
    }
  }

  let frontTop = source.height, frontBottom = 0;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    if (sourcePixels[(y * source.width + x) * 4 + 3] > 16) {
      frontTop = Math.min(frontTop, y);
      frontBottom = Math.max(frontBottom, y + 1);
    }
  }
  if (frontBottom > frontTop) { top = frontTop; bottom = frontBottom; }

  // Correct roll in the source product photo by comparing the opaque lens
  // mass on both sides of the bridge. This is a rigid 2D rotation, so it
  // preserves the manufacturer's actual frame and lens geometry.
  const frontWidth = right - left;
  const middle = left + frontWidth / 2;
  const centerGap = frontWidth * 0.08;
  let leftMass = 0, leftYMass = 0, rightMass = 0, rightYMass = 0;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    if (x > middle - centerGap && x < middle + centerGap) continue;
    const alpha = sourcePixels[(y * source.width + x) * 4 + 3];
    if (alpha <= 16) continue;
    if (x < middle) { leftMass += alpha; leftYMass += y * alpha; }
    else { rightMass += alpha; rightYMass += y * alpha; }
  }
  const measuredRoll = leftMass && rightMass
    ? Math.atan2(rightYMass / rightMass - leftYMass / leftMass, frontWidth * 0.5 - centerGap)
    : 0;
  const roll = Math.abs(measuredRoll) <= 0.38 ? measuredRoll : 0;
  const sourceWidth = right - left, sourceHeight = bottom - top;
  const absCos = Math.abs(Math.cos(roll)), absSin = Math.abs(Math.sin(roll));
  const asset = document.createElement('canvas');
  asset.width = Math.ceil(sourceWidth * absCos + sourceHeight * absSin) + 4;
  asset.height = Math.ceil(sourceWidth * absSin + sourceHeight * absCos) + 4;
  const assetCtx = asset.getContext('2d', { willReadFrequently: true })!;
  assetCtx.translate(asset.width / 2, asset.height / 2);
  assetCtx.rotate(-roll);
  assetCtx.drawImage(source, left, top, sourceWidth, sourceHeight, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
  const pixels = assetCtx.getImageData(0, 0, asset.width, asset.height).data;
  left = asset.width; top = asset.height; right = 0; bottom = 0;
  for (let y = 0; y < asset.height; y++) for (let x = 0; x < asset.width; x++) {
    if (pixels[(y * asset.width + x) * 4 + 3] > 16) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) throw Error('No visible sunglasses found in this image.');

  const eyePoint = (a: number, b: number) => ({ x: (points[a].x + points[b].x) * .5 * width, y: (points[a].y + points[b].y) * .5 * height });
  const leftEye = eyePoint(33, 133), rightEye = eyePoint(263, 362);
  const dx = rightEye.x - leftEye.x, dy = rightEye.y - leftEye.y;
  const eyeDistance = Math.hypot(dx, dy);
  if (eyeDistance < 8) throw Error('Could not measure both eyes for the custom frame.');
  const targetWidth = eyeDistance * 2.25;
  const targetHeight = targetWidth * (bottom - top) / (right - left);
  const centerX = (leftEye.x + rightEye.x) * .5;
  const centerY = (leftEye.y + rightEye.y) * .5 - targetHeight * .035;

  const composite = document.createElement('canvas'); composite.width = width; composite.height = height;
  const ctx = composite.getContext('2d')!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(input, 0, 0);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.shadowColor = 'rgba(18, 12, 28, .24)';
  ctx.shadowBlur = Math.max(1, eyeDistance * .025);
  ctx.shadowOffsetY = eyeDistance * .018;
  ctx.drawImage(asset, left, top, right - left, bottom - top, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
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
  const [customFrameNeedsAI, setCustomFrameNeedsAI] = useState(false);
  const [customFrameName, setCustomFrameName] = useState('');
  const [customFrameEnabled, setCustomFrameEnabled] = useState(false);
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameAiBusy, setFrameAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [variant, setVariant] = useState(0);
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'url' | 'models'>('upload');
  const [faceStatus, setFaceStatus] = useState<FaceVerificationStatus>('idle');
  const [photoAiBusy, setPhotoAiBusy] = useState(false);
  const [photoAiReady, setPhotoAiReady] = useState(false);
  const [photoAiNotice, setPhotoAiNotice] = useState('');

  const request = useRef(0);
  const activeRun = useRef(0);
  const urlRef = useRef<string | null>(null);
  const customFrameUrlRef = useRef<string | null>(null);
  const customFrameSourceUrlRef = useRef<string | null>(null);
  const customFrameSourceNeedsAIRef = useRef(false);
  const preparedPhotoSourceRef = useRef<string | null>(null);
  const preparedPhotoRef = useRef<string | null>(null);
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
      const prepared = prepareCustomFrame(image);
      const preparedBlob = await new Promise<Blob>((resolve, reject) => prepared.toBlob(value => value ? resolve(value) : reject(Error('Could not prepare the sunglasses image.')), 'image/png'));
      if (!isCurrent()) return;
      const nextUrl = URL.createObjectURL(preparedBlob);
      if (customFrameUrlRef.current) URL.revokeObjectURL(customFrameUrlRef.current);
      if (customFrameSourceUrlRef.current && customFrameSourceUrlRef.current !== customFrameUrlRef.current) URL.revokeObjectURL(customFrameSourceUrlRef.current);
      customFrameUrlRef.current = nextUrl;
      customFrameSourceUrlRef.current = nextUrl;
      const needsAngleCorrection = customFrameNeedsAngleCorrection(prepared);
      customFrameSourceNeedsAIRef.current = needsAngleCorrection;
      setCustomFrameUrl(nextUrl);
      setCustomFrameAiReady(false);
      setCustomFrameNeedsAI(needsAngleCorrection);
      setCustomFrameName(name);
      setCustomFrameEnabled(true);
      setResult(null); setFaceCropResult(null); setFaceCropOriginal(null); setError('');
    } finally { URL.revokeObjectURL(sourceUrl); }
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
    if (!sourceUrl) { setError('Load a sunglasses image before preparing its front view.'); return null; }
    const id = ++frameRequest.current;
    setFrameBusy(true); setFrameAiBusy(true); setError('');
    try {
      const source = await fetch(sourceUrl).then(response => response.blob());
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('Could not read the sunglasses image.'));
        reader.onerror = () => reject(Error('Could not read the sunglasses image.'));
        reader.readAsDataURL(source);
      });
      const response = await fetch('/api/photo/normalize-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
        signal: AbortSignal.timeout(180000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.image !== 'string') throw Error(data.error || 'AI could not prepare a front-facing sunglasses image.');
      const generated = await fetch(data.image).then(result => {
        if (!result.ok) throw Error('AI front view could not be decoded.');
        return result.blob();
      });
      const preparedImage = new Image();
      const generatedUrl = URL.createObjectURL(generated);
      try {
        preparedImage.src = generatedUrl;
        await preparedImage.decode();
        if (!preparedImage.naturalWidth || !preparedImage.naturalHeight) throw Error('AI returned an empty frame image.');
        const preparedCanvas = prepareCustomFrame(preparedImage);
        const preparedBlob = await new Promise<Blob>((resolve, reject) => preparedCanvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not prepare the AI front view.')), 'image/png'));
        if (id !== frameRequest.current) return null;
        const nextUrl = URL.createObjectURL(preparedBlob);
        const oldUrl = customFrameUrlRef.current;
        if (oldUrl && oldUrl !== customFrameSourceUrlRef.current) URL.revokeObjectURL(oldUrl);
        customFrameUrlRef.current = nextUrl;
        setCustomFrameUrl(nextUrl);
        setCustomFrameAiReady(true);
        setCustomFrameNeedsAI(false);
        setCustomFrameName(previous => previous.replace(/^AI front view · /, '').replace(/^AI front view of /, '').startsWith('AI front view')
          ? previous : `AI front view · ${previous}`);
        setResult(null); setFaceCropResult(null); setFaceCropOriginal(null);
        return nextUrl;
      } finally { URL.revokeObjectURL(generatedUrl); }
    } catch (e) {
      if (id === frameRequest.current) setError(e instanceof Error ? e.message : 'AI could not prepare this sunglasses image.');
      return null;
    } finally {
      if (id === frameRequest.current) setFrameBusy(false);
      setFrameAiBusy(false);
    }
  };

  const restoreCustomFrameSource = () => {
    frameRequest.current++;
    const sourceUrl = customFrameSourceUrlRef.current;
    if (!sourceUrl) return;
    if (customFrameUrlRef.current && customFrameUrlRef.current !== sourceUrl) URL.revokeObjectURL(customFrameUrlRef.current);
    customFrameUrlRef.current = sourceUrl;
    setCustomFrameUrl(sourceUrl);
    setCustomFrameAiReady(false);
    setCustomFrameNeedsAI(customFrameSourceNeedsAIRef.current);
    setCustomFrameName(previous => previous.replace(/^AI front view · /, '').replace(/^AI front view of /, ''));
    setResult(null); setFaceCropResult(null); setFaceCropOriginal(null); setError('');
  };

  const clearCustomFrame = () => {
    frameRequest.current++;
    if (customFrameUrlRef.current) URL.revokeObjectURL(customFrameUrlRef.current);
    if (customFrameSourceUrlRef.current && customFrameSourceUrlRef.current !== customFrameUrlRef.current) URL.revokeObjectURL(customFrameSourceUrlRef.current);
    customFrameUrlRef.current = null;
    customFrameSourceUrlRef.current = null;
    setCustomFrameUrl(null); setCustomFrameName(''); setCustomFrameEnabled(false);
    setCustomFrameAiReady(false); setFrameAiBusy(false);
    setCustomFrameNeedsAI(false); customFrameSourceNeedsAIRef.current = false;
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
    preparedPhotoSourceRef.current = null;
    preparedPhotoRef.current = null;
    setPhotoAiReady(false);
    setPhotoAiNotice('');
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
  const handleTryOn = async () => {
    if (!photo) {
      fileInputRef.current?.click();
      return;
    }

    if (customFrameEnabled && !customFrameUrl) {
      setError('Upload a sunglasses image or add its image link first.');
      return;
    }

    const runId = ++activeRun.current;
    setBusy(true);
    setPhotoAiBusy(false);
    setError('');

    let task: Awaited<ReturnType<typeof createFaceDetector>> | null = null;
    let rig: EyewearRig | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let env: THREE.WebGLRenderTarget | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.Material | null = null;
    let skullGeometry: THREE.BufferGeometry | null = null;
    let bgTexture: THREE.CanvasTexture | null = null;
    let shadowTexture: THREE.CanvasTexture | null = null;

    try {
      // Prepare each newly selected portrait once. The source photo stays local
      // and is retained as the before-image; only this explicit Try on action
      // sends it to the configured image API. If AI is unavailable, continue
      // with the original and the existing on-device landmark fitter.
      let fittingPhoto = photo;
      let aiCandidate: string | null = preparedPhotoSourceRef.current === photo ? preparedPhotoRef.current : null;
      setPhotoAiNotice('');
      if (!aiCandidate) {
        setPhotoAiBusy(true);
        try {
          const source = await fetch(photo).then(response => response.blob());
          const imageData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(Error('Could not read the portrait.'));
            reader.onerror = () => reject(Error('Could not read the portrait.'));
            reader.readAsDataURL(source);
          });
          const response = await fetch('/api/photo/prepare-portrait', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData }),
            signal: AbortSignal.timeout(180000),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && typeof data.image === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(data.image)) {
            aiCandidate = data.image;
          } else {
            setPhotoAiNotice(typeof data.error === 'string' ? `${data.error} Using the original photo.` : 'AI preparation is unavailable. Using the original photo.');
          }
        } catch {
          // The local fit remains usable when the optional server-side AI is unavailable.
          setPhotoAiNotice('AI preparation could not connect. Using the original photo.');
        } finally {
          setPhotoAiBusy(false);
        }
      }
      if (runId !== activeRun.current) return;
      if (aiCandidate) fittingPhoto = aiCandidate;

      const image = new Image();
      image.src = fittingPhoto;
      await image.decode();
      if (runId !== activeRun.current) return;

      // 1. Fast & accurate face landmark detection on optimized analysis buffer
      task = await createFaceDetector('IMAGE', 2);
      if (runId !== activeRun.current) return;

      let faces = detectPhotoFaces(task, image);
      if (faces.length !== 1 && aiCandidate) {
        // Reject an AI result that harms landmarkability and retry the exact
        // original upload instead. Never silently fit an ambiguous AI edit.
        fittingPhoto = photo;
        const originalImage = new Image();
        originalImage.src = photo;
        await originalImage.decode();
        if (runId !== activeRun.current) return;
        image.src = photo;
        await image.decode();
        if (runId !== activeRun.current) return;
        faces = detectPhotoFaces(task, image);
        setPhotoAiNotice('AI-prepared photo did not pass the face check. Fitting the original instead.');
      }
      if (faces.length !== 1) {
        throw Error(faces.length ? 'More than one person is visible. Use a photo where your face is the clear main subject.' : 'Could not locate enough facial detail. Try brighter light, a closer crop, or make sure the face is not blurred or covered.');
      }
      if (fittingPhoto === aiCandidate && aiCandidate) {
        preparedPhotoSourceRef.current = photo;
        preparedPhotoRef.current = aiCandidate;
        setPhotoAiReady(true);
        setPhotoAiNotice('AI-prepared photo passed the on-device face check.');
      } else {
        setPhotoAiReady(false);
      }
      const points = faces[0];

      // Calculate normalized face bounding box
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (let i = 0; i < 468; i++) {
        minX = Math.min(minX, points[i].x);
        maxX = Math.max(maxX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxY = Math.max(maxY, points[i].y);
      }
      const faceNormWidth = Math.max(0.08, maxX - minX);

      // 2. High-Definition Super-Sampling Dimension Calculation
      // Guarantee face region has at least 380px across for razor-sharp CAD geometry & curves
      const minScaleForFace = 380 / (faceNormWidth * image.naturalWidth);
      // Guarantee overall longest dimension is at least 2048px (unless original is already larger)
      const minScaleForRes = 2048 / Math.max(image.naturalWidth, image.naturalHeight);
      const targetSuperSample = Math.max(1, Math.min(3.0, Math.max(minScaleForFace, minScaleForRes)));
      const maxAllowedDim = 3840;
      const finalScale = Math.min(targetSuperSample, maxAllowedDim / Math.max(image.naturalWidth, image.naturalHeight));

      const width = Math.round(image.naturalWidth * finalScale);
      const height = Math.round(image.naturalHeight * finalScale);

      // Draw high-resolution base plate with high-quality bicubic smoothing
      const input = document.createElement('canvas');
      input.width = width;
      input.height = height;
      const ctx = input.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw Error('Photo processing unavailable.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);

      if (customFrameEnabled) {
        if (!customFrameUrl) throw Error('Upload a sunglasses image or add its image link first.');
        // Preserve front-facing assets. When the image shape shows a long
        // temple arm and foreshortened front, generate a front-view asset
        // before fitting so the side arm is not painted across the lenses.
        const fittedFrameUrl = customFrameAiReady
          ? customFrameUrl
          : customFrameNeedsAI
            ? await normalizeCustomFrameWithAI()
            : customFrameSourceUrlRef.current || customFrameUrl;
        if (!fittedFrameUrl || runId !== activeRun.current) return;
        const frameImage = new Image(); frameImage.src = fittedFrameUrl; await frameImage.decode();
        if (runId !== activeRun.current) return;
        const composite = compositeCustomFrame(input, frameImage, points, width, height);
        const compositeCtx = composite.getContext('2d', { willReadFrequently: true })!;
        applyPhotographicClarity(compositeCtx, width, height, 0.16);
        const outputs = createPhotoCrops(composite, input, points, width, height);
        if (runId === activeRun.current) {
          setResult(composite.toDataURL('image/png'));
          setFaceCropResult(outputs.fitted);
          setFaceCropOriginal(outputs.original);
          setViewMode('full');
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
        alpha: false, // Unified scene rendering: photo is in background, so MSAA blends directly against skin pixels!
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();

      // 5. High-Resolution Background Photo Quad (depthTest: false, toneMapped: false to preserve 100% true skin colors)
      bgTexture = new THREE.CanvasTexture(input);
      bgTexture.colorSpace = THREE.SRGBColorSpace;
      bgTexture.minFilter = THREE.LinearFilter;
      bgTexture.magFilter = THREE.LinearFilter;

      const bgMat = new THREE.MeshBasicMaterial({
        map: bgTexture,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), bgMat);
      bgMesh.position.set(0, 0, -1800);
      bgMesh.renderOrder = -100;
      scene.add(bgMesh);

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
      const fittedScale = rig.fittedScale(pose.eyeSpan, pose.faceWidth, pose.isFrontal);
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
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          points.slice(0, 468).flatMap((p) => {
            const w = landmarkWorld(p, width, height);
            w.addScaledVector(pose.zAxis, -pose.eyeSpan * .008);
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
      fCtx.drawImage(renderer.domElement, 0, 0);
      applyPhotographicClarity(fCtx, width, height, 0.22);
      const fullResultUrl = finalCanvas.toDataURL('image/png');

      // 13. Create the same HD face-focus crop for catalog CAD and custom images.
      const outputs = createPhotoCrops(finalCanvas, input, points, width, height);

      if (runId === activeRun.current) {
        setResult(fullResultUrl);
        setFaceCropResult(outputs.fitted);
        setFaceCropOriginal(outputs.original);
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
      bgTexture?.dispose();
      shadowTexture?.dispose();
      renderer?.dispose();
      if (runId === activeRun.current) {
        setBusy(false);
      }
    }
  };

  const enhance = async () => {
    if (!result) return;
    const id = request.current;
    setAiBusy(true);
    setError('');
    try {
      const response = await fetch('/api/photo/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: result }),
        signal: AbortSignal.timeout(180000),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'AI enhancement failed');
      if (id === request.current) setResult(data.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI enhancement unavailable');
    } finally {
      setAiBusy(false);
    }
  };

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

              <div className="photo-asset-preview">
                {photo ? (
                  <>
                    <img src={photo} alt="Face photo for try-on" />

                    {/* Floating face verification badge */}
                    {faceStatus === 'checking' && (
                      <div className="face-pill checking">
                        <Sparkles size={11} className="animate-spin" />
                        <span>Verifying face…</span>
                      </div>
                    )}
                    {faceStatus === 'detected' && (
                      <div className="face-pill valid">
                        <CheckCircle2 size={11} />
                        <span>{photoAiReady ? 'AI prepared · face verified' : 'Human Face Detected'}</span>
                      </div>
                    )}
                    {faceStatus === 'no_face' && (
                      <div className="face-pill no-face">
                        <AlertTriangle size={11} />
                        <span>No Face Detected</span>
                      </div>
                    )}

                    <button
                      className="photo-remove"
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
                      <X size={18} />
                    </button>
                    <span className="photo-filename">{filename}</span>

                    {/* Prominent warning if the user loaded sunglasses/non-face in this slot */}
                    {faceStatus === 'no_face' && (
                      <div className="face-alert-overlay">
                        <div className="flex items-start gap-2 text-left">
                          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[11px] font-bold text-red-100">Face not clear enough yet</p>
                            <p className="text-[10px] text-red-200/90 leading-tight mt-0.5">
                              Full-body photos work when the face is bright and sharp. If it is tiny, blurry, or covered, try a closer crop or a higher-resolution original. Sunglasses images go in <strong>2. Eyewear frame</strong>.
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
                      <label className="photo-placeholder cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <ImagePlus size={34} className="text-[#a855f7] transition-transform group-hover:scale-110" />
                        <strong className="text-white text-xs font-semibold">Upload face portrait</strong>
                        <span className="text-[11px] text-[#b3a4c8] leading-tight">Click to browse or drag your photo here</span>
                        <span className="text-[10px] text-[#8e7ea5]">Full-body photos work when the face is bright and sharp</span>
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
                    <label className="photo-upload-action">
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
                  <label className="photo-upload-action">
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
                )}
              </footer>
            </section>

            {/* 2. Eyewear frame card */}
            <section className="photo-asset-card">
              <header>
                <h2>2. Eyewear frame</h2>
                <span>{customFrameEnabled ? customFrameUrl ? customFrameAiReady ? 'AI FRONT VIEW' : 'CUSTOM IMAGE' : 'ADD IMAGE' : '3D READY'}</span>
              </header>

              <div className="photo-frame-source-tabs" role="tablist" aria-label="Eyewear source">
                <button type="button" role="tab" aria-selected={!customFrameEnabled} className={!customFrameEnabled ? 'active' : ''} onClick={() => setCustomFrameEnabled(false)}>
                  <Glasses size={12} /> Catalog 3D
                </button>
                <button type="button" role="tab" aria-selected={customFrameEnabled} className={customFrameEnabled ? 'active' : ''} onClick={() => setCustomFrameEnabled(true)}>
                  <ImagePlus size={12} /> Custom image
                </button>
              </div>

              {customFrameEnabled ? <div className="photo-asset-preview photo-frame-preview custom-frame-preview">
                {customFrameUrl ? <>
                  <img src={customFrameUrl} alt={`Custom sunglasses preview: ${customFrameName}`} />
                  <span className="photo-filename">{customFrameName}</span>
                  <button type="button" className="photo-remove" aria-label="Remove custom sunglasses image" onClick={clearCustomFrame}><X size={16} /></button>
                </> : <div className="custom-frame-empty"><Glasses size={34} /><strong>Add a sunglasses image</strong><span>Transparent PNG works best. Plain backgrounds are removed when possible.</span></div>}
              </div> : <div className="photo-asset-preview photo-frame-preview">
                <ProductThumbnail product={product} variantIndex={variant} />
                <span className="photo-filename">{product.name}</span>
              </div>}

              {customFrameEnabled && <div className="custom-frame-inputs">
                <label className="custom-frame-upload">
                  <Upload size={13} /> {frameBusy ? 'Loading image…' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={frameBusy} onChange={e => { loadCustomFrameFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <form onSubmit={e => { e.preventDefault(); loadCustomFrameLink(); }}>
                  <input type="url" value={frameLink} onChange={e => setFrameLink(e.target.value)} placeholder="Paste sunglasses image URL" aria-label="Sunglasses image URL" required />
                  <button type="submit" disabled={frameBusy || !frameLink.trim()}><Globe size={12} /> Load link</button>
                </form>
                <button type="button" className="custom-frame-ai-button" onClick={() => customFrameAiReady ? restoreCustomFrameSource() : void normalizeCustomFrameWithAI()} disabled={frameBusy || busy || !customFrameUrl}>
                  <Sparkles size={13} /> {frameBusy && frameAiBusy ? 'AI building front view…' : customFrameAiReady ? 'Restore original angle' : 'AI straighten side / top view'}
                </button>
                <p>{customFrameAiReady ? 'Review the AI front-view preview, then fit it to your eyes.' : customFrameNeedsAI ? 'This image is angled. Fit custom image will prepare a front view, then align it to your eyes.' : 'The front-facing frame shape is preserved and aligned to your eyes. You can still review AI straighten for side/top shots.'}</p>
              </div>}

              <footer>
                <span>{customFrameEnabled ? customFrameUrl ? customFrameAiReady ? 'AI front view ready · fit this image' : customFrameNeedsAI ? 'Angled view · AI prepares it during fit' : 'Original frame shape · ready to fit' : 'Choose a file or image link' : 'Inspect the frame · select below'}</span>
                <Glasses size={17} />
              </footer>
            </section>
          </div>

          {/* Settings card with Try On Action */}
          <section className="photo-settings-card">
            <h2>{customFrameEnabled ? 'Fit your custom sunglasses' : 'Make the look yours'}</h2>
            <p>{customFrameEnabled ? customFrameAiReady ? 'AI prepared a front-facing version. Review the frame preview, then fit it to your eyes.' : customFrameNeedsAI ? 'This image is angled, so AI will prepare a front view before aligning the frame to your eye landmarks.' : 'The original front-facing shape is preserved and aligned to your eye landmarks.' : 'Select your favorite 3D eyewear frame and finish, then click Try on to generate your photo.'}</p>

            {customFrameEnabled ? <div className="custom-frame-selection">
              <div><span>ACTIVE IMAGE</span><strong>{customFrameUrl ? customFrameName : 'Waiting for sunglasses image'}</strong></div>
              <button type="button" onClick={() => setCustomFrameEnabled(false)}>Use catalog frame</button>
            </div> : <div className="photo-setting-fields">
              <div>
                <label htmlFor="photo-frame">FRAME</label>
                <select
                  id="photo-frame"
                  value={product.id}
                  onChange={(e) => {
                    request.current++;
                    const p = products.find((item) => item.id === e.target.value);
                    if (p) {
                      setVariant(0);
                      onSelect(p);
                      setResult(null); // Reset result so user clicks "Try on" to generate with new frame
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

              <div>
                <label htmlFor="photo-finish">FINISH</label>
                <select
                  id="photo-finish"
                  value={variant}
                  onChange={(e) => {
                    request.current++;
                    setVariant(Number(e.target.value));
                    setResult(null); // Reset result so user clicks "Try on" to generate with new finish
                    setFaceCropResult(null);
                    setFaceCropOriginal(null);
                  }}
                >
                  {product.variants.map((v, i) => (
                    <option key={i} value={i}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>}

            {/* Prominent Try On CTA Button */}
            <div className="my-4">
              <button
                type="button"
                className="photo-tryon-button flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-bold text-sm shadow-lg shadow-violet-500/35 transition-all cursor-pointer border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                onClick={handleTryOn}
                disabled={busy || frameBusy || (customFrameEnabled && !customFrameUrl)}
              >
                <Sparkles size={18} />
                <span>{busy ? photoAiBusy ? 'AI preparing portrait…' : frameAiBusy ? 'AI correcting frame angle…' : 'Fitting frames on face…' : customFrameEnabled ? 'Fit custom image' : 'Try on'}</span>
              </button>
              {!photo && (
                <p className="text-[11px] text-[#b3a4c8] text-center mt-2">
                  Add your portrait photo first, then click <strong>Try on</strong>
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 text-xs text-[#b3a4c8] flex items-center gap-2.5">
              <Glasses size={18} className="text-violet-400 shrink-0" />
                <span className="leading-snug">
                  {customFrameEnabled ? 'Side-angle product photos are prepared to a front view before fitting; front-facing assets keep their original geometry.' : <>Frames are rendered from real 3D CAD models. Switch frames or finishes anytime and click <strong>Try on</strong>.</>}
              </span>
            </div>

            <p className="photo-privacy">
              {customFrameEnabled ? <>When you click <strong>Fit custom image</strong>, your portrait may be sent to the configured image AI for conservative preparation; an angled sunglasses image is sent for front-view correction. Face detection and final alignment run on your device. AI enhance sends the fitted image only when clicked.</> : <>When you click <strong>Try on</strong>, your portrait may be sent to the configured image AI for conservative photo preparation; face detection and fitting run on your device. If AI is unavailable, the original photo uses the local fitter. AI enhance sends the fitted image only when clicked.</>}
            </p>
            {photoAiNotice && <p className="photo-privacy" role="status">{photoAiNotice}</p>}
            {error && (
              <p className="photo-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>

        {/* Result Stage */}
        <section className="photo-result-card" aria-live="polite">
          <div className={`photo-result-stage ${zoom > 1 ? 'photo-result-zoomed' : ''}`}>
            <div className="photo-zoom-content" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, position: 'relative' }}>
              <div className="photo-result-labels">
                <span>ORIGINAL {viewMode === 'face' && faceCropOriginal ? '(FACE)' : ''}</span>
                <span>{result ? (viewMode === 'face' && faceCropResult ? 'FITTED FACE (HD)' : 'FITTED RESULT (HD)') : 'PREVIEW'}</span>
              </div>

              {photo ? (
                <>
                  <img
                    className="photo-result-image"
                    src={(viewMode === 'face' && faceCropResult ? faceCropResult : result) || photo}
                    alt={result ? `${product.name} fitted on your face` : 'Photo preview'}
                  />
                  {result && (
                    <>
                      <img
                        className="photo-result-original"
                        src={(viewMode === 'face' && faceCropOriginal ? faceCropOriginal : photo)!}
                        alt="Original for comparison"
                        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                      />
                      <div className="photo-split-line" style={{ left: `${split}%` }}>
                        <span>↔</span>
                      </div>
                      <input
                        className="photo-split-control"
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
                <div className="photo-result-empty">
                  <Glasses size={40} />
                  <h2>Your next look starts here</h2>
                  <p>Upload a face photo and click <strong>Try on</strong> to see your fitted result.</p>
                </div>
              )}
            </div>

            {(busy || aiBusy) && (
              <div className="photo-rendering" role="status">
                <span />
                {aiBusy ? 'AI enhancement in progress…' : 'Rendering Ultra-HD 3D CAD frames on face…'}
              </div>
            )}
          </div>

                  {photo && !result && !busy && (
                    <div className="photo-preview-action">
                      <button
                        onClick={handleTryOn}
                        disabled={frameBusy || (customFrameEnabled && !customFrameUrl)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-bold text-sm shadow-xl shadow-violet-500/40 border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Sparkles size={16} />
                        <span>{customFrameEnabled ? 'Fit custom image' : 'Try on'}</span>
                      </button>
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
                  <span>Face Focus (HD)</span>
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

            {/* AI / Extra Action button */}
            <div className="ml-auto">
              <button disabled={!result || busy || aiBusy} onClick={enhance} className="flex items-center gap-1.5">
                <Sparkles size={13} />
                <span>AI enhance</span>
              </button>
            </div>
          </div>

          <footer>
            <span className={result && !busy ? 'photo-result-ready' : ''}>
              ● {busy ? 'PROCESSING ULTRA-HD' : result ? 'RENDER READY · ULTRA HD PNG' : photo ? 'READY TO TRY ON' : 'WAITING FOR PHOTO'}
            </span>
            {result && !busy && (
              <div className="flex items-center gap-2">
                {faceCropResult && (
                  <a
                    className="photo-download secondary px-3 py-1.5 rounded-lg bg-violet-950/60 border border-violet-500/30 hover:border-violet-400 text-violet-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    href={faceCropResult}
                    download={`face-portrait-${product.id}.png`}
                    title="Download high-resolution face close-up"
                  >
                    <Download size={13} /> Face (HD)
                  </a>
                )}
                <a
                  className="photo-download px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-500/25 transition hover:brightness-110 cursor-pointer"
                  href={result}
                  download={`lumen-${product.id}.png`}
                  title="Download complete high-resolution try-on photo"
                >
                  <Download size={13} /> Full Photo (HD)
                </a>
              </div>
            )}
          </footer>
        </section>
      </div>
    </article>
  );
}
