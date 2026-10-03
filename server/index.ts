import { createServer } from './server.js';

const PORT = process.env.PORT || 5000;
const app = createServer();

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🕶️  SUNGLASS HUT ENTERPRISE BACKEND SERVER`);
  console.log(`📡  API active at: http://127.0.0.1:${PORT}`);
  console.log(`🩺  Health check:  http://127.0.0.1:${PORT}/api/health`);
  console.log(`📦  Catalog API:   http://127.0.0.1:${PORT}/api/products`);
  console.log(`🧠  Advisor API:   http://127.0.0.1:${PORT}/api/recommendations/advisor`);
  console.log(`🛍️  Cart API:      http://127.0.0.1:${PORT}/api/cart`);
  console.log(`📍  Stores API:    http://127.0.0.1:${PORT}/api/stores`);
  console.log('====================================================');
});
