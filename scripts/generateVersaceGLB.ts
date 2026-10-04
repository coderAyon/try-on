import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock FileReader for Node environment to support GLTFExporter binary export
if (typeof (globalThis as any).FileReader === 'undefined') {
  (globalThis as any).FileReader = class FileReader {
    result: any = null;
    onloadend: any = null;
    readAsArrayBuffer(blob: any) {
      blob.arrayBuffer().then((buf: ArrayBuffer) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
      });
    }
  };
}

export function createVersaceVE4514DModel(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'versace_ve4514d_root';

  // -------------------------------------------------------------
  // Materials
  // -------------------------------------------------------------
  // 1. High-Gloss Jet Black Italian Acetate
  const acetateMaterial = new THREE.MeshPhysicalMaterial({
    name: 'Acetate_Black_Gloss',
    color: new THREE.Color('#0c0d0f'),
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.6,
  });

  // 2. Authentic Polished Yellow Gold Hardware (Medusa & Hinges & Logo)
  const goldMaterial = new THREE.MeshPhysicalMaterial({
    name: 'Hardware_Polished_Gold',
    color: new THREE.Color('#D4AF37'),
    roughness: 0.16,
    metalness: 0.96,
    clearcoat: 0.8,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95,
  });

  // 3. Smoke Grey Optical Sun Lenses
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    name: 'Lens_Smoke_Grey',
    color: new THREE.Color('#1d2124'),
    roughness: 0.02,
    metalness: 0.08,
    transmission: 0.15,
    opacity: 0.85,
    transparent: true,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // -------------------------------------------------------------
  // 1. Front Acetate Frame: Unified Body with Saddle Bridge & Lugs
  // -------------------------------------------------------------
  // We construct the front outline (outer perimeter) and two inner cutouts (holes)
  // for the left and right lenses.
  const frontShape = new THREE.Shape();

  // Starting at top center of bridge
  frontShape.moveTo(0, 0.42);
  // Brow line curving up to right brow
  frontShape.bezierCurveTo(0.6, 0.44, 1.2, 0.82, 2.15, 0.86);
  // Right brow sweeping to outer temple lug
  frontShape.bezierCurveTo(3.1, 0.86, 3.8, 0.68, 4.38, 0.45);
  // Right lug drop
  frontShape.lineTo(4.38, 0.15);
  // Right lug lower curve into cheek rim
  frontShape.bezierCurveTo(4.35, -0.05, 3.75, -0.35, 3.55, -0.72);
  // Right lower rim tapering inward
  frontShape.bezierCurveTo(3.35, -1.02, 2.8, -1.06, 2.15, -1.06);
  // Right lower nasal rim curving up to bridge base
  frontShape.bezierCurveTo(1.4, -1.06, 0.95, -0.85, 0.62, -0.32);
  // Nasal arch (Saddle bridge undercut)
  frontShape.bezierCurveTo(0.45, -0.02, 0.25, 0.06, 0, 0.06);
  // Symmetric left side (nasal arch down to left lower nasal rim)
  frontShape.bezierCurveTo(-0.25, 0.06, -0.45, -0.02, -0.62, -0.32);
  // Left lower nasal rim
  frontShape.bezierCurveTo(-0.95, -0.85, -1.4, -1.06, -2.15, -1.06);
  // Left lower rim
  frontShape.bezierCurveTo(-2.8, -1.06, -3.35, -1.02, -3.55, -0.72);
  // Left lower cheek rim up to left lug
  frontShape.bezierCurveTo(-3.75, -0.35, -4.35, -0.05, -4.38, 0.15);
  // Left lug height
  frontShape.lineTo(-4.38, 0.45);
  // Left lug sweeping into left brow
  frontShape.bezierCurveTo(-3.8, 0.68, -3.1, 0.86, -2.15, 0.86);
  // Left brow returning to bridge top
  frontShape.bezierCurveTo(-1.2, 0.82, -0.6, 0.44, 0, 0.42);

  // Function to create softened rectangular lens hole
  function createLensPath(centerX: number): THREE.Path {
    const path = new THREE.Path();
    const sign = centerX > 0 ? 1 : -1;
    const w = 1.35; // half width
    const hTop = 0.62;
    const hBottom = -0.78;
    const r = 0.38; // corner radius

    // Clockwise winding for holes in Three.js Shape
    path.moveTo(centerX - sign * (w - r), hTop);
    path.lineTo(centerX + sign * (w - r), hTop);
    path.quadraticCurveTo(centerX + sign * w, hTop, centerX + sign * w, hTop - r);
    path.lineTo(centerX + sign * (w - 0.08), hBottom + r);
    path.quadraticCurveTo(centerX + sign * (w - 0.08), hBottom, centerX + sign * (w - 0.08 - r), hBottom);
    path.lineTo(centerX - sign * (w - 0.12 - r), hBottom);
    path.quadraticCurveTo(centerX - sign * (w - 0.12), hBottom, centerX - sign * (w - 0.12), hBottom + r);
    path.lineTo(centerX - sign * w, hTop - r);
    path.quadraticCurveTo(centerX - sign * w, hTop, centerX - sign * (w - r), hTop);

    return path;
  }

  // Add left and right lens holes
  frontShape.holes.push(createLensPath(-2.15));
  frontShape.holes.push(createLensPath(2.15));

  // Extrude front acetate with beveled contours
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 2,
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelOffset: -0.01,
    bevelSegments: 5,
  };

  const frontGeometry = new THREE.ExtrudeGeometry(frontShape, extrudeSettings);
  frontGeometry.computeVertexNormals();

  const frontMesh = new THREE.Mesh(frontGeometry, acetateMaterial);
  frontMesh.name = 'versace_frame_acetate';
  // Position so front face sits near z = 0.12
  frontMesh.position.set(0, 0, -0.14);
  root.add(frontMesh);

  // -------------------------------------------------------------
  // 2. Sculpted Rear Nose Pads (Integrated Italian Acetate)
  // -------------------------------------------------------------
  const padShape = new THREE.Shape();
  padShape.moveTo(0, 0.4);
  padShape.quadraticCurveTo(0.18, 0.2, 0.16, -0.35);
  padShape.quadraticCurveTo(0.08, -0.45, -0.08, -0.4);
  padShape.quadraticCurveTo(-0.16, -0.1, 0, 0.4);

  const padExtrude = new THREE.ExtrudeGeometry(padShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
  });

  const leftPad = new THREE.Mesh(padExtrude, acetateMaterial);
  leftPad.name = 'versace_nosepad_left';
  leftPad.position.set(-0.62, -0.22, -0.26);
  leftPad.rotation.set(0.15, 0.35, -0.12);
  root.add(leftPad);

  const rightPad = new THREE.Mesh(padExtrude, acetateMaterial);
  rightPad.name = 'versace_nosepad_right';
  rightPad.position.set(0.62, -0.22, -0.26);
  rightPad.rotation.set(0.15, -0.35, 0.12);
  root.add(rightPad);

  // -------------------------------------------------------------
  // 3. Smoke Grey Optical Sun Lenses (Curved Meniscus Profile)
  // -------------------------------------------------------------
  function createLensMesh(centerX: number, isRight: boolean): THREE.Mesh {
    const shape = new THREE.Shape();
    const w = 1.38;
    const hTop = 0.64;
    const hBottom = -0.80;
    const r = 0.40;

    // Counter-clockwise for solid face
    shape.moveTo(-w + r, hTop);
    shape.lineTo(w - r, hTop);
    shape.quadraticCurveTo(w, hTop, w, hTop - r);
    shape.lineTo(w - 0.08, hBottom + r);
    shape.quadraticCurveTo(w - 0.08, hBottom, w - 0.08 - r, hBottom);
    shape.lineTo(-w + 0.12 + r, hBottom);
    shape.quadraticCurveTo(-w + 0.12, hBottom, -w + 0.12, hBottom + r);
    shape.lineTo(-w, hTop - r);
    shape.quadraticCurveTo(-w, hTop, -w + r, hTop);

    // Subtle meniscus curvature: Base-4 curve
    const lensGeom = new THREE.ShapeGeometry(shape, 32);
    const pos = lensGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      // Parabolic bow forward in center
      const vz = 0.06 - (vx * vx * 0.03 + vy * vy * 0.035);
      pos.setZ(i, vz);
    }
    lensGeom.computeVertexNormals();

    const mesh = new THREE.Mesh(lensGeom, lensMaterial);
    mesh.name = isRight ? 'versace_lens_right' : 'versace_lens_left';
    mesh.position.set(centerX, 0, 0.02);
    mesh.renderOrder = 3;
    return mesh;
  }

  root.add(createLensMesh(-2.15, false));
  root.add(createLensMesh(2.15, true));

  // -------------------------------------------------------------
  // 4. Iconic Gold Medusa Medallion (Left & Right Temporal Corners)
  // -------------------------------------------------------------
  function createMedusaMedallionGroup(isRight: boolean): THREE.Group {
    const medusaGroup = new THREE.Group();
    medusaGroup.name = isRight ? 'versace_medusa_right_group' : 'versace_medusa_left_group';

    // A. Outer Chamfered Coin Rim
    const coinBaseGeom = new THREE.CylinderGeometry(0.24, 0.25, 0.06, 24);
    coinBaseGeom.rotateX(Math.PI / 2);
    const coinBase = new THREE.Mesh(coinBaseGeom, goldMaterial);
    coinBase.name = isRight ? 'versace_medusa_coin_right' : 'versace_medusa_coin_left';
    medusaGroup.add(coinBase);

    // Raised outer bevel ring
    const coinRingGeom = new THREE.TorusGeometry(0.22, 0.03, 12, 24);
    const coinRing = new THREE.Mesh(coinRingGeom, goldMaterial);
    coinRing.position.set(0, 0, 0.03);
    medusaGroup.add(coinRing);

    // B. Greca / Classical Ornamental Border Steps (12 radial tick notches)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const notchGeom = new THREE.BoxGeometry(0.035, 0.02, 0.015);
      const notch = new THREE.Mesh(notchGeom, goldMaterial);
      notch.position.set(Math.cos(angle) * 0.17, Math.sin(angle) * 0.17, 0.032);
      notch.rotation.z = angle;
      medusaGroup.add(notch);
    }

    // C. Sculpted Medusa Head Relief
    // Center face oval
    const faceGeom = new THREE.SphereGeometry(0.09, 16, 12);
    faceGeom.scale(0.85, 1.15, 0.45);
    const faceMesh = new THREE.Mesh(faceGeom, goldMaterial);
    faceMesh.position.set(0, -0.01, 0.035);
    medusaGroup.add(faceMesh);

    // Medusa brow / hair crown
    const browGeom = new THREE.TorusGeometry(0.07, 0.025, 8, 12, Math.PI);
    browGeom.rotateZ(Math.PI);
    const browMesh = new THREE.Mesh(browGeom, goldMaterial);
    browMesh.position.set(0, 0.045, 0.04);
    medusaGroup.add(browMesh);

    // Serpentine radiating locks (8 organic tendrils around face)
    for (let j = 0; j < 8; j++) {
      const tAngle = (j / 8) * Math.PI * 1.8 + 0.2;
      const curlCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(Math.cos(tAngle) * 0.07, Math.sin(tAngle) * 0.07, 0.035),
        new THREE.Vector3(Math.cos(tAngle + 0.2) * 0.13, Math.sin(tAngle + 0.2) * 0.13, 0.038),
        new THREE.Vector3(Math.cos(tAngle + 0.1) * 0.15, Math.sin(tAngle + 0.1) * 0.15, 0.025)
      );
      const curlGeom = new THREE.TubeGeometry(curlCurve, 6, 0.014, 6, false);
      const curlMesh = new THREE.Mesh(curlGeom, goldMaterial);
      medusaGroup.add(curlMesh);
    }

    return medusaGroup;
  }

  // Position left and right Medusa medallions on the temporal lugs
  const leftMedusa = createMedusaMedallionGroup(false);
  leftMedusa.position.set(-4.08, 0.32, 0.18);
  // Slight yaw angle to align with acetate bevel
  leftMedusa.rotation.set(-0.04, -0.16, 0.04);
  root.add(leftMedusa);

  const rightMedusa = createMedusaMedallionGroup(true);
  rightMedusa.position.set(4.08, 0.32, 0.18);
  rightMedusa.rotation.set(-0.04, 0.16, -0.04);
  root.add(rightMedusa);

  // -------------------------------------------------------------
  // 5. Dual Acetate Temple Arms with Sculpted Drops
  // -------------------------------------------------------------
  function createTempleArm(isRight: boolean): THREE.Group {
    const templeGroup = new THREE.Group();
    templeGroup.name = isRight ? 'versace_temple_right_group' : 'versace_temple_left_group';
    const sign = isRight ? 1 : -1;

    // A. Main Acetate Shaft (Extending from hinge to ear curve)
    // Modeled with an extruded profile along a curved path
    const spinePoints = [
      new THREE.Vector3(sign * 4.38, 0.30, 0.05),
      new THREE.Vector3(sign * 4.40, 0.32, -1.8),
      new THREE.Vector3(sign * 4.36, 0.28, -4.5),
      new THREE.Vector3(sign * 4.30, 0.22, -6.8),   // begins mastoid drop
      new THREE.Vector3(sign * 4.22, -0.10, -8.6),  // curves over ear
      new THREE.Vector3(sign * 4.14, -0.75, -10.2), // paddle flare
    ];

    const spinePath = new THREE.CatmullRomCurve3(spinePoints);

    // Acetate temple profile: rectangular with rounded edges
    const templeShape = new THREE.Shape();
    const tw = 0.085; // half thickness (lateral)
    const th = 0.18;  // half height (vertical)
    const tr = 0.035;
    templeShape.moveTo(-tw + tr, th);
    templeShape.lineTo(tw - tr, th);
    templeShape.quadraticCurveTo(tw, th, tw, th - tr);
    templeShape.lineTo(tw, -th + tr);
    templeShape.quadraticCurveTo(tw, -th, tw - tr, -th);
    templeShape.lineTo(-tw + tr, -th);
    templeShape.quadraticCurveTo(-tw, -th, -tw, -th + tr);
    templeShape.lineTo(-tw, th - tr);
    templeShape.quadraticCurveTo(-tw, th, -tw + tr, th);

    const templeArmGeom = new THREE.ExtrudeGeometry(templeShape, {
      steps: 36,
      extrudePath: spinePath,
      bevelEnabled: false,
    });
    templeArmGeom.computeVertexNormals();

    const templeMesh = new THREE.Mesh(templeArmGeom, acetateMaterial);
    templeMesh.name = isRight ? 'versace_temple_right' : 'versace_temple_left';
    templeGroup.add(templeMesh);

    // B. Signature Angled Paddle Drop Tip (Iconic Versace spatulated ear tip)
    const paddleGeom = new THREE.BoxGeometry(0.19, 0.44, 0.85);
    const paddleMesh = new THREE.Mesh(paddleGeom, acetateMaterial);
    paddleMesh.name = isRight ? 'versace_paddle_right' : 'versace_paddle_left';
    paddleMesh.position.set(sign * 4.14, -0.80, -10.4);
    paddleMesh.rotation.set(-0.65, sign * 0.12, sign * -0.08);
    templeGroup.add(paddleMesh);

    // C. Gold "VERSACE" Lettering on Outer Temple
    // Located right past the hinge on the outer lateral surface
    const logoGroup = new THREE.Group();
    logoGroup.name = isRight ? 'versace_logo_right' : 'versace_logo_left';

    // Backing gold inscription bar / raised metal lettering
    const barLength = 1.35;
    const barHeight = 0.11;
    const barThickness = 0.022;

    // Modeled as refined gold lettering relief blocks
    // Letters: V E R S A C E
    const letters = ['V', 'E', 'R', 'S', 'A', 'C', 'E'];
    const letterWidth = barLength / letters.length;

    letters.forEach((_letter, idx) => {
      const zOffset = -0.70 - idx * (letterWidth + 0.035);
      const letterGeom = new THREE.BoxGeometry(barThickness, barHeight * 0.82, letterWidth * 0.75);
      const letterMesh = new THREE.Mesh(letterGeom, goldMaterial);
      letterMesh.position.set(sign * (4.40 + 0.06), 0.32, zOffset);
      logoGroup.add(letterMesh);
    });

    templeGroup.add(logoGroup);

    // D. Inner 5-Barrel Metallic Hinge Joint
    const hingeCylinderGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.34, 16);
    const hingeMesh = new THREE.Mesh(hingeCylinderGeom, goldMaterial);
    hingeMesh.name = isRight ? 'versace_hinge_right' : 'versace_hinge_left';
    hingeMesh.position.set(sign * 4.25, 0.30, -0.04);
    templeGroup.add(hingeMesh);

    const hingePlateGeom = new THREE.BoxGeometry(0.18, 0.28, 0.04);
    const hingePlate = new THREE.Mesh(hingePlateGeom, goldMaterial);
    hingePlate.position.set(sign * 4.26, 0.30, -0.09);
    templeGroup.add(hingePlate);

    return templeGroup;
  }

  root.add(createTempleArm(false));
  root.add(createTempleArm(true));

  return root;
}

async function exportVersaceGLB() {
  console.log('Building Versace VE4514D 3D CAD hierarchy...');
  const model = createVersaceVE4514DModel();

  // Validate bounds
  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  console.log(`Versace VE4514D model dimensions:`);
  console.log(`  Width (X):  ${size.x.toFixed(2)} units`);
  console.log(`  Height (Y): ${size.y.toFixed(2)} units`);
  console.log(`  Depth (Z):  ${size.z.toFixed(2)} units`);
  console.log(`  Center:     (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);

  console.log('Exporting binary GLB via Three.js GLTFExporter...');
  const exporter = new GLTFExporter();
  const outputDir = path.resolve(process.cwd(), 'public/models');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'versace_ve4514d.glb');

  const gltf = await exporter.parseAsync(model, { binary: true });
  if (gltf instanceof ArrayBuffer) {
    fs.writeFileSync(outputPath, Buffer.from(gltf));
    console.log(`SUCCESS! Wrote ${gltf.byteLength} bytes to ${outputPath}`);
  } else {
    throw new Error('Export returned non-binary gltf data');
  }
}

exportVersaceGLB().catch((err) => {
  console.error('Failed to generate Versace GLB:', err);
  process.exit(1);
});
