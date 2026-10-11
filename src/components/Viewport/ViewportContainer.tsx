import React, { useState, useRef } from 'react';
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
  RotateCw,
} from 'lucide-react';
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
  cameraSession,
  onCameraStateChange,
  cameraEnabled,
  onEnableCamera,
  onStopCamera,
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

  const handleSwitchCameraClick = () => {
    soundEffects.playClick();
    if (!cameraEnabled) {
      onEnableCamera();
    } else {
      // Toggle mirror or camera session
      onToggleMirror();
    }
  };

  const handleSnapshotClick = () => {
    soundEffects.playShutter();
    onCaptureSnapshot();
  };

  return (
    <div className="w-full h-full flex flex-col select-none">
      {/* Main Reference Camera Preview Viewport */}
      <div
        ref={mirrorContainerRef}
        onPointerMove={isSplitActive ? handleSplitPointerMove : undefined}
        className="relative w-full flex-1 h-full min-h-[340px] lg:min-h-0 aspect-[16/11] lg:aspect-auto bg-[#120e22] rounded-[26px] overflow-hidden border border-[#eceaf5] shadow-[0_4px_24px_rgba(109,40,217,0.06)] flex items-center justify-center group"
      >
        {/* Real Live Camera Try-On OR Realistic Hero Portrait Fallback */}
        {cameraEnabled && mode === 'webcam' ? (
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
        ) : mode === 'photo' || mode === 'demo' ? (
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
        ) : (
          /* Live Camera Idle / Access Prompt (No static demo girl image) */
          <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-[#18122c] to-[#0f0b1d] text-white">
            <div className="w-16 h-16 rounded-full bg-[#6355f6]/20 border border-[#6355f6]/40 flex items-center justify-center text-[#9387ff] mb-4 shadow-[0_0_24px_rgba(99,85,246,0.25)] animate-pulse">
              <Camera size={30} strokeWidth={2} />
            </div>
            <h3 className="text-[18px] font-bold text-white mb-2 tracking-tight">Live Camera Ready</h3>
            <p className="text-[12px] text-[#a79fc2] max-w-sm mb-5 leading-relaxed">
              Click below to start your webcam and try on eyewear in real time with 3D face tracking.
            </p>
            <button
              onClick={onEnableCamera}
              className="flex items-center gap-2 bg-[#6355f6] hover:bg-[#5242ee] text-white px-6 py-2.5 rounded-full text-[13px] font-semibold shadow-lg shadow-[#6355f6]/35 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Camera size={16} />
              <span>Allow Camera & Start Try-On</span>
            </button>
          </div>
        )}

        {/* Viewport UI Guides & Photo Dropzone (When in photo/custom mode) */}
        {mode !== 'demo' && (mode !== 'webcam' || cameraEnabled) && (
          <CameraOverlay
            mode={mode}
            faceDetected={stats.faceDetected}
            onFileUpload={onFileUpload}
            isLoading={isLoading}
            customPhotoUrl={customPhotoUrl}
            onSelectModel={onSelectModel}
          />
        )}

        {/* =========================================================================
            Corner Framing Guides (White Brackets ┌  ┐  └  ┘ - Exactly as in Reference)
            ========================================================================= */}
        <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-[3px] pointer-events-none z-20 shadow-sm" />
        <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-[3px] pointer-events-none z-20 shadow-sm" />
        <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-[3px] pointer-events-none z-20 shadow-sm" />
        <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-[3px] pointer-events-none z-20 shadow-sm" />

        {/* =========================================================================
            Top Left: Status Pill ("Camera Active" with Green Pulsing Dot)
            ========================================================================= */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm border border-white/60">
          <span
            className={`w-2 h-2 rounded-full ${
              cameraEnabled && stats.faceDetected
                ? 'bg-[#19b985] shadow-[0_0_8px_#19b985]'
                : cameraEnabled
                ? 'bg-[#19b985] animate-pulse'
                : 'bg-[#a79fc2]'
            }`}
          />
          <span className="text-[11.5px] font-bold text-[#181236] tracking-tight">
            {cameraEnabled && stats.faceDetected ? 'Face Locked' : cameraEnabled ? 'Camera Active' : 'Camera Ready'}
          </span>
        </div>

        {/* =========================================================================
            Top Right: HD Badge and Camera Snapshot Button
            ========================================================================= */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* HD Indicator Badge */}
          <div className="bg-black/45 backdrop-blur-md border border-white/30 px-2.5 py-1 rounded-full text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
            HD
          </div>

          {/* Quick Snapshot Shutter Icon Button */}
          <button
            onClick={handleSnapshotClick}
            title="Take a snapshot"
            className="w-7 h-7 rounded-full bg-black/45 backdrop-blur-md border border-white/30 text-white flex items-center justify-center hover:bg-black/70 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <Camera size={14} strokeWidth={2.2} />
          </button>
        </div>

        {/* =========================================================================
            Bottom Center: Switch Camera Button
            ========================================================================= */}
        <div className="absolute bottom-4 inset-x-0 z-20 flex justify-center pointer-events-none">
          <button
            onClick={handleSwitchCameraClick}
            className="pointer-events-auto flex items-center gap-2.5 bg-[#161228]/80 hover:bg-[#161228] backdrop-blur-md border border-white/25 text-white px-5 py-2.5 rounded-full text-[12px] font-semibold tracking-wide shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Camera size={15} strokeWidth={2.2} />
            <span>{cameraEnabled ? 'Switch Camera' : 'Start Camera'}</span>
          </button>
        </div>

        {/* Before / After Split Slider Divider Handle (When Split Active) */}
        {isSplitActive && mode === 'webcam' && (
          <div
            onPointerDown={handleSplitPointerDown}
            onPointerUp={handleSplitPointerUp}
            style={{ left: `${splitPos}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl cursor-ew-resize z-30 touch-none flex items-center justify-center -translate-x-1/2"
          >
            <div className="absolute top-4 -left-16 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono uppercase tracking-widest text-neutral-300 border border-neutral-700 pointer-events-none">
              Before
            </div>
            <div className="absolute top-4 -right-16 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono uppercase tracking-widest text-neutral-300 border border-neutral-700 pointer-events-none">
              After
            </div>
            <div className="w-8 h-8 rounded-full bg-black/90 border-2 border-white text-white flex items-center justify-center text-xs font-bold shadow-2xl hover:scale-110 active:scale-95 transition-transform">
              <span>⇹</span>
            </div>
          </div>
        )}
      </div>

      {/* Academic Computer Vision & Telemetry Modal */}
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
