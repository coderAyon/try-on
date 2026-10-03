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

export const Header: React.FC<HeaderProps> = ({ onOpenFitAdvisor, isAudioMuted, onToggleAudio }) => (
  <header className="sticky top-0 z-50 w-full border-b select-none">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[23px] font-semibold tracking-tight">lumen<span className="text-[#9a78bd]">.</span>vision</span>
        <span className="hidden sm:block text-[8px] tracking-[.16em] text-slate-500 uppercase border-l border-[#e9e1f1] pl-3">Eyewear studio</span>
      </div>
      <div className="flex items-center gap-3">
        <button aria-label={isAudioMuted ? 'Unmute experience audio' : 'Mute experience audio'} onClick={onToggleAudio} className="p-2 text-slate-500 hover:text-[#725393] transition-colors">
          {isAudioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

      </div>
    </div>
  </header>
);
