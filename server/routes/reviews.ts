import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

// GET /api/reviews/:productId
router.get('/:productId', (req: Request, res: Response) => {
  try {
    const reviews = db.getReviews(req.params.productId);
    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/reviews
router.post('/', (req: Request, res: Response) => {
  try {
    const { productId, author, rating, title, comment, faceShape } = req.body;
    if (!productId || !author || !rating || !comment) {
      return res.status(400).json({ success: false, error: 'Missing required review fields' });
    }

    const review = db.addReview({
      productId,
      author,
      rating: Number(rating),
      title: title || 'Great fit',
      comment,
      verifiedPurchase: true,
      faceShape: faceShape || 'Oval',
    });

    res.json({ success: true, message: 'Review submitted', data: review });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
