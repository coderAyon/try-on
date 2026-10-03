import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, SlidersHorizontal, Sparkles } from 'lucide-react';
import { SunglassesProduct, EyewearCategory } from '../../types';
import { ProductCard } from './ProductCard';
import { soundEffects } from '../../utils/audio';

interface CatalogDrawerProps {
  products: SunglassesProduct[];
  activeProduct: SunglassesProduct;
  onSelectProduct: (product: SunglassesProduct) => void;
  onVariantChange: (productId: string, variantIndex: number) => void;
}

const CATEGORIES: EyewearCategory[] = ['All', 'Aviator', 'Wayfarer', 'Sport', 'Hexagonal', 'Round', 'Cat-Eye'];

export const CatalogDrawer: React.FC<CatalogDrawerProps> = ({
  products,
  activeProduct,
  onSelectProduct,
  onVariantChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<EyewearCategory>('All');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const scroll = (direction: 'left' | 'right') => {
    soundEffects.playClick();
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <aside aria-label="Sunglasses catalog drawer" className="w-full transition-all duration-300 z-30">
      {/* Floating Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-8 mb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-luxury-gold font-semibold">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Curated Eyewear Catalog
          </span>
          <span className="text-xs text-slate-400 font-mono">
            ({filteredProducts.length} models)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Collapse/Expand Toggle */}
          <button
            onClick={() => {
              soundEffects.playClick();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-luxury-900/90 border border-luxury-800 text-xs text-slate-300 hover:text-luxury-gold hover:border-luxury-gold/40 transition-colors"
          >
            <span>{isExpanded ? 'Minimize Drawer' : 'Show Catalog'}</span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="glass-panel border-t border-luxury-800/80 px-4 sm:px-8 py-4 space-y-4">
          {/* Category Filter Pills & Carousel Arrows */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      soundEffects.playClick();
                      setSelectedCategory(cat);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                      isSelected
                        ? 'bg-luxury-gold text-luxury-950 font-bold shadow-gold-glow'
                        : 'bg-luxury-900/60 border border-luxury-800 text-slate-400 hover:text-slate-200 hover:border-luxury-700'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Quick Carousel Scroll Buttons */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={() => scroll('left')}
                aria-label="Scroll catalog left"
                className="p-1.5 rounded-lg bg-luxury-900 border border-luxury-800 hover:border-luxury-gold text-slate-300 hover:text-luxury-gold transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scroll('right')}
                aria-label="Scroll catalog right"
                className="p-1.5 rounded-lg bg-luxury-900 border border-luxury-800 hover:border-luxury-gold text-slate-300 hover:text-luxury-gold transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Horizontal Product Track */}
          <div
            ref={scrollContainerRef}
            className="flex items-stretch gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth"
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isActive={product.id === activeProduct.id}
                onSelect={onSelectProduct}
                onVariantChange={(vIdx) => onVariantChange(product.id, vIdx)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
