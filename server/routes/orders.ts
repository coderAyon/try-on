import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

// POST /api/orders/checkout
router.post('/checkout', (req: Request, res: Response) => {
  try {
    const { customer, paymentMethod } = req.body;
    if (!customer || !customer.fullName || !customer.email || !customer.address) {
      return res.status(400).json({ success: false, error: 'Customer details and address are required' });
    }

    const order = db.createOrder({
      customer,
      paymentMethod: paymentMethod || 'Credit Card (Stripe Verified)',
    });

    res.json({
      success: true,
      message: 'Order placed successfully! Confirmation sent to email.',
      data: order,
    });
  } catch (err: unknown) {
    res.status(400).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/orders/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const order = db.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
