import React from 'react';
import { Sparkles, Zap, ArrowRight } from 'lucide-react';
import { soundEffects } from '../../utils/audio';

interface FindYourFitCardProps {
  onOpenFitAdvisor?: () => void;
  className?: string;
}

export const FindYourFitCard: React.FC<FindYourFitCardProps> = ({
  onOpenFitAdvisor,
  className = '',
}) => {
  return (
    <button
      onClick={() => {
        soundEffects.playClick();
        if (onOpenFitAdvisor) onOpenFitAdvisor();
      }}
      aria-label="Find Your Fit - AI Face Advisor"
      className={`w-full h-full relative overflow-hidden rounded-[22px] px-3.5 py-2.5 sm:px-4 sm:py-2.5 bg-gradient-to-br from-[#5937f5] via-[#6a3df7] to-[#8d32fc] dark:from-[#1e1b4b] dark:via-[#1e3a8a] dark:to-[#0f172a] text-white shadow-[0_4px_20px_rgba(99,85,246,0.2)] dark:shadow-[0_8px_30px_rgba(30,58,138,0.5)] hover:shadow-[0_10px_30px_rgba(99,85,246,0.38)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group text-left border border-white/20 dark:border-blue-500/30 flex flex-col justify-between select-none ${className}`}
    >
      {/* Ambient Shimmer Light Blob */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/20 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[#c084fc]/30 blur-xl pointer-events-none" />

      {/* Top Row: Icon + Badge */}
      <div className="relative flex items-center justify-between">
        <div className="w-5 h-5 rounded-md bg-white/20 backdrop-blur-md text-white flex items-center justify-center border border-white/30 shadow-xs">
          <Sparkles size={11} strokeWidth={2.4} />
        </div>

        <span className="flex items-center gap-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 uppercase tracking-wider shadow-xs">
          <Zap size={8} className="fill-white text-white" />
          <span>AI Face Advisor</span>
        </span>
      </div>

      {/* Heading & Subtitle */}
      <div className="relative my-auto py-1">
        <h4 className="text-[12.5px] font-extrabold text-white leading-tight tracking-tight drop-shadow-xs">
          Find Your Perfect Fit
        </h4>
        <p className="text-[9.5px] text-white/85 font-medium leading-tight mt-0.5">
          Scan face shape & get matching frames
        </p>
      </div>

      {/* High-Contrast Interactive CTA Button Strip */}
      <div className="relative flex items-center justify-between px-2.5 py-1 rounded-lg bg-white dark:bg-cyan-400 text-[#5531e8] dark:text-slate-950 hover:bg-white/95 dark:hover:bg-cyan-300 text-[10px] font-bold shadow-sm shadow-black/10 group-hover:shadow-md transition-all">
        <span className="tracking-tight">Start AI Advisor</span>
        <div className="w-3.5 h-3.5 rounded-full bg-[#5531e8] dark:bg-slate-950 text-white dark:text-cyan-300 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:translate-x-0.5 shadow-xs">
          <ArrowRight size={9} strokeWidth={2.8} />
        </div>
      </div>
    </button>
  );
};
