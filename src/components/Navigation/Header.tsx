import React from 'react';
import { Sparkles, Volume2, VolumeX } from 'lucide-react';
import { TryOnMode } from '../../types';

interface HeaderProps {
  currentMode: TryOnMode;
  onModeChange: (mode: TryOnMode) => void;
  onOpenFitAdvisor: () => void;
  onOpenCart?: () => void;
  onOpenFindInStore?: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  isFaceTracked: boolean;
  cartCount?: number;
  wishlistCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ isAudioMuted, onToggleAudio }) => (
  <header className="sticky top-0 z-50 w-full select-none">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline">
          <span className="text-[24px] font-bold tracking-tight text-[#180e2b]">lumen</span>
          <span className="text-[24px] font-bold tracking-tight bg-gradient-to-r from-[#7c3aed] to-[#a855f7] bg-clip-text text-transparent">.vision</span>
        </div>
        <span className="hidden sm:block text-[9px] font-bold tracking-[.22em] text-[#6d5b83] uppercase border-l-2 border-[#d8b4fe] pl-3">Eyewear Studio</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          aria-label={isAudioMuted ? 'Unmute experience audio' : 'Mute experience audio'}
          onClick={onToggleAudio}
          className="p-2.5 rounded-xl text-[#6d28d9] hover:text-[#4c1d95] hover:bg-[#ede0fc] border border-[#d8b4fe]/60 bg-white/70 shadow-sm transition-all cursor-pointer"
        >
          {isAudioMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
      </div>
    </div>
  </header>
);
