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
        <div className="inline-flex p-1 bg-white/90 backdrop-blur-md border border-[#d8b4fe] rounded-2xl shadow-sm">
          <button
            onClick={() => {
              soundEffects.playClick();
              onModeChange('webcam');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
              mode === 'webcam'
                ? 'bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] text-white shadow-md shadow-violet-500/25'
                : 'text-[#6d5b83] hover:text-[#4c1d95] hover:bg-[#ede0fc]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Try on</span>
            {stats.faceDetected && mode === 'webcam' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            )}
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              onModeChange('photo');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
              mode === 'photo'
                ? 'bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] text-white shadow-md shadow-violet-500/25'
                : 'text-[#6d5b83] hover:text-[#4c1d95] hover:bg-[#ede0fc]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>
        </div>

        {/* Live Tracking Status Badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-[#6d28d9] bg-white/80 border border-[#d8b4fe] px-3 py-1.5 rounded-xl shadow-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span>{mode === 'webcam' ? 'Live face tracking' : 'Interactive product studio'}</span>
        </div>
      </div>

      {/* 2. Main High-Resolution Virtual Mirror Box */}
      <div
        ref={mirrorContainerRef}
        onPointerMove={isSplitActive ? handleSplitPointerMove : undefined}
        className="fitting-viewport relative w-full aspect-[4/3] sm:aspect-[16/9] bg-[#120c1d] rounded-3xl overflow-hidden border-2 border-[#d8b4fe]/80 shadow-[0_20px_50px_-10px_rgba(109,40,217,0.18)] flex items-center justify-center group"
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

        {/* Bottom Floating Control Bar (Compact & Sleek) */}
        {(mode !== 'webcam' || cameraEnabled) && (
          <div className="absolute bottom-3 sm:bottom-3.5 inset-x-3 sm:inset-x-5 z-30 flex items-center justify-between pointer-events-none">
            {/* Left: Stop Camera Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
              {mode === 'webcam' && cameraEnabled && (
                <button
                  onClick={onStopCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-black/65 hover:bg-red-500/80 backdrop-blur-md border border-white/20 text-white font-medium text-[11px] sm:text-xs shadow-md transition-all cursor-pointer hover:border-red-400/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span>Stop camera</span>
                </button>
              )}
            </div>

            {/* Right: Mirror Flip, Lighting Selector & Capture Look */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
              {/* Mirror Flip */}
              {mode === 'webcam' && (
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    onToggleMirror();
                  }}
                  title={mirror ? 'Mirror Flip: Active' : 'Mirror Flip: Normal'}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-[#ffffff] bg-black/65 hover:bg-[#6d28d9] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-md hover:shadow-violet-500/30 hover:scale-105 active:scale-95"
                >
                  <FlipHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}

              {/* Lighting Preset Selector */}
              <div className="hidden lg:flex items-center p-0.5 rounded-lg sm:rounded-xl bg-black/65 backdrop-blur-md border border-white/20 shadow-md">
                {LIGHTING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      soundEffects.playClick();
                      onLightingChange(preset.id);
                    }}
                    className={`px-2.5 py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-sans transition-all cursor-pointer ${
                      lightingPreset === preset.id
                        ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white font-semibold shadow-sm shadow-violet-500/30'
                        : 'text-neutral-300 hover:text-white hover:bg-white/10 font-normal'
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider shadow-lg shadow-violet-500/35 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/25"
              >
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                <span>Capture Look</span>
              </button>
            </div>
          </div>
        )}
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
