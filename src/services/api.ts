import { SunglassesProduct } from '../types';

const API_BASE = '/api';

export interface CartItemAPI {
  id: string;
  productId: string;
  variantIndex: number;
  size: string;
  quantity: number;
  unitPrice: number;
  addedAt: string;
}

export interface CartAPIResponse {
  items: CartItemAPI[];
  appliedCoupon: {
    code: string;
    discountPercentage: number;
    description: string;
  } | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
}

export interface StoreStockAPI {
  store: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    hours: string;
  };
  inStock: boolean;
  count: number;
}

export interface AdvisorAPIResponse {
  analysis: {
    detectedFaceShape: string;
    scientificReasoning: string;
    stylingAdvice: string;
    biometrics: {
      ipdMm: number;
      recommendedSize: string;
      aspectRatio: number;
    };
  };
  recommendedFrames: (SunglassesProduct & {
    matchScore: number;
    matchExplanation: string;
  })[];
}

export interface ReviewAPI {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  faceShape: string;
  date: string;
  helpfulCount: number;
}

// 1. Products API
export async function getProductsAPI(params?: {
  category?: string;
  brand?: string;
  faceShape?: string;
  search?: string;
}): Promise<SunglassesProduct[]> {
  try {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.brand) query.append('brand', params.brand);
    if (params?.faceShape) query.append('faceShape', params.faceShape);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/products?${query.toString()}`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    console.warn('Backend fetch failed, using fallback:', err);
    return [];
  }
}

// 2. Shopping Bag API
export async function getCartAPI(): Promise<CartAPIResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/cart`);
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('Failed to get cart:', err);
    return null;
  }
}

export async function addToCartAPI(
  productId: string,
  variantIndex: number,
  size: string,
  quantity = 1
): Promise<CartAPIResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, variantIndex, size, quantity }),
    });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('Failed to add to cart:', err);
    return null;
  }
}

export async function updateCartItemAPI(itemId: string, quantity: number): Promise<CartAPIResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/cart/update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantity }),
    });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('Failed to update cart item:', err);
    return null;
  }
}

export async function removeFromCartAPI(itemId: string): Promise<CartAPIResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/cart/item/${itemId}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('Failed to remove cart item:', err);
    return null;
  }
}

export async function applyCouponAPI(code: string): Promise<{ success: boolean; message: string; cart: CartAPIResponse }> {
  const res = await fetch(`${API_BASE}/cart/apply-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return await res.json();
}

// 3. AI Fit Advisor API
export async function getAIRecommendationsAPI(biometrics: {
  faceHeightToWidthRatio: number;
  jawToCheekRatio?: number;
  ipdMm: number;
  faceWidthMm?: number;
}): Promise<AdvisorAPIResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/recommendations/advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(biometrics),
    });
    const data = await res.json();
    return data.success ? data : null;
  } catch (err) {
    console.error('Failed to get advisor recommendations:', err);
    return null;
  }
}

// 4. Stores API
export async function getStoresAPI(): Promise<StoreStockAPI['store'][]> {
  try {
    const res = await fetch(`${API_BASE}/stores`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to get stores:', err);
    return [];
  }
}

export async function checkStoreStockAPI(storeId: string, productId: string): Promise<StoreStockAPI | null> {
  try {
    const res = await fetch(`${API_BASE}/stores/${storeId}/stock/${productId}`);
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('Failed to check store stock:', err);
    return null;
  }
}

// 5. Reviews API
export async function getReviewsAPI(productId: string): Promise<ReviewAPI[]> {
  try {
    const res = await fetch(`${API_BASE}/reviews/${productId}`);
    const data = await res.json();
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to get reviews:', err);
    return [];
  }
}

// 6. Try-On Looks API
export async function saveLookAPI(payload: {
  productId: string;
  productName: string;
  variantName: string;
  dataUrl: string;
  ipdMm: number;
  faceShape: string;
}) {
  try {
    const res = await fetch(`${API_BASE}/tryon/save-look`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to save look:', err);
    return { success: false };
  }
}

export async function logTelemetryAPI(payload: {
  fps: number;
  ipdMm: number;
  faceWidthMm: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  trackingConfidence: number;
}) {
  try {
    await fetch(`${API_BASE}/tryon/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget telemetry
  }
}
