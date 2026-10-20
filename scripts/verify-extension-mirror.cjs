const puppeteer = require('puppeteer');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = process.cwd();
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      return res.end('<html><body>Local extension test</body></html>');
    }
    if (req.url === '/slow-frame.png') {
      res.setHeader('Content-Type', 'image/png');
      return setTimeout(() => fs.createReadStream(path.join(root, 'public/models/reference-frames/aviator.png')).pipe(res), 300);
    }
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : 'image/jpeg');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true, pipe: true, enableExtensions: [path.join(root, 'extension')],
    });
    const target = await browser.waitForTarget(t => t.type() === 'service_worker');
    const worker = await target.worker();
    const id = new URL(target.url()).host;
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base);
    // Test the same cross-origin iframe + transferred MessagePort as the mirror.
    const result = await page.evaluate(async ({ id, base }) => {
      const image = new Image(); image.src = base + '/public/models_faces/female_oval.jpg'; await image.decode();
      const frame = document.createElement('iframe');
      frame.src = `chrome-extension://${id}/dist/tracker/index.html`;
      document.body.appendChild(frame);
      await new Promise(resolve => frame.onload = resolve);
      const channel = new MessageChannel();
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tracker initialization timed out')), 25000);
        channel.port1.onmessage = async ({ data }) => {
          if (data.type === 'error') { clearTimeout(timer); reject(new Error(data.error)); }
          if (data.type === 'ready') {
            const bitmap = await createImageBitmap(image);
            channel.port1.postMessage({ type: 'frame', bitmap }, [bitmap]);
          }
          if (data.type === 'result') { clearTimeout(timer); resolve(data.result); }
        };
        frame.contentWindow.postMessage({ type: 'lumen-tracker-connect' }, `chrome-extension://${id}`, [channel.port2]);
      });
    }, { id, base });
    assert.ok(result?.detected, 'Local WASM tracker must detect a real face');
    assert.ok(result.eyeSpan > 0.05 && result.eyeSpan < 0.65, 'Must return actual eye separation');
    assert.ok(Number.isFinite(result.rollRad));
    assert.ok(worker);
    console.log('PASS: unpacked extension loads, cross-origin tracker connects, local WASM detects eyes', result);

    // Exercise the actual mirror with a deterministic video stream, without
    // opening the user's webcam or depending on lighting at test time.
    const bundle = require('esbuild').buildSync({
      entryPoints: [path.join(root, 'extension/src/content/inPageMirror.ts')],
      bundle: true, write: false, format: 'iife', globalName: 'MirrorTest',
    }).outputFiles[0].text;
    await page.addScriptTag({ content: bundle });
    await page.evaluate(async ({ id, base }) => {
      window.chrome.runtime = { id, getURL: p => `chrome-extension://${id}/${p}` };
      const face = new Image(); face.src = base + '/public/models_faces/female_oval.jpg'; await face.decode();
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(face, 0, 0, 640, 480);
      const stream = canvas.captureStream(15);
      const draw = setInterval(() => { ctx.drawImage(face, 0, 0, 640, 480); }, 65);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => stream });
      window.mirrorStream = { canvas, draw, stream };
      await MirrorTest.inPageMirror.open({ frame: base + '/public/models/reference-frames/aviator.png' });
    }, { id, base });
    await page.waitForFunction(() => MirrorTest.inPageMirror.landmarks.available && MirrorTest.inPageMirror.hasFittedOnce, { timeout: 25000 });
    const fit = await page.evaluate(() => {
      const m = MirrorTest.inPageMirror;
      return { x: m.smoothX, y: m.smoothY, width: m.smoothWidth, geom: m.frameGeom };
    });
    assert.ok(fit.geom && fit.width > 50 && fit.width < 640);
    assert.ok(fit.x > 150 && fit.x < 500);
    await page.evaluate(() => {
      const { canvas } = window.mirrorStream;
      const ctx = canvas.getContext('2d');
      clearInterval(window.mirrorStream.draw);
      ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      window.mirrorStream.draw = setInterval(() => ctx.fillRect(0, 0, canvas.width, canvas.height), 65);
    });
    await page.waitForFunction(() => !MirrorTest.inPageMirror.hasFittedOnce, { timeout: 5000 });
    await page.evaluate(async base => {
      const m = MirrorTest.inPageMirror;
      const oldFrame = m.loadAndProcessFrame(base + '/slow-frame.png');
      const newest = document.createElement('canvas'); newest.width = 240; newest.height = 80;
      const c = newest.getContext('2d'); c.fillStyle = '#333';
      c.fillRect(10, 10, 90, 60); c.fillRect(140, 10, 90, 60); c.fillRect(100, 15, 40, 10);
      await m.loadAndProcessFrame(newest.toDataURL());
      const selected = m.cutoutCanvas;
      await oldFrame;
      if (selected !== m.cutoutCanvas) throw new Error('An older image replaced the selected frame');
      m.adjustScale(0.4); m.userOffsetX = 80;
      await m.open({ frame: newest.toDataURL() });
      if (m.userScale !== 1 || m.userOffsetX !== 0) throw new Error('Frame switching kept previous calibration');
    }, base);
    const cleanup = await page.evaluate(() => {
      const m = MirrorTest.inPageMirror;
      const image = document.createElement('canvas'); image.width = 400; image.height = 220;
      const c = image.getContext('2d');
      c.fillStyle = '#222'; c.fillRect(40, 20, 130, 70); c.fillRect(230, 20, 130, 70); c.fillRect(160, 25, 80, 10);
      c.fillStyle = '#ddd'; c.fillRect(40, 140, 130, 50); c.fillRect(230, 140, 130, 50);
      const cutout = m.removeBackground(image);
      const geom = m.analyzeEyewearGeometry(cutout);
      m.close(); clearInterval(window.mirrorStream.draw);
      return { height: cutout.height, width: cutout.width, bridgeX: geom.bridge.x, lensSpan: geom.lensSpan };
    });
    assert.ok(cleanup.height < 100, 'Detached tabletop reflection must be removed');
    assert.ok(Math.abs(cleanup.bridgeX - cleanup.width / 2) < 3, 'Symmetric lenses must have a centred optical anchor');
    assert.ok(cleanup.lensSpan > 150, 'Lens centres must span the two lenses');
    console.log('PASS: eye fitting, face loss, image-load race, calibration reset, reflection cleanup, optical centring', fit, cleanup);
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
