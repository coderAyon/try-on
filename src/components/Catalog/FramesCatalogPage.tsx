import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Camera,
  Box,
  Search,
  Heart,
  Sparkles,
  Check,
  Glasses,
  Filter,
} from 'lucide-react';
import { SunglassesProduct } from '../../types';
import { soundEffects } from '../../utils/audio';

interface FramesCatalogPageProps {
  products: SunglassesProduct[];
  activeProduct: SunglassesProduct;
  onSelectProduct: (product: SunglassesProduct) => void;
  onViewDetails: (product: SunglassesProduct) => void;
  onTryOn: (product: SunglassesProduct) => void;
  onBackToFittingRoom: () => void;
  wishlist: string[];
  onToggleWishlist: (productId: string) => void;
}

export function getProductThumbnail(product: SunglassesProduct): string {
  if (product.thumbnailUrl) return product.thumbnailUrl;
  const map: Record<string, string> = {
    'rayban-aviator-classic': '/models/catalog-thumbnails/rayban-aviator-classic.png',
    'rayban-wayfarer-classic': '/models/catalog-thumbnails/rayban-wayfarer-classic.png',
    'prada-symbole': '/models/catalog-thumbnails/prada-symbole.png',
    'matsuda-m2026': '/models/catalog-thumbnails/matsuda-m2026.png',
    'rayban-meta': '/models/catalog-thumbnails/rayban-meta.png',
    'versace-ve2290': '/models/catalog-thumbnails/versace-ve2290.png',
    'versace-ve4514d': '/models/catalog-thumbnails/versace-ve4514d.png',
  };
  if (map[product.id]) return map[product.id];
  if (product.id.startsWith('imported-')) {
    const key = product.id.replace('imported-', '');
    return `/models/imported/thumbnails/${key}.png`;
  }
  return '/models/catalog-thumbnails/rayban-aviator-classic.png';
}

const CATEGORIES = ['All', 'Aviator', 'Wayfarer', 'Round', 'Square', 'Cat-Eye', 'Sport'];

export const FramesCatalogPage: React.FC<FramesCatalogPageProps> = ({
  products,
  activeProduct,
  onSelectProduct,
  onViewDetails,
  onTryOn,
  onBackToFittingRoom,
  wishlist,
  onToggleWishlist,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Ensure zero duplicate products in catalog
  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      const key = p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [products]);

  // 2. Strict category filtering and search
  const filteredProducts = useMemo(() => {
    return uniqueProducts.filter((product) => {
      // Category filter
      if (selectedCategory !== 'All') {
        const prodCat = (product.category || '').toLowerCase().replace(/[^a-z]/g, '');
        const selCat = selectedCategory.toLowerCase().replace(/[^a-z]/g, '');

        if (prodCat !== selCat) {
          const nameLower = product.name.toLowerCase();
          const matchesName =
            (selCat === 'aviator' && nameLower.includes('aviator')) ||
            (selCat === 'wayfarer' && nameLower.includes('wayfarer')) ||
            (selCat === 'round' && nameLower.includes('round')) ||
            (selCat === 'square' && (nameLower.includes('square') || nameLower.includes('geometric') || nameLower.includes('symbole') || nameLower.includes('browline') || nameLower.includes('retro'))) ||
            (selCat === 'cateye' && (nameLower.includes('cat eye') || nameLower.includes('fano') || nameLower.includes('mustang'))) ||
            (selCat === 'sport' && (nameLower.includes('sport') || nameLower.includes('blade')));

          if (!matchesName) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          product.name.toLowerCase().includes(query) ||
          product.brand.toLowerCase().includes(query) ||
          (product.modelCode && product.modelCode.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [uniqueProducts, selectedCategory, searchQuery]);

  return (
    <div className="w-full max-w-[1440px] mx-auto flex flex-col gap-6 select-none animate-in fade-in duration-200">
      {/* 1. Top Header Banner */}
      <div className="bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md rounded-[24px] border border-[#eceaf5] dark:border-blue-900/40 p-5 sm:p-7 shadow-[0_2px_16px_rgba(109,40,217,0.04)] dark:shadow-[0_4px_24px_rgba(3,7,18,0.7)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundEffects.playClick();
                onBackToFittingRoom();
              }}
              className="flex items-center gap-2 text-[12.5px] font-bold text-[#6355f6] dark:text-cyan-400 hover:text-[#4f3ff2] dark:hover:text-cyan-300 transition-colors cursor-pointer group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Fitting Room</span>
            </button>
            <span className="text-[#dcd7f2] dark:text-blue-900/60">/</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7c749c] dark:text-cyan-300 bg-[#f4f2fc] dark:bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-[#e5e1f7] dark:border-cyan-500/20">
              3D Eyewear Catalog
            </span>
          </div>

          <h1 className="text-[22px] sm:text-[27px] font-bold text-[#181236] dark:text-white tracking-tight">
            All Sunglasses Frames
          </h1>
          <p className="text-[13px] text-[#696187] dark:text-slate-400 max-w-2xl leading-relaxed">
            Browse our full collection of designer and studio eyewear. Click any frame to inspect in 3D studio, or try it on live with AR facial tracking.
          </p>
        </div>

        {/* Right: Counter badge & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b83aa]" />
            <input
              type="text"
              placeholder="Search frames or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-[#f4f2fc]/80 dark:bg-slate-900/80 rounded-xl border border-[#ded8f8] dark:border-slate-800 text-[#181236] dark:text-white placeholder-[#8b83aa] focus:outline-none focus:border-[#6355f6] dark:focus:border-cyan-400 transition-all"
            />
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#faf9fe] dark:bg-slate-900/60 border border-[#eee9f9] dark:border-blue-900/40 text-center flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Glasses size={15} className="text-[#6355f6] dark:text-cyan-400" />
            <span className="text-[12px] font-bold text-[#181236] dark:text-white">
              {filteredProducts.length} Frames
            </span>
          </div>
        </div>
      </div>

      {/* 2. Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-1">
        <Filter size={14} className="text-[#847ca4] dark:text-slate-400 flex-shrink-0 ml-1 mr-1" />
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => {
                soundEffects.playClick();
                setSelectedCategory(cat);
              }}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                isSelected
                  ? 'bg-[#6355f6] text-white border-[#6355f6] shadow-sm shadow-[#6355f6]/25 dark:bg-cyan-500 dark:border-cyan-400 dark:text-slate-950'
                  : 'bg-white/80 dark:bg-slate-900/60 border-[#eceaf5] dark:border-slate-800 text-[#554e74] dark:text-slate-300 hover:border-[#6355f6]/40 dark:hover:border-cyan-400/40 hover:text-[#181236] dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 3. Card Grid View (Compact, Modern & Clean) */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md rounded-2xl border border-[#eceaf5] dark:border-blue-900/40 p-10 text-center flex flex-col items-center justify-center gap-3">
          <Glasses size={32} className="text-[#8b83aa]" />
          <h3 className="text-[15px] font-bold text-[#181236] dark:text-white">
            No frames found matching your search
          </h3>
          <p className="text-[12px] text-[#787196] dark:text-slate-400">
            Try clearing your search query or picking another category.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="mt-1 px-3.5 py-1.5 rounded-xl bg-[#6355f6] text-white text-xs font-bold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
          {filteredProducts.map((product) => {
            const isTryingOn = activeProduct.id === product.id;
            const isFavorited = wishlist.includes(product.id);
            const thumbUrl = getProductThumbnail(product);

            return (
              <div
                key={product.id}
                className={`group bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md rounded-xl border p-2.5 sm:p-3 flex flex-col justify-between gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  isTryingOn
                    ? 'border-[#6355f6] dark:border-cyan-400 ring-2 ring-[#6355f6]/20 dark:ring-cyan-400/20 shadow-sm'
                    : 'border-[#eceaf5] dark:border-blue-900/40'
                }`}
              >
                {/* Top Brand & Wishlist Button */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9.5px] font-bold tracking-wider uppercase text-[#877fa5] dark:text-slate-400 truncate">
                    {product.brand === 'Model Library' ? 'STUDIO' : product.brand}
                  </span>

                  <div className="flex items-center gap-1">
                    {product.badge && (
                      <span className="px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-[#6355f6]/10 text-[#6355f6] dark:bg-cyan-500/10 dark:text-cyan-300 border border-[#6355f6]/15">
                        {product.badge}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundEffects.playClick();
                        onToggleWishlist(product.id);
                      }}
                      title={isFavorited ? 'Remove from wishlist' : 'Save to wishlist'}
                      className={`p-1 rounded-full border transition-all cursor-pointer ${
                        isFavorited
                          ? 'bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/40 dark:border-rose-900'
                          : 'border-transparent text-[#9790b3] hover:text-rose-500 hover:bg-[#f6f4fd] dark:hover:bg-slate-800'
                      }`}
                    >
                      <Heart size={12} fill={isFavorited ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>

                {/* Frame Thumbnail Image (Clickable -> Opens 3D Details) */}
                <div
                  onClick={() => {
                    soundEffects.playClick();
                    onViewDetails(product);
                  }}
                  className="relative w-full h-24 sm:h-28 rounded-lg bg-gradient-to-b from-[#faf9fe] to-[#f4f1fb] dark:from-slate-900/70 dark:to-[#0f172a] border border-[#f0edf9] dark:border-blue-900/30 flex items-center justify-center p-2 overflow-hidden cursor-pointer group-hover:border-[#6355f6]/30 dark:group-hover:border-cyan-400/30 transition-all"
                >
                  <img
                    src={thumbUrl}
                    alt={product.name}
                    className="max-h-16 sm:max-h-18 max-w-[92%] object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {isTryingOn && (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[8.5px] font-bold shadow-xs">
                      <Check size={9} strokeWidth={3} />
                      <span>Active</span>
                    </div>
                  )}
                </div>

                {/* Title & Info */}
                <div className="flex flex-col gap-0.5">
                  <h3
                    onClick={() => {
                      soundEffects.playClick();
                      onViewDetails(product);
                    }}
                    title={product.name}
                    className="text-[12.5px] sm:text-[13px] font-bold text-[#181236] dark:text-white truncate cursor-pointer hover:text-[#6355f6] dark:hover:text-cyan-400 transition-colors leading-tight"
                  >
                    {product.name}
                  </h3>

                  <div className="flex items-center justify-between text-[10.5px] text-[#716892] dark:text-slate-400">
                    <span className="truncate">{product.category || 'Eyewear'}</span>
                    {product.price > 0 ? (
                      <span className="font-bold text-[#181236] dark:text-slate-200">
                        ${product.price}
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-medium text-[#8b83aa]">
                        Studio
                      </span>
                    )}
                  </div>

                  {/* Color Swatch Dots */}
                  <div className="flex items-center gap-1 mt-1">
                    {product.variants.slice(0, 4).map((v, i) => (
                      <span
                        key={i}
                        title={v.name}
                        style={{ backgroundColor: v.frameHex }}
                        className="w-2.5 h-2.5 rounded-full border border-black/15 dark:border-white/20 shadow-xs flex-shrink-0"
                      />
                    ))}
                    {product.variants.length > 4 && (
                      <span className="text-[9px] text-[#8b83aa] font-medium">
                        +{product.variants.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2 Action Buttons: "3D Details" & "Try On" */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#f0edf9] dark:border-blue-900/30">
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onViewDetails(product);
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg border border-[#ded8f8] dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-[#f5f2fd] dark:hover:bg-slate-700 text-[#4c4273] dark:text-slate-200 text-[10.5px] font-semibold transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Box size={11} className="text-[#6355f6] dark:text-cyan-400" />
                    <span>3D</span>
                  </button>

                  <button
                    onClick={() => {
                      soundEffects.playTryOnChime();
                      onTryOn(product);
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg bg-gradient-to-r from-[#6355f6] to-[#7c3aed] text-white text-[10.5px] font-bold shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Camera size={11} />
                    <span>Try On</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
