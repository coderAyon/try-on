const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\97739e8a-c15a-4f6a-991b-d0a989532ed9\\scratch\\chrome_profile';

const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=' + profileDir,
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1280,850'
]);

async function run() {
  await new Promise(r => setTimeout(r, 1500));
  const newPageRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:3000', { method: 'PUT' });
  const pageInfo = await newPageRes.json();

  const ws = new globalThis.WebSocket(pageInfo.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();

  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    callbacks.set(curId, resolve);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id && callbacks.has(m.id)) {
      const cb = callbacks.get(m.id);
      callbacks.delete(m.id);
      cb(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', m.params.type, m.params.args.map(a => a.value || a.description).join(' '));
    } else if (m.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description);
    }
  };

  ws.onopen = async () => {
    await send('Page.enable');
    await send('Runtime.enable');

    await new Promise(r => setTimeout(r, 3000));

    // Click '360° Studio' button
    await send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('360° Studio'));
        if (btn) {
          btn.click();
          'CLICKED';
        } else {
          'NOT_FOUND';
        }
      `
    });

    console.log('Clicked 360 Studio, waiting for 3D model...');
    await new Promise(r => setTimeout(r, 4000));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\97739e8a-c15a-4f6a-991b-d0a989532ed9\\studio_360_render.png';
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log('Saved 360 Studio screenshot to:', shotPath);

    ws.close();
    chrome.kill();
  };
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
