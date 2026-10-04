const puppeteer = require('puppeteer'), fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => r.url().endsWith('/placement-audit') ? r.respond({ contentType: 'text/html', body: '<body></body>' }) : r.continue());
    await page.goto('http://localhost:3000/placement-audit');
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { FaceLandmarker, FilesetResolver } = await import('/node_modules/.vite/deps/@mediapipe_tasks-vision.js');
      const { EyewearRig, eyewearPose, landmarkWorld } = await import('/src/utils/landmarkEyewear.ts');
      const { loadEyewearCADModel } = await import('/src/utils/cadModelManager.ts');
      const { SUNGLASSES_CATALOG } = await import('/src/data/catalog.ts');
      const { generateStudioEnvironment } = await import('/src/utils/environmentGenerator.ts');
      const remote = await fetch('/api/products').then(r => r.json());
      const products = [...remote.data];
      for (const p of SUNGLASSES_CATALOG) if (!products.some(r => r.id === p.id)) products.push(p);
      const task = await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/tracking/wasm'), { baseOptions: { modelAssetPath: '/tracking/face_landmarker.task', delegate: 'GPU' }, runningMode: 'IMAGE', numFaces: 1 });
      const indices = await fetch('/tracking/face-triangles.json').then(r => r.json());
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(300, 300); renderer.setClearColor(0x202730); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const env = generateStudioEnvironment(renderer, 'studio');
      const camera = new THREE.OrthographicCamera(-150, 150, 150, -150, .1, 4000); camera.position.z = 1000;
      const poses = [['front', 0, 0, 0], ['left40', 0, -40, 0], ['right40', 0, 40, 0], ['down30', 30, 0, 0], ['up30', -30, 0, 0], ['roll25', 0, 0, 25]];
      const panels = [], checks = [];
      for (const face of ['male_square', 'female_oval']) {
        const image = new Image(); image.src = '/models_faces/' + face + '.jpg'; await image.decode();
        const landmarks = task.detect(image).faceLandmarks[0]; if (!landmarks) throw Error('No reference face: ' + face);
        const sw = image.width * 300 / image.height, sh = 300;
        const base = eyewearPose(landmarks, sw, sh), points = landmarks.map(p => landmarkWorld(p, sw, sh));
        const viewHeight = points[10].distanceTo(points[152]) * 1.65;
        camera.left = -viewHeight / 2; camera.right = viewHeight / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix();
        const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
        const surface = new THREE.BufferGeometry(); surface.setIndex(indices);
        surface.setAttribute('position', new THREE.Float32BufferAttribute(points.slice(0, 468).flatMap(p => p.toArray()), 3));
        surface.setAttribute('uv', new THREE.Float32BufferAttribute(landmarks.slice(0, 468).flatMap(p => [p.x, 1 - p.y]), 2));
        const skinMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        for (const product of products) {
          const model = await loadEyewearCADModel(product, product.variants[0]), rig = new EyewearRig(model);
          const distanceScale = rig.fittedScale(base.eyeSpan, base.faceWidth);
          for (const zoom of [.45, .7, 1, 1.4, 1.8]) {
            const scaled = rig.fittedScale(base.eyeSpan * zoom, base.faceWidth * zoom);
            if (Math.abs(scaled / distanceScale - zoom) > 1e-6) throw Error('Distance scaling mismatch: ' + product.id);
          }
          const lens = new THREE.Box3(); rig.group.traverse(m => { if (m.isMesh && /lens/i.test(m.name)) lens.union(new THREE.Box3().setFromObject(m, true)); });
          const centre = lens.isEmpty() ? null : lens.getCenter(new THREE.Vector3()).toArray();
          // Procedural convex lenses intentionally extend 0.32 units forward.
          if (centre && (Math.abs(centre[0]) > .08 || Math.abs(centre[1]) > .08 || Math.abs(centre[2]) > .2)) throw Error('Lens anchor displaced: ' + product.id + JSON.stringify(centre));
          let innerEdge = Infinity;
          rig.group.traverse(m => { if (m.isMesh && /lens/i.test(m.name)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) innerEdge = Math.min(innerEdge, Math.abs(p.getX(i))); } });
          const gapRatio = Number.isFinite(innerEdge) && innerEdge > .05 ? 2 * innerEdge / rig.eyeDistance : null;
          if (gapRatio !== null && gapRatio < .255) throw Error('Narrow bridge clearance: ' + product.id + ' / ' + gapRatio);
          const scene = new THREE.Scene(); scene.environment = env.texture; scene.add(new THREE.HemisphereLight(0xffffff, 0x716a60, 1.2));
          const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-100, 200, 600); scene.add(key);
          const skin = new THREE.Mesh(surface, skinMat); skin.renderOrder = -10; scene.add(skin);
          const root = new THREE.Group(); root.add(rig.group); scene.add(root);
          const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ colorWrite: false })); skull.renderOrder = -10; root.add(skull);
          for (const [label, pitch, yaw, roll] of poses) {
            const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180, 'YXZ'));
            const moved = points.map(p => p.clone().sub(base.position).applyQuaternion(rotation).add(base.position));
            const pose = eyewearPose(moved.map(p => ({ x: p.x / sw + .5, y: .5 - p.y / sh, z: -p.z / sw })), sw, sh);
            const expected = rotation.clone().multiply(base.quaternion);
            if (pose.quaternion.angleTo(expected) > 1e-5) throw Error('Pose mismatch: ' + product.id);
            root.position.copy(pose.position); root.quaternion.copy(pose.quaternion); root.scale.setScalar(rig.fittedScale(pose.eyeSpan, pose.faceWidth)); root.updateMatrixWorld(true);
            if (rig.frontWidth * root.scale.x < pose.faceWidth * 1.04 - .01) throw Error('Frame undersized: ' + product.id);
            const left = root.worldToLocal(pose.leftTemple.clone()), right = root.worldToLocal(pose.rightTemple.clone());
            rig.fitTemples(left, right);
            const fittedLens = new THREE.Box3(); rig.group.traverse(m => { if (m.isMesh && /lens/i.test(m.name)) { m.geometry.computeBoundingBox(); fittedLens.union(m.geometry.boundingBox); } });
            if (!lens.isEmpty() && (!fittedLens.min.equals(lens.min) || !fittedLens.max.equals(lens.max))) throw Error('Temple fitting deformed lens: ' + product.id);
            const span = left.distanceTo(right); skull.position.set((left.x + right.x) / 2, .6, (left.z + right.z) / 2 - span * .13); skull.scale.set(span * .49, span * .7, span * .46);
            const positions = surface.getAttribute('position'); moved.slice(0, 468).forEach((p, i) => positions.setXYZ(i, p.x, p.y, p.z - pose.eyeSpan * .008)); positions.needsUpdate = true;
            const viewCentre = moved[10].clone().add(moved[152]).multiplyScalar(.5);
            camera.position.x = viewCentre.x; camera.position.y = viewCentre.y;
            renderer.render(scene, camera);
            panels.push({ face, id: product.id, name: product.name, pose: label, data: renderer.domElement.toDataURL() });
          }
          checks.push({ face, id: product.id, frontWidth: rig.frontWidth, eyeDistance: rig.eyeDistance, lensCentre: centre, gapRatio, poses: 6 });
          rig.dispose(); skull.geometry.dispose(); skull.material.dispose();
        }
        surface.dispose(); skinMat.dispose(); texture.dispose();
      }
      task.close(); env.dispose(); renderer.dispose();
      return { checks, panels };
    });
    fs.mkdirSync('scratch/placement-audit', { recursive: true });
    fs.writeFileSync('scratch/placement-audit/checks.json', JSON.stringify(result.checks, null, 2));
    for (const panel of result.panels) fs.writeFileSync('scratch/placement-audit/' + panel.face + '-' + panel.id + '-' + panel.pose + '.png', Buffer.from(panel.data.split(',')[1], 'base64'));
    for (const face of ['male_square', 'female_oval']) {
      const panels = result.panels.filter(p => p.face === face);
      for (let start = 0; start < panels.length; start += 48) {
        await page.setViewport({ width: 1080, height: 1584 });
        await page.setContent('<body style="margin:0;background:#121820;color:white;font:10px Arial;display:grid;grid-template-columns:repeat(6,180px)"></body>');
        await page.evaluate(async panels => { for (const p of panels) { const div = document.createElement('div'); div.style.height = '198px'; const label = document.createElement('div'); label.textContent = p.name + ' / ' + p.pose; label.style.cssText = 'height:18px;white-space:nowrap;overflow:hidden'; const img = new Image(); img.src = p.data; await img.decode(); img.width = 180; img.height = 180; div.append(label, img); document.body.append(div); } }, panels.slice(start, start + 48));
        await page.screenshot({ path: 'scratch/placement-audit/' + face + '-sheet-' + (start / 48 + 1) + '.png' });
      }
    }
    console.log('Passed: ' + result.checks.length + ' face/model combinations, ' + result.panels.length + ' rendered poses. Lens anchors, front size and immutable lenses checked.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
