import { FaceShape } from '../types';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculates Euclidean distance between two 3D landmarks
 */
export function euclideanDistance(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Estimate Interpupillary Distance (IPD) in millimeters.
 * Standard adult IPD ranges from 54mm to 74mm (average 63mm).
 * Uses landmark 33 (left outer corner) and 263 (right outer corner), or pupils 468, 473.
 */
export function estimateIpd(leftEye: Point3D, rightEye: Point3D, faceDepthRef: number = 1.0): number {
  const rawDist = euclideanDistance(leftEye, rightEye);
  // Normalize against reference depth/bounding scale
  const estimatedMm = Math.max(54, Math.min(74, rawDist * 280 * faceDepthRef));
  return Math.round(estimatedMm * 10) / 10;
}

/**
 * Calculates approximate Head Euler Angles (yaw, pitch, roll) in degrees from facial landmarks.
 * - Nose tip: landmark 1 or 4
 * - Chin: landmark 152
 * - Forehead: landmark 10
 * - Left eye corner: 33
 * - Right eye corner: 263
 */
export function computeHeadAngles(
  noseTip: Point3D,
  forehead: Point3D,
  chin: Point3D,
  leftTemple: Point3D,
  rightTemple: Point3D
): { yaw: number; pitch: number; roll: number } {
  // Roll: rotation in the 2D camera plane
  const dX = rightTemple.x - leftTemple.x;
  const dY = rightTemple.y - leftTemple.y;
  const roll = Math.atan2(dY, dX) * (180 / Math.PI);

  // Yaw: horizontal turning
  const midX = (leftTemple.x + rightTemple.x) / 2;
  const yawOffset = (noseTip.x - midX) / (Math.abs(dX) || 1);
  const yaw = Math.max(-60, Math.min(60, yawOffset * 90));

  // Pitch: vertical nodding
  const midY = (forehead.y + chin.y) / 2;
  const faceHeight = Math.abs(chin.y - forehead.y) || 1;
  const pitchOffset = (noseTip.y - midY) / faceHeight;
  const pitch = Math.max(-45, Math.min(45, pitchOffset * 70));

  return {
    yaw: Math.round(yaw * 10) / 10,
    pitch: Math.round(pitch * 10) / 10,
    roll: Math.round(roll * 10) / 10,
  };
}

/**
 * Heuristic face shape classifier for AI Fit Advisor
 */
export function classifyFaceShape(
  faceWidth: number,
  faceHeight: number,
  jawWidth: number,
  foreheadWidth: number
): { shape: FaceShape; confidence: number; explanation: string } {
  const ratio = faceHeight / (faceWidth || 1);
  const jawToForehead = jawWidth / (foreheadWidth || 1);

  if (ratio > 1.4) {
    return {
      shape: 'Oval',
      confidence: 94,
      explanation: 'Balanced proportions with softly rounded jawline and slightly narrower forehead.',
    };
  }

  if (ratio < 1.15) {
    if (jawToForehead > 0.9) {
      return {
        shape: 'Square',
        confidence: 91,
        explanation: 'Strong, defined angular jawline with width comparable to forehead.',
      };
    }
    return {
      shape: 'Round',
      confidence: 89,
      explanation: 'Equal facial length and width with soft angles and full cheekbones.',
    };
  }

  if (jawToForehead < 0.75) {
    return {
      shape: 'Heart',
      confidence: 88,
      explanation: 'Wider forehead tapering gracefully into a slender, delicate chin.',
    };
  }

  return {
    shape: 'Diamond',
    confidence: 87,
    explanation: 'Sculpted high cheekbones with narrower forehead and angular chin contour.',
  };
}
