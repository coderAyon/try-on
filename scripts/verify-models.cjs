const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 950 });
    const errors = [];
    page.on('pageerror', err => errors.push(err.stack));
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const models = await page.evaluate(async () => {
      const { loadEyewearCADModel } = await import('/src/utils/cadModelManager.ts');
      const { SUNGLASSES_CATALOG } = await import('/src/data/catalog.ts');
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const results = [];
      for (const product of SUNGLASSES_CATALOG) {
        const model = await loadEyewearCADModel(product, product.variants[0]);
        const lenses = new THREE.Box3(); let triangles = 0;
        model.traverse(mesh => {
          if (!mesh.isMesh) return;
          triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3;
          if (/lens/i.test(mesh.name)) lenses.union(new THREE.Box3().setFromObject(mesh));
        });
        const bounds = new THREE.Box3().setFromObject(model);
        results.push({ category: product.category, name: model.name, width: bounds.max.x - bounds.min.x, lensCentre: lenses.isEmpty() ? null : lenses.getCenter(new THREE.Vector3()).toArray(), triangles });
      }
      return results;
    });
    console.log(JSON.stringify(models, null, 2));
    for (const model of models) {
      if (!Number.isFinite(model.width) || model.width < 8 || model.width > 10 || model.triangles < 100) throw new Error('Invalid geometry: ' + model.category);
      if (model.name.startsWith('fallback')) throw new Error('Imported model failed: ' + model.category);
      if (model.lensCentre && model.lensCentre.some(value => Math.abs(value) > 0.01)) throw new Error('Lens centre displaced: ' + model.category);
    }
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => /360.*Studio/i.test(b.textContent))?.click());
    await new Promise(resolve => setTimeout(resolve, 2500));
    await page.screenshot({ path: path.resolve('scratch/eyewear-studio.png'), fullPage: false });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Browser check passed: all category geometries loaded, imported lens centres aligned, no uncaught errors. Screenshot: scratch/eyewear-studio.png');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
