import { detectSunglassesImage, DetectionResult } from '../utils/sunglassesDetector';
import { getSettings } from '../utils/storage';
import { ExtensionSettings } from '../types';

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
function attachHoverTrigger(element: HTMLElement, detection: DetectionResult) {
  const badge = activeBadge || (activeBadge = createFloatingBadge());

  const show = () => {
    if (!currentSettings?.enabled || !currentSettings?.showFloatingBadge) return;
    window.clearTimeout(hideBadgeTimeout);
    positionBadge(badge, element);
    badge.classList.add('lumen-visible');

    // Attach click handler with current detection payload
    badge.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const textEl = badge.querySelector('.lumen-text');
      if (textEl) textEl.textContent = 'Opening AR…';

      // Send to background service worker
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'OPEN_TRYON',
          payload: {
            frame: detection.highResUrl,
            title: detection.title,
            brand: detection.brand,
            price: detection.price,
            domain: window.location.hostname,
          },
        });
      }

      setTimeout(() => {
        if (textEl) textEl.textContent = 'Try This Frame';
        badge.classList.remove('lumen-visible');
      }, 1500);
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

    const checkAndAttach = () => {
      const detection = detectSunglassesImage(element);
      if (detection.isSunglasses) {
        attachHoverTrigger(element, detection);
      }
    };

    if (element instanceof HTMLImageElement && !element.complete) {
      element.addEventListener('load', checkAndAttach, { once: true });
    } else {
      checkAndAttach();
    }
  });
}

/**
 * Main initialization
 */
async function init() {
  currentSettings = await getSettings();

  if (currentSettings.enabled) {
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
    });
  }
}

// Run on document idle
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
