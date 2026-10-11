import React from 'react';
import { Moon, User, Volume2, VolumeX } from 'lucide-react';

import { UserProfile } from '../../types';

interface HeaderProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  onOpenProfile?: () => void;
  currentUser?: UserProfile | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeNav,
  onNavChange,
  isAudioMuted = false,
  onToggleAudio,
  onOpenProfile,
  currentUser,
}) => {
  const navItems = [
    { id: 'try-on', label: 'Try On' },
    { id: 'frames', label: 'Frames' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'about', label: 'About' },
  ];

  return (
    <header className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-3 pb-2 select-none">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#eceaf5] shadow-[0_2px_14px_rgba(109,40,217,0.04)] px-5 sm:px-7 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Lockup */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onNavChange('try-on')}
          aria-label="Lumen Vision Home"
        >
          {/* Custom 4-Point Purple Sparkle Star */}
          <div className="w-6 h-6 flex items-center justify-center text-[#6355f6]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12 2v20M2 12h20M12 2c2 5 5 8 10 10-5 2-8 5-10 10-2-5-5-8-10-10 5-2 8-5 10-10z" fill="currentColor" fillOpacity="0.1" />
            </svg>
          </div>
          <div className="flex items-baseline text-[21px] font-bold tracking-tight">
            <span className="text-[#161132]">lumen</span>
            <span className="text-[#6355f6]">.vision</span>
          </div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavChange(item.id)}
                className={`relative py-2 text-[14px] font-medium transition-colors cursor-pointer ${
                  isActive ? 'text-[#6355f6] font-semibold' : 'text-[#464064] hover:text-[#161132]'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#6355f6] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Theme Toggle & Profile Avatar */}
        <div className="flex items-center gap-3">
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#554e74] hover:text-[#161132] hover:bg-[#f3f1fb] transition-all cursor-pointer"
            >
              {isAudioMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          )}

          <button
            title="Toggle theme"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#554e74] hover:text-[#161132] hover:bg-[#f3f1fb] transition-all cursor-pointer"
          >
            <Moon size={18} strokeWidth={2} />
          </button>

          <button
            onClick={onOpenProfile}
            title={currentUser ? `Profile: ${currentUser.name}` : 'Sign In / Account'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentUser
                ? 'bg-[#6355f6] text-white shadow-sm ring-2 ring-[#6355f6]/30 font-bold text-xs'
                : 'bg-[#f4f2fc] border border-[#e5e1f7] text-[#463f6a] hover:border-[#6355f6] hover:text-[#6355f6]'
            }`}
          >
            {currentUser ? (
              <span>{currentUser.name.charAt(0).toUpperCase()}</span>
            ) : (
              <User size={18} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
