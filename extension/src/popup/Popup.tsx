import React, { useState, useEffect } from 'react';
import {
  Glasses,
  Sparkles,
  Power,
  Settings as SettingsIcon,
  Clock,
  HelpCircle,
  ExternalLink,
  Trash2,
  Check,
  ChevronRight,
  Camera,
} from 'lucide-react';
import { ExtensionSettings, FrameHistoryItem } from '../types';
import { getSettings, saveSettings, getFrameHistory, clearFrameHistory } from '../utils/storage';

export const Popup: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>({
    enabled: true,
    showFloatingBadge: true,
    autoDetect: true,
    appUrl: 'http://localhost:3000',
    preferredMode: 'webcam',
  });
  const [activeTab, setActiveTab] = useState<'quick' | 'history' | 'settings' | 'guide'>('quick');
  const [history, setHistory] = useState<FrameHistoryItem[]>([]);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    getSettings().then(setSettings);
    getFrameHistory().then(setHistory);
  }, []);

  const handleToggleEnable = async () => {
    const next = !settings.enabled;
    const updated = await saveSettings({ enabled: next });
    setSettings(updated);

    // Notify active tabs
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_UPDATED',
              payload: updated,
            }).catch(() => {});
          }
        });
      });
    }
  };

  const handleQuickTryOn = (urlToTry?: string) => {
    const target = urlToTry || customUrl;
    if (!target) return;

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'OPEN_TRYON',
        payload: {
          frame: target,
          title: 'Custom Sunglasses Image',
          brand: 'Web Frame',
        },
      });
    } else {
      const appUrl = `${settings.appUrl}/#try-on?frame=${encodeURIComponent(target)}&title=Web+Frame`;
      window.open(appUrl, '_blank');
    }
  };

  const handleClearHistory = async () => {
    await clearFrameHistory();
    setHistory([]);
  };

  const handleSaveSettings = async (partial: Partial<ExtensionSettings>) => {
    const updated = await saveSettings(partial);
    setSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_UPDATED',
              payload: updated,
            }).catch(() => {});
          }
        });
      });
    }
  };

  return (
    <div className="w-[380px] min-h-[500px] flex flex-col bg-[#0d0a1a] text-slate-100 p-4 select-none relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between pb-3.5 border-b border-purple-500/20 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Glasses className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wide text-white">LUMEN</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ANYWHERE
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Virtual AR Sunglasses Try-On</p>
          </div>
        </div>

        {/* Master Power Toggle */}
        <button
          onClick={handleToggleEnable}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            settings.enabled
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/20'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{settings.enabled ? 'ACTIVE' : 'DISABLED'}</span>
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 py-3 border-b border-white/5 relative z-10 text-xs">
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'quick'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Try-On</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Recent ({history.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'guide'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Guide</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 py-3 flex flex-col gap-3 relative z-10">
        {/* Tab 1: Quick Try-On */}
        {activeTab === 'quick' && (
          <div className="flex flex-col gap-3">
            {/* Status Card */}
            <div className="glass-panel p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${settings.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  Extension Engine Status
                </span>
                <span className="text-[11px] text-slate-400">Edge & Chrome MV3</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {settings.enabled
                  ? 'Ready! Browse any sunglasses website (Ray-Ban, Amazon, Prada) and hover over any frame to see the floating "Try This Frame" button.'
                  : 'Extension is currently disabled. Toggle the top switch to resume scanning webpages.'}
              </p>
            </div>

            {/* Paste Image URL Directly */}
            <div className="glass-panel p-3.5 flex flex-col gap-2.5">
              <label className="text-xs font-semibold text-slate-300">
                Direct Image Try-On
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste any sunglasses image URL…"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-purple-500/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <button
                  onClick={() => handleQuickTryOn()}
                  disabled={!customUrl.trim()}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-purple-600/30 transition-all"
                >
                  <span>Try</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Launch Full Studio */}
            <button
              onClick={() => {
                const target = `${settings.appUrl}/#try-on`;
                if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                  chrome.tabs.create({ url: target });
                } else {
                  window.open(target, '_blank');
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl glow-btn text-white text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Open Virtual Try-On Studio</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        )}

        {/* Tab 2: Recent History */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Recently tried frames</span>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="glass-panel p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <Glasses className="w-8 h-8 text-purple-400/40" />
                <p>No recently tried frames yet.</p>
                <p className="text-[11px] text-slate-500">Visit any sunglasses website and click "Try This Frame" to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="glass-panel glass-panel-hover p-2.5 flex items-center gap-3 transition-colors"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-12 h-10 object-contain rounded-lg bg-black/40 border border-white/5 p-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">{item.title}</h4>
                      <p className="text-[10px] text-purple-300 truncate">{item.brand || item.domain}</p>
                    </div>
                    <button
                      onClick={() => handleQuickTryOn(item.imageUrl)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600/40 hover:bg-purple-600/70 border border-purple-400/30 text-white text-[11px] font-medium"
                    >
                      Try On
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Settings */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-3 text-xs">
            {/* Floating button toggle */}
            <div className="glass-panel p-3 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-white">Floating "Try On" Button</h4>
                <p className="text-[11px] text-slate-400">Show button when hovering on sunglasses</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showFloatingBadge}
                onChange={(e) => handleSaveSettings({ showFloatingBadge: e.target.checked })}
                className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
              />
            </div>

            {/* Preferred mode */}
            <div className="glass-panel p-3 flex flex-col gap-2">
              <div>
                <h4 className="font-semibold text-white">Preferred Try-On Mode</h4>
                <p className="text-[11px] text-slate-400">Choose your default fitting room mode</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveSettings({ preferredMode: 'webcam' })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium ${
                    settings.preferredMode === 'webcam'
                      ? 'bg-purple-600/40 text-purple-200 border-purple-400/50'
                      : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                  }`}
                >
                  Live Webcam AR
                </button>
                <button
                  onClick={() => handleSaveSettings({ preferredMode: 'photo' })}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium ${
                    settings.preferredMode === 'photo'
                      ? 'bg-purple-600/40 text-purple-200 border-purple-400/50'
                      : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/5'
                  }`}
                >
                  Photo Try-On
                </button>
              </div>
            </div>

            {/* Web App URL */}
            <div className="glass-panel p-3 flex flex-col gap-2">
              <div>
                <h4 className="font-semibold text-white">Try-On Studio URL</h4>
                <p className="text-[11px] text-slate-400">Local or production web app host</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.appUrl}
                  onChange={(e) => setSettings({ ...settings, appUrl: e.target.value })}
                  onBlur={() => handleSaveSettings({ appUrl: settings.appUrl })}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-purple-500/20 text-xs text-white"
                />
              </div>
            </div>

            {savedSuccess && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 rounded-lg">
                <Check className="w-3.5 h-3.5" />
                <span>Settings saved successfully</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Guide */}
        {activeTab === 'guide' && (
          <div className="flex flex-col gap-2.5 text-xs">
            <div className="glass-panel p-3 flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs shrink-0">
                1
              </span>
              <div>
                <h4 className="font-semibold text-white">Browse Any Website</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  Visit Ray-Ban, Amazon, Prada, Oakley, or any fashion retailer with sunglasses products.
                </p>
              </div>
            </div>

            <div className="glass-panel p-3 flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs shrink-0">
                2
              </span>
              <div>
                <h4 className="font-semibold text-white">Hover Over Sunglasses</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  The extension detects the sunglasses frame and reveals a floating "Try This Frame" button.
                </p>
              </div>
            </div>

            <div className="glass-panel p-3 flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs shrink-0">
                3
              </span>
              <div>
                <h4 className="font-semibold text-white">Live 3D Face Fitting</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  Click the button to instantly try the exact sunglasses on your webcam face mesh with realistic depth occlusion!
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="pt-2 text-center text-[10px] text-slate-500 border-t border-white/5 relative z-10 flex items-center justify-between">
        <span>Lumen Vision Anywhere</span>
        <span>Microsoft Edge & Chrome MV3</span>
      </footer>
    </div>
  );
};
