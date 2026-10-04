import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react';
import { SunglassesProduct } from '../../types';
import { ProductThumbnail } from './ProductThumbnail';

export function StylesCoverflow({ products, activeId, onSelect, onViewDetails }: { products: SunglassesProduct[]; activeId: string; onSelect: (product: SunglassesProduct) => void; onViewDetails: (product: SunglassesProduct) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  useEffect(() => { const i = products.findIndex(p => p.id === activeId); if (i >= 0) setIndex(i); }, [activeId, products]);
  useEffect(() => {
    const container = track.current, card = container?.children[index] as HTMLElement | undefined;
    if (!container || !card) return;
    programmatic.current = true;
    container.scrollTo({ left: card.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    const timer = setTimeout(() => { programmatic.current = false; }, 700);
    return () => clearTimeout(timer);
  }, [index]);
  useEffect(() => {
    if (paused || interacting || products.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => { if (!document.hidden) setIndex(i => track.current && track.current.scrollLeft >= track.current.scrollWidth - track.current.clientWidth - 2 ? 0 : (i + 1) % products.length); }, 2500);
    return () => clearInterval(timer);
  }, [paused, interacting, products.length]);
  const advance = (step: number) => setIndex(i => (i + step + products.length) % products.length);
  return <div className="styles-slider" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocus={() => setInteracting(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false); }}>
    <div className="slider-toolbar">
      <div><span className="section-eyebrow">THE COLLECTION</span><h3>Find your next favourite<span>{products.length} frames</span></h3></div>
      <div className="slider-actions">
        <button aria-label="Previous styles" onClick={() => advance(-1)}><ArrowLeft size={17} /></button>
        <button aria-label={paused ? 'Play carousel' : 'Pause carousel'} onClick={() => setPaused(p => !p)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
        <button aria-label="Next styles" onClick={() => advance(1)}><ArrowRight size={17} /></button>
      </div>
    </div>
    <div ref={track} className="styles-track" aria-label="Sunglasses styles" onTouchStart={() => setInteracting(true)} onTouchEnd={() => setInteracting(false)} onScroll={() => {
      if (programmatic.current || !track.current) return;
      const container = track.current;
      const left = container.scrollLeft;
      let nearest = 0, distance = Infinity;
      Array.from(container.children).forEach((node, i) => { const card = node as HTMLElement; const d = Math.abs(card.offsetLeft - left); if (d < distance) { distance = d; nearest = i; } });
      setIndex(nearest);
    }}>
      {products.map((product, i) => (
        <div key={product.id} data-product-id={product.id} className="style-card group" data-selected={product.id === activeId}>
          <button className="card-try-on" aria-label={`Try on ${product.name}`} aria-pressed={product.id === activeId} onClick={() => { setIndex(i); onSelect(product); }}>
            <span className="card-brand">{product.brand === 'Model Library' ? 'STUDIO COLLECTION' : product.brand}</span>
            <div className="card-preview"><ProductThumbnail product={product} /></div>
            <div className="card-caption">
              <h4>{product.name}</h4>
              {product.id === activeId && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#6d28d9] mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] animate-pulse" /> Selected
                </span>
              )}
            </div>
          </button>
          <button className="card-details-button group/btn" aria-label={`View details for ${product.name}`} onClick={() => onViewDetails(product)}>
            <span>3D Studio</span>
            <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </div>
      ))}
    </div>
    <div className="slider-bottom"><span>Click a frame to try it on · View details for the 3D studio</span><span>{String(index + 1).padStart(2, '0')} / {products.length}</span></div>
  </div>;
}
