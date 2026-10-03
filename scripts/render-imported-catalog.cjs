const puppeteer=require('puppeteer'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage();await page.setViewport({width:1440,height:1400});await page.setRequestInterception(true);
 page.on('request',r=>r.url().endsWith('/catalog-validation')?r.respond({contentType:'text/html',body:'<html><body></body></html>'}):r.continue());
 await page.goto('http://localhost:3000/catalog-validation');
 const results=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/.vite/deps/three.js');
 const {SUNGLASSES_CATALOG}=await import('/src/data/catalog.ts');
 const {loadEyewearCADModel}=await import('/src/utils/cadModelManager.ts');
 const {EyewearRig}=await import('/src/utils/landmarkEyewear.ts');
 const {generateStudioEnvironment}=await import('/src/utils/environmentGenerator.ts');
 document.body.style.cssText='margin:0;display:grid;grid-template-columns:repeat(6,240px);background:#eee;font:13px Arial;color:#222';
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,280);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x555555,1.4));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-4,6,10);scene.add(light);
 const env=generateStudioEnvironment(renderer,'studio');scene.environment=env.texture;
 const camera=new THREE.PerspectiveCamera(35,480/280,.01,1000);camera.position.set(0,.35,10);camera.lookAt(0,0,0);
 const results=[];
 const remote=await fetch('/api/products').then(r=>r.json());const products=[...remote.data];
 for(const p of SUNGLASSES_CATALOG)if(!products.some(r=>r.id===p.id))products.push(p);
 for(const product of products){
 for(let variantIndex=0;variantIndex<product.variants.length;variantIndex++){
 try{
 const model=await loadEyewearCADModel(product,product.variants[variantIndex]);scene.add(model);renderer.render(scene,camera);
 const canvas=renderer.domElement, context=document.createElement('canvas').getContext('2d');context.canvas.width=480;context.canvas.height=280;context.drawImage(canvas,0,0);
 const pixels=context.getImageData(0,0,480,280).data;let minX=480,minY=280,maxX=0,maxY=0;
 for(let y=0;y<280;y++)for(let x=0;x<480;x++)if(pixels[(y*480+x)*4+3]>8){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const cropped=document.createElement('canvas');cropped.width=maxX-minX+17;cropped.height=maxY-minY+17;cropped.getContext('2d').drawImage(canvas,minX,minY,maxX-minX+1,maxY-minY+1,8,8,maxX-minX+1,maxY-minY+1);
 const data=cropped.toDataURL('image/png');const rig=new EyewearRig(model);const bounds=new THREE.Box3().setFromObject(model);
 const panel=document.createElement('div'),img=document.createElement('img'),label=document.createElement('div');img.src=data;img.width=240;img.height=140;label.textContent=product.name;label.style.padding='10px';panel.append(img,label);document.body.append(panel);
 results.push({id:product.id+(variantIndex?'-v'+variantIndex:''),file:product.model?.path,width:bounds.max.x-bounds.min.x,height:bounds.max.y-bounds.min.y,depth:bounds.max.z-bounds.min.z,eyeDistance:rig.eyeDistance,data});
 scene.remove(model);
 }catch(e){results.push({id:product.id,error:String(e)});}
 }
 }
 return results;
 });
 fs.mkdirSync('public/models/imported/thumbnails',{recursive:true});fs.mkdirSync('public/models/catalog-thumbnails',{recursive:true});
 for(const result of results){if(result.error)throw new Error(result.id+': '+result.error);fs.writeFileSync(path.join(result.id.startsWith('imported-')?'public/models/imported/thumbnails':'public/models/catalog-thumbnails',result.id.replace('imported-','')+'.png'),Buffer.from(result.data.split(',')[1],'base64'));delete result.data;
 if(!Number.isFinite(result.width)||result.eyeDistance<1||result.eyeDistance>8)throw new Error('Invalid fitting bounds '+JSON.stringify(result));}
 fs.writeFileSync('scratch/imported-validation.json',JSON.stringify(results,null,2));
 await page.screenshot({path:path.resolve('scratch/imported-catalog.png'),fullPage:true});
 console.log('Catalog thumbnail rendering passed: '+results.length+' finish previews across '+new Set(results.map(r=>r.id.replace(/-v\d+$/,''))).size+' styles');
 console.log(JSON.stringify(results.map(r=>({id:r.id,depth:+r.depth.toFixed(2),eyes:+r.eyeDistance.toFixed(2)}))));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
