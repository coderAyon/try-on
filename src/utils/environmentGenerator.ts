import * as THREE from 'three';
import { LightingPreset } from '../types';

/**
 * Creates a soft gradient canvas texture for studio softbox light panels
 */
function createSoftboxTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 125);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1.0)`);
    gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.85)`);
    gradient.addColorStop(0.85, `rgba(${r}, ${g}, ${b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates an HDRI-grade Pre-filtered Radiance Environment Map (PMREM)
 * featuring photorealistic studio softbox lightboxes, rim lights, and diffuse fill.
 * Eliminates external 50MB network dependencies while guaranteeing FittingBox optical reflections.
 */
export function generateStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  preset: LightingPreset
): THREE.WebGLRenderTarget {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();

  switch (preset) {
    case 'golden_hour': {
      // Warm Sunset / Golden Hour Studio setup
      envScene.background = new THREE.Color('#1a1208');

      // Key Warm Sun Softbox (Upper Right)
      const sunTexture = createSoftboxTexture(255, 180, 80);
      const sunMat = new THREE.MeshBasicMaterial({ map: sunTexture, transparent: true });
      const sunBox = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), sunMat);
      sunBox.position.set(12, 10, -8);
      sunBox.lookAt(0, 0, 0);
      envScene.add(sunBox);

      // Warm Amber Rim Light (Behind & Left)
      const rimTexture = createSoftboxTexture(245, 140, 40);
      const rimMat = new THREE.MeshBasicMaterial({ map: rimTexture, transparent: true });
      const rimBox = new THREE.Mesh(new THREE.PlaneGeometry(8, 20), rimMat);
      rimBox.position.set(-14, 6, -12);
      rimBox.lookAt(0, 0, 0);
      envScene.add(rimBox);

      // Sky Fill (Overhead)
      const skyLight = new THREE.HemisphereLight(0xffeedd, 0x332211, 2.5);
      envScene.add(skyLight);
      break;
    }

    case 'daylight': {
      // Crisp Natural Sunny Daylight Studio
      envScene.background = new THREE.Color('#0d1520');

      // Bright Daylight Key Light (High Sun)
      const dayTexture = createSoftboxTexture(255, 252, 245);
      const dayMat = new THREE.MeshBasicMaterial({ map: dayTexture, transparent: true });
      const dayBox = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), dayMat);
      dayBox.position.set(10, 16, 6);
      dayBox.lookAt(0, 0, 0);
      envScene.add(dayBox);

      // Cyan Sky Fill
      const skyTexture = createSoftboxTexture(180, 220, 255);
      const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture, transparent: true });
      const skyBox = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), skyMat);
      skyBox.position.set(-12, 8, -6);
      skyBox.lookAt(0, 0, 0);
      envScene.add(skyBox);

      const hemi = new THREE.HemisphereLight(0xddeeff, 0x223344, 2.8);
      envScene.add(hemi);
      break;
    }

    case 'noir_luxe': {
      // High-Contrast Runway / Noir Luxe
      envScene.background = new THREE.Color('#05070a');

      // Narrow Sharp Overhead Strip Light (Glossy frame highlight)
      const stripTexture = createSoftboxTexture(255, 255, 255);
      const stripMat = new THREE.MeshBasicMaterial({ map: stripTexture, transparent: true });
      const stripBox = new THREE.Mesh(new THREE.PlaneGeometry(28, 4), stripMat);
      stripBox.position.set(0, 14, 0);
      stripBox.lookAt(0, 0, 0);
      envScene.add(stripBox);

      // Dramatic Side Rim Accent
      const rimTexture = createSoftboxTexture(200, 210, 230);
      const rimMat = new THREE.MeshBasicMaterial({ map: rimTexture, transparent: true });
      const rimBox = new THREE.Mesh(new THREE.PlaneGeometry(6, 18), rimMat);
      rimBox.position.set(15, 0, -8);
      rimBox.lookAt(0, 0, 0);
      envScene.add(rimBox);

      const hemi = new THREE.HemisphereLight(0x445566, 0x05070a, 1.2);
      envScene.add(hemi);
      break;
    }

    default: {
      // Standard Luxury Eyewear Studio (Softbox 3-Point Lighting)
      envScene.background = new THREE.Color('#0b0e14');

      // Key Softbox Light (45 deg Upper Right)
      const keyTexture = createSoftboxTexture(255, 255, 255);
      const keyMat = new THREE.MeshBasicMaterial({ map: keyTexture, transparent: true });
      const keyBox = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), keyMat);
      keyBox.position.set(10, 8, 8);
      keyBox.lookAt(0, 0, 0);
      envScene.add(keyBox);

      // Fill Softbox Light (Soft diffuse cool light on Left)
      const fillTexture = createSoftboxTexture(220, 235, 255);
      const fillMat = new THREE.MeshBasicMaterial({ map: fillTexture, transparent: true });
      const fillBox = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), fillMat);
      fillBox.position.set(-12, 6, 6);
      fillBox.lookAt(0, 0, 0);
      envScene.add(fillBox);

      // Overhead Soft Diffuse Strip (Subtle metallic glint across top brow bar)
      const topTexture = createSoftboxTexture(255, 250, 240);
      const topMat = new THREE.MeshBasicMaterial({ map: topTexture, transparent: true });
      const topBox = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), topMat);
      topBox.position.set(0, 16, 2);
      topBox.lookAt(0, 0, 0);
      envScene.add(topBox);

      const hemi = new THREE.HemisphereLight(0xf0f4f8, 0x18202c, 2.2);
      envScene.add(hemi);
      break;
    }
  }

  const renderTarget = pmremGenerator.fromScene(envScene);
  pmremGenerator.dispose();

  return renderTarget;
}
