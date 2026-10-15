import type { SunglassesProduct, EyewearCategory } from '../types';

type Entry = {
  id: string;
  name: string;
  file: string;
  category: EyewearCategory;
  nodes?: string[];
  rotationY?: number;
  lensMeshes?: string[];
  anchorMeshes?: string[];
  trimLensToAnchor?: boolean;
  excludeNodes?: string[];
  localGeometry?: boolean;
  scaleMultiplier?: number;
  offsetY?: number;
  offsetZ?: number;
};

// Curated list of unique, high-quality distinct 3D models with proper categories (no duplicates)
const entries: Entry[] = [
  { id: 'fano', name: 'Fano Silhouette', category: 'Cat-Eye', file: 'fano.glb', excludeNodes: ['Plane'] },
  { id: 'pixel', name: '8-Bit Retro Sunglasses', category: 'Square', file: '8bit_sunglass.glb', lensMeshes: ['Cube_1'] },
  { id: 'obj-classic', name: 'Classic Optical Frame', category: 'Round', file: 'Glasses.obj', offsetY: 0.14 },
  { id: 'rayban-junior', name: 'Ray-Ban Junior', category: 'Wayfarer', file: 'maya_3d_modeling_of_rayban_glasses_for_children.glb', lensMeshes: ['Object_2'] },
  { id: 'mustang', name: 'Mustang MU 1683', category: 'Cat-Eye', file: 'mustang_sunglasses_-_mu_1683.glb', lensMeshes: ['Plane_Mustang_0'] },
  { id: 'stylized-brow', name: 'Classic Browline', category: 'Square', file: 'stylized_eyeglasses_set___3d_model_pack.glb', nodes: ['Top_Framed_Glasses'], offsetY: 0.14 },
  { id: 'sunglass-2', name: 'Wolf Optical Frame', category: 'Square', file: 'sunglass (2).glb', localGeometry: true, offsetY: 0.16 },
  { id: 'vuzix', name: 'Vuzix Blade Smart Glasses', category: 'Sport', file: 'vuzix_blade_smart_glasses.glb', scaleMultiplier: 0.94, offsetY: 0.40, offsetZ: 0.06 },
];

export function createImportedCatalog(template: SunglassesProduct): SunglassesProduct[] {
  return entries.map((entry) => ({
    ...template,
    id: `imported-${entry.id}`,
    name: entry.name,
    brand: 'Model Library',
    modelCode: entry.file,
    category: entry.category,
    price: 0,
    badge: 'Curated 3D',
    activeVariantIndex: 0,
    description: `A unique 3D eyewear model featuring custom CAD geometry in ${entry.category.toLowerCase()} silhouette.`,
    frameMaterial: 'Studio Finish',
    polarized: false,
    thumbnailUrl: `/models/imported/thumbnails/${entry.id}.png`,
    variants: [
      {
        name: 'Original finish',
        frameHex: '#303030',
        lensHex: '#253d2c',
        metalness: 0.1,
        roughness: 0.25,
      },
    ],
    model: {
      path: `/models/imported/${encodeURIComponent(entry.file)}`,
      nodes: entry.nodes,
      rotationY: entry.rotationY,
      lensMeshes: entry.lensMeshes,
      anchorMeshes: entry.anchorMeshes,
      trimLensToAnchor: entry.trimLensToAnchor,
      excludeNodes: entry.excludeNodes,
      localGeometry: entry.localGeometry,
      scaleMultiplier: entry.scaleMultiplier,
      offsetY: entry.offsetY,
      offsetZ: entry.offsetZ,
    },
  }));
}
