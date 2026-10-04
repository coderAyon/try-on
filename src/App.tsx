import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SUNGLASSES_CATALOG } from './data/catalog';
import {
  SunglassesProduct,
  TryOnMode,
  LightingPreset,
  TrackingStats,
  CalibrationSettings,
} from './types';
import { Header } from './components/Navigation/Header';
import { ViewportContainer } from './components/Viewport/ViewportContainer';
import { SnapshotPreviewModal } from './components/Controls/SnapshotPreviewModal';
import { AIFitAdvisorModal } from './components/Modals/AIFitAdvisorModal';
import { soundEffects } from './utils/audio';
import {
  getProductsAPI,
  saveLookAPI,
  logTelemetryAPI,
} from './services/api';
import { ProductThumbnail } from './components/Catalog/ProductThumbnail';
import { ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { StylesCoverflow } from './components/Catalog/StylesCoverflow';
import { ProductDetailsPage } from './components/Catalog/ProductDetailsPage';
import { PhotoTryOnPage } from './components/Viewport/PhotoTryOnPage';

export const App: React.FC = () => {
  const [detailId, setDetailId] = useState(() => window.location.hash.startsWith('#frame/') ? decodeURIComponent(window.location.hash.slice(7)) : null);
  const [photoPage, setPhotoPage] = useState(() => window.location.hash === '#photo');
  const [products, setProducts] = useState<SunglassesProduct[]>(SUNGLASSES_CATALOG);
  const [activeProduct, setActiveProduct] = useState<SunglassesProduct>(SUNGLASSES_CATALOG[0]);
  const [variantIndex, setVariantIndex] = useState<number>(0);

  const [mode, setMode] = useState<TryOnMode>('webcam');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);
  const [cameraState, setCameraState] = useState({ message: '', error: '' });
  const enableCamera = () => {
    setDetailId(null); setPhotoPage(false); window.location.hash = ''; setMode('webcam');
    setCameraState({ message: 'Starting camera…', error: '' });
    setCameraEnabled(true); setCameraSession(n => n + 1);
  };
  const changeMode = (next: TryOnMode) => {
    if (next === 'photo') { setPhotoPage(true); window.location.hash = 'photo'; }
    if (next !== 'webcam') setCameraEnabled(false);
    setStats(previous => ({ ...previous, faceDetected: false, faceMeasurements: undefined }));
    setMode(next);
  };
  const [mirror, setMirror] = useState<boolean>(true);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Modals state
  const [isFitAdvisorOpen, setIsFitAdvisorOpen] = useState<boolean>(false);
  const [snapshotTrigger, setSnapshotTrigger] = useState<number>(0);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>('/models_faces/female_oval.jpg');

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
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.startsWith('#frame/') ? decodeURIComponent(window.location.hash.slice(7)) : null;
      setDetailId(id);
      setPhotoPage(window.location.hash === '#photo');
      if (window.location.hash === '#photo') setCameraEnabled(false);
      if (id) setCameraEnabled(false);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    const product = products.find(p => p.id === detailId);
    if (product) { setActiveProduct(product); setVariantIndex(product.activeVariantIndex || 0); }
  }, [detailId, products]);
  const openDetails = (product: SunglassesProduct) => {
    setActiveProduct(product); setVariantIndex(product.activeVariantIndex || 0);
    setCameraEnabled(false); setDetailId(product.id);
    window.location.hash = `frame/${encodeURIComponent(product.id)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeDetails = () => { setDetailId(null); setPhotoPage(false); window.location.hash = ''; setMode('webcam'); };

  // Load products and cart from backend on mount
  useEffect(() => {
    const initializeBackendData = async () => {
      try {
        const fetchedProducts = await getProductsAPI();
        if (fetchedProducts.length > 0) {
          const merged = [...fetchedProducts];
          for (const local of SUNGLASSES_CATALOG) {
            if (!merged.some(product => product.id === local.id)) merged.push(local);
          }
          setProducts(merged);
          // Preserve currently selected product or default to first
          const current = fetchedProducts.find((p) => p.id === activeProduct.id) || fetchedProducts[0];
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
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 80, behavior: 'smooth' });
    }
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

  const handleSnapshotReady = useCallback((dataUrl: string) => {
    setSnapshotDataUrl(dataUrl);
    setIsSnapshotModalOpen(true);
    setSnapshotTrigger(0);

    // Save snapshot to backend lookbook
    const currentVariant = activeProduct.variants[variantIndex] || activeProduct.variants[0];
    saveLookAPI({
      productId: activeProduct.id,
      productName: `${activeProduct.brand} ${activeProduct.name}`,
      variantName: currentVariant.name,
      dataUrl,
      ipdMm: stats.estimatedIpdMm,
      faceShape: 'Oval',
    });
  }, [activeProduct, variantIndex, stats.estimatedIpdMm]);

  const handleToggleAudio = () => {
    const enabled = soundEffects.toggleSound();
    setIsAudioMuted(!enabled);
  };

  return (
    <div className="retail-shell min-h-screen text-[#180e2b] font-sans flex flex-col justify-between selection:bg-[#7c3aed] selection:text-white">
      {/* Official Sunglass Hut Navigation Header */}
      <Header
        currentMode={mode}
        onModeChange={changeMode}
        onOpenFitAdvisor={() => setIsFitAdvisorOpen(true)}
        isAudioMuted={isAudioMuted}
        onToggleAudio={handleToggleAudio}
        isFaceTracked={stats.faceDetected}
      />

      {/* Main E-Commerce Page Layout */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col gap-6">
        {photoPage ? <PhotoTryOnPage products={products} product={activeProduct} onSelect={handleSelectProduct} onBack={closeDetails} /> : detailId ? <ProductDetailsPage product={activeProduct} variantIndex={variantIndex} onVariantChange={handleVariantChange} onBack={closeDetails} onTryOn={closeDetails} /> : <>
        <div className="fitting-room-content flex flex-col gap-6 w-full max-w-5xl mx-auto">
          <div className="studio-intro">
            <div><span className="section-eyebrow">THE VIRTUAL FITTING ROOM</span><h1>Find your <em>signature.</em></h1></div>
            <div className="fit-entry"><p>Good frames change everything.<br />Find the pair that feels like you.</p><button onClick={() => { changeMode('webcam'); setIsFitAdvisorOpen(true); }}><Sparkles size={15} /> Find my fit <ArrowUpRight size={15} /></button></div>
          </div>
          <div className="fitting-layout">
          <section className="mirror-panel">
            <ViewportContainer
              product={activeProduct}
              variantIndex={variantIndex}
              mode={mode}
              onModeChange={changeMode}
              cameraEnabled={cameraEnabled}
              onEnableCamera={enableCamera}
              cameraSession={cameraSession}
              onCameraStateChange={(message, error) => setCameraState({ message, error })}
              onStopCamera={() => { setCameraEnabled(false); setStats(previous => ({ ...previous, faceDetected: false, faceMeasurements: undefined })); }}
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
          </section>

          <aside className="frame-details">
            <div className="frame-details-top">
              <span className="section-eyebrow">YOUR FRAME</span>
              <span className="frame-number">01 / SELECTED</span>
            </div>
            <div className="featured-preview">
              <div className="featured-preview-glow" />
              <ProductThumbnail product={activeProduct} variantIndex={variantIndex} />
            </div>
            <span className="frame-brand">{activeProduct.brand === 'Model Library' ? 'Studio collection' : activeProduct.brand}</span>
            <h2>{activeProduct.name}</h2>
            <div className="frame-luxury-specs">
              <span className="luxury-spec-pill">{activeProduct.frameMaterial}</span>
              <span className="luxury-spec-pill">{activeProduct.polarized ? 'Polarized' : 'Optical Grade'}</span>
              <span className="luxury-spec-pill">{activeProduct.dimensions.lensWidth}□{activeProduct.dimensions.bridgeWidth} mm</span>
            </div>
            <div className="finish-options">
              <div className="finish-header">
                <span className="detail-label">FINISH</span>
                <span className="finish-active-name">{activeProduct.variants[variantIndex]?.name ?? activeProduct.variants[0].name}</span>
              </div>
              <div className="finish-swatches">
                {activeProduct.variants.map((variant, i) => (
                  <button
                    key={i}
                    aria-label={variant.name}
                    aria-pressed={i === variantIndex}
                    title={variant.name}
                    onClick={() => handleVariantChange(i)}
                    style={{ backgroundColor: variant.frameHex }}
                  >
                    {i === variantIndex && <Check size={10} />}
                  </button>
                ))}
              </div>
            </div>
            <button className="frame-capture frame-save-look" onClick={handleCaptureSnapshot}>
              <span>Save this look</span>
              <ArrowUpRight size={14} />
            </button>
            <span className="frame-hint">Choose a frame below to make it yours.</span>
          </aside>
          </div>
          {/* Horizontal Catalog Row */}
          <section className="w-full">
            <StylesCoverflow products={products} activeId={activeProduct.id} onSelect={handleSelectProduct} onViewDetails={openDetails} />
          </section>
        </div>


        </>}
      </main>

      <footer className="studio-footer"><span>lumen.vision · Eyewear studio</span><span>Virtual try-on & immersive showroom</span></footer>

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
      />
    </div>
  );
};
