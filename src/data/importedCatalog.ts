import type { SunglassesProduct } from '../types';

type Entry = { id: string; name: string; file: string; nodes?: string[]; rotationY?: number; lensMeshes?: string[]; anchorMeshes?: string[]; trimLensToAnchor?: boolean; excludeNodes?: string[]; localGeometry?: boolean };
const entries: Entry[] = [
  { id: 'fano', name: 'Fano Lens', file: 'fano.glb', excludeNodes: ['Plane'] },
  { id: 'pixel', name: '8-Bit Sunglasses', file: '8bit_sunglass.glb', lensMeshes: ['Cube_1'] },
  { id: 'obj-classic', name: 'Classic Optical Frame', file: 'Glasses.obj' },
  { id: 'green-round', name: 'Green Round Sunglasses', file: 'green_round_sunglasses.glb' },
  { id: 'lis', name: 'Lis Gold Frame', file: 'lente-lis-version4(13).glb', anchorMeshes: ['marcos002'], lensMeshes: ['CRISTALES'], trimLensToAnchor: true },
  { id: 'rayban-junior', name: 'Ray-Ban Junior', file: 'maya_3d_modeling_of_rayban_glasses_for_children.glb', lensMeshes: ['Object_2'] },
  { id: 'meta-quest', name: 'Meta Ray-Ban Black', file: 'me_taquest_ra_yba.glb' },
  { id: 'mustang', name: 'Mustang MU 1683', file: 'mustang_sunglasses_-_mu_1683.glb', lensMeshes: ['Plane_Mustang_0'] },
  { id: 'meta-red', name: 'Ray-Ban Meta Red', file: 'ray-ban_meta_smart_glasses_3d_model.glb', rotationY: -.192, lensMeshes: ['Object_22'] },
  { id: 'stylized-full', name: 'Stylized Full Frame', file: 'stylized_eyeglasses_set___3d_model_pack.glb', nodes: ['Large_Framed_Glasses_'] },
  { id: 'stylized-brow', name: 'Stylized Browline', file: 'stylized_eyeglasses_set___3d_model_pack.glb', nodes: ['Top_Framed_Glasses'] },
  { id: 'sunglass-1', name: 'Sunglasses 01', file: 'sunglass (1).glb', rotationY: Math.PI / 2 },
  { id: 'sunglass-2', name: 'Wolf Optical Frame', file: 'sunglass (2).glb', localGeometry: true },
  { id: 'sunglass-3', name: 'Sunglasses 03', file: 'sunglass (3).glb' },
  { id: 'sunglass-4', name: 'Black & Gold Sunglasses', file: 'sunglass (4).glb', rotationY: Math.PI / 2 },
  { id: 'sunglass-original', name: 'Sunglasses Original', file: 'sunglass.glb' },
  { id: 'fly', name: 'Fly Sunglasses', file: 'Sunglass2.glb' },
  { id: 'pack-blue', name: 'Blue Classic', file: 'sunglasses_pack.glb', nodes: ['Cube011', 'Cube012', 'Cube013'] },
  { id: 'pack-pink', name: 'Pink Round Metal', file: 'sunglasses_pack.glb', nodes: ['Cylinder001', 'Cube001', 'Cylinder002', 'Cylinder003'] },
  { id: 'pack-black', name: 'Black Wide Frame', file: 'sunglasses_pack.glb', nodes: ['Cube010', 'Plane'] },
  { id: 'pack-white', name: 'White Square Frame', file: 'sunglasses_pack.glb', nodes: ['Cube002', 'Cube004', 'Plane002'] },
  { id: 'pack-green', name: 'Green Round Metal', file: 'sunglasses_pack.glb', nodes: ['Cylinder004', 'Cube005', 'Cylinder005', 'Cylinder006'] },
  { id: 'pack-aviator', name: 'Green Gold Aviator', file: 'sunglasses_pack.glb', nodes: ['Cube006', 'Cylinder008', 'Cube008', 'Cube007', 'Torus', 'Cube009', 'Cube003'] },
  { id: 'vuzix', name: 'Vuzix Blade Smart Glasses', file: 'vuzix_blade_smart_glasses.glb' },
];

export function createImportedCatalog(template: SunglassesProduct): SunglassesProduct[] {
  return entries.map(entry => ({
    ...template,
    id: `imported-${entry.id}`, name: entry.name, brand: 'Model Library', modelCode: entry.file,
    category: 'Wayfarer', price: 0, badge: 'Added Model', activeVariantIndex: 0,
    description: 'Your imported eyewear model with its original materials and textures.',
    frameMaterial: 'Original model finish', polarized: false,
    thumbnailUrl: `/models/imported/thumbnails/${entry.id}.png`,
    variants: [{ name: 'Original finish', frameHex: '#303030', lensHex: '#253d2c', metalness: .1, roughness: .25 }],
    model: { path: `/models/imported/${encodeURIComponent(entry.file)}`, nodes: entry.nodes, rotationY: entry.rotationY,
      lensMeshes: entry.lensMeshes, anchorMeshes: entry.anchorMeshes, trimLensToAnchor: entry.trimLensToAnchor, excludeNodes: entry.excludeNodes, localGeometry: entry.localGeometry },
  }));
}
