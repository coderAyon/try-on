export type FaceShape = 'Oval' | 'Round' | 'Square' | 'Heart' | 'Diamond';

export type EyewearCategory = 'All' | 'Aviator' | 'Wayfarer' | 'Sport' | 'Hexagonal' | 'Round' | 'Cat-Eye' | 'Prada' | 'Matsuda' | 'RayBanNew';

export interface ColorVariant {
  name: string;
  frameHex: string;
  lensHex: string;
  metalness: number;
  roughness: number;
}

export interface SunglassesProduct {
  id: string;
  name: string;
  brand: string;
  modelCode: string;
  thumbnailUrl?: string;
  model?: {
    path: string;
    nodes?: string[];
    rotationY?: number;
    lensMeshes?: string[];
    anchorMeshes?: string[];
    trimLensToAnchor?: boolean;
    localGeometry?: boolean;
    excludeNodes?: string[];
  };
  category: EyewearCategory;
  price: number;
  badge?: 'Best Seller' | 'New Arrival' | 'Heritage Icon' | 'Limited Edition' | string;
  rating?: number;
  reviewsCount?: number;
  description: string;
  frameMaterial: string;
  polarized: boolean;
  uvProtection: string;
  suitableFaceShapes: FaceShape[];
  dimensions: {
    lensWidth: number;
    bridgeWidth: number;
    templeLength: number;
  };
  activeVariantIndex: number;
  variants: ColorVariant[];
  pbr: {
    frameMetalness: number;
    frameRoughness: number;
    lensTransmission: number;
    lensRoughness: number;
    lensIor: number;
    lensReflectivity: number;
  };
  svgPreview: string;
}

export type TryOnMode = 'webcam' | 'photo' | 'demo';

export type LightingPreset = 'studio' | 'daylight' | 'golden_hour' | 'noir_luxe';

export interface FaceMeasurements {
  heightToWidth: number;
  jawToCheek: number;
  foreheadToCheek: number;
  samples: number;
  measuredAt: number;
}

export interface TrackingStats {
  fps: number;
  faceDetected: boolean;
  landmarksCount: number;
  estimatedIpdMm: number;
  trackingConfidence: number;
  depthOcclusionActive: boolean;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  distanceCm?: number;
  faceWidthMm?: number;
  faceMeasurements?: FaceMeasurements;
}

export interface CalibrationSettings {
  scale: number;
  ipdOffsetMm: number;
  verticalOffsetMm: number;
  depthOffsetMm: number;
  mirror: boolean;
}

export interface LightingConfig {
  id: LightingPreset;
  name: string;
  ambientIntensity: number;
  ambientColor: string;
  directionalIntensity: number;
  directionalColor: string;
  directionalPosition: [number, number, number];
  exposure: number;
  bgGlow: string;
}
