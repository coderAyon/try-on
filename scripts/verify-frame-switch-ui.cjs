const puppeteer=require('puppeteer');
(async()=>{const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const page=await browser.newPage();await page.goto('http://127.0.0.1:3011');
console.log(await page.evaluate(async()=>{
 const {default:React}=await import('/node_modules/.vite/deps/react.js');
 const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
 const {FrameSelectorPanel}=await import('/src/components/Catalog/FrameSelectorPanel.tsx');
 const {LandmarkGlassesTryOn}=await import('/src/components/Viewport/LandmarkGlassesTryOn.tsx');
 const {SUNGLASSES_CATALOG:products}=await import('/src/data/catalog.ts');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const panel=document.createElement('div');const viewport=document.createElement('div');viewport.style.cssText='width:700px;height:500px';document.body.append(panel,viewport);
 const cards=createRoot(panel),view=createRoot(viewport);let chosen=[];
 const select=p=>{chosen.push(p.id);view.render(React.createElement(LandmarkGlassesTryOn,{product:p,variantIndex:0}));};
 cards.render(React.createElement(FrameSelectorPanel,{products,activeProduct:products[0],onSelectProduct:select,onViewAll:()=>{},wishlist:[],onToggleWishlist:()=>{}}));await wait(100);
 for(const name of ['Try Aviator','Try Wayfarer','Try Round Classic']){
 const card=panel.querySelector('[aria-label="'+name+'"]');if(!card)throw Error('Missing card '+name);card.querySelector('img').click();await wait(30);
 }
 const expected=['rayban-aviator-classic','rayban-wayfarer-classic','imported-obj-classic'];
 if(JSON.stringify(chosen)!==JSON.stringify(expected))throw Error('Card mapping wrong '+chosen);
 let loaded;for(let i=0;i<100;i++){loaded=viewport.querySelector('[data-loaded-model]')?.getAttribute('data-loaded-model');if(loaded===expected[2])break;await wait(50);}
 if(loaded!==expected[2])throw Error('Latest selected model did not mount '+loaded);
 await wait(350);if(viewport.querySelector('[data-loaded-model]')?.getAttribute('data-loaded-model')!==expected[2])throw Error('Older request replaced latest selection');
 cards.unmount();view.unmount();return {clicked:chosen,loaded};
}));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
