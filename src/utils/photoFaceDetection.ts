import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

type Face = NormalizedLandmark[];
type Box = { x: number; y: number; width: number; height: number };

function bounds(face: Face) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const point of face) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function mapFace(face: Face, crop: Box, imageWidth: number, imageHeight: number): Face {
  return face.map(point => ({
    ...point,
    x: (crop.x + point.x * crop.width) / imageWidth,
    y: (crop.y + point.y * crop.height) / imageHeight,
    z: point.z * crop.width / imageWidth,
  }));
}

function faceArea(face: Face) {
  const box = bounds(face);
  return box.width * box.height;
}

function selectDistinctFaces(faces: Face[]): Face[] {
  const distinct: Face[] = [];
  for (const face of [...faces].sort((a, b) => faceArea(b) - faceArea(a))) {
    const box = bounds(face);
    const duplicate = distinct.some(existing => {
      const other = bounds(existing);
      const overlapW = Math.max(0, Math.min(box.maxX, other.maxX) - Math.max(box.minX, other.minX));
      const overlapH = Math.max(0, Math.min(box.maxY, other.maxY) - Math.max(box.minY, other.minY));
      const intersection = overlapW * overlapH;
      const union = box.width * box.height + other.width * other.height - intersection;
      const centerDistance = Math.hypot((box.minX + box.maxX - other.minX - other.maxX) / 2, (box.minY + box.maxY - other.minY - other.maxY) / 2);
      return (union > 0 && intersection / union > 0.16) || centerDistance < Math.max(box.width, other.width) * 0.62;
    });
    if (!duplicate) distinct.push(face);
  }

  // A distant background face should not outvote the much larger foreground subject.
  if (distinct.length > 1 && faceArea(distinct[0]) >= faceArea(distinct[1]) * 2.5) return [distinct[0]];
  return distinct;
}

function canvasFor(image: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw Error('Photo analysis is unavailable in this browser.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function scanCrop(detector: FaceLandmarker, source: HTMLCanvasElement, crop: Box, maxSide = 1280, maxUpscale = 3): Face[] {
  const canvas = document.createElement('canvas');
  const scale = Math.min(maxUpscale, maxSide / Math.max(crop.width, crop.height));
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return [];
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return detector.detect(canvas).faceLandmarks.map(face => mapFace(face, crop, source.width, source.height));
}

function faceRefinementCrop(face: Face, width: number, height: number): Box | null {
  const box = bounds(face);
  if (box.width >= 0.14) return null;
  const side = Math.min(Math.min(width, height), Math.max(box.width * width, box.height * height) * 4.2);
  if (side < 32) return null;
  const centerX = (box.minX + box.maxX) * 0.5 * width;
  const centerY = (box.minY + box.maxY) * 0.5 * height;
  const x = Math.max(0, Math.min(width - side, centerX - side / 2));
  const y = Math.max(0, Math.min(height - side, centerY - side / 2));
  return { x, y, width: side, height: side };
}

/** Detect small/distant faces and return landmarks in full-photo normalized coordinates. */
export function detectPhotoFaces(detector: FaceLandmarker, image: HTMLImageElement): Face[] {
  const source = canvasFor(image, 2560);
  const full = scanCrop(detector, source, { x: 0, y: 0, width: source.width, height: source.height }, 2048);
  if (full.length) {
    const distinct = selectDistinctFaces(full);
    const refinement = faceRefinementCrop(distinct[0], source.width, source.height);
    if (distinct.length === 1 && refinement) {
      const refined = selectDistinctFaces(scanCrop(detector, source, refinement, 1536));
      if (refined.length === 1) return refined;
    }
    return distinct;
  }

  // Whole-body photos can leave a face below the full-image detector's useful
  // size. Search head-sized windows from the usual upper-body zone downwards.
  // Each small crop keeps a distant face large enough for mesh estimation.
  const tileSide = Math.min(source.width, source.height) * 0.15;
  const xCenters = [0.5, 0.36, 0.64, 0.22, 0.78, 0.08, 0.92];
  for (const yCenter of [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 0.96]) {
    const rowFaces: Face[] = [];
    for (const xCenter of xCenters) {
      const x = Math.max(0, Math.min(source.width - tileSide, xCenter * source.width - tileSide / 2));
      const y = Math.max(0, Math.min(source.height - tileSide, yCenter * source.height - tileSide / 2));
      rowFaces.push(...scanCrop(detector, source, { x, y, width: tileSide, height: tileSide }, 1024, 4));
    }
    const rowDistinct = selectDistinctFaces(rowFaces);
    if (rowDistinct.length) {
      if (rowDistinct.length === 1) {
        const refinement = faceRefinementCrop(rowDistinct[0], source.width, source.height);
        if (refinement) {
          const refined = selectDistinctFaces(scanCrop(detector, source, refinement, 1536));
          if (refined.length === 1) return refined;
        }
      }
      return rowDistinct;
    }
  }
  return [];
}
