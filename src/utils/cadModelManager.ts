import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SunglassesProduct, ColorVariant } from '../types';
import { createSunglasses3D } from './glasses3d';
import { loadImportedEyewear } from './importedEyewear';

interface CachedModel {
  originalScene: THREE.Group;
  normalizedScene: THREE.Group;
}

// In-memory cache for loaded glTF models
const modelCache: Map<string, CachedModel> = new Map();
const loader = new GLTFLoader();

/**
 * Standard outer hinge width in Three.js coordinate units.
 * Exactly synchronized with HeadPoseEstimator.MODEL_TEMPLE_WIDTH = 8.8.
 */
export const MODEL_TEMPLE_WIDTH = 8.8;

/**
 * Map product category or ID to model path in public/models/
 */
function getModelPath(product: SunglassesProduct): string {
  if (product.category === 'Wayfarer') return '/models/jeeliz/frames.json';
  if (product.category === 'Hexagonal') return '/models/hexagonal/scene.gltf';
  if (product.category === 'Prada') return '/models/prada_silver.glb';
  if (product.category === 'Matsuda') return '/models/matsuda.glb';
  if (product.category === 'RayBanNew') return '/models/ray-ban_new.glb';
  return '/models/aviator/premium_sunglasses.glb';
}

// Explicit source mesh identities are shared by normalization and material assignment.
function isLensMesh(mesh: THREE.Mesh, product: SunglassesProduct): boolean {
  const node = mesh.name.toLowerCase();
  const material = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.name.toLowerCase()).join(' ');
  const explicit: Record<string, string[]> = {
    Prada: ['obj26_mat3_0', 'obj27_mat3_0', 'obj28_mat4_0'],
    RayBanNew: ['obj9_mat2_0', 'obj10_mat2_0', 'obj11_mat3_0', 'obj12_mat4_0'],
    Matsuda: ['object_14'],
    Hexagonal: ['object_6'],
  };
  if (explicit[product.category]) return explicit[product.category].includes(node);
  return /lens|glass/i.test(node + ' ' + material + ' ' + mesh.parent?.name) && !/pad/i.test(node + material);
}

/**
 * Loads and normalizes a real 3D CAD eyewear model:
 * - Centers the model at (0, 0, 0)
 * - Scales outer hinge width to exactly MODEL_TEMPLE_WIDTH (8.8 units)
 * - Applies PBR materials for selected frame finish and lens color
 */
export async function loadEyewearCADModel(
  product: SunglassesProduct,
  variant: ColorVariant,
  clippingPlanes?: THREE.Plane[]
): Promise<THREE.Group> {
  if (product.model) return loadImportedEyewear(product.model);
  const modelPath = getModelPath(product);
  if (['Round', 'Sport', 'Cat-Eye'].includes(product.category)) {
    return createSunglasses3D({ ...product, variants: [variant], activeVariantIndex: 0 }, clippingPlanes);
  }

  let cached = modelCache.get(modelPath);

  if (!cached) {
    try {
      const gltf = modelPath.endsWith('.json') ? await loadJeelizModel() : await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        loader.load(
          modelPath,
          (loadedGltf) => resolve(loadedGltf),
          undefined,
          (err) => reject(err)
        );
      });

      const rawScene = gltf.scene;


      // 1. Calculate bounding box of the oriented model
      const bbox = new THREE.Box3().setFromObject(rawScene);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());
      // Lens geometry defines the fitting origin. Ear hooks must not move it.
      const lensBox = new THREE.Box3();
      rawScene.traverse((object) => {
        if (object instanceof THREE.Mesh && isLensMesh(object, product)) {
          lensBox.union(new THREE.Box3().setFromObject(object));
        }
      });
      const lensCenter = lensBox.isEmpty() ? center : lensBox.getCenter(new THREE.Vector3());

      // 2. Normalize width to MODEL_TEMPLE_WIDTH (8.8 units)
      const scaleFactor = size.x > 0 ? MODEL_TEMPLE_WIDTH / size.x : 1.0;

      // 3. Create container and center at (0, 0, 0)
      const normalizedGroup = new THREE.Group();
      normalizedGroup.name = `normalized-${product.category}`;

      rawScene.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      rawScene.position.set(
        -lensCenter.x * scaleFactor,
        -lensCenter.y * scaleFactor,
        -lensCenter.z * scaleFactor
      );
      rawScene.updateMatrixWorld(true);

      normalizedGroup.add(rawScene);

      cached = {
        originalScene: rawScene,
        normalizedScene: normalizedGroup,
      };

      modelCache.set(modelPath, cached);
    } catch (err) {
      console.warn(`Could not load eyewear model from ${modelPath}:`, err);
      return createFallbackEyewear(product, variant, clippingPlanes);
    }
  }

  // Clone normalized model for this instance
  const instance = cached.normalizedScene.clone(true);
  applyPBRMaterials(instance, product, variant, clippingPlanes);
  return instance;
}

async function loadJeelizModel(): Promise<{ scene: THREE.Group }> {
  const geometryLoader = new THREE.BufferGeometryLoader();
  const [frames, lenses] = await Promise.all([
    geometryLoader.loadAsync('/models/jeeliz/frames.json'),
    geometryLoader.loadAsync('/models/jeeliz/lenses.json'),
  ]);
  const scene = new THREE.Group();
  for (const [name, geometry] of [['frames', frames], ['lenses', lenses]] as const) {
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = name; scene.add(mesh);
  }
  return { scene };
}

/**
 * Applies authentic PBR materials (optical crown glass, polished metal/acetate, silicone pads)
 * to the glTF mesh nodes based on model metadata.
 */
/**
 * Applies authentic PBR materials (optical crown glass, hand-polished acetate, electroplated metal, silicone pads)
 * to the glTF mesh nodes based on model metadata and category.
 */
function applyPBRMaterials(
  root: THREE.Group,
  product: SunglassesProduct,
  variant: ColorVariant,
  clippingPlanes?: THREE.Plane[]
): void {
  const isMetal =
    product.frameMaterial.toLowerCase().includes('gold') ||
    product.frameMaterial.toLowerCase().includes('metal') ||
    product.frameMaterial.toLowerCase().includes('alloy') ||
    product.category === 'Aviator' ||
    product.category === 'Hexagonal' ||
    product.category === 'Round';

  // 1. Physical Frame Material (High-end electroplated metal or piano-lacquer acetate)
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(variant.frameHex),
    metalness: isMetal ? 0.96 : 0.02,
    roughness: Math.max(0.16, variant.roughness),
    clearcoat: isMetal ? 0.40 : 0.98, // Electroplating protective coat / hand-polished acetate
    clearcoatRoughness: 0.02,
    reflectivity: isMetal ? 0.95 : 0.50,
    envMapIntensity: isMetal ? 1.2 : 0.8,
  });

  // 2. Temple Arm Material (with Hardware Ear Clipping Planes for coronal occlusion)
  const templeMaterial = frameMaterial.clone();
  if (clippingPlanes && clippingPlanes.length > 0) {
    templeMaterial.clippingPlanes = clippingPlanes;
    templeMaterial.clipShadows = true;
  }

  // 3. FittingBox & Luxottica Standard: Physical Optical Crown Glass Lens Material
  const isMirrored = variant.name.toLowerCase().includes('mirror') || variant.name.toLowerCase().includes('flash');
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(variant.lensHex),
    transmission: 0, // Physical light transmission through crown glass!
    ior: 1.523,                              // Optical Crown Glass refractive index
    thickness: 0.32,                         // Real lens curvature thickness in centimeters
    roughness: 0.015,                        // Mirror polish
    metalness: isMirrored ? 0.70 : 0.06,     // Polarized metallic reflection sheen
    clearcoat: 1.0,                          // Double-surface glass exterior glint
    clearcoatRoughness: 0.015,
    reflectivity: 0.95,
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#ffffff'),
    envMapIntensity: isMirrored ? 1.3 : 0.55,
    transparent: true,
    opacity: isMirrored ? 0.88 : 0.72, // Alpha blends with the camera layer; transmission cannot sample a separate canvas.
    side: THREE.DoubleSide,
    depthWrite: false,                       // Preserves visibility of natural eyes underneath
  });

  // 4. Soft Silicone Nose Pad Material
  const nosePadMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F8FAFC'),
    transmission: 0.80,
    opacity: 0.85,
    roughness: 0.22,
    ior: 1.45,
    transparent: true,
    depthWrite: false,
  });

  // 5. Matte Rubber / Acetate Ear Sock Material
  const earSockMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1E293B'),
    roughness: 0.45,
    metalness: 0.04,
  });
  if (clippingPlanes && clippingPlanes.length > 0) {
    earSockMaterial.clippingPlanes = clippingPlanes;
  }

  // 6. Polished Chrome / Silver Rivet & Hinge Stud Material (Wayfarer diamond rivets)
  const silverRivetMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E2E8F0'),
    metalness: 0.98,
    roughness: 0.08,
    clearcoat: 1.0,
    envMapIntensity: 3.5,
  });

  // 7. Anatomical Contact Drop-Shadow beneath bridge and nose pads
  if (!root.getObjectByName('contact-shadow')) {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 64;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 32, 2, 64, 32, 54);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.18)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 64);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), shadowMat);
    shadowMesh.name = 'contact-shadow';
    shadowMesh.position.set(0, -0.42, -0.12);
    shadowMesh.rotation.x = -0.30;
    shadowMesh.renderOrder = 1;
    root.add(shadowMesh);
  }

  // 8. Traverse the glTF hierarchy and assign precision materials based on mesh node & material names
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.name === 'contact-shadow') return;
      const nodeName = (mesh.name || '').toLowerCase();
      const parentName = (mesh.parent?.name || '').toLowerCase();
      const origMatName = Array.isArray(mesh.material)
        ? (mesh.material[0]?.name || '').toLowerCase()
        : ((mesh.material as THREE.Material)?.name || '').toLowerCase();

      // Precision Lens Detection
      const isLens = isLensMesh(mesh, product);

      // Precision Temple Arm Detection
      const isTemple =
        nodeName.includes('arm') ||
        nodeName.includes('temple') ||
        nodeName.includes('side') ||
        parentName.includes('side') ||
        parentName.includes('plane001') ||
        (product.category === 'Wayfarer' && nodeName === 'object_6') ||
        (product.category === 'Hexagonal' && (nodeName === 'object_8' || nodeName === 'object_10'));

      // Ear sock / temple tips
      const isEarTip =
        nodeName.includes('ear') ||
        nodeName.includes('sock') ||
        nodeName.includes('tip') ||
        origMatName.includes('black_gloss');

      // Nose pads
      const isNosePad =
        nodeName.includes('pad') ||
        nodeName.includes('transparent') ||
        origMatName.includes('transparent');

      // Diamond rivets & metallic hinges
      const isRivet =
        origMatName === 'material_2' ||
        origMatName.includes('silver') ||
        nodeName.includes('rivet') ||
        nodeName.includes('stud') ||
        nodeName.includes('hinge');

      if (isLens) {
        mesh.userData.eyewearLens = true;
        if (!/lens/i.test(mesh.name)) mesh.name += '-lens';
        mesh.material = lensMaterial;
        mesh.renderOrder = 3; // Renders glass with physical transmission
      } else if (isNosePad) {
        mesh.material = nosePadMaterial;
        mesh.renderOrder = 2;
      } else if (isEarTip) {
        const original = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const texturedTip = earSockMaterial.clone();
        if (original instanceof THREE.MeshStandardMaterial) texturedTip.map = original.map;
        mesh.material = texturedTip;
        mesh.renderOrder = 2;
      } else if (isRivet) {
        mesh.material = silverRivetMaterial;
        mesh.renderOrder = 2;
      } else if (isTemple) {
        mesh.material = templeMaterial;
        mesh.renderOrder = 2;
      } else {
        mesh.material = frameMaterial;
        mesh.renderOrder = 2;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

/**
 * Fallback procedural model with calibrated dimensions in case network gltf load fails.
 */
function createFallbackEyewear(
  product: SunglassesProduct,
  variant: ColorVariant,
  clippingPlanes?: THREE.Plane[]
): THREE.Group {
  const root = new THREE.Group();
  root.name = `fallback-${product.id}`;

  const isMetal = product.category === 'Aviator' || product.category === 'Round';
  
  // Premium Physical Material for Frames
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(variant.frameHex),
    metalness: isMetal ? 0.95 : 0.1,
    roughness: isMetal ? 0.1 : 0.3,
    clearcoat: isMetal ? 0.1 : 0.8,
    clearcoatRoughness: 0.1,
    envMapIntensity: 2.0,
  });

  const templeMaterial = frameMaterial.clone();
  if (clippingPlanes && clippingPlanes.length > 0) {
    templeMaterial.clippingPlanes = clippingPlanes;
  }

  // Premium Glass Lenses
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(variant.lensHex),
    transmission: 0.9,
    ior: 1.52,
    thickness: 0.3,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    reflectivity: 0.9,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  // Base Lens Shape
  const shape = new THREE.Shape();
  if (product.category === 'Wayfarer') {
    shape.moveTo(-1.8, 1.2);
    shape.lineTo(1.8, 1.2);
    shape.quadraticCurveTo(2.0, 1.2, 2.0, 0);
    shape.quadraticCurveTo(1.5, -1.5, 0, -1.5);
    shape.quadraticCurveTo(-1.5, -1.5, -2.0, 0);
    shape.quadraticCurveTo(-2.0, 1.2, -1.8, 1.2);
  } else {
    // Aviator / Round
    shape.absellipse(0, 0, 1.9, 1.6, 0, Math.PI * 2, false, 0);
  }

  // 1. Extrude the 2D shape into a thick 3D Lens
  const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 };
  const lensGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  lensGeom.center();

  // Helper to bend geometry around the Z-axis (wrap-around face curve)
  const applyWrapCurve = (geom: THREE.BufferGeometry, offsetX: number) => {
    const pos = geom.attributes.position;
    const curveRadius = 12.0; // Base curve radius
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + offsetX;
      const z = pos.getZ(i);
      // Push back Z quadratically based on X distance from center to simulate face wrap
      pos.setZ(i, z - (x * x) / (2 * curveRadius));
    }
    geom.computeVertexNormals();
  };

  // Create Left & Right Lenses
  const leftLensGeom = lensGeom.clone();
  applyWrapCurve(leftLensGeom, -2.2);
  const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
  leftLens.position.set(-2.2, 0, 0);
  root.add(leftLens);

  const rightLensGeom = lensGeom.clone();
  applyWrapCurve(rightLensGeom, 2.2);
  const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
  rightLens.position.set(2.2, 0, 0);
  root.add(rightLens);

  // 2. Thick 3D Frame Rim (Using Extrude instead of simple tube)
  const rimShape = new THREE.Shape();
  const outerScale = isMetal ? 1.05 : 1.15;
  if (product.category === 'Wayfarer') {
    rimShape.moveTo(-1.8 * outerScale, 1.2 * outerScale);
    rimShape.lineTo(1.8 * outerScale, 1.2 * outerScale);
    rimShape.quadraticCurveTo(2.0 * outerScale, 1.2 * outerScale, 2.0 * outerScale, 0);
    rimShape.quadraticCurveTo(1.5 * outerScale, -1.5 * outerScale, 0, -1.5 * outerScale);
    rimShape.quadraticCurveTo(-1.5 * outerScale, -1.5 * outerScale, -2.0 * outerScale, 0);
    rimShape.quadraticCurveTo(-2.0 * outerScale, 1.2 * outerScale, -1.8 * outerScale, 1.2 * outerScale);
  } else {
    rimShape.absellipse(0, 0, 1.9 * outerScale, 1.6 * outerScale, 0, Math.PI * 2, false, 0);
  }
  const hole = new THREE.Path();
  if (product.category === 'Wayfarer') {
    hole.moveTo(-1.8, 1.2);
    hole.lineTo(1.8, 1.2);
    hole.quadraticCurveTo(2.0, 1.2, 2.0, 0);
    hole.quadraticCurveTo(1.5, -1.5, 0, -1.5);
    hole.quadraticCurveTo(-1.5, -1.5, -2.0, 0);
    hole.quadraticCurveTo(-2.0, 1.2, -1.8, 1.2);
  } else {
    hole.absellipse(0, 0, 1.9, 1.6, 0, Math.PI * 2, false, 0);
  }
  rimShape.holes.push(hole);

  const rimExtrudeSettings = { depth: isMetal ? 0.1 : 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };
  const rimGeom = new THREE.ExtrudeGeometry(rimShape, rimExtrudeSettings);
  rimGeom.center();

  const leftRimGeom = rimGeom.clone();
  applyWrapCurve(leftRimGeom, -2.2);
  const leftRim = new THREE.Mesh(leftRimGeom, frameMaterial);
  leftRim.position.set(-2.2, 0, 0);
  root.add(leftRim);

  const rightRimGeom = rimGeom.clone();
  applyWrapCurve(rightRimGeom, 2.2);
  const rightRim = new THREE.Mesh(rightRimGeom, frameMaterial);
  rightRim.position.set(2.2, 0, 0);
  root.add(rightRim);

  // 3. 3D Bridge
  const bridgeCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.8, 0.5, 0),
    new THREE.Vector3(0, 0.8, 0.1),
    new THREE.Vector3(0.8, 0.5, 0)
  );
  const bridgeGeom = new THREE.TubeGeometry(bridgeCurve, 16, isMetal ? 0.06 : 0.15, 8, false);
  applyWrapCurve(bridgeGeom, 0);
  root.add(new THREE.Mesh(bridgeGeom, frameMaterial));

  // 4. Premium Temple Arms with real depth
  const armDepth = isMetal ? 0.08 : 0.15;
  const armHeight = isMetal ? 0.1 : 0.3;
  const leftArmGeom = new THREE.BoxGeometry(0.1, armHeight, 10.0);
  leftArmGeom.translate(-4.3, 0.3, -5.0);
  const rightArmGeom = new THREE.BoxGeometry(0.1, armHeight, 10.0);
  rightArmGeom.translate(4.3, 0.3, -5.0);

  // Curve temple tips down behind ear
  const applyTempleDrop = (geom: THREE.BufferGeometry) => {
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      if (z < -6.0) {
        pos.setY(i, pos.getY(i) - Math.pow(Math.abs(z + 6.0), 1.5) * 0.1);
      }
    }
    geom.computeVertexNormals();
  };
  applyTempleDrop(leftArmGeom);
  applyTempleDrop(rightArmGeom);

  root.add(new THREE.Mesh(leftArmGeom, templeMaterial));
  root.add(new THREE.Mesh(rightArmGeom, templeMaterial));

  // Scale the whole procedural model up slightly to fit correctly on face bounding box
  root.scale.setScalar(1.0);

  return root;
}
