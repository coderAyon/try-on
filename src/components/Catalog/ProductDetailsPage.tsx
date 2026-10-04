import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Box, Camera, Check } from 'lucide-react';
import { SunglassesProduct } from '../../types';
import { productDetails } from '../../data/productDetails';
import { WebGLCanvas } from '../Viewport/WebGLCanvas';

export function ProductDetailsPage({ product, variantIndex, onVariantChange, onBack, onTryOn }: { product: SunglassesProduct; variantIndex: number; onVariantChange: (i: number) => void; onBack: () => void; onTryOn: () => void }) {
  const details = productDetails(product);
  const heading = useRef<HTMLHeadingElement>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { heading.current?.focus(); }, [product.id]);
  return <article className="product-page" key={product.id}>
    <button className="product-back" onClick={onBack}><ArrowLeft size={17} /> Back to fitting room</button>
    <div className="product-page-heading"><span className="section-eyebrow">{product.brand === 'Model Library' ? 'STUDIO COLLECTION' : product.brand}</span><h1 ref={heading} tabIndex={-1}>{product.name}</h1><p>A closer look at your next favourite.</p></div>
    <div className="product-page-grid">
      <section className="product-studio" aria-label={`${product.name} interactive 3D studio`}>
        <div className="product-studio-title"><Box size={16} /><span>3D STUDIO</span><span>Drag to rotate · inspect every angle</span></div>
        <div className="product-studio-canvas"><WebGLCanvas key={product.id} product={product} variantIndex={variantIndex} mode="demo" mirror={false} lightingPreset="studio" calibration={{ scale: 1, ipdOffsetMm: 0, verticalOffsetMm: 0, depthOffsetMm: 0, mirror: false }} showLandmarks={false} debugOccluder={false} onStatsUpdate={() => {}} onSnapshotReady={() => {}} snapshotTrigger={0} customPhotoUrl={null} onLoadingChange={setLoading} />{loading && <div className="product-studio-loading" role="status">Loading your frame…</div>}</div>
      </section>
      <section className="product-information"><span className="section-eyebrow">THE DETAILS</span><h2>Made for a closer look.</h2><p>{details.description}</p><div className="finish-options"><span className="detail-label">PREVIEW FINISH</span><div className="finish-swatches">{product.variants.map((v, i) => <button key={i} aria-label={v.name} aria-pressed={variantIndex === i} title={v.name} onClick={() => onVariantChange(i)} style={{ backgroundColor: v.frameHex }}>{variantIndex === i && <Check size={12} />}</button>)}</div><p>{product.variants[variantIndex]?.name ?? product.variants[0].name}</p></div><button className="frame-capture" onClick={onTryOn}><Camera size={16} /> Try on my face <ArrowUpRight size={16} /></button><dl className="product-specs">{details.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{details.note && <p className="product-source-note">{details.note}</p>}{details.source && <a className="product-source" href={details.source} target="_blank" rel="noreferrer">{details.sourceLabel} <ArrowUpRight size={14} /></a>}</section>
    </div>
  </article>;
}
