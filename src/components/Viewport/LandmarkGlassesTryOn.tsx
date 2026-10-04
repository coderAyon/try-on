import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FaceMeasurementSampler } from '../../utils/faceFitAdvisor';
import type { JeelizGlassesTryOnProps } from './JeelizGlassesTryOn';
import { loadEyewearCADModel } from '../../utils/cadModelManager';
import { EyewearRig, eyewearPose, landmarkWorld, StableEyewearPose } from '../../utils/landmarkEyewear';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';
import { openTryOnCamera, cameraErrorMessage } from '../../utils/cameraAccess';
import { createFaceDetector, sanitizeEmscriptenEnvironment } from '../../utils/faceDetector';

export const LandmarkGlassesTryOn: React.FC<JeelizGlassesTryOnProps & { onCameraStateChange?: (message: string, error: string) => void }> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const rigRef = useRef<EyewearRig | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState('');
  const [detected, setDetected] = useState(false);
  const [fps, setFps] = useState(0);
  useEffect(() => { propsRef.current.onCameraStateChange?.(status, error); }, [status, error]);

  useEffect(() => {
    const container = containerRef.current, background = backgroundRef.current, overlay = overlayRef.current;
    if (!container || !background || !overlay) return;
    let cancelled = false, stream: MediaStream | null = null, landmarker: FaceLandmarker | null = null;
    let frame = 0, environment: THREE.WebGLRenderTarget | null = null;
    let startupTimer = 0;
    const video = document.createElement('video'); video.muted = true; video.playsInline = true;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const renderer = new THREE.WebGLRenderer({ canvas: overlay, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    rendererRef.current = renderer;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000); camera.position.z = 1000;
    const root = new THREE.Group(); root.visible = false; rootRef.current = root; scene.add(root);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x716a60, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-100, 200, 600); scene.add(key);
    environment = generateStudioEnvironment(renderer, propsRef.current.lightingPreset || 'studio'); scene.environment = environment.texture;

    const faceGeometry = new THREE.BufferGeometry();
    faceGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(468 * 3), 3));
    const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    const faceMask = new THREE.Mesh(faceGeometry, depthMaterial); faceMask.renderOrder = -10; faceMask.frustumCulled = false; faceMask.visible = false; scene.add(faceMask);
    const skullGeometry = new THREE.SphereGeometry(1, 32, 24);
    const skull = new THREE.Mesh(skullGeometry, depthMaterial); skull.renderOrder = -10; root.add(skull);
    let width = 1, height = 1;
    const resize = () => {
      width = Math.max(1, Math.round(container.clientWidth)); height = Math.max(1, Math.round(container.clientHeight));
      background.width = width; background.height = height;
      renderer.setSize(width, height, false);
      camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2; camera.updateProjectionMatrix();
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(container);
    const ctx = background.getContext('2d');
    let lastVideoTime = -1, lastUi = 0, counted = 0, fpsStart = performance.now(), currentFps = 0;
    let lostFrames = 0;
    const measurementSampler = new FaceMeasurementSampler();
    const poseStabilizer = new StableEyewearPose();
    const processFrame = () => {
      if (cancelled) return;
      frame = requestAnimationFrame(processFrame);
      if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      // Draw the exact camera frame used by inference, then its fitted overlay.
      const cover = Math.max(width / video.videoWidth, height / video.videoHeight);
      const sourceWidth = video.videoWidth * cover, sourceHeight = video.videoHeight * cover;
      ctx?.drawImage(video, (width - sourceWidth) / 2, (height - sourceHeight) / 2, sourceWidth, sourceHeight);
      try {
        const result = landmarker.detectForVideo(video, now);
        const landmarks = result.faceLandmarks[0];
        const rawPose = landmarks ? eyewearPose(landmarks, sourceWidth, sourceHeight) : null;
        const pose = rawPose ? poseStabilizer.update(rawPose, now) : null;
        const rig = rigRef.current;
        const fit = propsRef.current.calibration;
        if (pose && rig) {
          lostFrames = 0;
          const scale = rig.fittedScale(pose.eyeSpan, pose.faceWidth, pose.isFrontal) * (fit?.scale ?? 1) * (63 + (fit?.ipdOffsetMm ?? 0)) / 63;
          root.position.copy(pose.position);
          root.position.addScaledVector(pose.yAxis, (fit?.verticalOffsetMm ?? 0) * pose.eyeSpan / 63);
          root.position.addScaledVector(pose.zAxis, (fit?.depthOffsetMm ?? 0) * pose.eyeSpan / 63);
          root.quaternion.copy(pose.quaternion); root.scale.setScalar(scale); root.updateMatrixWorld(true);
          const leftEar = root.worldToLocal(pose.leftTemple.clone());
          const rightEar = root.worldToLocal(pose.rightTemple.clone());
          rig.fitTemples(leftEar, rightEar);
          // A measured face surface hides the far branch. A skull volume fills
          // the open back of the face mesh, including the forehead/hair region.
          const faceWidth = leftEar.distanceTo(rightEar);
          skull.position.set((leftEar.x + rightEar.x) / 2, 0.6, (leftEar.z + rightEar.z) / 2 - faceWidth * 0.13);
          skull.scale.set(faceWidth * 0.49, faceWidth * 0.70, faceWidth * 0.46);
          root.visible = true; faceMask.visible = true;
          const positions = faceGeometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < 468; i++) {
            const p = landmarkWorld(landmarks[i], sourceWidth, sourceHeight);
            positions.setXYZ(i, p.x, p.y, p.z - pose.eyeSpan * 0.008);
          }
          positions.needsUpdate = true;
          depthMaterial.colorWrite = !!propsRef.current.debugOccluder;
          depthMaterial.wireframe = !!propsRef.current.debugOccluder;
          depthMaterial.color.set(0x22cc88);
          if (propsRef.current.showLandmarks && ctx) {
            ctx.fillStyle = '#22cc88';
            for (const i of [33, 133, 263, 362, 168, 127, 356]) {
              const p = landmarkWorld(landmarks[i], sourceWidth, sourceHeight); ctx.fillRect(p.x + width / 2 - 2, height / 2 - p.y - 2, 4, 4);
            }
          }
          if (now - lastUi > 150) {
            setDetected(true);
            const angles = new THREE.Euler().setFromQuaternion(pose.quaternion, 'YXZ');
            const frontal = Math.abs(angles.y) < .3 && Math.abs(angles.x) < .3 && Math.abs(angles.z) < .3;
            if (!frontal) measurementSampler.reset();
            const faceMeasurements = frontal ? measurementSampler.add(landmarks, sourceWidth, sourceHeight) : undefined;
            propsRef.current.onStatsUpdate?.({ fps: currentFps, faceDetected: true, landmarksCount: landmarks.length,
              estimatedIpdMm: 63 + (fit?.ipdOffsetMm ?? 0), trackingConfidence: 0, depthOcclusionActive: true,
              headYaw: Math.round(THREE.MathUtils.radToDeg(angles.y)), headPitch: Math.round(THREE.MathUtils.radToDeg(angles.x)),
              headRoll: Math.round(THREE.MathUtils.radToDeg(angles.z)), faceMeasurements, faceWidthMm: Math.round(faceWidth / rig.eyeDistance * 63) });
            lastUi = now;
          }
        } else {
          root.visible = false; faceMask.visible = false;
          if (++lostFrames === 1) {
            setDetected(false); measurementSampler.reset(); poseStabilizer.reset();
            propsRef.current.onStatsUpdate?.({ fps: currentFps, faceDetected: false, landmarksCount: 0, estimatedIpdMm: 63,
              trackingConfidence: 0, depthOcclusionActive: false, headYaw: 0, headPitch: 0, headRoll: 0 });
          }
        }
        renderer.render(scene, camera);
        counted++;
        if (now - fpsStart > 1000) { currentFps = Math.round(counted * 1000 / (now - fpsStart)); setFps(currentFps); counted = 0; fpsStart = now; }
      } catch (e) {
        root.visible = false; faceMask.visible = false; renderer.clear();
        setError(e instanceof Error ? e.message : 'Face tracking failed');
        cancelAnimationFrame(frame);
      }
    };
    const start = async () => {
      await Promise.resolve(); if (cancelled) return;
      setError(''); setStatus('Starting camera…'); propsRef.current.onLoadingChange?.(true);
      startupTimer = window.setTimeout(() => { if (!cancelled) setStatus('Allow camera access in the browser'); }, 12000);
      try {
        const indices = await fetch('/tracking/face-triangles.json').then(response => { if (!response.ok) throw new Error('Face surface could not load'); return response.json(); });
        if (cancelled) return; faceGeometry.setIndex(indices);
        stream = await openTryOnCamera(() => cancelled);
        if (!stream) return;
        video.srcObject = stream; await video.play();
        if (cancelled) return; setStatus('Loading face landmarks…');
        sanitizeEmscriptenEnvironment();
        landmarker = await createFaceDetector('VIDEO');
        if (cancelled) { landmarker.close(); return; }
        window.clearTimeout(startupTimer); setStatus(''); propsRef.current.onLoadingChange?.(false); processFrame();
      } catch (e) {
        stream?.getTracks().forEach(track => track.stop()); video.pause(); video.srcObject = null;
        window.clearTimeout(startupTimer);
        if (!cancelled) { setError(cameraErrorMessage(e)); setStatus(''); propsRef.current.onLoadingChange?.(false); }
      }
    };
    start();
    return () => {
      cancelled = true; window.clearTimeout(startupTimer); cancelAnimationFrame(frame); observer.disconnect();
      stream?.getTracks().forEach(track => track.stop()); video.pause(); video.srcObject = null;
      landmarker?.close(); faceGeometry.dispose(); skullGeometry.dispose(); depthMaterial.dispose(); environment?.dispose(); renderer.dispose();
      rigRef.current?.dispose(); rigRef.current = null; rootRef.current = null; rendererRef.current = null; sceneRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    const root = rootRef.current;
    if (!root) return;
    loadEyewearCADModel(props.product, props.product.variants[props.variantIndex] || props.product.variants[0]).then(model => {
      const rig = new EyewearRig(model, props.product.id);
      if (cancelled) { rig.dispose(); return; }
      const old = rigRef.current;
      if (old) { root.remove(old.group); old.dispose(); }
      rigRef.current = rig; root.add(rig.group);
      overlayRef.current?.setAttribute('data-loaded-model', props.product.id);
    }).catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [props.product, props.variantIndex, retry]);

  useEffect(() => {
    const renderer = rendererRef.current, scene = sceneRef.current;
    if (!renderer || !scene) return;
    const env = generateStudioEnvironment(renderer, props.lightingPreset || 'studio'); scene.environment = env.texture;
    return () => env.dispose();
  }, [props.lightingPreset, retry]);

  const lastSnapshotRef = useRef<number>(0);
  useEffect(() => {
    if (!props.snapshotTrigger || props.snapshotTrigger === lastSnapshotRef.current || !backgroundRef.current || !overlayRef.current) return;
    lastSnapshotRef.current = props.snapshotTrigger;
    const output = document.createElement('canvas'); const background = backgroundRef.current;
    output.width = background.width; output.height = background.height;
    const ctx = output.getContext('2d'); if (!ctx) return;
    if (props.mirror !== false) { ctx.translate(output.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(background, 0, 0, output.width, output.height); ctx.drawImage(overlayRef.current, 0, 0, output.width, output.height);
    props.onSnapshotReady?.(output.toDataURL('image/png'));
  }, [props.snapshotTrigger, props.mirror]);

  const flip = props.mirror !== false ? '-scale-x-100' : '';
  return <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
    <canvas ref={backgroundRef} id="landmarkCameraCanvas" className={`absolute inset-0 w-full h-full ${flip}`} />
    <canvas ref={overlayRef} id="landmarkGlassesCanvas" className={`absolute inset-0 w-full h-full pointer-events-none ${flip}`} />
    {!status && !error && <div className="absolute top-4 left-4 z-20 rounded-full bg-black/75 px-3 py-2 text-xs text-white">
      <span className={detected ? 'text-emerald-400' : 'text-amber-400'}>●</span> {detected ? 'Face tracking' : 'Face the camera'} · {fps} FPS
    </div>}
    {status && !error && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 text-sm text-white">{status}</div>}
    {error && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-white">
      <p className="text-sm text-center" role="alert">{error}</p><button className="rounded-lg bg-white px-4 py-2 text-black" onClick={() => setRetry(value => value + 1)}>Retry camera</button><button className="text-sm underline" onClick={() => props.onSwitchMode?.('photo')}>Use a photo instead</button>
    </div>}
  </div>;
};
