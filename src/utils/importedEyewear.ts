import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { SunglassesProduct } from '../types';

type ModelSpec = NonNullable<SunglassesProduct['model']>;
const sources = new Map<string, Promise<THREE.Group>>();
const normalized = new Map<string, Promise<THREE.Group>>();
const loader = new GLTFLoader();

async function sourceModel(path: string): Promise<THREE.Group> {
  if (!sources.has(path)) sources.set(path, (async () => {
    if (path.endsWith('.obj')) return new OBJLoader().loadAsync(path);
    const gltf = await loader.loadAsync(path);
    // Three r170 no longer implements specular-glossiness. Retain the source's
    // diffuse textures/colors rather than displaying those older assets white.
    for (let i = 0; i < (gltf.parser.json.materials?.length ?? 0); i++) {
      const extension = gltf.parser.json.materials[i].extensions?.KHR_materials_pbrSpecularGlossiness;
      if (!extension) continue;
      const material = await gltf.parser.getDependency('material', i) as THREE.MeshStandardMaterial;
      const diffuse = extension.diffuseFactor ?? [1, 1, 1, 1];
      material.color.fromArray(diffuse); material.opacity = diffuse[3];
      material.roughness = Math.max(.12, 1 - (extension.glossinessFactor ?? 1)); material.metalness = 0;
      if (extension.diffuseTexture) {
        material.map = await gltf.parser.getDependency('texture', extension.diffuseTexture.index);
        material.map!.colorSpace = THREE.SRGBColorSpace;
      }
      material.needsUpdate = true;
    }
    return gltf.scene;
  })().catch(error => { sources.delete(path); throw error; }));
  return sources.get(path)!;
}

function ancestry(object: THREE.Object3D): string[] {
  const names: string[] = [];
  for (let p: THREE.Object3D | null = object; p; p = p.parent) names.push(p.name);
  return names;
}

async function normalize(spec: ModelSpec): Promise<THREE.Group> {
  const source = await sourceModel(spec.path); source.updateMatrixWorld(true);
  const baked = new THREE.Group(); baked.rotation.y = spec.rotationY ?? 0;
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const names = ancestry(object);
    if (spec.nodes && !spec.nodes.some(name => names.includes(name))) return;
    if (spec.excludeNodes?.some(name => names.includes(name))) return;
    const geometry = object.geometry.clone();
    if (!spec.localGeometry) geometry.applyMatrix4(object.matrixWorld);
    const mesh = new THREE.Mesh(geometry, object.material);
    mesh.name = object.name; baked.add(mesh);
  });
  if (!baked.children.length) throw new Error(`No eyewear geometry found in ${spec.path}`);
  baked.updateMatrixWorld(true);
  // The Lis source contains collapsed/extruded lens faces far outside its rim.
  // Keep only triangles in the measured rim depth; leave the source asset intact.
  if (spec.trimLensToAnchor) {
    const rim = new THREE.Box3();
    baked.children.forEach(object => { if (spec.anchorMeshes?.includes(object.name)) rim.union(new THREE.Box3().setFromObject(object, true)); });
    if (rim.isEmpty()) throw new Error('Lens repair requires a rim anchor');
    const margin = (rim.max.x - rim.min.x) * .04;
    baked.children.forEach(object => {
      if (!spec.lensMeshes?.includes(object.name)) return;
      const mesh = object as THREE.Mesh, geometry = mesh.geometry, positions = geometry.getAttribute('position');
      const index = geometry.index, count = index?.count ?? positions.count, kept: number[] = [];
      const point = new THREE.Vector3();
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
        if (triangle.every(vertex => {
          point.fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld);
          return point.z >= rim.min.z - margin && point.z <= rim.max.z + margin;
        })) kept.push(...triangle);
      }
      if (kept.length < 30) throw new Error('Lens repair removed the optical surface');
      geometry.setIndex(kept); mesh.geometry = geometry.toNonIndexed(); geometry.dispose();
    });
  }
  const bounds = new THREE.Box3().setFromObject(baked, true), size = bounds.getSize(new THREE.Vector3());
  const lenses = new THREE.Box3(), anchorBounds = new THREE.Box3();
  baked.children.forEach(object => {
    const mesh = object as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const label = materials.map(material => material.name).join(' ');
    const box = new THREE.Box3().setFromObject(mesh, true), meshSize = box.getSize(new THREE.Vector3());
    if (spec.anchorMeshes?.includes(mesh.name)) anchorBounds.union(box);
    const candidate = spec.lensMeshes?.includes(mesh.name) ||
      (!/camera|nose|pad/i.test(label + mesh.name) && /glass|lens|lente|cristal|vidro|transparent.*brown/i.test(label));
    const isLens = candidate && meshSize.z < meshSize.y * .8 && meshSize.x > size.x * .15;
    mesh.userData.eyewearLens = isLens;
    if (isLens) { lenses.union(box); mesh.name += '-lens'; }
  });
  let centre: THREE.Vector3;
  if (!anchorBounds.isEmpty()) centre = anchorBounds.getCenter(new THREE.Vector3());
  else if (!lenses.isEmpty()) centre = lenses.getCenter(new THREE.Vector3());
  else {
    // Single textured meshes/OBJ frames have no separate lens primitive.
    // Their front slab gives an eye-plane origin without the descending arms.
    const front = new THREE.Box3(), point = new THREE.Vector3();
    baked.children.forEach(object => {
      const mesh = object as THREE.Mesh, positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        if (point.z >= bounds.max.z - size.z * .12) front.expandByPoint(point);
      }
    });
    centre = front.getCenter(new THREE.Vector3()); centre.x = bounds.getCenter(new THREE.Vector3()).x;
  }
  const output = new THREE.Group(); output.name = 'imported-' + spec.path.split('/').pop();
  // This OBJ has downward ear hooks. Fit the straight arm's contact section,
  // rather than lifting the whole arm until the bottom of its hook reaches the ear.
  if (spec.path.endsWith('/Glasses.obj')) output.userData.templeContactFraction = .8;
  const scale = (8.8 / size.x) * (spec.scaleMultiplier ?? 1.0);
  // Bake the orientation, scale and lens origin once. Live tracking is unchanged.
  baked.children.forEach(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry.applyMatrix4(mesh.matrixWorld).translate(-centre.x, -centre.y, -centre.z).scale(scale, scale, scale);
    if (spec.offsetY || spec.offsetZ) {
      mesh.geometry.translate(0, spec.offsetY ?? 0, spec.offsetZ ?? 0);
    }
    mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
  });
  while (baked.children.length) output.add(baked.children[0]);
  return output;
}

export async function loadImportedEyewear(spec: ModelSpec): Promise<THREE.Group> {
  const key = JSON.stringify(spec);
  if (!normalized.has(key)) normalized.set(key, normalize(spec).catch(error => { normalized.delete(key); throw error; }));
  const model = (await normalized.get(key)!).clone(true);
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const mesh = object;
    mesh.material = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(source => {
      const material = source.clone();
      if (spec.path.endsWith('.obj') && material instanceof THREE.MeshPhongMaterial) material.color.set('#181818');
      if (material instanceof THREE.MeshStandardMaterial) {
        material.roughness = Math.max(.12, material.roughness); material.envMapIntensity = .8;
        if (material.name === 'GlassShade3' && !material.map) {
          material.color.set('#344456'); material.metalness = .75;
          material.roughness = .12; material.envMapIntensity = 1.4;
        }
        if (mesh.userData.eyewearLens) {
          material.metalness = Math.min(material.metalness, .12);
          material.roughness = .06; material.envMapIntensity = 1.1;
          if (material instanceof THREE.MeshPhysicalMaterial) {
            material.transmission = 0; material.ior = 1.52;
            material.clearcoat = 1; material.clearcoatRoughness = .08;
          }
          const clearOptical = !material.map && Math.min(material.color.r, material.color.g, material.color.b) > .7;
          if (clearOptical) {
            material.envMapIntensity = .35;
            if (material instanceof THREE.MeshPhysicalMaterial) material.clearcoat = .25;
          }
          if (!material.map && material.color.g > .5 && material.color.g > material.color.r * 2) material.color.multiplyScalar(.35);
          material.transparent = true; material.opacity = Math.min(material.opacity, clearOptical ? .08 : .78); material.depthWrite = false;
        }
      }
      return material;
    });
    if (mesh.material.length === 1) mesh.material = mesh.material[0];
    mesh.renderOrder = mesh.userData.eyewearLens ? 3 : 2;
  });
  return model;
}
