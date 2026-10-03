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
    }
  };

  ws.onopen = async () => {
    await send('Page.enable');
    await send('Runtime.enable');

    console.log('Waiting for initial load...');
    await new Promise(r => setTimeout(r, 3000));

    // 1. Click Photo Portrait mode
    await send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Photo Portrait'));
        if (btn) btn.click();
      `
    });

    console.log('Switched to Photo Portrait, waiting for MediaPipe face detection & 3D render...');
    await new Promise(r => setTimeout(r, 5000));

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath1 = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\97739e8a-c15a-4f6a-991b-d0a989532ed9\\model_tryon_render.png';
    fs.writeFileSync(shotPath1, Buffer.from(shot1.data, 'base64'));
    console.log('Saved Model Try-On screenshot to:', shotPath1);

    // 2. Click 360 Studio mode
    await send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('360° Studio'));
        if (btn) btn.click();
      `
    });

    console.log('Switched to 360 Studio...');
    await new Promise(r => setTimeout(r, 3000));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath2 = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\97739e8a-c15a-4f6a-991b-d0a989532ed9\\studio_360_fixed.png';
    fs.writeFileSync(shotPath2, Buffer.from(shot2.data, 'base64'));
    console.log('Saved 360 Studio screenshot to:', shotPath2);

    ws.close();
    chrome.kill();
  };
}

run().catch(e => {
  console.error(e);
  chrome.kill();
});
