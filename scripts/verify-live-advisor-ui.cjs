const puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:3011');
 const result=await page.evaluate(async()=>{
  const {default:React}=await import('/node_modules/.vite/deps/react.js');
  const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
  const {AIFitAdvisorModal}=await import('/src/components/Modals/AIFitAdvisorModal.tsx');
  const {scoreFaceArchetypes}=await import('/src/utils/faceFitAdvisor.ts');
  const {SUNGLASSES_CATALOG:products}=await import('/src/data/catalog.ts');
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const make=jaw=>{const ratios={heightToWidth:1.2,jawToCheek:jaw,foreheadToCheek:.83,foreheadToJaw:.83/jaw,chinToJaw:.48};return {...ratios,...scoreFaceArchetypes(ratios),samples:1,measuredAt:Date.now()};};
  let pair;for(let j=.75;j<.9;j+=.001) if(make(j).shape!==make(j+.01).shape){pair=[j,j+.01];break;}
  const render=m=>root.render(React.createElement(AIFitAdvisorModal,{isOpen:true,onClose:()=>{},onSelectProduct:()=>{},stats:{faceDetected:true,faceMeasurements:m},products,cameraEnabled:true,onEnableCamera:()=>{},activeProduct:products[0],mirror:true,cameraMessage:'',cameraError:''}));
  render(undefined);await wait(100);
  const seen=[];
  for(const jaw of [pair[0],pair[1],pair[0]]) {
   for(let i=0;i<13;i++){render(make(jaw));await wait(45);}
   const heading=container.querySelector('.fit-summary h3')?.textContent;
   if(heading!==make(jaw).shape) throw new Error(`UI expected ${make(jaw).shape}, got ${heading}`);
   seen.push({shape:heading,frames:[...container.querySelectorAll('[data-fit-product]')].map(e=>e.getAttribute('data-fit-product'))});
  }
  if(JSON.stringify(seen[0].frames)!==JSON.stringify(seen[2].frames)) throw new Error('Returning user recommendations differ');
  if(JSON.stringify(seen[0].frames)===JSON.stringify(seen[1].frames)) throw new Error('Different shapes kept same recommendations');
  await wait(1300);
  if(container.querySelector('.fit-summary'))throw new Error('Stale UI result remained');
  root.unmount();container.remove();return seen.map(x=>({shape:x.shape,frames:x.frames.length}));
 });console.log('PASS mounted React advisor:',JSON.stringify(result),'and idle expiry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
