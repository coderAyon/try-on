const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Photo').click());
    const input = await page.waitForSelector('input[aria-label="Upload face photo"]');
    await input.uploadFile(path.resolve('public/models_faces/female_oval.jpg'));
    await page.waitForFunction(() => document.querySelector('.photo-tryon-button') && !document.querySelector('.photo-tryon-button').disabled, { timeout: 30000 });
    await page.click('.photo-tryon-button');
    await page.waitForFunction(() => document.querySelector('.photo-result-image')?.alt.includes('fitted on your face'), { timeout: 60000 });
    const output = await page.$eval('.photo-result-image', image => ({ width: image.naturalWidth, height: image.naturalHeight, loaded: image.complete }));
    if (!output.loaded || output.width < 1024 || output.height < 1024) throw Error('Low-resolution or missing fitted output: ' + JSON.stringify(output));
    if (!await page.$('[aria-label="Compare original and fitted image"]')) throw Error('Comparison slider missing');
    await page.click('[aria-label="Zoom in"]');
    if (!await page.$('.photo-result-zoomed')) throw Error('Result zoom did not activate');
    if (!await page.$('a[download]')) throw Error('Fitted image download missing');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Mobile photo overflow');
    await page.screenshot({ path: 'scratch/photo-supervisor.png', fullPage: true });
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      canvas.getContext('2d').fillRect(0, 0, 256, 256);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'no-face.png', { type: 'image/png' }));
      const input = document.querySelector('input[type="file"]'); input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => document.body.innerText.includes('NO FACE'), { timeout: 30000 });
    if (await page.$eval('.photo-result-image', image => image.alt.includes('fitted on your face'))) throw Error('No-face upload retained a stale fitted result');
    if (errors.length) throw Error(errors.join('\n'));
    console.log('PASS: mobile portrait upload, face detection, fitted HD output, comparison, and no page errors.', output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
