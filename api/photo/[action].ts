import express from 'express';
import photoRouter from '../../server/routes/photo.js';

// Photo services must run on the server, rather than returning the SPA HTML.
const app = express();
app.use(express.json({ limit: '4mb' }));
app.use('/api/photo', photoRouter);
export default app;
