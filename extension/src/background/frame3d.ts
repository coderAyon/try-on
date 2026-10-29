/**
 * Image-to-3D for product photos via the public Hunyuan3D-2 Hugging Face Space
 * (shape generation only; colour comes from the product photo in the mirror).
 * The product image the shopper clicked is uploaded to Hugging Face; nothing
 * from the camera is ever sent. Results are cached per image URL.
 */

const SPACE = 'https://tencent-hunyuan3d-2.hf.space';
const CACHE = 'lumen-frame-3d-v1';
const TIMEOUT_MS = 150_000;

/** fetch with its own deadline, so a sleeping or overloaded Space fails fast. */
async function fetchWithin(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    throw new Error(ctrl.signal.aborted ? `3D service did not respond (${new URL(url).pathname})` : String(err));
  } finally {
    clearTimeout(timer);
  }
}

const inflight = new Map<string, Promise<ArrayBuffer>>();

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('3D generation timed out')), ms); });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(timer); }
}

async function generate(imageUrl: string): Promise<ArrayBuffer> {
  const image = await fetch(imageUrl);
  if (!image.ok) throw new Error(`Could not read product image (${image.status})`);
  const blob = await image.blob();

  const form = new FormData();
  form.append('files', blob, 'frame' + (blob.type.includes('png') ? '.png' : '.jpg'));
  const uploaded = await (await fetchWithin(`${SPACE}/upload`, 25_000, { method: 'POST', body: form })).json();
  if (!Array.isArray(uploaded) || !uploaded[0]) throw new Error('3D service upload failed');

  const file = { path: uploaded[0], meta: { _type: 'gradio.FileData' } };
  // caption, image, 4 multi-view slots, steps, guidance, seed, octree, rembg, chunks, randomize
  const call = await (await fetchWithin(`${SPACE}/call/shape_generation`, 20_000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [null, file, null, null, null, null, 30, 5, 1234, 256, true, 8000, false] }),
  })).json();
  if (!call?.event_id) throw new Error('3D service did not accept the job');

  // Server-sent events; the response ends after the final event.
  const stream = await (await fetchWithin(`${SPACE}/call/shape_generation/${call.event_id}`, 120_000)).text();
  const done = stream.match(/event: complete\s*\ndata: (.*)/);
  if (!done) {
    const err = stream.match(/event: error\s*\ndata: (.*)/);
    throw new Error('3D service error: ' + (err?.[1] || 'busy or out of free quota'));
  }
  const out = JSON.parse(done[1])[0];
  const path = out?.value?.path ?? out?.path;
  if (!path) throw new Error('3D service returned no model');
  const glb = await fetchWithin(`${SPACE}/file=${path}`, 45_000);
  if (!glb.ok) throw new Error(`Could not download 3D model (${glb.status})`);
  return glb.arrayBuffer();
}

export async function getFrameModel(imageUrl: string): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE).catch(() => null);
  const key = `${SPACE}/lumen-cache?src=${encodeURIComponent(imageUrl)}`;
  const hit = await cache?.match(key);
  if (hit) return hit.arrayBuffer();

  let job = inflight.get(imageUrl);
  if (!job) {
    job = withTimeout(generate(imageUrl), TIMEOUT_MS).then(async buf => {
      await cache?.put(key, new Response(buf.slice(0), { headers: { 'Content-Type': 'model/gltf-binary' } }));
      return buf;
    }).finally(() => inflight.delete(imageUrl));
    inflight.set(imageUrl, job);
  }
  return job;
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 16384) {
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 16384))));
  }
  return btoa(chunks.join(''));
}
