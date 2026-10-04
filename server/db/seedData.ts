export interface Product {
  id: string;
  name: string;
  brand: string;
  modelCode: string;
  category: 'Aviator' | 'Wayfarer' | 'Round' | 'Hexagonal' | 'Sport' | 'Clubmaster' | 'Versace';
  price: number;
  originalPrice?: number;
  badge?: string;
  description: string;
  frameMaterial: string;
  polarized: boolean;
  uvProtection: string;
  suitableFaceShapes: string[];
  dimensions: {
    lensWidth: number;
    bridgeWidth: number;
    templeLength: number;
  };
  cadModelPath: string;
  activeVariantIndex: number;
  variants: {
    name: string;
    frameHex: string;
    lensHex: string;
    metalness: number;
    roughness: number;
  }[];
  pbr: {
    frameMetalness: number;
    frameRoughness: number;
    lensTransmission: number;
    lensRoughness: number;
    lensIor: number;
    lensReflectivity: number;
  };
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewsCount: number;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  hours: string;
  lat: number;
  lng: number;
  inventory: Record<string, number>;
}

export interface Review {
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

export interface PromoCoupon {
  code: string;
  discountPercentage: number;
  description: string;
  minPurchase: number;
  active: boolean;
}

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'rayban-aviator-classic',
    name: 'Aviator Classic',
    brand: 'Ray-Ban',
    modelCode: 'RB3025 001/58',
    category: 'Aviator',
    price: 228,
    originalPrice: 248,
    badge: 'Heritage Icon',
    description: 'Originally crafted for U.S. aviators in 1937, combining high-grade teardrop metallurgy with legendary G-15 optical clarity. Engineered with authentic crown optical crystal and arista gold electroplating.',
    frameMaterial: 'Polished Arista Gold Plated Alloy',
    polarized: true,
    uvProtection: 'UV400 100%',
    suitableFaceShapes: ['Oval', 'Square', 'Heart'],
    dimensions: {
      lensWidth: 58,
      bridgeWidth: 14,
      templeLength: 135,
    },
    cadModelPath: '/models/aviator/scene.gltf',
    activeVariantIndex: 0,
    variants: [
      {
        name: 'Arista Gold / Classic G-15 Green',
        frameHex: '#D4AF37',
        lensHex: '#253d2c',
        metalness: 0.95,
        roughness: 0.20,
      },
      {
        name: 'Matte Gunmetal / Polarized Jet Black',
        frameHex: '#374151',
        lensHex: '#111827',
        metalness: 0.95,
        roughness: 0.20,
      },
      {
        name: 'Polished Silver / Polarized Blue Mirror',
        frameHex: '#E2E8F0',
        lensHex: '#0284c7',
        metalness: 0.95,
        roughness: 0.20,
      },
      {
        name: 'Antique Gold / Sunset Amber',
        frameHex: '#C5A880',
        lensHex: '#b45309',
        metalness: 0.95,
        roughness: 0.20,
      },
    ],
    pbr: {
      frameMetalness: 0.95,
      frameRoughness: 0.20,
      lensTransmission: 0.88,
      lensRoughness: 0.05,
      lensIor: 1.52,
      lensReflectivity: 0.90,
    },
    inStock: true,
    stockCount: 42,
    rating: 4.9,
    reviewsCount: 1248,
  },
  {
    id: 'rayban-wayfarer-classic',
    name: 'Original Wayfarer Classic',
    brand: 'Ray-Ban',
    modelCode: 'RB2140 901',
    category: 'Wayfarer',
    price: 211,
    originalPrice: 225,
    badge: 'Best Seller',
    description: 'The most recognizable style in the history of sunglasses. Hand-carved and polished Italian Mazzucchelli acetate with distinct trapezoidal silhouette and functional front silver rivets.',
    frameMaterial: 'Hand-Polished Italian Acetate',
    polarized: true,
    uvProtection: 'UV400 100%',
    suitableFaceShapes: ['Round', 'Oval', 'Diamond'],
    dimensions: {
      lensWidth: 50,
      bridgeWidth: 22,
      templeLength: 150,
    },
    cadModelPath: '/models/wayfarer/scene.gltf',
    activeVariantIndex: 0,
    variants: [
      {
        name: 'Polished Black / Classic G-15 Green',
        frameHex: '#0D0E12',
        lensHex: '#253d2c',
        metalness: 0.0,
        roughness: 0.35,
      },
      {
        name: 'Matte Black / Polarized Jet Black',
        frameHex: '#1F2937',
        lensHex: '#111827',
        metalness: 0.0,
        roughness: 0.35,
      },
      {
        name: 'Havana Tortoise / Sunset Amber',
        frameHex: '#4A2810',
        lensHex: '#b45309',
        metalness: 0.0,
        roughness: 0.35,
      },
      {
        name: 'Translucent Grey / Polarized Blue Mirror',
        frameHex: '#64748B',
        lensHex: '#0284c7',
        metalness: 0.0,
        roughness: 0.35,
      },
    ],
    pbr: {
      frameMetalness: 0.0,
      frameRoughness: 0.35,
      lensTransmission: 0.88,
      lensRoughness: 0.05,
      lensIor: 1.52,
      lensReflectivity: 0.90,
    },
    inStock: true,
    stockCount: 38,
    rating: 4.8,
    reviewsCount: 954,
  },
  {
    id: 'rayban-hexagonal-flat',
    name: 'Hexagonal Flat Lenses',
    brand: 'Ray-Ban',
    modelCode: 'RB3548N 001',
    category: 'Hexagonal',
    price: 180,
    badge: 'Trending Now',
    description: 'The geometric evolution of round eyewear. Precision coined metal profile with crystal flat lenses, custom filigree bridge, and acetate temple tips.',
    frameMaterial: 'Fine Engraved Monel Alloy Metal',
    polarized: false,
    uvProtection: 'UV400 100%',
    suitableFaceShapes: ['Round', 'Oval', 'Heart'],
    dimensions: {
      lensWidth: 51,
      bridgeWidth: 21,
      templeLength: 145,
    },
    cadModelPath: '/models/hexagonal/scene.gltf',
    activeVariantIndex: 0,
    variants: [
      {
        name: 'Polished Gold / Classic G-15 Green',
        frameHex: '#D4AF37',
        lensHex: '#253d2c',
        metalness: 0.95,
        roughness: 0.20,
      },
      {
        name: 'Gunmetal / Sunset Amber',
        frameHex: '#334155',
        lensHex: '#b45309',
        metalness: 0.95,
        roughness: 0.20,
      },
      {
        name: 'Polished Silver / Polarized Blue Mirror',
        frameHex: '#E2E8F0',
        lensHex: '#0284c7',
        metalness: 0.95,
        roughness: 0.20,
      },
    ],
    pbr: {
      frameMetalness: 0.95,
      frameRoughness: 0.20,
      lensTransmission: 0.89,
      lensRoughness: 0.05,
      lensIor: 1.52,
      lensReflectivity: 0.90,
    },
    inStock: true,
    stockCount: 27,
    rating: 4.9,
    reviewsCount: 412,
  },
  {
    id: 'rayban-round-metal',
    name: 'Round Metal Legend',
    brand: 'Ray-Ban',
    modelCode: 'RB3447 001',
    category: 'Round',
    price: 180,
    badge: 'Heritage Icon',
    description: 'A counterculture retro legend worn by legendary musicians and artists. Features a curved brow bar, adjustable silicone nose pads, and ultra-lightweight coined metal temples.',
    frameMaterial: 'Artisan Coined Gold Alloy Metal',
    polarized: true,
    uvProtection: 'UV400 100%',
    suitableFaceShapes: ['Square', 'Heart', 'Diamond'],
    dimensions: {
      lensWidth: 50,
      bridgeWidth: 21,
      templeLength: 145,
    },
    cadModelPath: '/models/hexagonal/scene.gltf',
    activeVariantIndex: 0,
    variants: [
      {
        name: 'Bright Gold / Classic G-15 Green',
        frameHex: '#D4AF37',
        lensHex: '#253d2c',
        metalness: 0.95,
        roughness: 0.20,
      },
      {
        name: 'Brushed Copper / Copper Gradient',
        frameHex: '#9A3412',
        lensHex: '#78350f',
        metalness: 0.90,
        roughness: 0.25,
      },
    ],
    pbr: {
      frameMetalness: 0.95,
      frameRoughness: 0.20,
      lensTransmission: 0.88,
      lensRoughness: 0.05,
      lensIor: 1.52,
      lensReflectivity: 0.90,
    },
    inStock: true,
    stockCount: 19,
    rating: 4.7,
    reviewsCount: 683,
  },
  {
    id: 'oakley-radar-ev-path',
    name: 'Radar EV Path Prizm™',
    brand: 'Oakley',
    modelCode: 'OO9208 46',
    category: 'Sport',
    price: 254,
    badge: 'Pro Performance',
    description: 'Olympic-grade sports eyewear with revolutionary tall single shield Plutonite® lens, lightweight O Matter™ stress-resistant frame, and hydrophilic Unobtainium® ear-socks.',
    frameMaterial: 'Ultralight O Matter™ Polymer',
    polarized: true,
    uvProtection: 'UV400 Plutonite®',
    suitableFaceShapes: ['Oval', 'Square', 'Heart', 'Diamond'],
    dimensions: {
      lensWidth: 138,
      bridgeWidth: 10,
      templeLength: 128,
    },
    cadModelPath: '/models/wayfarer/scene.gltf',
    activeVariantIndex: 0,
    variants: [
      {
        name: 'Polished White / Polarized Sapphire Mirror',
        frameHex: '#F8FAFC',
        lensHex: '#0284c7',
        metalness: 0.0,
        roughness: 0.35,
      },
      {
        name: 'Matte Carbon / Prizm Black',
        frameHex: '#1E293B',
        lensHex: '#111827',
        metalness: 0.0,
        roughness: 0.35,
      },
    ],
    pbr: {
      frameMetalness: 0.0,
      frameRoughness: 0.35,
      lensTransmission: 0.86,
      lensRoughness: 0.05,
      lensIor: 1.52,
      lensReflectivity: 0.90,
    },
    inStock: true,
    stockCount: 31,
    rating: 4.9,
    reviewsCount: 512,
  },
  {
    id: 'versace-ve4514d',
    name: 'VE4514D Medusa',
    brand: 'Versace',
    modelCode: 'VE4514D M 53-17 145 GB1/87',
    category: 'Versace',
    price: 345,
    originalPrice: 380,
    badge: 'Iconic Luxury',
    description: 'Distinctive softened rectangular sunglasses in polished black Italian acetate, detailed with signature gold Medusa medallion coins on the hinge lugs and gold Versace lettering.',
    frameMaterial: 'Hand-Polished Black Italian Acetate',
    polarized: false,
    uvProtection: 'UV400 100%',
    suitableFaceShapes: ['Oval', 'Round', 'Heart', 'Diamond'],
    dimensions: {
      lensWidth: 53,
      bridgeWidth: 17,
      templeLength: 145,
    },
    cadModelPath: '/models/versace_ve4514d.glb',
    activeVariantIndex: 0,
    variants: [
      {
        name: 'Black Acetate / Dark Grey & Gold Medusa',
        frameHex: '#0c0d0f',
        lensHex: '#1d2124',
        metalness: 0.02,
        roughness: 0.08,
      },
      {
        name: 'Dark Havana / Warm Brown & Gold Medusa',
        frameHex: '#382013',
        lensHex: '#452814',
        metalness: 0.02,
        roughness: 0.10,
      },
    ],
    pbr: {
      frameMetalness: 0.02,
      frameRoughness: 0.08,
      lensTransmission: 0.15,
      lensRoughness: 0.02,
      lensIor: 1.52,
      lensReflectivity: 0.95,
    },
    inStock: true,
    stockCount: 18,
    rating: 5.0,
    reviewsCount: 320,
  },
];

export const SEED_STORES: StoreLocation[] = [
  {
    id: 'sh-nyc-5th-ave',
    name: 'Sunglass Hut - 5th Avenue Flagship',
    address: '600 5th Avenue',
    city: 'New York',
    state: 'NY',
    zip: '10020',
    country: 'USA',
    phone: '+1 (212) 581-2041',
    hours: 'Mon-Sat: 10am - 8pm, Sun: 11am - 6pm',
    lat: 40.7580,
    lng: -73.9772,
    inventory: {
      'rayban-aviator-classic': 14,
      'rayban-wayfarer-classic': 19,
      'rayban-hexagonal-flat': 8,
      'rayban-round-metal': 6,
      'oakley-radar-ev-path': 11,
    },
  },
  {
    id: 'sh-miami-lincoln-rd',
    name: 'Sunglass Hut - Lincoln Road Mall',
    address: '845 Lincoln Road',
    city: 'Miami Beach',
    state: 'FL',
    zip: '33139',
    country: 'USA',
    phone: '+1 (305) 534-1188',
    hours: 'Mon-Sun: 10am - 9pm',
    lat: 25.7907,
    lng: -80.1380,
    inventory: {
      'rayban-aviator-classic': 22,
      'rayban-wayfarer-classic': 15,
      'rayban-hexagonal-flat': 12,
      'rayban-round-metal': 9,
      'oakley-radar-ev-path': 18,
    },
  },
  {
    id: 'sh-la-beverly-center',
    name: 'Sunglass Hut - Beverly Center',
    address: '8500 Beverly Blvd, Suite 634',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90048',
    country: 'USA',
    phone: '+1 (310) 854-3401',
    hours: 'Mon-Sat: 10am - 8pm, Sun: 11am - 7pm',
    lat: 34.0754,
    lng: -73.9772,
    inventory: {
      'rayban-aviator-classic': 18,
      'rayban-wayfarer-classic': 24,
      'rayban-hexagonal-flat': 10,
      'rayban-round-metal': 11,
      'oakley-radar-ev-path': 7,
    },
  },
  {
    id: 'sh-london-oxford',
    name: 'Sunglass Hut - Oxford Street Flagship',
    address: '381 Oxford Street',
    city: 'London',
    state: 'Greater London',
    zip: 'W1C 2JS',
    country: 'United Kingdom',
    phone: '+44 20 7493 9201',
    hours: 'Mon-Sat: 9:30am - 8pm, Sun: 12pm - 6pm',
    lat: 51.5140,
    lng: -0.1508,
    inventory: {
      'rayban-aviator-classic': 16,
      'rayban-wayfarer-classic': 17,
      'rayban-hexagonal-flat': 9,
      'rayban-round-metal': 14,
      'oakley-radar-ev-path': 8,
    },
  },
];

export const SEED_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    productId: 'rayban-aviator-classic',
    author: 'Alexander M.',
    rating: 5,
    title: 'The gold standard of sunglasses - fitting mirror was spot on',
    comment: 'The virtual try-on IPD scaling was remarkably precise. Looked in the mirror tool and when it arrived in the mail it sat on my face exactly the same. Crystal clear optics and solid arista gold finish.',
    verifiedPurchase: true,
    faceShape: 'Oval',
    date: '2026-09-15',
    helpfulCount: 42,
  },
  {
    id: 'rev-2',
    productId: 'rayban-aviator-classic',
    author: 'Elena R.',
    rating: 5,
    title: 'Timeless luxury and stunning green G-15 tint',
    comment: 'The G-15 green lenses provide unparalleled contrast under harsh sunlight. High-quality spring hinges and comfortable silicone nose pads.',
    verifiedPurchase: true,
    faceShape: 'Square',
    date: '2026-09-08',
    helpfulCount: 29,
  },
  {
    id: 'rev-3',
    productId: 'rayban-wayfarer-classic',
    author: 'Marcus K.',
    rating: 5,
    title: 'Iconic Italian acetate that matches any outfit',
    comment: 'Substantial weight, hand-polished finish, and unmistakable silhouette. The virtual mirror helped me choose between 50mm and 54mm with confidence.',
    verifiedPurchase: true,
    faceShape: 'Round',
    date: '2026-09-12',
    helpfulCount: 35,
  },
  {
    id: 'rev-4',
    productId: 'rayban-hexagonal-flat',
    author: 'Chloe S.',
    rating: 5,
    title: 'Modern and edgy twist on the round style',
    comment: 'Flat crystal lenses catch the light so beautifully! Super lightweight and compliments my cheekbones perfectly.',
    verifiedPurchase: true,
    faceShape: 'Heart',
    date: '2026-09-18',
    helpfulCount: 19,
  },
];

export const SEED_COUPONS: PromoCoupon[] = [
  {
    code: 'SUN20',
    discountPercentage: 20,
    description: '20% Off Sunglass Hut Luxury Collection',
    minPurchase: 150,
    active: true,
  },
  {
    code: 'STUDENT15',
    discountPercentage: 15,
    description: '15% Off Student & University Special',
    minPurchase: 100,
    active: true,
  },
  {
    code: 'VIPCLUB',
    discountPercentage: 25,
    description: '25% Off Sunglass Hut Rewards VIP',
    minPurchase: 200,
    active: true,
  },
];
