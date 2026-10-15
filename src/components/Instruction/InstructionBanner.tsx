import React from 'react';
import {
  Camera,
  Glasses,
  Sparkles,
  Heart,
  Check,
} from 'lucide-react';
import { soundEffects } from '../../utils/audio';

interface InstructionBannerProps {
  onOpenFitAdvisor?: () => void;
  cameraEnabled?: boolean;
  onEnableCamera?: () => void;
  onOpenGallery?: () => void;
  onSelectFrameClick?: () => void;
  cameraError?: string;
  className?: string;
}

export const InstructionBanner: React.FC<InstructionBannerProps> = ({
  onOpenFitAdvisor,
  cameraEnabled = false,
  onEnableCamera,
  onOpenGallery,
  onSelectFrameClick,
  cameraError,
  className = '',
}) => {
  const isCameraBlocked = Boolean(cameraError);

  const steps = [
    {
      id: 'step-camera',
      stepNum: '01',
      title: 'Allow Camera',
      subtitle: isCameraBlocked
        ? (cameraError && (cameraError.toLowerCase().includes('permission') || cameraError.toLowerCase().includes('denied')) ? 'Permission needed' : 'Camera blocked')
        : cameraEnabled
        ? 'Live tracking active'
        : 'Click to enable webcam',
      icon: Camera,
      iconGradient: isCameraBlocked ? 'from-[#ef4444] to-[#f97316]' : 'from-[#6355f6] to-[#8b5cf6]',
      iconShadow: isCameraBlocked ? 'shadow-[#ef4444]/30' : 'shadow-[#6355f6]/30',
      isCompleted: cameraEnabled && !isCameraBlocked,
      isActive: !cameraEnabled && !isCameraBlocked,
      isBlocked: isCameraBlocked,
      onClick: () => {
        if (onEnableCamera) {
          soundEffects.playClick();
          onEnableCamera();
        }
      },
    },
    {
      id: 'step-frame',
      stepNum: '02',
      title: 'Choose Frame',
      subtitle: 'Select from 12+ styles',
      icon: Glasses,
      iconGradient: 'from-[#3b82f6] to-[#6355f6]',
      iconShadow: 'shadow-[#3b82f6]/30',
      isCompleted: true,
      isActive: cameraEnabled && !isCameraBlocked,
      isBlocked: false,
      onClick: () => {
        soundEffects.playClick();
        if (onSelectFrameClick) onSelectFrameClick();
      },
    },
    {
      id: 'step-magic',
      stepNum: '03',
      title: 'See the Magic',
      subtitle: 'Real-time 3D PBR fit',
      icon: Sparkles,
      iconGradient: 'from-[#8b5cf6] to-[#d946ef]',
      iconShadow: 'shadow-[#8b5cf6]/30',
      isCompleted: cameraEnabled && !isCameraBlocked,
      isActive: cameraEnabled && !isCameraBlocked,
      isBlocked: false,
    },
    {
      id: 'step-look',
      stepNum: '04',
      title: 'Find Your Look',
      subtitle: 'Save to Lookbook',
      icon: Heart,
      iconGradient: 'from-[#ec4899] to-[#f43f5e]',
      iconShadow: 'shadow-[#ec4899]/30',
      isCompleted: false,
      isActive: false,
      isBlocked: false,
      onClick: () => {
        soundEffects.playClick();
        if (onOpenGallery) onOpenGallery();
      },
    },
  ];

  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-gradient-to-r from-[#f8f7ff] via-[#f5f2ff] to-[#edf0ff] dark:from-[#0c1322] dark:via-[#0e172a] dark:to-[#0c1322] border border-[#e4dffa] dark:border-blue-900/40 px-3.5 py-2.5 sm:px-4 sm:py-2.5 shadow-[0_4px_20px_rgba(99,85,246,0.05)] dark:shadow-[0_8px_30px_rgba(3,7,18,0.7)] select-none transition-colors duration-300 flex flex-col justify-between ${className}`}>
      {/* Subtle Ambient Glowing Orbs */}
      <div className="absolute -top-12 -left-12 w-40 h-40 rounded-full bg-[#8fa4ff]/20 dark:bg-blue-600/15 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 right-1/4 w-40 h-40 rounded-full bg-[#d8b4fe]/25 dark:bg-cyan-500/15 blur-2xl pointer-events-none" />

      {/* Connected Timeline Progress Header */}
      <div className="flex items-center justify-between mb-2 px-1 flex-wrap gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6355f6] dark:bg-cyan-400 animate-ping" />
          <span className="text-[10.5px] font-extrabold text-[#6355f6] dark:text-cyan-400 uppercase tracking-wider">
            Interactive Try-On Progress Timeline
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] font-semibold text-[#7c759c] dark:text-slate-400">
          <span>Current Status:</span>
          <span className="text-[#6355f6] dark:text-cyan-400 font-bold">
            {isCameraBlocked
              ? 'Camera Blocked / Permission Needed'
              : cameraEnabled
              ? 'Step 3 / 4 (Live 3D Fitting Active)'
              : 'Step 1 / 4 (Camera Access Required)'}
          </span>
        </div>
      </div>

      {/* 4 Frosted Interactive Step Cards spanning the full banner */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-stretch flex-1">
        {steps.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              onClick={item.onClick}
              className={`relative overflow-hidden rounded-[16px] px-3 py-2 transition-all duration-300 group flex items-center gap-2.5 ${
                item.isBlocked
                  ? 'bg-red-50/50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 shadow-sm'
                  : item.isActive
                  ? 'bg-white dark:bg-[#131d35] border-2 border-[#6355f6] dark:border-cyan-400 shadow-[0_4px_16px_rgba(99,85,246,0.14)] dark:shadow-[0_0_16px_rgba(6,182,212,0.3)] ring-2 ring-[#6355f6]/15 dark:ring-cyan-400/20 -translate-y-0.5'
                  : item.isCompleted
                  ? 'bg-white/95 dark:bg-[#0e1628]/95 border border-emerald-300 dark:border-emerald-500/40 shadow-[0_3px_12px_rgba(16,185,129,0.08)]'
                  : 'bg-white/80 dark:bg-[#0e1628]/80 border border-[#e8e4f8] dark:border-blue-950/60 hover:bg-white dark:hover:bg-[#131d35] hover:border-[#6355f6]/40 dark:hover:border-cyan-500/40 hover:shadow-[0_3px_14px_rgba(99,85,246,0.08)]'
              } ${item.onClick ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}
            >
              {/* Subtle Gradient Glow on Hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6355f6]/[0.03] dark:via-cyan-400/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              {/* Icon Badge */}
              <div
                className={`relative w-9 h-9 flex-shrink-0 rounded-[10px] bg-gradient-to-br ${item.iconGradient} text-white flex items-center justify-center shadow-sm ${item.iconShadow} transition-transform duration-200 group-hover:scale-105 ${
                  item.isCompleted ? 'ring-2 ring-emerald-400' : ''
                }`}
              >
                <Icon size={17} strokeWidth={2.3} />
                {item.isCompleted && (
                  <span
                    title="Completed"
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-[#0e1628] shadow-xs"
                  >
                    <Check size={8} strokeWidth={3} />
                  </span>
                )}
              </div>

              {/* Step Metadata & Typography */}
              <div className="flex flex-col min-w-0 pr-0.5 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {item.isBlocked ? (
                    <span className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-500 border border-red-500/30">
                      {cameraError && (cameraError.toLowerCase().includes('permission') || cameraError.toLowerCase().includes('denied'))
                        ? 'Permission Needed'
                        : 'Camera Blocked'}
                    </span>
                  ) : (
                    <span
                      className={`text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                        item.isCompleted
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          : item.isActive
                          ? 'bg-[#6355f6]/15 dark:bg-cyan-500/20 text-[#6355f6] dark:text-cyan-300 border border-[#6355f6]/30 dark:border-cyan-500/40 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.isCompleted ? 'DONE' : item.isActive ? 'ACTIVE' : `STEP ${item.stepNum}`}
                    </span>
                  )}
                </div>

                <h4 className="text-[12px] font-bold leading-tight text-[#181236] dark:text-slate-100 group-hover:text-[#6355f6] dark:group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </h4>

                <p className="text-[10px] text-[#787194] dark:text-slate-400 leading-tight mt-0.5 font-medium">
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

