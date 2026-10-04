import { Router } from 'express';
const router = Router();
router.post('/enhance', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(503).json({ error: 'AI enhancement needs a server-side OPENAI_API_KEY. Your high-resolution fitted image remains available.' }); return; }
  const image = req.body?.image;
  if (typeof image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 35_000_000) { res.status(400).json({ error: 'Provide a PNG image smaller than 25 MB.' }); return; }
  try {
    const form = new FormData();
    form.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5');
    form.append('image', new Blob([Buffer.from(image.split(',')[1], 'base64')], { type: 'image/png' }), 'fitted.png');
    form.append('prompt', 'Enhance this eyewear try-on photograph with natural sharp detail and realistic lens reflections. Preserve the exact person, facial identity, expression, frame design, frame position, colors, clothing, background, composition and aspect ratio. Reduce blur without adding text or new objects.');
    form.append('quality', 'high'); form.append('size', 'auto'); form.append('input_fidelity', 'high');
    const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(170000) });
    const data = await response.json() as { data?: { b64_json?: string }[] };
    if (!response.ok || !data.data?.[0]?.b64_json) { res.status(502).json({ error: 'AI provider could not enhance this image. Check server model access, credentials and billing.' }); return; }
    res.json({ image: `data:image/png;base64,${data.data[0].b64_json}` });
  } catch { res.status(502).json({ error: 'AI enhancement timed out or could not connect. Your fitted image is still available.' }); }
});
router.get('/proxy', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || typeof imageUrl !== 'string') {
    res.status(400).json({ error: 'URL query parameter is required.' });
    return;
  }
  try {
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed.' });
      return;
    }
    const response = await fetch(parsed.href, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      res.status(response.status).json({ error: `Remote image returned HTTP status ${response.status}` });
      return;
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    res.status(502).json({ error: 'Could not retrieve remote image: ' + (err.message || 'Network error') });
  }
});

export default router;
