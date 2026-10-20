import assert from 'node:assert/strict';
import * as THREE from 'three';
import { JSDOM } from 'jsdom';
import { EyewearRig } from '../src/utils/landmarkEyewear';
import { extractHighResImageUrl } from '../extension/src/utils/imageExtractor';

const model = new THREE.Group();
const geometry = new THREE.PlaneGeometry(8.8, 3, 24, 4);
const positions = geometry.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < positions.count; i++) positions.setZ(i, -(positions.getX(i) ** 2) / 28);
const front = new THREE.Mesh(geometry); front.name = 'custom-frame-front'; model.add(front);
for (const side of [-1, 1]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .22, 6.2));
  arm.position.set(side * 4.4, 0, -3.1); model.add(arm);
}
model.updateMatrixWorld(true);
const rig = new EyewearRig(model);
const fittedFront = rig.group.children.find(m => m.name === 'custom-frame-front') as THREE.Mesh;
const before = Array.from(fittedFront.geometry.attributes.position.array);
fittedFront.geometry.computeBoundingBox();
assert.ok(Math.abs(fittedFront.geometry.boundingBox!.max.x - 4.4) < 1e-5);
for (const width of [4, 5, 6]) rig.fitTemples(new THREE.Vector3(-width, .2, -4), new THREE.Vector3(width, -.2, -5));
assert.deepEqual(Array.from(fittedFront.geometry.attributes.position.array), before, 'Custom front must remain rigid');

const dom = new JSDOM('<img alt="polarized sunglasses" src="/low.jpg" srcset="/small.jpg 300w, /big.jpg 1200w">', {url: 'https://shop.example/product'});
Object.assign(globalThis, {window: dom.window, document: dom.window.document, HTMLImageElement: dom.window.HTMLImageElement, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver});
const img = dom.window.document.querySelector('img')!;
img.getBoundingClientRect = () => ({width: 400, height: 200, top: 0, right: 400, left: 0, bottom: 200, x: 0, y: 0, toJSON() {}});
assert.equal(extractHighResImageUrl(img as any), 'https://shop.example/big.jpg');
let backgroundListener: any;
const sent: any[] = [], updated: any[] = [], created: any[] = [];
const tabs = [{id: 1, url: 'http://localhost:5000/admin'}, {id: 2, url: 'http://localhost:3000/'}];
Object.assign(globalThis, {chrome: {
  storage: {local: {get: (_keys: any, cb: any) => cb({}), set: (_v: any, cb: any) => cb()}},
  runtime: {onInstalled: {addListener() {}}, onMessage: {addListener(fn: any) {backgroundListener = fn;}}, sendMessage(m: any) {sent.push(m);}},
  contextMenus: {create() {}, onClicked: {addListener() {}}},
  tabs: {query: async () => tabs, update: async (...args: any[]) => updated.push(args), create: async (v: any) => created.push(v)},
  windows: {update: async () => {}}
}});
await import('../extension/src/background/service-worker');
await new Promise<void>(resolve => backgroundListener({type: 'OPEN_TRYON', payload: {frame: 'https://shop.example/big.jpg'}}, {}, (r: any) => {assert.equal(r.success, true); resolve();}));
assert.equal(updated[0][0], 2, 'Must not navigate another localhost app');
tabs.splice(1, 1);
await new Promise<void>(resolve => backgroundListener({type: 'OPEN_TRYON', payload: {frame: 'https://shop.example/big.jpg'}}, {}, () => resolve()));
assert.equal(created.length, 1);
await import('../extension/src/content/content-script');
await new Promise(resolve => setTimeout(resolve, 20));
img.dispatchEvent(new dom.window.MouseEvent('mouseenter'));
img.setAttribute('srcset', '/changed.jpg 1200w');
(dom.window.document.querySelector('.lumen-tryon-badge') as HTMLElement).click();
assert.equal(sent.at(-1).payload.frame, 'https://shop.example/changed.jpg', 'Click must read current variant');
dom.window.close(); rig.dispose();
console.log('PASS: custom front rigidity, relative URL resolution, exact app origin, new tab fallback, dynamic product image');
process.exit(0);
