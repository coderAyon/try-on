import React, { useState, useEffect } from 'react';
import {
  Glasses,
  Sparkles,
  Power,
  Settings as SettingsIcon,
  Clock,
  HelpCircle,
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
          if (tab.id && tab.url && !tab.url.startsWith('chrome') && !tab.url.startsWith('edge')) {
            chrome.tabs.sendMessage(
              tab.id,
              { type: 'SETTINGS_UPDATED', payload: updated },
              () => { if (chrome.runtime?.lastError) { /* ignore */ } }
            );
          }
        });
      });
    }
  };

  const handleQuickTryOn = async (urlToTry?: string) => {
    const target = urlToTry || customUrl;
    if (!target) return;

    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0].url && !tabs[0].url.startsWith('chrome') && !tabs[0].url.startsWith('edge')) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              type: 'SHOW_INPAGE_MIRROR',
              payload: {
                frame: target,
                title: 'Online Sunglasses',
                brand: 'Virtual Mirror',
              },
            },
            () => { if (chrome.runtime?.lastError) { /* ignore */ } }
          );
          window.close();
        }
      });
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
          if (tab.id && tab.url && !tab.url.startsWith('chrome') && !tab.url.startsWith('edge')) {
            chrome.tabs.sendMessage(
              tab.id,
              { type: 'SETTINGS_UPDATED', payload: updated },
              () => { if (chrome.runtime?.lastError) { /* ignore */ } }
            );
          }
        });
      });
    }
  };

  return (
    <div className="lumen-popup">
      {/* Ambient background glow accents */}
      <div className="lumen-glow-orb-top" />
      <div className="lumen-glow-orb-bottom" />

      {/* Top Header */}
      <header className="lumen-header">
        <div className="lumen-brand-group">
          <div className="lumen-logo-gem">
            <Glasses size={20} strokeWidth={2.2} />
          </div>
          <div className="lumen-brand-info">
            <div className="lumen-brand-title-row">
              <span className="lumen-brand-title">LUMEN</span>
              <span className="lumen-brand-badge">ANYWHERE</span>
            </div>
            <span className="lumen-brand-subtitle">Real-Time AR Eyewear Mirror</span>
          </div>
        </div>

        {/* Master Power Toggle Button */}
        <button
          onClick={handleToggleEnable}
          className={`lumen-power-toggle ${settings.enabled ? 'active' : 'disabled'}`}
          title={settings.enabled ? 'Click to disable' : 'Click to enable'}
        >
          <span className="lumen-power-dot" />
          <Power size={13} strokeWidth={2.4} />
          <span>{settings.enabled ? 'ACTIVE' : 'OFF'}</span>
        </button>
      </header>

      {/* Navigation Segmented Tabs */}
      <nav className="lumen-nav">
        <button
          onClick={() => setActiveTab('quick')}
          className={`lumen-nav-tab ${activeTab === 'quick' ? 'active' : ''}`}
        >
          <Sparkles size={14} />
          <span>Try-On</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`lumen-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
        >
          <Clock size={14} />
          <span>Recent</span>
          {history.length > 0 && (
            <span className="lumen-badge-pill">{history.length}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`lumen-nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <SettingsIcon size={14} />
          <span>Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`lumen-nav-tab ${activeTab === 'guide' ? 'active' : ''}`}
        >
          <HelpCircle size={14} />
          <span>Guide</span>
        </button>
      </nav>

      {/* Main Viewport Content */}
      <main className="lumen-main">
        {/* Tab 1: Try-On */}
        {activeTab === 'quick' && (
          <>
            {/* Live Status Beacon Card */}
            <div className="lumen-card">
              <div className="lumen-radar-header">
                <span className="lumen-radar-title">
                  <span className="lumen-beacon">
                    <span className="lumen-beacon-dot" />
                    <span className="lumen-beacon-ring" />
                  </span>
                  <span>AI Eyewear Radar Ready</span>
                </span>
                <span className="lumen-version-tag">MV3 · 60FPS</span>
              </div>
              <p className="lumen-card-desc">
                {settings.enabled
                  ? 'Browse any online eyewear store. Hover over any sunglasses photo to reveal the floating "Try This Frame" button.'
                  : 'Extension is paused. Click the ACTIVE button above to resume automatic store scanning.'}
              </p>
              <div className="lumen-store-tags">
                <span className="lumen-store-pill">Ray-Ban</span>
                <span className="lumen-store-pill">Amazon</span>
                <span className="lumen-store-pill">Prada</span>
                <span className="lumen-store-pill">Oakley</span>
                <span className="lumen-store-pill">Zara</span>
              </div>
            </div>

            {/* Direct Image Try-On Input Card */}
            <div className="lumen-card">
              <label className="lumen-input-label">
                <span>Direct Image URL Try-On</span>
              </label>
              <div className="lumen-input-row">
                <input
                  type="text"
                  placeholder="Paste any sunglasses image URL…"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="lumen-url-input"
                />
                <button
                  onClick={() => handleQuickTryOn()}
                  disabled={!customUrl.trim()}
                  className="lumen-btn-try"
                  title="Try this image"
                >
                  <span>Try</span>
                  <ChevronRight size={14} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            {/* Launch In-Page AR Video Mirror Button */}
            <button
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const activeTab = tabs[0];
                    if (activeTab?.id && activeTab.url && !activeTab.url.startsWith('chrome') && !activeTab.url.startsWith('edge')) {
                      chrome.tabs.sendMessage(
                        activeTab.id,
                        {
                          type: 'SHOW_INPAGE_MIRROR',
                          payload: {
                            frame: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
                            title: 'Lumen Signature Aviator',
                            brand: 'Virtual Mirror',
                          },
                        },
                        () => { if (chrome.runtime?.lastError) { /* ignore */ } }
                      );
                      window.close();
                    }
                  });
                }
              }}
              className="lumen-hero-launch-btn"
            >
              <Camera size={18} strokeWidth={2.2} />
              <span>Launch AR Video Mirror</span>
              <Sparkles size={15} />
            </button>
          </>
        )}

        {/* Tab 2: Recent History */}
        {activeTab === 'history' && (
          <div className="lumen-card">
            <div className="lumen-hist-top">
              <span>Recently tried frames</span>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="lumen-btn-clear"
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="lumen-empty-hist">
                <Glasses className="lumen-empty-icon" size={36} />
                <p>No recently tried frames yet.</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>
                  Hover over sunglasses on any shopping page and click "Try This Frame".
                </p>
              </div>
            ) : (
              <div className="lumen-hist-list">
                {history.map((item) => (
                  <div key={item.id} className="lumen-hist-item">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="lumen-hist-img"
                    />
                    <div className="lumen-hist-info">
                      <span className="lumen-hist-title">{item.title}</span>
                      <span className="lumen-hist-brand">{item.brand || item.domain}</span>
                    </div>
                    <button
                      onClick={() => handleQuickTryOn(item.imageUrl)}
                      className="lumen-hist-btn"
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
          <div className="lumen-card" style={{ gap: '10px' }}>
            {/* Floating button toggle */}
            <div className="lumen-setting-row">
              <div className="lumen-setting-info">
                <span className="lumen-setting-title">Floating "Try On" Button</span>
                <span className="lumen-setting-sub">Show button on sunglasses hover</span>
              </div>
              <label className="lumen-switch">
                <input
                  type="checkbox"
                  checked={settings.showFloatingBadge}
                  onChange={(e) => handleSaveSettings({ showFloatingBadge: e.target.checked })}
                />
                <span className="lumen-slider" />
              </label>
            </div>

            {/* Auto-detect toggle */}
            <div className="lumen-setting-row">
              <div className="lumen-setting-info">
                <span className="lumen-setting-title">Auto-Detect Frames</span>
                <span className="lumen-setting-sub">Smart image classification</span>
              </div>
              <label className="lumen-switch">
                <input
                  type="checkbox"
                  checked={settings.autoDetect}
                  onChange={(e) => handleSaveSettings({ autoDetect: e.target.checked })}
                />
                <span className="lumen-slider" />
              </label>
            </div>

            {/* Preferred mode */}
            <div className="lumen-setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
              <div className="lumen-setting-info">
                <span className="lumen-setting-title">Preferred Try-On Mode</span>
                <span className="lumen-setting-sub">Camera mirror format</span>
              </div>
              <div className="lumen-mode-group" style={{ width: '100%' }}>
                <button
                  onClick={() => handleSaveSettings({ preferredMode: 'webcam' })}
                  className={`lumen-mode-btn ${settings.preferredMode === 'webcam' ? 'active' : ''}`}
                >
                  Live Webcam Mirror
                </button>
                <button
                  onClick={() => handleSaveSettings({ preferredMode: 'photo' })}
                  className={`lumen-mode-btn ${settings.preferredMode === 'photo' ? 'active' : ''}`}
                >
                  Photo Upload
                </button>
              </div>
            </div>

            {savedSuccess && (
              <div className="lumen-toast-success">
                <Check size={14} strokeWidth={2.4} />
                <span>Settings saved successfully</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Guide */}
        {activeTab === 'guide' && (
          <div className="lumen-card" style={{ gap: '10px' }}>
            <div className="lumen-guide-card">
              <span className="lumen-step-badge">1</span>
              <div className="lumen-guide-info">
                <span className="lumen-guide-title">Browse Any Eyewear Store</span>
                <span className="lumen-guide-desc">
                  Visit Ray-Ban, Amazon, Prada, or any fashion retailer selling glasses.
                </span>
              </div>
            </div>

            <div className="lumen-guide-card">
              <span className="lumen-step-badge">2</span>
              <div className="lumen-guide-info">
                <span className="lumen-guide-title">Hover & Click "Try This Frame"</span>
                <span className="lumen-guide-desc">
                  The extension detects the sunglasses and displays a floating glow button.
                </span>
              </div>
            </div>

            <div className="lumen-guide-card">
              <span className="lumen-step-badge">3</span>
              <div className="lumen-guide-info">
                <span className="lumen-guide-title">Real-Time AR Video Mirror</span>
                <span className="lumen-guide-desc">
                  The in-page mirror opens at the bottom with live eye & nasal bridge alignment!
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="lumen-footer">
        <span>Lumen Vision Anywhere</span>
        <span>Microsoft Edge & Chrome MV3</span>
      </footer>
    </div>
  );
};
