import { extractHighResImageUrl, extractProductContext } from './imageExtractor';

export interface DetectionResult {
  isSunglasses: boolean;
  confidence: number;
  reason: string;
  highResUrl: string;
  title: string;
  brand: string;
  price?: number;
}

const SUNGLASS_KEYWORDS = [
  'sunglass',
  'sunglasses',
  'shades',
  'eyewear',
  'eyeglasses',
  'aviator',
  'wayfarer',
  'polarized',
  'lens',
  'optical',
  'sun glasses',
  'spectacles',
  'cat-eye',
  'browline',
  'tinted lens',
  'eyeglass frame',
];

const NEGATIVE_TOKENS = [
  'logo',
  'icon',
  'avatar',
  'badge',
  'banner',
  'footer',
  'spinner',
  'rating',
  'payment',
  'card',
  'flag',
  'sprite',
  'header',
  'nav',
  'menu',
  'button',
  'cart',
  'search',
  'user',
  'profile',
  'advertisement',
  'promo',
];

/**
 * Lightweight browser-side detector for sunglasses images.
 * Determines whether an element displays sunglasses and rejects logos, banners, or unrelated items.
 */
export function detectSunglassesImage(element: HTMLElement): DetectionResult {
  const rect = element.getBoundingClientRect();
  const width = rect.width || (element instanceof HTMLImageElement ? element.naturalWidth : 0);
  const height = rect.height || (element instanceof HTMLImageElement ? element.naturalHeight : 0);

  // 1. Size Constraints: Must be a substantial product image
  if (width < 120 || height < 50 || width * height < 10000) {
    return {
      isSunglasses: false,
      confidence: 0,
      reason: 'Image dimensions too small',
      highResUrl: '',
      title: '',
      brand: '',
    };
  }

  // 2. Aspect Ratio: Sunglasses front photos are typically horizontal (1.15 to 4.5)
  const aspect = width / height;
  if (aspect < 0.95 || aspect > 4.8) {
    return {
      isSunglasses: false,
      confidence: 0,
      reason: 'Aspect ratio incompatible with eyewear',
      highResUrl: '',
      title: '',
      brand: '',
    };
  }

  // 3. Negative Filter: Reject site logos, icons, banners, navigation graphics
  const url = extractHighResImageUrl(element);
  if (!url) {
    return {
      isSunglasses: false,
      confidence: 0,
      reason: 'No valid image URL found',
      highResUrl: '',
      title: '',
      brand: '',
    };
  }

  const combinedClassAndId = `${element.className} ${element.id} ${element.getAttribute('aria-label') || ''} ${url}`.toLowerCase();
  for (const token of NEGATIVE_TOKENS) {
    if (combinedClassAndId.includes(token)) {
      return {
        isSunglasses: false,
        confidence: 0,
        reason: `Filtered by negative token: ${token}`,
        highResUrl: '',
        title: '',
        brand: '',
      };
    }
  }

  // 4. Positive Signals Analysis
  const { title, brand, price } = extractProductContext(element);
  const searchableText = `${title} ${brand} ${element.getAttribute('alt') || ''} ${document.title} ${window.location.pathname}`.toLowerCase();

  let score = 0;

  // Keyword matches
  for (const keyword of SUNGLASS_KEYWORDS) {
    if (searchableText.includes(keyword)) {
      score += 0.35;
    }
  }

  // Page URL or domain specificity (e.g. ray-ban.com, sunglasshut.com)
  const host = window.location.hostname.toLowerCase();
  if (
    host.includes('sunglass') ||
    host.includes('ray-ban') ||
    host.includes('oakley') ||
    host.includes('eyewear') ||
    host.includes('glasses')
  ) {
    score += 0.45;
  }

  // E-commerce product wrapper proximity
  const isInsideProductContainer = !!element.closest(
    '[data-asin], .product-card, .product-item, .pdp-image, .gallery, [data-component-type="s-product-image"]'
  );
  if (isInsideProductContainer) {
    score += 0.25;
  }

  // Canonical sunglasses aspect ratio bonus (typical front shot: 1.8 - 2.8)
  if (aspect >= 1.6 && aspect <= 3.2) {
    score += 0.15;
  }

  // Decision threshold
  const isSunglasses = score >= 0.35;

  return {
    isSunglasses,
    confidence: Math.min(1.0, score),
    reason: isSunglasses ? 'Sunglasses image identified' : 'Insufficient sunglasses signals',
    highResUrl: url,
    title,
    brand,
    price,
  };
}
