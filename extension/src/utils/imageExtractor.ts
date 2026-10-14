/**
 * Robust Image Extraction System for E-Commerce and General Webpages
 * Extracts maximum resolution product image URLs from:
 * - img tags
 * - srcset (picks largest resolution)
 * - data-src / lazy-loaded attributes
 * - Amazon dynamic JSON image attributes (data-a-dynamic-image)
 * - background-image CSS
 * - picture and source tags
 */

export interface ExtractedImageMetadata {
  url: string;
  alt: string;
  title: string;
  brand: string;
  price?: number;
  width: number;
  height: number;
}

const COMMON_SUNGLASS_BRANDS = [
  'Ray-Ban',
  'Oakley',
  'Prada',
  'Gucci',
  'Tom Ford',
  'Persol',
  'Maui Jim',
  'Versace',
  'Burberry',
  'Carrera',
  'Saint Laurent',
  'Oliver Peoples',
  'Dior',
  'Chanel',
  'Balenciaga',
  'Gentle Monster',
  'Hawkers',
  'Quay',
  'Warby Parker',
  'Costa Del Mar',
  'Polaroid',
];

/**
 * Parses srcset string and extracts URL with the highest resolution width/density
 */
export function extractHighestResFromSrcset(srcset: string): string | null {
  if (!srcset || typeof srcset !== 'string') return null;
  const entries = srcset.split(',').map((entry) => entry.trim());
  let bestUrl = '';
  let bestWidth = 0;

  for (const entry of entries) {
    const parts = entry.split(/\s+/);
    if (parts.length >= 2) {
      const url = parts[0];
      const descriptor = parts[1];
      let width = 0;
      if (descriptor.endsWith('w')) {
        width = parseInt(descriptor.slice(0, -1), 10);
      } else if (descriptor.endsWith('x')) {
        width = parseFloat(descriptor.slice(0, -1)) * 1000;
      }
      if (width > bestWidth) {
        bestWidth = width;
        bestUrl = url;
      }
    } else if (parts.length === 1 && !bestUrl) {
      bestUrl = parts[0];
    }
  }

  return bestUrl || null;
}

/**
 * Handles Amazon's special data-a-dynamic-image attribute (JSON object of URL -> [w, h])
 */
function extractFromAmazonDynamicJson(element: HTMLElement): string | null {
  const dynamicAttr = element.getAttribute('data-a-dynamic-image');
  if (!dynamicAttr) return null;
  try {
    const parsed = JSON.parse(dynamicAttr);
    let bestUrl = '';
    let maxPixels = 0;
    for (const [url, dims] of Object.entries(parsed)) {
      if (Array.isArray(dims) && dims.length >= 2) {
        const area = (dims[0] as number) * (dims[1] as number);
        if (area > maxPixels) {
          maxPixels = area;
          bestUrl = url;
        }
      }
    }
    return bestUrl || null;
  } catch {
    return null;
  }
}

/**
 * Upgrades thumbnail URL strings to high-resolution variants for Shopify, Amazon, etc.
 */
function upgradeImageUrlResolution(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  let url = rawUrl;

  // Shopify: _small, _medium, _compact, _100x100 -> _master or _1600x1600
  if (url.includes('cdn.shopify.com')) {
    url = url.replace(/_(small|medium|compact|grande|\d+x\d+)\.(jpg|jpeg|png|webp)/i, '_master.$2');
  }

  // Amazon: remove dynamic crop tokens like ._SX300_ or ._AC_UL320_
  if (url.includes('media-amazon.com') || url.includes('images-amazon.com')) {
    url = url.replace(/\._[A-Z0-9,]+_\./, '.');
  }

  return url;
}

/**
 * Extracts high-res product image URL from any HTML Element
 */
export function extractHighResImageUrl(element: HTMLElement): string {
  // 1. Amazon dynamic JSON
  const amazonUrl = extractFromAmazonDynamicJson(element);
  if (amazonUrl) return upgradeImageUrlResolution(amazonUrl);

  // 2. High-res data attributes
  const dataAttributes = [
    'data-high-res-src',
    'data-zoom-image',
    'data-old-hires',
    'data-large-image',
    'data-zoom',
    'data-original',
    'data-full',
    'data-src',
    'data-lazy-src',
    'data-hero-image',
  ];

  for (const attr of dataAttributes) {
    const val = element.getAttribute(attr);
    if (val && val.startsWith('http')) {
      return upgradeImageUrlResolution(val);
    }
  }

  // 3. srcset on img or picture source
  const srcset = element.getAttribute('srcset') || element.getAttribute('data-srcset');
  if (srcset) {
    const bestSrcset = extractHighestResFromSrcset(srcset);
    if (bestSrcset) return upgradeImageUrlResolution(bestSrcset);
  }

  if (element.parentElement && element.parentElement.tagName.toLowerCase() === 'picture') {
    const sources = element.parentElement.querySelectorAll('source');
    for (const source of sources) {
      const srcsetAttribute = source.getAttribute('srcset');
      if (srcsetAttribute) {
        const best = extractHighestResFromSrcset(srcsetAttribute);
        if (best) return upgradeImageUrlResolution(best);
      }
    }
  }

  // 4. Standard img src
  if (element instanceof HTMLImageElement && element.src) {
    return upgradeImageUrlResolution(element.currentSrc || element.src);
  }

  // 5. CSS background-image
  const style = window.getComputedStyle(element);
  const bg = style.backgroundImage;
  if (bg && bg.startsWith('url(')) {
    const match = /url\(['"]?(.*?)['"]?\)/.exec(bg);
    if (match && match[1] && !match[1].startsWith('data:')) {
      return upgradeImageUrlResolution(match[1]);
    }
  }

  return '';
}

/**
 * Extracts product title and brand from surrounding DOM context
 */
export function extractProductContext(element: HTMLElement): {
  title: string;
  brand: string;
  price?: number;
} {
  let title = '';
  let brand = '';
  let price: number | undefined;

  // 1. Inspect img alt and title
  if (element instanceof HTMLImageElement) {
    title = (element.alt || element.title || '').trim();
  }

  // 2. Traverse up to 5 ancestor container levels to find product card info
  let current: HTMLElement | null = element.parentElement;
  let depth = 0;

  while (current && depth < 6) {
    // Title from heading or product name selector
    if (!title || title.length < 5) {
      const titleElem = current.querySelector(
        'h1, h2, h3, .product-title, .product-name, [data-component-type="s-product-image"] + div h2, .pdp-title, [itemprop="name"]'
      );
      if (titleElem && titleElem.textContent) {
        title = titleElem.textContent.trim();
      }
    }

    // Price
    if (!price) {
      const priceElem = current.querySelector(
        '.price, .product-price, .a-price .a-offscreen, [data-test="product-price"], [itemprop="price"]'
      );
      if (priceElem && priceElem.textContent) {
        const cleaned = priceElem.textContent.replace(/[^0-9.]/g, '');
        const parsed = parseFloat(cleaned);
        if (parsed > 0) price = parsed;
      }
    }

    // Brand from container attribute or text
    if (!brand) {
      const brandElem = current.querySelector('.brand, .product-brand, [itemprop="brand"]');
      if (brandElem && brandElem.textContent) {
        brand = brandElem.textContent.trim();
      }
    }

    current = current.parentElement;
    depth++;
  }

  // 3. Fallback title from page title
  if (!title || title.length < 4) {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    title = ogTitle || document.title || 'Sunglasses Frame';
  }

  // 4. Identify brand from known list if not found
  if (!brand) {
    const combinedText = `${title} ${window.location.hostname}`.toLowerCase();
    for (const b of COMMON_SUNGLASS_BRANDS) {
      if (combinedText.includes(b.toLowerCase())) {
        brand = b;
        break;
      }
    }
  }

  if (!brand) {
    const host = window.location.hostname.replace(/^www\./, '').split('.')[0];
    brand = host.charAt(0).toUpperCase() + host.slice(1);
  }

  return { title, brand, price };
}
