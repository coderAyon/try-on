import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  LogOut,
  Camera,
  Heart,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { soundEffects } from '../../utils/audio';

interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLogin: (user: UserProfile) => void;
  onLogout: () => void;
  savedLooksCount: number;
  wishlistCount: number;
  onOpenGallery?: () => void;
}

export const AccountDrawer: React.FC<AccountDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin,
  onLogout,
  savedLooksCount,
  wishlistCount,
  onOpenGallery,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [preferredStyle, setPreferredStyle] = useState('Aviator');
  const [rememberMe, setRememberMe] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    soundEffects.playClick();
    const user: UserProfile = {
      id: `usr_${Date.now()}`,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Visionary Guest',
      email: email.trim(),
      preferredStyle: 'Aviator',
      joinedAt: new Date().toISOString(),
    };
    onLogin(user);
    setSuccessMsg('Signed in successfully! Welcome back.');
    setTimeout(() => {
      setSuccessMsg('');
    }, 2500);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill out all required fields.');
      return;
    }
    soundEffects.playClick();
    const user: UserProfile = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      preferredStyle,
      joinedAt: new Date().toISOString(),
    };
    onLogin(user);
    setSuccessMsg('Account created successfully! Your virtual lookbook is active.');
    setTimeout(() => {
      setSuccessMsg('');
    }, 2500);
  };

  const handleGuestSignIn = () => {
    soundEffects.playClick();
    const user: UserProfile = {
      id: `usr_guest_${Date.now()}`,
      name: 'Visionary Guest',
      email: 'guest@lumen.vision',
      preferredStyle: 'Wayfarer',
      joinedAt: new Date().toISOString(),
    };
    onLogin(user);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Mini Right Slide-Over Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6">
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Account and Profile Settings"
          className="w-screen max-w-[390px] sm:max-w-[410px] bg-white border-l border-[#eceaf5] shadow-[-12px_0_40px_rgba(26,20,56,0.14)] flex flex-col justify-between overflow-y-auto"
        >
          {/* Top Bar / Header */}
          <div className="p-5 sm:p-6 border-b border-[#f0edf7] flex items-center justify-between bg-gradient-to-r from-white via-[#faf9ff] to-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#6355f6]/10 text-[#6355f6] flex items-center justify-center border border-[#6355f6]/20 shadow-sm">
                <Sparkles size={17} strokeWidth={2.3} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#181236] leading-none">
                  {currentUser ? 'My Profile' : 'Lumen Account'}
                </h3>
                <span className="text-[11px] text-[#71698e] font-medium">
                  {currentUser ? 'Studio Member' : 'Sign in to sync your lookbook'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                soundEffects.playClick();
                onClose();
              }}
              aria-label="Close Account Panel"
              className="w-8 h-8 rounded-full bg-[#f4f2fb] hover:bg-[#eae6f7] text-[#4d456a] hover:text-[#181236] flex items-center justify-center transition-all cursor-pointer"
            >
              <X size={17} strokeWidth={2.2} />
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-[12px] font-medium animate-in slide-in-from-top-2">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] font-medium animate-in slide-in-from-top-2">
              {errorMsg}
            </div>
          )}

          {/* Main Body */}
          <div className="flex-1 p-5 sm:p-6">
            {currentUser ? (
              /* =========================================================
                 LOGGED IN VIEW: User Profile & Quick Studio Metrics
                 ========================================================= */
              <div className="flex flex-col gap-5">
                {/* User Identity Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#f8f7ff] via-[#f2efff] to-[#ebe7fe] border border-[#e2dcfc] shadow-sm flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-[#6355f6] text-white flex items-center justify-center text-lg font-bold shadow-md shadow-[#6355f6]/25 flex-shrink-0">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6355f6]/15 text-[#6355f6] border border-[#6355f6]/20">
                        VIP Visionary
                      </span>
                    </div>
                    <h4 className="text-[15px] font-bold text-[#1a1438] truncate leading-tight">
                      {currentUser.name}
                    </h4>
                    <p className="text-[11.5px] text-[#696287] truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                {/* Studio Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onClose();
                      onOpenGallery?.();
                    }}
                    className="p-3.5 rounded-2xl bg-[#f8f7fc] border border-[#ebe7f5] hover:border-[#6355f6]/40 hover:bg-[#f3f0fd] transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-[#6355f6] mb-1.5">
                      <Camera size={18} />
                      <span className="text-[10px] font-bold text-[#71698e] group-hover:text-[#6355f6]">
                        View →
                      </span>
                    </div>
                    <div className="text-[18px] font-extrabold text-[#191338]">
                      {savedLooksCount}
                    </div>
                    <div className="text-[11px] font-medium text-[#655d82]">
                      Saved Snaps in Gallery
                    </div>
                  </button>

                  <div className="p-3.5 rounded-2xl bg-[#f8f7fc] border border-[#ebe7f5] text-left">
                    <div className="flex items-center justify-between text-rose-500 mb-1.5">
                      <Heart size={18} />
                      <span className="text-[10px] font-bold text-[#71698e]">
                        Catalog
                      </span>
                    </div>
                    <div className="text-[18px] font-extrabold text-[#191338]">
                      {wishlistCount}
                    </div>
                    <div className="text-[11px] font-medium text-[#655d82]">
                      Wishlist Favorites
                    </div>
                  </div>
                </div>

                {/* Preferences Details */}
                <div className="p-4 rounded-2xl bg-white border border-[#eae6f5] shadow-sm flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#797199]">
                    Try-On Preferences
                  </span>
                  <div className="flex items-center justify-between text-[12.5px] text-[#292248]">
                    <span>Preferred Frame Style</span>
                    <span className="font-bold text-[#6355f6] bg-[#f1edfe] px-2.5 py-0.5 rounded-lg border border-[#e4dcfa]">
                      {currentUser.preferredStyle || 'Aviator'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[12.5px] text-[#292248]">
                    <span>Synced Device</span>
                    <span className="font-semibold text-[#544d71]">WebGL 3D Studio</span>
                  </div>
                </div>

                {/* Open Gallery CTA */}
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    onClose();
                    onOpenGallery?.();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6355f6] to-[#7c3aed] text-white text-[13px] font-bold shadow-md shadow-[#6355f6]/25 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera size={16} />
                  <span>Open Lookbook Gallery</span>
                </button>

                {/* Log Out Button */}
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    onLogout();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#e4dfed] text-[#71688b] hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 text-[12.5px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              /* =========================================================
                 LOGGED OUT VIEW: Sign In or Sign Up Form
                 ========================================================= */
              <div className="flex flex-col gap-5">
                {/* Tab Switcher: Sign In vs Sign Up */}
                <div className="grid grid-cols-2 p-1 bg-[#f1eff9] rounded-xl border border-[#e8e4f5]">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playClick();
                      setTab('signin');
                      setErrorMsg('');
                    }}
                    className={`py-2 text-[12.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      tab === 'signin'
                        ? 'bg-white text-[#6355f6] shadow-sm'
                        : 'text-[#615a81] hover:text-[#181236]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playClick();
                      setTab('signup');
                      setErrorMsg('');
                    }}
                    className={`py-2 text-[12.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      tab === 'signup'
                        ? 'bg-white text-[#6355f6] shadow-sm'
                        : 'text-[#615a81] hover:text-[#181236]'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {tab === 'signin' ? (
                  /* --- SIGN IN FORM --- */
                  <form onSubmit={handleSignIn} className="flex flex-col gap-3.5">
                    {/* Email Input */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#443c64] uppercase tracking-wider mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]"
                        />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#e2dff0] text-[13px] text-[#1b153b] placeholder-[#a69fc0] focus:outline-none focus:border-[#6355f6] focus:ring-2 focus:ring-[#6355f6]/15 transition-all bg-[#faf9fe]"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-[#443c64] uppercase tracking-wider">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => alert('Password reset link will be sent to your email.')}
                          className="text-[11px] font-semibold text-[#6355f6] hover:underline cursor-pointer"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#e2dff0] text-[13px] text-[#1b153b] placeholder-[#a69fc0] focus:outline-none focus:border-[#6355f6] focus:ring-2 focus:ring-[#6355f6]/15 transition-all bg-[#faf9fe]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa] hover:text-[#181236] cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-[#d8d3e8] text-[#6355f6] focus:ring-[#6355f6] cursor-pointer"
                      />
                      <label
                        htmlFor="rememberMe"
                        className="text-[12px] text-[#595278] font-medium cursor-pointer"
                      >
                        Remember my login on this device
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#6355f6] to-[#7c3aed] text-white text-[13.5px] font-bold shadow-md shadow-[#6355f6]/25 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Sign In to Studio</span>
                      <ArrowRight size={15} />
                    </button>
                  </form>
                ) : (
                  /* --- SIGN UP FORM --- */
                  <form onSubmit={handleSignUp} className="flex flex-col gap-3">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#443c64] uppercase tracking-wider mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]"
                        />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Sarah Connor"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#e2dff0] text-[13px] text-[#1b153b] placeholder-[#a69fc0] focus:outline-none focus:border-[#6355f6] focus:ring-2 focus:ring-[#6355f6]/15 transition-all bg-[#faf9fe]"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#443c64] uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]"
                        />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="sarah@example.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#e2dff0] text-[13px] text-[#1b153b] placeholder-[#a69fc0] focus:outline-none focus:border-[#6355f6] focus:ring-2 focus:ring-[#6355f6]/15 transition-all bg-[#faf9fe]"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#443c64] uppercase tracking-wider mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <Lock
                          size={16}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#e2dff0] text-[13px] text-[#1b153b] placeholder-[#a69fc0] focus:outline-none focus:border-[#6355f6] focus:ring-2 focus:ring-[#6355f6]/15 transition-all bg-[#faf9fe]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa] hover:text-[#181236] cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Preferred Style */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#443c64] uppercase tracking-wider mb-1">
                        Preferred Eyewear Style
                      </label>
                      <select
                        value={preferredStyle}
                        onChange={(e) => setPreferredStyle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2dff0] text-[13px] text-[#1b153b] focus:outline-none focus:border-[#6355f6] bg-[#faf9fe] cursor-pointer"
                      >
                        <option value="Aviator">Aviator (Timeless Iconic)</option>
                        <option value="Wayfarer">Wayfarer (Retro Classic)</option>
                        <option value="Round">Round (Bohemian Vintage)</option>
                        <option value="Cat-Eye">Cat-Eye (Feminine Chic)</option>
                        <option value="Sport">Sport (Performance Aerodynamic)</option>
                        <option value="Hexagonal">Hexagonal (Modern Geometric)</option>
                      </select>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#6355f6] to-[#7c3aed] text-white text-[13.5px] font-bold shadow-md shadow-[#6355f6]/25 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles size={15} />
                      <span>Create Account & Save Looks</span>
                    </button>
                  </form>
                )}

                {/* Divider */}
                <div className="relative my-2 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#ede9f5]" />
                  </div>
                  <span className="relative px-3 bg-white text-[10.5px] uppercase font-bold tracking-wider text-[#938ba8]">
                    Or quick continue
                  </span>
                </div>

                {/* Guest Access Button */}
                <button
                  type="button"
                  onClick={handleGuestSignIn}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#ded8ed] hover:border-[#6355f6] hover:bg-[#faf9ff] text-[#3d365a] hover:text-[#6355f6] text-[12.5px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <User size={15} />
                  <span>Continue as Guest</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Security Badge */}
          <div className="p-4 border-t border-[#f0edf7] bg-[#faf9fe] flex items-center justify-center gap-2 text-[11px] text-[#7d759a]">
            <ShieldCheck size={14} className="text-[#6355f6]" />
            <span>Encrypted local biometric security · GDPR Compliant</span>
          </div>
        </aside>
      </div>
    </div>
  );
};
