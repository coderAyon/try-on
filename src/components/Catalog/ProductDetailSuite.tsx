import React, { useState } from 'react';
import {
  SunglassesProduct,
  ColorVariant,
} from '../../types';
import {
} from 'lucide-react';
import { soundEffects } from '../../utils/audio';

interface ProductDetailSuiteProps {
  product: SunglassesProduct;
  variantIndex: number;
  onVariantChange: (newVariantIndex: number) => void;
  estimatedIpdMm?: number;
}

export const ProductDetailSuite: React.FC<ProductDetailSuiteProps> = ({
  product,
  variantIndex,
  onVariantChange,
  estimatedIpdMm = 63.0,
}) => {
  const activeVariant: ColorVariant =
    product.variants[variantIndex] || product.variants[0];

  return (
    <div className="w-full bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between text-white shadow-xl">
      {/* 1. Brand & Header Bar */}
      <div>
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-400">
              {product.brand}
            </span>
            {product.badge && (
              <span className="text-[10px] font-mono uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                {product.badge}
              </span>
            )}
          </div>

        </div>

        {/* Product Title & Model Code */}
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight mt-1 pb-4 border-b border-neutral-800">
          {product.name}
        </h1>
        {/* 2. Colorways / Finish Swatches */}
        <div className="py-3 border-t border-neutral-800">

          <div className="flex flex-wrap items-center gap-3">
            {product.variants.map((variant, idx) => {
              const isSelected = idx === variantIndex;
              return (
                <button
                  key={variant.name}
                  onClick={() => {
                    soundEffects.playClick();
                    onVariantChange(idx);
                  }}
                  className={`group relative p-1 rounded-full border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-white scale-110 shadow-lg'
                      : 'border-transparent hover:border-neutral-600'
                  }`}
                  title={variant.name}
                >
                  <div
                    className="w-7 h-7 rounded-full shadow-inner border border-white/20 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: variant.frameHex }}
                  >
                    {/* Inner Lens Dot */}
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black/40"
                      style={{ backgroundColor: variant.lensHex }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
