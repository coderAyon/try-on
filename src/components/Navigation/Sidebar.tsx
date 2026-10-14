import React from 'react';
import {
  Camera,
  UploadCloud,
  Glasses,
  Image as ImageIcon,
  Settings,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { soundEffects } from '../../utils/audio';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showPromoCard?: boolean;
  onOpenPromo?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  showPromoCard = false,
  onOpenPromo,
}) => {
  const menuItems = [
    { id: 'try-on', label: 'Try On', icon: Camera },
    { id: 'upload-photos', label: 'Upload Photos', icon: UploadCloud },
    { id: 'frames', label: 'Frames', icon: Glasses },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-full lg:w-[210px] xl:w-[224px] flex-shrink-0 flex flex-col gap-4 select-none self-start">
      {/* Top Navigation Items */}
      <nav aria-label="Main Navigation" className="flex flex-row overflow-x-auto gap-2 lg:flex-col no-scrollbar pb-1 lg:pb-0">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`group flex items-center justify-center lg:justify-start gap-2.5 sm:gap-3.5 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-[13px] sm:text-[13.5px] font-semibold transition-all cursor-pointer flex-1 lg:flex-none border whitespace-nowrap ${
                isActive
                  ? 'bg-[#ede9fe] text-[#5545e8] border-[#d4cbfa] shadow-sm dark:bg-[#10192e] dark:bg-gradient-to-r dark:from-blue-600/35 dark:to-indigo-600/30 dark:text-cyan-300 dark:border-cyan-400/50 dark:shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                  : 'border-transparent text-[#362f52] dark:text-slate-200 hover:bg-white/90 dark:hover:bg-[#0f172a] hover:text-[#161132] dark:hover:text-white hover:border-[#eceaf5] dark:hover:border-slate-800'
              }`}
            >
              <Icon
                size={18}
                className={`transition-colors ${
                  isActive
                    ? 'text-[#5545e8] dark:text-cyan-300'
                    : 'text-[#524976] dark:text-slate-400 group-hover:text-[#161132] dark:group-hover:text-cyan-300'
                }`}
                strokeWidth={2.1}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Separate Section: Find Your Perfect Fit (AI Face Advisor) */}
      {showPromoCard && (
        <section
          aria-label="Find Your Fit AI Advisor"
          className="flex flex-col gap-2 pt-2 border-t border-[#eceaf5] dark:border-blue-900/30"
        >
          {/* Section Eyebrow Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#787194] dark:text-slate-400">
              AI Face Fit
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#6355f6] dark:text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6355f6] dark:bg-cyan-400 animate-pulse" />
              Live
            </span>
          </div>

          {/* Show-Stopping Royal Violet AI Glass Finder Card */}
          <button
            onClick={() => {
              soundEffects.playClick();
              if (onOpenPromo) onOpenPromo();
            }}
            aria-label="Find Your Fit - AI Face Advisor"
            className="w-full relative overflow-hidden rounded-[22px] p-4 bg-gradient-to-br from-[#5937f5] via-[#6a3df7] to-[#8d32fc] dark:from-[#1e1b4b] dark:via-[#1e3a8a] dark:to-[#0f172a] text-white shadow-[0_8px_24px_rgba(99,85,246,0.28)] dark:shadow-[0_10px_35px_rgba(30,58,138,0.5)] hover:shadow-[0_12px_34px_rgba(99,85,246,0.42)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group text-left border border-white/20 dark:border-blue-500/30"
          >
            {/* Ambient Shimmer Light Blob */}
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/20 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[#c084fc]/30 blur-xl pointer-events-none" />

            {/* Top Row: Icon + Badge */}
            <div className="relative flex items-center justify-between mb-2.5">
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
            <div className="relative flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-cyan-400 text-[#5531e8] dark:text-slate-950 hover:bg-white/95 dark:hover:bg-cyan-300 text-[11.5px] font-bold shadow-md shadow-black/10 group-hover:shadow-lg transition-all">
              <span className="tracking-tight">Start AI Advisor</span>
              <div className="w-5 h-5 rounded-full bg-[#5531e8] dark:bg-slate-950 text-white dark:text-cyan-300 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:translate-x-0.5 shadow-sm">
                <ArrowRight size={11} strokeWidth={2.8} />
              </div>
            </div>
          </button>
        </section>
      )}
    </aside>
  );
};

