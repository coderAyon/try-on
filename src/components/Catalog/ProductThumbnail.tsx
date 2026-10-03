import React from 'react';
import { SunglassesProduct } from '../../types';

// Static catalog previews keep camera + face inference as the only WebGL users.
export const ProductThumbnail: React.FC<{ product: SunglassesProduct; variantIndex?: number }> = ({ product, variantIndex = 0 }) => (
  <img src={product.thumbnailUrl || '/models/catalog-thumbnails/' + product.id + (variantIndex ? '-v' + variantIndex : '') + '.png'} alt={product.name} loading="lazy" className="w-full h-[82px] object-contain opacity-90 transition-transform group-hover:scale-110 duration-300" />
);
