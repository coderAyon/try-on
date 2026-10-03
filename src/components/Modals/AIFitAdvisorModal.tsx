import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
import { FaceMeasurements, SunglassesProduct, TrackingStats } from '../../types';
import { suggestFrames, FrameShape } from '../../utils/faceFitAdvisor';
import { ProductThumbnail } from '../Catalog/ProductThumbnail';

function ShapePreview({ shape }: { shape: FrameShape }) {
  const paths: Record<FrameShape, string> = {
    Round: 'M12 24a14 14 0 1 0 28 0a14 14 0 1 0-28 0',
    Oval: 'M8 24a18 11 0 1 0 36 0a18 11 0 1 0-36 0',
    Square: 'M10 13h32v22H10z',
    Flat: 'M8 15h36l-4 15q-14 8-28 0z',
    Geometric: 'M16 11h20l10 13-10 13H16L6 24z',
    Aviator: 'M10 15q16-7 32 0l-3 17q-10 12-22 2z',
  };
  return <svg viewBox="0 0 110 48" width="110" height="48" aria-label={shape + ' frame preview'}><g fill="#ddd0ef" stroke="#88729e" strokeWidth="2" strokeLinejoin="round"><path d={paths[shape]} /><path d={paths[shape]} transform="translate(56 0)" /><path d="M44 20q8-5 14 0" fill="none" /></g></svg>;
}

interface Props { isOpen: boolean; onClose: () => void; onSelectProduct: (product: SunglassesProduct) => void; stats: TrackingStats; products: SunglassesProduct[] }
export const AIFitAdvisorModal: React.FC<Props> = ({ isOpen, onClose, onSelectProduct, stats, products }) => {
  const [measurement, setMeasurement] = useState<FaceMeasurements | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) { setMeasurement(null); return; }
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen]);
  useEffect(() => {
    const m = stats.faceMeasurements;
    if (isOpen && !measurement && stats.faceDetected && m && m.samples >= 8 && Date.now() - m.measuredAt < 2000) setMeasurement({ ...m });
  }, [isOpen, stats, measurement]);
  if (!isOpen) return null;
  const result = measurement ? suggestFrames(measurement, products) : null;
  return <div className="fit-modal-backdrop" onClick={onClose}>
    <div ref={panel} className="fit-modal" role="dialog" aria-modal="true" aria-labelledby="fit-title" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const controls = panel.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!controls?.length) return;
        if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls[controls.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) { e.preventDefault(); controls[0].focus(); }
      }
    }}>
      <header className="fit-modal-header"><div><span className="section-eyebrow">AI-ASSISTED FACE FIT</span><h2 id="fit-title">Frames that complement you.</h2></div><button aria-label="Close fit advisor" onClick={onClose}><X size={20} /></button></header>
      {!result ? <div className="fit-scan"><Sparkles size={32} /><h3>{stats.faceDetected ? 'Look straight into the camera' : 'Let the camera see your face'}</h3><p>Keep your face centred, with your forehead and jaw visible. Hold still for a moment while we measure your proportions.</p><span>{stats.faceDetected ? 'Collecting a clear front-facing sample...' : 'Waiting for live face tracking...'}</span></div> : <div className="fit-results">
        <div className="fit-summary"><div><span className="detail-label">ESTIMATED FACE SHAPE</span><h3>{result.shape}</h3><p>{result.reason}</p></div><button onClick={() => setMeasurement(null)}><RefreshCw size={14} /> Scan again</button></div>
        <div className="fit-ratios"><span>Face length / width <strong>{measurement!.heightToWidth.toFixed(2)}</strong></span><span>Jaw / cheek <strong>{measurement!.jawToCheek.toFixed(2)}</strong></span><span>Forehead / cheek <strong>{measurement!.foreheadToCheek.toFixed(2)}</strong></span></div>
        <h3 className="fit-section-title">Suggested frame shapes</h3>
        <div className="fit-shapes">{result.shapes.map(shape => <div key={shape}><ShapePreview shape={shape} /><span>{shape === 'Flat' ? 'Soft flat / browline' : shape}</span></div>)}</div>
        <h3 className="fit-section-title">Try these on your face</h3>
        <div className="fit-products">{result.frames.map(({ product, shape }) => <button key={product.id} data-fit-product={product.id} onClick={() => { onSelectProduct(product); onClose(); }}><ProductThumbnail product={product} /><span className="detail-label">{shape} frame</span><h4>{product.name}</h4><span className="fit-try">Try on <ArrowRight size={13} /></span></button>)}</div>
      </div>}
      <footer>Measured on your device using MediaPipe face landmarks. Shape suggestions are styling estimates; no face photo is uploaded for this analysis.</footer>
    </div>
  </div>;
};
