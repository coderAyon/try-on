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
    const cheek = span(234, 454, xAxis);
    if (cheek < 12) return undefined;
    const raw = { heightToWidth: span(10, 152, pose.yAxis) / cheek, jawToCheek: span(172, 397, xAxis) / cheek, foreheadToCheek: span(54, 284, xAxis) / cheek };
    if (Object.values(raw).some(v => !Number.isFinite(v) || v < .3 || v > 2)) return undefined;
    const old = this.value;
    this.value = { heightToWidth: old ? old.heightToWidth * .8 + raw.heightToWidth * .2 : raw.heightToWidth, jawToCheek: old ? old.jawToCheek * .8 + raw.jawToCheek * .2 : raw.jawToCheek, foreheadToCheek: old ? old.foreheadToCheek * .8 + raw.foreheadToCheek * .2 : raw.foreheadToCheek, samples: (old?.samples ?? 0) + 1, measuredAt: Date.now() };
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
export function classifyFace(m: FaceMeasurements): FaceShape {
  if (m.jawToCheek < .72 && m.foreheadToCheek > .88) return 'Heart';
  if (m.foreheadToCheek < .8 && m.jawToCheek < .8) return 'Diamond';
  if (m.jawToCheek >= .84 && m.heightToWidth < 1.38) return 'Square';
  if (m.heightToWidth < 1.18) return 'Round';
  return 'Oval';
}
const advice: Record<FaceShape, { shapes: FrameShape[]; reason: string }> = {
  Round: { shapes: ['Square', 'Flat', 'Geometric'], reason: 'Your face has a softer, wider outline. Square, flatter and geometric frames can add definition.' },
  Square: { shapes: ['Round', 'Oval', 'Aviator'], reason: 'Your jaw is relatively broad. Round and oval lenses can soften the angles.' },
  Oval: { shapes: ['Square', 'Oval', 'Flat', 'Round'], reason: 'Your face is longer than it is wide with a gently tapered jaw. Several shapes work; try square, oval or flatter frames.' },
  Heart: { shapes: ['Oval', 'Aviator', 'Round'], reason: 'Your forehead is wider relative to your jaw. Curved, lighter frames can balance that taper.' },
  Diamond: { shapes: ['Oval', 'Round', 'Flat'], reason: 'Your cheeks are wider relative to forehead and jaw. Oval lenses or a gentle browline can balance the outline.' },
};
export function suggestFrames(measurements: FaceMeasurements, products: SunglassesProduct[]) {
  const shape = classifyFace(measurements), recommendation = advice[shape];
  const ranked = products.map((product, order) => ({ product, shape: frameShape(product), order })).filter(item => recommendation.shapes.includes(item.shape)).sort((a, b) => recommendation.shapes.indexOf(a.shape) - recommendation.shapes.indexOf(b.shape) || a.order - b.order);
  // Include different silhouettes before filling the remaining preview slots.
  const diverse = recommendation.shapes.map(shape => ranked.find(p => p.shape === shape)).filter((p): p is typeof ranked[number] => !!p);
  const frames = [...diverse, ...ranked.filter(p => !diverse.includes(p))].slice(0, 6);
  return { shape, ...recommendation, frames };
}
