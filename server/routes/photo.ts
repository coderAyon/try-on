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

router.post('/prepare-portrait', async (req, res) => {
  const cloudflareConfigured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const key = process.env.OPENAI_API_KEY;
  if (!cloudflareConfigured && !key) {
    res.status(503).json({ error: 'AI photo preparation needs CLOUDFLARE_ACCOUNT_ID plus CLOUDFLARE_API_TOKEN, or a server-side OPENAI_API_KEY. The local face fitter is still available.' });
    return;
  }
  const image = req.body?.image;
  const match = typeof image === 'string'
    ? /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image)
    : null;
  if (!match || image.length > 28_000_000) {
    res.status(400).json({ error: 'Provide a PNG, JPG or WebP portrait smaller than 20 MB.' });
    return;
  }
  const [, format, encoded] = match;
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    res.status(400).json({ error: 'Provide a PNG, JPG or WebP portrait smaller than 20 MB.' });
    return;
  }
  try {
    if (cloudflareConfigured) {
      const prompt = [
        'Conservatively improve this exact portrait for face landmark detection and virtual eyewear fitting.',
        'Preserve the same person, identity, facial geometry, pose, camera angle, expression, crop, aspect ratio, background, hair and clothing.',
        'Only make subtle exposure, white-balance, noise and sharpness corrections. Do not rotate the head, reconstruct hidden facial areas, beautify, or add eyewear.',
      ].join(' ');
      const output = await runCloudflareImageEdit(image, prompt);
      res.json({ image: output });
      return;
    }
    const form = new FormData();
    const mime = `image/${format}`;
    const extension = format === 'jpeg' ? 'jpg' : format;
    form.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5');
    form.append('image', new Blob([bytes], { type: mime }), `portrait.${extension}`);
    form.append('prompt', [
      'Prepare this exact uploaded photograph for a virtual eyewear try-on.',
      'Keep the same person and preserve their identity, facial proportions, skin tone, expression, age, hair, visible facial features, camera viewpoint, head pose, clothing, and background.',
      'Make only conservative photo corrections that improve face-landmark detection: correct image orientation, natural exposure and white balance, mild noise reduction, and mild sharpness.',
      'Do not turn the head to face forward, invent or reconstruct hidden facial features, alter the face, beautify, change the crop or perspective, add eyewear, or remove visible facial features.',
      'Return one realistic photograph with the same composition and aspect ratio. If a requested correction cannot be made without changing the person or viewpoint, preserve the input as closely as possible.',
    ].join(' '));
    form.append('quality', 'high');
    form.append('size', 'auto');
    form.append('input_fidelity', 'high');
    form.append('output_format', 'png');
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(170000),
    });
    const data = await response.json().catch(() => ({})) as { data?: { b64_json?: string }[] };
    if (!response.ok || !data.data?.[0]?.b64_json) {
      res.status(502).json({ error: 'AI could not safely prepare this portrait. The original photo remains available for local fitting.' });
      return;
    }
    res.json({ image: `data:image/png;base64,${data.data[0].b64_json}` });
  } catch {
    res.status(502).json({ error: 'AI photo preparation timed out or could not connect. The original photo remains available.' });
  }
});

router.post('/normalize-frame', async (req, res) => {
  const cloudflareConfigured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  const key = process.env.OPENAI_API_KEY;
  if (!key && !cloudflareConfigured) {
    res.status(503).json({ error: 'AI front-view needs Cloudflare Workers AI credentials or a server-side OPENAI_API_KEY. The original frame image is still available.' });
    return;
  }
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
    if (cloudflareConfigured) {
      const prompt = [
        'Create a clean product image of the exact sunglasses shown in this input, viewed straight-on from the front at eye level.',
        'Preserve the exact frame category, lens outlines, bridge width, rim thickness, tint, colors, materials and proportions; do not square off rounded lenses, change the frame style, or redesign details.',
        'Show both lenses symmetrically, with the front frame centered and level. Temple arms must stay behind the front frame and must never cross the lenses or forehead; hide them if necessary.',
        'If the input is already front-facing, preserve its geometry and appearance and only cleanly isolate it. If it is photographed from above, below or the side, make a natural frontal product view without adding unrelated parts.',
        'Use a perfectly plain white background with no gradients, pattern, text, person, extra objects or detached shadow. Show one complete pair of sunglasses only.',
      ].join(' ');
      const output = await runCloudflareImageEdit(image, prompt);
      res.json({ image: output });
      return;
    }
    const form = new FormData();
    const mime = `image/${format}`;
    const extension = format === 'jpeg' ? 'jpg' : format;
    form.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5');
    form.append('image', new Blob([bytes], { type: mime }), `sunglasses.${extension}`);
    form.append('prompt', [
      'Prepare the exact sunglasses in this input image for a virtual try-on.',
      'Create a clean, straight-on, front-facing orthographic catalog view, with the full left and right lenses, bridge, hinges, and both visible temple arms centered and level.',
      'If the input is already front-facing, preserve its existing geometry and only isolate the product cleanly.',
      'If it is photographed from the side, above, or at an angle, rotate the viewpoint to a natural frontal view and reconstruct only the hidden parts needed to show the complete pair.',
      'Preserve the recognizable frame silhouette, lens shape and tint, materials, colors, proportions, and visible brand details as closely as possible.',
      'Remove the background completely and output only the complete sunglasses on transparency. Do not include fragments, duplicate parts, a face, text, shadows detached from the frame, or extra objects.',
      'This is an eyewear product asset, not a person wearing glasses.',
    ].join(' '));
    form.append('quality', 'high');
    form.append('size', 'auto');
    form.append('input_fidelity', 'high');
    form.append('background', 'transparent');
    form.append('output_format', 'png');
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(170000),
    });
    const data = await response.json().catch(() => ({})) as { data?: { b64_json?: string }[] };
    if (!response.ok || !data.data?.[0]?.b64_json) {
      res.status(502).json({ error: 'AI could not create a clean front view from this angle. Try a clearer product image or a front-facing shot.' });
      return;
    }
    res.json({ image: `data:image/png;base64,${data.data[0].b64_json}` });
  } catch {
    res.status(502).json({ error: 'AI front-view timed out or could not connect. Your original image remains available.' });
  }
});

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
