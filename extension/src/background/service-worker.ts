import { getSettings, addFrameToHistory } from '../utils/storage';
import { ExtensionMessage } from '../types';

/**
 * Setup Context Menus on Installation (removeAll prevents duplicate ID errors on reload)
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lumen-tryon-image',
      title: '⚡ Try on these sunglasses with Lumen AR',
      contexts: ['image'],
    }, () => {
      if (chrome.runtime?.lastError) { /* ignore */ }
    });
  });
});

/**
 * Handles Opening the Try-On Web App
 */
async function launchTryOnApp(payload: {
  frame: string;
  title?: string;
  brand?: string;
  price?: number;
  domain?: string;
}) {
  const settings = await getSettings();
  const baseAppUrl = settings.appUrl || 'http://localhost:3000';

  // Save to recently tried history
  await addFrameToHistory({
    id: `hist-${Date.now()}`,
    imageUrl: payload.frame,
    title: payload.title || 'Online Sunglasses',
    brand: payload.brand || 'Web Store',
    domain: payload.domain || 'online',
  });

  // Construct target URL with parameters
  const params = new URLSearchParams();
  params.set('frame', payload.frame);
  if (payload.title) params.set('title', payload.title);
  if (payload.brand) params.set('brand', payload.brand);
  if (payload.price) params.set('price', String(payload.price));
  params.set('mode', settings.preferredMode || 'webcam');

  const appUrl = new URL(baseAppUrl);
  appUrl.hash = `try-on?${params.toString()}`;
  const targetUrl = appUrl.href;

  // Find existing try-on tab or open a new one
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((t) => {
    if (!t.url) return false;
    try {
      const candidate = new URL(t.url);
      return candidate.origin === appUrl.origin &&
        candidate.pathname.replace(/\/$/, '') === appUrl.pathname.replace(/\/$/, '');
    } catch { return false; }
  });

  if (existingTab && existingTab.id) {
    await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: targetUrl, active: true });
  }
}

/**
 * Context Menu Click Handler
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'lumen-tryon-image' && info.srcUrl) {
    if (tab?.id) {
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: 'SHOW_INPAGE_MIRROR',
          payload: {
            frame: info.srcUrl,
            title: 'Online Sunglasses',
            brand: 'Web Store',
          },
        },
        () => {
          if (chrome.runtime.lastError) {
            launchTryOnApp({
              frame: info.srcUrl!,
              title: 'Online Sunglasses',
              brand: 'Web Store',
            });
          }
        }
      );
    } else {
      launchTryOnApp({
        frame: info.srcUrl,
        title: 'Online Sunglasses',
        brand: 'Web Store',
      });
    }
  }
});

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'FETCH_IMAGE_DATA_URL' && message.payload?.url) {
    fetch(message.payload.url)
      .then(async (res) => {
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const chunkSize = 16384;
        const chunks: string[] = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
          chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize))));
        }
        const base64 = btoa(chunks.join(''));
        const mime = res.headers.get('content-type') || 'image/png';
        sendResponse({ success: true, dataUrl: `data:${mime};base64,${base64}` });
      })
      .catch((err) => {
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Keep async channel open
  }

  if (message.type === 'OPEN_TRYON' && message.payload?.frame) {
    launchTryOnApp(message.payload).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: String(error) });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CHECK_STATUS') {
    sendResponse({ active: true });
    return false;
  }
});
