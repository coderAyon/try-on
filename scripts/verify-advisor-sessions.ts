import assert from 'node:assert/strict';
import {FaceMeasurementSampler,FaceMeasurementScan,scoreFaceArchetypes,measurementsDiffer} from '../src/utils/faceFitAdvisor';
import type {FaceShape} from '../src/types';
const fixtures: Record<FaceShape,number[]> = {
 Square:[1.20,.88,.86,.5], Round:[1.17,.78,.80,.45],
 Oval:[1.36,.77,.82,.44], Heart:[1.30,.69,.88,.39], Diamond:[1.33,.68,.73,.40],
};
function face(shape: FaceShape) {
 const [height,jaw,forehead,chin]=fixtures[shape];
 const points=Array.from({length:468},()=>({x:.5,y:.5,z:0}));
 const pair=(a:number,b:number,span:number,y:number)=>{
  points[a]={x:.5-span*100/640,y:.5-y/480,z:0};
  points[b]={x:.5+span*100/640,y:.5-y/480,z:0};
 };
 pair(234,454,1,0);pair(172,397,jaw,-60);pair(132,361,jaw,-40);
 pair(103,332,forehead,60);pair(127,356,forehead,40);pair(148,377,chin*jaw,-90);
 pair(33,263,.45,20);pair(133,362,.25,20);
 points[10]={x:.5,y:.5-height*100/480,z:0};points[152]={x:.5,y:.5+height*100/480,z:0};
 points[168]={x:.5,y:.45,z:0};return points;
}
const sampler=new FaceMeasurementSampler(), scan=new FaceMeasurementScan();
let timestamp=1000;
for(const shape of ['Square','Round','Square','Oval','Heart','Diamond'] as FaceShape[]) {
 scan.reset(); let result;
 for(let i=0;i<12;i++) {
  const sample=sampler.add(face(shape),640,480)!;
  assert(sample,'Valid anatomy rejected');
  assert.equal(sample.shape,shape,'Fresh measurement retained previous wearer');
  sample.measuredAt=timestamp+=160;
  result=scan.add(sample);
  if(i<11) assert.equal(result,undefined,'Scan completed before 12 fresh samples');
 }
 assert.equal(result!.shape,shape);
 assert.equal(result!.samples,12);
 console.log(`PASS fresh landmark scan: ${shape}`);
}
scan.reset();
const a=sampler.add(face('Square'),640,480)!;
const b=sampler.add(face('Round'),640,480)!;
assert(measurementsDiffer(a,b));
for(let i=0;i<10;i++) scan.add({...a,measuredAt:timestamp+=160});
assert.equal(scan.add({...b,measuredAt:timestamp+=160}),undefined);
assert.equal(scan.samples,1,'Person change kept old scan samples');
scan.add({...b,measuredAt:timestamp});assert.equal(scan.samples,1,'Duplicate stats counted twice');
scan.add({...b,measuredAt:timestamp+=1500});assert.equal(scan.samples,1,'Stale samples survived gap');
scan.reset();assert.equal(scan.samples,0);
// All displayed scores round to zero, but nearest-distance ranking still works.
const outlier=scoreFaceArchetypes({heightToWidth:2.1,jawToCheek:.5,foreheadToCheek:.5,foreheadToJaw:1,chinToJaw:.4});
assert.equal(outlier.confidence,0);assert.notEqual(outlier.shape,'Square','Rounded ties defaulted to first shape');
console.log('PASS scan isolation, A/B/A, all five archetypes, duplicate/gap/reset handling, low-similarity ranking');
