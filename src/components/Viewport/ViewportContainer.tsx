import React, { useState, useRef, useEffect } from 'react';
import {
  SunglassesProduct,
  TrackingStats,
  LightingPreset,
  CalibrationSettings,
  TryOnMode,
} from '../../types';
import { WebGLCanvas } from './WebGLCanvas';
import { LandmarkGlassesTryOn } from './LandmarkGlassesTryOn';
import { CameraOverlay } from './CameraOverlay';
import { AcademicCVModal } from '../Controls/AcademicCVModal';
import {
  Camera,
  FlipHorizontal,
  SunMedium,
  Cpu,
  Columns,
  Sparkles,
  RotateCw,
  Box,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { LIGHTING_PRESETS } from '../../data/catalog';
import { soundEffects } from '../../utils/audio';

interface ViewportContainerProps {
  cameraSession: number;
  onCameraStateChange: (message: string, error: string) => void;
  cameraEnabled: boolean;
  onEnableCamera: () => void;
  onStopCamera: () => void;
  product: SunglassesProduct;
  variantIndex: number;
  mode: TryOnMode;
  onModeChange: (mode: TryOnMode) => void;
  stats: TrackingStats;
  onStatsUpdate: (stats: TrackingStats) => void;
  mirror: boolean;
  onToggleMirror: () => void;
  lightingPreset: LightingPreset;
  onLightingChange: (lighting: LightingPreset) => void;
  calibration: CalibrationSettings;
  onCalibrationChange: (settings: CalibrationSettings) => void;
  onResetCalibration: () => void;
  onCaptureSnapshot: () => void;
  onSnapshotReady: (dataUrl: string) => void;
  snapshotTrigger: number;
  customPhotoUrl: string | null;
  onFileUpload: (file: File) => void;
  onSelectModel?: (url: string) => void;
}

export const ViewportContainer: React.FC<ViewportContainerProps> = ({
  cameraSession, onCameraStateChange,
  cameraEnabled, onEnableCamera, onStopCamera,
  product,
  variantIndex,
  mode,
  onModeChange,
  stats,
  onStatsUpdate,
  mirror,
  onToggleMirror,
  lightingPreset,
  onLightingChange,
  calibration,
  onCalibrationChange,
  onResetCalibration,
  onCaptureSnapshot,
  onSnapshotReady,
  snapshotTrigger,
  customPhotoUrl,
  onFileUpload,
  onSelectModel,
}) => {
  const [showAcademicModal, setShowAcademicModal] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [debugOccluder, setDebugOccluder] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Before / After Split Slider State
  const [isSplitActive, setIsSplitActive] = useState<boolean>(false);
  const [splitPos, setSplitPos] = useState<number>(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const mirrorContainerRef = useRef<HTMLDivElement>(null);

  const activeVariant = product.variants[variantIndex || 0] || product.variants[0];

  // Drag handler for Split-Screen Slider
  const handleSplitPointerDown = (e: React.PointerEvent) => {
    setIsDraggingSplit(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSplitPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingSplit || !mirrorContainerRef.current) return;
    const rect = mirrorContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = Math.round((x / rect.width) * 100);
    setSplitPos(percent);
  };

  const handleSplitPointerUp = (e: React.PointerEvent) => {
    setIsDraggingSplit(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 1. Mode Switcher Segmented Tabs (FittingBox standard) */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="inline-flex p-1 bg-[#f5f2fa] border border-[#eae3f3] rounded-2xl">
          <button
            onClick={() => {
              soundEffects.playClick();
              onModeChange('webcam');
            }}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              mode === 'webcam'
                ? 'bg-[#e6d8f5] text-[#5f437d] shadow-sm'
                : 'text-[#93859f] hover:text-[#5f437d]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Try on</span>
            {stats.faceDetected && mode === 'webcam' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              onModeChange('photo');
            }}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
              mode === 'photo'
                ? 'bg-[#e6d8f5] text-[#5f437d] shadow-sm'
                : 'text-[#93859f] hover:text-[#5f437d]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>
        </div>

        {/* Live Tracking Status Badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{mode === 'webcam' ? 'Live face tracking' : 'Interactive product studio'}</span>
        </div>
      </div>

      {/* 2. Main High-Resolution Virtual Mirror Box */}
      <div
        ref={mirrorContainerRef}
        onPointerMove={isSplitActive ? handleSplitPointerMove : undefined}
        className="fitting-viewport relative w-full aspect-[4/3] sm:aspect-[16/9] bg-[#edf0f6] rounded-3xl overflow-hidden border border-[#e6dfef] shadow-[0_12px_40px_rgba(116,90,144,0.08)] flex items-center justify-center group"
      >
        {/* Webcam mode: Jeeliz FaceFilter (6DOF, rock-solid face-locked glasses) */}
        {mode === 'webcam' && !cameraEnabled ? <div className="fit-scan"><Camera size={32} /><h3>Your camera is off</h3><p>Allow camera access to try frames on your face. Your browser may ask for permission. You can stop the camera at any time.</p><button className="frame-capture" onClick={onEnableCamera}>Allow camera & start try-on</button></div> : mode === 'webcam' ? (
            <LandmarkGlassesTryOn
            key={cameraSession}
            onCameraStateChange={onCameraStateChange}
            mirror={mirror}
            product={product}
            variantIndex={variantIndex}
            lightingPreset={lightingPreset}
            calibration={calibration}
            showLandmarks={showLandmarks}
            debugOccluder={debugOccluder}
            onStatsUpdate={onStatsUpdate}
            onSnapshotReady={onSnapshotReady}
            snapshotTrigger={snapshotTrigger}
            onLoadingChange={setIsLoading}
            onSwitchMode={onModeChange}
          />
        ) : (
          /* Demo & Photo modes: MediaPipe + Three.js WebGLCanvas */
          <WebGLCanvas
            product={product}
            variantIndex={variantIndex}
            mode={mode}
            mirror={mirror}
            lightingPreset={lightingPreset}
            calibration={calibration}
            showLandmarks={showLandmarks}
            debugOccluder={debugOccluder}
            onStatsUpdate={onStatsUpdate}
            onSnapshotReady={onSnapshotReady}
            snapshotTrigger={snapshotTrigger}
            customPhotoUrl={customPhotoUrl}
            onLoadingChange={setIsLoading}
            splitPosition={isSplitActive ? splitPos : 100}
          />
        )}

        {/* Viewport UI Guides & Photo Dropzone */}
        {mode !== 'demo' && (mode !== 'webcam' || cameraEnabled) && <CameraOverlay
          mode={mode}
          faceDetected={stats.faceDetected}
          onFileUpload={onFileUpload}
          isLoading={isLoading}
          customPhotoUrl={customPhotoUrl}
          onSelectModel={onSelectModel}
        />}

        {/* Before / After Split Slider Divider Handle */}
        {isSplitActive && mode === 'webcam' && (
          <div
            onPointerDown={handleSplitPointerDown}
            onPointerUp={handleSplitPointerUp}
            style={{ left: `${splitPos}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl cursor-ew-resize z-30 touch-none flex items-center justify-center -translate-x-1/2"
          >
            {/* Upper label: Before (Left) */}
            <div className="absolute top-4 -left-16 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono uppercase tracking-widest text-neutral-300 border border-neutral-700 pointer-events-none">
              Before
            </div>

            {/* Upper label: After (Right) */}
            <div className="absolute top-4 -right-16 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono uppercase tracking-widest text-neutral-300 border border-neutral-700 pointer-events-none">
              After
            </div>

            {/* Center Circular Grabber */}
            <div className="w-8 h-8 rounded-full bg-black/90 border-2 border-white text-white flex items-center justify-center text-xs font-bold shadow-2xl hover:scale-110 active:scale-95 transition-transform">
              <span>⇹</span>
            </div>
          </div>
        )}

        {/* Top Viewport Bar removed for minimal UI */}

        {/* Bottom Floating Control Bar */}
        {(mode !== 'webcam' || cameraEnabled) && <div className="absolute bottom-4 inset-x-4 sm:inset-x-6 z-30 flex items-center justify-between pointer-events-none">
          {/* Left Controls removed for minimal UI */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {mode === 'webcam' && cameraEnabled && <button className="frame-capture" onClick={onStopCamera}>Stop camera</button>}
          </div>

          {/* Right: Lighting Selector & Shutter Snapshot */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Mirror Flip */}
            {mode === 'webcam' && (
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onToggleMirror();
                }}
                title={mirror ? 'Mirror Flip: Active' : 'Mirror Flip: Normal'}
                className="glass-panel p-2 rounded-xl text-[#736780] hover:text-[#5f437d] hover:bg-[#f2e9fb] border border-[#e7deef] transition-colors cursor-pointer"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}

            {/* Lighting Preset Selector */}
            <div className="hidden lg:flex items-center glass-panel p-1 rounded-xl border border-[#e7deef]">
              {LIGHTING_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    soundEffects.playClick();
                    onLightingChange(preset.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium transition-all cursor-pointer ${
                    lightingPreset === preset.id
                      ? 'bg-neutral-800 text-white font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {preset.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Snapshot Shutter Button */}
            <button
              onClick={() => {
                soundEffects.playShutter();
                onCaptureSnapshot();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs uppercase tracking-wider shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-black" />
              <span>Capture Look</span>
            </button>
          </div>
        </div>}
      </div>

      {/* 3. Academic Computer Vision & Telemetry Modal */}
      <AcademicCVModal
        isOpen={showAcademicModal}
        onClose={() => setShowAcademicModal(false)}
        stats={stats}
        showLandmarks={showLandmarks}
        onToggleLandmarks={() => setShowLandmarks(!showLandmarks)}
        debugOccluder={debugOccluder}
        onToggleOccluder={() => setDebugOccluder(!debugOccluder)}
        calibration={calibration}
        onCalibrationChange={onCalibrationChange}
        onResetCalibration={onResetCalibration}
      />
    </div>
  );
};
