import React from 'react';
import { Activity, ShieldCheck, Video, Zap, Compass } from 'lucide-react';
import { TrackingStats } from '../../types';

interface TrackingHUDProps {
  stats: TrackingStats;
  isStreaming: boolean;
}

export const TrackingHUD: React.FC<TrackingHUDProps> = ({ stats, isStreaming }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 select-none">
      {/* Camera Live Indicator */}
      <div className="glass-pill flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono">
        <span className="relative flex h-2 w-2">
          {isStreaming ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          )}
        </span>
        <span className="text-slate-300 font-medium">
          {isStreaming ? 'Camera Active' : 'Camera Standby'}
        </span>
      </div>

      {/* Face Tracking FPS Badge */}
      <div className="glass-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono">
        <Activity className={`w-3.5 h-3.5 ${stats.faceDetected ? 'text-emerald-400' : 'text-slate-400'}`} />
        <span className="text-slate-400">Face Tracking:</span>
        <span className={`font-semibold ${stats.fps > 45 ? 'text-emerald-400' : stats.fps > 25 ? 'text-amber-400' : 'text-slate-300'}`}>
          {stats.faceDetected ? `${stats.fps} FPS` : 'Searching...'}
        </span>
      </div>

      {/* Depth Occlusion Indicator */}
      <div className="glass-pill hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono">
        <ShieldCheck className="w-3.5 h-3.5 text-luxury-gold" />
        <span className="text-slate-400">Depth Occlusion:</span>
        <span className="text-luxury-gold font-medium">
          {stats.depthOcclusionActive ? 'Active' : 'Off'}
        </span>
      </div>

      {/* Real-time IPD Measurement */}
      {stats.faceDetected && (
        <div className="glass-pill hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">IPD:</span>
          <span className="text-cyan-300 font-medium">{stats.estimatedIpdMm} mm</span>
        </div>
      )}

      {/* Camera Distance Estimate */}
      {stats.faceDetected && stats.distanceCm && (
        <div className="glass-pill hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono text-slate-300">
          <span className="text-slate-400">Dist:</span>
          <span className="text-emerald-400 font-medium">{stats.distanceCm} cm</span>
        </div>
      )}

      {/* Head Pose Telemetry */}
      {stats.faceDetected && (
        <div className="glass-pill hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono text-slate-400">
          <Compass className="w-3 h-3 text-luxury-gold/80" />
          <span>Y: {stats.headYaw > 0 ? `+${stats.headYaw}` : stats.headYaw}°</span>
          <span>P: {stats.headPitch > 0 ? `+${stats.headPitch}` : stats.headPitch}°</span>
          <span>R: {stats.headRoll > 0 ? `+${stats.headRoll}` : stats.headRoll}°</span>
        </div>
      )}
    </div>
  );
};
