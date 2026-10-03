import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  SunglassesProduct,
  TrackingStats,
  LightingPreset,
  CalibrationSettings,
  TryOnMode,
} from '../../types';
import { LIGHTING_PRESETS } from '../../data/catalog';
import { createSunglasses3D, createHeadOccluderMesh } from '../../utils/glasses3d';
import { loadEyewearCADModel } from '../../utils/cadModelManager';
import { HeadPoseEstimator } from '../../utils/headPoseEstimator';
import { AdaptivePoseFilter } from '../../utils/adaptiveFilter';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';

interface WebGLCanvasProps {
  product: SunglassesProduct;
  variantIndex: number;
  mode: TryOnMode;
  mirror: boolean;
  lightingPreset: LightingPreset;
  calibration: CalibrationSettings;
  showLandmarks: boolean;
  debugOccluder: boolean;
  onStatsUpdate: (stats: TrackingStats) => void;
  onSnapshotReady: (dataUrl: string) => void;
  snapshotTrigger: number;
  customPhotoUrl: string | null;
  onLoadingChange: (loading: boolean) => void;
  splitPosition?: number;
}

export const WebGLCanvas: React.FC<WebGLCanvasProps> = ({
  product,
  variantIndex,
  mode,
  mirror,
  lightingPreset,
  calibration,
  showLandmarks,
  debugOccluder,
  onStatsUpdate,
  onSnapshotReady,
  snapshotTrigger,
  customPhotoUrl,
  onLoadingChange,
  splitPosition = 100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Interactive 360 rotation in demo mode
  const dragStartRef = useRef<{ isDragging: boolean; startX: number; startY: number; rotX: number; rotY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    rotX: 0,
    rotY: 0,
  });
  const userRotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const glassesGroupRef = useRef<THREE.Group | null>(null);
  const occluderGroupRef = useRef<THREE.Group | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Dynamic Hardware Clipping Plane (Coronal plane at ears)
  const earClippingPlaneRef = useRef<THREE.Plane>(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 10)
  );

  // Computer Vision Pose Estimator & Adaptive Jitter Filter
  const poseEstimatorRef = useRef<HeadPoseEstimator | null>(null);
  const adaptiveFilterRef = useRef<AdaptivePoseFilter>(new AdaptivePoseFilter());

  const [hasWebcamAccess, setHasWebcamAccess] = useState<boolean>(true);
  const faceMeshInstanceRef = useRef<unknown>(null);
  const cameraInstanceRef = useRef<unknown>(null);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const frameCounterRef = useRef<number>(0);

  // Dynamically synchronize camera FOV & aspect ratio with incoming stream dimensions
  const syncCameraDimensions = (
    containerWidth: number,
    containerHeight: number,
    sourceWidth?: number,
    sourceHeight?: number
  ) => {
    if (!cameraRef.current || !rendererRef.current) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const aspect = containerWidth / containerHeight;
    cameraRef.current.aspect = aspect;

    // Optical focal length matching standard webcam lens (f_y ~ H)
    // 16:9 produces ~44 deg vertical FOV, 4:3 produces ~49.5 deg vertical FOV
    const dynamicFov = aspect >= 1.6 ? 44.0 : 49.5;
    cameraRef.current.fov = dynamicFov;
    cameraRef.current.updateProjectionMatrix();

    if (poseEstimatorRef.current) {
      poseEstimatorRef.current.updateViewport(
        containerWidth,
        containerHeight,
        sourceWidth,
        sourceHeight
      );
    }
  };

  // 1. Initialize Three.js WebGL Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0); // Pin-hole camera at origin looking down -Z
    cameraRef.current = camera;

    // Instantiate HeadPoseEstimator
    poseEstimatorRef.current = new HeadPoseEstimator(camera);
    poseEstimatorRef.current.updateViewport(width, height, 1280, 720);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
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

    // Requirement: Enable local GPU clipping planes for temple arm trimming
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    // Studio Lighting setup matching Sunglass Hut / FittingBox standard
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Secondary subtle rim light for metallic frame glints
    const rimLight = new THREE.DirectionalLight(0xfff0e0, 0.7);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    // Initialize PMREM Studio Environment Map immediately so PBR materials never reflect black
    const initialEnv = generateStudioEnvironment(renderer, lightingPreset);
    scene.environment = initialEnv.texture;

    // 3D Head Occluder Mesh (renderOrder = 0, colorWrite = false, depthWrite = true)
    const occluder = createHeadOccluderMesh(debugOccluder);
    scene.add(occluder);
    occluderGroupRef.current = occluder;

    // Handle Viewport Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          syncCameraDimensions(w, h);
          rendererRef.current.setSize(w, h);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
    };
  }, []);

  // 2. Load / Update Real 3D CAD Eyewear Model when Product or Variant changes
  useEffect(() => {
    if (!sceneRef.current) return;
    let isCancelled = false;
    const variant = product.variants[variantIndex] || product.variants[0];

    loadEyewearCADModel(product, variant, [earClippingPlaneRef.current]).then((cadModel) => {
      if (isCancelled || !sceneRef.current) return;
      if (glassesGroupRef.current) {
        sceneRef.current.remove(glassesGroupRef.current);
      }
      cadModel.renderOrder = 1;
      sceneRef.current.add(cadModel);
      glassesGroupRef.current = cadModel;
    });

    return () => {
      isCancelled = true;
    };
  }, [product, variantIndex]);

  // 3. Re-create Head Occluder when debugOccluder toggle changes (Invisible mask vs Wireframe)
  useEffect(() => {
    if (!sceneRef.current) return;
    if (occluderGroupRef.current) {
      sceneRef.current.remove(occluderGroupRef.current);
    }
    const newOccluder = createHeadOccluderMesh(debugOccluder);
    sceneRef.current.add(newOccluder);
    occluderGroupRef.current = newOccluder;
  }, [debugOccluder]);

  // 4. Update Lighting Presets
  useEffect(() => {
    const config = LIGHTING_PRESETS.find((p) => p.id === lightingPreset);
    if (!config || !ambientLightRef.current || !dirLightRef.current || !rendererRef.current) return;

    ambientLightRef.current.intensity = config.ambientIntensity;
    ambientLightRef.current.color = new THREE.Color(config.ambientColor);

    dirLightRef.current.intensity = config.directionalIntensity;
    dirLightRef.current.color = new THREE.Color(config.directionalColor);
    dirLightRef.current.position.set(...config.directionalPosition);

    rendererRef.current.toneMappingExposure = config.exposure;

    // Phase 4: Dynamic HDRI Pre-filtered Radiance Environment Map (PMREM)
    if (sceneRef.current) {
      const envRenderTarget = generateStudioEnvironment(rendererRef.current, lightingPreset);
      sceneRef.current.environment = envRenderTarget.texture;

      return () => {
        envRenderTarget.dispose();
      };
    }
  }, [lightingPreset]);

  // 5. MediaPipe FaceMesh & Camera Stream Pipeline
  useEffect(() => {
    let isActive = true;
    onLoadingChange(true);

    const initTracking = async () => {
      if (mode === 'demo') {
        onLoadingChange(false);
        return;
      }

      try {
        const { FaceMesh } = await import('@mediapipe/face_mesh');

        if (!isActive) return;

        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // 478 landmarks with iris refinement
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
          selfieMode: mode === 'webcam' ? mirror : false,
        });

        faceMesh.onResults((results) => {
          if (!isActive) return;

          // FPS calculation
          frameCounterRef.current += 1;
          const now = performance.now();
          const elapsed = now - lastFpsTimeRef.current;
          let currentFps = 60;
          if (elapsed >= 1000) {
            currentFps = Math.round((frameCounterRef.current * 1000) / elapsed);
            frameCounterRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const rawLandmarks = results.multiFaceLandmarks[0];

            if (poseEstimatorRef.current) {
              const pose = poseEstimatorRef.current.estimatePose(
                rawLandmarks,
                calibration,
                mode === 'webcam' ? mirror : false
              );

              if (pose) {
                // In photo mode, apply pose directly without video smoothing lag
                const smoothed = mode === 'photo'
                  ? { position: pose.position, quaternion: pose.quaternion, scale: pose.scale }
                  : adaptiveFilterRef.current.update(
                      pose.position,
                      pose.quaternion,
                      pose.scale,
                      now
                    );

                // 1. Position & Orient Sunglasses
                if (glassesGroupRef.current) {
                  glassesGroupRef.current.position.copy(smoothed.position);
                  glassesGroupRef.current.quaternion.copy(smoothed.quaternion);
                  glassesGroupRef.current.scale.setScalar(smoothed.scale);
                  glassesGroupRef.current.visible = true;
                }

                // 2. Position & Orient 3D Head Occluder (Rigidly bound to head pose)
                if (occluderGroupRef.current) {
                  occluderGroupRef.current.position.copy(smoothed.position);
                  occluderGroupRef.current.quaternion.copy(smoothed.quaternion);
                  occluderGroupRef.current.scale.setScalar(smoothed.scale);
                  occluderGroupRef.current.visible = true;
                }

                // 3. Dynamic Hardware Ear Clipping Plane:
                // Ear coronal plane is at Z = -6.8 in head coordinates with normal pointing front (+Z).
                // Any temple geometry behind the ear is discarded by the GPU fragment shader.
                const earLocalPoint = new THREE.Vector3(0, 0, -6.8);
                const earLocalNormal = new THREE.Vector3(0, 0, 1);

                const earWorldNormal = earLocalNormal
                  .clone()
                  .applyQuaternion(smoothed.quaternion)
                  .normalize();

                const earWorldPoint = earLocalPoint
                  .clone()
                  .multiplyScalar(smoothed.scale)
                  .applyQuaternion(smoothed.quaternion)
                  .add(smoothed.position);

                earClippingPlaneRef.current.setFromNormalAndCoplanarPoint(
                  earWorldNormal,
                  earWorldPoint
                );

                // Telemetry status update
                onStatsUpdate({
                  fps: currentFps,
                  faceDetected: true,
                  landmarksCount: rawLandmarks.length,
                  estimatedIpdMm: pose.ipdMm,
                  trackingConfidence: 98,
                  depthOcclusionActive: true,
                  headYaw: pose.yawDeg,
                  headPitch: pose.pitchDeg,
                  headRoll: pose.rollDeg,
                  distanceCm: pose.distanceFromCameraCm,
                  faceWidthMm: pose.faceWidthMm,
                });

                // Academic & Capstone Visualizer: Draw 468/478 Landmark mesh + Anchor vectors
                if (showLandmarks && landmarkCanvasRef.current) {
                  drawLandmarksCanvas(
                    landmarkCanvasRef.current,
                    rawLandmarks,
                    mode === 'webcam' ? mirror : false,
                    pose.ipdMm
                  );
                }
              }
            }
          } else {
            // Face lost: reset filter to avoid interpolation lag upon re-acquisition
            adaptiveFilterRef.current.reset();
            poseEstimatorRef.current?.reset();

            if (glassesGroupRef.current) {
              glassesGroupRef.current.visible = false;
            }
            if (occluderGroupRef.current) {
              occluderGroupRef.current.visible = false;
            }

            if (elapsed >= 1000) {
              onStatsUpdate({
                fps: currentFps,
                faceDetected: false,
                landmarksCount: 0,
                estimatedIpdMm: 63 + calibration.ipdOffsetMm,
                trackingConfidence: 0,
                depthOcclusionActive: true,
                headYaw: 0,
                headPitch: 0,
                headRoll: 0,
              });
            }

            if (landmarkCanvasRef.current) {
              const ctx = landmarkCanvasRef.current.getContext('2d');
              ctx?.clearRect(0, 0, landmarkCanvasRef.current.width, landmarkCanvasRef.current.height);
            }
          }
        });

        faceMeshInstanceRef.current = faceMesh;

        if (mode === 'webcam' && videoRef.current) {
          const { Camera } = await import('@mediapipe/camera_utils');
          const cameraInstance = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && faceMeshInstanceRef.current) {
                const vw = videoRef.current.videoWidth || 1280;
                const vh = videoRef.current.videoHeight || 720;
                if (containerRef.current && cameraRef.current) {
                  const cw = containerRef.current.clientWidth;
                  const ch = containerRef.current.clientHeight;
                  if (cw > 0 && ch > 0) {
                    syncCameraDimensions(cw, ch, vw, vh);
                  }
                }

                await (faceMeshInstanceRef.current as { send: (input: { image: HTMLVideoElement }) => Promise<void> }).send({
                  image: videoRef.current,
                });
              }
            },
            width: 1280,
            height: 720,
          });

          await cameraInstance.start();
          cameraInstanceRef.current = cameraInstance;
          setHasWebcamAccess(true);
        } else if (mode === 'photo' && imageRef.current) {
          const processPhoto = async () => {
            if (!imageRef.current || !faceMeshInstanceRef.current || !isActive) return;
            const img = imageRef.current;
            const iw = img.naturalWidth || 1024;
            const ih = img.naturalHeight || 1024;
            if (containerRef.current && cameraRef.current) {
              const cw = containerRef.current.clientWidth;
              const ch = containerRef.current.clientHeight;
              if (cw > 0 && ch > 0) {
                syncCameraDimensions(cw, ch, iw, ih);
              }
            }
            try {
              await (faceMeshInstanceRef.current as { send: (input: { image: HTMLImageElement }) => Promise<void> }).send({
                image: img,
              });
            } catch (e) {
              console.warn('Photo faceMesh notice:', e);
            }
          };

          if (imageRef.current.complete && imageRef.current.naturalWidth > 0) {
            setTimeout(processPhoto, 120);
          } else {
            imageRef.current.onload = () => setTimeout(processPhoto, 120);
          }
        }
      } catch (err) {
        console.warn('Webcam or MediaPipe initialization notice:', err);
        setHasWebcamAccess(false);
      } finally {
        onLoadingChange(false);
      }
    };

    initTracking();

    return () => {
      isActive = false;
      if (cameraInstanceRef.current) {
        (cameraInstanceRef.current as { stop?: () => void }).stop?.();
      }
    };
  }, [mode, mirror, calibration, showLandmarks, customPhotoUrl]);

  // 6. Render Loop (Three.js WebGL & Demo Studio Animation)
  useEffect(() => {
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (mode === 'demo' && glassesGroupRef.current) {
        const elapsedTime = clock.getElapsedTime();
        const autoY = dragStartRef.current.isDragging ? 0 : Math.sin(elapsedTime * 0.5) * 0.35;
        const totalRotY = autoY + userRotRef.current.y;
        const totalRotX = userRotRef.current.x + (dragStartRef.current.isDragging ? 0 : Math.sin(elapsedTime * 0.8) * 0.05);

        glassesGroupRef.current.position.set(0, Math.sin(elapsedTime * 1.2) * 0.12, -7.0);
        glassesGroupRef.current.rotation.set(totalRotX, totalRotY, 0);
        glassesGroupRef.current.scale.setScalar(0.48 * calibration.scale);
        glassesGroupRef.current.visible = true;

        if (occluderGroupRef.current) {
          occluderGroupRef.current.position.copy(glassesGroupRef.current.position);
          occluderGroupRef.current.rotation.copy(glassesGroupRef.current.rotation);
          occluderGroupRef.current.scale.copy(glassesGroupRef.current.scale);
          occluderGroupRef.current.visible = false;
        }

        // Demo dynamic ear clipping plane
        const earWorldNormal = new THREE.Vector3(0, 0, 1)
          .applyEuler(glassesGroupRef.current.rotation)
          .normalize();
        const earWorldPoint = new THREE.Vector3(0, 0, -6.8)
          .multiplyScalar(glassesGroupRef.current.scale.x)
          .applyEuler(glassesGroupRef.current.rotation)
          .add(glassesGroupRef.current.position);

        earClippingPlaneRef.current.constant = 1000;

        // Demo stats
        onStatsUpdate({
          fps: 60,
          faceDetected: false,
          landmarksCount: 0,
          estimatedIpdMm: 63.5 + calibration.ipdOffsetMm,
          trackingConfidence: 0,
          depthOcclusionActive: false,
          headYaw: Math.round(Math.sin(elapsedTime * 0.6) * 20),
          headPitch: Math.round(Math.sin(elapsedTime * 0.8) * 8),
          headRoll: 0,
          distanceCm: 55,
          faceWidthMm: 138,
        });
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [mode, calibration]);

  // 7. Snapshot Capture Pipeline
  useEffect(() => {
    if (snapshotTrigger === 0) return;

    const captureComposite = () => {
      const compositeCanvas = document.createElement('canvas');
      const targetWidth = 1280;
      const targetHeight = 960;
      compositeCanvas.width = targetWidth;
      compositeCanvas.height = targetHeight;
      const ctx = compositeCanvas.getContext('2d');
      if (!ctx) return;

      // Background video or photo frame
      if (mode === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.save();
        if (mirror) {
          ctx.translate(targetWidth, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight);
        ctx.restore();
      } else if (mode === 'photo' && imageRef.current) {
        ctx.drawImage(imageRef.current, 0, 0, targetWidth, targetHeight);
      } else {
        // Luxury showroom backdrop
        const grad = ctx.createLinearGradient(0, 0, 0, targetHeight);
        grad.addColorStop(0, '#11151f');
        grad.addColorStop(1, '#07080a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // Draw WebGL layer over background
      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 0, 0, targetWidth, targetHeight);
      }

      const dataUrl = compositeCanvas.toDataURL('image/png');
      onSnapshotReady(dataUrl);
    };

    captureComposite();
  }, [snapshotTrigger]);

  // Academic Visualization: Highlights anchor landmarks
  const drawLandmarksCanvas = (
    canvas: HTMLCanvasElement,
    landmarks: Array<{ x: number; y: number; z?: number }>,
    isMirrored: boolean,
    ipdValueMm: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const getX = (lm: { x: number; y: number; z?: number }) => {
      const mapped = poseEstimatorRef.current
        ? poseEstimatorRef.current.mapLandmarkToCanvas(lm)
        : lm;
      return (isMirrored ? 1.0 - mapped.x : mapped.x) * canvas.width;
    };
    const getY = (lm: { x: number; y: number; z?: number }) => {
      const mapped = poseEstimatorRef.current
        ? poseEstimatorRef.current.mapLandmarkToCanvas(lm)
        : lm;
      return mapped.y * canvas.height;
    };

    // 1. Subtle green cloud for full 468 face mesh
    ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
    for (let i = 0; i < landmarks.length; i += 3) {
      const pt = landmarks[i];
      ctx.beginPath();
      ctx.arc(getX(pt), getY(pt), 1.2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 2. Highlight Key Anchors:
    const p33 = landmarks[33];
    const p133 = landmarks[133];
    const p362 = landmarks[362];
    const p263 = landmarks[263];
    const p168 = landmarks[168]; // Bridge
    const p6 = landmarks[6];     // Glabella
    const p4 = landmarks[4];     // Nose tip
    const p127 = landmarks[127]; // Left temple / ear root
    const p356 = landmarks[356]; // Right temple / ear root

    if (p33 && p133 && p362 && p263 && p168 && p4) {
      const leftEyeX = (getX(p33) + getX(p133)) / 2;
      const leftEyeY = (getY(p33) + getY(p133)) / 2;
      const rightEyeX = (getX(p362) + getX(p263)) / 2;
      const rightEyeY = (getY(p362) + getY(p263)) / 2;

      // Draw IPD Vector Line connecting Eye Centers
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(leftEyeX, leftEyeY);
      ctx.lineTo(rightEyeX, rightEyeY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Eye Center Reticles
      ctx.fillStyle = '#22D3EE';
      ctx.beginPath();
      ctx.arc(leftEyeX, leftEyeY, 4, 0, 2 * Math.PI);
      ctx.arc(rightEyeX, rightEyeY, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Draw IPD Label above eye line
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = '#22D3EE';
      const midEyeX = (leftEyeX + rightEyeX) / 2;
      const midEyeY = (leftEyeY + rightEyeY) / 2 - 12;
      ctx.fillText(`IPD: ${ipdValueMm}mm`, midEyeX - 30, midEyeY);

      // Draw Nose Bridge & Vertical Axis Line (Nose Tip -> Glabella)
      const tipX = getX(p4);
      const tipY = getY(p4);
      const bridgeX = getX(p168);
      const bridgeY = getY(p168);
      const glabellaX = p6 ? getX(p6) : bridgeX;
      const glabellaY = p6 ? getY(p6) : bridgeY;

      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(glabellaX, glabellaY);
      ctx.stroke();

      // Highlight Bridge Anchor Point (168)
      ctx.fillStyle = '#D4AF37';
      ctx.beginPath();
      ctx.arc(bridgeX, bridgeY, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#F5E6CA';
      ctx.fillText('Origin (168)', bridgeX + 8, bridgeY + 3);

      // Highlight Temporal Ear Landmarks (127 & 356) for Clipping Plane Proof
      if (p127 && p356) {
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(getX(p127), getY(p127), 4, 0, 2 * Math.PI);
        ctx.arc(getX(p356), getY(p356), 4, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillStyle = '#F43F5E';
        ctx.fillText('Ear (127)', getX(p127) - 45, getY(p127));
        ctx.fillText('Ear (356)', getX(p356) + 8, getY(p356));
      }
    }
  };

  // Interactive 360 drag handlers for demo showroom mode
  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'demo') return;
    dragStartRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      rotX: userRotRef.current.x,
      rotY: userRotRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mode !== 'demo' || !dragStartRef.current.isDragging) return;
    const deltaX = (e.clientX - dragStartRef.current.startX) * 0.008;
    const deltaY = (e.clientY - dragStartRef.current.startY) * 0.006;
    userRotRef.current = {
      x: Math.max(-0.6, Math.min(0.6, dragStartRef.current.rotX + deltaY)),
      y: dragStartRef.current.rotY + deltaX,
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (mode !== 'demo') return;
    dragStartRef.current.isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`relative w-full h-full bg-black overflow-hidden flex items-center justify-center ${
        mode === 'demo' ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* 1. HTML Video Stream Element (Webcam mode) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          mode === 'webcam' ? (mirror ? '-scale-x-100' : '') : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 2. Photo Mode Image Container */}
      {mode === 'photo' && customPhotoUrl && (
        <img
          ref={imageRef}
          src={customPhotoUrl}
          alt="Studio Try-On Portrait"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* 3. Demo Studio Background (When 3D Studio Head mode is selected) */}
      {mode === 'demo' && (
        <div className="absolute inset-0 bg-[#f2f1ef] flex items-end justify-center pb-5 pointer-events-none">
          <span className="text-xs text-neutral-600">Drag to inspect every angle</span>
        </div>
      )}

      {/* 4. Three.js WebGL Canvas Layer with Split-View Clipping */}
      <canvas
        ref={canvasRef}
        style={
          splitPosition < 100
            ? { clipPath: `polygon(${splitPosition}% 0, 100% 0, 100% 100%, ${splitPosition}% 100%)` }
            : undefined
        }
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* 5. 2D Landmarks Wireframe Debug Layer */}
      <canvas
        ref={landmarkCanvasRef}
        className={`absolute inset-0 w-full h-full pointer-events-none z-15 ${
          showLandmarks ? 'opacity-85' : 'opacity-0'
        }`}
      />
    </div>
  );
};
