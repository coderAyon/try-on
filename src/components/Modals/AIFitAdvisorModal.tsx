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
  return <svg viewBox="0 0 110 48" width="110" height="48" aria-label={shape + ' frame preview'}><g fill="#ede0fc" stroke="#7c3aed" strokeWidth="2.2" strokeLinejoin="round"><path d={paths[shape]} /><path d={paths[shape]} transform="translate(56 0)" /><path d="M44 20q8-5 14 0" fill="none" /></g></svg>;
}

interface Props { isOpen: boolean; onClose: () => void; onSelectProduct: (product: SunglassesProduct) => void; stats: TrackingStats; products: SunglassesProduct[]; cameraEnabled: boolean; onEnableCamera: () => void; activeProduct: SunglassesProduct; mirror: boolean; cameraMessage: string; cameraError: string }
export const AIFitAdvisorModal: React.FC<Props> = ({ isOpen, onClose, onSelectProduct, stats, products, cameraEnabled, onEnableCamera, activeProduct, mirror, cameraMessage, cameraError }) => {
  const [measurement, setMeasurement] = useState<FaceMeasurements | null>(null);
  const baseline = useRef(0);
  const scanStarted = useRef(0);
  const [progress, setProgress] = useState(0);
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const startScan = () => { baseline.current = stats.faceMeasurements?.samples ?? 0; scanStarted.current = Date.now(); setProgress(0); setMeasurement(null); };
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) { setMeasurement(null); return; }
    startScan();
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen]);
  useEffect(() => {
    const m = stats.faceMeasurements;
    if (!isOpen || measurement) return;
    if (!cameraEnabled || !stats.faceDetected || !m) { baseline.current = 0; setProgress(0); return; }
    if (m.samples < baseline.current) baseline.current = 0;
    const samples = m.samples - baseline.current;
    setProgress(Math.min(100, Math.round(samples / 12 * 100)));
    if (samples >= 12 && m.measuredAt > scanStarted.current && Date.now() - m.measuredAt < 1000) setMeasurement({ ...m });
  }, [isOpen, stats, measurement, cameraEnabled]);
  useEffect(() => {
    if (!isOpen) return;
    let frame = 0;
    const draw = () => {
      const source = document.getElementById('landmarkCameraCanvas') as HTMLCanvasElement | null;
      const glasses = document.getElementById('landmarkGlassesCanvas') as HTMLCanvasElement | null;
      if (source && source.width > 0 && source.height > 0) for (const [target, overlay] of [[before.current, false], [after.current, true]] as const) {
        if (!target) continue;
        if (target.width !== source.width || target.height !== source.height) { target.width = source.width; target.height = source.height; }
        const ctx = target.getContext('2d');
        if (!ctx) continue;
        ctx.save(); ctx.clearRect(0, 0, target.width, target.height);
        if (mirror) { ctx.translate(target.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(source, 0, 0);
        if (overlay && glasses && glasses.width > 0 && glasses.height > 0) ctx.drawImage(glasses, 0, 0, target.width, target.height);
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [isOpen, measurement, mirror]);
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
      {!result ? <div className="fit-scan" aria-live="polite"><Sparkles size={32} /><h3>{!cameraEnabled ? 'Allow your camera to find your fit' : stats.faceDetected ? 'Look straight into the camera' : 'Let the camera see your face'}</h3><p>Keep your face centred, with your forehead and jaw visible. Hold still while we collect 12 new front-facing measurements. Results appear only after this scan.</p>{!cameraEnabled ? <button className="frame-capture" onClick={onEnableCamera}>Allow camera & analyze my face</button> : <><canvas ref={before} className="fit-live-preview" aria-label="Live camera preview" /><progress max={100} value={progress} aria-label="Face analysis progress" /><span>{cameraError || cameraMessage || (stats.faceDetected ? `Analyzing your face: ${progress}%` : 'Centre your face in the live preview.')}</span><button className="frame-capture" onClick={() => { startScan(); onEnableCamera(); }}>Restart camera</button></>}</div> : <div className="fit-results">
        <div className="fit-summary">
          <div style={{ flex: 1 }}>
            <span className="detail-label">ESTIMATED FACE SHAPE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <h3 style={{ margin: 0 }}>{result.shape}</h3>
              <span className="fit-confidence-badge">{result.confidence}% shape similarity</span>
            </div>
            <p style={{ marginTop: '8px' }}>{result.reason}</p>
            <p><strong>Recommended frame shape: {result.recommendedShape ?? 'No suitable models available'}</strong>. {['Square', 'Round', 'Oval'].includes(result.shape) ? 'Showing only frames with the same shape as your face.' : 'Showing the closest available frame silhouette for your face shape.'}</p>
            {result.scores && (
              <div className="fit-scores-breakdown">
                <span className="fit-scores-title">MORPHOLOGY MATCH PROFILES</span>
                <div className="fit-scores-grid">
                  {Object.entries(result.scores).map(([s, score]) => (
                    <div key={s} className={`fit-score-chip ${s === result.shape ? 'is-dominant' : ''}`}>
                      <span className="fit-score-name">{s}</span>
                      <div className="fit-score-bar">
                        <div className="fit-score-fill" style={{ width: `${score}%` }} />
                      </div>
                      <span className="fit-score-pct">{score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={startScan}><RefreshCw size={14} /> Scan again</button>
        </div>
        <h3 className="fit-section-title">Your face, side by side</h3>
        <div className="fit-comparison"><figure><canvas ref={before} /><figcaption>Without frames</figcaption></figure><figure><canvas ref={after} /><figcaption>With {activeProduct.name}</figcaption></figure></div>
        <p className="fit-comparison-note">Select a recommended frame below to compare it live on your face. {stats.faceDetected ? 'Live face detected.' : 'Face tracking paused — centre your face to resume.'}</p>
        <div className="fit-ratios">
          <span>Face length / width <strong>{measurement!.heightToWidth.toFixed(2)}x</strong></span>
          <span>Jaw / cheek taper <strong>{measurement!.jawToCheek.toFixed(2)}x</strong></span>
          <span>Forehead / cheek <strong>{measurement!.foreheadToCheek.toFixed(2)}x</strong></span>
          <span>Forehead / jaw ratio <strong>{(measurement!.foreheadToJaw ?? (measurement!.foreheadToCheek / (measurement!.jawToCheek || 1))).toFixed(2)}x</strong></span>
        </div>
        <h3 className="fit-section-title">Recommended frame shape</h3>
        <div className="fit-shapes">{result.shapes.map(shape => <div key={shape}><ShapePreview shape={shape} /><span>{shape === 'Flat' ? 'Soft flat / browline' : shape}</span></div>)}</div>
        <h3 className="fit-section-title">{result.recommendedShape ? `All ${result.recommendedShape.toLowerCase()} frames for you · ${result.frames.length} models` : 'No matching frames in this catalog yet'}</h3>
        <div className="fit-products">{result.frames.map(({ product, shape }) => <button key={product.id} data-fit-product={product.id} aria-pressed={activeProduct.id === product.id} onClick={() => onSelectProduct(product)}><ProductThumbnail product={product} /><span className="detail-label">{shape} frame</span><h4>{product.brand} · {product.name}</h4><p>{result.shape} styling match: {result.reason}</p><p>{product.frameMaterial} · {product.polarized ? 'Polarized' : 'Non-polarized'} · {product.uvProtection}</p><p>Lens {product.dimensions.lensWidth} mm · Bridge {product.dimensions.bridgeWidth} mm · Temple {product.dimensions.templeLength} mm</p><span className="fit-try">{activeProduct.id === product.id ? 'Comparing now' : 'Compare on my face'} <ArrowRight size={13} /></span></button>)}</div>
      </div>}
      <footer>Measured on your device using MediaPipe face landmarks. Shape suggestions are styling estimates; no face photo is uploaded for this analysis.</footer>
    </div>
  </div>;
};
