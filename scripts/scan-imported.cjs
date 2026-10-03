const puppeteer=require('puppeteer'),fs=require('fs');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage();await page.setRequestInterception(true);
 page.on('request',r=>r.url().endsWith('/asset-scan')?r.respond({contentType:'text/html',body:'<html><body></body></html>'}):r.continue());
 await page.goto('http://localhost:3000/asset-scan');
 const files=JSON.parse(fs.readFileSync('scratch/imported-files.json','utf8'));
 const result=await page.evaluate(async files=>{
 const THREE=await import('/node_modules/.vite/deps/three.js');
 const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const {OBJLoader}=await import('/node_modules/three/examples/jsm/loaders/OBJLoader.js');
 const out=[];
 for(const file of files){try{
 const scene=file.endsWith('.obj')?await new OBJLoader().loadAsync('/models/imported/'+encodeURIComponent(file)):(await new GLTFLoader().loadAsync('/models/imported/'+encodeURIComponent(file))).scene;
 scene.updateMatrixWorld(true);const meshes=[],groups=[];
 scene.traverse(o=>{const box=new THREE.Box3().setFromObject(o),size=box.getSize(new THREE.Vector3()).toArray(),center=box.getCenter(new THREE.Vector3()).toArray();
 if(o.isMesh)meshes.push({name:o.name,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.name),size,center});
 else if(o.children.some(c=>c.isMesh))groups.push({name:o.name,size,center});});
 const box=new THREE.Box3().setFromObject(scene);out.push({file,size:box.getSize(new THREE.Vector3()).toArray(),meshes,groups});
 }catch(e){out.push({file,error:String(e)});}}
 return out;
 },files);
 fs.writeFileSync('scratch/imported-scan.json',JSON.stringify(result,null,2));
 for(const r of result)console.log(JSON.stringify({file:r.file,size:r.size,groups:r.groups?.map(g=>g.name),error:r.error}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
