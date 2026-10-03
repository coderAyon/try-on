import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, ArrowRight, ScanFace, Award } from 'lucide-react';
import { FaceShape, SunglassesProduct } from '../../types';
import { SUNGLASSES_CATALOG } from '../../data/catalog';
import { soundEffects } from '../../utils/audio';

interface FitAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedShape: FaceShape;
  confidence: number;
  onSelectProduct: (product: SunglassesProduct) => void;
}

const FACE_SHAPES_DATA: Record<FaceShape, {
  name: string;
  tagline: string;
  recommendedStyles: string[];
  avoidStyles: string[];
  characteristics: string;
}> = {
  Oval: {
    name: 'Oval Face Shape',
    tagline: 'The Most Versatile Silhouette',
    recommendedStyles: ['Aviators', 'Wayfarers', 'Hexagonal Flat', 'Square Retro'],
    avoidStyles: ['Oversized frames that dwarf natural proportions'],
    characteristics: 'Softly rounded contours where facial length is approximately 1.5x width. Balances effortlessly with almost every iconic frame geometry.',
  },
  Square: {
    name: 'Square Face Shape',
    tagline: 'Bold Angular Jawline & Chiseled Features',
    recommendedStyles: ['Round Metal', 'Teardrop Aviator', 'Oval Vintage'],
    avoidStyles: ['Sharp boxy rectangular frames'],
    characteristics: 'Forehead, cheekbones, and jawline share equal striking width with crisp horizontal jaw lines. Curved circular frames soften and compliment angles.',
  },
  Round: {
    name: 'Round Face Shape',
    tagline: 'Harmonious Curves & Full Cheekbones',
    recommendedStyles: ['Angular Wayfarers', 'Rectangular Acetate', 'Hexagonal Metal'],
    avoidStyles: ['Small round wire rims'],
    characteristics: 'Gentle circular perimeter with equal length and width. Angular, structured, and geometric frames add instant architectural definition.',
  },
  Heart: {
    name: 'Heart Face Shape',
    tagline: 'Broad Brow & Sculpted Tapered Chin',
    recommendedStyles: ['Classic Aviator', 'Light Rimless', 'Rounded Cat-Eye'],
    avoidStyles: ['Heavy embellished top browlines'],
    characteristics: 'Widest at the temples with high cheekbones tapering into a delicate chin. Bottom-heavy or teardrop frames bring perfect optical balance.',
  },
  Diamond: {
    name: 'Diamond Face Shape',
    tagline: 'Dramatic High Cheekbones & Sculpted Contours',
    recommendedStyles: ['Première Cat-Eye', 'Oval Wire', 'Soft Wayfarer'],
    avoidStyles: ['Narrow frames that accentuate cheekbone width'],
    characteristics: 'Rare facial geometry with prominent, sculpted cheekbones and narrower forehead and jawline. Rimless or cat-eye curves highlight the eye line.',
  },
};

export const FitAdvisorModal: React.FC<FitAdvisorModalProps> = ({
  isOpen,
  onClose,
  detectedShape,
  confidence,
  onSelectProduct,
}) => {
  const [selectedShape, setSelectedShape] = useState<FaceShape>(detectedShape || 'Oval');

  if (!isOpen) return null;

  const currentInfo = FACE_SHAPES_DATA[selectedShape];
  const matchingProducts = SUNGLASSES_CATALOG.filter((p) =>
    p.suitableFaceShapes.includes(selectedShape)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl glass-panel-gold rounded-2xl overflow-hidden shadow-2xl border border-luxury-gold/30">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-luxury-800 bg-luxury-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-luxury-gold/10 text-luxury-gold border border-luxury-gold/20">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-slate-100 flex items-center gap-2">
                FittingBox AI Facial Morphometrics
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-luxury-gold/15 text-luxury-gold font-normal">
                  Patent Fit Matrix
                </span>
              </h2>
              <p className="text-xs text-slate-400">Computer-vision driven geometry matching</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-luxury-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* AI Detection Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-luxury-800/90 to-luxury-900 border border-luxury-gold/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-luxury-gold/15 flex items-center justify-center text-luxury-gold border border-luxury-gold/40">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs uppercase font-mono text-luxury-gold tracking-wider">
                  AI Real-Time Analysis
                </p>
                <h3 className="text-lg font-serif font-bold text-slate-100">
                  Detected: {detectedShape} Contour
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Geometric Alignment Confidence: <span className="text-emerald-400 font-semibold">{confidence}%</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-luxury-950/80 border border-luxury-700/60 text-xs font-mono text-slate-300">
              <Award className="w-3.5 h-3.5 text-luxury-gold" />
              <span>Optimal Sizing: 50-58mm Lens</span>
            </div>
          </div>

          {/* Face Shape Tabs */}
          <div>
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
              Select or Verify Face Geometry
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(['Oval', 'Square', 'Round', 'Heart', 'Diamond'] as FaceShape[]).map((shape) => {
                const isSelected = selectedShape === shape;
                return (
                  <button
                    key={shape}
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedShape(shape);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-center transition-all ${
                      isSelected
                        ? 'bg-luxury-gold text-luxury-950 font-bold shadow-gold-glow'
                        : 'bg-luxury-900/60 border border-luxury-800 text-slate-300 hover:border-luxury-gold/40'
                    }`}
                  >
                    {shape}
                    {shape === detectedShape && (
                      <span className="block text-[9px] font-mono opacity-80 mt-0.5">Detected</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Morphometric Details */}
          <div className="p-4 rounded-xl bg-luxury-900/50 border border-luxury-800 space-y-3">
            <h4 className="text-sm font-semibold text-luxury-gold font-serif">{currentInfo.tagline}</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{currentInfo.characteristics}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
                  ✓ Recommended Geometries
                </span>
                <ul className="text-xs text-slate-300 space-y-1">
                  {currentInfo.recommendedStyles.map((style, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{style}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/30">
                <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 block mb-1">
                  ✕ Less Flattering Styles
                </span>
                <ul className="text-xs text-slate-300 space-y-1">
                  {currentInfo.avoidStyles.map((style, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{style}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recommended Sunglasses Collection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Matching Sunglass Hut Inventory ({matchingProducts.length} Models)
              </h4>
              <span className="text-[11px] text-luxury-gold">Guaranteed Proportion Match</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchingProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-3 rounded-xl bg-luxury-900/80 border border-luxury-800 hover:border-luxury-gold/50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                      <span>{product.brand}</span>
                      <span className="text-luxury-gold font-semibold">${product.price}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-100 group-hover:text-luxury-gold transition-colors">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {product.frameMaterial}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      soundEffects.playTryOnChime();
                      onSelectProduct(product);
                      onClose();
                    }}
                    className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-luxury-800 hover:bg-luxury-gold hover:text-luxury-950 text-slate-200 text-xs font-semibold transition-all"
                  >
                    <span>Instant Try-On</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-luxury-900/90 border-t border-luxury-800 flex items-center justify-between text-xs text-slate-400">
          <span>CSE Final Year Capstone • FittingBox Engine VTO</span>
          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-luxury-800 hover:bg-luxury-700 text-slate-200 text-xs font-medium"
          >
            Close Advisor
          </button>
        </div>
      </div>
    </div>
  );
};
