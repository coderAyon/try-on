import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { SUNGLASSES_CATALOG } from './data/catalog';
import {
  SunglassesProduct,
  TryOnMode,
  LightingPreset,
  TrackingStats,
  CalibrationSettings,
  SavedLook,
  UserProfile,
} from './types';
import { Header } from './components/Navigation/Header';
import { Sidebar } from './components/Navigation/Sidebar';
import { FindYourFitCard } from './components/Navigation/FindYourFitCard';
import { ViewportContainer } from './components/Viewport/ViewportContainer';
import { FrameSelectorPanel } from './components/Catalog/FrameSelectorPanel';
import { InstructionBanner } from './components/Instruction/InstructionBanner';
import { SnapshotPreviewModal } from './components/Controls/SnapshotPreviewModal';
import { AIFitAdvisorModal } from './components/Modals/AIFitAdvisorModal';
import { soundEffects } from './utils/audio';
import { CheckCircle2, X, ArrowRight, Sparkles } from 'lucide-react';
import {
  getProductsAPI,
  saveLookAPI,
  deleteLookAPI,
  clearAllLooksAPI,
  logTelemetryAPI,
  getSavedLooksAPI,
} from './services/api';
import { ProductDetailsPage } from './components/Catalog/ProductDetailsPage';
import { PhotoTryOnPage } from './components/Viewport/PhotoTryOnPage';
import { GalleryPage } from './components/Gallery/GalleryPage';
import { AccountDrawer } from './components/Navigation/AccountDrawer';

export const App: React.FC = () => {
  const [detailId, setDetailId] = useState<string | null>(() =>
    window.location.hash.startsWith('#frame/')
      ? decodeURIComponent(window.location.hash.slice(7))
      : null
  );
  const [photoPage, setPhotoPage] = useState<boolean>(
    () => window.location.hash === '#photo'
  );
  const [activeNav, setActiveNav] = useState<string>(() =>
    window.location.hash === '#photo'
      ? 'upload-photos'
      : window.location.hash === '#gallery'
      ? 'gallery'
      : window.location.hash.startsWith('#frame/')
      ? 'frames'
      : 'try-on'
  );

  // Gallery saved looks state (persisted to localStorage & synced with backend)
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>(() => {
    try {
      const local = localStorage.getItem('lumen_vision_gallery_looks');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          // Filter out legacy automated black test runs from September
          return parsed.filter(
            (l: any) =>
              l.dataUrl &&
              l.dataUrl.length > 50000 &&
              !l.capturedAt?.startsWith('2026-09-29') &&
              !l.productName?.includes('Model Library Fly') &&
              !l.productName?.includes('Model Library White')
          );
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Snapshot Toast Notification state
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    title: string;
    productName: string;
    dataUrl: string;
  } | null>(null);

  // Current logged in user profile
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const local = localStorage.getItem('lumen_user');
      return local ? JSON.parse(local) : null;
    } catch {
      return null;
    }
  });

  // Account Drawer state (mini right-side slide-over panel)
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState<boolean>(false);

  // Dark mode theme state (persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const local = localStorage.getItem('lumen_theme');
      if (local) return local === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const isThemeTransitioningRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('lumen_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('lumen_theme', 'light');
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDarkMode]);

  const handleToggleTheme = useCallback(() => {
    if (isThemeTransitioningRef.current) return;
    soundEffects.playClick();

    const newDarkMode = !isDarkMode;

    const performThemeUpdate = () => {
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
        try { localStorage.setItem('lumen_theme', 'dark'); } catch {}
      } else {
        document.documentElement.classList.remove('dark');
        try { localStorage.setItem('lumen_theme', 'light'); } catch {}
      }
      setIsDarkMode(newDarkMode);
    };

    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return;

    // Use native View Transitions API if supported (Chrome 111+, Edge 111+, Safari 18+)
    if (typeof (doc as any).startViewTransition === 'function') {
      isThemeTransitioningRef.current = true;
      try {
        const transition = (doc as any).startViewTransition(() => {
          flushSync(() => {
            performThemeUpdate();
          });
        });
        transition.finished
          .catch(() => {})
          .finally(() => {
            isThemeTransitioningRef.current = false;
          });
      } catch {
        // Fallback in case startViewTransition throws unexpectedly
        doc.documentElement.classList.add('theme-transitioning');
        performThemeUpdate();
        setTimeout(() => {
          doc.documentElement.classList.remove('theme-transitioning');
          isThemeTransitioningRef.current = false;
        }, 380);
      }
    } else {
      isThemeTransitioningRef.current = true;
      doc.documentElement.classList.add('theme-transitioning');
      performThemeUpdate();
      setTimeout(() => {
        doc.documentElement.classList.remove('theme-transitioning');
        isThemeTransitioningRef.current = false;
      }, 380);
    }
  }, [isDarkMode]);

  const [products, setProducts] = useState<SunglassesProduct[]>(SUNGLASSES_CATALOG);
  const [activeProduct, setActiveProduct] = useState<SunglassesProduct>(SUNGLASSES_CATALOG[0]);
  const [variantIndex, setVariantIndex] = useState<number>(0);

  // Wishlist state (persisted in local state)
  const [wishlist, setWishlist] = useState<string[]>(['aviator', 'cat-eye']);

  const [mode, setMode] = useState<TryOnMode>('webcam');
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(true);
  const [cameraSession, setCameraSession] = useState<number>(1);
  const [cameraState, setCameraState] = useState<{ message: string; error: string }>({
    message: 'Starting camera…',
    error: '',
  });

  const enableCamera = () => {
    setDetailId(null);
    setPhotoPage(false);
    window.location.hash = '';
    setMode('webcam');
    setCameraState({ message: 'Starting camera…', error: '' });
    setCameraEnabled(true);
    setCameraSession((n) => n + 1);
  };

  const changeMode = (next: TryOnMode) => {
    if (next === 'photo') {
      setPhotoPage(true);
      window.location.hash = 'photo';
      setActiveNav('upload-photos');
    }
    if (next !== 'webcam') setCameraEnabled(false);
    setStats((previous) => ({
      ...previous,
      faceDetected: false,
      faceMeasurements: undefined,
    }));
    setMode(next);
  };

  const [mirror, setMirror] = useState<boolean>(true);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // External try-on state (from Extension or URL parameters)
  const [externalImportInfo, setExternalImportInfo] = useState<{
    sourceUrl: string;
    name: string;
    brand: string;
    price?: number;
  } | null>(null);

  const handleLoadExternalFrame = useCallback(
    (params: {
      frame: string;
      title?: string;
      brand?: string;
      price?: number;
      mode?: TryOnMode;
    }) => {
      if (!params.frame) return;

      const newId = `ext-${Date.now()}`;
      const extProduct: SunglassesProduct = {
        id: newId,
        name: params.title || 'Online Sunglasses Frame',
        brand: params.brand || 'Web Store',
        modelCode: 'EXT-TRYON-VTO',
        thumbnailUrl: params.frame,
        customFrameUrl: params.frame,
        isExternal: true,
        externalSourceUrl: params.frame,
        category: 'Wayfarer',
        price: params.price || 199,
        badge: 'Web Import',
        rating: 5.0,
        reviewsCount: 1,
        description: `Imported via Anywhere Sunglasses Extension from ${params.brand || 'online store'}. Full 3D/AR face tracking and occlusion active.`,
        frameMaterial: 'Extracted Product Frame',
        polarized: true,
        uvProtection: 'UV400',
        suitableFaceShapes: ['Oval', 'Round', 'Square', 'Heart', 'Diamond'],
        dimensions: {
          lensWidth: 54,
          bridgeWidth: 18,
          templeLength: 140,
        },
        activeVariantIndex: 0,
        variants: [
          {
            name: 'Original Web Photo',
            frameHex: '#18181b',
            lensHex: '#09090b',
            metalness: 0.1,
            roughness: 0.2,
          },
        ],
        pbr: {
          frameMetalness: 0.1,
          frameRoughness: 0.2,
          lensTransmission: 0.8,
          lensRoughness: 0.05,
          lensIor: 1.52,
          lensReflectivity: 0.85,
        },
        svgPreview: '',
      };

      setProducts((prev) => {
        const filtered = prev.filter((p) => !p.id.startsWith('ext-'));
        return [extProduct, ...filtered];
      });
      setActiveProduct(extProduct);
      setVariantIndex(0);
      setDetailId(null);
      setExternalImportInfo({
        sourceUrl: params.frame,
        name: params.title || 'Online Frame',
        brand: params.brand || 'Web Store',
        price: params.price,
      });

      if (params.mode === 'photo') {
        setPhotoPage(true);
        window.location.hash = 'photo';
        setActiveNav('upload-photos');
        setCameraEnabled(false);
        setMode('photo');
      } else {
        setPhotoPage(false);
        setMode('webcam');
        setCameraEnabled(true);
        setActiveNav('try-on');
        setCameraState({ message: 'Starting camera…', error: '' });
        setCameraSession((n) => n + 1);
      }

      setToastNotification({
        id: String(Date.now()),
        title: 'Anywhere Frame Imported!',
        productName: `${params.brand ? params.brand + ' ' : ''}${params.title || 'Sunglasses'}`,
        dataUrl: params.frame,
      });
    },
    []
  );

  // Modals state
  const [isFitAdvisorOpen, setIsFitAdvisorOpen] = useState<boolean>(false);
  const [snapshotTrigger, setSnapshotTrigger] = useState<number>(0);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(
    '/models_faces/female_oval.jpg'
  );

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationSettings>({
    scale: 1.0,
    ipdOffsetMm: 0,
    verticalOffsetMm: 0,
    depthOffsetMm: 0,
    mirror: true,
  });

  // Tracking telemetry
  const [stats, setStats] = useState<TrackingStats>({
    fps: 60,
    faceDetected: false,
    landmarksCount: 0,
    estimatedIpdMm: 63.0,
    trackingConfidence: 0,
    depthOcclusionActive: true,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
  });

  const lastTelemetryLogRef = useRef<number>(0);

  // Persist gallery looks locally
  useEffect(() => {
    try {
      localStorage.setItem('lumen_vision_gallery_looks', JSON.stringify(savedLooks));
    } catch (err) {
      console.warn('Could not persist gallery looks:', err);
    }
  }, [savedLooks]);

  // Auto-dismiss toast notification after 4.5s
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Sync looks from backend on mount (filtering out legacy automated test frames)
  useEffect(() => {
    getSavedLooksAPI().then((apiLooks) => {
      if (apiLooks && apiLooks.length > 0) {
        setSavedLooks((prev) => {
          const merged = [...prev];
          for (const look of apiLooks) {
            if (
              look.dataUrl &&
              look.dataUrl.length > 50000 &&
              !look.capturedAt?.startsWith('2026-09-29') &&
              !look.productName?.includes('Model Library Fly') &&
              !look.productName?.includes('Model Library White') &&
              !merged.some((m) => m.id === look.id)
            ) {
              merged.push(look);
            }
          }
          return merged;
        });
      }
    });
  }, []);

  // Hash synchronization
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      const id = hash.startsWith('#frame/')
        ? decodeURIComponent(hash.slice(7))
        : null;
      setDetailId(id);
      const isPhoto = hash === '#photo';
      setPhotoPage(isPhoto);
      const isGallery = hash === '#gallery';

      if (isPhoto) {
        setCameraEnabled(false);
        setActiveNav('upload-photos');
      } else if (isGallery) {
        setCameraEnabled(false);
        setActiveNav('gallery');
      } else if (id) {
        setCameraEnabled(false);
        setActiveNav('frames');
      } else {
        setActiveNav('try-on');
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // Check for external extension try-on requests via URL, PostMessage, and LocalStorage
  useEffect(() => {
    const checkExternalUrl = () => {
      let params: URLSearchParams | null = null;
      if (window.location.hash.includes('?')) {
        params = new URLSearchParams(window.location.hash.slice(window.location.hash.indexOf('?') + 1));
      } else if (window.location.search) {
        params = new URLSearchParams(window.location.search);
      }
      if (params) {
        const frame = params.get('frame') || params.get('image') || params.get('url');
        if (frame) {
          handleLoadExternalFrame({
            frame,
            title: params.get('title') || params.get('name') || undefined,
            brand: params.get('brand') || params.get('site') || undefined,
            price: params.get('price') ? parseFloat(params.get('price')!) : undefined,
            mode: params.get('mode') === 'photo' ? 'photo' : 'webcam',
          });
        }
      }
    };

    checkExternalUrl();
    window.addEventListener('hashchange', checkExternalUrl);

    try {
      const pending = localStorage.getItem('lumen_pending_external_frame');
      if (pending) {
        localStorage.removeItem('lumen_pending_external_frame');
        const parsed = JSON.parse(pending);
        if (parsed?.frame) handleLoadExternalFrame(parsed);
      }
    } catch {}

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'LUMEN_TRYON_FRAME' && event.data?.frame) {
        handleLoadExternalFrame(event.data);
      }
    };
    window.addEventListener('message', handleMessage);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'lumen_pending_external_frame' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          localStorage.removeItem('lumen_pending_external_frame');
          if (parsed?.frame) handleLoadExternalFrame(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('hashchange', checkExternalUrl);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [handleLoadExternalFrame]);

  useEffect(() => {
    const product = products.find((p) => p.id === detailId);
    if (product) {
      setActiveProduct(product);
      setVariantIndex(product.activeVariantIndex || 0);
    } else if (detailId) {
      setDetailId(null);
      if (window.location.hash.startsWith('#frame/')) window.location.hash = '';
    }
  }, [detailId, products]);

  const openDetails = (product: SunglassesProduct) => {
    setActiveProduct(product);
    setVariantIndex(product.activeVariantIndex || 0);
    setCameraEnabled(false);
    setDetailId(product.id);
    window.location.hash = `frame/${encodeURIComponent(product.id)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeDetails = () => {
    setDetailId(null);
    setPhotoPage(false);
    window.location.hash = '';
    setMode('webcam');
    setActiveNav('try-on');
    setCameraEnabled(true);
  };

  // Load products from backend on mount
  useEffect(() => {
    const initializeBackendData = async () => {
      try {
        const fetchedProducts = await getProductsAPI();
        if (fetchedProducts.length > 0) {
          const merged = [...fetchedProducts];
          for (const local of SUNGLASSES_CATALOG) {
            if (!merged.some((product) => product.id === local.id)) merged.push(local);
          }
          setProducts(merged);
          const current =
            fetchedProducts.find((p) => p.id === activeProduct.id) || fetchedProducts[0];
          setActiveProduct(current);
        }
      } catch (err) {
        console.warn('Backend connection fallback to local catalog:', err);
      }
    };

    initializeBackendData();
  }, []);

  // Periodic CV telemetry logging to backend (throttled to every 5s)
  useEffect(() => {
    if (!stats.faceDetected) return;
    const now = Date.now();
    if (now - lastTelemetryLogRef.current > 5000) {
      lastTelemetryLogRef.current = now;
      logTelemetryAPI({
        fps: stats.fps,
        ipdMm: stats.estimatedIpdMm,
        faceWidthMm: stats.faceWidthMm || 139,
        headYaw: stats.headYaw,
        headPitch: stats.headPitch,
        headRoll: stats.headRoll,
        trackingConfidence: stats.trackingConfidence,
      });
    }
  }, [stats]);

  // Handlers
  const handleSelectProduct = (product: SunglassesProduct) => {
    soundEffects.playTryOnChime();
    setActiveProduct(product);
    setVariantIndex(product.activeVariantIndex || 0);
  };

  const handleVariantChange = (newVariantIndex: number) => {
    setVariantIndex(newVariantIndex);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === activeProduct.id ? { ...p, activeVariantIndex: newVariantIndex } : p
      )
    );
  };

  const handleResetCalibration = () => {
    setCalibration({
      scale: 1.0,
      ipdOffsetMm: 0,
      verticalOffsetMm: 0,
      depthOffsetMm: 0,
      mirror: true,
    });
  };

  const handleFileUpload = (file: File) => {
    soundEffects.playClick();
    const url = URL.createObjectURL(file);
    setCustomPhotoUrl(url);
    changeMode('photo');
  };

  const handleCaptureSnapshot = () => {
    setSnapshotTrigger(Date.now());
  };

  const handleSnapshotReady = useCallback(
    (dataUrl: string) => {
      setSnapshotDataUrl(dataUrl);
      setSnapshotTrigger(0);

      const currentVariant =
        activeProduct.variants[variantIndex] || activeProduct.variants[0];

      const newLook: SavedLook = {
        id: `look_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: activeProduct.id,
        productName: `${activeProduct.brand} ${activeProduct.name}`,
        variantName: currentVariant.name,
        dataUrl,
        capturedAt: new Date().toISOString(),
        ipdMm: stats.estimatedIpdMm,
        faceShape: 'Oval',
      };

      setSavedLooks((prev) => [newLook, ...prev]);

      saveLookAPI({
        productId: activeProduct.id,
        productName: `${activeProduct.brand} ${activeProduct.name}`,
        variantName: currentVariant.name,
        dataUrl,
        ipdMm: stats.estimatedIpdMm,
        faceShape: 'Oval',
      });

      // Show real-time floating Toast Notification
      setToastNotification({
        id: `toast-${Date.now()}`,
        title: 'Snapshot Saved to Gallery!',
        productName: `${activeProduct.brand} ${activeProduct.name}`,
        dataUrl,
      });
    },
    [activeProduct, variantIndex, stats.estimatedIpdMm]
  );

  const handleToggleAudio = () => {
    const enabled = soundEffects.toggleSound();
    setIsAudioMuted(!enabled);
  };

  const handleToggleWishlist = (productId: string) => {
    soundEffects.playClick();
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleNavChange = (nav: string) => {
    soundEffects.playClick();
    setActiveNav(nav);

    if (nav === 'try-on') {
      closeDetails();
    } else if (nav === 'upload-photos') {
      setDetailId(null);
      setPhotoPage(true);
      window.location.hash = 'photo';
    } else if (nav === 'gallery') {
      setDetailId(null);
      setPhotoPage(false);
      setCameraEnabled(false);
      window.location.hash = 'gallery';
    } else if (nav === 'frames') {
      openDetails(activeProduct);
    } else if (nav === 'settings') {
      setIsAccountDrawerOpen(true);
    } else if (nav === 'about') {
      handleOpenGlassFinder();
    }
  };

  const handleDeleteLook = (id: string) => {
    soundEffects.playClick();
    setSavedLooks((prev) => prev.filter((look) => look.id !== id));
    deleteLookAPI(id);
  };

  const handleClearAllLooks = () => {
    soundEffects.playClick();
    setSavedLooks([]);
    clearAllLooksAPI();
    try {
      localStorage.removeItem('lumen_vision_gallery_looks');
    } catch {}
  };

  const handleSelectLookForTryOn = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      handleSelectProduct(product);
    }
    closeDetails();
  };

  const handleUserLogin = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('lumen_user', JSON.stringify(user));
    } catch {}
  };

  const handleUserLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('lumen_user');
    } catch {}
  };

  const handleOpenGlassFinder = () => {
    soundEffects.playClick();
    if (!cameraEnabled) {
      enableCamera();
    }
    setIsFitAdvisorOpen(true);
  };

  return (
    <div className={`relative min-h-screen ${isDarkMode ? 'bg-[#070b14]' : 'bg-[#f5f6fb]'} text-[#161132] dark:text-slate-100 font-sans flex flex-col justify-between selection:bg-[#6355f6] selection:text-white pb-6 overflow-x-hidden transition-colors duration-300`}>
      {/* Ambient Mesh Gradient Glow Orbs (Bluish Dark Premium Atmosphere) */}
      <div className="fixed top-[-100px] left-[-80px] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#6355f6]/12 dark:from-indigo-600/25 to-[#8b5cf6]/5 dark:to-cyan-600/10 blur-3xl pointer-events-none z-0 transition-all duration-700 ease-in-out will-change-transform" />
      <div className="fixed top-[30%] right-[-100px] w-[550px] h-[550px] rounded-full bg-gradient-to-bl from-[#38bdf8]/10 dark:from-blue-600/20 via-[#818cf8]/6 dark:via-indigo-500/15 to-transparent blur-3xl pointer-events-none z-0 transition-all duration-700 ease-in-out will-change-transform" />
      <div className="fixed bottom-[-80px] left-[25%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-[#ec4899]/8 dark:from-cyan-500/15 via-[#a855f7]/5 dark:via-blue-600/10 to-transparent blur-3xl pointer-events-none z-0 transition-all duration-700 ease-in-out will-change-transform" />
      {/* Subtle bluish radial sheen in dark mode with smooth opacity fade */}
      <div className={`fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.08),rgba(255,255,255,0))] transition-opacity duration-500 ease-in-out z-0 ${isDarkMode ? 'opacity-100' : 'opacity-0'}`} />

      {/* 1. Top Navigation Bar */}
      <Header
        activeNav={activeNav}
        onNavChange={handleNavChange}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        onOpenProfile={() => setIsAccountDrawerOpen(true)}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Main Page Layout */}
      <main className="relative z-10 w-full max-w-[1440px] mx-auto px-3 sm:px-6 flex-1 flex flex-col gap-4 sm:gap-5 mt-1 sm:mt-2">
        {externalImportInfo && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-950/85 via-purple-900/70 to-slate-900/85 border border-violet-500/30 text-white backdrop-blur-xl shadow-[0_8px_32px_rgba(109,40,217,0.25)] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-violet-300">⚡ Anywhere Try-On:</span>
                <span className="font-medium text-white">
                  {externalImportInfo.brand} · {externalImportInfo.name}
                </span>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                Live AR 3D Tracking
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMode(mode === 'webcam' ? 'photo' : 'webcam')}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/40 hover:bg-violet-600/60 text-violet-200 border border-violet-400/30 font-medium transition-all"
              >
                Switch to {mode === 'webcam' ? 'Photo Mode' : 'Webcam AR'}
              </button>
              <button
                onClick={() => {
                  setExternalImportInfo(null);
                  setActiveProduct(SUNGLASSES_CATALOG[0]);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 font-medium transition-all"
              >
                Reset to Catalog
              </button>
            </div>
          </div>
        )}
        {activeNav === 'gallery' ? (
          <GalleryPage
            savedLooks={savedLooks}
            products={products}
            onSelectProductForTryOn={handleSelectLookForTryOn}
            onDeleteLook={handleDeleteLook}
            onClearAllLooks={handleClearAllLooks}
            onBackToFittingRoom={closeDetails}
          />
        ) : photoPage ? (
          <PhotoTryOnPage
            products={products}
            product={activeProduct}
            onSelect={handleSelectProduct}
            onBack={closeDetails}
          />
        ) : detailId ? (
          <ProductDetailsPage
            product={activeProduct}
            variantIndex={variantIndex}
            onVariantChange={handleVariantChange}
            onBack={closeDetails}
            onTryOn={closeDetails}
          />
        ) : (
          /* Main 2-Row Layout */
          <div className="flex flex-col gap-5">
            {/* Upper Row: Left Sidebar (Nav) + Right (Camera Viewport & Frame Selector) */}
            <div className="flex flex-col lg:flex-row gap-5 items-stretch">
              {/* Left Column: Navigation Sidebar */}
              <Sidebar
                activeTab={activeNav}
                onTabChange={handleNavChange}
              />

              {/* Right: Live Camera Preview & Select Your Frame */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-w-0">
                {/* Center: Large Rounded Camera Preview with Corner Brackets & Controls */}
                <div className="lg:col-span-7 flex flex-col h-full min-h-0">
                  <ViewportContainer
                    product={activeProduct}
                    variantIndex={variantIndex}
                    mode={mode}
                    onModeChange={changeMode}
                    cameraEnabled={cameraEnabled}
                    onEnableCamera={enableCamera}
                    cameraSession={cameraSession}
                    cameraError={cameraState.error}
                    onCameraStateChange={(message, error) =>
                      setCameraState({ message, error })
                    }
                    onStopCamera={() => {
                      setCameraEnabled(false);
                      setStats((previous) => ({
                        ...previous,
                        faceDetected: false,
                        faceMeasurements: undefined,
                      }));
                    }}
                    stats={stats}
                    onStatsUpdate={setStats}
                    mirror={mirror}
                    onToggleMirror={() => setMirror(!mirror)}
                    lightingPreset={lightingPreset}
                    onLightingChange={setLightingPreset}
                    calibration={calibration}
                    onCalibrationChange={setCalibration}
                    onResetCalibration={handleResetCalibration}
                    onCaptureSnapshot={handleCaptureSnapshot}
                    onSnapshotReady={handleSnapshotReady}
                    snapshotTrigger={snapshotTrigger}
                    customPhotoUrl={customPhotoUrl}
                    onFileUpload={handleFileUpload}
                    onSelectModel={(url) => setCustomPhotoUrl(url)}
                  />
                </div>

                {/* Right: Select Your Frame Panel with Categories, 6 Frames Grid & Arrow */}
                <div className="lg:col-span-5 flex flex-col h-full min-h-0">
                  <FrameSelectorPanel
                    products={products}
                    activeProduct={activeProduct}
                    onSelectProduct={handleSelectProduct}
                    onViewAll={() => openDetails(activeProduct)}
                    wishlist={wishlist}
                    onToggleWishlist={handleToggleWishlist}
                  />
                </div>
              </div>
            </div>

            {/* Lower Row: Parallel Alignment - Left ("Find Your Perfect Fit" Card) + Right ("Interactive Try-On" Banner) */}
            <div className="flex flex-col lg:flex-row gap-5 items-stretch">
              {/* Left Column: Find Your Perfect Fit Card (Parallel with Instruction Banner) */}
              <div className="w-full lg:w-[210px] xl:w-[224px] flex-shrink-0 flex flex-col">
                <FindYourFitCard onOpenFitAdvisor={handleOpenGlassFinder} />
              </div>

              {/* Right Column: Wide Instruction Banner with 4 Interactive Try-On Steps */}
              <div className="flex-1 min-w-0">
                <InstructionBanner
                  cameraEnabled={cameraEnabled}
                  cameraError={cameraState.error}
                  onEnableCamera={enableCamera}
                  onOpenGallery={() => handleNavChange('gallery')}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. AI Facial Morphology & Fit Advisor Modal (Backend Powered) */}
      <AIFitAdvisorModal
        isOpen={isFitAdvisorOpen}
        onClose={() => setIsFitAdvisorOpen(false)}
        onSelectProduct={handleSelectProduct}
        stats={stats}
        products={products}
        cameraEnabled={cameraEnabled}
        onEnableCamera={enableCamera}
        cameraMessage={cameraState.message}
        cameraError={cameraState.error}
        activeProduct={activeProduct}
        mirror={mirror}
      />

      {/* 4. High-Resolution Snapshot Preview Modal */}
      <SnapshotPreviewModal
        isOpen={isSnapshotModalOpen}
        onClose={() => {
          setIsSnapshotModalOpen(false);
          setSnapshotTrigger(0);
          setSnapshotDataUrl(null);
        }}
        snapshotDataUrl={snapshotDataUrl}
        product={activeProduct}
        onOpenGallery={() => handleNavChange('gallery')}
      />

      {/* 5. Mini Right-Side Account Drawer (Login / Sign Up) */}
      <AccountDrawer
        isOpen={isAccountDrawerOpen}
        onClose={() => setIsAccountDrawerOpen(false)}
        currentUser={currentUser}
        onLogin={handleUserLogin}
        onLogout={handleUserLogout}
        savedLooksCount={savedLooks.length}
        wishlistCount={wishlist.length}
        onOpenGallery={() => handleNavChange('gallery')}
      />

      {/* 6. Real-Time Snapshot Saved Toast Notification */}
      {toastNotification && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-xl border border-[#ece7fb] shadow-[0_8px_32px_rgba(99,85,246,0.18)] rounded-2xl p-3 pr-4 flex items-center gap-3.5 max-w-sm">
            {/* Thumbnail Preview */}
            <div
              onClick={() => {
                soundEffects.playClick();
                setIsSnapshotModalOpen(true);
              }}
              title="Click to view full preview"
              className="w-12 h-12 rounded-xl overflow-hidden border border-[#ded8f8] shadow-sm flex-shrink-0 cursor-pointer bg-neutral-900 group relative"
            >
              <img
                src={toastNotification.dataUrl}
                alt="Captured Snapshot"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            </div>

            {/* Title & Product Info */}
            <div className="flex flex-col min-w-0 pr-1">
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#181236]">
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                <span className="truncate">Saved to Gallery!</span>
              </div>
              <p className="text-[11px] text-[#716a8c] font-medium truncate max-w-[170px]">
                {toastNotification.productName}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  handleNavChange('gallery');
                  setToastNotification(null);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#6355f6] hover:bg-[#5242ee] text-white text-[11px] font-bold tracking-tight shadow-sm shadow-[#6355f6]/25 transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
              >
                <span>Gallery</span>
                <ArrowRight size={11} strokeWidth={2.4} />
              </button>

              <button
                onClick={() => setToastNotification(null)}
                aria-label="Close notification"
                className="p-1 rounded-lg text-[#958ea8] hover:text-[#181236] transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
