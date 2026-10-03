import React from 'react';
import { FlipHorizontal, Sliders, Camera, SunMedium, Eye, RotateCw } from 'lucide-react';
import { LightingPreset, LightingConfig } from '../../types';
import { LIGHTING_PRESETS } from '../../data/catalog';
import { soundEffects } from '../../utils/audio';

interface FloatingToolbarProps {
  mirror: boolean;
  onToggleMirror: () => void;
  showCalibration: boolean;
  onToggleCalibration: () => void;
  currentLighting: LightingPreset;
  onLightingChange: (lighting: LightingPreset) => void;
  onCaptureSnapshot: () => void;
  showLandmarks: boolean;
  onToggleLandmarks: () => void;
  debugOccluder: boolean;
  onToggleOccluder: () => void;
  onResetView: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  mirror,
  onToggleMirror,
  showCalibration,
  onToggleCalibration,
  currentLighting,
  onLightingChange,
  onCaptureSnapshot,
  showLandmarks,
  onToggleLandmarks,
  debugOccluder,
  onToggleOccluder,
  onResetView,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 select-none">
      {/* Control Action Cluster */}
      <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-1.5 shadow-xl border border-luxury-800">
        {/* Mirror Flip Toggle */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onToggleMirror();
          }}
          title={mirror ? 'Mirror Mode: Active' : 'Mirror Mode: Inverted'}
          className={`p-2 rounded-xl transition-all ${
            mirror
              ? 'bg-luxury-gold/20 text-luxury-gold border border-luxury-gold/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-luxury-800'
          }`}
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>

        {/* Optical Calibration Toggle */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onToggleCalibration();
          }}
          title="Fine-Tune Optical IPD & Frame Sizing"
          className={`p-2 rounded-xl transition-all ${
            showCalibration
              ? 'bg-luxury-gold text-luxury-950 font-bold shadow-gold-glow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-luxury-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Mesh & Landmark Visualizer Toggle (Academic & Demo Showcase) */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onToggleLandmarks();
          }}
          title="Toggle 468-pt Face Mesh Wireframe"
          className={`p-2 rounded-xl transition-all ${
            showLandmarks
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-luxury-800'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* 3D Head Occluder Visualizer Toggle (FittingBox Depth Proof) */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onToggleOccluder();
          }}
          title={
            debugOccluder
              ? 'Head Occluder: Holographic Wireframe (Visible)'
              : 'Head Occluder: Invisible Depth Buffer Mask (Standard)'
          }
          className={`p-2 rounded-xl transition-all ${
            debugOccluder
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-luxury-800'
          }`}
        >
          <span className="text-[10px] font-mono font-bold tracking-tight px-0.5">3D</span>
        </button>

        {/* Reset Camera View */}
        <button
          onClick={() => {
            soundEffects.playClick();
            onResetView();
          }}
          title="Center & Reset 3D Eyewear Orientation"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-luxury-800 transition-all"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Vertical Separator */}
        <div className="w-[1px] h-6 bg-luxury-800 mx-1" />

        {/* Lighting Environments */}
        <div className="flex items-center gap-1">
          {LIGHTING_PRESETS.map((preset: LightingConfig) => {
            const isActive = currentLighting === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  soundEffects.playClick();
                  onLightingChange(preset.id);
                }}
                title={`Simulate Environment: ${preset.name}`}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono transition-all flex items-center gap-1 ${
                  isActive
                    ? 'bg-luxury-800 text-luxury-gold border border-luxury-gold/50 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-luxury-900/60'
                }`}
              >
                <SunMedium className="w-3 h-3 text-luxury-gold/70" />
                <span className="hidden md:inline">{preset.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Snapshot Shutter Button */}
      <button
        onClick={() => {
          soundEffects.playShutter();
          onCaptureSnapshot();
        }}
        className="shimmer-btn flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-luxury-gold to-luxury-gold-dark text-luxury-950 font-bold text-xs uppercase tracking-wider shadow-gold-glow hover:scale-105 active:scale-95 transition-all cursor-pointer"
      >
        <Camera className="w-4 h-4 text-luxury-950" />
        <span>Capture Try-On</span>
      </button>
    </div>
  );
};
