import { getSettings, addFrameToHistory } from '../utils/storage';
import { ExtensionMessage } from '../types';

/**
 * Setup Context Menus on Installation
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'lumen-tryon-image',
    title: '⚡ Try on these sunglasses with Lumen AR',
    contexts: ['image'],
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

  const targetUrl = `${baseAppUrl}/#try-on?${params.toString()}`;

  // Find existing try-on tab or open a new one
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((t) => t.url && t.url.includes(new URL(baseAppUrl).hostname));

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
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'lumen-tryon-image' && info.srcUrl) {
    launchTryOnApp({
      frame: info.srcUrl,
      title: 'Online Sunglasses',
      brand: 'Web Store',
    });
  }
});

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'OPEN_TRYON' && message.payload?.frame) {
    launchTryOnApp(message.payload).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CHECK_STATUS') {
    sendResponse({ active: true });
    return false;
  }
});
