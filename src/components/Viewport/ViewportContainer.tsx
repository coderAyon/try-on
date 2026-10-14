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
  RotateCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Scan,
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
  cameraError?: string;
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
  cameraError,
}) => {
  const [showAcademicModal, setShowAcademicModal] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [debugOccluder, setDebugOccluder] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // AI Face Scanning Animation State
  const [isScanningFace, setIsScanningFace] = useState<boolean>(false);

  useEffect(() => {
    if (cameraEnabled && mode === 'webcam') {
      setIsScanningFace(true);
      const timer = setTimeout(() => {
        setIsScanningFace(false);
      }, 2800);
      return () => clearTimeout(timer);
    } else {
      setIsScanningFace(false);
    }
  }, [cameraEnabled, cameraSession, mode]);

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
        className="relative w-full flex-1 h-full min-h-[340px] lg:min-h-0 aspect-[16/11] lg:aspect-auto bg-[#120e22] dark:bg-[#070b14] rounded-[26px] overflow-hidden border border-[#eceaf5] dark:border-blue-900/40 shadow-[0_8px_32px_rgba(109,40,217,0.08)] dark:shadow-[0_12px_40px_rgba(3,7,18,0.9)] flex items-center justify-center group"
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
            splitPosition={isSplitActive ? splitPos : 100}
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
          /* Live Camera Idle / Access Prompt with 3D Face Wireframe & Demo Model Shortcut */
          <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-[#18122c] via-[#100b22] to-[#080514] text-white overflow-hidden">
            {/* Ambient 3D Face Wireframe Background Silhouette */}
            <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
              <svg width="340" height="420" viewBox="0 0 340 420" fill="none" stroke="#a855f7" strokeWidth="1.2">
                <ellipse cx="170" cy="200" rx="120" ry="160" strokeDasharray="3,3" />
                <ellipse cx="170" cy="200" rx="90" ry="130" strokeOpacity="0.6" />
                <line x1="170" y1="50" x2="170" y2="350" strokeOpacity="0.4" />
                <line x1="60" y1="180" x2="280" y2="180" strokeOpacity="0.4" />
                <line x1="70" y1="210" x2="270" y2="210" strokeOpacity="0.3" />
                <circle cx="125" cy="180" r="14" stroke="#38bdf8" />
                <circle cx="215" cy="180" r="14" stroke="#38bdf8" />
                <circle cx="170" cy="225" r="6" stroke="#c084fc" />
                <circle cx="170" cy="280" r="18" stroke="#a855f7" strokeDasharray="2,2" />
              </svg>
            </div>

            {/* Central Action Glass Box */}
            <div className="relative z-10 max-w-md w-full bg-slate-950/75 backdrop-blur-xl border border-purple-500/25 rounded-[24px] p-6 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col items-center">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-600/30 to-indigo-600/20 border border-purple-400/40 flex items-center justify-center text-purple-300 mb-4 shadow-[0_0_24px_rgba(168,85,247,0.3)] animate-glow-ring">
                <Camera size={28} strokeWidth={2.2} />
              </div>
              
              <h3 className="text-[19px] font-bold text-white mb-1.5 tracking-tight">AI Virtual Mirror Ready</h3>
              <p className="text-[12.5px] text-slate-300 mb-6 leading-relaxed">
                Start your live camera for 60 FPS face tracking, or test instantly with a photorealistic model without camera permissions.
              </p>

              {/* Primary & Secondary Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <button
                  onClick={onEnableCamera}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#6355f6] to-[#8b5cf6] hover:from-[#5242ee] hover:to-[#7c3aed] text-white px-5 py-3 rounded-full text-[13px] font-bold shadow-lg shadow-purple-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Camera size={16} />
                  <span>Allow Camera</span>
                </button>

                <button
                  onClick={() => {
                    soundEffects.playClick();
                    if (onSelectModel) {
                      onSelectModel('/models_faces/female_oval.jpg');
                    }
                    onModeChange('demo');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-3 rounded-full text-[13px] font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles size={15} className="text-purple-300" />
                  <span>Try Demo Model</span>
                </button>
              </div>

              {/* Demo Model Selection Pills */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 w-full justify-center">
                <span className="text-[11px] text-slate-400 font-medium">Or quick pick:</span>
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    if (onSelectModel) onSelectModel('/models_faces/female_oval.jpg');
                    onModeChange('demo');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors cursor-pointer"
                >
                  👤 Female (Oval)
                </button>
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    if (onSelectModel) onSelectModel('/models_faces/male_square.jpg');
                    onModeChange('demo');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors cursor-pointer"
                >
                  👤 Male (Square)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Laser Scanning Beam & Telemetry HUD Overlay */}
        {cameraEnabled && mode === 'webcam' && isScanningFace && (
          <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_20px_#c084fc] animate-ai-laser" />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950/85 backdrop-blur-md border border-purple-500/40 text-purple-200 text-[11px] sm:text-[12px] font-mono tracking-wide shadow-2xl animate-pulse">
              <Sparkles size={14} className="text-purple-400" />
              <span>AI FACE MESH: 468 LANDMARKS CALIBRATING...</span>
            </div>
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

        {/* Corner Framing Guides */}
        <div className="absolute top-5 left-5 w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl-[3px] pointer-events-none z-20 shadow-sm" />
        <div className="absolute top-5 right-5 w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr-[3px] pointer-events-none z-20 shadow-sm" />
        <div className="absolute bottom-5 left-5 w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl-[3px] pointer-events-none z-20 shadow-sm" />
        <div className="absolute bottom-5 right-5 w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br-[3px] pointer-events-none z-20 shadow-sm" />

        {/* Top Left: Status Pill */}
        {cameraError ? (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-red-500/20 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm border border-red-500/30 text-red-300">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
            <span className="text-[11.5px] font-bold text-red-200 tracking-tight">
              {cameraError.toLowerCase().includes('permission') || cameraError.toLowerCase().includes('denied')
                ? 'Permission Needed'
                : 'Camera Blocked'}
            </span>
          </div>
        ) : !cameraEnabled ? (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/70 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm border border-white/20 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-[11.5px] font-bold text-slate-200 tracking-tight">
              Camera Inactive
            </span>
          </div>
        ) : (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-sm border border-white/60">
            <span
              className={`w-2 h-2 rounded-full ${
                stats.faceDetected
                  ? 'bg-[#19b985] shadow-[0_0_8px_#19b985]'
                  : 'bg-[#19b985] animate-pulse'
              }`}
            />
            <span className="text-[11.5px] font-bold text-[#181236] tracking-tight">
              {stats.faceDetected ? 'Face Locked' : 'Camera Active'}
            </span>
          </div>
        )}

        {/* Top Right: HD Badge and Academic CV / Snapshot Button */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <div className="bg-black/45 backdrop-blur-md border border-white/30 px-2.5 py-1 rounded-full text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
            HD 60FPS
          </div>

          <button
            onClick={() => setShowAcademicModal(true)}
            title="Open Computer Vision Telemetry"
            className="w-7 h-7 rounded-full bg-black/45 backdrop-blur-md border border-white/30 text-white flex items-center justify-center hover:bg-black/70 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm text-[11px] font-mono"
          >
            CV
          </button>
        </div>

        {/* =========================================================================
            Bottom Center: Modern Frosted Glassmorphism Action Dock
            ========================================================================= */}
        <div className="absolute bottom-3 sm:bottom-4 inset-x-0 z-30 flex justify-center pointer-events-none px-2 sm:px-4">
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 shadow-2xl max-w-full overflow-x-auto no-scrollbar">
            
            {/* 1. Before / After Comparison Slider Toggle */}
            <button
              onClick={() => {
                soundEffects.playClick();
                setIsSplitActive(!isSplitActive);
              }}
              title="Toggle Before/After Comparison Slider"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                isSplitActive 
                  ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]' 
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              <SlidersHorizontal size={13} strokeWidth={2.2} />
              <span className="hidden sm:inline">Split</span>
            </button>

            {/* 2. Rescan AI Face */}
            <button
              onClick={() => {
                soundEffects.playClick();
                setIsScanningFace(true);
                setTimeout(() => setIsScanningFace(false), 2600);
              }}
              title="Rescan Face Landmarks"
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
            >
              <Scan size={14} strokeWidth={2} />
            </button>

            <div className="w-[1px] h-4 bg-white/15" />

            {/* 3. Primary Camera Shutter (Capture Photo) */}
            <button
              onClick={handleSnapshotClick}
              title="Capture High-Res Photo"
              className="relative group w-9 h-9 rounded-xl bg-white text-slate-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg border-2 border-slate-950 flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-sm bg-slate-950 group-hover:scale-110 transition-transform" />
              </div>
            </button>

            {/* 4. Flip / Mirror View */}
            <button
              onClick={() => {
                soundEffects.playClick();
                onToggleMirror();
              }}
              title="Mirror / Flip View"
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                mirror ? 'bg-purple-600/40 text-purple-200 border border-purple-400/40' : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
            >
              <FlipHorizontal size={14} strokeWidth={2} />
            </button>

            {/* 5. Reset Calibration */}
            <button
              onClick={() => {
                soundEffects.playClick();
                onResetCalibration();
              }}
              title="Reset 3D Alignment & Calibration"
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
            >
              <RotateCcw size={14} strokeWidth={2} />
            </button>

            <div className="w-[1px] h-4 bg-white/15" />

            {/* 6. Switch / Toggle Camera */}
            <button
              onClick={handleSwitchCameraClick}
              title={cameraEnabled ? "Switch Camera / Reconnect" : "Start Live Webcam"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold border border-white/20 transition-all cursor-pointer shadow-sm"
            >
              <Camera size={13} strokeWidth={2.2} />
              <span className="hidden sm:inline">{cameraEnabled ? 'Switch Camera' : 'Start Camera'}</span>
            </button>
          </div>
        </div>

        {/* Before / After Split Slider Divider Handle (When Split Active) */}
        {isSplitActive && (
          <div
            onPointerDown={handleSplitPointerDown}
            onPointerUp={handleSplitPointerUp}
            style={{ left: `${splitPos}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-400 via-white to-purple-400 shadow-[0_0_16px_rgba(255,255,255,0.8)] cursor-ew-resize z-30 touch-none flex items-center justify-center -translate-x-1/2"
          >
            <div className="absolute top-4 -left-20 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-slate-300 border border-white/20 pointer-events-none shadow-md">
              Before
            </div>
            <div className="absolute top-4 -right-20 px-2.5 py-1 rounded-full bg-purple-950/85 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-purple-200 border border-purple-400/40 pointer-events-none shadow-md">
              After
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-950/90 border-2 border-white text-white flex items-center justify-center text-xs font-bold shadow-2xl hover:scale-110 active:scale-95 transition-transform">
              <span className="text-purple-300">⇹</span>
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
