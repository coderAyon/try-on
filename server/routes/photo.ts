import { Router } from 'express';
import { Client, handle_file } from '@gradio/client';
import sharp from 'sharp';
const router = Router();

router.post('/prepare-portrait', (_req, res) => {
  res.status(410).json({ error: 'Portrait generation is disabled. Photo try-on preserves the original image and overlays eyewear locally.' });
});

export async function processAndStraightenFrame(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 1. Detect Alpha Bounding Box
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = data[idx + 3];
      if (alpha > 20) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return sharp(inputBuffer).png().toBuffer();
  }

  const fullW = maxX - minX + 1;
  const fullH = maxY - minY + 1;
  const midX = (minX + maxX) * 0.5;

  // 2. Measure roll tilt between left lens mass and right lens mass
  let leftMass = 0, leftYMass = 0;
  let rightMass = 0, rightYMass = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 20) {
        if (x < midX) {
          leftMass += a;
          leftYMass += y * a;
        } else {
          rightMass += a;
          rightYMass += y * a;
        }
      }
    }
  }

  const leftY = leftMass > 0 ? leftYMass / leftMass : (minY + maxY) * 0.5;
  const rightY = rightMass > 0 ? rightYMass / rightMass : (minY + maxY) * 0.5;
  const roll = Math.atan2(rightY - leftY, fullW * 0.5);

  // If tilted by more than ~1 degree, rotate to level
  if (Math.abs(roll) > 0.018 && Math.abs(roll) < 0.35) {
    const angleDeg = (-roll * 180) / Math.PI;
    const rotated = await sharp(inputBuffer)
      .rotate(angleDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return sharp(rotated).trim().png().toBuffer();
  }

  // Otherwise return cleanly trimmed original frame
  return sharp(inputBuffer)
    .extract({ left: minX, top: minY, width: fullW, height: fullH })
    .png()
    .toBuffer();
}

const BRIA_SPACE = 'briaai/BRIA-RMBG-2.0';
const BRIA_SPACE_ORIGIN = 'https://briaai-bria-rmbg-2-0.hf.space';

function getSpaceOutputUrl(file: unknown, root: string): string {
  const value = typeof file === 'string'
    ? file
    : file && typeof file === 'object'
      ? ((file as { url?: unknown }).url || (file as { path?: unknown }).path)
      : null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Bria ZeroGPU returned no transparent image file.');
  }

  const url = /^https?:\/\//i.test(value)
    ? new URL(value)
    : value.startsWith('/gradio_api/file=') || value.startsWith('/file=')
      ? new URL(value, root)
      : new URL(`/gradio_api/file=${value}`, root);
  if (url.protocol !== 'https:' || url.hostname !== new URL(BRIA_SPACE_ORIGIN).hostname) {
    throw new Error('Bria ZeroGPU returned an unexpected file URL.');
  }
  return url.toString();
}

async function removeFrameBackgroundWithZeroGpu(inputBuffer: Buffer, token?: string): Promise<Buffer> {
  // Normalize EXIF orientation and cap the remote payload while keeping all
  // RGB pixels from the user's source image. The model supplies only alpha.
  const normalized = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const client = await Client.connect(BRIA_SPACE, token ? { token } : undefined);
  try {
    // The public Bria Space exposes its RMBG 2.0 cutout endpoint through Gradio.
    // Its transparent PNG preserves the source eyewear pixels; only its alpha
    // mask is inferred. This uses ZeroGPU's free daily quota, not paid providers.
    const result = await client.predict('/image', [handle_file(normalized)]);
    const resultFile = Array.isArray(result.data) ? result.data[1] : undefined;
    const outputUrl = getSpaceOutputUrl(resultFile, client.config?.root || BRIA_SPACE_ORIGIN);
    const response = await fetch(outputUrl, {
      signal: AbortSignal.timeout(60_000),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error(`Could not download the Bria ZeroGPU cutout (HTTP ${response.status}).`);
    const output = Buffer.from(await response.arrayBuffer());
    if (!output.length || output.length > 30 * 1024 * 1024) {
      throw new Error('Bria ZeroGPU returned an empty or oversized cutout.');
    }
    return await sharp(output).png().toBuffer();
  } finally {
    client.close();
  }
}

router.post('/normalize-frame', async (req, res) => {
  const image = req.body?.image;
  const match = typeof image === 'string'
    ? /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image)
    : null;
  if (!match || image.length > 28_000_000) {
    res.status(400).json({ error: 'Provide a PNG, JPG or WebP sunglasses image smaller than 20 MB.' });
    return;
  }
  const [, format, encoded] = match;
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    res.status(400).json({ error: 'Provide a PNG, JPG or WebP sunglasses image smaller than 20 MB.' });
    return;
  }

  try {
    if (req.body?.useAI) {
      const token = process.env.HF_SPACE_TOKEN?.trim() || process.env.HF_TOKEN?.trim();
      const processed = await removeFrameBackgroundWithZeroGpu(bytes, token);
      res.json({ image: `data:image/png;base64,${processed.toString('base64')}`, model: 'briaai/BRIA-RMBG-2.0', provider: 'Hugging Face ZeroGPU · Bria' });
      return;
    }
    // 1. Process and straighten via local computer vision engine
    const processed = await processAndStraightenFrame(bytes);
    const resultBase64 = `data:image/png;base64,${processed.toString('base64')}`;
    res.json({ image: resultBase64 });
  } catch (err: any) {
    if (req.body?.useAI) {
      const status = Number(err?.httpResponse?.status ?? err?.status ?? 0);
      const message = String(err?.message || '');
      if (status === 401 || status === 403 || /invalid.*token|unauthorized|authentication/i.test(message)) {
        res.status(502).json({ error: 'Hugging Face Space authentication failed. Use a valid token with read access to public Spaces, or clear HF_SPACE_TOKEN to try the shared anonymous quota.' });
        return;
      }
      if (status === 429 || /quota|zero.?gpu|capacity|too many requests/i.test(message)) {
        res.status(429).json({ error: 'Hugging Face ZeroGPU is busy or its free quota is used up. Wait and retry later; signed-in free accounts receive up to 5 GPU minutes per day.' });
        return;
      }
      if (/sleeping|starting|building|loading/i.test(message)) {
        res.status(503).json({ error: 'Bria ZeroGPU is starting up. Wait a minute, then try again.' });
        return;
      }
      res.status(502).json({ error: message || 'Bria ZeroGPU could not isolate the sunglasses. Retry with a clear product photo.' });
      return;
    }
    // Fallback: return trimmed original PNG
    try {
      const fallback = await sharp(bytes).png().toBuffer();
      res.json({ image: `data:image/png;base64,${fallback.toString('base64')}` });
    } catch {
      res.status(500).json({ error: 'Failed to process sunglasses image: ' + (err?.message || 'unknown') });
    }
  }
});

router.post('/enhance', (_req, res) => {
  res.status(410).json({ error: 'Portrait generation is disabled. Photo try-on preserves the original image and overlays eyewear locally.' });
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
