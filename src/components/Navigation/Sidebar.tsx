import React from 'react';
import { Camera, UploadCloud, Glasses, Image as ImageIcon, Settings, ArrowRight, Sparkles } from 'lucide-react';

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
    <aside className="w-[180px] sm:w-[195px] flex-shrink-0 flex flex-col gap-3 select-none self-start">
      {/* Top Navigation Items */}
      <div className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[13.5px] font-semibold transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-[#ede9fe] text-[#6355f6] shadow-sm'
                  : 'text-[#362f52] hover:bg-white/80 hover:text-[#181236]'
              }`}
            >
              <Icon
                size={19}
                className={isActive ? 'text-[#6355f6]' : 'text-[#433b61]'}
                strokeWidth={2.1}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Promotional / Glass Finder Card (Optional, default hidden as it moved to lower instruction banner) */}
      {showPromoCard && (
        <button
          onClick={onOpenPromo}
          aria-label="Find Your Fit - AI Glass Finder"
          className="w-full text-left relative overflow-hidden rounded-[18px] p-3.5 bg-gradient-to-br from-[#eef2fe] via-[#e8efff] to-[#e4e2fd] border border-[#e2e0f7] shadow-[0_2px_12px_rgba(109,40,217,0.05)] cursor-pointer group transition-all hover:shadow-[0_4px_20px_rgba(99,85,246,0.15)] hover:border-[#cfc9fc] hover:-translate-y-0.5 mt-1"
        >
          {/* Subtle Decorative Glows */}
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-[#8fa4ff]/25 blur-lg pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-[#c084fc]/25 blur-lg pointer-events-none" />

          {/* Top: Icon + Glass Finder Badge */}
          <div className="relative flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#6355f6]/10 text-[#6355f6] flex items-center justify-center border border-[#6355f6]/20">
              <Sparkles size={15} strokeWidth={2.4} />
            </div>
            <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#6355f6]/10 text-[#6355f6] border border-[#6355f6]/20 uppercase">
              Glass Finder
            </span>
          </div>

          {/* Heading */}
          <h4 className="relative text-[13px] font-bold text-[#1a1438] leading-tight mb-2.5">
            Find Your Perfect Fit
          </h4>

          {/* Action Button Strip */}
          <div className="relative flex items-center justify-between pt-2 border-t border-[#d8d3f7]/55">
            <span className="text-[11px] font-bold text-[#6355f6] group-hover:text-[#4f3ff2] transition-colors">
              Start AI Advisor
            </span>
            <div className="w-6 h-6 rounded-full bg-[#272242] text-white flex items-center justify-center transition-all group-hover:bg-[#6355f6] group-hover:scale-105 shadow-sm">
              <ArrowRight size={12} strokeWidth={2.6} />
            </div>
          </div>
        </button>
      )}
    </aside>
  );
};
