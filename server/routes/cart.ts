import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

// GET /api/cart
router.get('/', (_req: Request, res: Response) => {
  try {
    const cart = db.getCart();
    res.json({ success: true, data: cart });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/cart/add
router.post('/add', (req: Request, res: Response) => {
  try {
    const { productId, variantIndex, size, quantity } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const updatedCart = db.addToCart(
      productId,
      variantIndex || 0,
      size || 'Standard (58mm)',
      quantity || 1
    );

    res.json({ success: true, message: 'Item added to bag', data: updatedCart });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/cart/update
router.put('/update', (req: Request, res: Response) => {
  try {
    const { itemId, quantity } = req.body;
    if (!itemId || quantity === undefined) {
      return res.status(400).json({ success: false, error: 'Item ID and quantity are required' });
    }

    const updatedCart = db.updateCartItem(itemId, quantity);
    res.json({ success: true, message: 'Cart updated', data: updatedCart });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/cart/item/:id
router.delete('/item/:id', (req: Request, res: Response) => {
  try {
    const updatedCart = db.removeFromCart(req.params.id);
    res.json({ success: true, message: 'Item removed from bag', data: updatedCart });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/cart/apply-coupon
router.post('/apply-coupon', (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Coupon code is required' });
    }

    const result = db.applyCoupon(code);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/cart/coupon
router.delete('/coupon', (_req: Request, res: Response) => {
  try {
    const updatedCart = db.removeCoupon();
    res.json({ success: true, message: 'Coupon removed', data: updatedCart });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
