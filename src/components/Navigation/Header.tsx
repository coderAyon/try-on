import {
  LucideIcon,
  Moon,
  Sun,
  User,
  Camera,
  UploadCloud,
  Glasses,
  Image as ImageIcon,
  Info,
} from 'lucide-react';

import { UserProfile } from '../../types';

interface HeaderProps {
  activeNav: string;
  onNavChange: (nav: string) => void;
  onOpenProfile?: () => void;
  currentUser?: UserProfile | null;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeNav,
  onNavChange,
  onOpenProfile,
  currentUser,
  isDarkMode = false,
  onToggleTheme,
}) => {
  const sectionMeta: Record<string, { label: string; icon: LucideIcon }> = {
    'try-on': { label: 'Try On', icon: Camera },
    'upload-photos': { label: 'Upload Photos', icon: UploadCloud },
    'frames': { label: 'Frames', icon: Glasses },
    'gallery': { label: 'Gallery', icon: ImageIcon },
    'about': { label: 'About Us', icon: Info },
  };

  const currentSection = sectionMeta[activeNav] || { label: 'Try On', icon: Camera };
  const CurrentIcon = currentSection.icon;

  return (
    <header className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 pt-2.5 sm:pt-3 pb-2 select-none">
      <div className="bg-white/95 dark:bg-[#0c1322]/90 backdrop-blur-md rounded-2xl border border-[#eceaf5] dark:border-blue-900/40 shadow-[0_2px_14px_rgba(109,40,217,0.04)] dark:shadow-[0_8px_30px_rgba(3,7,18,0.7)] px-3.5 sm:px-7 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 transition-colors">
        {/* Left: Brand Lockup with Official Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => onNavChange('try-on')}
          aria-label="Lumen Vision Home"
        >
          <img
            src="/logo.png"
            alt="Lumen Vision Logo"
            className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform flex-shrink-0"
          />
          <div className="flex items-baseline text-[21px] font-bold tracking-tight">
            <span className="text-[#161132] dark:text-white">lumen</span>
            <span className="text-[#6355f6] dark:text-cyan-400">.vision</span>
          </div>
        </div>

        {/* Center: Current Active Section Only */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-[#f4f2fc] dark:bg-[#10192e] border border-[#e2dcf7] dark:border-blue-900/50 shadow-sm transition-all duration-200">
            <CurrentIcon size={15} className="text-[#6355f6] dark:text-cyan-400" />
            <span className="text-[13px] sm:text-[13.5px] font-bold text-[#161132] dark:text-white tracking-wide">
              {currentSection.label}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6355f6] dark:bg-cyan-400 animate-pulse ml-0.5" />
          </div>
        </div>

        {/* Right: Theme Toggle & Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
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
