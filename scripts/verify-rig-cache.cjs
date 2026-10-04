const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(); await page.goto('http://localhost:3000');
    console.log(await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { loadEyewearCADModel } = await import('/src/utils/cadModelManager.ts');
      const { EyewearRig } = await import('/src/utils/landmarkEyewear.ts');
      const { SUNGLASSES_CATALOG } = await import('/src/data/catalog.ts');
      const results = [];
      for (const id of ['imported-vuzix', 'imported-fly', 'imported-pack-green', 'rayban-aviator-classic']) {
        const product = SUNGLASSES_CATALOG.find(p => p.id === id);
        const model = await loadEyewearCADModel(product, product.variants[0]);
        let start = performance.now(); const cold = new EyewearRig(model, id); const coldMs = performance.now() - start;
        const second = await loadEyewearCADModel(product, product.variants[0]);
        start = performance.now(); const warm = new EyewearRig(second, id); const warmMs = performance.now() - start;
        if (cold.eyeDistance !== warm.eyeDistance || cold.frontWidth !== warm.frontWidth) throw Error('Cached sizing changed: ' + id);
        cold.group.children.forEach((mesh, j) => {
          const a = mesh.geometry.attributes.position.array, b = warm.group.children[j].geometry.attributes.position.array;
          if (a === b || a.length !== b.length || a.some((value, i) => value !== b[i])) throw Error('Cached geometry changed/shared: ' + id);
        });
        const snapshot = cold.group.children.map(mesh => mesh.geometry.attributes.position.array.slice());
        warm.fitTemples(new THREE.Vector3(-3, 1, -4), new THREE.Vector3(3, 1, -4));
        cold.group.children.forEach((mesh, j) => {
          if (mesh.geometry.attributes.position.array.some((value, i) => value !== snapshot[j][i])) throw Error('Fitting mutated another instance');
        });
        results.push({ id, coldMs: Math.round(coldMs), warmMs: Math.round(warmMs) });
        cold.dispose(); warm.dispose();
      }
      return results;
    }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
