import assert from 'node:assert/strict';
import * as THREE from 'three';
import {StableEyewearPose, EyewearRig} from '../src/utils/landmarkEyewear';
const make=(q:THREE.Quaternion,offset=new THREE.Vector3(0,-.05,.025),span=100,bridge=new THREE.Vector3())=>({
 quaternion:q,bridge,position:offset.clone().multiplyScalar(span).applyQuaternion(q).add(bridge),
 eyeSpan:span,faceWidth:220,leftTemple:new THREE.Vector3(-110,0,-30),rightTemple:new THREE.Vector3(110,0,-30),
 yAxis:new THREE.Vector3(0,1,0).applyQuaternion(q),zAxis:new THREE.Vector3(0,0,1).applyQuaternion(q)
});
const stable=new StableEyewearPose();
stable.update(make(new THREE.Quaternion()),0);
let rawJitter=0,filteredJitter=0,rawPosition=0,filteredPosition=0,rawBridgeNoise=0,filteredBridgeNoise=0,rawScaleNoise=0,filteredScaleNoise=0;
for(let i=1;i<180;i++){
 const noise=Math.sin(i*2.1)*.025,offset=new THREE.Vector3(0,-.05+Math.sin(i*1.7)*.02,.025);
 const raw=make(new THREE.Quaternion().setFromEuler(new THREE.Euler(noise,noise*.5,noise)),offset,100+Math.sin(i*2.3),new THREE.Vector3(Math.sin(i*2.2)*.8,Math.cos(i*1.9)*.8,Math.sin(i*2.4)*.5));
 const fit=stable.update(raw,i*1000/30);
 if(i>30){rawBridgeNoise+=raw.bridge.lengthSq();filteredBridgeNoise+=fit.bridge.lengthSq();rawScaleNoise+=(raw.eyeSpan-100)**2;filteredScaleNoise+=(fit.eyeSpan-100)**2;rawJitter+=raw.quaternion.angleTo(new THREE.Quaternion())**2;filteredJitter+=fit.quaternion.angleTo(new THREE.Quaternion())**2;
 rawPosition+=raw.position.distanceTo(new THREE.Vector3(0,-5,2.5))**2;filteredPosition+=fit.position.distanceTo(new THREE.Vector3(0,-5,2.5))**2;}
}
assert(filteredJitter < rawJitter*.2,'Rotation jitter reduction insufficient');
assert(filteredPosition < rawPosition*.5,'Anchor jitter reduction insufficient');
assert(filteredBridgeNoise<rawBridgeNoise*.15,'Stationary bridge noise insufficiently suppressed');
assert(filteredScaleNoise<rawScaleNoise*.15,'Stationary scale noise insufficiently suppressed');
// Reversing detector noise must stay suppressed at different camera rates.
for (const fps of [20, 30, 60]) {
 stable.reset(); stable.update(make(new THREE.Quaternion()), 0);
 let rawEnergy = 0, fittedEnergy = 0;
 for (let i = 1; i < fps * 6; i++) {
  const noise = Math.sin(i * 2.1) * .025;
  const raw = make(new THREE.Quaternion().setFromEuler(new THREE.Euler(noise, noise * .5, noise)));
  const fitted = stable.update(raw, i * 1000 / fps);
  if (i > fps) {
   rawEnergy += raw.quaternion.angleTo(new THREE.Quaternion()) ** 2;
   fittedEnergy += fitted.quaternion.angleTo(new THREE.Quaternion()) ** 2;
  }
 }
 assert(fittedEnergy < rawEnergy * .2, `Stationary rotation noise at ${fps} fps`);
 // Small intentional turns must still open the adaptive filter.
 stable.reset(); let lag = 0;
 for (let i = 0; i < fps * 4; i++) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .08 * Math.sin(i / fps * 2), 0));
  const fitted = stable.update(make(q), i * 1000 / fps);
  lag = Math.max(lag, fitted.quaternion.angleTo(q) * 180 / Math.PI);
 }
 assert(lag < 3, `Small intentional turn lag at ${fps} fps`);
}
stable.reset();let maxLag=0,maxAnchorError=0;
const anchor=new THREE.Vector3(0,-.05,.025);
for(let i=0;i<180;i++){
 const angle=Math.sin(i/30)*.7,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(angle*.7,angle*.6,angle));
 const bridge=new THREE.Vector3(i*.8,Math.sin(i/20)*12,0);
 const fit=stable.update(make(q,anchor,100,bridge),i*1000/30);
 maxLag=Math.max(maxLag,fit.quaternion.angleTo(q)*180/Math.PI);
 const expected=anchor.clone().multiplyScalar(fit.eyeSpan).applyQuaternion(fit.quaternion).add(bridge);
 maxAnchorError=Math.max(maxAnchorError,fit.position.distanceTo(expected));
}
assert(maxLag<3,'Motion lag exceeds 3 degrees');
assert(maxAnchorError<3,'Translation lag exceeds three source pixels');
// Sudden translation must open the filter instead of leaving the frame behind.
for(const fps of [20,30,60]){
 stable.reset();stable.update(make(new THREE.Quaternion()),0);
 let fit=make(new THREE.Quaternion());
 for(let i=1;i<=Math.ceil(fps*.15);i++)fit=stable.update(make(new THREE.Quaternion(),anchor,120,new THREE.Vector3(20,15,5)),i*1000/fps);
 assert(fit.bridge.distanceTo(new THREE.Vector3(20,15,5))<1,'Sudden translation failed to catch up');
 assert(Math.abs(fit.eyeSpan-120)<1,'Distance change failed to catch up');
 const fresh=make(new THREE.Quaternion(),anchor,80,new THREE.Vector3(-30,20,0));
 assert(stable.update(fresh,2000).bridge.distanceTo(fresh.bridge)<1e-6,'Tracking gap retained stale anchor');
}
stable.reset();const reacquired=make(new THREE.Quaternion().setFromEuler(new THREE.Euler(.7,.6,.5)));
assert(stable.update(reacquired,9000).quaternion.angleTo(reacquired.quaternion)<1e-6,'Reacquisition kept stale pose');
// Approach / retreat at different frame rates must scale every rig proportionally
// without teaching the sizing filter a false facial proportion.
for(const fps of [20,30,60]){
 stable.reset();
 const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(8.8,3,.4),new THREE.MeshBasicMaterial()));
 const rig=new EyewearRig(model);
 let baseline=0,maxScaleError=0;
 for(let i=0;i<fps*4;i++){
  const span=100*(1+.4*Math.sin(i/fps*Math.PI/2));
  const raw=make(new THREE.Quaternion(),anchor,span,new THREE.Vector3(span*.2,span*.1,0));raw.faceWidth=span*2.2;
  const fit=stable.update(raw,i*1000/fps),scale=rig.fittedScale(fit.eyeSpan,fit.faceWidth);
  if(!i)baseline=scale/100;
  assert(Math.abs(fit.faceWidth/fit.eyeSpan-2.2)<1e-8,'Zoom corrupted facial proportion');
  maxScaleError=Math.max(maxScaleError,Math.abs(scale/(span*baseline)-1));
 }
 assert(maxScaleError<.04,'Continuous approach/retreat scale error exceeds four percent');
 rig.dispose();
}
console.log({bridgeNoiseReduction:1-Math.sqrt(filteredBridgeNoise/rawBridgeNoise),scaleNoiseReduction:1-Math.sqrt(filteredScaleNoise/rawScaleNoise),rotationJitterReduction:1-Math.sqrt(filteredJitter/rawJitter),anchorJitterReduction:1-Math.sqrt(filteredPosition/rawPosition),maxLagDeg:maxLag,maxAnchorError});

