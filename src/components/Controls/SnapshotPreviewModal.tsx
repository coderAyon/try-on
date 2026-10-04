import React from 'react';
import { X, Download, Share2, Sparkles, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SunglassesProduct } from '../../types';
import { soundEffects } from '../../utils/audio';

interface SnapshotPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotDataUrl: string | null;
  product: SunglassesProduct;
}

export const SnapshotPreviewModal: React.FC<SnapshotPreviewModalProps> = ({
  isOpen,
  onClose,
  snapshotDataUrl,
  product,
}) => {
  if (!isOpen || !snapshotDataUrl) return null;

  const handleDownload = () => {
    soundEffects.playClick();
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#a855f7', '#d8b4fe', '#ffffff', '#D4AF37'],
    });

    const link = document.createElement('a');
    link.download = `LumenVision_${product.brand}_${product.name.replace(/\s+/g, '_')}_TryOn.png`;
    link.href = snapshotDataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl glass-panel-gold rounded-3xl p-6 sm:p-8 shadow-2xl border border-luxury-gold/40 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-luxury-gold" />
            <h3 className="font-serif text-lg font-bold text-slate-100">
              Virtual Try-On Lookbook Snapshot
            </h3>
          </div>
          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-luxury-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot Image Polaroid Card */}
        <div className="relative rounded-2xl overflow-hidden bg-luxury-950 border border-luxury-gold/20 shadow-2xl group">
          <img
            src={snapshotDataUrl}
            alt="Virtual Try-On Snapshot"
            className="w-full aspect-[4/3] object-cover"
          />

          {/* Luxury Editorial Watermark Overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-luxury-gold font-bold">
                LUMEN VISION • FITTINGBOX HIGH PRECISION
              </p>
              <h4 className="text-base font-serif font-bold text-white">
                {product.brand} {product.name}
              </h4>
              <p className="text-xs text-slate-300 font-mono">
                Model: {product.modelCode} | Price: ${product.price}
              </p>
            </div>
            <div className="hidden sm:block text-right text-[10px] font-mono text-slate-400">
              <p>468-pt Geometric Fit</p>
              <p className="text-emerald-400">Certified Accurate</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-400 font-mono">
            Captured in 1080p WebGL with PBR reflection shaders
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                soundEffects.playClick();
                onClose();
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-luxury-900 border border-luxury-800 text-slate-300 text-xs font-semibold hover:bg-luxury-800 transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white text-xs font-bold font-mono tracking-wider shadow-lg shadow-violet-500/35 transition-all cursor-pointer border border-white/20"
            >
              <Download className="w-4 h-4" />
              <span>Save Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
