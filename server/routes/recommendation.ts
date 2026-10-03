import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

interface BiometricPayload {
  faceHeightToWidthRatio?: number;
  jawToCheekRatio?: number;
  foreheadToCheekRatio?: number;
  ipdMm?: number;
  faceWidthMm?: number;
}

// POST /api/recommendations/advisor
router.post('/advisor', (req: Request, res: Response) => {
  try {
    const payload: BiometricPayload = req.body || {};

    const ratio = payload.faceHeightToWidthRatio || 1.35;
    const jawRatio = payload.jawToCheekRatio || 0.88;
    const foreheadRatio = payload.foreheadToCheekRatio || 0.95;
    const ipd = payload.ipdMm || 63;

    // Biometric Face Shape Classification Algorithm
    let faceShape = 'Oval';
    let reasoning = '';
    let frameAdvice = '';

    if (ratio < 1.25) {
      if (jawRatio > 0.92) {
        faceShape = 'Square';
        reasoning = 'Strong, angular jawline with width approximately equal to facial length.';
        frameAdvice = 'Soft, rounded or curved silhouettes (Round Metal, Aviator) to soften angular jaw lines.';
      } else {
        faceShape = 'Round';
        reasoning = 'Soft curves with similar facial width and length, gentle cheek fullness.';
        frameAdvice = 'Angular, geometric frames (Wayfarer, Hexagonal) to add structure and contrast.';
      }
    } else if (ratio > 1.45) {
      faceShape = 'Diamond';
      reasoning = 'Dramatic cheekbone prominence tapering to a defined chin and slender forehead.';
      frameAdvice = 'Top-heavy or cat-eye shapes (Clubmaster, Aviator) to accentuate high cheekbones.';
    } else {
      if (jawRatio < 0.78 && foreheadRatio > 0.95) {
        faceShape = 'Heart';
        reasoning = 'Broad forehead gently tapering to a delicate, pointed chin.';
        frameAdvice = 'Light-rimmed or bottom-heavy designs (Aviator, Round) to balance upper facial width.';
      } else {
        faceShape = 'Oval';
        reasoning = 'Harmonious facial proportions with subtle curve tapering gently toward the chin.';
        frameAdvice = 'Versatile icon shapes (Aviator, Wayfarer, Hexagonal) fit effortlessly on balanced contours.';
      }
    }

    // IPD sizing recommendation
    let recommendedSize = 'Standard (58mm)';
    if (ipd > 66) {
      recommendedSize = 'Large (62mm)';
    } else if (ipd < 60) {
      recommendedSize = 'Small / Standard (50-54mm)';
    }

    // Fetch and rank matching products
    const allProducts = db.getProducts();
    const rankedProducts = allProducts.map((product) => {
      const isSuitable = product.suitableFaceShapes.includes(faceShape);
      const matchScore = isSuitable ? 95 + Math.floor(Math.random() * 4) : 75 + Math.floor(Math.random() * 10);
      return {
        ...product,
        matchScore,
        matchExplanation: isSuitable
          ? `Engineered for ${faceShape} profiles: contrasts your contours with balanced geometry.`
          : `Can be styled on ${faceShape} contours with an oversized silhouette preference.`,
      };
    });

    rankedProducts.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      analysis: {
        detectedFaceShape: faceShape,
        scientificReasoning: reasoning,
        stylingAdvice: frameAdvice,
        biometrics: {
          ipdMm: ipd,
          recommendedSize,
          aspectRatio: Math.round(ratio * 100) / 100,
        },
      },
      recommendedFrames: rankedProducts,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
