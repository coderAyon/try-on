import { Router } from 'express';
import sharp from 'sharp';
const router = Router();

async function runCloudflareImageEdit(image: string, prompt: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw Error('Cloudflare Workers AI needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the server .env.');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw Error('Cloudflare image editing accepts PNG, JPG or WebP input.');
  const [, format, encoded] = match;
  // FLUX.2 Klein accepts reference images below 512x512. Downscale locally to
  // keep uploads within the model limit while preserving the original aspect ratio.
  const input = await sharp(Buffer.from(encoded, 'base64'), { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 511, height: 511, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  const outputScale = Math.max(1, 256 / Math.min(input.info.width, input.info.height));
  const outputWidth = Math.round(input.info.width * outputScale);
  const outputHeight = Math.round(input.info.height * outputScale);
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('guidance', '3.5');
  form.append('width', String(outputWidth));
  form.append('height', String(outputHeight));
  form.append('input_image_0', new Blob([input.data], { type: 'image/png' }), 'portrait.png');
  const model = process.env.CLOUDFLARE_IMG2IMG_MODEL || '@cf/black-forest-labs/flux-2-klein-4b';
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(170000),
  });
  if (!response.ok) throw Error('Cloudflare Workers AI could not prepare the image. Check the token, Account ID, model access and daily quota.');
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    const output = Buffer.from(await response.arrayBuffer());
    if (output.length) return `data:${contentType.split(';')[0]};base64,${output.toString('base64')}`;
  }
  const payload = await response.json().catch(() => ({})) as { success?: boolean; errors?: { message?: string }[]; result?: { image?: string | number[] } };
  if (payload.success === false) throw Error(payload.errors?.[0]?.message || 'Cloudflare Workers AI rejected this image.');
  const generated = payload.result?.image;
  if (typeof generated === 'string' && generated.startsWith('data:image/')) return generated;
  const generatedBytes = typeof generated === 'string'
    ? Buffer.from(generated, 'base64')
    : Array.isArray(generated) ? Buffer.from(generated) : null;
  if (generatedBytes?.length) {
    const metadata = await sharp(generatedBytes).metadata();
    const mime = metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format || 'png'}`;
    return `data:${mime};base64,${generatedBytes.toString('base64')}`;
  }
  throw Error('Cloudflare Workers AI returned no edited image.');
}

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
    // 1. Process and straighten via local computer vision engine
    const processed = await processAndStraightenFrame(bytes);
    const resultBase64 = `data:image/png;base64,${processed.toString('base64')}`;
    res.json({ image: resultBase64 });
  } catch (err: any) {
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
