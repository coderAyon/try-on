export interface DetectedSunglassesFrame {
  id: string;
  src: string;
  highResSrc: string;
  alt: string;
  title: string;
  brand: string;
  price?: number;
  confidence: number;
  aspectRatio: number;
}

export interface ExtensionSettings {
  enabled: boolean;
  showFloatingBadge: boolean;
  autoDetect: boolean;
  appUrl: string;
  preferredMode: 'webcam' | 'photo';
}

export interface FrameHistoryItem {
  id: string;
  imageUrl: string;
  title: string;
  brand: string;
  domain: string;
  timestamp: number;
}

export type ExtensionMessageType =
  | 'OPEN_TRYON'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_HISTORY'
  | 'ADD_HISTORY'
  | 'CLEAR_HISTORY'
  | 'CHECK_STATUS'
  | 'FETCH_IMAGE_DATA_URL'
  | 'GENERATE_FRAME_3D'
  | 'SHOW_INPAGE_MIRROR';

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: any;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  showFloatingBadge: true,
  autoDetect: true,
  appUrl: 'http://localhost:3000',
  preferredMode: 'webcam',
};
