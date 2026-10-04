import * as THREE from 'three';
import { FaceMeasurements, FaceShape, SunglassesProduct } from '../types';
import { Landmark, eyewearPose, landmarkWorld } from './landmarkEyewear';

export class FaceMeasurementSampler {
  private value: FaceMeasurements | undefined;
  reset() { this.value = undefined; }
  add(points: Landmark[], width: number, height: number): FaceMeasurements | undefined {
    const pose = eyewearPose(points, width, height);
    if (!pose) return undefined;
    const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
    const span = (a: number, b: number, axis: THREE.Vector3) => Math.abs(landmarkWorld(points[a], width, height).sub(landmarkWorld(points[b], width, height)).dot(axis));

    // Anatomical landmarks:
    // 234 & 454: Bizygomatic cheekbones (maximum facial width)
    // 58 & 288: Mandibular gonion / jaw angles (jaw width)
    // 54 & 284: Temples / forehead width
    // 10 & 152: Hairline to chin (morphological face height)
    const cheek = span(234, 454, xAxis);
    if (cheek < 12) return undefined;

    const jawAngle = span(58, 288, xAxis);
    const forehead = span(54, 284, xAxis);
    const faceHeight = span(10, 152, pose.yAxis);

    const raw = {
      heightToWidth: faceHeight / cheek,
      jawToCheek: jawAngle / cheek,
      foreheadToCheek: forehead / cheek,
      foreheadToJaw: forehead / (jawAngle || 1),
    };

    if (Object.values(raw).some(v => !Number.isFinite(v) || v < 0.25 || v > 2.5)) return undefined;

    const old = this.value;
    const smooth = (prev: number | undefined, curr: number) => (prev ? prev * 0.75 + curr * 0.25 : curr);

    const updatedHeightToWidth = smooth(old?.heightToWidth, raw.heightToWidth);
    const updatedJawToCheek = smooth(old?.jawToCheek, raw.jawToCheek);
    const updatedForeheadToCheek = smooth(old?.foreheadToCheek, raw.foreheadToCheek);
    const updatedForeheadToJaw = smooth(old?.foreheadToJaw, raw.foreheadToJaw);

    const classification = scoreFaceArchetypes({
      heightToWidth: updatedHeightToWidth,
      jawToCheek: updatedJawToCheek,
      foreheadToCheek: updatedForeheadToCheek,
      foreheadToJaw: updatedForeheadToJaw,
    });

    this.value = {
      heightToWidth: updatedHeightToWidth,
      jawToCheek: updatedJawToCheek,
      foreheadToCheek: updatedForeheadToCheek,
      foreheadToJaw: updatedForeheadToJaw,
      shape: classification.shape,
      confidence: classification.confidence,
      scores: classification.scores,
      samples: (old?.samples ?? 0) + 1,
      measuredAt: Date.now(),
    };

    return { ...this.value };
  }
}

export type FrameShape = 'Round' | 'Oval' | 'Square' | 'Flat' | 'Geometric' | 'Aviator';
const groups: Record<FrameShape, string[]> = {
  Round: ['rayban-round-metal', 'imported-obj-classic', 'imported-green-round', 'imported-pack-pink', 'imported-pack-green'],
  Oval: ['matsuda-m2026', 'imported-lis', 'imported-pack-white', 'imported-sunglass-2', 'imported-stylized-full'],
  Square: ['rayban-wayfarer-classic', 'prada-symbole', 'rayban-meta', 'imported-fano', 'imported-rayban-junior', 'imported-meta-quest', 'imported-meta-red', 'imported-mustang', 'imported-sunglass-3', 'imported-sunglass-original', 'imported-vuzix', 'imported-pack-blue', 'imported-pack-black'],
  Flat: ['oakley-radar-ev-path', 'imported-pixel', 'imported-stylized-brow', 'imported-sunglass-1', 'imported-sunglass-4', 'imported-fly'],
  Geometric: ['rayban-hexagonal-flat'], Aviator: ['rayban-aviator-classic', 'imported-pack-aviator'],
};

export function frameShape(product: SunglassesProduct): FrameShape {
  return (Object.keys(groups) as FrameShape[]).find(shape => groups[shape].includes(product.id)) ?? (product.category === 'Round' ? 'Round' : product.category === 'Aviator' ? 'Aviator' : 'Square');
}

/**
 * Computes comparative similarity scores for all 5 facial archetypes based on facial anthropometry.
 */
export function scoreFaceArchetypes(m: {
  heightToWidth: number;
  jawToCheek: number;
  foreheadToCheek: number;
  foreheadToJaw: number;
}): { shape: FaceShape; confidence: number; scores: Record<FaceShape, number> } {
  const { heightToWidth, jawToCheek, foreheadToCheek, foreheadToJaw } = m;
  const scores: Record<FaceShape, number> = { Oval: 0, Round: 0, Square: 0, Heart: 0, Diamond: 0 };

  // 1. Oval Score: elongated face (h/w >= 1.24), gently tapered jaw (0.75 - 0.84), forehead balanced
  let oval = 60;
  if (heightToWidth >= 1.24) oval += Math.min(25, (heightToWidth - 1.24) * 130);
  else oval -= (1.24 - heightToWidth) * 140;
  if (jawToCheek >= 0.75 && jawToCheek <= 0.84) oval += 15;
  else if (jawToCheek > 0.84) oval -= (jawToCheek - 0.84) * 120;
  if (foreheadToJaw >= 0.98 && foreheadToJaw <= 1.15) oval += 10;
  scores.Oval = Math.max(15, Math.min(98, Math.round(oval)));

  // 2. Round Score: balanced width/height (h/w < 1.22), soft rounded jaw, full cheekbones
  let round = 60;
  if (heightToWidth < 1.22) round += Math.min(25, (1.22 - heightToWidth) * 160);
  else round -= (heightToWidth - 1.22) * 120;
  if (jawToCheek < 0.84) round += 15;
  else round -= (jawToCheek - 0.84) * 140;
  if (foreheadToJaw >= 0.94 && foreheadToJaw <= 1.12) round += 10;
  scores.Round = Math.max(15, Math.min(98, Math.round(round)));

  // 3. Square Score: wide angular jaw (>= 0.85), broad forehead (>= 0.82), parallel sides
  let square = 50;
  if (jawToCheek >= 0.85) square += Math.min(30, (jawToCheek - 0.84) * 260);
  else square -= (0.85 - jawToCheek) * 180;
  if (foreheadToCheek >= 0.82) square += 15;
  if (heightToWidth <= 1.25) square += 10;
  else square -= (heightToWidth - 1.25) * 90;
  scores.Square = Math.max(15, Math.min(98, Math.round(square)));

  // 4. Heart Score: forehead visibly wider than jaw (foreheadToJaw >= 1.08), tapered chin
  let heart = 50;
  if (foreheadToJaw >= 1.08) heart += Math.min(30, (foreheadToJaw - 1.07) * 200);
  else heart -= (1.08 - foreheadToJaw) * 140;
  if (jawToCheek < 0.78) heart += 20 * (0.78 - jawToCheek) / 0.1;
  else heart -= (jawToCheek - 0.78) * 120;
  scores.Heart = Math.max(15, Math.min(98, Math.round(heart)));

  // 5. Diamond Score: high cheekbones dominant, both forehead and jaw clearly narrower
  let diamond = 50;
  if (foreheadToCheek < 0.78 && jawToCheek < 0.78) {
    diamond += 30 + (0.78 - foreheadToCheek) * 150 + (0.78 - jawToCheek) * 150;
  } else {
    diamond -= (Math.max(0, foreheadToCheek - 0.78) + Math.max(0, jawToCheek - 0.78)) * 140;
  }
  scores.Diamond = Math.max(15, Math.min(98, Math.round(diamond)));

  const sorted = (Object.entries(scores) as [FaceShape, number][]).sort((a, b) => b[1] - a[1]);
  return { shape: sorted[0][0], confidence: sorted[0][1], scores };
}

export function classifyFace(m: FaceMeasurements): FaceShape {
  if (m.shape) return m.shape;
  return scoreFaceArchetypes({
    heightToWidth: m.heightToWidth,
    jawToCheek: m.jawToCheek,
    foreheadToCheek: m.foreheadToCheek,
    foreheadToJaw: m.foreheadToJaw ?? (m.foreheadToCheek / (m.jawToCheek || 1)),
  }).shape;
}

export function getPersonalizedAdvice(shape: FaceShape, m: FaceMeasurements): { shapes: FrameShape[]; reason: string } {
  const hW = m.heightToWidth.toFixed(2);
  const jC = m.jawToCheek.toFixed(2);
  const fC = m.foreheadToCheek.toFixed(2);

  switch (shape) {
    case 'Oval':
      return {
        shapes: ['Square', 'Oval', 'Flat', 'Round'],
        reason: `Your face length (${hW}x width) is gracefully elongated with a balanced jaw-to-cheek taper (${jC}x). Square, browline, and classic oval frames harmonize seamlessly.`,
      };
    case 'Round':
      return {
        shapes: ['Square', 'Flat', 'Geometric'],
        reason: `Your facial length and cheek width are balanced (${hW}x) with softer cheekbone contours and rounded jaw (${jC}x). Angular, square, and geometric frames add instant architectural definition.`,
      };
    case 'Square':
      return {
        shapes: ['Round', 'Oval', 'Aviator'],
        reason: `Your jawline (${jC}x) and forehead (${fC}x) share strong, well-defined horizontal symmetry. Curved round, oval, and aviator lenses gracefully soften and complement the striking angles.`,
      };
    case 'Heart':
      return {
        shapes: ['Oval', 'Aviator', 'Round'],
        reason: `Your forehead is broader (${fC}x) with a delicate taper down toward a slender chin and jaw (${jC}x). Rounded, lower-weighted silhouettes like aviators bring perfect optical equilibrium.`,
      };
    case 'Diamond':
      return {
        shapes: ['Oval', 'Round', 'Flat'],
        reason: `Your sculpted cheekbones are the dramatic focal point, tapering toward both forehead (${fC}x) and jaw (${jC}x). Oval lenses and soft browline frames effortlessly accentuate your eyes.`,
      };
  }
}

export function suggestFrames(measurements: FaceMeasurements, products: SunglassesProduct[]) {
  const shape = classifyFace(measurements);
  const adviceData = getPersonalizedAdvice(shape, measurements);
  const ranked = products.map((product, order) => ({ product, shape: frameShape(product), order })).filter(item => adviceData.shapes.includes(item.shape)).sort((a, b) => adviceData.shapes.indexOf(a.shape) - adviceData.shapes.indexOf(b.shape) || a.order - b.order);
  // Include different silhouettes before filling the remaining preview slots.
  const diverse = adviceData.shapes.map(s => ranked.find(p => p.shape === s)).filter((p): p is typeof ranked[number] => !!p);
  const frames = [...diverse, ...ranked.filter(p => !diverse.includes(p))].slice(0, 6);
  return {
    shape,
    shapes: adviceData.shapes,
    reason: adviceData.reason,
    confidence: measurements.confidence ?? 92,
    scores: measurements.scores,
    frames,
  };
}
