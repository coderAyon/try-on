import React from 'react';
import {
  X,
  Activity,
  ShieldCheck,
  Zap,
  Compass,
  Cpu,
  Eye,
  Sliders,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import { TrackingStats, CalibrationSettings } from '../../types';

interface AcademicCVModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: TrackingStats;
  showLandmarks: boolean;
  onToggleLandmarks: () => void;
  debugOccluder: boolean;
  onToggleOccluder: () => void;
  calibration: CalibrationSettings;
  onCalibrationChange: (settings: CalibrationSettings) => void;
  onResetCalibration: () => void;
}

export const AcademicCVModal: React.FC<AcademicCVModalProps> = ({
  isOpen,
  onClose,
  stats,
  showLandmarks,
  onToggleLandmarks,
  debugOccluder,
  onToggleOccluder,
  calibration,
  onCalibrationChange,
  onResetCalibration,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600/15 border border-red-500/40 text-red-500">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-mono tracking-tight text-white uppercase">
                  Computer Vision & AR Telemetry
                </h2>
                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-mono font-bold">
                  CSE Capstone
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-sans mt-0.5">
                FittingBox™ Engine Standard • Google MediaPipe 478-Point Face Mesh Pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Framerate
            </span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {stats.fps} FPS
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Real-time WebGL</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Pupillary (IPD)
            </span>
            <span className="text-xl font-bold font-mono text-cyan-300 mt-1">
              {stats.estimatedIpdMm} mm
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Biometric Calibrated</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Head Orientation
            </span>
            <span className="text-sm font-bold font-mono text-amber-300 mt-1">
              Y:{stats.headYaw}° P:{stats.headPitch}°
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Roll: {stats.headRoll}°</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Depth Occlusion
            </span>
            <span className="text-sm font-bold font-mono text-blue-400 mt-1">
              GPU Active
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Ear Coronal Plane</span>
          </div>
        </div>

        {/* Academic Inspector Visualizer Controls */}
        <div className="space-y-4 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-red-500" />
            <span>Interactive Visualizer Proof for Evaluation</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Toggle 478 Mesh */}
            <button
              onClick={onToggleLandmarks}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                showLandmarks
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>478-pt FaceMesh Wireframe</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-black/40">
                {showLandmarks ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Toggle 3D Head Occluder */}
            <button
              onClick={onToggleOccluder}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                debugOccluder
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>3D Skull Occluder (Depth Proof)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-black/40">
                {debugOccluder ? 'VISIBLE' : 'MASKED'}
              </span>
            </button>
          </div>
        </div>

        {/* Fine-Tuning Optical Calibration Sliders */}
        <div className="mt-5 space-y-3 bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Optical Calibration Matrix</span>
            </span>
            <button
              onClick={onResetCalibration}
              className="text-[11px] font-mono text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2">
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>Frame Scale</span>
                <span className="text-white font-bold">{Math.round(calibration.scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.80"
                max="1.20"
                step="0.01"
                value={calibration.scale}
                onChange={(e) =>
                  onCalibrationChange({ ...calibration, scale: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>Bridge Height (Y-Offset)</span>
                <span className="text-white font-bold">{calibration.verticalOffsetMm} mm</span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={calibration.verticalOffsetMm}
                onChange={(e) =>
                  onCalibrationChange({
                    ...calibration,
                    verticalOffsetMm: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>

        {/* Technical Architecture Specs for Faculty Evaluation */}
        <div className="mt-5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-400 space-y-1.5">
          <div className="text-neutral-200 font-bold uppercase tracking-wider mb-2">
            Technical Methodology Highlights:
          </div>
          <p>• Orthonormal 3D Basis: Derived from Bridge (168), Glabella (6), and Pupils (33, 133, 263, 362).</p>
          <p>• Adaptive Jitter Suppression: Dual-stage Quaternion SLERP on orientation + One-Euro velocity filter.</p>
          <p>• Optical Meniscus Base-6 Curve: Curved 3D crystal glass surface with ACESFilmic PBR clearcoat reflection.</p>
          <p>• Dynamic Temple Clipping: GPU hardware plane discarding temple arms behind the coronal ear axis.</p>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
