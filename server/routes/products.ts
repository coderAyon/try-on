import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

const router = Router();

// GET /api/products
router.get('/', (req: Request, res: Response) => {
  try {
    const { category, brand, faceShape, polarized, search } = req.query;

    const products = db.getProducts({
      category: typeof category === 'string' ? category : undefined,
      brand: typeof brand === 'string' ? brand : undefined,
      faceShape: typeof faceShape === 'string' ? faceShape : undefined,
      polarized: polarized !== undefined ? polarized === 'true' : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/products/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const product = db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/categories
router.get('/meta/categories', (_req: Request, res: Response) => {
  try {
    const products = db.getProducts();
    const categoriesMap: Record<string, number> = {};

    products.forEach((p) => {
      categoriesMap[p.category] = (categoriesMap[p.category] || 0) + 1;
    });

    const categories = Object.entries(categoriesMap).map(([name, count]) => ({
      name,
      count,
    }));

    res.json({ success: true, data: categories });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/brands
router.get('/meta/brands', (_req: Request, res: Response) => {
  try {
    const products = db.getProducts();
    const brandsMap: Record<string, number> = {};

    products.forEach((p) => {
      brandsMap[p.brand] = (brandsMap[p.brand] || 0) + 1;
    });

    const brands = Object.entries(brandsMap).map(([name, count]) => ({
      name,
      count,
    }));

    res.json({ success: true, data: brands });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
