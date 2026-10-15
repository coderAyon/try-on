import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  MapPin,
  Check,
  Code2,
  ShieldCheck,
  Camera,
  X,
} from 'lucide-react';
import { soundEffects } from '../../utils/audio';

interface AboutPageProps {
  isOpen?: boolean;
  onClose: () => void;
  onBackToFittingRoom?: () => void;
  onExploreFrames?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  isOpen = true,
  onClose,
  onBackToFittingRoom,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleClose = () => {
    soundEffects.playClick();
    if (onBackToFittingRoom) onBackToFittingRoom();
    onClose();
  };

  const handleCopy = (key: string, text: string) => {
    soundEffects.playClick();
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-md overflow-x-hidden overflow-y-auto no-scrollbar animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="About Us - Lumen Vision Virtual Try-On"
    >
      {/* Modal Dialog Window */}
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-x-hidden overflow-y-auto no-scrollbar rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[#f8f6ff]/95 via-white/95 to-[#f0f4ff]/95 dark:from-[#090d1a]/95 dark:via-[#0c1224]/95 dark:to-[#080c18]/95 border border-white/80 dark:border-blue-900/40 p-4 sm:p-6 shadow-[0_20px_60px_rgba(99,85,246,0.18)] dark:shadow-[0_25px_70px_rgba(3,7,18,0.95)] flex flex-col gap-4 select-none my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Shimmer Orbs (strictly clipped so no scrollbars or overflow are triggered) */}
        <div className="absolute inset-0 overflow-hidden rounded-[28px] sm:rounded-[32px] pointer-events-none">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-[#6355f6]/15 to-[#d946ef]/15 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-gradient-to-tr from-[#3b82f6]/15 to-[#06b6d4]/15 blur-3xl" />
        </div>

        {/* 1. Header: Hero Showcase with Glassmorphic Gradient */}
        <div className="relative overflow-hidden rounded-[22px] bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-xl border border-white/90 dark:border-blue-900/30 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex flex-col gap-2 max-w-2xl">
              {/* Back Button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#6355f6] dark:text-cyan-400 hover:text-[#4f3ff2] dark:hover:text-cyan-300 transition-colors cursor-pointer group"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                  <span>Back to Fitting Room</span>
                </button>
              </div>

              {/* Title & Tagline with Official Project Logo */}
              <div className="flex items-center gap-3 mt-1">
                <img
                  src="/logo.png"
                  alt="Lumen Vision Logo"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain shadow-md shadow-[#6355f6]/20 flex-shrink-0"
                />
                <h1 className="text-[22px] sm:text-[27px] font-black text-[#15112e] dark:text-white tracking-tight leading-tight">
                  Lumen Vision{' '}
                  <span className="relative inline-block font-extrabold bg-gradient-to-r from-[#6355f6] via-[#7549f8] to-[#9333ea] dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                    <span className="absolute -top-1 -left-2 text-[11px] text-[#6355f6] dark:text-cyan-300 font-serif select-none">✦</span>
                    Virtual Try-On
                  </span>
                </h1>
              </div>

              <p className="text-[12.5px] sm:text-[13px] text-[#554d74] dark:text-slate-300 leading-relaxed font-normal">
                An intelligent 3D eyewear fitting platform powered by MediaPipe AI facial landmark telemetry, real-time millimeter-scale interpupillary distance (IPD) calibration, and photorealistic WebGL PBR rendering.
              </p>
            </div>

            {/* Action Buttons & Close Icon */}
            <div className="flex items-center gap-3 self-start lg:self-center">
              <button
                onClick={handleClose}
                className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-[#6355f6] via-[#7549f8] to-[#8d32fc] text-white text-[12.5px] sm:text-[13px] font-bold shadow-[0_6px_20px_rgba(99,85,246,0.3)] hover:shadow-[0_8px_25px_rgba(99,85,246,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer whitespace-nowrap"
              >
                <Camera size={15} />
                <span>Launch Live Try-On</span>
                <ArrowRight size={14} className="ml-0.5" />
              </button>

              <button
                onClick={handleClose}
                title="Close modal"
                className="w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Dual-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
          {/* ================= CARD 1: PROJECT DEVELOPERS ================= */}
          <div className="relative overflow-hidden rounded-[22px] bg-white/80 dark:bg-[#0c1322]/85 backdrop-blur-xl border border-white/90 dark:border-blue-900/35 p-4.5 sm:p-5 shadow-xs flex flex-col justify-between transition-all">
            <div className="flex flex-col gap-3.5">
              {/* Section Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#f1edf9] dark:border-blue-900/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6355f6]/15 to-[#8b5cf6]/20 text-[#6355f6] dark:text-cyan-300 flex items-center justify-center border border-[#6355f6]/20 shadow-xs">
                    <Code2 size={16} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#161230] dark:text-white leading-tight">
                      Project Developers
                    </h2>
                    <p className="text-[11px] text-[#787196] dark:text-slate-400 font-medium">
                      Core Engineering & Design Team
                    </p>
                  </div>
                </div>
              </div>

              {/* Developer 1: Ayon Roy */}
              <div className="group flex items-center justify-between p-3.5 rounded-xl bg-white/70 dark:bg-[#11192e]/70 border border-[#e8e4f5] dark:border-blue-900/40 shadow-xs hover:border-[#6355f6]/40 dark:hover:border-cyan-500/40 transition-all gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6355f6] to-[#7c3aed] text-white font-extrabold text-[14px] flex items-center justify-center shadow-md shadow-purple-600/25 flex-shrink-0">
                    AR
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-[#6355f6] dark:text-cyan-400 leading-none mb-1">
                      CORE ROLE
                    </span>
                    <h3 className="text-[14.5px] font-bold text-[#161230] dark:text-white leading-tight truncate">
                      Ayon Roy
                    </h3>
                    <span className="text-[11.5px] font-medium text-[#554d74] dark:text-slate-300 mt-0.5">
                      Backend Developer
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#787196] dark:text-slate-400 mt-1">
                      <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                      <span className="truncate">Manikganj, Dhaka, Bangladesh</span>
                    </div>
                  </div>
                </div>

                {/* Phone Pill */}
                <button
                  onClick={() => handleCopy('ayon', '01630802119')}
                  title="Click to copy phone number"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#ded8f2] dark:border-slate-700/80 text-[#251f44] dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 group/btn"
                >
                  {copiedKey === 'ayon' ? (
                    <>
                      <Check size={11} className="text-emerald-500" strokeWidth={3} />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Phone size={10} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="tracking-tight">01630802119</span>
                    </>
                  )}
                </button>
              </div>

              {/* Developer 2: Sanjida Tabassum Supti */}
              <div className="group flex items-center justify-between p-3.5 rounded-xl bg-white/70 dark:bg-[#11192e]/70 border border-[#e8e4f5] dark:border-blue-900/40 shadow-xs hover:border-pink-500/40 dark:hover:border-pink-400/40 transition-all gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#ec4899] to-[#f43f5e] text-white font-extrabold text-[14px] flex items-center justify-center shadow-md shadow-pink-500/25 flex-shrink-0">
                    SS
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 leading-none mb-1">
                      CORE ROLE
                    </span>
                    <h3 className="text-[14.5px] font-bold text-[#161230] dark:text-white leading-tight truncate">
                      Sanjida Tabassum Supti
                    </h3>
                    <span className="text-[11.5px] font-medium text-[#554d74] dark:text-slate-300 mt-0.5">
                      Frontend Designer
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#787196] dark:text-slate-400 mt-1">
                      <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                      <span className="truncate">Savar, Dhaka, Bangladesh</span>
                    </div>
                  </div>
                </div>

                {/* Phone Pill */}
                <button
                  onClick={() => handleCopy('supti', '01303950428')}
                  title="Click to copy phone number"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#ded8f2] dark:border-slate-700/80 text-[#251f44] dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 group/btn"
                >
                  {copiedKey === 'supti' ? (
                    <>
                      <Check size={11} className="text-emerald-500" strokeWidth={3} />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Phone size={10} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="tracking-tight">01303950428</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ================= CARD 2: PROJECT SUPERVISION ================= */}
          <div className="relative overflow-hidden rounded-[22px] bg-white/80 dark:bg-[#0c1322]/85 backdrop-blur-xl border border-white/90 dark:border-blue-900/35 p-4.5 sm:p-5 shadow-xs flex flex-col justify-between transition-all">
            <div className="flex flex-col gap-3.5">
              {/* Section Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#f1edf9] dark:border-blue-900/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6355f6]/15 to-[#8b5cf6]/20 text-[#6355f6] dark:text-cyan-300 flex items-center justify-center border border-[#6355f6]/20 shadow-xs">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#161230] dark:text-white leading-tight">
                      Project Supervision
                    </h2>
                    <p className="text-[11px] text-[#787196] dark:text-slate-400 font-medium">
                      Faculty Mentors & Core Directorship
                    </p>
                  </div>
                </div>
              </div>

              {/* Mentor 1: Md. Rasel Mia */}
              <div className="group flex items-center justify-between p-3.5 rounded-xl bg-white/70 dark:bg-[#11192e]/70 border border-[#e8e4f5] dark:border-blue-900/40 shadow-xs hover:border-amber-500/40 dark:hover:border-amber-400/40 transition-all gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ea580c] text-white font-extrabold text-[14px] flex items-center justify-center shadow-md shadow-amber-500/25 flex-shrink-0">
                    RM
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 leading-none mb-1">
                      FACULTY ROLE
                    </span>
                    <h3 className="text-[14.5px] font-bold text-[#161230] dark:text-white leading-tight truncate">
                      Md. Rasel Mia
                    </h3>
                    <span className="text-[11.5px] font-medium text-[#554d74] dark:text-slate-300 mt-0.5">
                      Assistant Professor
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#787196] dark:text-slate-400 mt-1">
                      <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                      <span className="truncate">Gono Bishwabidyalay</span>
                    </div>
                  </div>
                </div>

                {/* Phone Pill */}
                <button
                  onClick={() => handleCopy('rasel', '01738189846')}
                  title="Click to copy phone number"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#ded8f2] dark:border-slate-700/80 text-[#251f44] dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 group/btn"
                >
                  {copiedKey === 'rasel' ? (
                    <>
                      <Check size={11} className="text-emerald-500" strokeWidth={3} />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Phone size={10} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="tracking-tight">01738189846</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mentor 2: AST Sagor */}
              <div className="group flex items-center justify-between p-3.5 rounded-xl bg-white/70 dark:bg-[#11192e]/70 border border-[#e8e4f5] dark:border-blue-900/40 shadow-xs hover:border-blue-500/40 dark:hover:border-cyan-400/40 transition-all gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#2563eb] text-white font-extrabold text-[14px] flex items-center justify-center shadow-md shadow-blue-500/25 flex-shrink-0">
                    AS
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-blue-600 dark:text-cyan-400 leading-none mb-1">
                      FACULTY ROLE
                    </span>
                    <h3 className="text-[14.5px] font-bold text-[#161230] dark:text-white leading-tight truncate">
                      AST Sagor
                    </h3>
                    <span className="text-[11.5px] font-medium text-[#554d74] dark:text-slate-300 mt-0.5">
                      Faculty Member
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#787196] dark:text-slate-400 mt-1">
                      <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                      <span className="truncate">Gono Bishwabidyalay</span>
                    </div>
                  </div>
                </div>

                {/* Phone Pill */}
                <button
                  onClick={() => handleCopy('sagor', '01859000946')}
                  title="Click to copy phone number"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#ded8f2] dark:border-slate-700/80 text-[#251f44] dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 group/btn"
                >
                  {copiedKey === 'sagor' ? (
                    <>
                      <Check size={11} className="text-emerald-500" strokeWidth={3} />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Phone size={10} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="tracking-tight">01859000946</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
