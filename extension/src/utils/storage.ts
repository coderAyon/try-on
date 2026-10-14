import { ExtensionSettings, DEFAULT_SETTINGS, FrameHistoryItem } from '../types';

const SETTINGS_KEY = 'lumen_extension_settings';
const HISTORY_KEY = 'lumen_extension_history';

/**
 * Gets extension settings from chrome.storage.local or fallback
 */
export async function getSettings(): Promise<ExtensionSettings> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([SETTINGS_KEY], (result) => {
        resolve({ ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) });
      });
    });
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves extension settings
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [SETTINGS_KEY]: updated }, () => resolve());
    });
  } else {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {}
  }

  return updated;
}

/**
 * Retrieves recently tried sunglasses frames
 */
export async function getFrameHistory(): Promise<FrameHistoryItem[]> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([HISTORY_KEY], (result) => {
        resolve(result[HISTORY_KEY] || []);
      });
    });
  }
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Adds an item to recent frame history
 */
export async function addFrameToHistory(item: Omit<FrameHistoryItem, 'timestamp'>): Promise<void> {
  const history = await getFrameHistory();
  const filtered = history.filter((h) => h.imageUrl !== item.imageUrl);
  const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 15);

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [HISTORY_KEY]: updated }, () => resolve());
    });
  } else {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  }
}

/**
 * Clears frame history
 */
export async function clearFrameHistory(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove([HISTORY_KEY], () => resolve());
    });
  } else {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  }
}
