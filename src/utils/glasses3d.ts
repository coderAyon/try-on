import * as THREE from 'three';
import { SunglassesProduct } from '../types';
import { HeadPoseEstimator } from './headPoseEstimator';

/**
 * Creates dynamic contact drop-shadow canvas texture beneath the nose bridge
 * for optical realism and grounding onto the nasal bone.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.22)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates an authentic Ray-Ban / Sunglass Hut optical lens decal texture
 * with the signature white logo printed in the upper temporal corner.
 */
function createLensBrandDecalTexture(isRightLens: boolean, brandName: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);

    if (isRightLens) {
      // Signature Ray-Ban logo in upper-right corner
      ctx.save();
      ctx.translate(415, 85);
      ctx.rotate(-0.06);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = 'italic 700 38px "Brush Script MT", "Playfair Display", "Times New Roman", cursive, serif';
      ctx.textAlign = 'right';
      ctx.fillText(brandName === 'Ray-Ban' ? 'Ray-Ban' : brandName.toUpperCase(), 0, 0);

      // Polarized "P" badge
      ctx.font = '700 24px "Inter", "Helvetica", sans-serif';
      ctx.fillText('P', 25, -4);
      ctx.restore();
    } else {
      // Laser etched subtle "RB" on left lens outer edge
      ctx.save();
      ctx.translate(75, 240);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.font = 'italic 600 26px "Times New Roman", serif';
      ctx.textAlign = 'left';
      ctx.fillText('RB', 0, 0);
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Contact shadow mesh positioned beneath nasal bridge
 */
function createNoseContactShadow(): THREE.Mesh {
  const shadowGeo = new THREE.PlaneGeometry(2.0, 1.0);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.name = 'nose-contact-shadow';
  shadowMesh.position.set(0, -0.45, -0.25);
  shadowMesh.rotation.x = Math.PI * 0.16;
  return shadowMesh;
}

/**
 * Generates a photorealistic curved meniscus lens geometry (Base-6 optical curve)
 * Curves smoothly in 3D (+Z center dome bulge) so environmental reflections
 * create realistic specular highlights as the head moves.
 */
function createCurvedMeniscusLensGeometry(
  shape: THREE.Shape,
  curveDepth: number = 0.28,
  segments: number = 48
): THREE.BufferGeometry {
  const shapeGeom = new THREE.ShapeGeometry(shape, segments);
  const pos = shapeGeom.attributes.position;
  shapeGeom.computeBoundingBox();
  const bbox = shapeGeom.boundingBox || new THREE.Box3();
  const centerX = (bbox.max.x + bbox.min.x) / 2;
  const centerY = (bbox.max.y + bbox.min.y) / 2;
  const maxRadius = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y) / 2;

  // Apply spherical base-curve displacement
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - centerX;
    const y = pos.getY(i) - centerY;
    const distSq = (x * x + y * y) / (maxRadius * maxRadius);
    const z = Math.max(0, 1.0 - distSq) * curveDepth;
    pos.setZ(i, z);
  }

  shapeGeom.computeVertexNormals();
  return shapeGeom;
}

/**
 * Creates photorealistic 3D sunglasses mesh matching Sunglass Hut / FittingBox specifications:
 * - Calibrated to HeadPoseEstimator.MODEL_TEMPLE_WIDTH = 8.8 units (outer hinge-to-hinge)
 * - Optical Meniscus curved lenses (Base-6 curvature)
 * - Semi-transparent crystal tinted glass (natural eyes show through!)
 * - Physically accurate PBR clearcoat & environment reflections
 * - 3D beveled frame rims, bridges, nose-pads, and ear-socks
 * - Dynamic hardware clipping planes for temple arms behind ears
 */
export function createSunglasses3D(
  product: SunglassesProduct,
  clippingPlanes?: THREE.Plane[]
): THREE.Group {
  const root = new THREE.Group();
  root.name = `sunglasses-${product.id}`;
  root.userData.bridgeExpansion = 0; // Calibrated procedural models preserve exact bridge clearance

  const variantIndex = product.activeVariantIndex || 0;
  const variant = product.variants[variantIndex] || product.variants[0];

  // 1. Frame PBR Material
  const isMetal =
    product.frameMaterial.toLowerCase().includes('gold') ||
    product.frameMaterial.toLowerCase().includes('metal') ||
    product.frameMaterial.toLowerCase().includes('alloy') ||
    product.frameMaterial.toLowerCase().includes('titanium') ||
    product.frameMaterial.toLowerCase().includes('monel') ||
    product.category === 'Aviator' ||
    product.category === 'Round' ||
    product.category === 'Hexagonal';

  const frameMetalness = isMetal ? 0.95 : 0.05;
  const frameRoughness = isMetal ? 0.18 : 0.22;

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(variant.frameHex),
    metalness: frameMetalness,
    roughness: frameRoughness,
    envMapIntensity: isMetal ? 3.0 : 1.6,
  });

  // Dedicated Temple Arm Material with Hardware Clipping Planes
  const templeArmMaterial = frameMaterial.clone();
  if (clippingPlanes && clippingPlanes.length > 0) {
    templeArmMaterial.clippingPlanes = clippingPlanes;
    templeArmMaterial.clipShadows = true;
  }

  // 2. Acetate Ear-Sock Material (Temple tips behind the ear)
  const earSockMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(isMetal ? '#2A1810' : variant.frameHex),
    roughness: 0.28,
    metalness: 0.05,
    envMapIntensity: 1.4,
  });
  if (clippingPlanes && clippingPlanes.length > 0) {
    earSockMaterial.clippingPlanes = clippingPlanes;
    earSockMaterial.clipShadows = true;
  }

  // 3. PHOTOREALISTIC LENS MATERIAL (Optical Crown Glass)
  const lensColor = new THREE.Color(variant.lensHex);
  const isMirrored = variant.name.toLowerCase().includes('mirror') || variant.name.toLowerCase().includes('flash');
  
  // Optical semi-transparency so eyes show through naturally:
  const lensOpacity = isMirrored ? 0.74 : 0.62;
  const lensRoughness = 0.02;
  const lensMetalness = isMirrored ? 0.70 : 0.12;

  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: lensColor,
    metalness: lensMetalness,
    roughness: lensRoughness,
    transparent: true,
    opacity: lensOpacity,
    ior: 1.52,                         // Optical crown glass
    reflectivity: 0.95,
    clearcoat: 1.0,                    // Crystal clear reflective exterior
    clearcoatRoughness: 0.02,
    envMapIntensity: isMirrored ? 3.6 : 2.8,
    side: THREE.DoubleSide,
    depthWrite: false,                 // Preserves natural eye visibility underneath
  });

  // 4. Silicone Translucent Nose Pad Material
  const padMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F8FAFC'),
    transmission: 0.75,
    roughness: 0.20,
    ior: 1.42,
    transparent: true,
    opacity: 0.70,
  });

  // 5. Contact Shadow beneath Nose Bridge
  root.add(createNoseContactShadow());

  // CALIBRATED PROPORTIONS:
  // Outer Hinge Width = 8.8 (x = -4.4 to +4.4)
  // Lens Centers = x = -2.15 and x = +2.15 (Span 4.3 units, matching eye distance)
  const halfHingeWidth = 4.4;
  const lensCenterDist = 4.3;
  const leftLensX = -lensCenterDist / 2; // -2.15
  const rightLensX = lensCenterDist / 2;  // +2.15

  // Build authentic eyewear geometries based on model category
  switch (product.category) {
    case 'Aviator': {
      // Iconic Ray-Ban RB3025 teardrop contour
      const teardropShape = new THREE.Shape();
      teardropShape.moveTo(0, 1.45);
      teardropShape.bezierCurveTo(1.65, 1.45, 1.95, 0.45, 1.80, -0.85);
      teardropShape.bezierCurveTo(1.60, -1.85, 0.85, -2.15, 0, -2.10);
      teardropShape.bezierCurveTo(-0.85, -2.15, -1.60, -1.85, -1.80, -0.85);
      teardropShape.bezierCurveTo(-1.95, 0.45, -1.65, 1.45, 0, 1.45);

      // Curved Meniscus Lenses (Base-6 Curve)
      const leftLensGeom = createCurvedMeniscusLensGeometry(teardropShape, 0.28, 48);
      const rightLensGeom = createCurvedMeniscusLensGeometry(teardropShape, 0.28, 48);

      const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
      leftLens.position.set(leftLensX, 0, 0.08);
      leftLens.scale.set(1.05, 1.05, 1.05);
      root.add(leftLens);

      const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
      rightLens.position.set(rightLensX, 0, 0.08);
      rightLens.scale.set(1.05, 1.05, 1.05);
      root.add(rightLens);

      // Authentic Ray-Ban Lens Decals
      const rightDecalMat = new THREE.MeshBasicMaterial({
        map: createLensBrandDecalTexture(true, product.brand),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rightDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), rightDecalMat);
      rightDecalPlane.position.set(rightLensX, -0.25, 0.35);
      root.add(rightDecalPlane);

      const leftDecalMat = new THREE.MeshBasicMaterial({
        map: createLensBrandDecalTexture(false, product.brand),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const leftDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), leftDecalMat);
      leftDecalPlane.position.set(leftLensX, -0.25, 0.35);
      root.add(leftDecalPlane);

      // 3D Teardrop Eye-Wire Rims (Double extruded beveled profile)
      const rimPoints = teardropShape.getPoints(60);
      const rimPath = new THREE.CatmullRomCurve3(
        rimPoints.map((p) => new THREE.Vector3(p.x * 1.05, p.y * 1.05, 0)),
        true
      );
      const rimGeom = new THREE.TubeGeometry(rimPath, 80, 0.09, 10, true);

      const leftRim = new THREE.Mesh(rimGeom, frameMaterial);
      leftRim.position.set(leftLensX, 0, 0.08);
      root.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeom, frameMaterial);
      rightRim.position.set(rightLensX, 0, 0.08);
      root.add(rightRim);

      // Extended Temporal Endpieces (Connecting lens to hinge at x = +-4.4)
      const leftLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(leftLensX - 1.85, 0.40, 0.08),
        new THREE.Vector3(-halfHingeWidth, 0.40, 0.0)
      );
      const leftLug = new THREE.Mesh(new THREE.TubeGeometry(leftLugCurve, 12, 0.10, 8, false), frameMaterial);
      root.add(leftLug);

      const rightLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(rightLensX + 1.85, 0.40, 0.08),
        new THREE.Vector3(halfHingeWidth, 0.40, 0.0)
      );
      const rightLug = new THREE.Mesh(new THREE.TubeGeometry(rightLugCurve, 12, 0.10, 8, false), frameMaterial);
      root.add(rightLug);

      // Iconic Double Bridge: Top Brow Bar (Sweat Bar) + Arched Lower Bridge
      const topBarCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-1.95, 1.48, 0.08),
        new THREE.Vector3(0, 1.55, 0.12),
        new THREE.Vector3(1.95, 1.48, 0.08)
      );
      const topBar = new THREE.Mesh(
        new THREE.TubeGeometry(topBarCurve, 24, 0.08, 8, false),
        frameMaterial
      );
      root.add(topBar);

      const bridgeCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-1.05, 0.70, 0.08),
        new THREE.Vector3(0, 0.95, 0.18),
        new THREE.Vector3(1.05, 0.70, 0.08)
      );
      const bridge = new THREE.Mesh(
        new THREE.TubeGeometry(bridgeCurve, 24, 0.08, 8, false),
        frameMaterial
      );
      root.add(bridge);

      // Central Soldering Join Lug
      const bridgeLugGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.48, 12);
      bridgeLugGeom.rotateX(Math.PI / 2);
      const bridgeLug = new THREE.Mesh(bridgeLugGeom, frameMaterial);
      bridgeLug.position.set(0, 0.95, 0.17);
      root.add(bridgeLug);

      // Realistic S-Shaped Pad Arms & Translucent Silicone Nose Pads
      const leftPadArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.95, 0.65, 0.06),
        new THREE.Vector3(-0.70, 0.22, -0.15),
        new THREE.Vector3(-0.58, 0.05, -0.32),
      ]);
      const leftPadArm = new THREE.Mesh(
        new THREE.TubeGeometry(leftPadArmCurve, 16, 0.045, 8, false),
        frameMaterial
      );
      root.add(leftPadArm);

      const rightPadArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.95, 0.65, 0.06),
        new THREE.Vector3(0.70, 0.22, -0.15),
        new THREE.Vector3(0.58, 0.05, -0.32),
      ]);
      const rightPadArm = new THREE.Mesh(
        new THREE.TubeGeometry(rightPadArmCurve, 16, 0.045, 8, false),
        frameMaterial
      );
      root.add(rightPadArm);

      // Anatomical Silicone Oval Pads
      const padGeom = new THREE.SphereGeometry(0.22, 16, 16);
      padGeom.scale(0.65, 1.45, 0.45);

      const leftPad = new THREE.Mesh(padGeom, padMaterial);
      leftPad.position.set(-0.55, 0.02, -0.34);
      leftPad.rotation.set(0.2, 0.4, -0.3);
      root.add(leftPad);

      const rightPad = new THREE.Mesh(padGeom, padMaterial);
      rightPad.position.set(0.55, 0.02, -0.34);
      rightPad.rotation.set(0.2, -0.4, 0.3);
      root.add(rightPad);
      break;
    }

    case 'Cat-Eye': {
      // Sculpted Cat-Eye: Anatomical Left and Right geometries (No negative scaling!)
      // Centers at x = +-2.30, lifted forward to z = 0.16 for cheek clearance
      const cateyeLensCenterX = 2.30;
      const cateyeLensZ = 0.16;

      // 1. Right Cat-Eye Lens Shape (CCW Winding)
      const rightShape = new THREE.Shape();
      rightShape.moveTo(-0.90, 0.40);
      rightShape.quadraticCurveTo(0.40, 1.10, 1.85, 1.45);
      rightShape.quadraticCurveTo(1.70, 0.00, 1.35, -0.95);
      rightShape.quadraticCurveTo(0.20, -1.25, -0.85, -0.75);
      rightShape.quadraticCurveTo(-0.95, -0.15, -0.90, 0.40);

      // 2. Left Cat-Eye Lens Shape (Directly mirrored in CCW Winding for true forward normals!)
      const leftShape = new THREE.Shape();
      leftShape.moveTo(0.90, 0.40);
      leftShape.quadraticCurveTo(0.95, -0.15, 0.85, -0.75);
      leftShape.quadraticCurveTo(-0.20, -1.25, -1.35, -0.95);
      leftShape.quadraticCurveTo(-1.70, 0.00, -1.85, 1.45);
      leftShape.quadraticCurveTo(-0.40, 1.10, 0.90, 0.40);

      // Meniscus Curved Lenses (Base-6 Optical Curve, normalMatrix det = +1.0)
      const rightLensGeom = createCurvedMeniscusLensGeometry(rightShape, 0.22, 48);
      const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
      rightLens.name = 'lens-cateye-right';
      rightLens.position.set(cateyeLensCenterX, 0, cateyeLensZ);
      root.add(rightLens);

      const leftLensGeom = createCurvedMeniscusLensGeometry(leftShape, 0.22, 48);
      const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
      leftLens.name = 'lens-cateye-left';
      leftLens.position.set(-cateyeLensCenterX, 0, cateyeLensZ);
      root.add(leftLens);

      // Authentic Ray-Ban Lens Decals
      const rightDecalMat = new THREE.MeshBasicMaterial({
        map: createLensBrandDecalTexture(true, product.brand),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rightDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), rightDecalMat);
      rightDecalPlane.position.set(cateyeLensCenterX, -0.15, cateyeLensZ + 0.25);
      root.add(rightDecalPlane);

      const leftDecalMat = new THREE.MeshBasicMaterial({
        map: createLensBrandDecalTexture(false, product.brand),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const leftDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), leftDecalMat);
      leftDecalPlane.position.set(-cateyeLensCenterX, -0.15, cateyeLensZ + 0.25);
      root.add(leftDecalPlane);

      // 3. Beveled Tubular Eye-Wire Rims (Both left and right have clean positive scales)
      const rightRimPoints = rightShape.getPoints(54);
      const rightRimPath = new THREE.CatmullRomCurve3(
        rightRimPoints.map((p) => new THREE.Vector3(p.x, p.y, 0)),
        true
      );
      const rightRimGeom = new THREE.TubeGeometry(rightRimPath, 64, 0.085, 8, true);
      const rightRim = new THREE.Mesh(rightRimGeom, frameMaterial);
      rightRim.name = 'rim-cateye-right';
      rightRim.position.set(cateyeLensCenterX, 0, cateyeLensZ);
      root.add(rightRim);

      const leftRimPoints = leftShape.getPoints(54);
      const leftRimPath = new THREE.CatmullRomCurve3(
        leftRimPoints.map((p) => new THREE.Vector3(p.x, p.y, 0)),
        true
      );
      const leftRimGeom = new THREE.TubeGeometry(leftRimPath, 64, 0.085, 8, true);
      const leftRim = new THREE.Mesh(leftRimGeom, frameMaterial);
      leftRim.name = 'rim-cateye-left';
      leftRim.position.set(-cateyeLensCenterX, 0, cateyeLensZ);
      root.add(leftRim);

      // 4. Arched Brow Bar Bridge connecting both inner nasal rims
      const bridgeCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-1.38, 0.40, cateyeLensZ),
        new THREE.Vector3(0, 0.78, cateyeLensZ + 0.12),
        new THREE.Vector3(1.38, 0.40, cateyeLensZ)
      );
      const bridge = new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.08, 8, false), frameMaterial);
      root.add(bridge);

      // 5. Extended Temporal Lugs connecting cat-eye wings to outer hinges (x = +-4.4)
      const leftLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(-cateyeLensCenterX - 1.80, 1.40, cateyeLensZ),
        new THREE.Vector3(-halfHingeWidth, 0.35, 0.0)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(leftLugCurve, 12, 0.085, 8, false), frameMaterial));

      const rightLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(cateyeLensCenterX + 1.80, 1.40, cateyeLensZ),
        new THREE.Vector3(halfHingeWidth, 0.35, 0.0)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(rightLugCurve, 12, 0.085, 8, false), frameMaterial));

      // 6. Anatomical S-Shaped Pad Arms & Translucent Silicone Nose Pads
      const leftPadArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.35, 0.20, cateyeLensZ - 0.02),
        new THREE.Vector3(-0.85, 0.00, -0.10),
        new THREE.Vector3(-0.62, -0.12, -0.22),
      ]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(leftPadArmCurve, 14, 0.04, 8, false), frameMaterial));

      const rightPadArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.35, 0.20, cateyeLensZ - 0.02),
        new THREE.Vector3(0.85, 0.00, -0.10),
        new THREE.Vector3(0.62, -0.12, -0.22),
      ]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(rightPadArmCurve, 14, 0.04, 8, false), frameMaterial));

      const padGeom = new THREE.SphereGeometry(0.18, 16, 16);
      padGeom.scale(0.65, 1.35, 0.45);

      const leftPad = new THREE.Mesh(padGeom, padMaterial);
      leftPad.position.set(-0.60, -0.12, -0.24);
      leftPad.rotation.set(0.2, 0.35, -0.25);
      root.add(leftPad);

      const rightPad = new THREE.Mesh(padGeom, padMaterial);
      rightPad.position.set(0.60, -0.12, -0.24);
      rightPad.rotation.set(0.2, -0.35, 0.25);
      root.add(rightPad);
      break;
    }

    case 'Wayfarer': {
      // Ray-Ban Original Wayfarer RB2140: Full facial coverage width 8.8
      const frameShape = new THREE.Shape();
      frameShape.moveTo(-halfHingeWidth, 1.70);
      frameShape.bezierCurveTo(-2.2, 1.80, 2.2, 1.80, halfHingeWidth, 1.70);
      frameShape.lineTo(3.85, -1.95);
      frameShape.bezierCurveTo(2.7, -2.05, 1.6, -1.65, 1.35, -1.60);
      frameShape.bezierCurveTo(0.8, -0.55, -0.8, -0.55, -1.35, -1.60);
      frameShape.bezierCurveTo(-1.6, -1.65, -2.7, -2.05, -3.85, -1.95);
      frameShape.closePath();

      // Left & Right Lens Cutout Holes
      const leftHole = new THREE.Path();
      leftHole.moveTo(-3.75, 1.25);
      leftHole.lineTo(-1.25, 1.25);
      leftHole.lineTo(-1.48, -1.30);
      leftHole.lineTo(-3.45, -1.40);
      leftHole.closePath();
      frameShape.holes.push(leftHole);

      const rightHole = new THREE.Path();
      rightHole.moveTo(1.25, 1.25);
      rightHole.lineTo(3.75, 1.25);
      rightHole.lineTo(3.45, -1.40);
      rightHole.lineTo(1.48, -1.30);
      rightHole.closePath();
      frameShape.holes.push(rightHole);

      const extrudeSettings = {
        depth: 0.45,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.10,
        bevelThickness: 0.10,
      };

      const frameMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(frameShape, extrudeSettings),
        frameMaterial
      );
      frameMesh.position.z = -0.22;
      frameMesh.rotation.x = 0.08; // Pantoscopic tilt
      root.add(frameMesh);

      // Curved Meniscus Lenses inside Wayfarer Eye-Rims
      const lensShape = new THREE.Shape();
      lensShape.moveTo(-1.20, 1.25);
      lensShape.lineTo(1.20, 1.25);
      lensShape.lineTo(1.05, -1.30);
      lensShape.lineTo(-1.05, -1.30);
      lensShape.closePath();

      const leftLensGeom = createCurvedMeniscusLensGeometry(lensShape, 0.20, 36);
      const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
      leftLens.position.set(-2.50, 0, 0.08);
      leftLens.rotation.x = 0.08;
      root.add(leftLens);

      const rightLensGeom = createCurvedMeniscusLensGeometry(lensShape, 0.20, 36);
      const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
      rightLens.position.set(2.50, 0, 0.08);
      rightLens.rotation.x = 0.08;
      root.add(rightLens);

      // Iconic Metal Diamond Rivets on Outer Temporal Lugs
      const rivetGeom = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 4);
      rivetGeom.rotateZ(Math.PI / 4);
      rivetGeom.rotateX(Math.PI / 2);
      const silverRivetMat = new THREE.MeshStandardMaterial({
        color: '#E5E7EB',
        metalness: 0.95,
        roughness: 0.10,
        envMapIntensity: 2.5,
      });

      const leftRivet = new THREE.Mesh(rivetGeom, silverRivetMat);
      leftRivet.position.set(-4.05, 1.30, 0.28);
      leftRivet.scale.set(1.4, 0.7, 1.0);
      root.add(leftRivet);

      const rightRivet = new THREE.Mesh(rivetGeom, silverRivetMat);
      rightRivet.position.set(4.05, 1.30, 0.28);
      rightRivet.scale.set(1.4, 0.7, 1.0);
      root.add(rightRivet);
      break;
    }

    case 'Sport': {
      // Oakley Radar EV Path: Aerodynamic Wrap Shield covering full face width 8.8
      const browCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-halfHingeWidth, 0.50, -1.4),
        new THREE.Vector3(-2.2, 1.65, 0.25),
        new THREE.Vector3(2.2, 1.65, 0.25),
        new THREE.Vector3(halfHingeWidth, 0.50, -1.4)
      );
      const browMesh = new THREE.Mesh(
        new THREE.TubeGeometry(browCurve, 40, 0.22, 8, false),
        frameMaterial
      );
      root.add(browMesh);

      // Toric Aerodynamic Wrap Shield Lens - properly oriented horizontally across face
      const shieldGeom = new THREE.CylinderGeometry(4.5, 4.5, 2.4, 48, 1, true, -Math.PI / 2.7, (2 * Math.PI) / 2.7);
      const shield = new THREE.Mesh(shieldGeom, lensMaterial);
      shield.position.set(0, -0.10, -3.6);
      shield.scale.set(0.98, 0.82, 1.0);
      root.add(shield);

      const centerClipGeom = new THREE.BoxGeometry(0.55, 0.85, 0.45);
      const centerClip = new THREE.Mesh(centerClipGeom, frameMaterial);
      centerClip.position.set(0, 0.38, 0.16);
      root.add(centerClip);
      break;
    }

    case 'Round': {
      // Ray-Ban RB3447 Round Metal Legend: Anatomically calibrated optical proportions
      // Lens diameter: 50mm (~2.96 units), Bridge width: 22mm (~1.47 units gap)
      // Total hinge width: 8.8 units (outer hinges at x = +-4.4)
      const roundLensRadius = 1.48;
      const roundRimTorusRadius = 1.50;
      const roundRimTubeRadius = 0.085;
      const roundLensCenterX = 2.32; // Centers at x = -2.32 and x = +2.32
      const roundLensZ = 0.16; // Raised forward to clear nasal dorsum

      // 1. Meniscus Curved Circular Lenses (Base-6 Optical Curve)
      const circleShape = new THREE.Shape();
      circleShape.absarc(0, 0, roundLensRadius, 0, Math.PI * 2, false);

      const leftLensGeom = createCurvedMeniscusLensGeometry(circleShape, 0.22, 48);
      const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
      leftLens.name = 'lens-round-left';
      leftLens.position.set(-roundLensCenterX, 0, roundLensZ);
      root.add(leftLens);

      const rightLensGeom = createCurvedMeniscusLensGeometry(circleShape, 0.22, 48);
      const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
      rightLens.name = 'lens-round-right';
      rightLens.position.set(roundLensCenterX, 0, roundLensZ);
      root.add(rightLens);

      // Authentic Ray-Ban Lens Decals
      const rightDecalMat = new THREE.MeshBasicMaterial({
        map: createLensBrandDecalTexture(true, product.brand),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rightDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), rightDecalMat);
      rightDecalPlane.position.set(roundLensCenterX, -0.20, roundLensZ + 0.25);
      root.add(rightDecalPlane);

      const leftDecalMat = new THREE.MeshBasicMaterial({
        map: createLensBrandDecalTexture(false, product.brand),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const leftDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), leftDecalMat);
      leftDecalPlane.position.set(-roundLensCenterX, -0.20, roundLensZ + 0.25);
      root.add(leftDecalPlane);

      // 2. Tubular Beveled Torus Eye-Wire Rims
      // Inner edge of left rim: -2.32 + 1.50 + 0.085 = -0.735
      // Inner edge of right rim: +2.32 - 1.50 - 0.085 = +0.735
      // TOTAL GAP BETWEEN THE TWO CIRCLES = 1.47 units (~23mm on human face)
      const rimGeom = new THREE.TorusGeometry(roundRimTorusRadius, roundRimTubeRadius, 16, 64);

      const leftRim = new THREE.Mesh(rimGeom, frameMaterial);
      leftRim.name = 'rim-round-left';
      leftRim.position.set(-roundLensCenterX, 0, roundLensZ);
      root.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeom, frameMaterial);
      rightRim.name = 'rim-round-right';
      rightRim.position.set(roundLensCenterX, 0, roundLensZ);
      root.add(rightRim);

      // 3. Extended Lugs connecting outer rim edge to outer hinge (x = +-4.4)
      const outerRimEdgeX = roundLensCenterX + roundRimTorusRadius; // 2.32 + 1.50 = 3.82
      const leftLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(-outerRimEdgeX, 0.30, roundLensZ),
        new THREE.Vector3(-halfHingeWidth, 0.30, 0.0)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(leftLugCurve, 12, 0.085, 8, false), frameMaterial));

      const rightLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(outerRimEdgeX, 0.30, roundLensZ),
        new THREE.Vector3(halfHingeWidth, 0.30, 0.0)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(rightLugCurve, 12, 0.085, 8, false), frameMaterial));

      // 4. Iconic Arched Brow Bar Bridge:
      // Connects seamlessly to the upper-inner rim of each circle:
      // At y = 0.32: circle x = roundLensCenterX - sqrt(1.50^2 - 0.32^2) = 2.32 - 1.465 = 0.855
      const bridgeStartX = -(roundLensCenterX - 1.465); // -0.855
      const bridgeEndX = (roundLensCenterX - 1.465);    // +0.855
      const bridgeCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(bridgeStartX, 0.32, roundLensZ),
        new THREE.Vector3(0, 0.95, roundLensZ + 0.12),
        new THREE.Vector3(bridgeEndX, 0.32, roundLensZ)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.08, 8, false), frameMaterial));

      // Central Reinforcing Solder Join on Bridge Arch
      const bridgeJoinGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 12);
      bridgeJoinGeom.rotateX(Math.PI / 2);
      const bridgeJoin = new THREE.Mesh(bridgeJoinGeom, frameMaterial);
      bridgeJoin.position.set(0, 0.95, roundLensZ + 0.11);
      root.add(bridgeJoin);

      // 5. Anatomical S-Shaped Pad Arms & Translucent Silicone Nose Pads
      const leftPadArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.95, 0.10, roundLensZ - 0.02),
        new THREE.Vector3(-0.75, -0.05, -0.10),
        new THREE.Vector3(-0.62, -0.15, -0.22),
      ]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(leftPadArmCurve, 14, 0.04, 8, false), frameMaterial));

      const rightPadArmCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.95, 0.10, roundLensZ - 0.02),
        new THREE.Vector3(0.75, -0.05, -0.10),
        new THREE.Vector3(0.62, -0.15, -0.22),
      ]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(rightPadArmCurve, 14, 0.04, 8, false), frameMaterial));

      const padGeom = new THREE.SphereGeometry(0.18, 16, 16);
      padGeom.scale(0.65, 1.35, 0.45);

      const leftPad = new THREE.Mesh(padGeom, padMaterial);
      leftPad.position.set(-0.60, -0.15, -0.24);
      leftPad.rotation.set(0.2, 0.35, -0.25);
      root.add(leftPad);

      const rightPad = new THREE.Mesh(padGeom, padMaterial);
      rightPad.position.set(0.60, -0.15, -0.24);
      rightPad.rotation.set(0.2, -0.35, 0.25);
      root.add(rightPad);
      break;
    }

    case 'Hexagonal':
    default: {
      // Ray-Ban RB3548N Hexagonal Flat/Curved: Extended Lugs to full face width 8.8
      const hexLensRadius = 1.52;
      const hexLensCenterX = 2.32;
      const hexLensZ = 0.16;

      const hexShape = new THREE.Shape();
      const sides = 6;
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides + Math.PI / 6;
        const x = hexLensRadius * Math.cos(angle);
        const y = hexLensRadius * Math.sin(angle);
        if (i === 0) hexShape.moveTo(x, y);
        else hexShape.lineTo(x, y);
      }
      hexShape.closePath();

      const leftLensGeom = createCurvedMeniscusLensGeometry(hexShape, 0.22, 36);
      const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
      leftLens.name = 'lens-hex-left';
      leftLens.position.set(-hexLensCenterX, 0, hexLensZ);
      root.add(leftLens);

      const rightLensGeom = createCurvedMeniscusLensGeometry(hexShape, 0.22, 36);
      const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
      rightLens.name = 'lens-hex-right';
      rightLens.position.set(hexLensCenterX, 0, hexLensZ);
      root.add(rightLens);

      const rimPoints = hexShape.getPoints(sides);
      const rimPath = new THREE.CatmullRomCurve3(
        rimPoints.map((p) => new THREE.Vector3(p.x, p.y, 0)),
        true
      );
      const rimGeom = new THREE.TubeGeometry(rimPath, 64, 0.085, 8, true);

      const leftRim = new THREE.Mesh(rimGeom, frameMaterial);
      leftRim.name = 'rim-hex-left';
      leftRim.position.set(-hexLensCenterX, 0, hexLensZ);
      root.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeom, frameMaterial);
      rightRim.name = 'rim-hex-right';
      rightRim.position.set(hexLensCenterX, 0, hexLensZ);
      root.add(rightRim);

      // Extended Lugs to Hinge at x = +-4.4
      const leftLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(-hexLensCenterX - hexLensRadius * 0.95, 0.28, hexLensZ),
        new THREE.Vector3(-halfHingeWidth, 0.28, 0.0)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(leftLugCurve, 12, 0.085, 8, false), frameMaterial));

      const rightLugCurve = new THREE.LineCurve3(
        new THREE.Vector3(hexLensCenterX + hexLensRadius * 0.95, 0.28, hexLensZ),
        new THREE.Vector3(halfHingeWidth, 0.28, 0.0)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(rightLugCurve, 12, 0.085, 8, false), frameMaterial));

      const bridgeStartX = -hexLensCenterX + hexLensRadius * 0.866;
      const bridgeEndX = hexLensCenterX - hexLensRadius * 0.866;
      const bridgeCurve = new THREE.LineCurve3(
        new THREE.Vector3(bridgeStartX, 0.30, hexLensZ),
        new THREE.Vector3(bridgeEndX, 0.30, hexLensZ)
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 16, 0.085, 8, false), frameMaterial));

      // Silicone Pads
      const padGeom = new THREE.SphereGeometry(0.18, 16, 16);
      padGeom.scale(0.7, 1.4, 0.5);
      const leftPad = new THREE.Mesh(padGeom, padMaterial);
      leftPad.position.set(-0.60, 0.10, -0.24);
      root.add(leftPad);

      const rightPad = new THREE.Mesh(padGeom, padMaterial);
      rightPad.position.set(0.60, 0.10, -0.24);
      root.add(rightPad);
      break;
    }
  }

  // 6. Sculpted Temple Arms Starting at Hinges (x = +-4.4) Extending to Ears (z = -10.5)
  const templeArmLength = 10.5;

  // Left Temple Arm
  const leftArmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfHingeWidth, 0.35, 0.0),
    new THREE.Vector3(-halfHingeWidth - 0.15, 0.38, -2.5),
    new THREE.Vector3(-halfHingeWidth - 0.10, 0.32, -6.0),
  ]);
  const leftArm = new THREE.Mesh(
    new THREE.TubeGeometry(leftArmCurve, 32, 0.10, 8, false),
    templeArmMaterial
  );
  root.add(leftArm);

  // Left Acetate Ear-Sock (hooks behind ear)
  const leftSockCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfHingeWidth - 0.10, 0.32, -6.0),
    new THREE.Vector3(-halfHingeWidth - 0.05, 0.15, -8.2),
    new THREE.Vector3(-halfHingeWidth - 0.15, -0.85, -templeArmLength),
  ]);
  const leftSock = new THREE.Mesh(
    new THREE.TubeGeometry(leftSockCurve, 28, 0.14, 8, false),
    earSockMaterial
  );
  root.add(leftSock);

  // Right Temple Arm
  const rightArmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(halfHingeWidth, 0.35, 0.0),
    new THREE.Vector3(halfHingeWidth + 0.15, 0.38, -2.5),
    new THREE.Vector3(halfHingeWidth + 0.10, 0.32, -6.0),
  ]);
  const rightArm = new THREE.Mesh(
    new THREE.TubeGeometry(rightArmCurve, 32, 0.10, 8, false),
    templeArmMaterial
  );
  root.add(rightArm);

  // Right Acetate Ear-Sock (hooks behind ear)
  const rightSockCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(halfHingeWidth + 0.10, 0.32, -6.0),
    new THREE.Vector3(halfHingeWidth + 0.05, 0.15, -8.2),
    new THREE.Vector3(halfHingeWidth + 0.15, -0.85, -templeArmLength),
  ]);
  const rightSock = new THREE.Mesh(
    new THREE.TubeGeometry(rightSockCurve, 28, 0.14, 8, false),
    earSockMaterial
  );
  root.add(rightSock);

  return root;
}

/**
 * Creates Anatomically Sculpted 3D Human Head Occluder.
 * Matches canonical human craniofacial topology (cranium, cheekbones, temporal ear canals).
 *
 * Properties for FittingBox realism:
 * - colorWrite: false (Completely invisible to RGB video stream)
 * - depthWrite: true  (Writes to GPU Z-buffer)
 * - renderOrder: 0   (Renders first before sunglasses, causing arms to clip behind head/ears)
 */
export function createHeadOccluderMesh(debugWireframe: boolean = false): THREE.Group {
  const headGroup = new THREE.Group();
  headGroup.name = 'head-occluder';
  headGroup.renderOrder = 0; // Essential: must render before sunglasses (renderOrder = 1)

  // Occluder Material
  const occluderMaterial = debugWireframe
    ? new THREE.MeshBasicMaterial({
        color: new THREE.Color('#22D3EE'),
        wireframe: true,
        transparent: true,
        opacity: 0.45,
        depthWrite: true,
      })
    : new THREE.MeshBasicMaterial({
        colorWrite: false, // INVISIBLE to camera
        depthWrite: true,  // WRITES to depth buffer
      });

  // 1. Cranium & Parietal Skull Dome (Positioned back into the skull at Z = -6.2)
  const skullGeom = new THREE.SphereGeometry(4.2, 32, 24);
  skullGeom.scale(1.0, 1.25, 1.10);
  const skullMesh = new THREE.Mesh(skullGeom, occluderMaterial);
  skullMesh.position.set(0, -0.4, -6.2);
  headGroup.add(skullMesh);

  // 2. Left Ear & Mastoid Region Mask (strictly at side of head X = -4.3, Z = -5.8)
  const earGeom = new THREE.BoxGeometry(1.4, 2.8, 2.8);
  const leftEarMesh = new THREE.Mesh(earGeom, occluderMaterial);
  leftEarMesh.position.set(-4.3, -0.2, -5.8);
  leftEarMesh.rotation.y = 0.15;
  headGroup.add(leftEarMesh);

  // 3. Right Ear & Mastoid Region Mask (strictly at side of head X = +4.3, Z = -5.8)
  const rightEarMesh = new THREE.Mesh(earGeom, occluderMaterial);
  rightEarMesh.position.set(4.3, -0.2, -5.8);
  rightEarMesh.rotation.y = -0.15;
  headGroup.add(rightEarMesh);

  return headGroup;
}
