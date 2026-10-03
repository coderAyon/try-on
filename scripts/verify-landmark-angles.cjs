const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 850 });
    await page.setRequestInterception(true);
    page.on('request', req => req.url().endsWith('/fit-validation') ? req.respond({ contentType: 'text/html', body: '<html><body></body></html>' }) : req.continue());
    await page.goto('http://localhost:3000/fit-validation');
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { FaceLandmarker, FilesetResolver } = await import('/node_modules/.vite/deps/@mediapipe_tasks-vision.js');
      const { EyewearRig, eyewearPose, landmarkWorld } = await import('/src/utils/landmarkEyewear.ts');
      const { loadEyewearCADModel } = await import('/src/utils/cadModelManager.ts');
      const { SUNGLASSES_CATALOG } = await import('/src/data/catalog.ts');
      const { generateStudioEnvironment } = await import('/src/utils/environmentGenerator.ts');
      const image = new Image(); image.src = '/models_faces/female_oval.jpg'; await image.decode();
      const task = await FaceLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/tracking/wasm'), {
        baseOptions: { modelAssetPath: '/tracking/face_landmarker.task', delegate: 'GPU' }, runningMode: 'IMAGE', numFaces: 1,
      });
      const landmarks = task.detect(image).faceLandmarks[0];
      if (!landmarks) throw new Error('Reference face not detected');
      const w = 400, h = 360, sw = image.width * h / image.height, sh = h;
      const base = eyewearPose(landmarks, sw, sh);
      const world = landmarks.map(p => landmarkWorld(p, sw, sh));
      const indices = await fetch('/tracking/face-triangles.json').then(r => r.json());
      const texture = new THREE.Texture(image); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace;
      document.body.style.cssText = 'margin:0;background:#ddd;display:grid;grid-template-columns:repeat(3,400px);font:14px Arial;color:#222';
      let maxRotationError = 0, maxEyeError = 0;
      const inferred = [];
      for (const [label, pitch, yaw, roll] of [['Front', 0, 0, 0], ['Yaw +40', 0, 40, 0], ['Yaw -40', 0, -40, 0], ['Nod +30', 30, 0, 0], ['Nod -30', -30, 0, 0], ['Roll +25', 0, 0, 25]]) {
        const panel = document.createElement('div'); const title = document.createElement('div'); title.textContent = label + ' — synthetic surface test'; title.style.padding = '10px'; panel.append(title);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(w, h); renderer.setClearColor(0xdddddd); renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; panel.append(renderer.domElement); document.body.append(panel);
        const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, .1, 4000); camera.position.z = 1000;
        const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180, 'YXZ'));
        const transformed = world.map(p => p.clone().sub(base.position).applyQuaternion(rotation).add(base.position));
        const posedLandmarks = transformed.map(p => ({ x: p.x / sw + .5, y: .5 - p.y / sh, z: -p.z / sw }));
        const pose = eyewearPose(posedLandmarks, sw, sh);
        const expected = rotation.clone().multiply(base.quaternion);
        maxRotationError = Math.max(maxRotationError, pose.quaternion.angleTo(expected));
        const geometry = new THREE.BufferGeometry(); geometry.setIndex(indices);
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(transformed.slice(0,468).flatMap(p=>p.toArray()), 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(landmarks.slice(0,468).flatMap(p=>[p.x,1-p.y]), 2));
        const skin = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide})); skin.renderOrder=-10; scene.add(skin);
        renderer.render(scene,camera);
        const detection=task.detect(renderer.domElement).faceLandmarks[0];
        if (!detection) throw new Error('Tracker lost synthetic pose: '+label);
        const tracked=eyewearPose(detection,w,h);
        const errorDeg=tracked.quaternion.angleTo(expected)*180/Math.PI;
        inferred.push({label,errorDeg:Math.round(errorDeg*10)/10});
        if (errorDeg>20) throw new Error('Pose estimation drift '+label+': '+errorDeg);
        const root = new THREE.Group(); root.position.copy(pose.position); root.quaternion.copy(pose.quaternion); scene.add(root);
        const model = await loadEyewearCADModel(SUNGLASSES_CATALOG[0], SUNGLASSES_CATALOG[0].variants[0]);
        const rig = new EyewearRig(model); root.scale.setScalar(rig.fittedScale(pose.eyeSpan, pose.faceWidth)); root.updateMatrixWorld(true);
        const left = root.worldToLocal(pose.leftTemple.clone()), right = root.worldToLocal(pose.rightTemple.clone());
        rig.fitTemples(left,right); root.add(rig.group);
        const span=left.distanceTo(right), skull=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true}));
        skull.position.set((left.x+right.x)/2,.6,(left.z+right.z)/2-span*.13); skull.scale.set(span*.49,span*.7,span*.46); skull.renderOrder=-10;root.add(skull);
        scene.add(new THREE.HemisphereLight(0xffffff,0x716a60,1.2)); const key = new THREE.DirectionalLight(0xffffff,1.5); key.position.set(-100,200,600);scene.add(key);
        const env = generateStudioEnvironment(renderer,'studio');scene.environment=env.texture; renderer.render(scene,camera);
        // Orientation must follow a combined head rotation, independent of scale/crop.
        const fittedEyeSpan=rig.eyeDistance*root.scale.x;
        if (rig.frontWidth * root.scale.x + .001 < pose.faceWidth * 1.04) throw new Error('Frame narrower than face');
        const originalScale = root.scale.x;
        const movedScale = rig.fittedScale(pose.eyeSpan * 1.5, pose.faceWidth * 1.5);
        if (Math.abs(movedScale / originalScale - 1.5) > 1e-5) throw new Error('Distance response lags');
        for(let n=0;n<30;n++) {
          const noisy = rig.fittedScale(pose.eyeSpan, pose.faceWidth * (n%2 ? 1.01 : .99));
          if (Math.abs(noisy / originalScale - 1) > .003) throw new Error('Sizing jitter');
        }
        maxEyeError=Math.max(maxEyeError,Math.max(0,pose.eyeSpan-fittedEyeSpan));
        if (Math.abs(left.z) < .1 || Math.abs(right.z) < .1) throw new Error('Temple depth was flattened');
      }
      task.close();
      return { maxRotationError, maxEyeError, panels: 6, inferred };
    });
    if (result.maxRotationError > 1e-5 || result.maxEyeError > 1e-5) throw new Error(JSON.stringify(result));
    await page.screenshot({ path: path.resolve('scratch/landmark-angle-check.png'), fullPage: true });
    console.log('Angle/scale checks passed:', result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
