import express from 'express';
import 'dotenv/config';
import photoRouter from './routes/photo.js';
import cors from 'cors';
import productsRouter from './routes/products.js';
import recommendationRouter from './routes/recommendation.js';
import cartRouter from './routes/cart.js';
import storesRouter from './routes/stores.js';
import tryonRouter from './routes/tryon.js';
import reviewsRouter from './routes/reviews.js';
import ordersRouter from './routes/orders.js';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logger for faculty/evaluator inspection
  app.use((req, _res, next) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'Sunglass Hut Virtual Try-On API Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      technologies: {
        runtime: 'Node.js',
        framework: 'Express',
        visionEngine: 'FittingBox Standard / MediaPipe 478-pt Mesh',
        renderEngine: 'WebGL Three.js PBR',
      },
    });
  });

  // API Route Mounts
  app.use('/api/products', productsRouter);
  app.use('/api/photo', photoRouter);
  app.use('/api/recommendations', recommendationRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/stores', storesRouter);
  app.use('/api/tryon', tryonRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/orders', ordersRouter);

  // 404 Fallback
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  return app;
}
