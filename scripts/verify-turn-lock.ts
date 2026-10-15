import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eyewearPose, StableEyewearPose } from '../src/utils/landmarkEyewear';

function sample(yaw: number, pitch: number, zoom = 1, widthError = 0, anchorError = 0) {
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  for (const [i,x,y,z] of [[10,0,130,-20],[152,0,-160,-20],[168,0,25,10],
    [33,-75,0,0],[133,-45,0,0],[263,75,0,0],[362,45,0,0],
    [127,-135,5,-35],[356,135,5,-35],[234,-140,-30,-20],[454,140,-30,-20]]) {
    const p = new THREE.Vector3(x,y,z).multiplyScalar(zoom).applyQuaternion(q);
    points[i] = {x:.5+p.x/640,y:.5-p.y/480,z:-p.z/640};
  }
  const pose = eyewearPose(points,640,480)!;
  // Simulate horizontal depth inflation and eye-midpoint drift from inference.
  pose.scaleSpan *= 1 + widthError;
  pose.eyeSpan *= 1 + widthError;
  pose.position.addScaledVector(pose.yAxis, anchorError);
  return pose;
}
for (const fps of [20,30,60]) {
  const tracker = new StableEyewearPose();
  const first = tracker.update(sample(0,0),0);
  const anchor = first.position.clone().sub(first.bridge).applyQuaternion(first.quaternion.clone().invert()).divideScalar(first.eyeSpan);
  let maxGrowth = 0;
  for(let i=1;i<=fps*8;i++) {
    const yaw=.7*Math.sin(i/fps*2);
    const pose=sample(yaw,0,1,.1*Math.abs(Math.sin(yaw)),3*Math.sin(i/fps*2));
    const fit=tracker.update(pose,i*1000/fps);
    maxGrowth=Math.max(maxGrowth,fit.eyeSpan/first.eyeSpan-1);
    const local=fit.position.clone().sub(fit.bridge).applyQuaternion(fit.quaternion.clone().invert()).divideScalar(fit.eyeSpan);
    assert(local.distanceTo(anchor)<1e-9,'Nasal seat rocked during turn/front transitions');
  }
  assert(maxGrowth<.025,`Repeated yaw enlarged frame by ${maxGrowth*100}% at ${fps} FPS`);
  for(let i=1;i<=fps*2;i++) {
    const fit=tracker.update(sample(0,0),8000+i*1000/fps);
    if(i===fps*2) assert(Math.abs(fit.eyeSpan/first.eyeSpan-1)<.001,'Turn permanently changed size');
  }
  // A real distance change while holding an oblique pose must still resize.
  for(let i=1;i<=fps*2;i++) {
    const fit=tracker.update(sample(.6,0,1.3),10000+i*1000/fps);
    if(i===fps*2) assert(Math.abs(fit.eyeSpan/(first.eyeSpan*1.3)-1)<.01,'Profile zoom was frozen');
  }
  // Pitch-only rigid rotation must not change the measured dimensions.
  const nod = new StableEyewearPose();
  nod.update(sample(0,0),0);
  for(let i=1;i<=fps*3;i++) {
    const fit=nod.update(sample(0,.5*Math.sin(i/fps*2)),i*1000/fps);
    assert(Math.abs(fit.eyeSpan/first.eyeSpan-1)<1e-9,'Rigid nod changed frame size');
  }
  console.log(`PASS ${fps} FPS: max yaw growth ${(maxGrowth*100).toFixed(2)}%; fixed nasal seat; return, profile zoom, nod`);
}
