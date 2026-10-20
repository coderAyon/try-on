import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyewearPose, EyewearRig, StableEyewearPose } from '../src/utils/landmarkEyewear';
import { LensDepthSurface } from '../src/utils/lensDepthSurface';

// Geometry coverage: circular corners must not push a lens, and curved depth
// must come from the local surface rather than a global bounding-box maximum.
const circle = new THREE.CircleGeometry(1, 64);
const depth = new LensDepthSurface([circle]);
assert.equal(depth.at(.9, .9), null, 'Empty lens corner treated as glass');
assert(Math.abs(depth.at(0, 0)!) < 1e-6);
const tilted = new THREE.PlaneGeometry(2, 2).rotateY(.5);
const curved = new LensDepthSurface([tilted]);
assert(curved.at(-.5, 0)! > curved.at(.5, 0)! + .4, 'Local lens depth was flattened');

function model(width: number, height: number, arm: number) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(width * .36, height, .1));
    lens.name = 'lens'; lens.position.x = side * width * .26; group.add(lens);
    const temple = new THREE.Mesh(new THREE.BoxGeometry(.15, .15, arm));
    temple.position.set(side * width * .48, .5, -arm / 2); group.add(temple);
  }
  return group;
}
function face(width: number, height: number, yaw: number, pitch: number, zoom: number) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, .1, 'YXZ'));
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }));
  for (const [i,x,y,z] of [[10,0,130*height,-20],[152,0,-160*height,-20],[168,0,25,10],
    [33,-75,0,0],[133,-45,0,0],[263,75,0,0],[362,45,0,0],
    [127,-135*width,5,-35],[356,135*width,5,-35],
    [234,-140*width,-30,-20],[454,140*width,-30,-20]]) {
    const p = new THREE.Vector3(x,y,z).multiplyScalar(zoom).applyQuaternion(q);
    points[i] = { x:.5+p.x/640, y:.5-p.y/480, z:-p.z/640 };
  }
  return eyewearPose(points,640,480)!;
}
let combinations = 0;
for (const width of [.8, 1, 1.2]) for (const height of [.85, 1.15]) {
  for (const dimensions of [[8, 2, 5], [10, 4, 9], [12, 3, 12]]) for (const fps of [20,30,60]) {
    const source = model(...dimensions as [number,number,number]);
    const rig = new EyewearRig(source);
    const tracker = new StableEyewearPose();
    const lenses = rig.group.children.filter(m => m.name === 'lens') as THREE.Mesh[];
    const originals = lenses.map(m => Array.from(m.geometry.getAttribute('position').array));
    let baseline = 0;
    for (let i=0; i<=fps*3; i++) {
      const time = i / fps;
      const yaw = .75 * Math.sin(time * 2), pitch = .35 * Math.sin(time * 3);
      const zoom = 1 + .2 * Math.sin(time);
      const pose = tracker.update(face(width,height,yaw,pitch,zoom),time*1000);
      const scale = rig.fittedFaceScale(pose,time*1000);
      if (!i) baseline = scale;
      assert(Number.isFinite(scale) && scale > 0);
      assert(Math.abs(scale / (baseline * zoom) - 1) < .08, 'Rigid head turn changed physical frame size excessively');
      const position = rig.fittedPosition(pose,scale,time*1000);
      const inverse = pose.quaternion.clone().invert();
      const local = (p: THREE.Vector3) => p.clone().sub(position).applyQuaternion(inverse).divideScalar(scale);
      rig.fitTemples(local(pose.leftTemple),local(pose.rightTemple),time*1000);
      assert(position.distanceTo(pose.position) <= pose.eyeSpan * .11, 'Nasal seat detached');
    }
    lenses.forEach((m,i)=>assert.deepEqual(Array.from(m.geometry.getAttribute('position').array), originals[i], 'Fitting deformed a lens'));
    // Reusing a rig for a new person must forget size, depth and arm history.
    rig.resetFitRatio();
    const next = face(width*.9,height,0,0,.8);
    const fresh = new EyewearRig(source);
    assert(Math.abs(rig.fittedFaceScale(next,5000)-fresh.fittedFaceScale(next,5000))<1e-9);
    assert(rig.fittedPosition(next,20,5000).distanceTo(fresh.fittedPosition(next,20,5000))<1e-9);
    const changed = face(width*1.1,height,0,0,1.1);
    const independent = new EyewearRig(source);
    const expected = independent.fittedFaceScale(changed,6000);
    assert(Math.abs(rig.fittedFaceScale(changed,6000)-expected)<1e-9,'Tracking gap retained another face fit');
    assert(Math.abs(fresh.fittedFaceScale(changed,6000)-expected)<1e-9,'Cached geometry leaked frame fitting state');
    independent.dispose();
    rig.dispose(); fresh.dispose(); combinations++;
  }
}
console.log(`PASS: ${combinations} face-proportion/model/FPS combinations; yaw, pitch, distance, immutable lenses, new-person reset; lens silhouette/local-depth checks.`);

// Equal elapsed time must give the same arm response, independently of FPS.
const endpoints: number[] = [];
for (const fps of [20,30,60]) {
  const rig = new EyewearRig(model(10,3,9));
  rig.fitTemples(new THREE.Vector3(-5,0,-4),new THREE.Vector3(5,0,-4),0);
  for (let i=1; i<=fps/5; i++) rig.fitTemples(new THREE.Vector3(-5,0,-5),new THREE.Vector3(5,0,-5),i*1000/fps);
  endpoints.push(new THREE.Box3().setFromObject(rig.group,true).min.z);
  rig.dispose();
}
assert(Math.max(...endpoints)-Math.min(...endpoints)<1e-5,'Arm damping changes with camera FPS');
console.log('PASS: identical arm settling after 200 ms at 20/30/60 FPS.');

const personal = new StableEyewearPose();
const acquired = personal.update(face(.85,1,0,0,1),0);
const profile = acquired.skinProfile;
for (let i=1;i<=60;i++) {
  const sample = face(.85+.015*Math.sin(i),1,.7*Math.sin(i/20),.2,1);
  assert.deepEqual(personal.update(sample,i*1000/30).skinProfile,profile,'Turn noise changed learned skin proportions');
}
const differentFace = face(1.2,1,0,0,1);
assert.deepEqual(personal.update(differentFace,3000).skinProfile,differentFace.skinProfile,'New face kept previous skin profile');
console.log('PASS: personal skin profile stable during turns and relearned on reacquisition.');
