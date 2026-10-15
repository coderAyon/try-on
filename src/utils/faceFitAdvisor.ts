import * as THREE from 'three';
import { FaceMeasurements, FaceShape, SunglassesProduct } from '../types';
import { Landmark, eyewearPose, landmarkWorld } from './landmarkEyewear';

export class FaceMeasurementSampler {
  private value: FaceMeasurements | undefined;

  reset() {
    this.value = undefined;
  }

  current(): FaceMeasurements | undefined {
    return this.value ? { ...this.value } : undefined;
  }

  add(points: Landmark[], width: number, height: number, existingPose?: any): FaceMeasurements | undefined {
    const pose = existingPose ?? eyewearPose(points, width, height);
    if (!pose) return undefined;

    let cheek: number;
    let jaw: number;
    let forehead: number;
    let chin: number;
    let faceHeight: number;

    if (pose.surface && Array.isArray(pose.surface) && pose.surface.length >= 468) {
      // Direct 3D head-local surface coordinates (rotated to head space and normalized by eyeSpan)
      // Landmarks:
      // 234 & 454: Bizygomatic cheekbone peaks (maximum facial width)
      // 172 & 397: Mandibular gonial angles (jaw corners)
      // 132 & 361: Preauricular ramus / upper jaw contour
      // 103 & 332: Frontotemporal forehead / temples
      // 127 & 356: Temporal peaks
      // 148 & 377: Lateral chin contour
      // 10 & 152: Trichion (top of forehead) to menton (chin tip)
      const s = pose.surface;
      cheek = Math.abs(s[454].x - s[234].x);
      const jawGonion = Math.abs(s[397].x - s[172].x);
      const jawRamus = Math.abs(s[361].x - s[132].x);
      jaw = jawGonion * 0.7 + jawRamus * 0.3;

      const foreheadTemples = Math.abs(s[332].x - s[103].x);
      const foreheadOuter = Math.abs(s[356].x - s[127].x);
      forehead = foreheadTemples * 0.75 + foreheadOuter * 0.25;

      chin = Math.abs(s[377].x - s[148].x);
      faceHeight = Math.abs(s[10].y - s[152].y);
    } else {
      // 3D projected vectors along canonical head axes
      const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
      const yAxis = pose.yAxis ?? new THREE.Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
      const span = (a: number, b: number, axis: THREE.Vector3) =>
        Math.abs(landmarkWorld(points[a], width, height).sub(landmarkWorld(points[b], width, height)).dot(axis));

      cheek = span(234, 454, xAxis);
      jaw = span(172, 397, xAxis) * 0.7 + span(132, 361, xAxis) * 0.3;
      forehead = span(103, 332, xAxis) * 0.75 + span(127, 356, xAxis) * 0.25;
      chin = span(148, 377, xAxis);
      faceHeight = span(10, 152, yAxis);
    }

    if (cheek < 0.2) return undefined;

    const raw = {
      heightToWidth: faceHeight / (cheek || 1),
      jawToCheek: jaw / (cheek || 1),
      foreheadToCheek: forehead / (cheek || 1),
      foreheadToJaw: forehead / (jaw || 1),
      chinToJaw: chin / (jaw || 1),
    };

    // Filter anatomical anomalies (e.g. tracking glitch)
    if (
      !Number.isFinite(raw.heightToWidth) || raw.heightToWidth < 0.8 || raw.heightToWidth > 2.2 ||
      !Number.isFinite(raw.jawToCheek) || raw.jawToCheek < 0.45 || raw.jawToCheek > 1.3 ||
      !Number.isFinite(raw.foreheadToCheek) || raw.foreheadToCheek < 0.45 || raw.foreheadToCheek > 1.3
    ) {
      return undefined;
    }

    // Publish a fresh sample. Scan aggregation belongs to the advisor session,
    // never to the long-lived glasses tracker or a previous wearer.
    const classification = scoreFaceArchetypes(raw);
    this.value = { ...raw, ...classification, samples: 1, measuredAt: Date.now() };

    return { ...this.value };
  }
}

const ratioKeys = ['heightToWidth', 'jawToCheek', 'foreheadToCheek'] as const;
export function measurementsDiffer(a: FaceMeasurements, b: FaceMeasurements) {
  return ratioKeys.some(key => Math.abs(a[key] - b[key]) > (key === 'heightToWidth' ? .06 : .045))
    || Math.abs((a.chinToJaw ?? .44) - (b.chinToJaw ?? .44)) > .06;
}

// A bounded scan contains only fresh, consistent samples from this scan.
export class FaceMeasurementScan {
  private readings: FaceMeasurements[] = [];
  private lastTimestamp = 0;
  reset() { this.readings = []; this.lastTimestamp = 0; }
  get samples() { return this.readings.length; }
  add(sample: FaceMeasurements): FaceMeasurements | undefined {
    if (sample.measuredAt <= this.lastTimestamp) return undefined;
    if (this.lastTimestamp && sample.measuredAt - this.lastTimestamp > 1000) this.readings = [];
    this.lastTimestamp = sample.measuredAt;
    if (this.readings.length && measurementsDiffer(sample, this.readings[0])) this.readings = [];
    this.readings.push({ ...sample });
    if (this.readings.length > 12) this.readings.shift();
    if (this.readings.length < 12) return undefined;
    const median = (key: keyof FaceMeasurements) => {
      const values = this.readings.map(m => m[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a,b) => a-b);
      return values.length ? (values[Math.floor((values.length-1)/2)] + values[Math.floor(values.length/2)]) / 2 : undefined;
    };
    const ratios = {
      heightToWidth: median('heightToWidth')!, jawToCheek: median('jawToCheek')!,
      foreheadToCheek: median('foreheadToCheek')!, chinToJaw: median('chinToJaw'),
    };
    const raw = { ...ratios, foreheadToJaw: ratios.foreheadToCheek / ratios.jawToCheek };
    return { ...raw, ...scoreFaceArchetypes(raw), samples: this.readings.length, measuredAt: sample.measuredAt };
  }
}

// Keep sampling after a result. Proportion thresholds detect large changes,
// but cannot identify a person or decide whether future samples are needed.
export class LiveFaceAdvisor {
  private scan = new FaceMeasurementScan();
  private result: FaceMeasurements | null = null;
  private startedAt = 0;
  reset(now: number) { this.scan.reset(); this.result = null; this.startedAt = now; }
  update(sample: FaceMeasurements | undefined, faceDetected: boolean, now: number) {
    if (!faceDetected || !sample || now - sample.measuredAt >= 1000) {
      this.scan.reset(); this.result = null;
      return { measurement: null, progress: 0 };
    }
    if (sample.measuredAt <= this.startedAt) return { measurement: this.result, progress: 0 };
    if (this.result && measurementsDiffer(this.result, sample)) {
      this.result = null; this.scan.reset();
    }
    // Similar-looking people can fall on different sides of a shape boundary.
    // Refresh from the latest window even when no large ratio jump occurred.
    const fresh = this.scan.add(sample);
    if (fresh) this.result = fresh;
    return { measurement: this.result, progress: Math.round(this.scan.samples / 12 * 100) };
  }
}

export type FrameShape = 'Round' | 'Oval' | 'Square' | 'Flat' | 'Geometric' | 'Aviator';
const groups: Record<FrameShape, string[]> = {
  Round: ['imported-obj-classic', 'matsuda-m2026'],
  Oval: ['versace-ve4514d', 'imported-pack-white', 'imported-sunglass-2', 'imported-stylized-full'],
  Square: [
    'rayban-wayfarer-classic', 'prada-symbole', 'rayban-meta', 'imported-fano',
    'imported-rayban-junior', 'imported-meta-quest', 'imported-meta-red',
    'imported-mustang', 'imported-sunglass-3', 'imported-sunglass-original',
    'imported-vuzix', 'imported-pack-black'
  ],
  Flat: ['imported-pixel', 'imported-stylized-brow', 'imported-sunglass-1', 'imported-sunglass-4', 'imported-fly'],
  Geometric: [],
  Aviator: ['rayban-aviator-classic', 'imported-pack-aviator'],
};

export function frameShape(product: SunglassesProduct): FrameShape {
  const matched = (Object.keys(groups) as FrameShape[]).find(shape => groups[shape].includes(product.id));
  if (matched) return matched;
  if (product.category === 'Round') return 'Round';
  if (product.category === 'Aviator') return 'Aviator';
  if (product.category === 'Hexagonal') return 'Geometric';
  return 'Square';
}

/**
 * Computes comparative similarity scores for all 5 facial archetypes based on facial anthropometry.
 */
export function scoreFaceArchetypes(m: {
  heightToWidth: number;
  jawToCheek: number;
  foreheadToCheek: number;
  foreheadToJaw: number;
  chinToJaw?: number;
}): { shape: FaceShape; confidence: number; scores: Record<FaceShape, number> } {
  const { heightToWidth: hW, jawToCheek: jC, foreheadToCheek: fC, foreheadToJaw: fJ } = m;
  const cJ = m.chinToJaw ?? 0.44;

  // 1. Square:
  // Strong angular jaw (jC ~ 0.88), broad forehead (fC ~ 0.86),
  // balanced parallel temple-to-jaw ratio (fJ ~ 1.00), compact/moderate height (hW ~ 1.20),
  // broad blunt chin (cJ >= 0.48).
  const sqDist =
    Math.pow((jC - 0.88) / 0.07, 2) * 1.5 +
    Math.pow((fC - 0.86) / 0.08, 2) * 0.9 +
    Math.pow((fJ - 0.99) / 0.09, 2) * 1.1 +
    Math.pow((hW - 1.20) / 0.12, 2) * 0.8 +
    (cJ < 0.46 ? Math.pow((0.46 - cJ) / 0.05, 2) * 0.6 : 0);

  // 2. Round:
  // Compact face height (hW ~ 1.17, length roughly equals width),
  // soft rounded jawline (jC ~ 0.78, neither wide like square nor narrow like heart),
  // soft curved forehead (fC ~ 0.80), balanced forehead-to-jaw (fJ ~ 1.02),
  // softly rounded chin (cJ ~ 0.45).
  const rdDist =
    Math.pow((hW - 1.17) / 0.09, 2) * 1.6 +
    Math.pow((jC - 0.78) / 0.07, 2) * 1.1 +
    Math.pow((fC - 0.80) / 0.08, 2) * 0.8 +
    Math.pow((fJ - 1.02) / 0.09, 2) * 0.8 +
    (jC > 0.85 ? Math.pow((jC - 0.85) / 0.04, 2) * 1.2 : 0);

  // 3. Oval:
  // Elongated face (hW ~ 1.36, face length clearly exceeds width),
  // gently tapering jawline (jC ~ 0.77, narrower than cheekbones),
  // balanced forehead (fC ~ 0.82), forehead slightly wider than jaw (fJ ~ 1.06),
  // gracefully tapered chin (cJ ~ 0.44).
  const ovDist =
    Math.pow((hW - 1.36) / 0.10, 2) * 1.5 +
    Math.pow((jC - 0.77) / 0.06, 2) * 1.2 +
    Math.pow((fC - 0.82) / 0.07, 2) * 0.8 +
    Math.pow((fJ - 1.06) / 0.08, 2) * 0.9 +
    (hW < 1.24 ? Math.pow((1.24 - hW) / 0.06, 2) * 1.3 : 0);

  // 4. Heart (Inverted Triangle):
  // Wide forehead (fC ~ 0.88), tapering sharply down to a slender jaw (jC ~ 0.69),
  // high forehead-to-jaw ratio (fJ ~ 1.26), pointed narrow chin (cJ ~ 0.39),
  // medium to elongated height (hW ~ 1.30).
  const htDist =
    Math.pow((fJ - 1.24) / 0.10, 2) * 1.8 +
    Math.pow((jC - 0.69) / 0.06, 2) * 1.4 +
    Math.pow((fC - 0.88) / 0.07, 2) * 0.9 +
    Math.pow((hW - 1.30) / 0.12, 2) * 0.6 +
    (jC > 0.78 ? Math.pow((jC - 0.78) / 0.04, 2) * 1.4 : 0);

  // 5. Diamond:
  // Prominent cheekbones (dominant width), narrow forehead (fC ~ 0.73),
  // narrow jawline (jC ~ 0.68), moderate forehead-to-jaw ratio (fJ ~ 1.07),
  // pointed chin (cJ ~ 0.40), elongated or medium height (hW ~ 1.33).
  const dmDist =
    Math.pow((fC - 0.73) / 0.06, 2) * 1.5 +
    Math.pow((jC - 0.68) / 0.06, 2) * 1.5 +
    Math.pow((hW - 1.33) / 0.11, 2) * 0.8 +
    Math.pow((fJ - 1.07) / 0.10, 2) * 0.7 +
    (fC > 0.82 ? Math.pow((fC - 0.82) / 0.04, 2) * 1.4 : 0);

  // Convert distance to probability-style similarity percentage
  const toScore = (dist: number) => Math.max(0, Math.min(96, Math.round(96 * Math.exp(-dist / 2.8))));

  const scores: Record<FaceShape, number> = {
    Square: toScore(sqDist),
    Round: toScore(rdDist),
    Oval: toScore(ovDist),
    Heart: toScore(htDist),
    Diamond: toScore(dmDist),
  };

  // Rank unrounded distances; rounded display scores can tie for poor fits.
  const distances: Record<FaceShape, number> = { Square: sqDist, Round: rdDist, Oval: ovDist, Heart: htDist, Diamond: dmDist };
  const shape = (Object.keys(distances) as FaceShape[]).sort((a,b) => distances[a] - distances[b])[0];
  return { shape, confidence: scores[shape], scores };
}

export function classifyFace(m: FaceMeasurements): FaceShape {
  if (m.shape) return m.shape;
  return scoreFaceArchetypes({
    heightToWidth: m.heightToWidth,
    jawToCheek: m.jawToCheek,
    foreheadToCheek: m.foreheadToCheek,
    foreheadToJaw: m.foreheadToJaw ?? (m.foreheadToCheek / (m.jawToCheek || 1)),
    chinToJaw: m.chinToJaw,
  }).shape;
}

export function getPersonalizedAdvice(shape: FaceShape, m: FaceMeasurements): { shapes: FrameShape[]; reason: string } {
  const hW = m.heightToWidth.toFixed(2);
  const jC = m.jawToCheek.toFixed(2);
  const fC = m.foreheadToCheek.toFixed(2);

  switch (shape) {
    case 'Oval':
      return {
        shapes: ['Square', 'Oval', 'Aviator', 'Flat'],
        reason: `Your balanced face length (${hW}x width) and gently tapered jawline (${jC}x) provide exceptional styling versatility. Structured square frames, wayfarers, and aviators preserve your natural facial balance with refined sophistication.`,
      };
    case 'Round':
      return {
        shapes: ['Square', 'Flat', 'Geometric', 'Aviator'],
        reason: `Your facial length and cheek width are evenly balanced (${hW}x) with a soft jawline (${jC}x). Angular, rectangular, and geometric frames introduce crisp architectural lines that contrast soft curves and visually elongate your silhouette.`,
      };
    case 'Square':
      return {
        shapes: ['Round', 'Oval', 'Aviator'],
        reason: `Your strong, chiseled jawline (${jC}x) and broad forehead (${fC}x) define a confident profile. Rounded, curved, and oval frame silhouettes gracefully soften angular lines to achieve harmonious, modern balance.`,
      };
    case 'Heart':
      return {
        shapes: ['Aviator', 'Round', 'Oval'],
        reason: `Your broad forehead (${fC}x) gently tapers to a slender jaw and pointed chin (${jC}x). Aviators and rounded silhouettes with wider bottom profiles balance upper face width and draw soft focus downward.`,
      };
    case 'Diamond':
      return {
        shapes: ['Oval', 'Round', 'Flat'],
        reason: `Your sculpted cheekbones are the dramatic focal point, with a tapered forehead (${fC}x) and jawline (${jC}x). Gentle curves, oval contours, and browline silhouettes highlight your cheekbones while softening temple lines.`,
      };
  }
}

export function suggestFrames(measurements: FaceMeasurements, products: SunglassesProduct[]) {
  const shape = classifyFace(measurements);
  const adviceData = getPersonalizedAdvice(shape, measurements);
  const ranked = products
    .map((product, order) => {
      const fShape = frameShape(product);
      const isDirectMatch = product.suitableFaceShapes?.includes(shape) ? 1 : 0;
      return { product, shape: fShape, order, isDirectMatch };
    })
    .filter(item => adviceData.shapes.includes(item.shape))
    .sort((a, b) => {
      const rankA = adviceData.shapes.indexOf(a.shape);
      const rankB = adviceData.shapes.indexOf(b.shape);
      if (rankA !== rankB) return rankA - rankB;
      if (a.isDirectMatch !== b.isDirectMatch) return b.isDirectMatch - a.isDirectMatch;
      return a.order - b.order;
    });

  const recommendedShape = ranked[0]?.shape ?? adviceData.shapes[0] ?? null;
  const frames = ranked;
  return {
    shape,
    shapes: [...new Set(ranked.map(item => item.shape))],
    recommendedShape,
    reason: adviceData.reason,
    confidence: measurements.confidence ?? 0,
    scores: measurements.scores,
    frames,
  };
}
