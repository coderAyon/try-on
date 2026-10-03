const puppeteer=require('puppeteer');
(async()=>{const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
const p=await b.newPage();await p.setViewport({width:1366,height:1100});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:3000');await p.waitForSelector('.style-card');await new Promise(r=>setTimeout(r,1200));
const before=await p.$eval('.slider-bottom',e=>e.innerText); const scrollBefore=await p.$eval('.styles-track',e=>e.scrollLeft);const selected=await p.$eval('.style-card[aria-pressed="true"]',e=>e.dataset.productId);
await new Promise(r=>setTimeout(r,2900));const after=await p.$eval('.slider-bottom',e=>e.innerText);if(before===after)throw Error('Autoplay did not advance'); if(await p.$eval('.styles-track',e=>e.scrollLeft)<=scrollBefore)throw Error('Slider did not scroll');
if(await p.$eval('.style-card[aria-pressed="true"]',e=>e.dataset.productId)!==selected)throw Error('Autoplay changed worn glasses');
await p.click('[aria-label="Pause carousel"]');const paused=await p.$eval('.slider-bottom',e=>e.innerText);await new Promise(r=>setTimeout(r,2800));if(paused!==await p.$eval('.slider-bottom',e=>e.innerText))throw Error('Pause failed');
const cards=await p.$$eval('.style-card',es=>es.map(e=>({id:e.dataset.productId,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,transform:getComputedStyle(e).transform})));
if(cards.length!==32||new Set(cards.map(c=>c.id)).size!==32)throw Error('Missing cards');
const visible = await p.$eval('.styles-track',track=>{const bounds=track.getBoundingClientRect();return Array.from(track.children).filter(card=>{const r=card.getBoundingClientRect();return r.left>=bounds.left-.75&&r.right<=bounds.right+.75;}).length;});
if(visible!==6)throw Error('Expected 6 complete desktop cards, found '+visible);
if(cards.some(c=>c.transform!=='none'||Math.abs(c.top-cards[0].top)>.1||c.height!==124))throw Error('Cards are not flat');
await p.screenshot({path:'scratch/slider-desktop.png',fullPage:true});
await p.setViewport({width:390,height:844});await new Promise(r=>setTimeout(r,800));await p.screenshot({path:'scratch/slider-mobile.png',fullPage:true});
if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile page overflow');
if(errors.length)throw Error(errors.join('\n'));console.log('32 flat cards, autoplay, unchanged selection, pause, desktop/mobile layout passed');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
