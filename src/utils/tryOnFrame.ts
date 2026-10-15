import * as THREE from 'three';
import type { SunglassesProduct } from '../types';
import { loadEyewearCADModel } from './cadModelManager';
import { EyewearRig } from './landmarkEyewear';

// Warm geometry on user intent; do not download the whole catalog on startup.
const preparations = new Map<string, Promise<void>>();
const keyFor = (product: SunglassesProduct, variant: number) => JSON.stringify([product.id, product.model, product.variants[variant]]);
export function prepareTryOnFrame(product: SunglassesProduct, variant = product.activeVariantIndex || 0): Promise<void> {
  if (product.isExternal || product.customFrameUrl || product.customFrameCutoutUrl) return Promise.resolve();
  const key = keyFor(product, variant);
  let preparation = preparations.get(key);
  if (!preparation) {
    preparation = loadEyewearCADModel(product, product.variants[variant] || product.variants[0])
      .then(model => { const rig = new EyewearRig(model, product.id); rig.dispose(); })
      .catch(error => { preparations.delete(key); throw error; });
    preparations.set(key, preparation);
    if (preparations.size > 6) preparations.delete(preparations.keys().next().value!);
  }
  return preparation;
}
export async function loadTryOnFrame(product: SunglassesProduct, variant: number) {
  const pending = preparations.get(keyFor(product, variant));
  if (pending) await pending.catch(() => undefined);
  const model = await loadEyewearCADModel(product, product.variants[variant] || product.variants[0]);
  applyCameraMaterials(model);
  return model;
}

// Materials are instance-owned. Preserve authored colors/textures and lens tint.
export function applyCameraMaterials(model: THREE.Group) {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const lens = object.userData.eyewearLens || /lens/i.test(object.name);
    const list = (Array.isArray(object.material) ? object.material : [object.material]).map(source => {
      let material = source;
      if (source instanceof THREE.MeshPhongMaterial) {
        material = new THREE.MeshStandardMaterial({color:source.color, map:source.map,
          normalMap:source.normalMap, alphaMap:source.alphaMap, transparent:source.transparent,
          opacity:source.opacity, side:source.side, depthWrite:source.depthWrite,
          roughness:.32, metalness:.05});
        material.name = source.name;
        source.dispose();
      }
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = Math.min(material.envMapIntensity, lens ? .45 : .7);
        material.roughness = Math.max(material.roughness, lens ? .08 : material.metalness > .6 ? .22 : .3);
        if (material instanceof THREE.MeshPhysicalMaterial) {
          material.clearcoat = Math.min(material.clearcoat, lens ? .35 : .4);
          material.clearcoatRoughness = Math.max(material.clearcoatRoughness, .16);
          if (lens) material.transmission = 0; // Camera is composited on another canvas.
        }
      }
      return material;
    });
    object.material = list.length === 1 ? list[0] : list;
  });
}
