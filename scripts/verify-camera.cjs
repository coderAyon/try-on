const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  let browser = await puppeteer.launch({ executablePath, headless: true });
  const file = path.resolve('scratch/fit-sample.y4m');
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000');
    const data = await page.evaluate(async () => {
      const image = new Image(); image.src = '/models_faces/female_oval.jpg'; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#cccccc'; ctx.fillRect(0, 0, 640, 480);
      const scale = Math.min(640 / image.width, 480 / image.height);
      ctx.drawImage(image, (640 - image.width * scale) / 2, 0, image.width * scale, image.height * scale);
      const rgba = ctx.getImageData(0, 0, 640, 480).data;
      let binary = ''; for (let i = 0; i < rgba.length; i++) binary += String.fromCharCode(rgba[i]);
      return btoa(binary);
    });
    const rgba = Buffer.from(data, 'base64'); const w = 640, h = 480;
    const yuv = Buffer.alloc(w * h * 1.5);
    const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      yuv[y * w + x] = clamp(16 + .257 * r + .504 * g + .098 * b);
      if (!(x % 2) && !(y % 2)) {
        const j = (y / 2) * (w / 2) + x / 2;
        yuv[w * h + j] = clamp(128 - .148 * r - .291 * g + .439 * b);
        yuv[w * h * 1.25 + j] = clamp(128 + .439 * r - .368 * g - .071 * b);
      }
    }
    const handle = fs.openSync(file, 'w');
    fs.writeSync(handle, 'YUV4MPEG2 W640 H480 F30:1 Ip A1:1 C420jpeg\n');
    for (let i = 0; i < 60; i++) { fs.writeSync(handle, 'FRAME\n'); fs.writeSync(handle, yuv); }
    fs.closeSync(handle);
    await browser.close();
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + file, '--autoplay-policy=no-user-gesture-required'] });
    const cameraPage = await browser.newPage(); await cameraPage.setViewport({ width: 1366, height: 950 });
    const errors = []; cameraPage.on('pageerror', error => errors.push(error.stack));
    cameraPage.on('console', msg => { if (msg.type() === 'error' || /context.*lost|too many active/i.test(msg.text())) console.log('Browser:', msg.text()); });
    await cameraPage.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await cameraPage.waitForSelector('#landmarkCameraCanvas', { timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 12000));
    await cameraPage.screenshot({ path: path.resolve('scratch/eyewear-camera.png') });
    const body = await cameraPage.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log(body);
    if (!body.includes('Aviator') && !body.includes('AVIATOR')) throw new Error('App did not render');
    if (!body.includes('Face tracking')) throw new Error('Sample face was not detected');
    const requestedModel = process.argv.find(arg => arg.startsWith('--model='))?.slice(8);
    if (process.argv.includes('--all-models') || requestedModel) {
      let products = await cameraPage.evaluate(async () => {
        const { SUNGLASSES_CATALOG } = await import('/src/data/catalog.ts');
        const remote = await fetch('http://localhost:5000/api/products').then(r => r.json());
        const merged = [...(Array.isArray(remote) ? remote : remote.data ?? [])];
        for(const product of SUNGLASSES_CATALOG) if(!merged.some(p => p.id === product.id)) merged.push(product);
        return merged.map(p => ({ id: p.id, name: p.name }));
      });
      if (requestedModel) products = products.filter(product => product.id === requestedModel);
      for (const product of products) {
        const clicked = await cameraPage.evaluate(name => {
          const title = Array.from(document.querySelectorAll('h4')).find(element => element.textContent.trim() === name);
          if (!title) return false;
          title.parentElement.click(); return true;
        }, product.name);
        if (!clicked) throw new Error('Catalog missing ' + product.name);
        await cameraPage.waitForFunction(id => document.querySelector('#landmarkGlassesCanvas')?.getAttribute('data-loaded-model') === id, { timeout: 20000 }, product.id);
        await new Promise(resolve => setTimeout(resolve, 350));
        const visiblePixels = await cameraPage.evaluate(async () => {
          const overlay = document.querySelector('#landmarkGlassesCanvas');
          const image = new Image(); image.src = overlay.toDataURL(); await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
          let count = 0; for(let i=3;i<pixels.length;i+=4)if(pixels[i]>10)count++;
          return count;
        });
        if(visiblePixels < 100) throw new Error('Glasses loaded but not rendered: '+product.id+' pixels '+visiblePixels);

        {
          await cameraPage.screenshot({ path: path.resolve('scratch/' + product.id + '-camera.png') });
        }
      }
      const width = await cameraPage.$eval('#landmarkCameraCanvas', canvas => canvas.getBoundingClientRect().width);
      if (width > 770) throw new Error('Camera box was not reduced: ' + width);
      console.log('All ' + products.length + ' added styles switched successfully in live AR; camera width ' + width + 'px.');
    }

    if(process.argv.includes('--fit-advisor')) {
      await cameraPage.evaluate(() => Array.from(document.querySelectorAll('.fit-entry button')).find(b => /Find my fit/.test(b.textContent)).click());
      await cameraPage.waitForSelector('[data-fit-product]', {timeout: 15000});
      const analysis = await cameraPage.$eval('.fit-summary', e => e.innerText);
      if(!analysis.match(/Oval|Round|Square|Heart|Diamond/))throw Error('No measured face shape');
      const previews = await cameraPage.$$eval('.fit-products img', imgs => imgs.every(img => img.complete && img.naturalWidth>0));
      if(!previews)throw Error('Recommendation preview missing');
      await cameraPage.screenshot({path:'scratch/fit-advisor.png'});
      const recommended = await cameraPage.$eval('[data-fit-product]', e => {const id=e.dataset.fitProduct;e.click();return id;});
      await cameraPage.waitForFunction(id => document.querySelector('#landmarkGlassesCanvas')?.dataset.loadedModel===id,{},recommended);
      if(await cameraPage.$('[role="dialog"]'))throw Error('Advisor did not close on try-on');
      console.log('Measured face analysis, recommendation previews and suggested live try-on passed: '+analysis);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Sample camera rendering passed. Physical head movement still requires webcam validation.');
  } finally { await browser.close(); if (fs.existsSync(file)) fs.unlinkSync(file); }
})().catch(error => { console.error(error); process.exitCode = 1; });
