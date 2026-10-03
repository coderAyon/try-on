import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

// GET /api/stores
router.get('/', (_req: Request, res: Response) => {
  try {
    const stores = db.getStores();
    res.json({ success: true, count: stores.length, data: stores });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/stores/:id/stock/:productId
router.get('/:id/stock/:productId', (req: Request, res: Response) => {
  try {
    const { id, productId } = req.params;
    const stockInfo = db.getStoreStock(id, productId);

    if (!stockInfo) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    res.json({
      success: true,
      data: stockInfo,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
