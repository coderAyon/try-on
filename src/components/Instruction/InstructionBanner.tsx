import React from 'react';
import {
  Camera,
  Glasses,
  Sparkles,
  Heart,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { soundEffects } from '../../utils/audio';

interface InstructionBannerProps {
  onOpenFitAdvisor?: () => void;
  cameraEnabled?: boolean;
  onEnableCamera?: () => void;
  onOpenGallery?: () => void;
  onSelectFrameClick?: () => void;
}

export const InstructionBanner: React.FC<InstructionBannerProps> = ({
  onOpenFitAdvisor,
  cameraEnabled = false,
  onEnableCamera,
  onOpenGallery,
  onSelectFrameClick,
}) => {
  const steps = [
    {
      id: 'step-camera',
      stepNum: '01',
      title: 'Allow Camera',
      subtitle: cameraEnabled ? 'Live face tracking' : 'Enable live webcam',
      icon: Camera,
      iconGradient: 'from-[#6355f6] to-[#8b5cf6]',
      iconShadow: 'shadow-[#6355f6]/30',
      isActive: cameraEnabled,
      onClick: () => {
        if (!cameraEnabled && onEnableCamera) {
          soundEffects.playClick();
          onEnableCamera();
        }
      },
    },
    {
      id: 'step-frame',
      stepNum: '02',
      title: 'Choose Frame',
      subtitle: 'Pick curated styles',
      icon: Glasses,
      iconGradient: 'from-[#3b82f6] to-[#6355f6]',
      iconShadow: 'shadow-[#3b82f6]/30',
      onClick: () => {
        soundEffects.playClick();
        if (onSelectFrameClick) onSelectFrameClick();
      },
    },
    {
      id: 'step-magic',
      stepNum: '03',
      title: 'See the Magic',
      subtitle: 'Real-time 3D PBR',
      icon: Sparkles,
      iconGradient: 'from-[#8b5cf6] to-[#d946ef]',
      iconShadow: 'shadow-[#8b5cf6]/30',
    },
    {
      id: 'step-look',
      stepNum: '04',
      title: 'Find Your Look',
      subtitle: 'Save & Lookbook',
      icon: Heart,
      iconGradient: 'from-[#ec4899] to-[#f43f5e]',
      iconShadow: 'shadow-[#ec4899]/30',
      onClick: () => {
        soundEffects.playClick();
        if (onOpenGallery) onOpenGallery();
      },
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#f8f7ff] via-[#f5f2ff] to-[#edf0ff] border border-[#e4dffa] p-4 sm:p-5 lg:px-6 shadow-[0_4px_24px_rgba(99,85,246,0.06)] select-none">
      {/* Subtle Ambient Glowing Orbs */}
      <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-[#8fa4ff]/20 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 right-1/4 w-36 h-36 rounded-full bg-[#d8b4fe]/20 blur-2xl pointer-events-none" />

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
        {/* Left: 4 Frosted Interactive Step Cards */}
        <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {steps.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                onClick={item.onClick}
                className={`relative overflow-hidden rounded-[20px] p-3.5 bg-white/85 hover:bg-white border transition-all duration-200 group flex items-center gap-3.5 ${
                  item.isActive
                    ? 'border-[#10b981]/50 shadow-[0_4px_16px_rgba(16,185,129,0.12)]'
                    : 'border-[#e8e4f8] hover:border-[#6355f6]/40 hover:shadow-[0_6px_20px_rgba(99,85,246,0.10)] hover:-translate-y-0.5'
                } ${item.onClick ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}
              >
                {/* Gradient Glow on Card Hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6355f6]/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Vibrant Colorful Icon Badge */}
                <div
                  className={`relative w-11 h-11 flex-shrink-0 rounded-[14px] bg-gradient-to-br ${item.iconGradient} text-white flex items-center justify-center shadow-md ${item.iconShadow} transition-transform duration-200 group-hover:scale-105`}
                >
                  <Icon size={20} strokeWidth={2.3} />
                  {item.isActive && (
                    <span
                      title="Live camera active"
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-sm animate-pulse"
                    />
                  )}
                </div>

                {/* Step Metadata & Typography */}
                <div className="flex flex-col min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        item.isActive
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-[#6355f6]/10 text-[#6355f6]'
                      }`}
                    >
                      {item.isActive ? 'LIVE' : `STEP ${item.stepNum}`}
                    </span>
                  </div>

                  <h4 className="text-[13px] font-extrabold text-[#181236] leading-tight truncate group-hover:text-[#6355f6] transition-colors">
                    {item.title}
                  </h4>

                  <p className="text-[10.5px] text-[#787194] leading-snug truncate mt-0.5 font-medium">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Show-Stopping Royal Violet AI Glass Finder Card */}
        <div className="lg:col-span-4 xl:col-span-3 flex justify-end">
          <button
            onClick={() => {
              soundEffects.playClick();
              if (onOpenFitAdvisor) onOpenFitAdvisor();
            }}
            aria-label="Find Your Fit - AI Face Advisor"
            className="w-full relative overflow-hidden rounded-[22px] p-4 bg-gradient-to-br from-[#5937f5] via-[#6a3df7] to-[#8d32fc] text-white shadow-[0_8px_24px_rgba(99,85,246,0.28)] hover:shadow-[0_12px_34px_rgba(99,85,246,0.42)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group text-left border border-white/20"
          >
            {/* Ambient Shimmer Light Blob */}
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/20 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[#c084fc]/30 blur-xl pointer-events-none" />

            {/* Top Row: Icon + Badge */}
            <div className="relative flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md text-white flex items-center justify-center border border-white/30 shadow-sm">
                <Sparkles size={15} strokeWidth={2.4} />
              </div>

              <span className="flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 uppercase tracking-wider shadow-sm">
                <Zap size={10} className="fill-white text-white" />
                <span>AI Face Advisor</span>
              </span>
            </div>

            {/* Heading & Subtitle */}
            <div className="relative mb-3">
              <h4 className="text-[14.5px] font-extrabold text-white leading-tight tracking-tight drop-shadow-sm">
                Find Your Perfect Fit
              </h4>
              <p className="text-[11px] text-white/85 font-medium leading-snug mt-0.5">
                Scan face shape & get matching frames
              </p>
            </div>

            {/* High-Contrast Interactive CTA Button Strip */}
            <div className="relative flex items-center justify-between px-3.5 py-2 rounded-xl bg-white text-[#5531e8] hover:bg-white/95 text-[11.5px] font-bold shadow-md shadow-black/10 group-hover:shadow-lg transition-all">
              <span className="tracking-tight">Start AI Advisor</span>
              <div className="w-5 h-5 rounded-full bg-[#5531e8] text-white flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:translate-x-0.5 shadow-sm">
                <ArrowRight size={11} strokeWidth={2.8} />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
