const puppeteer=require('puppeteer');
(async()=>{const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage();await page.setViewport({width:1100,height:760});await page.goto('http://127.0.0.1:3011');
 console.log(await page.evaluate(async()=>{
 const THREE=await import('/node_modules/.vite/deps/three.js');
 const {loadEyewearCADModel}=await import('/src/utils/cadModelManager.ts');
 const {prepareTryOnFrame,loadTryOnFrame}=await import('/src/utils/tryOnFrame.ts');
 const {EyewearRig}=await import('/src/utils/landmarkEyewear.ts');
 const {SUNGLASSES_CATALOG:products}=await import('/src/data/catalog.ts');
 const {generateStudioEnvironment}=await import('/src/utils/environmentGenerator.ts');
 document.body.innerHTML='';document.body.style.cssText='margin:0;background:#c8c2bb;display:grid;grid-template-columns:550px 550px;font:16px Arial';
 const results=[];
 for(const id of ['rayban-aviator-classic','rayban-wayfarer-classic','imported-obj-classic']){
  const p=products.find(p=>p.id===id);if(!p)throw Error('Missing test product '+id);
  const t=performance.now();await prepareTryOnFrame(p);const cold=performance.now()-t;
  const start=performance.now();const natural=await loadTryOnFrame(p,0);const rig=new EyewearRig(natural,p.id);const warm=performance.now()-start;rig.dispose();
  results.push({id,prepareMs:Math.round(cold),warmMs:Math.round(warm)});
  for(const modified of [false,true]){
   const model=modified?await loadTryOnFrame(p,0):await loadEyewearCADModel(p,p.variants[0]);
   model.traverse(o=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m.isMeshStandardMaterial&&!Number.isFinite(m.roughness)))throw Error('Invalid material');}});
   const panel=document.createElement('div');panel.textContent=p.name+' — '+(modified?'Updated':'Before');document.body.append(panel);
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(550,220);renderer.setClearColor('#c8c2bb');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;panel.append(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,550/220,.1,100);camera.position.set(0,1,17);camera.lookAt(0,0,0);
   scene.add(new THREE.HemisphereLight(0xffffff,0x716a60,modified?.85:1.2));const light=new THREE.DirectionalLight(0xffffff,modified?1.1:1.5);light.position.set(-100,200,600);scene.add(light);
   const env=generateStudioEnvironment(renderer,'studio');scene.environment=env.texture;model.rotation.set(.05,.3,0);scene.add(model);renderer.render(scene,camera);
  }
 }
 return results;
 }));await page.screenshot({path:require('path').join(require('os').tmpdir(),'sunglass-frame-material-comparison.png')});
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
