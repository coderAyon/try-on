import React from 'react';
import { Moon, Sun, User, Volume2, VolumeX } from 'lucide-react';

import { UserProfile } from '../../types';

interface HeaderProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  onOpenProfile?: () => void;
  currentUser?: UserProfile | null;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeNav,
  onNavChange,
  isAudioMuted = false,
  onToggleAudio,
  onOpenProfile,
  currentUser,
  isDarkMode = false,
  onToggleTheme,
}) => {
  const navItems = [
    { id: 'try-on', label: 'Try On' },
    { id: 'frames', label: 'Frames' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'about', label: 'About' },
  ];

  return (
    <header className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 pt-2.5 sm:pt-3 pb-2 select-none">
      <div className="bg-white/95 dark:bg-[#0c1322]/90 backdrop-blur-md rounded-2xl border border-[#eceaf5] dark:border-blue-900/40 shadow-[0_2px_14px_rgba(109,40,217,0.04)] dark:shadow-[0_8px_30px_rgba(3,7,18,0.7)] px-3.5 sm:px-7 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 transition-colors">
        {/* Left: Brand Lockup */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onNavChange('try-on')}
          aria-label="Lumen Vision Home"
        >
          {/* Custom 4-Point Purple Sparkle Star */}
          <div className="w-6 h-6 flex items-center justify-center text-[#6355f6] dark:text-cyan-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12 2v20M2 12h20M12 2c2 5 5 8 10 10-5 2-8 5-10 10-2-5-5-8-10-10 5-2 8-5 10-10z" fill="currentColor" fillOpacity="0.1" />
            </svg>
          </div>
          <div className="flex items-baseline text-[21px] font-bold tracking-tight">
            <span className="text-[#161132] dark:text-white">lumen</span>
            <span className="text-[#6355f6] dark:text-cyan-400">.vision</span>
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
                  isActive ? 'text-[#6355f6] dark:text-cyan-400 font-semibold' : 'text-[#464064] dark:text-slate-300 hover:text-[#161132] dark:hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#6355f6] dark:bg-cyan-400 dark:shadow-[0_0_12px_#38bdf8] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Theme Toggle & Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#554e74] hover:text-[#161132] hover:bg-[#f3f1fb] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-all cursor-pointer"
            >
              {isAudioMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          )}

          <button
            onClick={onToggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#554e74] hover:text-[#161132] hover:bg-[#f3f1fb] dark:text-cyan-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-all duration-200 cursor-pointer overflow-hidden group"
          >
            <span
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${
                isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50 pointer-events-none'
              }`}
            >
              <Sun size={18} strokeWidth={2} className="text-amber-300 transition-transform group-hover:rotate-45" />
            </span>
            <span
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${
                !isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50 pointer-events-none'
              }`}
            >
              <Moon size={18} strokeWidth={2} className="transition-transform group-hover:-rotate-12" />
            </span>
          </button>

          <button
            onClick={onOpenProfile}
            title={currentUser ? `Profile: ${currentUser.name}` : 'Sign In / Account'}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentUser
                ? 'bg-[#6355f6] text-white shadow-sm ring-2 ring-[#6355f6]/30 font-bold text-xs'
                : 'bg-[#f4f2fc] dark:bg-slate-800/90 border border-[#e5e1f7] dark:border-blue-900/50 text-[#463f6a] dark:text-slate-200 hover:border-[#6355f6] dark:hover:border-cyan-400 hover:text-[#6355f6] dark:hover:text-cyan-300'
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
