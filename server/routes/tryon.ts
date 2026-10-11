import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

// POST /api/tryon/telemetry
router.post('/telemetry', (req: Request, res: Response) => {
  try {
    const { fps, ipdMm, faceWidthMm, headYaw, headPitch, headRoll, trackingConfidence } = req.body;
    db.logTelemetry({
      fps: fps || 60,
      ipdMm: ipdMm || 63,
      faceWidthMm: faceWidthMm || 139,
      headYaw: headYaw || 0,
      headPitch: headPitch || 0,
      headRoll: headRoll || 0,
      trackingConfidence: trackingConfidence || 98,
    });
    res.json({ success: true, message: 'Telemetry logged' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/tryon/save-look
router.post('/save-look', (req: Request, res: Response) => {
  try {
    const { productId, productName, variantName, dataUrl, ipdMm, faceShape } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ success: false, error: 'Snapshot image data is required' });
    }

    const savedLook = db.saveLook({
      productId: productId || 'unknown',
      productName: productName || 'Eyewear Style',
      variantName: variantName || 'Standard Finish',
      dataUrl,
      ipdMm: ipdMm || 63,
      faceShape: faceShape || 'Oval',
    });

    res.json({ success: true, message: 'Look saved to lookbook', data: savedLook });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/tryon/looks
router.get('/looks', (_req: Request, res: Response) => {
  try {
    const looks = db.getSavedLooks();
    res.json({ success: true, count: looks.length, data: looks });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/tryon/looks/:id
router.delete('/looks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteLook(id);
    res.json({ success: deleted, message: deleted ? 'Look deleted' : 'Look not found' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/tryon/looks
router.delete('/looks', (_req: Request, res: Response) => {
  try {
    db.clearLooks();
    res.json({ success: true, message: 'All looks cleared' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
