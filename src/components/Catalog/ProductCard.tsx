import React from 'react';
import { Check, Shield, Sun } from 'lucide-react';
import { SunglassesProduct } from '../../types';
import { GlassesSvg } from './GlassesSvg';
import { soundEffects } from '../../utils/audio';

interface ProductCardProps {
  product: SunglassesProduct;
  isActive: boolean;
  onSelect: (product: SunglassesProduct) => void;
  onVariantChange: (variantIndex: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isActive,
  onSelect,
  onVariantChange,
}) => {
  const currentVariant = product.variants[product.activeVariantIndex || 0];

  return (
    <div
      onClick={() => {
        soundEffects.playTryOnChime();
        onSelect(product);
      }}
      className={`group relative flex-shrink-0 w-64 sm:w-72 rounded-2xl p-4 transition-all duration-300 cursor-pointer select-none ${
        isActive
          ? 'glass-panel-gold ring-2 ring-luxury-gold shadow-gold-glow-lg -translate-y-1'
          : 'glass-panel hover:border-luxury-gold/50 hover:shadow-luxury-card hover:-translate-y-0.5'
      }`}
    >
      {/* Top Badge Row */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-medium">
          {product.brand}
        </span>
        {product.badge && (
          <span className="px-2 py-0.5 text-[9px] font-mono uppercase font-bold tracking-wider rounded-full bg-luxury-gold/15 text-luxury-gold border border-luxury-gold/30">
            {product.badge}
          </span>
        )}
      </div>

      {/* Title & Model Code */}
      <div className="mb-2">
        <h4 className="text-sm font-serif font-bold text-slate-100 group-hover:text-luxury-gold transition-colors truncate">
          {product.name}
        </h4>
        <p className="text-[10px] text-slate-400 font-mono">{product.modelCode}</p>
      </div>

      {/* SVG Silhouette Showcase */}
      <div className="relative py-2 px-3 my-1 rounded-xl bg-luxury-900/60 border border-luxury-800 flex items-center justify-center overflow-hidden">
        <GlassesSvg
          type={product.svgPreview}
          frameColor={currentVariant.frameHex}
          lensColor={currentVariant.lensHex}
          className="w-full h-16 drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
        />

        {isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-luxury-gold text-luxury-950 text-[10px] font-bold shadow-md">
            <Check className="w-3 h-3 stroke-[3]" />
            <span>TRYING ON</span>
          </div>
        )}
      </div>

      {/* Color Swatches */}
      <div className="flex items-center justify-between mt-3 mb-2">
        <div className="flex items-center gap-1.5">
          {product.variants.map((v, idx) => (
            <button
              key={v.name}
              title={v.name}
              onClick={(e) => {
                e.stopPropagation();
                soundEffects.playClick();
                onVariantChange(idx);
              }}
              style={{ backgroundColor: v.frameHex }}
              className={`w-4 h-4 rounded-full border transition-all ${
                product.activeVariantIndex === idx
                  ? 'ring-2 ring-luxury-gold scale-125 border-white'
                  : 'border-luxury-700 hover:scale-110 opacity-70'
              }`}
            />
          ))}
        </div>

        {/* Feature Badges */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
          {product.polarized && (
            <span className="flex items-center gap-0.5 text-luxury-gold/90" title="Polarized Lenses">
              <Sun className="w-3 h-3" /> POLARIZED
            </span>
          )}
          <span className="flex items-center gap-0.5 text-slate-400" title="UV400 Certified">
            <Shield className="w-3 h-3" /> UV400
          </span>
        </div>
      </div>

      {/* Variant Name & Price Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-luxury-800/80">
        <span className="text-[11px] text-slate-300 truncate max-w-[130px]">
          {currentVariant.name.split('/')[0]}
        </span>
        <div className="text-right">
          <span className="text-sm font-serif font-bold text-luxury-gold">${product.price}</span>
        </div>
      </div>
    </div>
  );
};
