import { Router } from 'express';
import { Client, handle_file } from '@gradio/client';
import sharp from 'sharp';
const router = Router();

router.post('/prepare-portrait', (_req, res) => {
  res.status(410).json({ error: 'Portrait generation is disabled. Photo try-on preserves the original image and overlays eyewear locally.' });
});

export async function smartRemoveBackgroundLocally(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Check if image already has transparency (> 4% transparent)
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 200) transparentCount++;
  }
  if (transparentCount > (width * height * 0.04)) {
    return inputBuffer; // Already isolated
  }

  // Multi-seed corner and border samples
  const seedOffsets = [
    0, // Top-left
    Math.min(width - 1, 10) * channels,
    (width - 1) * channels, // Top-right
    ((height - 1) * width) * channels, // Bottom-left
    ((height - 1) * width + width - 1) * channels, // Bottom-right
    (Math.floor(height / 2) * width) * channels, // Mid-left
    (Math.floor(height / 2) * width + width - 1) * channels, // Mid-right
    Math.floor(width / 2) * channels, // Mid-top
    ((height - 1) * width + Math.floor(width / 2)) * channels // Mid-bottom
  ];

  const seeds = seedOffsets.map(idx => ({
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2]
  }));

  const isBg = (idx: number) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    for (const s of seeds) {
      const dr = r - s.r;
      const dg = g - s.g;
      const db = b - s.b;
      if ((dr * dr + dg * dg + db * db) < 3200) { // ~56 color distance threshold
        return true;
      }
    }
    return false;
  };

  // BFS Flood-fill from borders
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  for (let x = 0; x < width; x++) {
    if (isBg(x * channels)) { visited[x] = 1; queue[qTail++] = x; }
    const bot = (height - 1) * width + x;
    if (isBg(bot * channels)) { visited[bot] = 1; queue[qTail++] = bot; }
  }
  for (let y = 0; y < height; y++) {
    const left = y * width;
    if (!visited[left] && isBg(left * channels)) { visited[left] = 1; queue[qTail++] = left; }
    const right = y * width + width - 1;
    if (!visited[right] && isBg(right * channels)) { visited[right] = 1; queue[qTail++] = right; }
  }

  while (qHead < qTail) {
    const pos = queue[qHead++];
    const px = pos % width;
    const py = (pos / width) | 0;

    if (px > 0) {
      const n = pos - 1;
      if (!visited[n] && isBg(n * channels)) { visited[n] = 1; queue[qTail++] = n; }
    }
    if (px < width - 1) {
      const n = pos + 1;
      if (!visited[n] && isBg(n * channels)) { visited[n] = 1; queue[qTail++] = n; }
    }
    if (py > 0) {
      const n = pos - width;
      if (!visited[n] && isBg(n * channels)) { visited[n] = 1; queue[qTail++] = n; }
    }
    if (py < height - 1) {
      const n = pos + width;
      if (!visited[n] && isBg(n * channels)) { visited[n] = 1; queue[qTail++] = n; }
    }
  }

  // Clear alpha on visited background pixels
  for (let i = 0; i < visited.length; i++) {
    if (visited[i]) {
      data[i * channels + 3] = 0;
    }
  }

  // Clear enclosed cavity pixels inside lenses that match background seed
  for (let i = 0; i < visited.length; i++) {
    if (!visited[i] && isBg(i * channels)) {
      data[i * channels + 3] = 0;
    }
  }

  // Defringe border pixels to eliminate grey compression fringes
  const alphaSnapshot = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alphaSnapshot[i] = data[i * channels + 3];
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (alphaSnapshot[idx] > 0) {
        if (alphaSnapshot[idx - 1] === 0 || alphaSnapshot[idx + 1] === 0 ||
            alphaSnapshot[idx - width] === 0 || alphaSnapshot[idx + width] === 0) {
          data[idx * channels + 3] = Math.min(data[idx * channels + 3], 150);
        }
      }
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

export async function processAndStraightenFrame(inputBuffer: Buffer): Promise<Buffer> {
  const isolatedBuffer = await smartRemoveBackgroundLocally(inputBuffer);
  const image = sharp(isolatedBuffer).ensureAlpha();
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
    return sharp(isolatedBuffer).png().toBuffer();
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
    const rotated = await sharp(isolatedBuffer)
      .rotate(angleDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return sharp(rotated).trim().png().toBuffer();
  }

  // Otherwise return cleanly trimmed frame
  return sharp(isolatedBuffer)
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
  const normalized = await sharp(inputBuffer)
    .rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const client = await Client.connect(BRIA_SPACE, token ? { token } : undefined);
  try {
    const result = await client.predict('/image', [handle_file(normalized)]);
    const resultFile = Array.isArray(result.data) ? result.data[1] : undefined;
    const outputUrl = getSpaceOutputUrl(resultFile, client.config?.root || BRIA_SPACE_ORIGIN);
    const response = await fetch(outputUrl, {
      signal: AbortSignal.timeout(40_000),
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
      try {
        const token = process.env.HF_SPACE_TOKEN?.trim() || process.env.HF_TOKEN?.trim();
        // Allow ZeroGPU up to 25 seconds to allocate and run inference
        const zeroGpuPromise = removeFrameBackgroundWithZeroGpu(bytes, token);
        const timeoutPromise = new Promise<Buffer>((_, reject) =>
          setTimeout(() => reject(new Error('ZeroGPU connection timeout')), 25000)
        );
        const processed = await Promise.race([zeroGpuPromise, timeoutPromise]);
        const straightened = await processAndStraightenFrame(processed);
        res.json({
          image: `data:image/png;base64,${straightened.toString('base64')}`,
          model: 'briaai/BRIA-RMBG-2.0',
          provider: 'Hugging Face ZeroGPU · Bria',
        });
        return;
      } catch (aiErr) {
        console.warn('Hosted ZeroGPU background removal timed out or failed, seamlessly using local computer vision engine:', aiErr);
      }
    }

    // High-performance intelligent local segmentation engine
    const processed = await processAndStraightenFrame(bytes);
    const resultBase64 = `data:image/png;base64,${processed.toString('base64')}`;
    res.json({
      image: resultBase64,
      model: 'smart-local-segmentation',
      provider: 'Local Computer Vision Engine',
    });
  } catch (err: any) {
    console.error('Frame normalization error:', err);
    try {
      const fallback = await sharp(bytes).ensureAlpha().trim().png().toBuffer();
      res.json({ image: `data:image/png;base64,${fallback.toString('base64')}` });
    } catch {
      res.status(500).json({ error: 'Failed to process sunglasses image: ' + (err?.message || 'unknown') });
    }
  }
});

// Cloudflare Workers AI Photorealistic Inpainting & Neural Try-On Blend
router.post('/enhance', async (req, res) => {
  const { compositeImage, prompt, faceBox } = req.body || {};
  if (!compositeImage || typeof compositeImage !== 'string') {
    res.status(400).json({ error: 'compositeImage base64 is required.' });
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    res.status(503).json({ error: 'Cloudflare AI credentials not configured in .env' });
    return;
  }

  try {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(compositeImage);
    const base64Data = match ? match[2] : compositeImage;
    const inputBuffer = Buffer.from(base64Data, 'base64');

    const image = sharp(inputBuffer);
    const meta = await image.metadata();
    const width = meta.width || 800;
    const height = meta.height || 800;

    // Focus on face region with comfortable margin
    const box = faceBox || {
      left: Math.round(width * 0.15),
      top: Math.round(height * 0.15),
      width: Math.round(width * 0.70),
      height: Math.round(height * 0.70),
    };

    const cropLeft = Math.max(0, Math.min(width - 64, Math.round(box.left)));
    const cropTop = Math.max(0, Math.min(height - 64, Math.round(box.top)));
    const cropWidth = Math.min(width - cropLeft, Math.max(64, Math.round(box.width)));
    const cropHeight = Math.min(height - cropTop, Math.max(64, Math.round(box.height)));

    // Crop face region and resize to 512x512 for SD Inpainting
    const faceCrop = await sharp(inputBuffer)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .resize(512, 512, { fit: 'fill' })
      .png()
      .toBuffer();

    // Generate inpainting mask over the sunglasses/eye band
    const maskSvg = Buffer.from(`
      <svg width="512" height="512">
        <rect x="0" y="0" width="512" height="512" fill="black" />
        <rect x="50" y="145" width="412" height="150" rx="30" fill="white" />
      </svg>
    `);
    const maskPng = await sharp(maskSvg).png().toBuffer();

    const inpaintPrompt = prompt && typeof prompt === 'string' && prompt.trim()
      ? prompt.trim()
      : 'high fashion portrait photograph of a person wearing stylish luxury designer sunglasses, photorealistic, natural skin lighting, soft shadows on nose and cheeks, detailed eyes visible behind tinted glass, sharp focus, 8k';

    const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/runwayml/stable-diffusion-v1-5-inpainting`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: inpaintPrompt,
        negative_prompt: 'deformed, blurry, cartoon, drawing, distorted, bad sunglasses, solid purple eyes, artifacts',
        image: Array.from(faceCrop),
        mask: Array.from(maskPng),
        num_steps: 20,
        guidance: 7.5
      })
    });

    if (!cfResponse.ok) {
      const errText = await cfResponse.text();
      throw new Error(`Cloudflare Workers AI returned status ${cfResponse.status}: ${errText}`);
    }

    const inpaintArrayBuffer = await cfResponse.arrayBuffer();
    const inpaintBuffer = Buffer.from(inpaintArrayBuffer);

    // Resize inpaint result back to original crop size
    const resizedInpaint = await sharp(inpaintBuffer)
      .resize(cropWidth, cropHeight, { fit: 'fill' })
      .png()
      .toBuffer();

    // Composite back onto original high-res image
    const finalBuffer = await sharp(inputBuffer)
      .composite([{ input: resizedInpaint, left: cropLeft, top: cropTop }])
      .png()
      .toBuffer();

    res.json({
      success: true,
      image: `data:image/png;base64,${finalBuffer.toString('base64')}`,
      provider: 'Cloudflare Workers AI · Stable Diffusion Inpainting',
    });
  } catch (err: any) {
    console.error('AI Enhance error:', err);
    res.status(500).json({ error: err.message || 'AI Enhancement failed' });
  }
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
