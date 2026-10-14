import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { SunglassesProduct } from '../../types';
import { soundEffects } from '../../utils/audio';

interface FrameSelectorPanelProps {
  products: SunglassesProduct[];
  activeProduct: SunglassesProduct;
  onSelectProduct: (product: SunglassesProduct) => void;
  onViewAll: () => void;
  wishlist: string[];
  onToggleWishlist: (productId: string) => void;
}

interface FrameItem {
  id: string;
  name: string;
  category: 'Aviator' | 'Wayfarer' | 'Round' | 'Square' | 'Cat Eye' | 'Rectangle';
  gender: 'All' | 'Men' | 'Women' | 'Unisex';
  thumbnailUrl: string;
  targetProductId: string;
  badge?: string;
  swatches?: string[];
}

export const FrameSelectorPanel: React.FC<FrameSelectorPanelProps> = ({
  products,
  activeProduct,
  onSelectProduct,
  onViewAll,
  wishlist,
  onToggleWishlist,
}) => {
  const [activeCategory, setActiveCategory] = useState<'All' | 'Men' | 'Women' | 'Unisex'>('All');
  const [topOffset, setTopOffset] = useState<number>(0);
  const [bottomOffset, setBottomOffset] = useState<number>(0);
  const [enableTopTransition, setEnableTopTransition] = useState<boolean>(true);
  const [enableBottomTransition, setEnableBottomTransition] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // 12 Curated Frames with Badges and Color Swatches
  const allFrames: FrameItem[] = [
    // Top Row
    {
      id: 'aviator',
      name: 'Aviator',
      category: 'Aviator',
      gender: 'Unisex',
      thumbnailUrl: '/models/catalog-thumbnails/rayban-aviator-classic.png',
      targetProductId: 'rayban-aviator-classic',
      badge: 'AI Pick',
      swatches: ['#d4af37', '#18181b', '#854d0e'],
    },
    {
      id: 'wayfarer',
      name: 'Wayfarer',
      category: 'Wayfarer',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/rayban-wayfarer-classic.png',
      targetProductId: 'rayban-wayfarer-classic',
      badge: 'Bestseller',
      swatches: ['#18181b', '#78350f', '#0284c7'],
    },
    {
      id: 'round',
      name: 'Round',
      category: 'Round',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/green-round.png',
      targetProductId: 'imported-green-round',
      badge: 'Trending',
      swatches: ['#15803d', '#d4af37', '#18181b'],
    },
    {
      id: 'ext-matsuda',
      name: 'Matsuda Metal',
      category: 'Round',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/matsuda-m2026.png',
      targetProductId: 'matsuda-m2026',
      badge: 'New',
      swatches: ['#e2e8f0', '#d4af37', '#475569'],
    },
    {
      id: 'ext-prada',
      name: 'Prada Geometric',
      category: 'Square',
      gender: 'Women',
      thumbnailUrl: '/models/catalog-thumbnails/prada-symbole.png',
      targetProductId: 'prada-symbole',
      badge: 'Luxury',
      swatches: ['#0f172a', '#e2e8f0', '#7c3aed'],
    },
    {
      id: 'ext-ve2290',
      name: 'Versace Greek',
      category: 'Aviator',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/versace-ve2290.png',
      targetProductId: 'versace-ve2290',
      badge: 'Hot',
      swatches: ['#d4af37', '#0f172a'],
    },

    // Bottom Row
    {
      id: 'square',
      name: 'Square',
      category: 'Square',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/versace-ve4514d.png',
      targetProductId: 'versace-ve4514d',
      badge: 'Classic',
      swatches: ['#18181b', '#3b82f6'],
    },
    {
      id: 'cat-eye',
      name: 'Cat Eye',
      category: 'Cat Eye',
      gender: 'Women',
      thumbnailUrl: '/models/imported/thumbnails/fano.png',
      targetProductId: 'imported-fano',
      badge: 'Trending',
      swatches: ['#ec4899', '#78350f', '#18181b'],
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      category: 'Rectangle',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/obj-classic.png',
      targetProductId: 'imported-obj-classic',
      badge: 'Popular',
      swatches: ['#18181b', '#64748b'],
    },
    {
      id: 'ext-browline',
      name: 'Classic Browline',
      category: 'Rectangle',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/stylized-brow.png',
      targetProductId: 'imported-stylized-brow',
      badge: 'Vintage',
      swatches: ['#78350f', '#d4af37', '#18181b'],
    },
    {
      id: 'ext-pixel',
      name: '8-Bit Retro',
      category: 'Square',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/pixel.png',
      targetProductId: 'imported-pixel',
      badge: 'Unique',
      swatches: ['#18181b', '#38bdf8'],
    },
    {
      id: 'ext-mustang',
      name: 'Mustang MU',
      category: 'Cat Eye',
      gender: 'Women',
      thumbnailUrl: '/models/imported/thumbnails/mustang.png',
      targetProductId: 'imported-mustang',
      badge: 'Chic',
      swatches: ['#991b1b', '#18181b'],
    },
  ];

  const categories: Array<'All' | 'Men' | 'Women' | 'Unisex'> = ['All', 'Men', 'Women', 'Unisex'];

  // Filter frames by gender
  const filtered = activeCategory === 'All'
    ? allFrames
    : allFrames.filter((f) => f.gender === activeCategory || f.gender === 'Unisex');

  // Split into Top and Bottom rows
  const half = Math.ceil(filtered.length / 2);
  const rowTopBase = filtered.slice(0, half);
  const rowBottomBase = filtered.slice(half);

  const ensureMinItems = (items: FrameItem[]) => {
    if (items.length === 0) return allFrames.slice(0, 3);
    let result = [...items];
    while (result.length < 3) {
      result = [...result, ...items];
    }
    return result;
  };

  const rowTop = ensureMinItems(rowTopBase);
  const rowBottom = ensureMinItems(rowBottomBase.length > 0 ? rowBottomBase : rowTopBase);

  const totalTop = rowTop.length;
  const totalBottom = rowBottom.length;

  // Triplicate for seamless loop
  const displayTop = [...rowTop, ...rowTop, ...rowTop];
  const displayBottom = [...rowBottom, ...rowBottom, ...rowBottom];

  // Reset offset when category changes
  useEffect(() => {
    setEnableTopTransition(false);
    setEnableBottomTransition(false);
    setTopOffset(0);
    setBottomOffset(0);
  }, [activeCategory]);

  // =========================================================================
  // Step-by-Step Auto-Scroll:
  // - Upper row slides 1 card to the RIGHT
  // - Lower row slides 1 card to the LEFT
  // =========================================================================
  useEffect(() => {
    if (isHovered) return;

    const timer = setInterval(() => {
      setEnableTopTransition(true);
      setEnableBottomTransition(true);
      setTopOffset((prev) => prev + 1);
      setBottomOffset((prev) => prev + 1);
    }, 2800);

    return () => clearInterval(timer);
  }, [isHovered]);

  const handleNext = () => {
    soundEffects.playClick();
    setEnableTopTransition(true);
    setEnableBottomTransition(true);
    setTopOffset((prev) => prev + 1);
    setBottomOffset((prev) => prev + 1);
  };

  const handlePrev = () => {
    soundEffects.playClick();
    setEnableTopTransition(true);
    setEnableBottomTransition(true);
    setTopOffset((prev) => Math.max(0, prev - 1));
    setBottomOffset((prev) => Math.max(0, prev - 1));
  };

  const handleTopTransitionEnd = () => {
    if (topOffset >= totalTop) {
      setEnableTopTransition(false);
      setTopOffset((prev) => prev % totalTop);
    }
  };

  const handleBottomTransitionEnd = () => {
    if (bottomOffset >= totalBottom) {
      setEnableBottomTransition(false);
      setBottomOffset((prev) => prev % totalBottom);
    }
  };

  const handleSelectFrame = (frame: FrameItem) => {
    const matched =
      products.find((p) => p.id === frame.targetProductId) ||
      products.find((p) => p.name.toLowerCase().includes(frame.name.toLowerCase())) ||
      products[0];
    soundEffects.playTryOnChime();
    onSelectProduct(matched);
  };

  const renderCard = (frame: FrameItem) => {
    const isSelected =
      activeProduct.id === frame.targetProductId ||
      activeProduct.name.toLowerCase().includes(frame.name.toLowerCase()) ||
      (frame.id === 'aviator' && activeProduct.id.includes('aviator')) ||
      (frame.id === 'wayfarer' && activeProduct.id.includes('wayfarer'));

    const isWishlisted =
      wishlist.includes(frame.id) || wishlist.includes(frame.targetProductId);

    return (
      <div
        key={frame.id}
        onClick={() => handleSelectFrame(frame)}
        className={`group relative flex flex-col justify-between h-[112px] sm:h-[120px] p-2.5 rounded-[18px] cursor-pointer transition-all duration-200 select-none ${
          isSelected
            ? 'bg-white dark:bg-[#131d35] border-2 border-[#6355f6] dark:border-cyan-400 shadow-[0_4px_18px_rgba(99,85,246,0.18)] dark:shadow-[0_0_20px_rgba(6,182,212,0.3)] -translate-y-0.5 z-10'
            : 'bg-[#fbfbfe] dark:bg-[#0e1628] border border-[#eeecf8] dark:border-blue-950/70 hover:bg-white dark:hover:bg-[#131d35] hover:border-[#d9d5f5] dark:hover:border-cyan-500/40 hover:shadow-sm'
        }`}
      >
        {/* Top Corner Pill Badge */}
        {frame.badge && (
          <span
            className={`absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider uppercase shadow-2xs ${
              frame.badge === 'AI Pick'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                : frame.badge === 'Trending' || frame.badge === 'Hot'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                : frame.badge === 'New'
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white'
                : frame.badge === 'Bestseller'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                : 'bg-slate-800 text-slate-100'
            }`}
          >
            {frame.badge}
          </span>
        )}

        {/* Sunglasses Preview Thumbnail */}
        <div className="flex-1 flex items-center justify-center overflow-hidden py-0.5">
          <img
            src={frame.thumbnailUrl}
            alt={frame.name}
            className="max-h-[56px] max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(20,10,40,0.10)] transition-transform duration-200 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                '/models/catalog-thumbnails/rayban-aviator-classic.png';
            }}
          />
        </div>

        {/* Card Bottom Row: Title + Swatches + Wishlist Heart */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col min-w-0 pr-1 flex-1">
            <span
              className={`text-[11px] font-semibold tracking-tight truncate ${
                isSelected
                  ? 'text-[#6355f6] dark:text-cyan-400 font-bold'
                  : 'text-[#30284d] dark:text-slate-200'
              }`}
            >
              {frame.name}
            </span>
            {frame.swatches && (
              <div className="flex items-center gap-1 mt-0.5">
                {frame.swatches.map((hex, sIdx) => (
                  <span
                    key={sIdx}
                    style={{ backgroundColor: hex }}
                    className="w-1.5 h-1.5 rounded-full border border-black/15 dark:border-white/20 shadow-2xs"
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(frame.targetProductId);
            }}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="p-1 text-[#8b84a6] dark:text-slate-400 hover:text-[#6355f6] dark:hover:text-cyan-400 transition-colors cursor-pointer flex-shrink-0"
          >
            <Heart
              size={12}
              strokeWidth={2}
              className={
                isWishlisted
                  ? 'fill-[#6355f6] dark:fill-cyan-400 text-[#6355f6] dark:text-cyan-400'
                  : ''
              }
            />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative bg-white dark:bg-[#0c1322]/95 rounded-[26px] p-4 sm:p-6 border border-[#eceaf5] dark:border-blue-900/40 shadow-[0_4px_24px_rgba(109,40,217,0.04)] dark:shadow-[0_12px_40px_rgba(3,7,18,0.7)] flex flex-col justify-between select-none overflow-hidden h-full transition-colors duration-300"
    >
      {/* 1. Header with Title & View All */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-[18px] sm:text-[20px] font-bold text-[#161132] dark:text-white tracking-tight whitespace-nowrap">
            Select Your Frame
          </h3>

          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold text-[#6355f6] dark:text-cyan-400 hover:text-[#4f3ff2] dark:hover:text-cyan-300 transition-colors cursor-pointer group whitespace-nowrap"
          >
            <span>View All</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
        <p className="text-[11.5px] sm:text-[12px] text-[#766f91] dark:text-slate-400 mb-3">
          Find your perfect style
        </p>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-2 mb-3.5 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  soundEffects.playClick();
                  setActiveCategory(cat);
                }}
                className={`px-3.5 sm:px-5 py-1.5 rounded-full text-[11.5px] sm:text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#6355f6] dark:bg-gradient-to-r dark:from-blue-600 dark:to-cyan-600 text-white shadow-sm shadow-[#6355f6]/30 dark:shadow-cyan-500/25'
                    : 'bg-[#f1f2f8] dark:bg-[#131d33] text-[#362f52] dark:text-slate-300 hover:bg-[#e8e9f2] dark:hover:bg-[#1b2847] dark:hover:text-cyan-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 2-Row Opposing Step-by-Step Sliding Container (Upper row steps Right, Lower row steps Left) */}
      <div className="relative overflow-visible my-auto">
        <div className="flex flex-col gap-3">
          {/* Upper Track: Steps 1-by-1 to the RIGHT */}
          <div className="overflow-hidden py-2 px-1.5 -my-2 -mx-1.5">
            <div
              className="flex gap-3 will-change-transform"
              style={{
                transform: `translateX(calc((-1 * ${totalTop} + ${topOffset}) * ((100% - 24px) / 3 + 12px)))`,
                transition: enableTopTransition
                  ? 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
                  : 'none',
              }}
              onTransitionEnd={handleTopTransitionEnd}
            >
              {displayTop.map((frame, idx) => (
                <div
                  key={`top-${frame.id}-${idx}`}
                  className="flex-shrink-0"
                  style={{ width: 'calc((100% - 24px) / 3)' }}
                >
                  {renderCard(frame)}
                </div>
              ))}
            </div>
          </div>

          {/* Lower Track: Steps 1-by-1 to the LEFT */}
          <div className="overflow-hidden py-2 px-1.5 -my-2 -mx-1.5">
            <div
              className="flex gap-3 will-change-transform"
              style={{
                transform: `translateX(calc(-${bottomOffset} * ((100% - 24px) / 3 + 12px)))`,
                transition: enableBottomTransition
                  ? 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
                  : 'none',
              }}
              onTransitionEnd={handleBottomTransitionEnd}
            >
              {displayBottom.map((frame, idx) => (
                <div
                  key={`bottom-${frame.id}-${idx}`}
                  className="flex-shrink-0"
                  style={{ width: 'calc((100% - 24px) / 3)' }}
                >
                  {renderCard(frame)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Left Arrow Button */}
        <button
          onClick={handlePrev}
          title="Previous frames"
          className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-[#131d35] border border-[#e5e1f7] dark:border-blue-900/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center text-[#463f6a] dark:text-slate-300 hover:text-[#6355f6] dark:hover:text-cyan-300 hover:border-[#6355f6] dark:hover:border-cyan-400 hover:scale-105 transition-all cursor-pointer z-20"
        >
          <ChevronLeft size={17} strokeWidth={2.4} />
        </button>

        {/* Right Arrow Button on Right Edge */}
        <button
          onClick={handleNext}
          title="Next frames"
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-[#131d35] border border-[#e5e1f7] dark:border-blue-900/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center justify-center text-[#463f6a] dark:text-slate-300 hover:text-[#6355f6] dark:hover:text-cyan-300 hover:border-[#6355f6] dark:hover:border-cyan-400 hover:scale-105 transition-all cursor-pointer z-20"
        >
          <ChevronRight size={17} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};

