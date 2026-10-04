import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Product,
  StoreLocation,
  Review,
  PromoCoupon,
  SEED_PRODUCTS,
  SEED_STORES,
  SEED_REVIEWS,
  SEED_COUPONS,
} from './seedData.js';

export interface CartItem {
  id: string;
  productId: string;
  variantIndex: number;
  size: 'Standard (58mm)' | 'Large (62mm)' | string;
  quantity: number;
  unitPrice: number;
  addedAt: string;
}

export interface CartState {
  items: CartItem[];
  appliedCoupon: PromoCoupon | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
}

export interface SavedLook {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  dataUrl: string;
  capturedAt: string;
  ipdMm: number;
  faceShape: string;
}

export interface TelemetryLog {
  id: string;
  timestamp: string;
  fps: number;
  ipdMm: number;
  faceWidthMm: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  trackingConfidence: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  items: CartItem[];
  customer: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  pricing: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  paymentMethod: string;
  status: 'Processing' | 'Shipped' | 'Delivered';
  createdAt: string;
}

interface DatabaseSchema {
  products: Product[];
  stores: StoreLocation[];
  reviews: Review[];
  coupons: PromoCoupon[];
  cart: CartState;
  savedLooks: SavedLook[];
  telemetryLogs: TelemetryLog[];
  orders: Order[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

class DatabaseService {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.initializeData();
  }

  private initializeData(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(fileContent);
      } catch (err) {
        console.warn('Failed to parse database file, re-seeding:', err);
      }
    }

    const initialData: DatabaseSchema = {
      products: [...SEED_PRODUCTS],
      stores: [...SEED_STORES],
      reviews: [...SEED_REVIEWS],
      coupons: [...SEED_COUPONS],
      cart: {
        items: [],
        appliedCoupon: null,
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        shippingAmount: 0,
        total: 0,
      },
      savedLooks: [],
      telemetryLogs: [],
      orders: [],
    };

    this.persist(initialData);
    return initialData;
  }

  private persistTimeout: NodeJS.Timeout | null = null;
  private persist(dataToSave?: DatabaseSchema) {
    if (this.persistTimeout) clearTimeout(this.persistTimeout);
    this.persistTimeout = setTimeout(() => {
      try {
        const payload = dataToSave || this.data;
        fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      } catch (err) {
        // Silently ignore temporary file lock on Windows
      }
    }, 300);
  }

  // --- Products ---
  public getProducts(filters?: {
    category?: string;
    brand?: string;
    faceShape?: string;
    polarized?: boolean;
    search?: string;
  }): Product[] {
    let result = [...this.data.products];

    if (filters?.category) {
      result = result.filter(
        (p) => p.category.toLowerCase() === filters.category!.toLowerCase()
      );
    }
    if (filters?.brand) {
      result = result.filter(
        (p) => p.brand.toLowerCase() === filters.brand!.toLowerCase()
      );
    }
    if (filters?.faceShape) {
      result = result.filter((p) =>
        p.suitableFaceShapes.some(
          (shape) => shape.toLowerCase() === filters.faceShape!.toLowerCase()
        )
      );
    }
    if (filters?.polarized !== undefined) {
      result = result.filter((p) => p.polarized === filters.polarized);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.modelCode.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getProductById(id: string): Product | undefined {
    return this.data.products.find((p) => p.id === id);
  }

  // --- Cart Management ---
  public getCart(): CartState {
    this.recalculateCart();
    return this.data.cart;
  }

  public addToCart(productId: string, variantIndex: number, size: string, quantity = 1): CartState {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Product not found');

    const existingIndex = this.data.cart.items.findIndex(
      (item) => item.productId === productId && item.variantIndex === variantIndex && item.size === size
    );

    if (existingIndex > -1) {
      this.data.cart.items[existingIndex].quantity += quantity;
    } else {
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId,
        variantIndex,
        size,
        quantity,
        unitPrice: product.price,
        addedAt: new Date().toISOString(),
      };
      this.data.cart.items.push(newItem);
    }

    this.recalculateCart();
    this.persist();
    return this.data.cart;
  }

  public updateCartItem(itemId: string, quantity: number): CartState {
    if (quantity <= 0) {
      return this.removeFromCart(itemId);
    }
    const item = this.data.cart.items.find((i) => i.id === itemId);
    if (item) {
      item.quantity = quantity;
    }
    this.recalculateCart();
    this.persist();
    return this.data.cart;
  }

  public removeFromCart(itemId: string): CartState {
    this.data.cart.items = this.data.cart.items.filter((i) => i.id !== itemId);
    this.recalculateCart();
    this.persist();
    return this.data.cart;
  }

  public applyCoupon(code: string): { success: boolean; message: string; cart: CartState } {
    const coupon = this.data.coupons.find(
      (c) => c.code.toUpperCase() === code.toUpperCase() && c.active
    );

    if (!coupon) {
      return { success: false, message: 'Invalid or expired promotional code.', cart: this.data.cart };
    }

    this.data.cart.appliedCoupon = coupon;
    this.recalculateCart();
    this.persist();
    return {
      success: true,
      message: `Coupon ${coupon.code} applied! Saved ${coupon.discountPercentage}%.`,
      cart: this.data.cart,
    };
  }

  public removeCoupon(): CartState {
    this.data.cart.appliedCoupon = null;
    this.recalculateCart();
    this.persist();
    return this.data.cart;
  }

  private recalculateCart(): void {
    const subtotal = this.data.cart.items.reduce(
      (acc, item) => acc + item.unitPrice * item.quantity,
      0
    );

    let discountAmount = 0;
    if (this.data.cart.appliedCoupon && subtotal >= this.data.cart.appliedCoupon.minPurchase) {
      discountAmount = Math.round((subtotal * this.data.cart.appliedCoupon.discountPercentage) / 100);
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * 0.0825); // Standard 8.25% sales tax
    const shippingAmount = subtotal > 150 || subtotal === 0 ? 0 : 15; // Free shipping over $150
    const total = taxableAmount + taxAmount + shippingAmount;

    this.data.cart.subtotal = subtotal;
    this.data.cart.discountAmount = discountAmount;
    this.data.cart.taxAmount = taxAmount;
    this.data.cart.shippingAmount = shippingAmount;
    this.data.cart.total = total;
  }

  // --- Stores ---
  public getStores(): StoreLocation[] {
    return this.data.stores;
  }

  public getStoreStock(storeId: string, productId: string): { store: StoreLocation; inStock: boolean; count: number } | null {
    const store = this.data.stores.find((s) => s.id === storeId);
    if (!store) return null;
    const count = store.inventory[productId] || 0;
    return {
      store,
      inStock: count > 0,
      count,
    };
  }

  // --- Reviews ---
  public getReviews(productId: string): Review[] {
    return this.data.reviews.filter((r) => r.productId === productId);
  }

  public addReview(review: Omit<Review, 'id' | 'date' | 'helpfulCount'>): Review {
    const newReview: Review = {
      ...review,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      helpfulCount: 0,
    };
    this.data.reviews.unshift(newReview);
    this.persist();
    return newReview;
  }

  // --- Try-On Looks & Telemetry ---
  public saveLook(look: Omit<SavedLook, 'id' | 'capturedAt'>): SavedLook {
    const newLook: SavedLook = {
      ...look,
      id: `look-${Date.now()}`,
      capturedAt: new Date().toISOString(),
    };
    this.data.savedLooks.unshift(newLook);
    this.persist();
    return newLook;
  }

  public getSavedLooks(): SavedLook[] {
    return this.data.savedLooks;
  }

  public logTelemetry(log: Omit<TelemetryLog, 'id' | 'timestamp'>): void {
    const entry: TelemetryLog = {
      ...log,
      id: `tel-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this.data.telemetryLogs.unshift(entry);
    // Keep last 100 entries
    if (this.data.telemetryLogs.length > 100) {
      this.data.telemetryLogs = this.data.telemetryLogs.slice(0, 100);
    }
    this.persist();
  }

  // --- Orders & Checkout ---
  public createOrder(orderPayload: {
    customer: Order['customer'];
    paymentMethod: string;
  }): Order {
    if (this.data.cart.items.length === 0) {
      throw new Error('Cannot checkout with an empty bag');
    }

    const orderNumber = `SH-${Math.floor(100000 + Math.random() * 900000)}`;
    const trackingNumber = `1Z${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      orderNumber,
      trackingNumber,
      items: [...this.data.cart.items],
      customer: orderPayload.customer,
      pricing: {
        subtotal: this.data.cart.subtotal,
        discount: this.data.cart.discountAmount,
        tax: this.data.cart.taxAmount,
        shipping: this.data.cart.shippingAmount,
        total: this.data.cart.total,
      },
      paymentMethod: orderPayload.paymentMethod,
      status: 'Processing',
      createdAt: new Date().toISOString(),
    };

    this.data.orders.unshift(newOrder);

    // Clear cart after checkout
    this.data.cart.items = [];
    this.data.cart.appliedCoupon = null;
    this.recalculateCart();
    this.persist();

    return newOrder;
  }

  public getOrder(orderIdOrNumber: string): Order | undefined {
    return this.data.orders.find(
      (o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber
    );
  }
}

export const db = new DatabaseService();
