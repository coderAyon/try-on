import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { SunglassesProduct } from '../../types';
import { loadEyewearCADModel, MODEL_TEMPLE_WIDTH } from '../../utils/cadModelManager';
import { generateStudioEnvironment } from '../../utils/environmentGenerator';

export const VRShowroom: React.FC<{ product: SunglassesProduct; variantIndex: number }> = ({ product, variantIndex }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !host.current) return;
    const container = host.current;
    let disposed = false;
    let model: THREE.Group | undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.xr.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e5e2dd');
    const environment = generateStudioEnvironment(renderer, 'studio');
    scene.environment = environment.texture;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 1.6, 0.8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.4, -0.6);
    controls.enableDamping = true;
    controls.minDistance = 0.45;
    controls.maxDistance = 3;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#d0cdc7', roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.16, 64), new THREE.MeshStandardMaterial({ color: '#f5f4f0', roughness: 0.55 }));
    pedestal.position.set(0, 0.58, -0.6);
    scene.add(pedestal);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x827b6f, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(2, 4, 2);
    scene.add(key);
    setStatus('Loading detailed eyewear…');
    loadEyewearCADModel(product, product.variants[variantIndex] || product.variants[0]).then(loaded => {
      if (disposed) return;
      model = loaded;
      // Enlarged exhibition model, 48 cm wide. Camera try-on retains face scale.
      model.scale.setScalar(0.48 / MODEL_TEMPLE_WIDTH);
      model.position.set(0, 1.4, -0.6);
      scene.add(model);
      setStatus('Drag to orbit · Scroll to zoom · In VR, point and hold the trigger to rotate');
    }).catch(() => setStatus('Unable to load eyewear. Close and reopen the showroom to retry.'));
    const button = VRButton.createButton(renderer);
    container.appendChild(button);
    const selected = new Set<number>();
    const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
    const raycaster = new THREE.Raycaster();
    controllers.forEach((controller, index) => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -2)]), new THREE.LineBasicMaterial({ color: '#bb2525' }));
      controller.add(line);
      controller.addEventListener('selectstart', () => {
        if (!model) return;
        raycaster.setFromXRController(controller);
        if (raycaster.intersectObject(model, true).length) selected.add(index);
      });
      controller.addEventListener('selectend', () => selected.delete(index));
      scene.add(controller);
    });
    const resize = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    let lastTime = 0;
    renderer.setAnimationLoop(time => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (selected.size && model) model.rotation.y += dt * 0.9;
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      disposed = true;
      resize.disconnect();
      renderer.setAnimationLoop(null);
      const session = renderer.xr.getSession();
      if (session) void session.end().catch(() => {});
      controls.dispose();
      environment.dispose();
      floor.geometry.dispose();
      pedestal.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      (pedestal.material as THREE.Material).dispose();
      controllers.forEach(controller => controller.traverse(child => {
        if (child instanceof THREE.Line) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
      }));
      renderer.dispose();
      renderer.domElement.remove();
      button.remove();
    };
  }, [open, product, variantIndex]);
  return <section className="vr-showroom">
    <div className="flex flex-wrap justify-between items-center gap-4">
      <div><p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Beyond the virtual mirror</p><h2 className="text-2xl font-semibold mt-2">Step inside the eyewear studio.</h2><p className="text-sm text-neutral-500 mt-2">Explore {product.name} in an immersive WebXR showroom or orbit it on your screen.</p></div>
      <button className="px-6 py-3 bg-black text-white text-sm font-semibold" onClick={() => setOpen(!open)}>{open ? 'Close showroom' : 'Explore VR showroom'}</button>
    </div>
    {open && <><div ref={host} className="relative w-full h-[460px] mt-6 overflow-hidden rounded-lg" /><p className="text-sm mt-3" role="status">{status}</p><p className="text-xs text-neutral-500 mt-2">Headset mode needs a WebXR-compatible browser and HTTPS or localhost. The VR button reports availability on this device.</p></>}
  </section>;
};
