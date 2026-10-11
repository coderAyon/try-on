import React, { useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Download,
  Trash2,
  Maximize2,
  X,
  Sparkles,
  Glasses,
  Calendar,
  Share2,
  Check,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SavedLook, SunglassesProduct } from '../../types';
import { soundEffects } from '../../utils/audio';

interface GalleryPageProps {
  savedLooks: SavedLook[];
  products: SunglassesProduct[];
  onSelectProductForTryOn: (productId: string) => void;
  onDeleteLook: (id: string) => void;
  onClearAllLooks: () => void;
  onBackToFittingRoom: () => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({
  savedLooks,
  products,
  onSelectProductForTryOn,
  onDeleteLook,
  onClearAllLooks,
  onBackToFittingRoom,
}) => {
  const [selectedLook, setSelectedLook] = useState<SavedLook | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtered looks
  const filteredLooks = savedLooks.filter((look) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      look.productName.toLowerCase().includes(q) ||
      look.variantName.toLowerCase().includes(q) ||
      look.productId.toLowerCase().includes(q)
    );
  });

  const handleDownload = (look: SavedLook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEffects.playClick();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#6355f6', '#8b5cf6', '#c084fc', '#ffffff'],
    });

    const link = document.createElement('a');
    link.download = `Lumen_Vision_${look.productName.replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = look.dataUrl;
    link.click();
  };

  const handleTryOnFrame = (productId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEffects.playTryOnChime();
    onSelectProductForTryOn(productId);
  };

  const handleCopyShare = (look: SavedLook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundEffects.playClick();
    navigator.clipboard?.writeText(window.location.origin + `#frame/${encodeURIComponent(look.productId)}`);
    setCopiedId(look.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent Snap';
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-6 select-none animate-in fade-in duration-200">
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/95 backdrop-blur-md rounded-[24px] border border-[#eceaf5] p-5 sm:p-7 shadow-[0_2px_16px_rgba(109,40,217,0.04)]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                onBackToFittingRoom();
              }}
              className="flex items-center gap-2 text-[12.5px] font-bold text-[#6355f6] hover:text-[#4f3ff2] transition-colors cursor-pointer group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Fitting Room</span>
            </button>
            <span className="text-[#dcd7f2]">/</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7c749c] bg-[#f4f2fc] px-2.5 py-0.5 rounded-full border border-[#e5e1f7]">
              Lookbook Gallery
            </span>
          </div>

          <h1 className="text-[22px] sm:text-[26px] font-bold text-[#181236] tracking-tight">
            Saved Try-On Snapshots
          </h1>
          <p className="text-[12.5px] text-[#696187] max-w-xl">
            Every photo snapped during your live camera fitting room session is safely preserved here. Compare your looks, download in ultra high-resolution, or try on again.
          </p>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              soundEffects.playClick();
              onBackToFittingRoom();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#6355f6] to-[#7c3aed] text-white text-[13px] font-bold shadow-md shadow-[#6355f6]/25 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <Camera size={16} />
            <span>Take New Snapshot</span>
          </button>

          {savedLooks.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all saved snapshots in your gallery?')) {
                  soundEffects.playClick();
                  onClearAllLooks();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[#eddfe0] text-rose-600 hover:bg-rose-50 text-[12px] font-bold transition-all cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Search & Counter Bar */}
      {savedLooks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <div className="relative w-full sm:w-72">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by frame name..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#e4e1f2] text-[12.5px] text-[#1b153b] placeholder-[#a69fc0] focus:outline-none focus:border-[#6355f6] transition-all"
            />
          </div>

          <div className="text-[12.5px] font-semibold text-[#574f76]">
            Showing <span className="text-[#6355f6] font-bold">{filteredLooks.length}</span> of {savedLooks.length} {savedLooks.length === 1 ? 'look' : 'looks'}
          </div>
        </div>
      )}

      {/* 3. Empty State OR Looks Grid */}
      {savedLooks.length === 0 ? (
        /* Empty Lookbook Hero Card */
        <div className="bg-white rounded-[26px] border border-[#ebe8f5] shadow-[0_4px_24px_rgba(109,40,217,0.04)] p-10 sm:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ece9fe] to-[#e4e0fc] text-[#6355f6] flex items-center justify-center mb-5 shadow-sm border border-[#ded8fa]">
            <Camera size={38} strokeWidth={1.8} />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c749c] mb-1.5">
            Gallery Empty
          </span>
          <h2 className="text-[20px] sm:text-[23px] font-bold text-[#1a1438] mb-2.5">
            No snapshots captured yet
          </h2>
          <p className="text-[13px] text-[#6a638b] max-w-md mb-6 leading-relaxed">
            Start your live camera session, test out your favorite sunglasses, and click the <strong>Camera Shutter</strong> icon at the top right of the viewport to save your looks here!
          </p>

          <button
            onClick={() => {
              soundEffects.playClick();
              onBackToFittingRoom();
            }}
            className="flex items-center gap-2.5 bg-[#6355f6] hover:bg-[#5242ee] text-white px-7 py-3 rounded-full text-[13.5px] font-bold shadow-lg shadow-[#6355f6]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Camera size={17} />
            <span>Open Camera & Start Snapping</span>
          </button>
        </div>
      ) : filteredLooks.length === 0 ? (
        /* No search results */
        <div className="bg-white rounded-2xl border border-[#ebe8f5] p-10 text-center">
          <p className="text-[#625a81] text-[13px]">
            No snapshots matched "<strong>{searchQuery}</strong>".
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-[#6355f6] text-[12px] font-bold underline cursor-pointer"
          >
            Clear search
          </button>
        </div>
      ) : (
        /* Grid of Captured Looks */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredLooks.map((look) => {
            const product = products.find((p) => p.id === look.productId);

            return (
              <div
                key={look.id}
                onClick={() => setSelectedLook(look)}
                className="bg-white rounded-[22px] border border-[#eceaf5] overflow-hidden shadow-[0_2px_14px_rgba(109,40,217,0.05)] hover:shadow-[0_8px_28px_rgba(99,85,246,0.14)] hover:border-[#cfc9fc] transition-all duration-200 cursor-pointer flex flex-col group"
              >
                {/* Snapshot Image Container */}
                <div className="relative aspect-[4/3] bg-[#161228] overflow-hidden">
                  <img
                    src={look.dataUrl}
                    alt={look.productName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20 opacity-80 group-hover:opacity-90 transition-opacity" />

                  {/* Top Badges */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-white border border-white/20">
                      {look.variantName}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLook(look);
                      }}
                      title="Enlarge Snapshot"
                      className="w-7 h-7 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-all"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>

                  {/* Bottom Image Info */}
                  <div className="absolute bottom-3 inset-x-3 text-white">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[#d0c9ff] flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(look.capturedAt)}
                    </p>
                    <h3 className="text-[14px] font-bold truncate leading-snug drop-shadow-sm">
                      {look.productName}
                    </h3>
                  </div>
                </div>

                {/* Card Controls & Action Buttons */}
                <div className="p-3.5 bg-white flex items-center justify-between gap-2 border-t border-[#f2eff8]">
                  {/* Try On Button */}
                  <button
                    onClick={(e) => handleTryOnFrame(look.productId, e)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#f2efff] hover:bg-[#6355f6] text-[#6355f6] hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Glasses size={14} />
                    <span>Try On Again</span>
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={(e) => handleDownload(look, e)}
                    title="Download High-Res Snapshot"
                    className="w-8 h-8 rounded-xl bg-[#f5f3fb] hover:bg-[#eae6f8] text-[#4d456d] hover:text-[#191338] flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Download size={15} />
                  </button>

                  {/* Share Link */}
                  <button
                    onClick={(e) => handleCopyShare(look, e)}
                    title="Copy Frame Link"
                    className="w-8 h-8 rounded-xl bg-[#f5f3fb] hover:bg-[#eae6f8] text-[#4d456d] hover:text-[#191338] flex items-center justify-center transition-all cursor-pointer"
                  >
                    {copiedId === look.id ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this look from your gallery?')) {
                        soundEffects.playClick();
                        onDeleteLook(look.id);
                      }
                    }}
                    title="Delete Snapshot"
                    className="w-8 h-8 rounded-xl bg-[#fef2f2] hover:bg-rose-100 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Fullscreen Lightbox Modal */}
      {selectedLook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-[#130f24] rounded-[28px] overflow-hidden border border-[#3b325c] shadow-2xl flex flex-col text-white">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#292244] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#6355f6]/20 text-[#a394ff] flex items-center justify-center border border-[#6355f6]/30">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold leading-tight">
                    {selectedLook.productName}
                  </h3>
                  <span className="text-[11px] text-[#a49cb8]">
                    {selectedLook.variantName} · Captured {formatDate(selectedLook.capturedAt)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedLook(null)}
                className="w-8 h-8 rounded-full bg-[#292244] hover:bg-[#3b325c] text-[#c2bccc] flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            {/* High Resolution Image Viewport */}
            <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center">
              <img
                src={selectedLook.dataUrl}
                alt={selectedLook.productName}
                className="w-full h-full object-contain"
              />

              {/* Watermark Strip */}
              <div className="absolute bottom-3 left-4 right-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#a594ff] font-bold">
                  LUMEN.VISION 3D VIRTUAL TRY-ON
                </span>
                <span className="text-[#8c85a1]">
                  IPD: {selectedLook.ipdMm ? `${selectedLook.ipdMm}mm` : '63mm'} · Precision Fitted
                </span>
              </div>
            </div>

            {/* Modal Bottom Controls */}
            <div className="p-4 sm:p-5 border-t border-[#292244] flex flex-wrap items-center justify-between gap-3 bg-[#17122c]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedLook)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6355f6] hover:bg-[#5242ee] text-white text-[12.5px] font-bold transition-all cursor-pointer shadow-md shadow-[#6355f6]/25"
                >
                  <Download size={15} />
                  <span>Download Ultra HD</span>
                </button>

                <button
                  onClick={() => handleTryOnFrame(selectedLook.productId)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#292244] hover:bg-[#3b325c] text-white text-[12.5px] font-bold transition-all cursor-pointer"
                >
                  <Glasses size={15} />
                  <span>Try On in Fitting Room</span>
                </button>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('Delete this look?')) {
                    onDeleteLook(selectedLook.id);
                    setSelectedLook(null);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-[12px] font-semibold transition-all cursor-pointer ml-auto"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
