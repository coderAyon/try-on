import React from 'react';
import { Sliders, RotateCcw, X, Info } from 'lucide-react';
import { CalibrationSettings } from '../../types';
import { soundEffects } from '../../utils/audio';

interface CalibrationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CalibrationSettings;
  onChange: (newSettings: CalibrationSettings) => void;
  onReset: () => void;
}

export const CalibrationDrawer: React.FC<CalibrationDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onChange,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 sm:right-6 z-40 w-80 glass-panel-gold rounded-2xl p-5 shadow-2xl border border-luxury-gold/30 animate-in slide-in-from-right-4 duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-3 border-b border-luxury-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-luxury-gold" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
            Fit & Optical Calibration
          </h3>
        </div>
        <button
          onClick={() => {
            soundEffects.playClick();
            onClose();
          }}
          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-luxury-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-4 space-y-4 text-xs font-mono">
        {/* Scale Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span className="text-[11px] text-slate-400">Frame Scale</span>
            <span className="text-luxury-gold font-bold">{Math.round(settings.scale * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.01"
            value={settings.scale}
            onChange={(e) =>
              onChange({ ...settings, scale: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-luxury-900 rounded-lg appearance-none cursor-pointer accent-luxury-gold"
          />
        </div>

        {/* IPD Offset Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span className="text-[11px] text-slate-400">Pupillary (IPD) Offset</span>
            <span className="text-cyan-400 font-bold">{settings.ipdOffsetMm > 0 ? `+${settings.ipdOffsetMm}` : settings.ipdOffsetMm} mm</span>
          </div>
          <input
            type="range"
            min="-10"
            max="10"
            step="0.5"
            value={settings.ipdOffsetMm}
            onChange={(e) =>
              onChange({ ...settings, ipdOffsetMm: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-luxury-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Vertical Bridge Height Offset */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span className="text-[11px] text-slate-400">Bridge Nose Height</span>
            <span className="text-slate-200 font-bold">{settings.verticalOffsetMm > 0 ? `+${settings.verticalOffsetMm}` : settings.verticalOffsetMm} mm</span>
          </div>
          <input
            type="range"
            min="-15"
            max="15"
            step="1"
            value={settings.verticalOffsetMm}
            onChange={(e) =>
              onChange({ ...settings, verticalOffsetMm: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-luxury-900 rounded-lg appearance-none cursor-pointer accent-slate-300"
          />
        </div>

        {/* Temple Arm Depth Offset */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-300">
            <span className="text-[11px] text-slate-400">Temple Arm Depth (Z)</span>
            <span className="text-slate-200 font-bold">{settings.depthOffsetMm > 0 ? `+${settings.depthOffsetMm}` : settings.depthOffsetMm} mm</span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={settings.depthOffsetMm}
            onChange={(e) =>
              onChange({ ...settings, depthOffsetMm: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-luxury-900 rounded-lg appearance-none cursor-pointer accent-slate-300"
          />
        </div>
      </div>

      {/* Info Tip */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-luxury-900/60 border border-luxury-800 text-[11px] text-slate-400 mb-4">
        <Info className="w-4 h-4 text-luxury-gold flex-shrink-0 mt-0.5" />
        <p className="leading-tight">
          Calibrate eyewear positioning to match your exact nasal bridge curvature and pupillary width.
        </p>
      </div>

      {/* Footer Reset */}
      <div className="pt-2 border-t border-luxury-800 flex justify-between">
        <button
          onClick={() => {
            soundEffects.playClick();
            onReset();
          }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-luxury-gold transition-colors font-mono"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
        <button
          onClick={() => {
            soundEffects.playClick();
            onClose();
          }}
          className="px-3 py-1 rounded bg-luxury-gold text-luxury-950 text-xs font-bold font-mono"
        >
          Done
        </button>
      </div>
    </div>
  );
};
