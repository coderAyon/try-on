import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyewearPose, EyewearRig, StableEyewearPose, faceSkullPose } from '../src/utils/landmarkEyewear';

function face(brow = .40, bridge = .44) {
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }));
  for (const [i, x, y, z] of [
    [10,.5,.2,0], [152,.5,.8,0], [168,.5,bridge,-.03],
    [33,.35,.5,0], [133,.45,.5,0], [263,.65,.5,0], [362,.55,.5,0],
    [127,.28,.45,0], [356,.72,.45,0], [234,.27,.5,0], [454,.73,.5,0],
  ]) points[i] = { x, y, z };
  for (const i of [46,53,52,276,283,282]) points[i] = { x: i < 200 ? .4 : .6, y: brow, z: 0 };
  return { points, pose: eyewearPose(points, 640, 480)! };
}
const model = new THREE.Group();
for (const x of [-2,2]) {
  const lens = new THREE.Mesh(new THREE.BoxGeometry(3, 3, .2));
  lens.name = 'lens'; lens.position.x = x; model.add(lens);
}
const rig = new EyewearRig(model);
const low = face(.445), high = face(.37);
const skull = faceSkullPose(low.pose);
const templeMidpoint = low.pose.leftTemple.clone().add(low.pose.rightTemple).multiplyScalar(.5);
const skullFront = skull.position.clone().addScaledVector(low.pose.zAxis, skull.scale.z);
assert(skullFront.clone().sub(templeMidpoint).dot(low.pose.zAxis) < 0,
  'Synthetic skull depth must remain behind the measured face and eyewear');
const fitted = (pose: typeof low.pose) => rig.fittedPosition(pose, rig.fittedScale(pose.eyeSpan, pose.faceWidth));
assert(fitted(low.pose).y < fitted(high.pose).y, 'Different brow heights must change placement');
for (const brow of [.46,.445,.42,.38,.33]) for (const bridge of [.48,.44,.38]) {
  const { pose } = face(brow, bridge);
  const scale = rig.fittedScale(pose.eyeSpan, pose.faceWidth);
  const position = rig.fittedPosition(pose, scale);
  assert(position.distanceTo(pose.position) <= pose.eyeSpan * .080001, 'Brow correction moved off the nose');
  assert(position.y <= pose.position.y, 'Brow correction raised frame');
  assert(Math.abs(position.z - pose.bridge.z - pose.eyeSpan * .012) < 1e-8, 'Closer fit lost nasal clearance');
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.6,-.2));
  const rotated = face(brow, bridge).points.map(p => {
    const v = new THREE.Vector3((p.x-.5)*640, (.5-p.y)*480, -p.z*640).applyQuaternion(q);
    return { x: v.x/640+.5, y: .5-v.y/480, z: -v.z/640 };
  });
  const turned = eyewearPose(rotated,640,480)!;
  assert(rig.fittedPosition(turned,scale).distanceTo(position.clone().applyQuaternion(q)) < 1e-7,
    'Brow correction must stay head-local during turns');
}
// Noise during a deliberate turn must be attenuated without freezing movement.
const clean = new StableEyewearPose(), noisy = new StableEyewearPose();
let inputEnergy = 0, outputEnergy = 0, maxLag = 0;
for (let i=0; i<360; i++) {
  const pose = face().pose;
  const angle = .6*Math.sin(i/60*2);
  const noise = .012*Math.sin(i*2.2);
  const make = (yaw: number) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0));
    const bridge = new THREE.Vector3(i*.8,0,pose.bridge.z);
    return {...pose, quaternion:q, bridge,
      position:pose.position.clone().sub(pose.bridge).applyQuaternion(q).add(bridge)};
  };
  const a = clean.update(make(angle), i*1000/60);
  const b = noisy.update(make(angle+noise), i*1000/60);
  maxLag = Math.max(maxLag,a.quaternion.angleTo(make(angle).quaternion));
  if(i>60) { inputEnergy+=noise**2; outputEnergy+=a.quaternion.angleTo(b.quaternion)**2; }
}
assert(outputEnergy < inputEnergy*.75, 'Motion filter passes too much detector noise');
assert(maxLag*180/Math.PI < 3, 'Motion smoothing added excessive turn lag');
// A projecting cheek under the lens must increase depth only as much as needed.
const cheek = face();
cheek.points[205] = { x: .37, y: .52, z: -.09 };
const cheekPose = eyewearPose(cheek.points, 640, 480)!;
const cheekRig = new EyewearRig(model);
const cheekScale = cheekRig.fittedScale(cheekPose.eyeSpan, cheekPose.faceWidth);
const cheekPosition = cheekRig.fittedPosition(cheekPose, cheekScale);
assert(cheekPosition.z > cheekPose.position.z, 'Cheek collision was not corrected');
assert(cheekPosition.z - cheekPose.position.z <= cheekPose.eyeSpan*.060001,
  'Lens collision correction exceeded the bounded face-lock range');
cheekRig.dispose();

// Oblique tracking must use current measured anatomy rather than a stale frontal template.
const rigid = new StableEyewearPose();
const reference = face().pose;
rigid.update(reference, 0);
const learned = reference.surface.map(p => p.clone());
let rawSurfaceTravel = 0, filteredSurfaceTravel = 0, maxSurfaceError = 0;
let previousRawSurface: THREE.Vector3[] | null = null;
let previousFilteredSurface: THREE.Vector3[] | null = null;
for (let i=1; i<=90; i++) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, .6, .1));
  const bridge = new THREE.Vector3(i, i*.3, 10);
  const pose = {...reference, quaternion:q, bridge, isFrontal:false,
    surface: reference.surface.map(p => p.clone().addScalar(Math.sin(i)*.01)),
    position:reference.position.clone().sub(reference.bridge).applyQuaternion(q).add(bridge)};
  if (previousRawSurface) for (let j=0; j<pose.surface.length; j++) rawSurfaceTravel += pose.surface[j].distanceTo(previousRawSurface[j]);
  const fit = rigid.update(pose,i*1000/30);
  if (previousFilteredSurface) for (let j=0; j<fit.surface.length; j++) filteredSurfaceTravel += fit.surface[j].distanceTo(previousFilteredSurface[j]);
  fit.surface.forEach((p,j) => { maxSurfaceError = Math.max(maxSurfaceError, p.distanceTo(pose.surface[j])); });
  previousRawSurface = pose.surface.map(p => p.clone());
  previousFilteredSurface = fit.surface.map(p => p.clone());
  assert(fit.leftTemple.distanceTo(pose.leftTemple) < 1e-9, 'Temple target changed from measured face');
}
assert(filteredSurfaceTravel < rawSurfaceTravel * .85, 'Face occluder surface noise was not smoothed');
assert(maxSurfaceError < .02, 'Face surface smoothing lagged behind live anatomy');
rig.dispose();
console.log('PASS: individual brows, nasal clearance, bounded correction, rotated fit; face-mask jitter reduction',
  Math.round((1-filteredSurfaceTravel/rawSurfaceTravel)*100)+'%', 'moving pose noise reduction',
  Math.round((1-Math.sqrt(outputEnergy/inputEnergy))*100)+'%', 'max lag', maxLag*180/Math.PI);
