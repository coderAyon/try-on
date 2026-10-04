import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { JeelizPoseTracker, projectJeelizPose } from '../../utils/jeelizPose';
import { loadEyewearCADModel, MODEL_TEMPLE_WIDTH } from '../../utils/cadModelManager';
// @ts-ignore - official Jeeliz FaceFilter ES6 package
import { JEELIZFACEFILTER, NN_DEFAULT } from 'facefilter';
import {
  SunglassesProduct,
  TrackingStats,
  LightingPreset,
  CalibrationSettings,
  ColorVariant,
  TryOnMode,
} from '../../types';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';
import { RefreshCw, User, Box, ShieldAlert, Loader2, Crosshair, Check } from 'lucide-react';

type InitStatus = 'idle' | 'requesting' | 'initializing' | 'running' | 'error';

// Module-level: tracks the async destroy promise so re-init waits for full cleanup.
// Jeeliz is a singleton - calling init() before destroy() resolves causes ALREADY_INITIALIZED.
let _jeelizDestroyPromise: Promise<void> | null = null;

// Calibration anchor: stores the Jeeliz NDC click position of the user's nose bridge
interface CalibrationAnchor {
  x: number; // Face-local fit offset
  y: number;
  z: number;
}


export interface JeelizGlassesTryOnProps {
  product: SunglassesProduct;
  variantIndex: number;
  lightingPreset?: LightingPreset;
  calibration?: CalibrationSettings;
  showLandmarks?: boolean;
  debugOccluder?: boolean;
  mirror?: boolean;
  onStatsUpdate?: (stats: TrackingStats) => void;
  onSnapshotReady?: (dataUrl: string) => void;
  snapshotTrigger?: number;
  onLoadingChange?: (loading: boolean) => void;
  onSwitchMode?: (mode: TryOnMode) => void;
}

/**
 * Enterprise Jeeliz FaceFilter Virtual Glasses Try-On Component
 * Open-source equivalent to the FittingBox / Luxottica RTR engine.
 */
export const JeelizGlassesTryOn: React.FC<JeelizGlassesTryOnProps> = ({
  product,
  variantIndex,
  lightingPreset = 'studio',
  calibration = {
    scale: 1.0,
    verticalOffsetMm: 0,
    depthOffsetMm: 0,
    ipdOffsetMm: 0,
    mirror: true,
  },
  showLandmarks = false,
  debugOccluder = false,
  mirror = true,
  onStatsUpdate,
  onSnapshotReady,
  snapshotTrigger = 0,
  onLoadingChange,
  onSwitchMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const faceFilterCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const faceObjectRef = useRef<THREE.Object3D | null>(null);
  const occluderMeshRef = useRef<THREE.Group | null>(null);
  const glassesGroupRef = useRef<THREE.Group | null>(null);
  const glassesModelRef = useRef<THREE.Object3D | null>(null);
  const envTextureRef = useRef<THREE.WebGLRenderTarget | null>(null);

  // Calibration state: nose bridge click anchor
  const [calibAnchor, setCalibAnchor] = useState<CalibrationAnchor | null>(null);
  const [calibMode, setCalibMode] = useState<boolean>(false);
  const [calibDone, setCalibDone] = useState<boolean>(false);
  const calibAnchorRef = useRef<CalibrationAnchor | null>(null);

  // Tracking states
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>('idle');
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const targetPosition = useRef(new THREE.Vector3());
  const targetQuaternion = useRef(new THREE.Quaternion());
  const poseTrackerRef = useRef(new JeelizPoseTracker());
  const fpsRef = useRef(0);
  const lastStatsRef = useRef(0);
  const detectedRef = useRef(false);
  const currentVariant = product.variants[variantIndex] || product.variants[0];

  // Sync calibration anchor to ref so callbackTrack can read without closure issues
  useEffect(() => {
    calibAnchorRef.current = calibAnchor;
  }, [calibAnchor]);

  // =========================================================================
  // 1. Deep 3D Head Occluder — Skull + Ears + Nose bridge block
  //    Renders into depth buffer first (renderOrder 0) so temple arms
  //    disappear behind the head correctly.
  // =========================================================================
  const createHeadOccluder = useCallback((isDebug: boolean): THREE.Group => {
    const group = new THREE.Group();
    group.name = 'jeeliz-head-occluder';

    const occluderMaterial = new THREE.MeshBasicMaterial({
      colorWrite: isDebug,
      depthWrite: true,
      wireframe: isDebug,
      color: isDebug ? 0x00ff88 : 0x000000,
      transparent: isDebug,
      opacity: isDebug ? 0.35 : 1.0,
    });

    // Main cranium — elongated sphere
    const craniumGeom = new THREE.SphereGeometry(0.72, 32, 24);
    craniumGeom.scale(1.0, 1.28, 1.18);
    const cranium = new THREE.Mesh(craniumGeom, occluderMaterial);
    cranium.position.set(0, -0.04, -1.08);
    cranium.renderOrder = 0;
    group.add(cranium);

    // Left ear canal block
    const earGeom = new THREE.BoxGeometry(0.26, 0.48, 0.70);
    const leftEar = new THREE.Mesh(earGeom, occluderMaterial);
    leftEar.position.set(-0.65, -0.02, -0.96);
    leftEar.renderOrder = 0;
    group.add(leftEar);

    // Right ear canal block
    const rightEar = new THREE.Mesh(earGeom, occluderMaterial);
    rightEar.position.set(0.65, -0.02, -0.96);
    rightEar.renderOrder = 0;
    group.add(rightEar);

    // Nose bridge block — occlude bridge against skin surface
    const noseGeom = new THREE.BoxGeometry(0.18, 0.20, 0.22);
    const noseMesh = new THREE.Mesh(noseGeom, occluderMaterial);
    noseMesh.position.set(0, 0.04, -0.18);
    noseMesh.renderOrder = 0;
    group.add(noseMesh);

    return group;
  }, []);

  // Share the same detailed glTF geometry across live AR and the showroom.
  const loadEyewearModel = useCallback(async (variant: ColorVariant) => {
    const model = await loadEyewearCADModel(product, variant);
    model.scale.setScalar(1.18 / MODEL_TEMPLE_WIDTH);
    return model;
  }, [product]);
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;

  // =========================================================================
  // 5. Initialize Jeeliz FaceFilter + Three.js Engine
  // =========================================================================
  useEffect(() => {
    if (!faceFilterCanvasRef.current || !threeCanvasRef.current || !containerRef.current) return;

    let isCancelled = false;
    let engineStarted = false;
    let resolveEngineReady: () => void = () => {};
    const engineReady = new Promise<void>((resolve) => { resolveEngineReady = resolve; });
    poseTrackerRef.current.reset();
    detectedRef.current = false;
    const startupTimeout = window.setTimeout(() => {
      if (isCancelled) return;
      setErrorMessage('Camera permission is still pending. Allow camera access in your browser. If no permission prompt appears in this preview, open http://localhost:3000 in Chrome or Edge and choose Virtual Try-On, then click Allow.');
      setInitStatus('error');
      onLoadingChange?.(false);
    }, 15000);
    setErrorMessage(null);
    setInitStatus('requesting');
    onLoadingChange?.(true);

    const container = containerRef.current;
    const faceCanvas = faceFilterCanvasRef.current;
    const threeCanvas = threeCanvasRef.current;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;

    faceCanvas.width = width;
    faceCanvas.height = height;
    threeCanvas.width = width;
    threeCanvas.height = height;

    // Initialize Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: threeCanvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.sortObjects = true; // Required for depth-first occluder ordering
    rendererRef.current = renderer;

    // Lighting: Key + Rim + Fill for realistic face illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffecd0, 0.8);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xd4e8ff, 0.5);
    fillLight.position.set(0, -2, 3);
    scene.add(fillLight);

    // PMREM Studio Environment Map for realistic PBR lens + frame reflections
    const envRenderTarget = generateStudioEnvironment(renderer, lightingPreset);
    scene.environment = envRenderTarget.texture;
    envTextureRef.current = envRenderTarget;

    // Jeeliz Face Composite Tracking Object
    const faceObject = new THREE.Object3D();
    faceObject.frustumCulled = false;
    faceObject.visible = false;
    scene.add(faceObject);
    faceObjectRef.current = faceObject;

    // Requirement: Built-in 3D Head Occluder Mesh
    const occluder = createHeadOccluder(debugOccluder);
    faceObject.add(occluder);
    occluderMeshRef.current = occluder;

    // 3D Sunglasses Container
    const glassesGroup = new THREE.Group();
    faceObject.add(glassesGroup);
    glassesGroupRef.current = glassesGroup;

    // Initialize Jeeliz + Camera
    // IMPORTANT: We let Jeeliz manage getUserMedia internally.
    // Passing videoSettings.videoElement requires the video to already have valid
    // dimensions, which is unreliable. Jeeliz's built-in camera handling is robust.
    const initJeeliz = async () => {
      // React StrictMode replays effects. Do not initialize or destroy the
      // singleton during the discarded first setup.
      await Promise.resolve();
      if (isCancelled) return;
      // Must await any pending destroy from a previous mount/retry cycle.
      // destroy() is async; calling init() before it resolves → ALREADY_INITIALIZED error.
      if (_jeelizDestroyPromise) {
        console.log('[Jeeliz] Waiting for previous destroy…');
        await _jeelizDestroyPromise;
        _jeelizDestroyPromise = null;
      }
      if (isCancelled) return;

      try {
        engineStarted = true;
        const initResult = JEELIZFACEFILTER.init({
          canvas: faceCanvas, // direct element reference
          NNC: NN_DEFAULT,    // neural network weights (bundled)
          followZRot: true,
          maxFacesDetected: 1,

          // Called immediately when Jeeliz starts requesting camera permission
          onWebcamAsk: () => {
            if (!isCancelled) setInitStatus('requesting');
          },

          // Called when camera stream is successfully acquired
          onWebcamGet: () => {
            if (!isCancelled) {
              setInitStatus('initializing');
            }
          },

          callbackReady: (errCode: string | boolean, _spec?: unknown) => {
            resolveEngineReady();
            window.clearTimeout(startupTimeout);
            if (errCode) {
              console.error('[Jeeliz] Init error code:', errCode);
              if (isCancelled) return;
              // Map Jeeliz error codes to user-friendly messages
              const msgs: Record<string, string> = {
                WEBCAM_UNAVAILABLE:
                  'Camera not available. Make sure you have allowed camera access in your browser and no other app is using it. Click Retry.',
                ALREADY_INITIALIZED:
                  'The camera engine was already running. Click Retry to restart it.',
                GL_INCOMPATIBLE:
                  'Your browser does not support WebGL. Please use a modern browser like Chrome or Edge.',
                GLCONTEXT_LOST:
                  'WebGL context was lost. Click Retry.',
                INVALID_CANVASDIMENSIONS:
                  'Canvas has zero dimensions. Please resize the window and Retry.',
              };
              setErrorMessage(
                msgs[errCode as string] ||
                  `Camera engine error: ${errCode}. Click Retry.`
              );
              setInitStatus('error');
              onLoadingChange?.(false);
              return;
            }
            if (isCancelled) return;
            console.log('[Jeeliz] Camera + AI ready ✓');
            setInitStatus('running');
            onLoadingChange?.(false);
          },

          // Real-time tracking callback executed on every webcam frame
          callbackTrack: (detectState: {
            detected: number;
            x: number;
            y: number;
            s: number;
            rx: number;
            ry: number;
            rz: number;
          }) => {
            if (isCancelled) return;

            // FaceFilter tracks the webcam but does not draw its background for us.
            // Draw it on the lower canvas before rendering the transparent glasses.
            JEELIZFACEFILTER.render_video();

            // FPS calculation
            frameCountRef.current += 1;
            const now = performance.now();
            const elapsed = now - lastFrameTimeRef.current;
            let currentFps = fpsRef.current;
            if (elapsed >= 1000) {
              currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
              setFps(currentFps);
              fpsRef.current = currentFps;
              frameCountRef.current = 0;
              lastFrameTimeRef.current = now;
            }

            const validPose = [detectState.x, detectState.y, detectState.s, detectState.rx, detectState.ry, detectState.rz].every(Number.isFinite) && detectState.s > 0;
            const isDetected = validPose && detectState.detected > (detectedRef.current ? 0.58 : 0.72);
            detectedRef.current = isDetected;
            if (now - lastStatsRef.current >= 100) {
              setIsFaceDetected(isDetected);
              setConfidence(Math.round(detectState.detected * 100));
            }

            if (faceObjectRef.current && cameraRef.current) {
              if (isDetected) {
                const cam = cameraRef.current;
                const pose = poseTrackerRef.current.update(detectState, now);
                const D = projectJeelizPose(pose, cam, targetPosition.current, targetQuaternion.current);
                faceObjectRef.current.position.copy(targetPosition.current);
                faceObjectRef.current.quaternion.copy(targetQuaternion.current);

                if (glassesGroupRef.current) {
                  const fit = calibrationRef.current;
                  const anchor = calibAnchorRef.current;
                  // The lens plane is 0.4 units in front of the tracked cube centre.
                  // Calibration is local to the head, so it rotates with the wearer.
                  glassesGroupRef.current.position.set(
                    anchor?.x ?? 0,
                    (anchor?.y ?? -0.15) + fit.verticalOffsetMm * 0.0079,
                    (anchor?.z ?? 0.4) + fit.depthOffsetMm * 0.0079,
                  );
                  glassesGroupRef.current.scale.setScalar(fit.scale);
                }

                faceObjectRef.current.visible = true;

                if (now - lastStatsRef.current >= 100) {
                  lastStatsRef.current = now;
                  onStatsUpdate?.({
                  fps: currentFps,
                  faceDetected: true,
                  landmarksCount: 0,
                  estimatedIpdMm: Math.round(63 + calibrationRef.current.ipdOffsetMm),
                  trackingConfidence: Math.round(detectState.detected * 100),
                  depthOcclusionActive: true,
                  headYaw: Math.round((detectState.ry * 180) / Math.PI),
                  headPitch: Math.round((detectState.rx * 180) / Math.PI),
                  headRoll: Math.round((detectState.rz * 180) / Math.PI),
                  distanceCm: Math.round(D * 12.5),
                  faceWidthMm: 150,
                  });
                }
              } else {
                poseTrackerRef.current.reset();
                faceObjectRef.current.visible = false;
                if (now - lastStatsRef.current >= 100) {
                  lastStatsRef.current = now;
                  onStatsUpdate?.({
                  fps: currentFps,
                  faceDetected: false,
                  landmarksCount: 0,
                  estimatedIpdMm: 63 + calibrationRef.current.ipdOffsetMm,
                  trackingConfidence: 0,
                  depthOcclusionActive: true,
                  headYaw: 0,
                  headPitch: 0,
                  headRoll: 0,
                  });
                }
              }
            }

            // Render Three.js scene overlay
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
              rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
          },
        });
        if (initResult === false) {
          // init() returned false synchronously (e.g. ALREADY_INITIALIZED, NO_CANVASID)
          // callbackReady will still be called with the error code, so no extra action needed
          console.warn('[Jeeliz] init() returned false - likely ALREADY_INITIALIZED or missing canvas');
        }
      } catch (e: any) {
        resolveEngineReady();
        window.clearTimeout(startupTimeout);
        console.error('[Jeeliz] Uncaught init error:', e);
        if (!isCancelled) {
          setErrorMessage(`Failed to start camera engine: ${e?.message || String(e)}`);
          setInitStatus('error');
          onLoadingChange?.(false);
        }
      }
    };

    initJeeliz();

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          faceCanvas.width = w;
          faceCanvas.height = h;
          threeCanvas.width = w;
          threeCanvas.height = h;
          if (cameraRef.current && rendererRef.current) {
            cameraRef.current.aspect = w / h;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
          }
          try {
            JEELIZFACEFILTER.resize();
          } catch {
            // ignore
          }
        }
      }
    });

    resizeObserver.observe(container);

    // Refresh PMREM environment on lighting preset change within same mount
    // (handled separately in dedicated effect below)

    return () => {
      isCancelled = true;
      window.clearTimeout(startupTimeout);
      resizeObserver.disconnect();
      // destroy() is async - store the promise so the next init() can await it
      try {
        // Destroying during asynchronous webcam/NN setup makes the library's
        // pending callbacks access cleared video/canvas state. Wait for readiness.
        const d = engineStarted ? engineReady.then(() => JEELIZFACEFILTER.destroy()) : null;
        if (d && typeof d.then === 'function') {
          _jeelizDestroyPromise = d.catch(() => {});
        }
      } catch {
        _jeelizDestroyPromise = null;
      }
      // Three.js cleanup
      envRenderTarget?.dispose();
      renderer?.dispose();
    };
  }, [retryTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update Model / Variant
  useEffect(() => {
    if (!glassesGroupRef.current) return;
    let isCancelled = false;

    loadEyewearModel(currentVariant).then((model) => {
      if (isCancelled || !glassesGroupRef.current) return;
      if (glassesModelRef.current) {
        glassesGroupRef.current.remove(glassesModelRef.current);
      }
      glassesModelRef.current = model;
      glassesGroupRef.current.add(model);
    });

    return () => {
      isCancelled = true;
    };
  }, [variantIndex, currentVariant, loadEyewearModel, retryTrigger]);

  // Update Occluder Debug Mode
  useEffect(() => {
    if (!faceObjectRef.current) return;
    if (occluderMeshRef.current) {
      faceObjectRef.current.remove(occluderMeshRef.current);
    }
    const newOccluder = createHeadOccluder(debugOccluder);
    faceObjectRef.current.add(newOccluder);
    occluderMeshRef.current = newOccluder;
  }, [debugOccluder, createHeadOccluder]);

  // Update PMREM environment when lighting changes
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current) return;
    const env = generateStudioEnvironment(rendererRef.current, lightingPreset);
    sceneRef.current.environment = env.texture;
    const old = envTextureRef.current;
    envTextureRef.current = env;
    return () => { old?.dispose(); };
  }, [lightingPreset]);

  // Calibration: user clicks on the Jeeliz canvas to pin the nose bridge anchor
  const handleCalibClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!calibMode || !faceFilterCanvasRef.current) return;
      const rect = faceFilterCanvasRef.current.getBoundingClientRect();
      // Convert pixel click → Jeeliz NDC [-1, +1]
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1); // Y is flipped
      const root = faceObjectRef.current;
      const cam = cameraRef.current;
      const glasses = glassesGroupRef.current;
      if (!root?.visible || !cam || !glasses) return;
      root.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(mirror ? -ndcX : ndcX, ndcY), cam);
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
      const point = root.localToWorld(new THREE.Vector3(0, 0, glasses.position.z));
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
      const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return;
      const local = root.worldToLocal(hit);
      const anchor: CalibrationAnchor = {
        x: local.x,
        y: local.y - calibrationRef.current.verticalOffsetMm * 0.0079,
        z: glasses.position.z - calibrationRef.current.depthOffsetMm * 0.0079,
      };
      setCalibAnchor(anchor);
      calibAnchorRef.current = anchor;
      setCalibMode(false);
      setCalibDone(true);
      setTimeout(() => setCalibDone(false), 3000);
    },
    [calibMode, mirror]
  );

  // Snapshot trigger
  const lastSnapshotRef = useRef<number>(0);
  const onSnapshotReadyRef = useRef(onSnapshotReady);
  onSnapshotReadyRef.current = onSnapshotReady;

  useEffect(() => {
    if (snapshotTrigger === 0 || snapshotTrigger === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshotTrigger;
    const capture = () => {
      const compositeCanvas = document.createElement('canvas');
      const w = 1280;
      const h = 720;
      compositeCanvas.width = w;
      compositeCanvas.height = h;
      const ctx = compositeCanvas.getContext('2d');
      if (!ctx) return;

      if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      if (faceFilterCanvasRef.current) {
        ctx.drawImage(faceFilterCanvasRef.current, 0, 0, w, h);
      }
      if (threeCanvasRef.current) {
        ctx.drawImage(threeCanvasRef.current, 0, 0, w, h);
      }
      onSnapshotReadyRef.current?.(compositeCanvas.toDataURL('image/png'));
    };
    capture();
  }, [snapshotTrigger, mirror]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center select-none"
    >
      {/* Jeeliz FaceFilter GL Canvas (webcam + neural net) */}
      <canvas
        ref={faceFilterCanvasRef}
        id="jeeFaceFilterCanvas"
        onClick={handleCalibClick}
        className={`absolute inset-0 w-full h-full object-cover ${mirror ? '-scale-x-100' : ''} ${
          calibMode ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />

      {/* Three.js PBR Overlay Canvas */}
      <canvas
        ref={threeCanvasRef}
        id="threeJsCanvas"
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${mirror ? '-scale-x-100' : ''}`}
      />

      {/* Calibration mode overlay */}
      {calibMode && initStatus === 'running' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-end pb-8">
          <div className="flex flex-col items-center gap-2 bg-black/75 backdrop-blur-md px-5 py-3 rounded-2xl border border-amber-400/50 shadow-2xl mb-4">
            <Crosshair className="w-6 h-6 text-amber-400 animate-pulse" />
            <p className="text-amber-300 text-xs font-mono font-semibold tracking-wide">
              Click on your nose bridge to calibrate fit
            </p>
            <p className="text-neutral-400 text-[10px] font-mono">Look straight into the camera first</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-2 border-amber-400/60 rounded-full animate-ping opacity-40" />
            <div className="absolute w-8 h-8 border border-amber-400 rounded-full" />
            <div className="absolute w-0.5 h-8 bg-amber-400/60" />
            <div className="absolute w-8 h-0.5 bg-amber-400/60" />
          </div>
        </div>
      )}

      {/* Calibration success toast */}
      {calibDone && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-emerald-500/90 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs font-mono font-semibold shadow-xl border border-emerald-400/50 animate-bounce">
          <Check className="w-4 h-4" />
          <span>Nose bridge calibrated!</span>
        </div>
      )}

      {/* Loading / Initializing Overlay */}
      {(initStatus === 'requesting' || initStatus === 'initializing') && (
        <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white font-medium">
              {initStatus === 'requesting' ? 'Requesting camera access…' : 'Loading AI face engine…'}
            </p>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              {initStatus === 'requesting'
                ? 'Allow camera permission in your browser'
                : 'Initializing Jeeliz FaceFilter neural network'}
            </p>
          </div>
        </div>
      )}

      {/* Running HUD + Calibration Button */}
      {initStatus === 'running' && (
        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
          <div className="glass-panel px-3 py-1.5 rounded-full border border-neutral-700/80 bg-neutral-950/80 backdrop-blur-md flex items-center gap-2 text-xs font-mono pointer-events-none">
            <span
              className={`w-2 h-2 rounded-full ${
                isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-white font-semibold">
              {isFaceDetected ? 'Face Locked 6DOF' : 'Align Face to Camera'}
            </span>
            <span className="text-neutral-500">|</span>
            <span className="text-neutral-400">{fps} FPS</span>
            {isFaceDetected && (
              <>
                <span className="text-neutral-500">|</span>
                <span className="text-amber-400">{confidence}%</span>
              </>
            )}
          </div>

          {isFaceDetected && (
            <button
              onClick={() => { setCalibMode((v) => !v); setCalibDone(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono transition-all cursor-pointer ${
                calibMode
                  ? 'bg-amber-400 text-black font-bold shadow-lg'
                  : calibAnchor
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'glass-panel text-neutral-300 border border-neutral-700 hover:text-white hover:bg-neutral-800/80'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              {calibMode ? 'Click Nose Bridge…' : calibAnchor ? 'Re-calibrate Fit' : 'Calibrate Fit'}
            </button>
          )}
        </div>
      )}

      {/* Error Recovery Panel */}
      {initStatus === 'error' && errorMessage && (
        <div className="absolute inset-0 bg-neutral-950/95 z-30 flex flex-col items-center justify-center p-6 text-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-2xl">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-serif text-white">Camera Access Required</h3>
            <p className="text-xs text-neutral-400 font-mono leading-relaxed">{errorMessage}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setInitStatus('idle');
                setErrorMessage(null);
                setRetryTrigger((prev) => prev + 1);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Camera</span>
            </button>

            {onSwitchMode && (
              <>
                <button
                  onClick={() => onSwitchMode('photo')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 text-white font-medium text-xs hover:bg-neutral-700 transition-all cursor-pointer border border-neutral-700"
                >
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Try on Editorial Models</span>
                </button>

                <button
                  onClick={() => onSwitchMode('demo')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 text-white font-medium text-xs hover:bg-neutral-700 transition-all cursor-pointer border border-neutral-700"
                >
                  <Box className="w-3.5 h-3.5 text-blue-400" />
                  <span>360° Studio View</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
