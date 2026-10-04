const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().endsWith('/face_landmarker.task')) setTimeout(() => request.continue().catch(() => {}), 4000);
      else request.continue();
    });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    if (await page.$('#landmarkCameraCanvas')) throw Error('Camera started without consent');
    const start = Date.now(); await page.click('.fit-scan button');
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#landmarkCameraCanvas');
      if (!canvas?.width || !document.body.innerText.includes('Loading face landmarks')) return false;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, i) => i % 4 !== 3 && value > 30);
    }, { timeout: 3500 });
    console.log('PASS: video preview visible before deliberately delayed detector; preview after', Date.now() - start, 'ms');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Stop camera')).click());
    await new Promise(resolve => setTimeout(resolve, 5500));
    if (await page.$('#landmarkCameraCanvas')) throw Error('Stopped camera stayed mounted');
    if (errors.length) throw Error(errors.join('\n'));
    console.log('PASS: stopping during detector loading releases the late task without page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
