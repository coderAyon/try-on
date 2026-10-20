import { detectSunglassesImage } from '../utils/sunglassesDetector';
import { getSettings } from '../utils/storage';
import { ExtensionSettings } from '../types';
import { inPageMirror } from './inPageMirror';

let currentSettings: ExtensionSettings | null = null;
const processedElements = new WeakSet<HTMLElement>();
let activeBadge: HTMLElement | null = null;
let hideBadgeTimeout: number = 0;

/**
 * Creates the floating 'Try This Frame' button DOM element
 */
function createFloatingBadge(): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'lumen-tryon-badge';
  badge.id = 'lumen-floating-tryon-badge';
  badge.innerHTML = `
    <span class="lumen-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="6" cy="14" r="4"></circle>
        <circle cx="18" cy="14" r="4"></circle>
        <path d="M14 14h-4"></path>
        <path d="M2 14l3-6h14l3 6"></path>
      </svg>
    </span>
    <span class="lumen-text">Try This Frame</span>
    <span class="lumen-sparkle">✦</span>
  `;

  badge.addEventListener('mouseenter', () => {
    window.clearTimeout(hideBadgeTimeout);
    badge.classList.add('lumen-visible');
  });

  badge.addEventListener('mouseleave', () => {
    hideBadgeTimeout = window.setTimeout(() => {
      badge.classList.remove('lumen-visible');
    }, 250);
  });

  document.body.appendChild(badge);
  return badge;
}

/**
 * Positions the floating badge near the target sunglasses image
 */
function positionBadge(badge: HTMLElement, target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;

  // Position at top-right corner with 12px margin
  const top = rect.top + scrollY + 12;
  const left = rect.right + scrollX - 160;

  badge.style.top = `${Math.max(8, top)}px`;
  badge.style.left = `${Math.max(8, left)}px`;
}

/**
 * Attaches hover listeners to a verified sunglasses element
 */
function attachHoverTrigger(element: HTMLElement) {
  const badge = activeBadge || (activeBadge = createFloatingBadge());

  const show = () => {
    if (!currentSettings?.enabled || !currentSettings?.showFloatingBadge) return;
    if (!detectSunglassesImage(element).isSunglasses) return;
    window.clearTimeout(hideBadgeTimeout);
    positionBadge(badge, element);
    badge.classList.add('lumen-visible');

    // Attach click handler: opens in-page video mirror right on the page (no website redirect)
    badge.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const textEl = badge.querySelector('.lumen-text');
      try {
        const detection = detectSunglassesImage(element);
        if (!detection.isSunglasses || !detection.highResUrl) {
          badge.classList.remove('lumen-visible');
          return;
        }

        if (textEl) textEl.textContent = 'Fitting Mirror…';
        console.log('[Lumen Anywhere] Opening in-page mirror for frame:', detection.title || detection.highResUrl);

        // Save to recent try-on history safely
        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'ADD_HISTORY',
              payload: {
                id: `hist-${Date.now()}`,
                frame: detection.highResUrl,
                imageUrl: detection.highResUrl,
                title: detection.title || 'Online Sunglasses',
                brand: detection.brand || 'Web Store',
                domain: window.location.hostname,
                timestamp: Date.now(),
              },
            }, () => {
              if (chrome.runtime?.lastError) { /* ignore */ }
            });
          }
        } catch {
          // Extension context was invalidated on reload; safely proceed with in-page mirror
        }

        // Launch in-page floating live video mirror directly on the shopping page
        await inPageMirror.open({
          frame: detection.highResUrl,
          title: detection.title,
          brand: detection.brand,
          price: detection.price,
          domain: window.location.hostname,
        });
      } catch (err: any) {
        if (!err?.message?.includes?.('Extension context invalidated')) {
          console.warn('[Lumen Anywhere] In-page mirror note:', err);
        }
      } finally {
        setTimeout(() => {
          if (textEl) textEl.textContent = 'Try This Frame';
          badge.classList.remove('lumen-visible');
        }, 1200);
      }
    };
  };

  const hide = () => {
    hideBadgeTimeout = window.setTimeout(() => {
      badge.classList.remove('lumen-visible');
    }, 300);
  };

  element.addEventListener('mouseenter', show);
  element.addEventListener('mouseleave', hide);

  // If inside a parent card/link, attach to parent as well
  const card = element.closest('.product-card, [data-asin], .pdp-image, .image-container');
  if (card && card !== element) {
    card.addEventListener('mouseenter', show);
    card.addEventListener('mouseleave', hide);
  }
}

/**
 * Scans all candidate image elements in the document
 */
function scanPageImages() {
  if (!currentSettings?.enabled) return;

  const images = document.querySelectorAll<HTMLElement>(
    'img, picture img, [data-component-type="s-product-image"] img, .product-image img, .pdp-image img, [style*="background-image"]'
  );

  images.forEach((element) => {
    if (processedElements.has(element)) return;
    processedElements.add(element);

    // Read detection on hover/click: galleries reuse images and replace URLs.
    attachHoverTrigger(element);
  });
}

/**
 * Main initialization
 */
async function init() {
  currentSettings = await getSettings();

  {
    scanPageImages();

    // Debounced mutation observer to scan lazy-loaded elements on scroll
    let debounceTimer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(scanPageImages, 350);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Listen for messages from popup or background
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_UPDATED') {
        currentSettings = message.payload;
        if (!currentSettings?.enabled && activeBadge) {
          activeBadge.classList.remove('lumen-visible');
        } else if (currentSettings?.enabled) {
          scanPageImages();
        }
      }

      if (message.type === 'SHOW_INPAGE_MIRROR' && message.payload?.frame) {
        inPageMirror.open(message.payload);
      }
    });
  }
}

// Run on document idle
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
