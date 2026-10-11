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
}

interface ColumnPair {
  id: string;
  top: FrameItem;
  bottom: FrameItem;
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
  const [colOffset, setColOffset] = useState<number>(0);
  const [enableTransition, setEnableTransition] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // 12 Curated Frames organized into top and bottom rows
  const allFrames: FrameItem[] = [
    // Top Row (Column 0, 1, 2, 3, 4, 5 - Top)
    {
      id: 'aviator',
      name: 'Aviator',
      category: 'Aviator',
      gender: 'Unisex',
      thumbnailUrl: '/models/catalog-thumbnails/rayban-aviator-classic.png',
      targetProductId: 'rayban-aviator-classic',
    },
    {
      id: 'wayfarer',
      name: 'Wayfarer',
      category: 'Wayfarer',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/rayban-wayfarer-classic.png',
      targetProductId: 'rayban-wayfarer-classic',
    },
    {
      id: 'round',
      name: 'Round',
      category: 'Round',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/green-round.png',
      targetProductId: 'imported-green-round',
    },
    {
      id: 'ext-matsuda',
      name: 'Matsuda Metal',
      category: 'Round',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/matsuda-m2026.png',
      targetProductId: 'matsuda-m2026',
    },
    {
      id: 'ext-prada',
      name: 'Prada Geometric',
      category: 'Square',
      gender: 'Women',
      thumbnailUrl: '/models/catalog-thumbnails/prada-symbole.png',
      targetProductId: 'prada-symbole',
    },
    {
      id: 'ext-ve2290',
      name: 'Versace Greek',
      category: 'Aviator',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/versace-ve2290.png',
      targetProductId: 'versace-ve2290',
    },

    // Bottom Row (Column 0, 1, 2, 3, 4, 5 - Bottom)
    {
      id: 'square',
      name: 'Square',
      category: 'Square',
      gender: 'Men',
      thumbnailUrl: '/models/catalog-thumbnails/versace-ve4514d.png',
      targetProductId: 'versace-ve4514d',
    },
    {
      id: 'cat-eye',
      name: 'Cat Eye',
      category: 'Cat Eye',
      gender: 'Women',
      thumbnailUrl: '/models/imported/thumbnails/fano.png',
      targetProductId: 'imported-fano',
    },
    {
      id: 'rectangle',
      name: 'Rectangle',
      category: 'Rectangle',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/obj-classic.png',
      targetProductId: 'imported-obj-classic',
    },
    {
      id: 'ext-browline',
      name: 'Classic Browline',
      category: 'Rectangle',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/stylized-brow.png',
      targetProductId: 'imported-stylized-brow',
    },
    {
      id: 'ext-pixel',
      name: '8-Bit Retro',
      category: 'Square',
      gender: 'Unisex',
      thumbnailUrl: '/models/imported/thumbnails/pixel.png',
      targetProductId: 'imported-pixel',
    },
    {
      id: 'ext-mustang',
      name: 'Mustang MU',
      category: 'Cat Eye',
      gender: 'Women',
      thumbnailUrl: '/models/imported/thumbnails/mustang.png',
      targetProductId: 'imported-mustang',
    },
  ];

  const categories: Array<'All' | 'Men' | 'Women' | 'Unisex'> = ['All', 'Men', 'Women', 'Unisex'];

  // Filter frames by gender
  const filtered = activeCategory === 'All'
    ? allFrames
    : allFrames.filter((f) => f.gender === activeCategory || f.gender === 'Unisex');

  // Pair into 2 rows (Top & Bottom) forming horizontal columns
  const half = Math.ceil(filtered.length / 2);
  const rowTop = filtered.slice(0, half);
  const rowBottom = filtered.slice(half);

  const columns: ColumnPair[] = rowTop.map((topItem, i) => ({
    id: `col-${topItem.id}-${rowBottom[i % rowBottom.length]?.id || 'b'}`,
    top: topItem,
    bottom: rowBottom[i % rowBottom.length] || rowTop[(i + 1) % rowTop.length],
  }));

  const totalCols = columns.length;

  // Seamless infinite loop: duplicate columns across 3 cycles
  const displayColumns = [...columns, ...columns, ...columns];

  // Reset offset when category changes
  useEffect(() => {
    setEnableTransition(false);
    setColOffset(0);
  }, [activeCategory]);

  // =========================================================================
  // Auto-Scroll: Slides columns from Right to Left one by one
  // =========================================================================
  useEffect(() => {
    if (isHovered || totalCols <= 3) return;

    const timer = setInterval(() => {
      setEnableTransition(true);
      setColOffset((prev) => prev + 1);
    }, 2800);

    return () => clearInterval(timer);
  }, [isHovered, totalCols]);

  const handleNext = () => {
    soundEffects.playClick();
    setEnableTransition(true);
    setColOffset((prev) => prev + 1);
  };

  const handlePrev = () => {
    soundEffects.playClick();
    setEnableTransition(true);
    setColOffset((prev) => Math.max(0, prev - 1));
  };

  const handleTransitionEnd = () => {
    if (colOffset >= totalCols) {
      setEnableTransition(false);
      setColOffset((prev) => prev % totalCols);
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
            ? 'bg-white border-2 border-[#6355f6] shadow-[0_4px_18px_rgba(99,85,246,0.18)] -translate-y-0.5'
            : 'bg-[#fbfbfe] border border-[#eeecf8] hover:bg-white hover:border-[#d9d5f5] hover:shadow-sm'
        }`}
      >
        {/* Sunglasses Preview Thumbnail */}
        <div className="flex-1 flex items-center justify-center overflow-hidden py-0.5">
          <img
            src={frame.thumbnailUrl}
            alt={frame.name}
            className="max-h-[58px] max-w-full object-contain filter drop-shadow-[0_2px_4px_rgba(20,10,40,0.10)] transition-transform duration-200 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                '/models/catalog-thumbnails/rayban-aviator-classic.png';
            }}
          />
        </div>

        {/* Card Bottom Row: Title + Wishlist Heart */}
        <div className="flex items-center justify-between pt-1">
          <span
            className={`text-[11px] font-semibold tracking-tight truncate ${
              isSelected ? 'text-[#6355f6] font-bold' : 'text-[#30284d]'
            }`}
          >
            {frame.name}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(frame.targetProductId);
            }}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="p-1 text-[#8b84a6] hover:text-[#6355f6] transition-colors cursor-pointer"
          >
            <Heart
              size={13}
              strokeWidth={2}
              className={isWishlisted ? 'fill-[#6355f6] text-[#6355f6]' : ''}
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
      className="relative bg-white rounded-[26px] p-5 sm:p-6 border border-[#eceaf5] shadow-[0_4px_24px_rgba(109,40,217,0.04)] flex flex-col justify-between select-none overflow-hidden h-full"
    >
      {/* 1. Header with Title & View All */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-[21px] font-bold text-[#161132] tracking-tight">
            Select Your Frame
          </h3>
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-[13px] font-semibold text-[#6355f6] hover:text-[#4f3ff2] transition-colors cursor-pointer group"
          >
            <span>View All</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
        <p className="text-[12px] text-[#766f91] mb-3.5">
          Find your perfect style
        </p>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-2 mb-4">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  soundEffects.playClick();
                  setActiveCategory(cat);
                }}
                className={`px-5 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#6355f6] text-white shadow-sm shadow-[#6355f6]/30'
                    : 'bg-[#f1f2f8] text-[#362f52] hover:bg-[#e8e9f2]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 2-Row Horizontal Sliding Stream Container (Cards slide one by one from right to left) */}
      <div className="relative overflow-visible my-auto">
        {/* Hidden viewport masking the sliding track */}
        <div className="overflow-hidden rounded-[20px] p-0.5">
          <div
            className="flex gap-3 will-change-transform"
            style={{
              transform: `translateX(calc(-${colOffset} * ((100% - 24px) / 3 + 12px)))`,
              transition: enableTransition
                ? 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
                : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {displayColumns.map((col, idx) => (
              <div
                key={`${col.id}-${idx}`}
                className="flex flex-col gap-3 flex-shrink-0"
                style={{ width: 'calc((100% - 24px) / 3)' }}
              >
                {renderCard(col.top)}
                {renderCard(col.bottom)}
              </div>
            ))}
          </div>
        </div>

        {/* Left Arrow Button */}
        {colOffset > 0 && (
          <button
            onClick={handlePrev}
            title="Previous frames"
            className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-[#e5e1f7] shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#463f6a] hover:text-[#6355f6] hover:border-[#6355f6] hover:scale-105 transition-all cursor-pointer z-20"
          >
            <ChevronLeft size={17} strokeWidth={2.4} />
          </button>
        )}

        {/* Right Arrow Button on Right Edge */}
        <button
          onClick={handleNext}
          title="Next frames"
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-[#e5e1f7] shadow-[0_4px_12px_rgba(0,0,0,0.08)] flex items-center justify-center text-[#463f6a] hover:text-[#6355f6] hover:border-[#6355f6] hover:scale-105 transition-all cursor-pointer z-20"
        >
          <ChevronRight size={17} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};
