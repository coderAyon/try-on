import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createFaceDetector } from '../../utils/faceDetector';
import { loadEyewearCADModel } from '../../utils/cadModelManager';
import { EyewearRig, eyewearPose, landmarkWorld } from '../../utils/landmarkEyewear';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';
import { SunglassesProduct } from '../../types';
import { ProductThumbnail } from '../Catalog/ProductThumbnail';
import { ArrowLeft, Upload, Download, X, ImagePlus, Glasses, Sparkles, CheckCircle2, AlertTriangle, User, Globe, ScanFace, Maximize2 } from 'lucide-react';

interface PhotoTryOnPageProps {
  products: SunglassesProduct[];
  product: SunglassesProduct;
  onSelect: (p: SunglassesProduct) => void;
  onBack: () => void;
}

type FaceVerificationStatus = 'idle' | 'checking' | 'detected' | 'no_face' | 'multiple_faces';

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  grad.addColorStop(0, 'rgba(20, 15, 12, 0.40)');
  grad.addColorStop(0.35, 'rgba(30, 22, 18, 0.22)');
  grad.addColorStop(0.7, 'rgba(45, 30, 24, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function applyPhotographicClarity(ctx: CanvasRenderingContext2D, width: number, height: number, amount = 0.22) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);
    const w = width;
    const h = height;
    const k = amount;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = (row + x) * 4;
        const up = ((y - 1) * w + x) * 4;
        const down = ((y + 1) * w + x) * 4;
        const left = (row + x - 1) * 4;
        const right = (row + x + 1) * 4;
        for (let c = 0; c < 3; c++) {
          const val = copy[idx + c];
          const laplacian = 4 * val - copy[up + c] - copy[down + c] - copy[left + c] - copy[right + c];
          const delta = Math.max(-28, Math.min(28, laplacian * k));
          data[idx + c] = Math.min(255, Math.max(0, val + delta));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {}
}

export function PhotoTryOnPage({ products, product, onSelect, onBack }: PhotoTryOnPageProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [faceCropResult, setFaceCropResult] = useState<string | null>(null);
  const [faceCropOriginal, setFaceCropOriginal] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'face'>('full');
  const [filename, setFilename] = useState('Your photo');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [variant, setVariant] = useState(0);
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<'upload' | 'url' | 'models'>('upload');
  const [faceStatus, setFaceStatus] = useState<FaceVerificationStatus>('idle');

  const request = useRef(0);
  const activeRun = useRef(0);
  const urlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      request.current++;
      activeRun.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const checkFaceInPhoto = async (imageUrl: string, reqId: number) => {
    setFaceStatus('checking');
    let task: Awaited<ReturnType<typeof createFaceDetector>> | null = null;
    try {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      if (reqId !== request.current) return;

      const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.round(image.naturalWidth * scale);
      const height = Math.round(image.naturalHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, width, height);

      task = await createFaceDetector('IMAGE', 2);
      if (reqId !== request.current) return;

      const faces = task.detect(canvas).faceLandmarks;
      if (faces.length === 1) {
        setFaceStatus('detected');
      } else if (faces.length === 0) {
        setFaceStatus('no_face');
      } else {
        setFaceStatus('multiple_faces');
      }
    } catch {
      if (reqId === request.current) {
        setFaceStatus('idle');
      }
    } finally {
      task?.close();
    }
  };

  const accept = (blob: Blob, name: string) => {
    if (!blob.type.startsWith('image/')) throw Error('Choose a direct JPG, PNG or WebP image.');
    if (blob.size > 20 * 1024 * 1024) throw Error('Use an image smaller than 20 MB.');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    const currentUrl = urlRef.current;
    const currentId = ++request.current;
    setZoom(1);
    setPhoto(currentUrl);
    setFilename(name);
    setResult(null); // Clear previous result so user can click "Try on"
    setFaceCropResult(null);
    setFaceCropOriginal(null);
    setViewMode('full');
    setError('');
    checkFaceInPhoto(currentUrl, currentId);
  };

  const upload = (file?: File) => {
    if (!file) return;
    try {
      accept(file, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image could not load');
    }
  };

  const loadDemoModel = async (path: string, label: string) => {
    const id = ++request.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(path);
      if (!response.ok) throw Error('Could not load demo portrait.');
      const blob = await response.blob();
      if (id === request.current) {
        accept(blob, label);
      }
    } catch (e: unknown) {
      if (id === request.current) {
        setError(e instanceof Error ? e.message : 'Could not load demo portrait.');
      }
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  const loadLink = async (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    const id = ++request.current;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const url = new URL(clean);
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('Use an HTTP or HTTPS image URL.');
      
      let blob: Blob | null = null;
      // Direct fetch attempt
      try {
        const response = await fetch(url.href, { signal: AbortSignal.timeout(8000), credentials: 'omit' });
        if (response.ok) {
          blob = await response.blob();
        }
      } catch {
        blob = null;
      }

      // If direct fetch fails (e.g. CORS block from external image host), fall back to server proxy
      if (!blob) {
        const proxyRes = await fetch(`/api/photo/proxy?url=${encodeURIComponent(url.href)}`, { signal: AbortSignal.timeout(15000) });
        if (!proxyRes.ok) {
          const errJson = await proxyRes.json().catch(() => ({}));
          throw Error(errJson.error || 'Image link could not be opened by browser or server.');
        }
        blob = await proxyRes.blob();
      }

      if (id === request.current) {
        accept(blob, 'Web Portrait');
        setLink('');
      }
    } catch (e) {
      if (id === request.current) {
        setError(e instanceof Error ? e.message : 'Image could not load. Try uploading the photo file directly.');
      }
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  // Run 3D glasses fitting on the photo with Ultra-HD super-sampling and unified background rendering
  const handleTryOn = async () => {
    if (!photo) {
      fileInputRef.current?.click();
      return;
    }

    if (faceStatus === 'no_face') {
      setError('Cannot perform 3D try-on: No human face detected in this image! "1. Face photo" must be a portrait of the person. Frames are selected from "2. Eyewear frame" below.');
      return;
    }

    const runId = ++activeRun.current;
    setBusy(true);
    setError('');

    let task: Awaited<ReturnType<typeof createFaceDetector>> | null = null;
    let rig: EyewearRig | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let env: THREE.WebGLRenderTarget | null = null;
    let geometry: THREE.BufferGeometry | null = null;
    let material: THREE.Material | null = null;
    let skullGeometry: THREE.BufferGeometry | null = null;
    let bgTexture: THREE.CanvasTexture | null = null;
    let shadowTexture: THREE.CanvasTexture | null = null;

    try {
      const image = new Image();
      image.src = photo;
      await image.decode();
      if (runId !== activeRun.current) return;

      // 1. Fast & accurate face landmark detection on optimized analysis buffer
      task = await createFaceDetector('IMAGE', 2);
      if (runId !== activeRun.current) return;

      const detectionScale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const detCanvas = document.createElement('canvas');
      detCanvas.width = Math.round(image.naturalWidth * detectionScale);
      detCanvas.height = Math.round(image.naturalHeight * detectionScale);
      const detCtx = detCanvas.getContext('2d')!;
      detCtx.drawImage(image, 0, 0, detCanvas.width, detCanvas.height);

      const faces = task.detect(detCanvas).faceLandmarks;
      if (faces.length !== 1) {
        throw Error(faces.length ? 'Use a photo with one face.' : 'No face detected. Use a clear photo with both eyes visible.');
      }
      const points = faces[0];

      // Calculate normalized face bounding box
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (let i = 0; i < 468; i++) {
        minX = Math.min(minX, points[i].x);
        maxX = Math.max(maxX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxY = Math.max(maxY, points[i].y);
      }
      const faceNormWidth = Math.max(0.08, maxX - minX);

      // 2. High-Definition Super-Sampling Dimension Calculation
      // Guarantee face region has at least 380px across for razor-sharp CAD geometry & curves
      const minScaleForFace = 380 / (faceNormWidth * image.naturalWidth);
      // Guarantee overall longest dimension is at least 2048px (unless original is already larger)
      const minScaleForRes = 2048 / Math.max(image.naturalWidth, image.naturalHeight);
      const targetSuperSample = Math.max(1, Math.min(3.0, Math.max(minScaleForFace, minScaleForRes)));
      const maxAllowedDim = 3840;
      const finalScale = Math.min(targetSuperSample, maxAllowedDim / Math.max(image.naturalWidth, image.naturalHeight));

      const width = Math.round(image.naturalWidth * finalScale);
      const height = Math.round(image.naturalHeight * finalScale);

      // Draw high-resolution base plate with high-quality bicubic smoothing
      const input = document.createElement('canvas');
      input.width = width;
      input.height = height;
      const ctx = input.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw Error('Photo processing unavailable.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, width, height);

      // 3. Compute 3D eyewear pose on high-resolution canvas
      const pose = eyewearPose(points, width, height);
      if (!pose) throw Error('Could not measure this face.');

      const activeVariant = product.variants[variant] || product.variants[0];
      const model = await loadEyewearCADModel(product, activeVariant);
      if (runId !== activeRun.current) return;

      rig = new EyewearRig(model, product.id);

      // 4. Initialize WebGL Renderer with High-Performance Settings & Hardware MSAA
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: false, // Unified scene rendering: photo is in background, so MSAA blends directly against skin pixels!
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();

      // 5. High-Resolution Background Photo Quad (depthTest: false, toneMapped: false to preserve 100% true skin colors)
      bgTexture = new THREE.CanvasTexture(input);
      bgTexture.colorSpace = THREE.SRGBColorSpace;
      bgTexture.minFilter = THREE.LinearFilter;
      bgTexture.magFilter = THREE.LinearFilter;

      const bgMat = new THREE.MeshBasicMaterial({
        map: bgTexture,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), bgMat);
      bgMesh.position.set(0, 0, -1800);
      bgMesh.renderOrder = -100;
      scene.add(bgMesh);

      // 6. Balanced Natural Studio Lighting
      env = generateStudioEnvironment(renderer, 'studio');
      scene.environment = env.texture;
      scene.add(new THREE.HemisphereLight(0xfff8f0, 0x4a4036, 1.25));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
      keyLight.position.set(-width * 0.25, height * 0.35, 900);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.75);
      fillLight.position.set(width * 0.3, -height * 0.1, 700);
      scene.add(fillLight);

      // 7. Orthographic Camera exactly framing the canvas
      const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 4500);
      camera.position.z = 1000;

      // 8. Eyewear Group & Temple Arm Fitting
      const root = new THREE.Group();
      root.add(rig.group);
      root.position.copy(pose.position);
      root.quaternion.copy(pose.quaternion);
      root.scale.setScalar(rig.fittedScale(pose.eyeSpan, pose.faceWidth, pose.isFrontal));
      scene.add(root);
      root.updateMatrixWorld(true);

      const localLeftTemple = root.worldToLocal(pose.leftTemple.clone());
      const localRightTemple = root.worldToLocal(pose.rightTemple.clone());
      rig.fitTemples(localLeftTemple, localRightTemple);

      // 9. Depth Occluders (Skull Volume + Face Surface Mask)
      const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
      material = depthMaterial;

      // Cranium / Skull occluder cleanly hides far temple arm behind head/hair during angled poses
      const faceWidth = localLeftTemple.distanceTo(localRightTemple);
      skullGeometry = new THREE.SphereGeometry(1, 32, 24);
      const skull = new THREE.Mesh(skullGeometry, depthMaterial);
      skull.position.set((localLeftTemple.x + localRightTemple.x) / 2, 0.6, (localLeftTemple.z + localRightTemple.z) / 2 - faceWidth * 0.13);
      skull.scale.set(faceWidth * 0.49, faceWidth * 0.70, faceWidth * 0.46);
      skull.renderOrder = -10;
      root.add(skull);

      // Face mesh occluder
      const response = await fetch('/tracking/face-triangles.json');
      if (!response.ok) throw Error('Face surface could not load.');
      const triangles = await response.json();
      if (runId !== activeRun.current) return;

      geometry = new THREE.BufferGeometry();
      geometry.setIndex(triangles);
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          points.slice(0, 468).flatMap((p) => {
            const w = landmarkWorld(p, width, height);
            w.z -= pose.eyeSpan * 0.008;
            return w.toArray();
          }),
          3
        )
      );
      const mask = new THREE.Mesh(geometry, depthMaterial);
      mask.renderOrder = -10;
      scene.add(mask);

      // 10. Soft Ambient Contact Shadow on Nose Bridge & Radix
      shadowTexture = createContactShadowTexture();
      const shadowGeo = new THREE.PlaneGeometry(pose.eyeSpan * 0.50, pose.eyeSpan * 0.28);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.copy(pose.bridge);
      shadowMesh.position.addScaledVector(pose.yAxis, -pose.eyeSpan * 0.04);
      shadowMesh.position.addScaledVector(pose.zAxis, -pose.eyeSpan * 0.02);
      shadowMesh.quaternion.copy(pose.quaternion);
      shadowMesh.renderOrder = -5;
      scene.add(shadowMesh);

      // 11. Render Full High-Definition Scene
      renderer.render(scene, camera);

      // 12. Create Crisp Composited Result with Smart Clarity
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = width;
      finalCanvas.height = height;
      const fCtx = finalCanvas.getContext('2d', { willReadFrequently: true })!;
      fCtx.drawImage(renderer.domElement, 0, 0);
      applyPhotographicClarity(fCtx, width, height, 0.22);
      const fullResultUrl = finalCanvas.toDataURL('image/png');

      // 13. Create High-Definition Face-Focus Portrait Crop
      const faceCenterX = ((minX + maxX) / 2) * width;
      const faceCenterY = ((minY + maxY) / 2) * height;
      const facePixWidth = (maxX - minX) * width;
      const facePixHeight = (maxY - minY) * height;

      const cropSide = Math.round(Math.max(facePixWidth * 2.15, facePixHeight * 1.85));
      const cropX = Math.round(Math.max(0, Math.min(width - cropSide, faceCenterX - cropSide / 2)));
      const cropY = Math.round(Math.max(0, Math.min(height - cropSide, faceCenterY - cropSide * 0.40)));
      const actualCropWidth = Math.min(cropSide, width - cropX);
      const actualCropHeight = Math.min(cropSide, height - cropY);

      const cropTargetRes = Math.min(1440, Math.round(Math.max(actualCropWidth, actualCropHeight)));
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropTargetRes;
      cropCanvas.height = cropTargetRes;
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.imageSmoothingEnabled = true;
      cropCtx.imageSmoothingQuality = 'high';
      cropCtx.drawImage(finalCanvas, cropX, cropY, actualCropWidth, actualCropHeight, 0, 0, cropTargetRes, cropTargetRes);
      const faceResultUrl = cropCanvas.toDataURL('image/png');

      const origCropCanvas = document.createElement('canvas');
      origCropCanvas.width = cropTargetRes;
      origCropCanvas.height = cropTargetRes;
      const origCropCtx = origCropCanvas.getContext('2d')!;
      origCropCtx.imageSmoothingEnabled = true;
      origCropCtx.imageSmoothingQuality = 'high';
      origCropCtx.drawImage(input, cropX, cropY, actualCropWidth, actualCropHeight, 0, 0, cropTargetRes, cropTargetRes);
      const faceOrigUrl = origCropCanvas.toDataURL('image/png');

      if (runId === activeRun.current) {
        setResult(fullResultUrl);
        setFaceCropResult(faceResultUrl);
        setFaceCropOriginal(faceOrigUrl);
      }
    } catch (e) {
      if (runId === activeRun.current) {
        setError(e instanceof Error ? e.message : 'Photo fitting failed.');
      }
    } finally {
      task?.close();
      rig?.dispose();
      env?.dispose();
      geometry?.dispose();
      material?.dispose();
      skullGeometry?.dispose();
      bgTexture?.dispose();
      shadowTexture?.dispose();
      renderer?.dispose();
      if (runId === activeRun.current) {
        setBusy(false);
      }
    }
  };

  const enhance = async () => {
    if (!result) return;
    const id = request.current;
    setAiBusy(true);
    setError('');
    try {
      const response = await fetch('/api/photo/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: result }),
        signal: AbortSignal.timeout(180000),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'AI enhancement failed');
      if (id === request.current) setResult(data.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI enhancement unavailable');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <article className="photo-workspace">
      <button className="product-back" onClick={onBack}>
        <ArrowLeft size={17} /> Back to fitting room
      </button>

      <div className="photo-workspace-heading">
        <span>PHOTO TRY-ON STUDIO</span>
        <h1>Your photo. Your frames.</h1>
        <p>Choose a portrait and a frame to create your fitted image.</p>
      </div>

      <div className="photo-workbench">
        <div className="photo-inputs">
          <div className="photo-input-cards">
            {/* 1. Face photo card */}
            <section
              className={`photo-asset-card ${dragging ? 'photo-drop-active' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                upload(e.dataTransfer.files[0]);
              }}
            >
              <header>
                <h2>1. Face photo</h2>
                <span>{photo ? (faceStatus === 'detected' ? 'READY' : faceStatus === 'no_face' ? 'NO FACE' : 'CHECKING') : 'PORTRAIT'}</span>
              </header>

              {/* Source Mode Tabs when no photo is loaded */}
              {!photo && (
                <div className="photo-source-tabs">
                  <button
                    type="button"
                    className={activeInputTab === 'upload' ? 'active' : ''}
                    onClick={() => setActiveInputTab('upload')}
                  >
                    <Upload size={12} /> Upload
                  </button>
                  <button
                    type="button"
                    className={activeInputTab === 'url' ? 'active' : ''}
                    onClick={() => setActiveInputTab('url')}
                  >
                    <Globe size={12} /> Face Link
                  </button>
                  <button
                    type="button"
                    className={activeInputTab === 'models' ? 'active' : ''}
                    onClick={() => setActiveInputTab('models')}
                  >
                    <User size={12} /> Demo Face
                  </button>
                </div>
              )}

              <div className="photo-asset-preview">
                {photo ? (
                  <>
                    <img src={photo} alt="Face photo for try-on" />

                    {/* Floating face verification badge */}
                    {faceStatus === 'checking' && (
                      <div className="face-pill checking">
                        <Sparkles size={11} className="animate-spin" />
                        <span>Verifying face…</span>
                      </div>
                    )}
                    {faceStatus === 'detected' && (
                      <div className="face-pill valid">
                        <CheckCircle2 size={11} />
                        <span>Human Face Detected</span>
                      </div>
                    )}
                    {faceStatus === 'no_face' && (
                      <div className="face-pill no-face">
                        <AlertTriangle size={11} />
                        <span>No Face Detected</span>
                      </div>
                    )}

                    <button
                      className="photo-remove"
                      aria-label="Remove photo"
                      onClick={() => {
                        request.current++;
                        activeRun.current++;
                        setPhoto(null);
                        setResult(null);
                        setFaceCropResult(null);
                        setFaceCropOriginal(null);
                        setViewMode('full');
                        setFaceStatus('idle');
                        setError('');
                        setBusy(false);
                      }}
                    >
                      <X size={18} />
                    </button>
                    <span className="photo-filename">{filename}</span>

                    {/* Prominent warning if the user loaded sunglasses/non-face in this slot */}
                    {faceStatus === 'no_face' && (
                      <div className="face-alert-overlay">
                        <div className="flex items-start gap-2 text-left">
                          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[11px] font-bold text-red-100">No Human Face Detected!</p>
                            <p className="text-[10px] text-red-200/90 leading-tight mt-0.5">
                              This slot is for the <strong>person wearing the glasses</strong>. If you are trying to change sunglasses, choose a frame from <strong>2. Eyewear frame</strong> below.
                            </p>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => loadDemoModel('/models_faces/female_oval.jpg', 'Female Portrait Model')}
                                className="px-2.5 py-1 bg-red-500/30 hover:bg-red-500/50 text-red-100 rounded text-[10px] font-semibold transition cursor-pointer"
                              >
                                Use Demo Face
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPhoto(null);
                                  setFaceStatus('idle');
                                }}
                                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-medium transition cursor-pointer"
                              >
                                Change Photo
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Tab 1: Upload File */}
                    {activeInputTab === 'upload' && (
                      <label className="photo-placeholder cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <ImagePlus size={34} className="text-[#a855f7] transition-transform group-hover:scale-110" />
                        <strong className="text-white text-xs font-semibold">Upload face portrait</strong>
                        <span className="text-[11px] text-[#b3a4c8] leading-tight">Click to browse or drag your photo here</span>
                        <span className="text-[10px] text-[#8e7ea5]">JPG, PNG, WebP · up to 20 MB</span>
                        <input
                          ref={fileInputRef}
                          aria-label="Upload face photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            upload(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}

                    {/* Tab 2: Public URL */}
                    {activeInputTab === 'url' && (
                      <div className="w-full h-full flex flex-col justify-center items-center p-3 text-center">
                        <div className="w-9 h-9 rounded-full bg-violet-950/70 border border-violet-500/30 flex items-center justify-center mb-1.5 text-violet-400">
                          <Globe size={18} />
                        </div>
                        <strong className="text-white text-xs font-semibold">Face portrait URL</strong>
                        <p className="text-[10.5px] text-[#b3a4c8] mt-0.5 mb-2 leading-snug">
                          Paste link of a <strong>person's face</strong> (portrait photo)
                        </p>
                        <form
                          className="w-full flex flex-col gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            loadLink(link);
                          }}
                        >
                          <input
                            type="url"
                            value={link}
                            placeholder="https://.../face-photo.jpg"
                            onChange={(e) => setLink(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#251b36] border border-[#4c1d95] text-white focus:outline-none focus:border-violet-400"
                            required
                          />
                          <button
                            type="submit"
                            disabled={busy || !link.trim()}
                            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white text-xs font-semibold shadow-md disabled:opacity-50 cursor-pointer"
                          >
                            {busy ? 'Loading & verifying…' : 'Load face photo'}
                          </button>
                        </form>
                        <span className="text-[9.5px] text-[#8e7ea5] mt-1.5">
                          Note: Sunglasses frames are chosen in <strong>Card 2</strong>.
                        </span>
                      </div>
                    )}

                    {/* Tab 3: Demo Models */}
                    {activeInputTab === 'models' && (
                      <div className="w-full h-full flex flex-col justify-center items-center p-3 text-center">
                        <strong className="text-white text-xs font-semibold mb-1">Select demo model face</strong>
                        <p className="text-[10.5px] text-[#b3a4c8] mb-2.5">Try instant 3D fit with real models:</p>
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => loadDemoModel('/models_faces/female_oval.jpg', 'Female Portrait Model')}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[#251b36] hover:bg-[#3b0764] border border-[#4c1d95] hover:border-violet-400 transition cursor-pointer group"
                          >
                            <img src="/models_faces/female_oval.jpg" alt="Female Model" className="w-11 h-11 rounded-full object-cover border border-violet-400/30 group-hover:scale-105 transition" />
                            <span className="text-[11px] font-medium text-violet-200">Female Face</span>
                            <span className="text-[9px] text-[#a78bfa]">Oval shape</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => loadDemoModel('/models_faces/male_square.jpg', 'Male Portrait Model')}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[#251b36] hover:bg-[#3b0764] border border-[#4c1d95] hover:border-violet-400 transition cursor-pointer group"
                          >
                            <img src="/models_faces/male_square.jpg" alt="Male Model" className="w-11 h-11 rounded-full object-cover border border-violet-400/30 group-hover:scale-105 transition" />
                            <span className="text-[11px] font-medium text-violet-200">Male Face</span>
                            <span className="text-[9px] text-[#a78bfa]">Square shape</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <footer>
                <span>{photo ? (faceStatus === 'detected' ? '✓ Ready for 3D fit' : 'Change portrait') : 'Personalize your portrait'}</span>
                {photo ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setFaceStatus('idle');
                        setActiveInputTab('url');
                      }}
                      className="text-[#c084fc] hover:text-[#d8b4fe] text-[11px] font-semibold cursor-pointer"
                    >
                      Link
                    </button>
                    <span className="text-white/20">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setFaceStatus('idle');
                        setActiveInputTab('models');
                      }}
                      className="text-[#c084fc] hover:text-[#d8b4fe] text-[11px] font-semibold cursor-pointer"
                    >
                      Demo
                    </button>
                    <span className="text-white/20">·</span>
                    <label className="photo-upload-action">
                      <Upload size={13} />
                      <span>Replace</span>
                      <input
                        aria-label="Upload face photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          upload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="photo-upload-action">
                    <Upload size={14} />
                    <span>Browse</span>
                    <input
                      aria-label="Upload face photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        upload(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </footer>
            </section>

            {/* 2. Eyewear frame card */}
            <section className="photo-asset-card">
              <header>
                <h2>2. Eyewear frame</h2>
                <span>READY</span>
              </header>
              <div className="photo-asset-preview photo-frame-preview">
                <ProductThumbnail product={product} variantIndex={variant} />
                <span className="photo-filename">{product.name}</span>
              </div>
              <footer>
                <span>Inspect the frame · select below</span>
                <Glasses size={17} />
              </footer>
            </section>
          </div>

          {/* Settings card with Try On Action */}
          <section className="photo-settings-card">
            <h2>Make the look yours</h2>
            <p>Select your favorite 3D eyewear frame and finish, then click Try on to generate your photo.</p>

            <div className="photo-setting-fields">
              <div>
                <label htmlFor="photo-frame">FRAME</label>
                <select
                  id="photo-frame"
                  value={product.id}
                  onChange={(e) => {
                    request.current++;
                    const p = products.find((item) => item.id === e.target.value);
                    if (p) {
                      setVariant(0);
                      onSelect(p);
                      setResult(null); // Reset result so user clicks "Try on" to generate with new frame
                      setFaceCropResult(null);
                      setFaceCropOriginal(null);
                    }
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="photo-finish">FINISH</label>
                <select
                  id="photo-finish"
                  value={variant}
                  onChange={(e) => {
                    request.current++;
                    setVariant(Number(e.target.value));
                    setResult(null); // Reset result so user clicks "Try on" to generate with new finish
                    setFaceCropResult(null);
                    setFaceCropOriginal(null);
                  }}
                >
                  {product.variants.map((v, i) => (
                    <option key={i} value={i}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prominent Try On CTA Button */}
            <div className="my-4">
              <button
                type="button"
                className="photo-tryon-button flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-bold text-sm shadow-lg shadow-violet-500/35 transition-all cursor-pointer border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                onClick={handleTryOn}
                disabled={busy}
              >
                <Sparkles size={18} />
                <span>{busy ? 'Fitting frames on face…' : 'Try on'}</span>
              </button>
              {!photo && (
                <p className="text-[11px] text-[#b3a4c8] text-center mt-2">
                  Add your portrait photo first, then click <strong>Try on</strong>
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/20 text-xs text-[#b3a4c8] flex items-center gap-2.5">
              <Glasses size={18} className="text-violet-400 shrink-0" />
              <span className="leading-snug">
                Frames are rendered from real 3D CAD models. Switch frames or finishes anytime and click <strong>Try on</strong>.
              </span>
            </div>

            <p className="photo-privacy">
              Fitting runs securely on your device. Click <strong>Try on</strong> to generate the fitted frame. AI enhance sends the fitted image to OpenAI only when clicked.
            </p>
            {error && (
              <p className="photo-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>

        {/* Result Stage */}
        <section className="photo-result-card" aria-live="polite">
          <div className={`photo-result-stage ${zoom > 1 ? 'photo-result-zoomed' : ''}`}>
            <div className="photo-zoom-content" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%`, position: 'relative' }}>
              <div className="photo-result-labels">
                <span>ORIGINAL {viewMode === 'face' && faceCropOriginal ? '(FACE)' : ''}</span>
                <span>{result ? (viewMode === 'face' && faceCropResult ? 'FITTED FACE (HD)' : 'FITTED RESULT (HD)') : 'PREVIEW'}</span>
              </div>

              {photo ? (
                <>
                  <img
                    className="photo-result-image"
                    src={(viewMode === 'face' && faceCropResult ? faceCropResult : result) || photo}
                    alt={result ? `${product.name} fitted on your face` : 'Photo preview'}
                  />
                  {result && (
                    <>
                      <img
                        className="photo-result-original"
                        src={(viewMode === 'face' && faceCropOriginal ? faceCropOriginal : photo)!}
                        alt="Original for comparison"
                        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                      />
                      <div className="photo-split-line" style={{ left: `${split}%` }}>
                        <span>↔</span>
                      </div>
                      <input
                        className="photo-split-control"
                        type="range"
                        min="0"
                        max="100"
                        value={split}
                        onChange={(e) => setSplit(Number(e.target.value))}
                        aria-label="Compare original and fitted image"
                      />
                    </>
                  )}
                  {!result && !busy && (
                    <div className="absolute inset-x-0 bottom-6 flex justify-center z-10">
                      <button
                        onClick={handleTryOn}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:from-[#8b5cf6] hover:to-[#7c3aed] text-white font-bold text-sm shadow-xl shadow-violet-500/40 border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Sparkles size={16} />
                        <span>Try on</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="photo-result-empty">
                  <Glasses size={40} />
                  <h2>Your next look starts here</h2>
                  <p>Upload a face photo and click <strong>Try on</strong> to see your fitted result.</p>
                </div>
              )}
            </div>

            {(busy || aiBusy) && (
              <div className="photo-rendering" role="status">
                <span />
                {aiBusy ? 'AI enhancement in progress…' : 'Rendering Ultra-HD 3D CAD frames on face…'}
              </div>
            )}
          </div>

          <div className="photo-result-tools flex flex-wrap items-center justify-between gap-2.5">
            {/* View Mode Switch (Full View vs Face Focus) */}
            {faceCropResult ? (
              <div className="flex items-center bg-[#1e152d] p-0.5 rounded-lg border border-purple-900/60">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'full' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#c084fc] hover:text-white'}`}
                  onClick={() => setViewMode('full')}
                >
                  <Maximize2 size={12} />
                  <span>Full View</span>
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'face' ? 'bg-[#7c3aed] text-white shadow-sm' : 'text-[#c084fc] hover:text-white'}`}
                  onClick={() => setViewMode('face')}
                >
                  <ScanFace size={13} />
                  <span>Face Focus (HD)</span>
                </button>
              </div>
            ) : <div />}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out">
                −
              </button>
              <span className="text-xs px-1 text-purple-300 font-semibold">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, z + 0.5))} aria-label="Zoom in">
                +
              </button>
              <button onClick={() => setZoom(1)}>Fit</button>
            </div>

            {/* AI / Extra Action button */}
            <div className="ml-auto">
              <button disabled={!result || busy || aiBusy} onClick={enhance} className="flex items-center gap-1.5">
                <Sparkles size={13} />
                <span>AI enhance</span>
              </button>
            </div>
          </div>

          <footer>
            <span className={result && !busy ? 'photo-result-ready' : ''}>
              ● {busy ? 'PROCESSING ULTRA-HD' : result ? 'RENDER READY · ULTRA HD PNG' : photo ? 'READY TO TRY ON' : 'WAITING FOR PHOTO'}
            </span>
            {result && !busy && (
              <div className="flex items-center gap-2">
                {faceCropResult && (
                  <a
                    className="photo-download secondary px-3 py-1.5 rounded-lg bg-violet-950/60 border border-violet-500/30 hover:border-violet-400 text-violet-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    href={faceCropResult}
                    download={`face-portrait-${product.id}.png`}
                    title="Download high-resolution face close-up"
                  >
                    <Download size={13} /> Face (HD)
                  </a>
                )}
                <a
                  className="photo-download px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-500/25 transition hover:brightness-110 cursor-pointer"
                  href={result}
                  download={`lumen-${product.id}.png`}
                  title="Download complete high-resolution try-on photo"
                >
                  <Download size={13} /> Full Photo (HD)
                </a>
              </div>
            )}
          </footer>
        </section>
      </div>
    </article>
  );
}
