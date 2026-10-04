import React from 'react';
import { SunglassesProduct } from '../../types';

// Static catalog previews keep camera + face inference as the only WebGL users.
export const ProductThumbnail: React.FC<{ product: SunglassesProduct; variantIndex?: number }> = ({ product, variantIndex = 0 }) => (
  <img
    src={product.thumbnailUrl || '/models/catalog-thumbnails/' + product.id + (variantIndex ? '-v' + variantIndex : '') + '.png'}
    alt={product.name}
    loading="lazy"
    className="w-full h-[82px] object-contain drop-shadow-[0_8px_16px_rgba(109,40,217,0.14)] opacity-95 transition-all group-hover:scale-110 group-hover:opacity-100 group-hover:drop-shadow-[0_12px_22px_rgba(109,40,217,0.25)] duration-300"
  />
);
